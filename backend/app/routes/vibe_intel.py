"""
Vibe Intelligence + Aura Shield Routes
Deep analytics for merchants about their venue's energy patterns.
Optimized with MongoDB aggregation pipelines instead of in-memory loops.
"""
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.config import db, logger
from app.services.auth import get_current_user

router = APIRouter(tags=["vibe-intelligence"])


class AuraShieldUpdate(BaseModel):
    enabled: bool = False
    threshold: int = 50
    alert_on: list[str] = ["score_drop"]


@router.get("/merchant/venue/{venue_id}/vibe-intelligence")
async def get_vibe_intelligence(venue_id: str, request: Request):
    """Deep vibe analytics for merchants. Uses aggregation pipelines."""
    user = await get_current_user(request)
    if not user or user.get("merchant_venue_id") != venue_id:
        raise HTTPException(status_code=403, detail="Not authorized for this venue")

    venue = await db.venues.find_one({"id": venue_id})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)
    two_weeks_ago = now - timedelta(days=14)

    # 1. Hourly energy curve via aggregation (replaces fetching 5000 snapshots + Python loop)
    hourly_pipeline = [
        {"$match": {"venue_id": venue_id, "timestamp": {"$gte": week_ago}}},
        {"$group": {
            "_id": {"$hour": "$timestamp"},
            "avg_score": {"$avg": "$vibe_score"},
            "sample_count": {"$sum": 1},
        }},
    ]
    hourly_results = await db.vibe_snapshots.aggregate(hourly_pipeline).to_list(24)
    hourly_map = {r["_id"]: r for r in hourly_results}

    energy_curve = []
    peak_hour = None
    peak_score = 0
    for h in range(24):
        data = hourly_map.get(h)
        avg = round(data["avg_score"], 1) if data else 0
        count = data["sample_count"] if data else 0
        energy_curve.append({
            "hour": h,
            "hour_label": f"{h:02d}:00",
            "avg_score": avg,
            "sample_count": count,
        })
        if avg > peak_score:
            peak_score = avg
            peak_hour = f"{h:02d}:00"

    # 2. Rating breakdown + vibe killers + week averages via single $facet
    ratings_pipeline = [
        {"$match": {"venue_id": venue_id, "timestamp": {"$gte": two_weeks_ago}}},
        {"$facet": {
            "this_week": [
                {"$match": {"timestamp": {"$gte": week_ago}}},
                {"$group": {
                    "_id": None,
                    "total": {"$sum": 1},
                    "avg_vibe": {"$avg": "$vibe_score"},
                    "chill": {"$sum": {"$cond": [{"$eq": ["$energy", "chill"]}, 1, 0]}},
                    "popping": {"$sum": {"$cond": [{"$eq": ["$energy", "popping"]}, 1, 0]}},
                    "electric": {"$sum": {"$cond": [{"$eq": ["$energy", "electric"]}, 1, 0]}},
                    "gate_blocked": {"$sum": {"$cond": [{"$eq": ["$gate", "blocked"]}, 1, 0]}},
                    "capacity_full": {"$sum": {"$cond": [{"$eq": ["$capacity", "full"]}, 1, 0]}},
                    "unique_scouts": {"$addToSet": "$user_id"},
                }},
            ],
            "prev_week": [
                {"$match": {"timestamp": {"$gte": two_weeks_ago, "$lt": week_ago}}},
                {"$group": {
                    "_id": None,
                    "avg_vibe": {"$avg": "$vibe_score"},
                }},
            ],
        }},
    ]

    ratings_result = await db.ratings.aggregate(ratings_pipeline).to_list(1)
    agg = ratings_result[0] if ratings_result else {"this_week": [], "prev_week": []}

    tw = agg["this_week"][0] if agg["this_week"] else {
        "total": 0, "avg_vibe": 0, "chill": 0, "popping": 0, "electric": 0,
        "gate_blocked": 0, "capacity_full": 0, "unique_scouts": [],
    }
    pw = agg["prev_week"][0] if agg["prev_week"] else {"avg_vibe": 0}

    total_ratings = tw["total"]
    rating_breakdown = {}
    for k in ("chill", "popping", "electric"):
        rating_breakdown[k] = round((tw[k] / total_ratings) * 100, 1) if total_ratings > 0 else 0

    # Vibe killers
    vibe_killers = []
    if total_ratings > 0:
        gate_ratio = tw["gate_blocked"] / total_ratings
        cap_ratio = tw["capacity_full"] / total_ratings
        if gate_ratio > 0.3:
            vibe_killers.append({
                "issue": "Gate frequently blocked",
                "percentage": round(gate_ratio * 100),
                "tip": "Consider optimizing entry flow during peak hours",
            })
        if cap_ratio > 0.4:
            vibe_killers.append({
                "issue": "Over capacity too often",
                "percentage": round(cap_ratio * 100),
                "tip": "Energy drops when people can't get in or move freely",
            })

    # Scout demographics via aggregation
    rater_ids = tw.get("unique_scouts", [])
    scout_breakdown = {"newbie": 0, "regular": 0, "scout": 0, "elite": 0}
    if rater_ids:
        scout_pipeline = [
            {"$match": {"id": {"$in": rater_ids}}},
            {"$group": {
                "_id": {"$ifNull": ["$scout_status", "newbie"]},
                "count": {"$sum": 1},
            }},
        ]
        scout_results = await db.users.aggregate(scout_pipeline).to_list(10)
        for sr in scout_results:
            status = sr["_id"]
            if status in scout_breakdown:
                scout_breakdown[status] = sr["count"]

    # Week-over-week trend
    this_week_avg = tw.get("avg_vibe") or 0
    prev_week_avg = pw.get("avg_vibe") or 0
    trend = round(this_week_avg - prev_week_avg, 1)

    # Direction conversion rate
    views = venue.get("profile_views", 0)
    clicks = venue.get("direction_clicks", 0)
    conversion_rate = round((clicks / views) * 100, 1) if views > 0 else 0

    return {
        "energy_curve": energy_curve,
        "rating_breakdown": rating_breakdown,
        "peak_hour": peak_hour,
        "peak_score": round(peak_score, 1),
        "vibe_killers": vibe_killers,
        "scout_breakdown": scout_breakdown,
        "total_unique_scouts": len(rater_ids),
        "week_over_week_trend": trend,
        "trend_direction": "improving" if trend > 0 else "declining" if trend < 0 else "stable",
        "conversion_rate": conversion_rate,
        "total_ratings_this_week": total_ratings,
    }


@router.get("/merchant/venue/{venue_id}/aura-shield")
async def get_aura_shield(venue_id: str, request: Request):
    """Get Aura Shield configuration."""
    user = await get_current_user(request)
    if not user or user.get("merchant_venue_id") != venue_id:
        raise HTTPException(status_code=403, detail="Not authorized for this venue")

    config = await db.aura_shields.find_one({"venue_id": venue_id}, {"_id": 0})
    if not config:
        return {"venue_id": venue_id, "enabled": False, "threshold": 50, "alert_on": ["score_drop"]}

    return config


@router.put("/merchant/venue/{venue_id}/aura-shield")
async def update_aura_shield(venue_id: str, body: AuraShieldUpdate, request: Request):
    """Update Aura Shield configuration."""
    user = await get_current_user(request)
    if not user or user.get("merchant_venue_id") != venue_id:
        raise HTTPException(status_code=403, detail="Not authorized for this venue")

    if body.threshold < 0 or body.threshold > 100:
        raise HTTPException(status_code=400, detail="Threshold must be 0-100")

    valid_alerts = {"score_drop", "gate_blocked", "capacity_full"}
    for alert_type in body.alert_on:
        if alert_type not in valid_alerts:
            raise HTTPException(status_code=400, detail=f"Invalid alert type: {alert_type}")

    await db.aura_shields.update_one(
        {"venue_id": venue_id},
        {"$set": {
            "venue_id": venue_id,
            "enabled": body.enabled,
            "threshold": body.threshold,
            "alert_on": body.alert_on,
        }},
        upsert=True,
    )

    return {"updated": True}
