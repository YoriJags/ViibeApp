"""
Vibe App - Trending & Leaderboard Routes
Trending venues, top scouts, scout profiles, and leaderboard rankings.
Optimized with MongoDB aggregation pipelines to avoid N+1 queries.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException

from app.config import db, PULSE_DROP_TIERS

router = APIRouter(tags=["leaderboard"])


def _get_tier(total_ratings: int):
    """Get scout tier from total ratings."""
    if total_ratings >= 50:
        return "elite", "#FF3366"
    elif total_ratings >= 25:
        return "scout", "#FFD700"
    elif total_ratings >= 10:
        return "regular", "#00D4FF"
    return "newbie", "#666666"


@router.get("/trending/{city}")
async def get_trending_venues(city: str, limit: int = 10):
    """
    Get trending venues with dynamic scoring formula.
    Uses a single $facet aggregation instead of 3 queries per venue.
    """
    now = datetime.now(timezone.utc)
    hour_ago = now - timedelta(hours=1)
    day_ago = now - timedelta(hours=24)
    six_hours_ago = now - timedelta(hours=6)

    venues = await db.venues.find(
        {"city": city.lower()},
        {"_id": 0},
    ).to_list(100)

    if not venues:
        return {
            "city": city, "venues": [], "sponsored": [],
            "last_updated": now.isoformat(), "total_venues": 0,
        }

    venue_ids = [v["id"] for v in venues]

    # Single aggregation: get recent (1h), scouts (24h), and old (6h-1h) per venue
    pipeline = [
        {"$match": {
            "venue_id": {"$in": venue_ids},
            "timestamp": {"$gte": day_ago},
        }},
        {"$facet": {
            "recent": [
                {"$match": {"timestamp": {"$gte": hour_ago}}},
                {"$group": {"_id": "$venue_id", "count": {"$sum": 1}}},
            ],
            "scouts": [
                {"$group": {
                    "_id": "$venue_id",
                    "unique_users": {"$addToSet": "$user_id"},
                    "last_rating": {"$max": "$timestamp"},
                }},
            ],
            "old": [
                {"$match": {"timestamp": {"$gte": six_hours_ago, "$lt": hour_ago}}},
                {"$group": {"_id": "$venue_id", "count": {"$sum": 1}}},
            ],
        }},
    ]

    result = await db.ratings.aggregate(pipeline).to_list(1)
    agg = result[0] if result else {"recent": [], "scouts": [], "old": []}

    recent_map = {r["_id"]: r["count"] for r in agg["recent"]}
    scout_map = {
        s["_id"]: {"count": len(s["unique_users"]), "last_rating": s["last_rating"]}
        for s in agg["scouts"]
    }
    old_map = {o["_id"]: o["count"] for o in agg["old"]}

    trending_data = []
    for venue in venues:
        venue_id = venue["id"]

        # Check pulse boost
        is_pulse_boosted = False
        if venue.get("active_pulse_tier") and venue.get("pulse_expires_at"):
            try:
                pulse_expires_raw = venue.get("pulse_expires_at")
                if isinstance(pulse_expires_raw, datetime):
                    pulse_expires = pulse_expires_raw.replace(tzinfo=timezone.utc) if pulse_expires_raw.tzinfo is None else pulse_expires_raw
                else:
                    pulse_expires = datetime.fromisoformat(str(pulse_expires_raw).replace("Z", "+00:00"))
                is_pulse_boosted = pulse_expires > now
            except Exception:
                pass

        recent_count = recent_map.get(venue_id, 0)
        scout_data = scout_map.get(venue_id, {"count": 0, "last_rating": None})
        unique_scouts = scout_data["count"]
        old_count = old_map.get(venue_id, 0)

        avg_energy = venue.get("current_vibe_score", 0)
        check_in_velocity = recent_count * 10
        scout_count_weighted = unique_scouts * 5

        trending_score = (avg_energy * 0.5) + (check_in_velocity * 0.3) + (scout_count_weighted * 0.2)

        if recent_count > old_count:
            trend = "up"
        elif recent_count < old_count:
            trend = "down"
        else:
            trend = "stable"

        trending_data.append({
            "venue": venue,
            "trending_score": round(trending_score, 1),
            "energy_percent": min(100, round(avg_energy)),
            "check_in_velocity": recent_count,
            "scout_count": unique_scouts,
            "trend": trend,
            "last_rating": scout_data["last_rating"].isoformat() if scout_data["last_rating"] else None,
            "is_sponsored": is_pulse_boosted,
            "is_pulse_boosted": is_pulse_boosted,
            "clout_multiplier": 2 if is_pulse_boosted else 1,
        })

    # Separate sponsored from organic
    sponsored_venues = [v for v in trending_data if v.get("is_sponsored")]
    organic_venues = [v for v in trending_data if not v.get("is_sponsored")]

    organic_venues.sort(key=lambda x: x["trending_score"], reverse=True)
    sponsored_venues.sort(key=lambda x: x["trending_score"], reverse=True)

    for i, item in enumerate(organic_venues[:limit]):
        item["rank"] = i + 1
    for i, item in enumerate(sponsored_venues):
        item["rank"] = i + 1

    return {
        "city": city,
        "venues": organic_venues[:limit],
        "sponsored": sponsored_venues,
        "last_updated": now.isoformat(),
        "total_venues": len(venues),
    }


@router.get("/top-scouts/{city}")
async def get_top_scouts(city: str, limit: int = 5):
    """
    Get top scouts. Uses $lookup to join users instead of N+1 queries.
    """
    now = datetime.now(timezone.utc)
    day_ago = now - timedelta(hours=24)

    pipeline = [
        {"$match": {"timestamp": {"$gte": day_ago}, "superseded": {"$ne": True}}},
        {"$lookup": {"from": "venues", "localField": "venue_id", "foreignField": "id", "as": "venue_info"}},
        {"$match": {"venue_info.city": city.lower()}},
        {"$group": {
            "_id": "$user_id",
            "check_count": {"$sum": 1},
            "total_vibe_score": {"$sum": "$vibe_score"},
            "venues_rated": {"$addToSet": "$venue_id"},
            "last_check": {"$max": "$timestamp"},
        }},
        {"$sort": {"check_count": -1}},
        {"$limit": limit},
        # Join users collection to get profile data
        {"$lookup": {
            "from": "users",
            "localField": "_id",
            "foreignField": "id",
            "as": "user_info",
        }},
        {"$unwind": {"path": "$user_info", "preserveNullAndEmptyArrays": False}},
    ]

    scout_stats = await db.ratings.aggregate(pipeline).to_list(limit)

    top_scouts = []
    for i, scout in enumerate(scout_stats):
        user = scout["user_info"]
        total_ratings = user.get("total_ratings", 0)
        tier, ring_color = _get_tier(total_ratings)

        top_scouts.append({
            "rank": i + 1,
            "user_id": scout["_id"],
            "username": user.get("username", "Anonymous"),
            "avatar": user.get("picture"),
            "check_count": scout["check_count"],
            "venues_visited": len(scout["venues_rated"]),
            "avg_vibe_contribution": round(scout["total_vibe_score"] / scout["check_count"], 1) if scout["check_count"] > 0 else 0,
            "last_check": scout["last_check"].isoformat() if scout["last_check"] else None,
            "tier": tier,
            "ring_color": ring_color,
            "is_elite": tier == "elite",
            "clout_points": user.get("clout_points", 0),
            "accuracy_score": user.get("rating_accuracy_score", 0),
        })

    return {
        "city": city,
        "scouts": top_scouts,
        "last_updated": now.isoformat(),
        "time_window": "24h",
    }


@router.get("/scout/{user_id}/profile")
async def get_scout_profile(user_id: str):
    """
    Get scout mini-profile. Uses $lookup for venues instead of N+1 queries.
    """
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Scout not found")

    now = datetime.now(timezone.utc)
    day_ago = now - timedelta(hours=24)
    week_ago = now - timedelta(days=7)

    # Single aggregation: get recent ratings with venue data joined
    pipeline = [
        {"$match": {"user_id": user_id, "timestamp": {"$gte": day_ago}}},
        {"$sort": {"timestamp": -1}},
        {"$limit": 20},
        {"$lookup": {
            "from": "venues",
            "localField": "venue_id",
            "foreignField": "id",
            "as": "venue_info",
        }},
        {"$unwind": {"path": "$venue_info", "preserveNullAndEmptyArrays": True}},
    ]

    recent_with_venues = await db.ratings.aggregate(pipeline).to_list(20)

    activity_heatmap = []
    for rating in recent_with_venues:
        venue = rating.get("venue_info")
        if not venue:
            continue

        rating_timestamp = rating["timestamp"]
        if rating_timestamp.tzinfo is None:
            rating_timestamp = rating_timestamp.replace(tzinfo=timezone.utc)

        time_diff = now - rating_timestamp
        mins_ago = int(time_diff.total_seconds() / 60)

        if mins_ago < 60:
            time_str = f"{mins_ago} min{'s' if mins_ago != 1 else ''} ago"
        else:
            hours_ago = mins_ago // 60
            time_str = f"{hours_ago} hour{'s' if hours_ago != 1 else ''} ago"

        activity_heatmap.append({
            "venue_id": venue["id"],
            "venue_name": venue["name"],
            "venue_area": venue.get("area", ""),
            "vibe_score": rating.get("vibe_score", 0),
            "energy": rating.get("energy", "chill"),
            "timestamp": rating["timestamp"].isoformat(),
            "time_ago": time_str,
        })

    # Week stats - two lightweight queries
    week_ratings = await db.ratings.count_documents({
        "user_id": user_id,
        "timestamp": {"$gte": week_ago},
    })

    unique_venues_week = await db.ratings.distinct("venue_id", {
        "user_id": user_id,
        "timestamp": {"$gte": week_ago},
    })

    total_ratings = user.get("total_ratings", 0)
    tier, tier_color = _get_tier(total_ratings)

    return {
        "user": {
            "id": user["id"],
            "username": user.get("username", "Anonymous"),
            "avatar": user.get("picture"),
            "clout_points": user.get("clout_points", 0),
            "scout_status": user.get("scout_status", "newbie"),
            "rating_accuracy_score": user.get("rating_accuracy_score", 0),
            "total_ratings": total_ratings,
            "tier": tier,
            "tier_color": tier_color,
        },
        "activity_heatmap": activity_heatmap,
        "stats": {
            "checks_24h": len(recent_with_venues),
            "checks_7d": week_ratings,
            "unique_venues_7d": len(unique_venues_week),
        },
        "last_seen": activity_heatmap[0] if activity_heatmap else None,
    }


@router.get("/leaderboard")
async def get_leaderboard(city: Optional[str] = None, limit: int = 20):
    """Get venue leaderboard with Pulse Drop placements."""
    query = {"is_suppressed": {"$ne": True}}
    if city:
        query["city"] = city

    now = datetime.now(timezone.utc)
    venues = await db.venues.find(query, {"_id": 0}).to_list(100)

    def sort_key(v):
        if v.get("pulse_expires_at"):
            expires = v.get("pulse_expires_at")
            if isinstance(expires, str):
                expires = datetime.fromisoformat(expires.replace("Z", "+00:00"))
            if expires.tzinfo is None:
                expires = expires.replace(tzinfo=timezone.utc)

            if expires > now and v.get("active_pulse_tier"):
                tier_config = PULSE_DROP_TIERS.get(v.get("active_pulse_tier"), {})
                placement = tier_config.get("chart_placement")
                if placement:
                    return (-1000 + placement, -v.get("current_vibe_score", 0))

        return (0, -v.get("current_vibe_score", 0))

    venues.sort(key=sort_key)
    venues = venues[:limit]

    leaderboard = []
    for i, v in enumerate(venues):
        leaderboard.append({
            "venue": v,
            "rank": i + 1,
            "trend": "up" if v.get("vibe_velocity") == "heating_up" else
                    "down" if v.get("vibe_velocity") == "cooling_down" else "stable",
            "has_pulse_boost": bool(v.get("active_pulse_tier")),
        })

    return leaderboard


@router.get("/leaderboard/national")
async def get_national_leaderboard(limit: int = 20):
    """Get national leaderboard across all cities."""
    venues = await db.venues.find(
        {"is_suppressed": {"$ne": True}}, {"_id": 0}
    ).sort("current_vibe_score", -1).limit(limit).to_list(limit)

    leaderboard = []
    for i, v in enumerate(venues):
        leaderboard.append({
            "venue": v,
            "rank": i + 1,
            "trend": v.get("vibe_velocity", "stable"),
            "city": v.get("city", "lagos"),
        })

    return leaderboard
