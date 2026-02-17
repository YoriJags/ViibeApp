"""
Vibe App - Lobby Routes
Users shortlist/bookmark venues and compare them side-by-side with live data.
Includes smart nudge that highlights the hottest venue in their lobby.
"""
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Request

from app.config import db
from app.models import LobbyEntry, LobbyAddRequest, LobbyRemoveRequest
from app.services.auth import get_current_user

router = APIRouter(tags=["lobby"])

MAX_LOBBY_SIZE = 10


@router.get("/lobby")
async def get_lobby(request: Request):
    """Get user's lobby with live venue data and smart nudge."""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    entries = await db.lobby.find(
        {"user_id": user["id"]}, {"_id": 0}
    ).sort("added_at", -1).to_list(MAX_LOBBY_SIZE)

    if not entries:
        return {"venues": [], "nudge": None, "count": 0}

    venue_ids = [e["venue_id"] for e in entries]

    # Fetch live venue data for all lobbied venues
    venues = await db.venues.find(
        {"id": {"$in": venue_ids}},
        {"_id": 0},
    ).to_list(MAX_LOBBY_SIZE)

    venue_map = {v["id"]: v for v in venues}

    # Enrich with lobby metadata
    lobby_venues = []
    for entry in entries:
        venue = venue_map.get(entry["venue_id"])
        if venue:
            lobby_venues.append({
                **venue,
                "lobby_added_at": entry["added_at"].isoformat() if isinstance(entry["added_at"], datetime) else entry["added_at"],
                "lobby_entry_id": entry["id"],
            })

    # Smart Nudge: pick the hottest venue based on score + recent activity
    nudge = _calculate_nudge(lobby_venues)

    return {
        "venues": lobby_venues,
        "nudge": nudge,
        "count": len(lobby_venues),
    }


@router.post("/lobby")
async def add_to_lobby(body: LobbyAddRequest, request: Request):
    """Add a venue to user's lobby (shortlist)."""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Check venue exists
    venue = await db.venues.find_one({"id": body.venue_id}, {"_id": 0, "id": 1, "name": 1})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    # Check if already in lobby
    existing = await db.lobby.find_one({
        "user_id": user["id"],
        "venue_id": body.venue_id,
    })
    if existing:
        return {"message": "Already in your lobby", "added": False}

    # Check lobby size limit
    count = await db.lobby.count_documents({"user_id": user["id"]})
    if count >= MAX_LOBBY_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"Lobby full (max {MAX_LOBBY_SIZE}). Remove a venue first.",
        )

    entry = LobbyEntry(user_id=user["id"], venue_id=body.venue_id)
    await db.lobby.insert_one(entry.dict())

    return {
        "message": f"{venue.get('name', 'Venue')} added to your lobby",
        "added": True,
        "entry_id": entry.id,
    }


@router.delete("/lobby/{venue_id}")
async def remove_from_lobby(venue_id: str, request: Request):
    """Remove a venue from user's lobby."""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    result = await db.lobby.delete_one({
        "user_id": user["id"],
        "venue_id": venue_id,
    })

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Venue not in your lobby")

    return {"message": "Removed from lobby", "removed": True}


@router.get("/lobby/check/{venue_id}")
async def check_lobby_status(venue_id: str, request: Request):
    """Check if a venue is in the user's lobby."""
    user = await get_current_user(request)
    if not user:
        return {"in_lobby": False}

    entry = await db.lobby.find_one({
        "user_id": user["id"],
        "venue_id": venue_id,
    })

    return {"in_lobby": entry is not None}


def _calculate_nudge(venues: list[dict]) -> dict | None:
    """Pick the best venue to go to right now based on live signals."""
    if not venues:
        return None

    scored = []
    for v in venues:
        score = v.get("current_vibe_score", 0)

        # Bonus for active pulse drops (merchant is investing = something happening)
        if v.get("active_pulse_tier"):
            score += 15

        # Bonus for recent activity (higher ratings in last hour)
        if v.get("total_ratings_24h", 0) > 5:
            score += 10

        # Bonus for trending up
        if v.get("vibe_velocity") == "heating_up":
            score += 20
        elif v.get("vibe_velocity") == "cooling_down":
            score -= 10

        # Penalty for gate issues
        if v.get("gate_level") == "blocked":
            score -= 15
        elif v.get("gate_level") == "slow":
            score -= 5

        scored.append((v, score))

    scored.sort(key=lambda x: x[1], reverse=True)
    best_venue, best_score = scored[0]

    # Only nudge if there's meaningful differentiation
    if len(scored) > 1:
        runner_up_score = scored[1][1]
        margin = best_score - runner_up_score
    else:
        margin = best_score

    if best_score < 20:
        return {
            "type": "quiet_night",
            "message": "Things are still warming up. Check back later!",
            "venue_id": None,
        }

    # Build nudge reason
    reasons = []
    if best_venue.get("vibe_velocity") == "heating_up":
        reasons.append("heating up fast")
    if best_venue.get("active_pulse_tier"):
        reasons.append("has a Pulse Drop active")
    if best_venue.get("current_vibe_score", 0) >= 75:
        reasons.append("vibes are electric")
    if best_venue.get("gate_level") == "clear":
        reasons.append("no queue right now")

    reason_text = " & ".join(reasons[:2]) if reasons else "highest energy right now"

    return {
        "type": "go_here",
        "venue_id": best_venue["id"],
        "venue_name": best_venue.get("name", ""),
        "score": best_venue.get("current_vibe_score", 0),
        "message": f"{best_venue.get('name', 'This spot')} is {reason_text}!",
        "energy": best_venue.get("energy_level", "chill"),
        "margin": round(margin, 1),
    }
