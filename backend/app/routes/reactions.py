"""
Vibe App - Reaction Routes
Live bolt reactions. Measures real-time energy intensity via tap rate.
Free for all scouts — tap rate is the core data signal.
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


@router.post("/venues/{venue_id}/react")
async def react_to_venue(venue_id: str, user: dict = Depends(require_auth)):
    """
    Record a live bolt reaction. JWT-authenticated.
    Tap rate over the last 5 min is the energy signal.
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

    # Store reaction
    await db.reactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "venue_id": venue_id,
        "timestamp": now,
    })

    # Calculate reaction rate: total taps across all users in last 5 min
    window_start = now - timedelta(minutes=RATE_WINDOW_MINUTES)
    total_reactions = await db.reactions.count_documents({
        "venue_id": venue_id,
        "timestamp": {"$gte": window_start},
    })
    reactions_per_min = round(total_reactions / RATE_WINDOW_MINUTES, 1)

    # Count distinct active scouts reacting
    pipeline = [
        {"$match": {"venue_id": venue_id, "timestamp": {"$gte": window_start}}},
        {"$group": {"_id": "$user_id"}},
        {"$count": "total"},
    ]
    scout_result = await db.reactions.aggregate(pipeline).to_list(1)
    active_scouts = scout_result[0]["total"] if scout_result else 1

    # Broadcast to all clients watching this venue
    await broadcast_reaction(venue_id, {
        "venue_id": venue_id,
        "reactions_per_min": reactions_per_min,
        "active_scouts": active_scouts,
        "reactor_id": user_id,
    })
    await broadcast_city_pulse(venue.get("city", "lagos"))

    return {
        "ok": True,
        "reactions_per_min": reactions_per_min,
        "active_scouts": active_scouts,
    }


@router.get("/venues/{venue_id}/reactions/rate")
async def get_reaction_rate(venue_id: str):
    """Get current reaction rate for a venue (public, for display)."""
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(minutes=RATE_WINDOW_MINUTES)

    total_reactions = await db.reactions.count_documents({
        "venue_id": venue_id,
        "timestamp": {"$gte": window_start},
    })
    reactions_per_min = round(total_reactions / RATE_WINDOW_MINUTES, 1)

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
