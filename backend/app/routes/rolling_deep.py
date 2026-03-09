"""
Rolling Deep — Cartel Group Check-In

When 2+ crew members are heading to the same venue, one scout initiates
a "Roll Deep" session. Other crew members see the alert and can confirm.
When 2+ members confirm, the whole crew gets a bonus clout drop.

Collections:
  rolling_deep_sessions: { crew_id, venue_id, venue_name, initiator_id,
                            members_in: [user_id], started_at, expires_at }
  TTL index on expires_at (2-hour sessions).

Routes:
  POST /api/crews/:id/rolling-deep           — start a session at a venue
  POST /api/crews/:id/rolling-deep/join      — join an active session
  GET  /api/crews/:id/rolling-deep           — get active session (if any)
"""
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Request

from app.config import db, logger, sio
from app.services.auth import get_current_user

router = APIRouter(tags=["rolling-deep"])

ROLLING_DEEP_TTL_HOURS = 2
BONUS_CLOUT = 10        # bonus per member when 2+ confirmed
MIN_MEMBERS = 2         # threshold to trigger "Rolling Deep" status


@router.post("/crews/{crew_id}/rolling-deep")
async def start_rolling_deep(crew_id: str, request: Request):
    """
    Initiate a Rolling Deep session for a crew at a specific venue.
    Body: { "venue_id": str, "venue_name": str }
    Replaces any existing active session for the crew.
    """
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    crew = await db.crews.find_one({"id": crew_id})
    if not crew:
        raise HTTPException(status_code=404, detail="Crew not found")
    if user["id"] not in crew.get("members", []):
        raise HTTPException(status_code=403, detail="Not a crew member")

    try:
        body = await request.json()
    except Exception:
        body = {}

    venue_id   = body.get("venue_id", "")
    venue_name = body.get("venue_name", "")
    if not venue_id:
        raise HTTPException(status_code=400, detail="venue_id required")

    if not venue_name:
        venue_doc = await db.venues.find_one({"id": venue_id}, {"name": 1})
        venue_name = venue_doc.get("name", "Unknown Venue") if venue_doc else "Unknown Venue"

    now = datetime.now(timezone.utc)
    session = {
        "crew_id":     crew_id,
        "crew_name":   crew.get("name", ""),
        "venue_id":    venue_id,
        "venue_name":  venue_name,
        "initiator_id": user["id"],
        "initiator_username": user.get("username", ""),
        "members_in":  [user["id"]],
        "started_at":  now,
        "expires_at":  now + timedelta(hours=ROLLING_DEEP_TTL_HOURS),
        "status":      "building",   # building → rolling (2+ confirmed)
    }

    await db.rolling_deep_sessions.replace_one(
        {"crew_id": crew_id},
        session,
        upsert=True,
    )

    # Broadcast to crew via Socket.IO
    try:
        await sio.emit(f"crew:{crew_id}:rolling_deep", {
            "event":            "started",
            "venue_id":         venue_id,
            "venue_name":       venue_name,
            "initiator":        user.get("username", ""),
            "members_confirmed": 1,
        })
    except Exception:
        pass

    return {
        "ok":         True,
        "session":    session,
        "message":    f"Rolling Deep started at {venue_name}. Pull in the crew!",
    }


@router.post("/crews/{crew_id}/rolling-deep/join")
async def join_rolling_deep(crew_id: str, request: Request):
    """
    Join an active Rolling Deep session.
    When MIN_MEMBERS (2) confirmed → status flips to 'rolling', bonus clout awarded.
    """
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session = await db.rolling_deep_sessions.find_one({"crew_id": crew_id})
    if not session:
        raise HTTPException(status_code=404, detail="No active Rolling Deep for this crew")

    # Check TTL manually (TTL index handles cleanup but may lag)
    if datetime.now(timezone.utc) > session["expires_at"].replace(tzinfo=timezone.utc):
        raise HTTPException(status_code=410, detail="Rolling Deep session expired")

    user_id = user["id"]
    already_in = user_id in session.get("members_in", [])

    if not already_in:
        await db.rolling_deep_sessions.update_one(
            {"crew_id": crew_id},
            {"$addToSet": {"members_in": user_id}},
        )

    # Reload to get updated count
    session = await db.rolling_deep_sessions.find_one({"crew_id": crew_id})
    confirmed_count = len(session.get("members_in", []))
    bonus_awarded = False

    # Flip to rolling + award bonus if threshold just hit
    if confirmed_count >= MIN_MEMBERS and session.get("status") == "building":
        await db.rolling_deep_sessions.update_one(
            {"crew_id": crew_id},
            {"$set": {"status": "rolling"}},
        )
        # Award bonus clout to all confirmed members
        for uid in session.get("members_in", []):
            await db.users.update_one({"id": uid}, {"$inc": {"clout_points": BONUS_CLOUT}})
        bonus_awarded = True

        try:
            await sio.emit(f"crew:{crew_id}:rolling_deep", {
                "event":             "rolling",
                "venue_id":          session["venue_id"],
                "venue_name":        session["venue_name"],
                "members_confirmed": confirmed_count,
                "bonus_clout":       BONUS_CLOUT,
            })
        except Exception:
            pass

        logger.info(f"Rolling Deep LIVE: crew {crew_id} at {session['venue_name']} — {confirmed_count} members")

    return {
        "ok":               True,
        "status":           "rolling" if confirmed_count >= MIN_MEMBERS else "building",
        "members_confirmed": confirmed_count,
        "venue_name":       session["venue_name"],
        "bonus_awarded":    bonus_awarded,
        "bonus_clout":      BONUS_CLOUT if bonus_awarded else 0,
    }


@router.get("/crews/{crew_id}/rolling-deep")
async def get_rolling_deep(crew_id: str):
    """
    Get active Rolling Deep session for a crew. No auth required.
    Returns null if no active session.
    """
    session = await db.rolling_deep_sessions.find_one(
        {"crew_id": crew_id},
        {"_id": 0},
    )
    if not session:
        return {"session": None}

    # Check expiry
    expires = session.get("expires_at")
    if expires:
        exp = expires.replace(tzinfo=timezone.utc) if expires.tzinfo is None else expires
        if datetime.now(timezone.utc) > exp:
            return {"session": None}

    return {"session": session}
