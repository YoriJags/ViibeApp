"""
Collective Vibe Quest — everyone at a venue pushes to PEAK together.

A quest activates when a venue has ≥2 active scouts and a score in the
30–84 range (not already PEAK). The whole room earns 1.5× clout on any
tap they drop while the quest is active. When the score crosses 85
(PEAK threshold), the quest is marked achieved and everyone who
contributed gets the bonus applied automatically via update_user_clout().

Routes:
  GET /vibe-quest/{venue_id}   — current quest state for a venue
  GET /vibe-quest/city/{city}  — all active quests in a city (home screen card)
"""
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter

from app.config import db

router = APIRouter(tags=["vibe_quest"])

PEAK_THRESHOLD   = 85   # score needed to achieve PEAK
QUEST_MIN_SCORE  = 30   # don't show quest below this (venue is too dead)
QUEST_MIN_SCOUTS = 2    # need at least 2 active scouts to trigger
CLOUT_MULTIPLIER = 1.5  # reward for everyone who tapped during the quest


def _quest_state(venue: dict, active_scouts: int) -> dict:
    score        = venue.get("current_vibe_score", 0)
    achieved     = score >= PEAK_THRESHOLD
    active       = (
        not achieved
        and score >= QUEST_MIN_SCORE
        and active_scouts >= QUEST_MIN_SCOUTS
    )
    gap          = max(0, PEAK_THRESHOLD - int(score))
    progress_pct = min(100.0, round(score / PEAK_THRESHOLD * 100, 1))

    return {
        "venue_id":          venue.get("id", ""),
        "venue_name":        venue.get("name", ""),
        "venue_area":        venue.get("area", ""),
        "active":            active,
        "achieved":          achieved,
        "current_score":     round(score, 1),
        "target_score":      PEAK_THRESHOLD,
        "gap":               gap,
        "progress_pct":      progress_pct,
        "active_scouts":     active_scouts,
        "clout_multiplier":  CLOUT_MULTIPLIER,
        "label":             "PEAK UNLOCKED" if achieved else f"{gap} pts to PEAK",
    }


async def _active_scouts_for_venue(venue_id: str, now: datetime) -> int:
    """Count unique scouts active in the last hour for this venue."""
    hour_ago = now - timedelta(hours=1)
    raters   = set(await db.ratings.distinct(   "user_id", {"venue_id": venue_id, "timestamp": {"$gte": hour_ago}}))
    reactors = set(await db.reactions.distinct( "user_id", {"venue_id": venue_id, "timestamp": {"$gte": hour_ago}}))
    tappers  = set(await db.venue_bolts.distinct("user_id", {"venue_id": venue_id, "created_at": {"$gte": hour_ago}}))
    return len(raters | reactors | tappers)


@router.get("/vibe-quest/{venue_id}")
async def get_vibe_quest(venue_id: str):
    """
    GET /api/vibe-quest/{venue_id}
    Returns the collective quest state for a single venue.
    """
    venue = await db.venues.find_one(
        {"id": venue_id},
        {"_id": 0, "id": 1, "name": 1, "area": 1, "current_vibe_score": 1, "vibe_state": 1},
    )
    if not venue:
        return {"active": False, "achieved": False, "venue_id": venue_id}

    now           = datetime.now(timezone.utc)
    active_scouts = await _active_scouts_for_venue(venue_id, now)
    return _quest_state(venue, active_scouts)


@router.get("/vibe-quest/city/{city}")
async def get_city_quests(city: str):
    """
    GET /api/vibe-quest/city/{city}
    Returns all venues in a city that currently have an active collective quest.
    Used by the home screen to surface the "PUSH TOGETHER" card.
    """
    now      = datetime.now(timezone.utc)
    hour_ago = now - timedelta(hours=1)

    # Venues in the quest score window
    venues = await db.venues.find(
        {
            "city": city,
            "current_vibe_score": {"$gte": QUEST_MIN_SCORE, "$lt": PEAK_THRESHOLD},
            "is_suppressed": {"$ne": True},
        },
        {"_id": 0, "id": 1, "name": 1, "area": 1, "current_vibe_score": 1},
    ).to_list(50)

    # Filter to those with enough active scouts
    active_quests = []
    for venue in venues:
        scouts = await _active_scouts_for_venue(venue["id"], now)
        if scouts >= QUEST_MIN_SCOUTS:
            active_quests.append(_quest_state(venue, scouts))

    # Sort: closest to PEAK first (smallest gap)
    active_quests.sort(key=lambda q: q["gap"])

    return {
        "city":          city,
        "active_quests": active_quests,
        "total":         len(active_quests),
    }
