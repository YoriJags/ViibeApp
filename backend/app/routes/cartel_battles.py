"""
Cartel Battle — cross-venue tap-off between two crews.

One cartel challenges another using their invite code.
All crew members tap for their side. Rate-limited to 1 tap per 5 seconds per user.
Battle runs for 30 minutes once the challenge is accepted.

Routes:
  POST /cartel-battles/challenge          — captain challenges another crew (by invite code)
  GET  /cartel-battles/active             — active or most recent battle for caller's crew
  POST /cartel-battles/{id}/tap           — tap for your crew
  POST /cartel-battles/{id}/accept        — opponent captain accepts the challenge
"""
import uuid
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from app.config import db
from app.services.auth import require_auth

router = APIRouter(tags=["cartel_battles"])

BATTLE_DURATION_MINUTES = 30
TAP_COOLDOWN_SECONDS = 5  # min gap between taps per user


async def _enrich_cartel_battle(battle: dict) -> dict:
    """Compute derived fields: time remaining, share%, winner."""
    taps_a = battle.get("taps_a", 0)
    taps_b = battle.get("taps_b", 0)
    total = taps_a + taps_b or 1

    now = datetime.now(timezone.utc)

    if battle.get("status") == "pending":
        # Challenge hasn't been accepted yet — no countdown
        seconds_left = None
        status = "pending"
        winner = None
    else:
        accepted_at = battle.get("accepted_at")
        if accepted_at and isinstance(accepted_at, str):
            accepted_at = datetime.fromisoformat(accepted_at)
        ends_at = (accepted_at or battle["created_at"]) + timedelta(minutes=BATTLE_DURATION_MINUTES)
        seconds_left = max(0, int((ends_at - now).total_seconds()))
        status = "active" if seconds_left > 0 else "ended"
        winner = None
        if status == "ended":
            winner = "a" if taps_a > taps_b else "b" if taps_b > taps_a else "tie"

    return {
        "id": battle["id"],
        "status": status,
        "seconds_left": seconds_left,
        "crew_a": {
            "id": battle["crew_a_id"],
            "name": battle["crew_a_name"],
            "venue_name": battle.get("venue_a_name", "Unknown location"),
            "taps": taps_a,
            "share": round(taps_a / total * 100),
        },
        "crew_b": {
            "id": battle["crew_b_id"],
            "name": battle["crew_b_name"],
            "venue_name": battle.get("venue_b_name", "Unknown location"),
            "taps": taps_b,
            "share": round(taps_b / total * 100),
        },
        "total_taps": taps_a + taps_b,
        "winner": winner,
    }


@router.post("/cartel-battles/challenge")
async def challenge_crew(body: dict, user: dict = Depends(require_auth)):
    """
    Captain challenges another cartel by invite code.
    Finds where each crew's captain is checked in to name the locations.
    Creates battle with status=pending until the opponent accepts.
    """
    invite_code = (body.get("invite_code") or "").upper().strip()
    if not invite_code:
        raise HTTPException(status_code=400, detail="invite_code required")

    # Find challenger's crew
    my_crew = await db.crews.find_one({"members": user["id"]})
    if not my_crew:
        raise HTTPException(status_code=404, detail="You're not in a cartel")

    if my_crew.get("captain_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Only the captain can issue a challenge")

    # Find opponent crew
    opp_crew = await db.crews.find_one({"invite_code": invite_code})
    if not opp_crew:
        raise HTTPException(status_code=404, detail="No cartel found with that invite code")

    if opp_crew["id"] == my_crew["id"]:
        raise HTTPException(status_code=400, detail="Can't battle your own cartel")

    # Check for existing active battle between these two crews
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=BATTLE_DURATION_MINUTES + 5)
    existing = await db.cartel_battles.find_one({
        "status": {"$in": ["pending", "active"]},
        "$or": [
            {"crew_a_id": my_crew["id"], "crew_b_id": opp_crew["id"]},
            {"crew_a_id": opp_crew["id"], "crew_b_id": my_crew["id"]},
        ],
    })
    if existing:
        raise HTTPException(status_code=409, detail="A battle between these cartels is already active")

    # Resolve location names from active check-ins (fall back to crew name)
    async def get_crew_location(crew: dict) -> str:
        captain_checkin = await db.checkins.find_one(
            {"user_id": crew.get("captain_id"), "status": "active"},
            {"venue_name": 1},
        )
        if captain_checkin:
            return captain_checkin.get("venue_name", "Unknown")
        # Any member checked in
        for member_id in crew.get("members", []):
            ci = await db.checkins.find_one({"user_id": member_id, "status": "active"}, {"venue_name": 1})
            if ci:
                return ci.get("venue_name", "Unknown")
        return "Location TBD"

    venue_a_name = await get_crew_location(my_crew)
    venue_b_name = await get_crew_location(opp_crew)

    battle_doc = {
        "id": str(uuid.uuid4())[:10],
        "crew_a_id": my_crew["id"],
        "crew_a_name": my_crew["name"],
        "crew_b_id": opp_crew["id"],
        "crew_b_name": opp_crew["name"],
        "venue_a_name": venue_a_name,
        "venue_b_name": venue_b_name,
        "taps_a": 0,
        "taps_b": 0,
        "status": "pending",   # opponent must accept
        "created_at": datetime.now(timezone.utc),
        "accepted_at": None,
    }
    await db.cartel_battles.insert_one(battle_doc)

    return {"battle": await _enrich_cartel_battle(battle_doc), "message": f"Challenge sent to {opp_crew['name']}"}


@router.post("/cartel-battles/{battle_id}/accept")
async def accept_battle(battle_id: str, user: dict = Depends(require_auth)):
    """Opponent captain accepts the challenge — battle clock starts."""
    battle = await db.cartel_battles.find_one({"id": battle_id})
    if not battle:
        raise HTTPException(status_code=404, detail="Battle not found")

    if battle["status"] != "pending":
        raise HTTPException(status_code=409, detail="Battle is not pending")

    # Only the opponent captain can accept
    opp_crew = await db.crews.find_one({"id": battle["crew_b_id"]})
    if not opp_crew or opp_crew.get("captain_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Only the challenged cartel's captain can accept")

    now = datetime.now(timezone.utc)
    await db.cartel_battles.update_one(
        {"id": battle_id},
        {"$set": {"status": "active", "accepted_at": now}},
    )
    updated = await db.cartel_battles.find_one({"id": battle_id})
    return {"battle": await _enrich_cartel_battle(updated)}


@router.get("/cartel-battles/active")
async def get_active_cartel_battle(user: dict = Depends(require_auth)):
    """Returns the active or most recent cartel battle for the caller's crew."""
    my_crew = await db.crews.find_one({"members": user["id"]})
    if not my_crew:
        return {"battle": None, "crew_id": None}

    crew_id = my_crew["id"]
    battle = await db.cartel_battles.find_one(
        {
            "status": {"$in": ["pending", "active"]},
            "$or": [{"crew_a_id": crew_id}, {"crew_b_id": crew_id}],
        },
        sort=[("created_at", -1)],
    )
    if not battle:
        # Return last ended battle (for result display)
        battle = await db.cartel_battles.find_one(
            {"$or": [{"crew_a_id": crew_id}, {"crew_b_id": crew_id}]},
            sort=[("created_at", -1)],
        )

    if not battle:
        return {"battle": None, "crew_id": crew_id}

    return {
        "battle": await _enrich_cartel_battle(battle),
        "crew_id": crew_id,
        "my_side": "a" if battle["crew_a_id"] == crew_id else "b",
    }


@router.post("/cartel-battles/{battle_id}/tap")
async def tap_cartel_battle(battle_id: str, user: dict = Depends(require_auth)):
    """
    Tap for your crew's side.
    Rate-limited: 1 tap per TAP_COOLDOWN_SECONDS per user.
    Only crew members can tap.
    """
    battle = await db.cartel_battles.find_one({"id": battle_id})
    if not battle:
        raise HTTPException(status_code=404, detail="Battle not found")

    if battle["status"] != "active":
        raise HTTPException(status_code=409, detail="Battle is not active")

    # Verify time window
    accepted_at = battle.get("accepted_at")
    if accepted_at and isinstance(accepted_at, str):
        accepted_at = datetime.fromisoformat(accepted_at)
    ends_at = (accepted_at or battle["created_at"]) + timedelta(minutes=BATTLE_DURATION_MINUTES)
    if datetime.now(timezone.utc) > ends_at:
        await db.cartel_battles.update_one({"id": battle_id}, {"$set": {"status": "ended"}})
        raise HTTPException(status_code=410, detail="Battle has ended")

    # Determine which side the user is on
    my_crew = await db.crews.find_one({"members": user["id"]})
    if not my_crew:
        raise HTTPException(status_code=403, detail="You're not in a cartel")

    if my_crew["id"] == battle["crew_a_id"]:
        side = "a"
    elif my_crew["id"] == battle["crew_b_id"]:
        side = "b"
    else:
        raise HTTPException(status_code=403, detail="Your cartel is not in this battle")

    # Rate limit: check last tap time
    last_tap = await db.cartel_battle_taps.find_one(
        {"battle_id": battle_id, "user_id": user["id"]},
        sort=[("created_at", -1)],
    )
    if last_tap:
        last_at = last_tap["created_at"]
        if isinstance(last_at, str):
            last_at = datetime.fromisoformat(last_at)
        elapsed = (datetime.now(timezone.utc) - last_at).total_seconds()
        if elapsed < TAP_COOLDOWN_SECONDS:
            raise HTTPException(
                status_code=429,
                detail=f"Tap cooldown: wait {TAP_COOLDOWN_SECONDS - int(elapsed)}s",
            )

    # Record tap
    await db.cartel_battle_taps.insert_one({
        "battle_id": battle_id,
        "user_id": user["id"],
        "crew_id": my_crew["id"],
        "side": side,
        "created_at": datetime.now(timezone.utc),
    })

    inc_field = "taps_a" if side == "a" else "taps_b"
    await db.cartel_battles.update_one({"id": battle_id}, {"$inc": {inc_field: 1}})

    updated = await db.cartel_battles.find_one({"id": battle_id})
    return {
        "battle": await _enrich_cartel_battle(updated),
        "my_side": side,
    }
