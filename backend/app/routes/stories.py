"""
Vibe App - Venue Stories Routes
Photo-only "proof snaps" at venues. Geofence-enforced, 3-hour TTL.
Lean implementation: no video, max 500KB photos, max 2 per user per night.
"""
import uuid
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Depends

from app.config import db, logger
from app.models import VenueStory, Coordinates
from app.services.auth import require_auth
from app.services.vibe import is_within_geofence
from app.services.streaks import update_streak

router = APIRouter(tags=["stories"])

STORY_TTL_HOURS = 3
MAX_STORIES_PER_USER_PER_DAY = 2
MAX_STORY_SIZE_BYTES = 500_000  # 500KB
STORY_POST_CLOUT = 5
STORY_VIRAL_CLOUT = 10
STORY_VIRAL_THRESHOLD = 20  # views needed for viral bonus


@router.post("/stories")
async def post_story(data: VenueStory, user: dict = Depends(require_auth)):
    """Post a photo story at a venue. Geofence-enforced, photos only."""
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
            detail=f"You must be within {int(venue_radius)}m of the venue to post a story.",
        )

    # Check photo size (base64 string length ~ 4/3 of binary size)
    if len(data.media_url) > MAX_STORY_SIZE_BYTES * 1.4:
        raise HTTPException(
            status_code=413,
            detail="Photo too large. Maximum 500KB.",
        )

    # Caption length check
    if len(data.caption) > 100:
        raise HTTPException(status_code=400, detail="Caption too long. Max 100 characters.")

    # Rate limit: max 2 stories per user per day
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_count = await db.stories.count_documents({
        "user_id": user["id"],
        "created_at": {"$gte": today_start},
    })
    if today_count >= MAX_STORIES_PER_USER_PER_DAY:
        raise HTTPException(
            status_code=429,
            detail="You've used both story slots for tonight. Come back tomorrow!",
        )

    now = datetime.now(timezone.utc)
    story_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "username": user.get("username", "Anonymous"),
        "scout_status": user.get("scout_status", "newbie"),
        "venue_id": data.venue_id,
        "venue_name": venue.get("name", ""),
        "media_url": data.media_url,
        "caption": data.caption[:100],
        "views": 0,
        "viral_bonus_claimed": False,
        "created_at": now,
        "expires_at": now + timedelta(hours=STORY_TTL_HOURS),
    }
    await db.stories.insert_one(story_doc)

    # Award clout
    await db.users.update_one(
        {"id": user["id"]},
        {"$inc": {"clout_points": STORY_POST_CLOUT}},
    )

    # Update streak
    await update_streak(user["id"])

    logger.info(f"Story posted by {user['id']} at venue {data.venue_id}")

    return {
        "story_id": story_doc["id"],
        "clout_earned": STORY_POST_CLOUT,
        "expires_in_hours": STORY_TTL_HOURS,
        "slots_remaining": MAX_STORIES_PER_USER_PER_DAY - today_count - 1,
    }


@router.get("/stories/venue/{venue_id}")
async def get_venue_stories(venue_id: str):
    """Get active stories for a venue."""
    stories = await db.stories.find(
        {"venue_id": venue_id},
        {"_id": 0, "media_url": 0},  # Don't send full images in list
    ).sort("created_at", -1).to_list(20)

    return {"stories": stories, "count": len(stories)}


@router.get("/stories/{story_id}")
async def get_story(story_id: str):
    """Get a single story with full media."""
    story = await db.stories.find_one({"id": story_id}, {"_id": 0})
    if not story:
        raise HTTPException(status_code=404, detail="Story not found or expired")
    return story


@router.post("/stories/{story_id}/view")
async def view_story(story_id: str, user: dict = Depends(require_auth)):
    """Register a view on a story. Awards viral clout at threshold."""
    story = await db.stories.find_one({"id": story_id})
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")

    # Don't count self-views
    if story["user_id"] == user["id"]:
        return {"views": story.get("views", 0)}

    result = await db.stories.update_one(
        {"id": story_id},
        {"$inc": {"views": 1}},
    )

    new_views = story.get("views", 0) + 1

    # Check for viral bonus
    if new_views >= STORY_VIRAL_THRESHOLD and not story.get("viral_bonus_claimed"):
        await db.stories.update_one(
            {"id": story_id},
            {"$set": {"viral_bonus_claimed": True}},
        )
        await db.users.update_one(
            {"id": story["user_id"]},
            {"$inc": {"clout_points": STORY_VIRAL_CLOUT}},
        )
        logger.info(f"Viral bonus for story {story_id} by user {story['user_id']}")

    return {"views": new_views}


@router.delete("/stories/{story_id}")
async def delete_story(story_id: str, user: dict = Depends(require_auth)):
    """Delete your own story."""
    result = await db.stories.delete_one({
        "id": story_id,
        "user_id": user["id"],
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Story not found or not yours")
    return {"message": "Story deleted"}
