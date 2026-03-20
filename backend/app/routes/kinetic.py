"""
VIIBE Kinetic Sensor API

Receives passive movement BPM readings from scouts inside a geofence.
No tap required — accelerometer-derived crowd movement signal.

POST /api/kinetic/ping — scout submits movement_bpm + movement_energy
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

from app.config import db, logger
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/kinetic", tags=["Kinetic"])


class KineticPing(BaseModel):
    venue_id:        str
    movement_bpm:    int   = Field(ge=0, le=300)
    movement_energy: float = Field(ge=0.0, le=100.0)


@router.post("/ping")
async def kinetic_ping(
    payload: KineticPing,
    user: dict = Depends(get_current_user),
):
    """
    Store a kinetic movement reading from a scout.

    movement_bpm    = 0 means not enough peaks detected (scout is still)
    movement_energy = 0–100 magnitude of physical movement intensity
    """
    now = datetime.now(timezone.utc)

    # Validate venue exists
    venue = await db.venues.find_one({"_id": payload.venue_id})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    doc = {
        "venue_id":        payload.venue_id,
        "user_id":         user["id"],
        "movement_bpm":    payload.movement_bpm,
        "movement_energy": payload.movement_energy,
        "is_dancing":      80 <= payload.movement_bpm <= 180 and payload.movement_energy > 30,
        "timestamp":       now,
    }

    await db.kinetic_readings.insert_one(doc)

    # Lightweight aggregate: % of recent scouts dancing at this venue
    window = now.replace(second=0, microsecond=0)
    from datetime import timedelta
    window_start = now - timedelta(minutes=5)

    recent = await db.kinetic_readings.find({
        "venue_id":  payload.venue_id,
        "timestamp": {"$gte": window_start},
    }).to_list(200)

    total_recent   = len(recent)
    dancing_recent = sum(1 for r in recent if r.get("is_dancing"))
    dance_pct      = round(dancing_recent / total_recent * 100) if total_recent > 0 else 0

    # Update venue kinetic summary (lightweight, no full score recalc)
    await db.venues.update_one(
        {"_id": payload.venue_id},
        {"$set": {
            "kinetic.dance_pct":     dance_pct,
            "kinetic.avg_bpm":       payload.movement_bpm,
            "kinetic.last_updated":  now,
        }},
    )

    return {
        "ok":         True,
        "dance_pct":  dance_pct,
        "venue_peak": dance_pct >= 40,  # True when 40%+ scouts are dancing
    }
