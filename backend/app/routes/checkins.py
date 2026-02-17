"""
Vibe App - Ghost Check-in Routes
Stealth presence at venues - geofence-enforced, TTL auto-expiry.
"""
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Depends

from app.config import db
from app.models import GhostCheckin, Coordinates
from app.services.auth import require_auth
from app.services.vibe import is_within_geofence
from app.services.streaks import update_streak
from app.services.realtime import emit_checkin_update

router = APIRouter(tags=["checkins"])

CHECKIN_TTL_HOURS = 4
MAX_CHECKINS_PER_VENUE_PER_DAY = 3
CHECKIN_CLOUT = 2


@router.post("/checkins")
async def ghost_checkin(data: GhostCheckin, user: dict = Depends(require_auth)):
    """Ghost check-in at a venue. Geofence-enforced, awards 2 clout."""
    venue = await db.venues.find_one({"id": data.venue_id})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    # Geofence check
    user_coords = Coordinates(lat=data.latitude, lng=data.longitude)
    venue_coords = Coordinates(**venue["coordinates"])
    venue_radius = venue.get("geofence_radius_m", 100)
    if not is_within_geofence(user_coords, venue_coords, radius_m=venue_radius):
        raise HTTPException(
            status_code=403,
            detail=f"You must be within {int(venue_radius)}m of the venue to check in. Get closer!",
        )

    # Check if already checked in somewhere
    active = await db.checkins.find_one({
        "user_id": user["id"],
        "status": "active",
    })
    if active:
        raise HTTPException(
            status_code=409,
            detail="You're already checked in at another venue. Check out first.",
        )

    # Rate limit: max 3 check-ins per venue per day
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_count = await db.checkins.count_documents({
        "user_id": user["id"],
        "venue_id": data.venue_id,
        "created_at": {"$gte": today_start},
    })
    if today_count >= MAX_CHECKINS_PER_VENUE_PER_DAY:
        raise HTTPException(
            status_code=429,
            detail="Check-in limit reached for this venue today.",
        )

    now = datetime.now(timezone.utc)
    checkin_doc = {
        "user_id": user["id"],
        "username": user.get("username", "Anonymous"),
        "venue_id": data.venue_id,
        "venue_name": venue.get("name", ""),
        "status": "active",
        "created_at": now,
        "expires_at": now + timedelta(hours=CHECKIN_TTL_HOURS),
    }
    await db.checkins.insert_one(checkin_doc)

    # Award clout
    await db.users.update_one(
        {"id": user["id"]},
        {"$inc": {"clout_points": CHECKIN_CLOUT}},
    )

    # Update streak
    streak_result = await update_streak(user["id"])

    # Get active count for venue
    active_count = await db.checkins.count_documents({
        "venue_id": data.venue_id,
        "status": "active",
    })

    # Broadcast to Socket.IO
    await emit_checkin_update(data.venue_id, active_count)

    return {
        "message": "You're here! Ghost check-in active.",
        "clout_earned": CHECKIN_CLOUT,
        "expires_in_hours": CHECKIN_TTL_HOURS,
        "active_count": active_count,
        "streak": streak_result,
    }


@router.get("/checkins/venue/{venue_id}")
async def get_venue_checkins(venue_id: str):
    """Get active check-ins at a venue."""
    checkins = await db.checkins.find(
        {"venue_id": venue_id, "status": "active"},
        {"_id": 0, "user_id": 0},
    ).to_list(100)

    active_count = len(checkins)
    usernames = [c.get("username", "Anonymous") for c in checkins]

    return {
        "venue_id": venue_id,
        "active_count": active_count,
        "users": usernames,
    }


@router.get("/checkins/me")
async def get_my_checkin(user: dict = Depends(require_auth)):
    """Get the user's current active check-in."""
    checkin = await db.checkins.find_one(
        {"user_id": user["id"], "status": "active"},
        {"_id": 0},
    )
    return {"checkin": checkin}


@router.delete("/checkins/{venue_id}")
async def checkout(venue_id: str, user: dict = Depends(require_auth)):
    """Check out from a venue."""
    result = await db.checkins.update_one(
        {"user_id": user["id"], "venue_id": venue_id, "status": "active"},
        {"$set": {"status": "checked_out", "checked_out_at": datetime.now(timezone.utc)}},
    )

    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="No active check-in found at this venue.")

    active_count = await db.checkins.count_documents({
        "venue_id": venue_id,
        "status": "active",
    })

    await emit_checkin_update(venue_id, active_count)

    return {"message": "Checked out.", "active_count": active_count}
