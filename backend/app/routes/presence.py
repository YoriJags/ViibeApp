"""
Auto presence routes: the phone tells us when a scout walks in and out.

Called from the app's background geofence task, with the app closed. Every
event is logged durably in `presence_events`, which is what arrivals and
departures per venue will be computed from, because check-in documents
themselves expire and are deleted by the TTL index.

See app/services/presence.py for the rules.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.config import db, logger
from app.services.auth import require_auth
from app.services.presence import (
    AUTO_TTL_HOURS,
    classify_visit,
    decide_enter,
    check_position,
    new_auto_checkin,
    present_filter,
)
from app.services.realtime import emit_checkin_update
from app.services.vibe import calculate_distance

router = APIRouter(tags=["presence"])


class PresenceEvent(BaseModel):
    venue_id: str
    lat: Optional[float] = None
    lng: Optional[float] = None


async def _log(user_id: str, venue_id: str, kind: str, extra: dict | None = None) -> None:
    """Durable event log. Best effort: losing a log line must never fail the request."""
    try:
        await db.presence_events.insert_one({
            "user_id": user_id,
            "venue_id": venue_id,
            "kind": kind,
            "at": datetime.now(timezone.utc),
            **(extra or {}),
        })
    except Exception as e:
        logger.warning(f"presence log failed: {e}")


async def _broadcast_count(venue_id: str) -> int:
    count = await db.checkins.count_documents(present_filter(venue_id))
    try:
        await emit_checkin_update(venue_id, count)
    except Exception:
        pass
    return count


async def _close(checkin: dict, now: datetime, status: str = "left") -> dict:
    """Close a visit and record how long it lasted."""
    visit = classify_visit(checkin["created_at"], now)
    await db.checkins.update_one(
        {"_id": checkin["_id"]},
        {"$set": {"status": status, "left_at": now, **visit}},
    )
    return visit


@router.post("/presence/enter")
async def presence_enter(event: PresenceEvent, user: dict = Depends(require_auth)):
    """The operating system says this scout just walked into a venue."""
    venue = await db.venues.find_one({"id": event.venue_id})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    distance = None
    if event.lat is not None and event.lng is not None and venue.get("coordinates"):
        vc = venue["coordinates"]
        distance = calculate_distance(event.lat, event.lng, vc["lat"], vc["lng"])
    position = check_position(distance, venue.get("geofence_radius_m"))
    if position == "far":
        await _log(user["id"], event.venue_id, "enter_refused", {"distance_m": distance})
        raise HTTPException(status_code=403, detail="Position does not match this venue.")
    # "missing" is accepted and logged, but the visit is unverified and is never
    # counted as presence. See check_position for why this fails closed.
    verified = position == "verified"

    now = datetime.now(timezone.utc)
    active = await db.checkins.find_one({"user_id": user["id"], "status": "active"})
    last_left = await db.checkins.find_one(
        {"user_id": user["id"], "status": "left"},
        sort=[("left_at", -1)],
    )
    action = decide_enter(active, event.venue_id, last_left, now)
    await _log(user["id"], event.venue_id, "enter", {
        "action": action, "distance_m": distance, "verified": verified,
    })

    if action in ("noop", "keep_manual"):
        return {"action": action}

    if action == "switch":
        await _close(active, now)
        await _broadcast_count(active["venue_id"])

    if action == "resume":
        # A resumed visit keeps its verification unless this event earns it.
        resume_set = {"status": "active", "expires_at": now + timedelta(hours=AUTO_TTL_HOURS)}
        if verified:
            resume_set["verified"] = True
        await db.checkins.update_one(
            {"_id": last_left["_id"]},
            {"$set": resume_set,
             "$unset": {"left_at": "", "dwell_minutes": "", "pass_through": ""}},
        )
    else:
        await db.checkins.insert_one(new_auto_checkin(user, venue, now, verified=verified))

    count = await _broadcast_count(event.venue_id)
    return {"action": action, "present_now": count}


@router.post("/presence/exit")
async def presence_exit(event: PresenceEvent, user: dict = Depends(require_auth)):
    """
    The operating system says this scout just walked out.

    Closes the visit whatever started it. A manual check-in is never overridden
    by an ENTER somewhere else, but a person who has physically left a venue has
    left it, however they arrived.
    """
    now = datetime.now(timezone.utc)
    active = await db.checkins.find_one(
        {"user_id": user["id"], "venue_id": event.venue_id, "status": "active"}
    )
    if not active:
        await _log(user["id"], event.venue_id, "exit", {"action": "noop"})
        return {"action": "noop"}

    visit = await _close(active, now)
    await _log(user["id"], event.venue_id, "exit", {
        "action": "closed",
        "source": active.get("source", "manual"),
        **visit,
    })
    count = await _broadcast_count(event.venue_id)
    return {"action": "closed", **visit, "present_now": count}


@router.get("/venues/{venue_id}/present")
async def venue_present(venue_id: str):
    """
    How many people are in a room right now. A number, never a list of names:
    an auto check-in is someone who walked in, not someone who chose to announce it.
    """
    count = await db.checkins.count_documents(present_filter(venue_id))
    return {"venue_id": venue_id, "present_now": count}
