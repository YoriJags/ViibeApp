"""
Quick pulse: one tap from someone standing at a venue ("No Dulling").

  POST /pulse  {venue_id, lat, lng}

This route existed only in the old serverless handler (api/index.py) and was
never brought across, so every tap returned 404 and was silently lost.

Rules:
  - The person is the signed-in session, never a user_id in the body.
  - The position must be inside the venue's geofence. No position, no pulse:
    a missing location is not a reason to assume someone is there.
  - One pulse per person per venue per 15 minutes.
A pulse counts toward "readings tonight" on City Energy. It is not an energy
reading and does not move a venue's score.
"""
import math
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.config import db
from app.services.auth import require_auth
from app.services.vibe import calculate_distance

router = APIRouter(tags=["quick-pulse"])

QUICK_PULSE_CLOUT = 3
QUICK_PULSE_COOLDOWN = timedelta(minutes=15)
EVENT_TYPES = {"event", "festival", "concert", "block_party", "rave"}
DEFAULT_RADIUS_M = 100


def _radius_for(venue: dict) -> float:
    radius = float(venue.get("geofence_radius_m") or DEFAULT_RADIUS_M)
    # Open grounds are wide; a pin sits in the middle of them.
    if venue.get("venue_type") in EVENT_TYPES and venue.get("kind") != "event":
        radius = max(radius, 500)
    return radius


@router.post("/pulse")
async def quick_pulse(payload: dict, user: dict = Depends(require_auth)):
    venue_id = payload.get("venue_id")
    try:
        lat, lng = float(payload["lat"]), float(payload["lng"])
    except (KeyError, TypeError, ValueError):
        raise HTTPException(status_code=422, detail="Your location is needed to pulse a venue")
    if not (math.isfinite(lat) and math.isfinite(lng) and -90 <= lat <= 90 and -180 <= lng <= 180):
        raise HTTPException(status_code=422, detail="Your location is needed to pulse a venue")

    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    radius = _radius_for(venue)
    c = venue.get("coordinates") or {}
    if c.get("lat") is None or c.get("lng") is None:
        raise HTTPException(status_code=409, detail="This venue has no location set")
    # Written as "not within" so a NaN distance can never count as inside.
    if not (calculate_distance(lat, lng, c["lat"], c["lng"]) <= radius):
        raise HTTPException(status_code=400, detail=f"You need to be within {int(radius)} m of the venue")

    now = datetime.now(timezone.utc)
    recent = await db.quick_pulses.find_one(
        {"user_id": user["id"], "venue_id": venue_id, "timestamp": {"$gte": now - QUICK_PULSE_COOLDOWN}},
        {"_id": 0, "timestamp": 1},
    )
    if recent:
        last = recent["timestamp"]
        if last.tzinfo is None:
            last = last.replace(tzinfo=timezone.utc)
        remaining = int((QUICK_PULSE_COOLDOWN - (now - last)).total_seconds())
        raise HTTPException(status_code=429, detail={"message": "Pulse cooldown active",
                                                     "cooldown_remaining_seconds": max(remaining, 0)})

    await db.quick_pulses.insert_one({
        "id": str(uuid.uuid4()), "user_id": user["id"], "venue_id": venue_id,
        "city": venue.get("city", "lagos"), "timestamp": now,
    })
    await db.users.update_one({"id": user["id"]}, {"$inc": {"clout_points": QUICK_PULSE_CLOUT}})
    return {"success": True, "clout_earned": QUICK_PULSE_CLOUT, "venue_id": venue_id}
