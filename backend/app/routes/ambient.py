"""
Ambient sound level tracking — scouts contribute dB readings from inside venues.

No audio is ever stored. Only the numeric dB level is received and averaged.
Used as a supporting signal in the vibe score — not the primary driver.
"""
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.config import db
from app.services.auth import require_auth

router = APIRouter(tags=["ambient"])

WINDOW_MINUTES = 30  # rolling window for averaging


class AmbientPing(BaseModel):
    venue_id: str
    db_level: float = Field(..., ge=-160, le=0)  # dB is negative (0 = loudest)


@router.post("/ambient/ping")
async def ambient_ping(data: AmbientPing, user: dict = Depends(require_auth)):
    """
    Receives a single dB reading from a scout inside a venue.
    Stored as a lightweight reading — no audio, no recording.
    """
    await db.ambient_readings.insert_one({
        "venue_id":  data.venue_id,
        "user_id":   user["id"],
        "db_level":  data.db_level,
        "timestamp": datetime.now(timezone.utc),
    })
    return {"ok": True}


async def get_ambient_signal(venue_id: str, now: datetime) -> dict:
    """
    Returns averaged dB level and scout count for a venue over the last 30 min.
    Called by calculate_venue_aggregate.
    """
    window = now - timedelta(minutes=WINDOW_MINUTES)
    readings = await db.ambient_readings.find({
        "venue_id":  venue_id,
        "timestamp": {"$gte": window},
    }).to_list(500)

    if not readings:
        return {"ambient_db_avg": None, "ambient_scout_count": 0}

    avg_db = round(sum(r["db_level"] for r in readings) / len(readings), 1)
    scout_count = len({r["user_id"] for r in readings})
    return {"ambient_db_avg": avg_db, "ambient_scout_count": scout_count}
