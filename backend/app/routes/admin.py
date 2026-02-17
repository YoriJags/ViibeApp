"""
Vibe App - Admin Routes
Super admin treasury, venue management, integrity monitoring, clout economy.
"""
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Request

from app.config import db, PULSE_DROP_TIERS
from app.models import AdminOverride, AirdropRequest
from app.services.auth import get_current_user
from app.services.vibe import calculate_venue_aggregate
from app.services.realtime import broadcast_venue_update, connected_clients

router = APIRouter(tags=["admin"])


@router.get("/admin/treasury")
async def get_global_treasury(request: Request, city: Optional[str] = None):
    """Get global treasury stats with Revenue Heatmap."""
    user = await get_current_user(request)
    if not user or not user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Super admin access required")

    now = datetime.now(timezone.utc)
    day_ago = now - timedelta(hours=24)
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)

    total_revenue = await db.platform_revenue.aggregate([
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]).to_list(1)

    today_revenue = await db.platform_revenue.aggregate([
        {"$match": {"timestamp": {"$gte": day_ago}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]).to_list(1)

    city_revenue = await db.platform_revenue.aggregate([
        {"$match": {"timestamp": {"$gte": month_ago}}},
        {"$group": {"_id": "$city", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
    ]).to_list(10)

    tier_revenue = await db.platform_revenue.aggregate([
        {"$match": {"timestamp": {"$gte": month_ago}}},
        {"$group": {"_id": "$tier", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
    ]).to_list(10)

    hour_ago = now - timedelta(hours=1)
    recent_ratings = await db.ratings.count_documents({"timestamp": {"$gte": now - timedelta(minutes=15)}})
    total_hour_ratings = await db.ratings.count_documents({"timestamp": {"$gte": hour_ago}})
    data_freshness = (recent_ratings / total_hour_ratings * 100) if total_hour_ratings > 0 else 100

    network_health = {
        "active_connections": len(connected_clients),
        "total_venues": await db.venues.count_documents({}),
        "verified_venues": await db.venues.count_documents({"is_verified": True}),
        "total_users": await db.users.count_documents({}),
        "active_users_24h": len(await db.ratings.distinct("user_id", {"timestamp": {"$gte": day_ago}})),
    }

    return {
        "global": {
            "total_revenue": total_revenue[0]["total"] if total_revenue else 0,
            "today_revenue": today_revenue[0]["total"] if today_revenue else 0,
        },
        "revenue_by_city": {item["_id"]: {"total": item["total"], "transactions": item["count"]} for item in city_revenue if item["_id"]},
        "revenue_by_tier": {item["_id"]: {"total": item["total"], "transactions": item["count"]} for item in tier_revenue if item["_id"]},
        "network_health": network_health,
        "data_freshness_percent": round(data_freshness, 1),
    }


@router.get("/admin/venues")
async def get_admin_venues(request: Request, city: Optional[str] = None, verified: Optional[bool] = None):
    """Get all venues (admin view)."""
    user = await get_current_user(request)
    if not user or not user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Super admin access required")

    query = {}
    if city:
        query["city"] = city
    if verified is not None:
        query["is_verified"] = verified

    venues = await db.venues.find(query, {"_id": 0}).to_list(500)
    return venues


@router.post("/admin/venue/{venue_id}/verify")
async def verify_venue(venue_id: str, request: Request):
    """Verify or unverify a venue."""
    user = await get_current_user(request)
    if not user or not user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Super admin access required")

    body = await request.json()
    verified = body.get("verified", True)
    reason = body.get("reason", "")

    await db.venues.update_one({"id": venue_id}, {"$set": {"is_verified": verified}})

    override = AdminOverride(
        venue_id=venue_id,
        admin_id=user["id"],
        override_type="verify" if verified else "unverify",
        reason=reason,
    )
    await db.admin_overrides.insert_one(override.dict())

    return {"message": f"Venue {'verified' if verified else 'unverified'}"}


@router.post("/admin/venue/{venue_id}/override")
async def admin_override_venue(venue_id: str, request: Request):
    """Apply admin override to a venue (suppress, score override, etc)."""
    user = await get_current_user(request)
    if not user or not user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Super admin access required")

    body = await request.json()
    override_type = body.get("type")
    value = body.get("value")
    reason = body.get("reason", "")

    update_data = {}
    if override_type == "suppress":
        update_data["is_suppressed"] = True
    elif override_type == "unsuppress":
        update_data["is_suppressed"] = False
    elif override_type == "score_override":
        update_data["admin_override_score"] = value
    elif override_type == "clear_override":
        update_data["admin_override_score"] = None
        update_data["is_suppressed"] = False

    await db.venues.update_one({"id": venue_id}, {"$set": update_data})

    aggregate = await calculate_venue_aggregate(venue_id)
    await db.venues.update_one({"id": venue_id}, {"$set": aggregate})

    override = AdminOverride(
        venue_id=venue_id,
        admin_id=user["id"],
        override_type=override_type,
        override_value=value,
        reason=reason,
    )
    await db.admin_overrides.insert_one(override.dict())

    await broadcast_venue_update(venue_id)

    return {"message": f"Override applied: {override_type}"}


@router.put("/admin/pulse-drop-pricing")
async def update_pulse_drop_pricing(request: Request):
    """Dynamically update Pulse Drop tier pricing."""
    user = await get_current_user(request)
    if not user or not user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Super admin access required")

    body = await request.json()
    tier = body.get("tier")
    new_price = body.get("price")

    if tier not in PULSE_DROP_TIERS:
        raise HTTPException(status_code=400, detail="Invalid tier")
    if new_price < 1000:
        raise HTTPException(status_code=400, detail="Minimum price is NGN1,000")

    await db.config.update_one(
        {"key": f"pulse_drop_price_{tier}"},
        {"$set": {"value": new_price}},
        upsert=True,
    )

    PULSE_DROP_TIERS[tier]["price"] = new_price

    return {"message": f"{tier} price updated to NGN{new_price:,}"}


@router.get("/admin/pulse-ledger")
async def get_pulse_ledger(request: Request, limit: int = 50):
    """Treasury Ledger: All Pulse Drop transactions with resulting scout activity."""
    user = await get_current_user(request)
    if not user or not user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Super admin access required")

    pulse_drops = await db.pulse_drops.find({}, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)

    ledger = []
    for drop in pulse_drops:
        venue = await db.venues.find_one({"id": drop["venue_id"]}, {"_id": 0, "name": 1, "area": 1, "current_vibe_score": 1})

        drop_created = drop["created_at"]
        if isinstance(drop_created, str):
            drop_created = datetime.fromisoformat(drop_created.replace("Z", "+00:00"))

        drop_expires = drop.get("expires_at")
        if isinstance(drop_expires, str):
            drop_expires = datetime.fromisoformat(drop_expires.replace("Z", "+00:00"))
        elif drop_expires is None:
            drop_expires = drop_created + timedelta(hours=2)

        ratings_during = await db.ratings.count_documents({
            "venue_id": drop["venue_id"],
            "timestamp": {"$gte": drop_created, "$lte": drop_expires},
        })

        profile_views_before = drop.get("profile_views_before", 0)
        direction_clicks_before = drop.get("direction_clicks_before", 0)
        current_views = venue.get("profile_views", 0) if venue else 0
        current_clicks = venue.get("direction_clicks", 0) if venue else 0

        ledger.append({
            "drop_id": drop["id"],
            "venue_name": venue.get("name", "Unknown") if venue else "Unknown",
            "venue_area": venue.get("area", "") if venue else "",
            "current_vibe_score": venue.get("current_vibe_score", 0) if venue else 0,
            "tier": drop["tier"],
            "amount": drop["price_paid"],
            "created_at": drop["created_at"].isoformat() if isinstance(drop["created_at"], datetime) else drop["created_at"],
            "expires_at": drop.get("expires_at").isoformat() if isinstance(drop.get("expires_at"), datetime) else drop.get("expires_at"),
            "scout_activity": f"+{ratings_during} Checks",
            "ratings_count": ratings_during,
            "profile_views_gained": max(0, current_views - profile_views_before),
            "direction_clicks_gained": max(0, current_clicks - direction_clicks_before),
        })

    return {
        "ledger": ledger,
        "total_drops": await db.pulse_drops.count_documents({}),
        "total_revenue": sum(item["amount"] for item in ledger),
    }


@router.get("/admin/integrity-monitor")
async def get_integrity_monitor(request: Request):
    """Compare average energy scores of Sponsored vs Organic venues."""
    user = await get_current_user(request)
    if not user or not user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Super admin access required")

    now = datetime.now(timezone.utc)
    all_venues = await db.venues.find({}, {"_id": 0}).to_list(500)

    sponsored_venues = []
    organic_venues = []

    for venue in all_venues:
        is_sponsored = False
        if venue.get("active_pulse_tier") and venue.get("pulse_expires_at"):
            pulse_expires_raw = venue.get("pulse_expires_at")
            if isinstance(pulse_expires_raw, datetime):
                pulse_expires = pulse_expires_raw.replace(tzinfo=timezone.utc) if pulse_expires_raw.tzinfo is None else pulse_expires_raw
            else:
                pulse_expires = datetime.fromisoformat(str(pulse_expires_raw).replace("Z", "+00:00"))
            is_sponsored = pulse_expires > now

        venue_data = {
            "id": venue["id"],
            "name": venue["name"],
            "energy_score": venue.get("current_vibe_score", 0),
            "energy_level": venue.get("energy_level", "chill"),
        }

        if is_sponsored:
            sponsored_venues.append(venue_data)
        else:
            organic_venues.append(venue_data)

    sponsored_avg = sum(v["energy_score"] for v in sponsored_venues) / len(sponsored_venues) if sponsored_venues else 0
    organic_avg = sum(v["energy_score"] for v in organic_venues) / len(organic_venues) if organic_venues else 0

    integrity_warnings = [
        {
            "venue_id": v["id"],
            "venue_name": v["name"],
            "energy_score": v["energy_score"],
            "issue": "Sponsored venue with low energy - may hurt app reputation",
        }
        for v in sponsored_venues if v["energy_score"] < 40
    ]

    def get_distribution(venues):
        return {
            "electric": sum(1 for v in venues if v["energy_score"] >= 80),
            "popping": sum(1 for v in venues if 60 <= v["energy_score"] < 80),
            "moderate": sum(1 for v in venues if 40 <= v["energy_score"] < 60),
            "quiet": sum(1 for v in venues if v["energy_score"] < 40),
        }

    return {
        "sponsored": {
            "count": len(sponsored_venues),
            "average_energy": round(sponsored_avg, 1),
            "venues": sponsored_venues,
            "distribution": get_distribution(sponsored_venues),
        },
        "organic": {
            "count": len(organic_venues),
            "average_energy": round(organic_avg, 1),
            "distribution": get_distribution(organic_venues),
        },
        "delta": round(sponsored_avg - organic_avg, 1),
        "integrity_warnings": integrity_warnings,
        "health_status": "healthy" if sponsored_avg >= organic_avg * 0.7 else "warning" if sponsored_avg >= organic_avg * 0.5 else "critical",
    }


@router.get("/admin/clout-economy")
async def get_clout_economy(request: Request, city: str = "lagos"):
    """Global Clout Economy: Total clout in circulation and Top 10 Scouts."""
    user = await get_current_user(request)
    if not user or not user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Super admin access required")

    clout_stats = await db.users.aggregate([
        {"$group": {"_id": None, "total_clout": {"$sum": "$clout_points"}, "total_users": {"$sum": 1}}},
    ]).to_list(1)
    total_clout = clout_stats[0]["total_clout"] if clout_stats else 0
    total_users = clout_stats[0]["total_users"] if clout_stats else 0
    avg_clout = total_clout / total_users if total_users > 0 else 0

    top_scouts = await db.users.find(
        {"clout_points": {"$gt": 0}},
        {"_id": 0, "id": 1, "username": 1, "clout_points": 1, "scout_status": 1, "total_ratings": 1},
    ).sort("clout_points", -1).limit(10).to_list(10)

    tier_colors = {"elite": "#FF3366", "scout": "#FFD700", "regular": "#00D4FF"}
    for i, scout in enumerate(top_scouts):
        scout["rank"] = i + 1
        scout["tier_color"] = tier_colors.get(scout.get("scout_status"), "#666666")

    tier_distribution = await db.users.aggregate([
        {"$group": {"_id": "$scout_status", "count": {"$sum": 1}, "total_clout": {"$sum": "$clout_points"}}},
    ]).to_list(10)

    return {
        "total_clout_circulation": total_clout,
        "total_users": total_users,
        "average_clout": round(avg_clout, 1),
        "top_scouts": top_scouts,
        "tier_distribution": {item["_id"]: {"count": item["count"], "clout": item["total_clout"]} for item in tier_distribution if item["_id"]},
    }


@router.post("/admin/clout-airdrop")
async def airdrop_clout(airdrop: AirdropRequest, request: Request):
    """Airdrop bonus Clout to top scouts during special events."""
    user = await get_current_user(request)
    if not user or not user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Super admin access required")

    if airdrop.amount <= 0:
        raise HTTPException(status_code=400, detail="Airdrop amount must be positive")
    if len(airdrop.user_ids) == 0:
        raise HTTPException(status_code=400, detail="No users selected for airdrop")

    now = datetime.now(timezone.utc)

    result = await db.users.update_many(
        {"id": {"$in": airdrop.user_ids}},
        {"$inc": {"clout_points": airdrop.amount}},
    )

    await db.clout_airdrops.insert_one({
        "id": str(uuid.uuid4()),
        "admin_id": user["id"],
        "user_ids": airdrop.user_ids,
        "amount_per_user": airdrop.amount,
        "total_amount": airdrop.amount * len(airdrop.user_ids),
        "reason": airdrop.reason,
        "timestamp": now,
        "users_updated": result.modified_count,
    })

    return {
        "success": True,
        "message": f"Airdrop complete! {result.modified_count} scouts received +{airdrop.amount} Clout",
        "users_updated": result.modified_count,
        "total_clout_distributed": airdrop.amount * result.modified_count,
    }


@router.get("/admin/airdrop-history")
async def get_airdrop_history(request: Request, limit: int = 20):
    """Get history of clout airdrops."""
    user = await get_current_user(request)
    if not user or not user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Super admin access required")

    history = await db.clout_airdrops.find({}, {"_id": 0}).sort("timestamp", -1).limit(limit).to_list(limit)
    return {"history": history}


@router.get("/admin/user-analytics")
async def get_user_analytics(request: Request):
    """User Analytics: Active vs Ghost users, tier distribution, signup trends."""
    user = await get_current_user(request)
    if not user or not user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Super admin access required")

    now = datetime.now(timezone.utc)
    day_ago = now - timedelta(days=1)
    week_ago = now - timedelta(days=7)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    total_users = await db.users.count_documents({})
    active_user_ids_24h = await db.ratings.distinct("user_id", {"timestamp": {"$gte": day_ago}})
    active_users_24h = len(active_user_ids_24h)
    active_user_ids_7d = await db.ratings.distinct("user_id", {"timestamp": {"$gte": week_ago}})
    active_users_7d = len(active_user_ids_7d)

    ghost_users = await db.users.count_documents({"total_ratings": {"$lte": 0}})
    ghost_percentage = round((ghost_users / total_users * 100) if total_users > 0 else 0, 1)
    new_users_today = await db.users.count_documents({"created_at": {"$gte": today_start}})

    tier_stats = await db.users.aggregate([
        {"$group": {"_id": "$scout_status", "count": {"$sum": 1}}},
    ]).to_list(10)
    tier_distribution = {"elite": 0, "scout": 0, "regular": 0, "newbie": 0}
    for stat in tier_stats:
        if stat["_id"] in tier_distribution:
            tier_distribution[stat["_id"]] = stat["count"]

    return {
        "total_users": total_users,
        "active_users_24h": active_users_24h,
        "active_users_7d": active_users_7d,
        "ghost_users": ghost_users,
        "ghost_percentage": ghost_percentage,
        "new_users_today": new_users_today,
        "tier_distribution": tier_distribution,
    }
