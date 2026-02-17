"""
Vibe App - Crew Routes
Squad feature: create/join crews, vote on venues, earn squad bonuses.
"""
import uuid
import random
import string
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends

from app.config import db, logger
from app.models import CrewCreate, CrewJoin, CrewVoteStart, CrewVoteCast
from app.services.auth import require_auth
from app.services.realtime import emit_crew_vote_update, emit_crew_checkin

router = APIRouter(tags=["crews"])

MAX_CREW_SIZE = 8
INVITE_CODE_LENGTH = 6


def generate_invite_code() -> str:
    """Generate a unique 6-character invite code."""
    chars = string.ascii_uppercase + string.digits
    return "".join(random.choices(chars, k=INVITE_CODE_LENGTH))


@router.post("/crews")
async def create_crew(data: CrewCreate, user: dict = Depends(require_auth)):
    """Create a new crew. User becomes the captain."""
    if len(data.name) > 20:
        raise HTTPException(status_code=400, detail="Crew name max 20 characters")
    if len(data.name) < 2:
        raise HTTPException(status_code=400, detail="Crew name too short")

    # Check if user is already in a crew
    existing = await db.crews.find_one({"members": user["id"]})
    if existing:
        raise HTTPException(status_code=409, detail="You're already in a crew. Leave first.")

    # Generate unique invite code
    invite_code = generate_invite_code()
    while await db.crews.find_one({"invite_code": invite_code}):
        invite_code = generate_invite_code()

    crew_doc = {
        "id": str(uuid.uuid4()),
        "name": data.name,
        "captain_id": user["id"],
        "members": [user["id"]],
        "member_details": [{
            "user_id": user["id"],
            "username": user.get("username", "Unknown"),
            "scout_status": user.get("scout_status", "newbie"),
            "joined_at": datetime.now(timezone.utc).isoformat(),
        }],
        "invite_code": invite_code,
        "created_at": datetime.now(timezone.utc),
    }
    await db.crews.insert_one(crew_doc)

    logger.info(f"Crew '{data.name}' created by {user['id']} with code {invite_code}")

    return {
        "crew_id": crew_doc["id"],
        "name": data.name,
        "invite_code": invite_code,
        "members": 1,
    }


@router.post("/crews/join")
async def join_crew(data: CrewJoin, user: dict = Depends(require_auth)):
    """Join a crew using an invite code."""
    # Check if already in a crew
    existing = await db.crews.find_one({"members": user["id"]})
    if existing:
        raise HTTPException(status_code=409, detail="You're already in a crew. Leave first.")

    crew = await db.crews.find_one({"invite_code": data.invite_code.upper()})
    if not crew:
        raise HTTPException(status_code=404, detail="Invalid invite code")

    if len(crew.get("members", [])) >= MAX_CREW_SIZE:
        raise HTTPException(status_code=409, detail="This crew is full (max 8 members)")

    member_detail = {
        "user_id": user["id"],
        "username": user.get("username", "Unknown"),
        "scout_status": user.get("scout_status", "newbie"),
        "joined_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.crews.update_one(
        {"id": crew["id"]},
        {
            "$addToSet": {"members": user["id"]},
            "$push": {"member_details": member_detail},
        },
    )

    logger.info(f"User {user['id']} joined crew {crew['id']}")

    return {
        "crew_id": crew["id"],
        "name": crew["name"],
        "members": len(crew["members"]) + 1,
    }


@router.get("/crews/me")
async def get_my_crew(user: dict = Depends(require_auth)):
    """Get the user's crew with member details and active check-ins."""
    crew = await db.crews.find_one({"members": user["id"]}, {"_id": 0})
    if not crew:
        return {"crew": None}

    # Get active check-ins for crew members
    member_checkins = {}
    for member_id in crew.get("members", []):
        checkin = await db.checkins.find_one(
            {"user_id": member_id, "status": "active"},
            {"_id": 0, "venue_name": 1, "venue_id": 1},
        )
        if checkin:
            member_checkins[member_id] = {
                "venue_id": checkin.get("venue_id"),
                "venue_name": checkin.get("venue_name", ""),
            }

    # Enrich member details with live status
    for detail in crew.get("member_details", []):
        detail["checked_in"] = detail["user_id"] in member_checkins
        if detail["user_id"] in member_checkins:
            detail["venue_name"] = member_checkins[detail["user_id"]]["venue_name"]

    # Get active vote if any
    active_vote = await db.crew_votes.find_one(
        {"crew_id": crew["id"], "status": "active"},
        {"_id": 0},
    )

    crew["active_vote"] = active_vote
    crew["is_captain"] = crew.get("captain_id") == user["id"]

    return {"crew": crew}


@router.delete("/crews/{crew_id}/leave")
async def leave_crew(crew_id: str, user: dict = Depends(require_auth)):
    """Leave a crew. If captain leaves, crew is dissolved."""
    crew = await db.crews.find_one({"id": crew_id})
    if not crew:
        raise HTTPException(status_code=404, detail="Crew not found")

    if user["id"] not in crew.get("members", []):
        raise HTTPException(status_code=403, detail="You're not in this crew")

    if crew.get("captain_id") == user["id"]:
        # Captain leaving - dissolve crew
        await db.crews.delete_one({"id": crew_id})
        await db.crew_votes.delete_many({"crew_id": crew_id})
        return {"message": "Crew dissolved (captain left)"}

    # Remove member
    await db.crews.update_one(
        {"id": crew_id},
        {
            "$pull": {
                "members": user["id"],
                "member_details": {"user_id": user["id"]},
            },
        },
    )

    return {"message": "Left the crew"}


@router.post("/crews/{crew_id}/vote")
async def start_vote(crew_id: str, data: CrewVoteStart, user: dict = Depends(require_auth)):
    """Start a venue vote. Captain only. Pick 2-4 venues."""
    crew = await db.crews.find_one({"id": crew_id})
    if not crew:
        raise HTTPException(status_code=404, detail="Crew not found")

    if crew.get("captain_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Only the captain can start a vote")

    if len(data.venue_ids) < 2 or len(data.venue_ids) > 4:
        raise HTTPException(status_code=400, detail="Pick 2-4 venues to vote on")

    # Check for active vote
    active = await db.crew_votes.find_one({"crew_id": crew_id, "status": "active"})
    if active:
        raise HTTPException(status_code=409, detail="There's already an active vote")

    # Get venue details
    options = []
    for vid in data.venue_ids:
        venue = await db.venues.find_one({"id": vid}, {"_id": 0, "id": 1, "name": 1, "area": 1, "current_vibe_score": 1, "energy_level": 1})
        if venue:
            options.append({**venue, "votes": 0, "voters": []})

    if len(options) < 2:
        raise HTTPException(status_code=400, detail="At least 2 valid venues required")

    vote_doc = {
        "id": str(uuid.uuid4()),
        "crew_id": crew_id,
        "started_by": user["id"],
        "options": options,
        "status": "active",
        "total_votes": 0,
        "created_at": datetime.now(timezone.utc),
    }
    await db.crew_votes.insert_one(vote_doc)

    await emit_crew_vote_update(crew_id, {
        "type": "vote_started",
        "vote_id": vote_doc["id"],
        "options": options,
    })

    return {"vote_id": vote_doc["id"], "options": options}


@router.get("/crews/{crew_id}/vote/active")
async def get_active_vote(crew_id: str, user: dict = Depends(require_auth)):
    """Get the active vote for a crew."""
    crew = await db.crews.find_one({"id": crew_id})
    if not crew or user["id"] not in crew.get("members", []):
        raise HTTPException(status_code=403, detail="Not a member of this crew")

    vote = await db.crew_votes.find_one(
        {"crew_id": crew_id, "status": "active"},
        {"_id": 0},
    )
    if not vote:
        return {"vote": None}

    # Check if user already voted
    has_voted = any(
        user["id"] in opt.get("voters", [])
        for opt in vote.get("options", [])
    )
    vote["has_voted"] = has_voted

    return {"vote": vote}


@router.post("/crews/{crew_id}/vote/{vote_id}/cast")
async def cast_vote(crew_id: str, vote_id: str, data: CrewVoteCast, user: dict = Depends(require_auth)):
    """Cast a vote for a venue."""
    crew = await db.crews.find_one({"id": crew_id})
    if not crew or user["id"] not in crew.get("members", []):
        raise HTTPException(status_code=403, detail="Not a member of this crew")

    vote = await db.crew_votes.find_one({"id": vote_id, "status": "active"})
    if not vote:
        raise HTTPException(status_code=404, detail="No active vote found")

    # Check if already voted
    for opt in vote.get("options", []):
        if user["id"] in opt.get("voters", []):
            raise HTTPException(status_code=409, detail="You already voted")

    # Find the option and add vote
    option_found = False
    for opt in vote.get("options", []):
        if opt.get("id") == data.venue_id:
            opt["votes"] += 1
            opt["voters"].append(user["id"])
            option_found = True
            break

    if not option_found:
        raise HTTPException(status_code=400, detail="Invalid venue choice")

    total_votes = vote.get("total_votes", 0) + 1

    await db.crew_votes.update_one(
        {"id": vote_id},
        {"$set": {"options": vote["options"], "total_votes": total_votes}},
    )

    # Check if all members voted - auto-close
    if total_votes >= len(crew.get("members", [])):
        winner = max(vote["options"], key=lambda o: o["votes"])
        await db.crew_votes.update_one(
            {"id": vote_id},
            {"$set": {"status": "completed", "winner": winner}},
        )

    await emit_crew_vote_update(crew_id, {
        "type": "vote_cast",
        "vote_id": vote_id,
        "options": vote["options"],
        "total_votes": total_votes,
    })

    return {"message": "Vote cast!", "total_votes": total_votes}
