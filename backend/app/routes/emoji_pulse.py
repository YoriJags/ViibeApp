"""
Emoji Pulse — frictionless micro-signal reactions on venues.

Scouts tap one of 5 emojis on a venue card. Counts aggregate over a
rolling 30-minute window and decay naturally via TTL index.

Emojis: fire / music / sleep / dead / bottle
Cooldown: 1 reaction per scout per venue per hour (upsert replaces previous).
"""
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Request

from app.config import db, logger
from app.services.auth import get_current_user

router = APIRouter(tags=["emoji-pulse"])

VALID_EMOJIS = {"fire", "music", "sleep", "dead", "bottle"}


@router.post("/venues/{venue_id}/emoji-pulse")
async def post_emoji_pulse(venue_id: str, request: Request):
    """
    Record a scout's emoji reaction on a venue.
    Body: { "emoji": "fire" | "music" | "sleep" | "dead" | "bottle" }
    One reaction per scout per venue (upsert replaces previous emoji).
    Document expires after 2 hours via TTL index on `expires_at`.
    """
    user = await get_current_user(request)
    if not user:
        return {"ok": False, "detail": "Not authenticated"}

    try:
        body = await request.json()
    except Exception:
        body = {}

    emoji = body.get("emoji", "")
    if emoji not in VALID_EMOJIS:
        return {"ok": False, "detail": "Invalid emoji"}

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(hours=2)

    await db.venue_emoji_pulses.update_one(
        {"venue_id": venue_id, "user_id": user["id"]},
        {"$set": {
            "venue_id":   venue_id,
            "user_id":    user["id"],
            "emoji":      emoji,
            "ts":         now,
            "expires_at": expires_at,
        }},
        upsert=True,
    )

    return {"ok": True, "emoji": emoji}


@router.get("/venues/{venue_id}/emoji-pulse")
async def get_emoji_pulse(venue_id: str):
    """
    Return aggregated emoji counts for a venue over the last 30 minutes.
    No auth required.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=30)

    pipeline = [
        {"$match": {"venue_id": venue_id, "ts": {"$gte": cutoff}}},
        {"$group": {"_id": "$emoji", "count": {"$sum": 1}}},
    ]
    results = await db.venue_emoji_pulses.aggregate(pipeline).to_list(10)

    counts = {e: 0 for e in VALID_EMOJIS}
    for row in results:
        if row["_id"] in counts:
            counts[row["_id"]] = row["count"]

    total = sum(counts.values())
    return {"counts": counts, "total": total, "window_minutes": 30}
