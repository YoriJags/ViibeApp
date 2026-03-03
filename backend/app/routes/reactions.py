"""
Vibe App - Reaction Routes
Live bolt reactions. Measures real-time energy intensity via tap rate.
Burst multiplier: rapid consecutive taps from the same scout count more.
"""
import uuid
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Depends

from app.config import db
from app.services.auth import require_auth
from app.services.realtime import broadcast_reaction, broadcast_city_pulse

router = APIRouter(tags=["reactions"])

# Per-user rate cap: max 60 taps per minute per venue
USER_REACTION_CAP = 60
# Rolling window for rate calculation (minutes)
RATE_WINDOW_MINUTES = 5


async def compute_burst(user_id: str, venue_id: str) -> dict:
    """
    Analyse the last 4 taps from this user at this venue to detect
    burst patterns and return a multiplier + rhythm classification.

    Multipliers:
      frenzy   — 3+ taps all <600ms apart  → 2.0x
      frantic  — 2+ taps all <800ms apart  → 1.5x
      rhythmic — 2+ taps all 300–700ms     → 1.3x  (beat-matching)
      casual   — baseline                  → 1.0x
    """
    recent = await db.reactions.find(
        {"user_id": user_id, "venue_id": venue_id},
        sort=[("timestamp", -1)],
        limit=4,
    ).to_list(4)

    if len(recent) < 2:
        return {"multiplier": 1.0, "rhythm": "casual", "tap_count": 1}

    intervals = [
        (recent[i]["timestamp"] - recent[i + 1]["timestamp"]).total_seconds() * 1000
        for i in range(min(len(recent) - 1, 3))
    ]

    if len(intervals) >= 3 and all(iv < 600 for iv in intervals):
        return {"multiplier": 2.0, "rhythm": "frenzy", "tap_count": len(recent)}
    elif len(intervals) >= 2 and all(iv < 800 for iv in intervals[:2]):
        return {"multiplier": 1.5, "rhythm": "frantic", "tap_count": len(recent)}
    elif len(intervals) >= 2 and all(300 <= iv <= 700 for iv in intervals[:2]):
        return {"multiplier": 1.3, "rhythm": "rhythmic", "tap_count": len(recent)}
    return {"multiplier": 1.0, "rhythm": "casual", "tap_count": 1}


async def _weighted_rpm(venue_id: str, window_start: datetime) -> float:
    """Sum reaction weights in the window and divide by window size (minutes)."""
    pipeline = [
        {"$match": {"venue_id": venue_id, "timestamp": {"$gte": window_start}}},
        {"$group": {"_id": None, "total_weight": {"$sum": {"$ifNull": ["$weight", 1.0]}}}},
    ]
    result = await db.reactions.aggregate(pipeline).to_list(1)
    weighted_total = result[0]["total_weight"] if result else 0
    return round(weighted_total / RATE_WINDOW_MINUTES, 1)


@router.post("/venues/{venue_id}/react")
async def react_to_venue(venue_id: str, user: dict = Depends(require_auth)):
    """
    Record a live bolt reaction. JWT-authenticated.
    Burst taps are weighted higher — frantic/rhythmic tapping counts more.
    """
    user_id = user["id"]
    now = datetime.now(timezone.utc)

    # Venue must exist
    venue = await db.venues.find_one({"id": venue_id})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    # Per-user rate limit: max 60 taps/min per venue
    minute_ago = now - timedelta(minutes=1)
    user_recent = await db.reactions.count_documents({
        "user_id": user_id,
        "venue_id": venue_id,
        "timestamp": {"$gte": minute_ago},
    })
    if user_recent >= USER_REACTION_CAP:
        raise HTTPException(status_code=429, detail="Slow down — reaction cap reached")

    # Detect burst BEFORE inserting (reads previous taps only)
    burst = await compute_burst(user_id, venue_id)

    # Store reaction with weight
    await db.reactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "venue_id": venue_id,
        "timestamp": now,
        "weight": burst["multiplier"],
    })

    # Weighted reaction rate: burst taps count more
    window_start = now - timedelta(minutes=RATE_WINDOW_MINUTES)
    reactions_per_min = await _weighted_rpm(venue_id, window_start)

    # Count distinct active scouts reacting
    scout_pipeline = [
        {"$match": {"venue_id": venue_id, "timestamp": {"$gte": window_start}}},
        {"$group": {"_id": "$user_id"}},
        {"$count": "total"},
    ]
    scout_result = await db.reactions.aggregate(scout_pipeline).to_list(1)
    active_scouts = scout_result[0]["total"] if scout_result else 1

    # Broadcast to all clients watching this venue
    await broadcast_reaction(venue_id, {
        "venue_id": venue_id,
        "reactions_per_min": reactions_per_min,
        "active_scouts": active_scouts,
        "reactor_id": user_id,
        "burst": burst,
    })
    await broadcast_city_pulse(venue.get("city", "lagos"))

    return {
        "ok": True,
        "reactions_per_min": reactions_per_min,
        "active_scouts": active_scouts,
        "burst": burst,
    }


@router.get("/venues/{venue_id}/reactions/rate")
async def get_reaction_rate(venue_id: str):
    """Get current weighted reaction rate for a venue (public, for display)."""
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(minutes=RATE_WINDOW_MINUTES)

    reactions_per_min = await _weighted_rpm(venue_id, window_start)

    pipeline = [
        {"$match": {"venue_id": venue_id, "timestamp": {"$gte": window_start}}},
        {"$group": {"_id": "$user_id"}},
        {"$count": "total"},
    ]
    scout_result = await db.reactions.aggregate(pipeline).to_list(1)
    active_scouts = scout_result[0]["total"] if scout_result else 0

    return {
        "reactions_per_min": reactions_per_min,
        "active_scouts": active_scouts,
    }
