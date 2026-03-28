"""
VIIBE Moment Route

A Moment is a timestamped emotional signal — a scout felt something and their
phone registered it. Moments are the highest-signal data points in the corpus:
human + sensor co-verified at the exact instant of feeling.

POST /api/venues/{venue_id}/moment
  — Records a single MomentTrigger from a scout.
  — Checks for multi-scout correlation: 5+ scouts in the same 8-second window
    triggers a Moment Lock, broadcast to the venue room via Socket.IO.

GET /api/venues/{venue_id}/moments/tonight
  — Returns tonight's moment timeline for a venue (used by Memory Artifact).
"""
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Literal, Optional

import asyncio
from app.config import db, sio, logger
from app.services.auth import require_auth
from app.services.notifications import notify_moment_locked

router = APIRouter(tags=["moments"])

# ─── Constants ────────────────────────────────────────────────────────────────

MOMENT_LOCK_THRESHOLD   = 5      # scouts required within correlation window
MOMENT_LOCK_WINDOW_S    = 8      # seconds — correlation window
MOMENT_LOCK_COOLDOWN_S  = 90     # seconds between Moment Locks at same venue
TONIGHT_WINDOW_HOURS    = 12     # "tonight" lookback window


# ─── Models ───────────────────────────────────────────────────────────────────

class SensorSnapshot(BaseModel):
    g_force:  float = Field(ge=0.0, le=20.0)
    accel_x:  float
    accel_y:  float
    accel_z:  float

class MomentPayload(BaseModel):
    gesture:          Literal['shake', 'raise_to_face', 'back_tap']
    timestamp:        int              # unix ms from client
    venue_id:         str
    sensor_snapshot:  SensorSnapshot


# ─── In-memory correlation window ─────────────────────────────────────────────
# Keyed by venue_id → list of (unix_ts_float, user_id)
# Resets on server restart — Moment Lock is a live ephemeral signal.

from collections import defaultdict
_venue_moments: dict = defaultdict(list)
_venue_lock_cooldown: dict = {}   # venue_id → datetime of last lock


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.post("/venues/{venue_id}/moment")
async def record_moment(
    venue_id: str,
    payload: MomentPayload,
    user: dict = Depends(require_auth),
):
    """
    Record a MomentTrigger from a scout. Check for multi-scout correlation.
    If 5+ unique scouts fire within the same 8-second window, emit moment_locked.
    """
    now  = datetime.now(timezone.utc)
    user_id = user["id"]

    # Validate venue
    venue = await db.venues.find_one({"id": venue_id})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    # Persist the moment signal
    doc = {
        "venue_id":        venue_id,
        "user_id":         user_id,
        "gesture":         payload.gesture,
        "client_ts":       payload.timestamp,
        "server_ts":       now,
        "g_force":         payload.sensor_snapshot.g_force,
        "accel_x":         payload.sensor_snapshot.accel_x,
        "accel_y":         payload.sensor_snapshot.accel_y,
        "accel_z":         payload.sensor_snapshot.accel_z,
        "moment_locked":   False,  # updated below if lock achieved
    }
    result = await db.moments.insert_one(doc)
    moment_id = str(result.inserted_id)

    # ── Correlation check ──────────────────────────────────────────────────────
    # Add this trigger to the in-memory window, prune old entries
    window_cutoff = now.timestamp() - MOMENT_LOCK_WINDOW_S
    _venue_moments[venue_id].append((now.timestamp(), user_id))
    _venue_moments[venue_id] = [
        (ts, uid) for ts, uid in _venue_moments[venue_id]
        if ts >= window_cutoff
    ]

    # Count unique scouts in the window
    unique_scouts = {uid for _, uid in _venue_moments[venue_id]}
    moment_locked = False

    if len(unique_scouts) >= MOMENT_LOCK_THRESHOLD:
        # Check cooldown — don't spam Moment Locks
        last_lock = _venue_lock_cooldown.get(venue_id)
        if not last_lock or (now - last_lock).total_seconds() >= MOMENT_LOCK_COOLDOWN_S:
            moment_locked = True
            _venue_lock_cooldown[venue_id] = now
            _venue_moments[venue_id] = []   # reset window after lock

            # Mark all moments in this window as locked
            await db.moments.update_many(
                {
                    "venue_id": venue_id,
                    "server_ts": {"$gte": now - timedelta(seconds=MOMENT_LOCK_WINDOW_S)},
                },
                {"$set": {"moment_locked": True}},
            )

            # Store a Moment Lock record for the Memory Artifact
            await db.moment_locks.insert_one({
                "venue_id":          venue_id,
                "locked_at":         now,
                "participant_count": len(unique_scouts),
                "participant_ids":   list(unique_scouts),
                "gesture_breakdown": _gesture_breakdown(_venue_moments[venue_id]),
                "venue_name":        venue.get("name", ""),
            })

            # Broadcast to venue Socket.IO room
            await sio.emit(
                "moment_locked",
                {
                    "venue_id":          venue_id,
                    "venue_name":        venue.get("name", ""),
                    "participant_count": len(unique_scouts),
                    "locked_at":         now.isoformat(),
                },
                room=f"venue_{venue_id}",
            )

            logger.info(
                f"MOMENT LOCKED — venue={venue_id} scouts={len(unique_scouts)}"
            )

            # Push to nearby users — fire-and-forget, non-blocking
            asyncio.create_task(
                notify_moment_locked(
                    venue_id=venue_id,
                    venue_name=venue.get("name", "a venue"),
                    participant_count=len(unique_scouts),
                )
            )

    return {
        "ok":           True,
        "moment_id":    moment_id,
        "moment_locked": moment_locked,
        "scouts_in_window": len(unique_scouts),
        "threshold":    MOMENT_LOCK_THRESHOLD,
    }


@router.get("/venues/{venue_id}/moments/tonight")
async def get_tonight_moments(
    venue_id: str,
    user: dict = Depends(require_auth),
):
    """
    Returns tonight's moment timeline for a venue.
    Used by the Memory Artifact to build the post-night shareable.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(hours=TONIGHT_WINDOW_HOURS)

    moments = await db.moments.find(
        {"venue_id": venue_id, "server_ts": {"$gte": cutoff}},
        {"user_id": 0, "accel_x": 0, "accel_y": 0, "accel_z": 0},  # strip PII
        sort=[("server_ts", 1)],
    ).to_list(500)

    locks = await db.moment_locks.find(
        {"venue_id": venue_id, "locked_at": {"$gte": cutoff}},
        sort=[("locked_at", 1)],
    ).to_list(50)

    return {
        "venue_id":     venue_id,
        "moment_count": len(moments),
        "lock_count":   len(locks),
        "moments":      [_serialize(m) for m in moments],
        "locks":        [_serialize(l) for l in locks],
    }


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _gesture_breakdown(window: list) -> dict:
    counts: dict = {"shake": 0, "raise_to_face": 0, "back_tap": 0}
    return counts  # breakdown tracked per-moment in DB, aggregate later


def _serialize(doc: dict) -> dict:
    doc["_id"] = str(doc["_id"]) if "_id" in doc else None
    for k in ("server_ts", "locked_at", "client_ts"):
        if k in doc and hasattr(doc[k], "isoformat"):
            doc[k] = doc[k].isoformat()
    return doc
