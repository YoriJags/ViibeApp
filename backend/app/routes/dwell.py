"""
Dwell time tracking — measures how long scouts stay inside a venue.

A scout's dwell session is kept alive by periodic pings from the frontend
while they remain within the geofence. The backend computes duration from
the first to the last ping of each session (1 session = same user + venue
within a 6-hour window).
"""
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from app.config import db
from app.services.auth import require_auth
from app.services.decay_ingest import ingest_dwell

router = APIRouter(tags=["dwell"])

SESSION_WINDOW_HOURS = 6   # gap longer than this = new session
LONG_DWELL_MINUTES   = 30  # threshold for "stayed a while"


class DwellPing(BaseModel):
    venue_id: str


@router.post("/dwell/ping")
async def dwell_ping(data: DwellPing, user: dict = Depends(require_auth)):
    """
    Called every 5 minutes by the frontend while a scout is inside a venue.
    Creates or extends the current dwell session for this user + venue.
    """
    user_id  = user["id"]
    now      = datetime.now(timezone.utc)
    window   = now - timedelta(hours=SESSION_WINDOW_HOURS)

    # Find active session for this user at this venue
    session = await db.dwell_sessions.find_one({
        "user_id":   user_id,
        "venue_id":  data.venue_id,
        "last_ping": {"$gte": window},
    })

    # Phase 2 — presence heartbeat into the Energy Decay Engine (L2 layer).
    ingest_dwell(venue_id=data.venue_id, scout_id=user_id)

    if session:
        duration_minutes = round((now - session["entered_at"]).total_seconds() / 60)
        await db.dwell_sessions.update_one(
            {"_id": session["_id"]},
            {"$set": {
                "last_ping":        now,
                "duration_minutes": duration_minutes,
            }},
        )
    else:
        # New session
        await db.dwell_sessions.insert_one({
            "user_id":          user_id,
            "venue_id":         data.venue_id,
            "entered_at":       now,
            "last_ping":        now,
            "duration_minutes": 0,
        })

    return {"ok": True}
