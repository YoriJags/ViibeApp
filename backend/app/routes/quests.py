"""
Vibe App - Quests
Discovery endpoints for Pro Quests and the Hidden Gem Hunt.

Pro Quests:
  - Dark Spots: venues with < 5 ratings in 48h. Scout them → 3x clout (logic in services/vibe.py).

Hidden Gem Hunt (mid-week only, Mon–Thu):
  - Low-score but heating-up venues. Scout them → 2.5x clout.

Both multipliers are applied automatically inside update_user_clout() in services/vibe.py.
These endpoints just surface the qualifying venues so the frontend can display them.
"""
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException

from app.config import db

router = APIRouter(tags=["quests"])


@router.get("/quests/dark-spots")
async def get_dark_spot_venues(city: str = "lagos", limit: int = 5):
    """
    Pro Quest — returns venues that qualify as Dark Spots.
    Dark Spot = fewer than 5 scout ratings in the last 48 hours.
    Rating these venues earns 3x clout multiplier.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(hours=48)

    # Get all venues in city
    venues = await db.venues.find(
        {"city": city, "is_suppressed": {"$ne": True}},
        {"_id": 0, "id": 1, "name": 1, "area": 1, "venue_type": 1,
         "current_vibe_score": 1, "coordinates": 1},
    ).to_list(200)

    # Filter to those with < 5 ratings in 48h
    dark_spots = []
    for venue in venues:
        count = await db.ratings.count_documents({
            "venue_id": venue["id"],
            "timestamp": {"$gte": cutoff},
        })
        if count < 5:
            dark_spots.append({
                **venue,
                "recent_ratings": count,
                "clout_multiplier": 3,
                "quest_label": "Dark Spot",
                "quest_description": "No intel on this venue — be the first scout to light it up.",
            })
        if len(dark_spots) >= limit:
            break

    return {
        "quest_type": "dark_spots",
        "clout_multiplier": 3,
        "venues": dark_spots,
        "total": len(dark_spots),
        "instructions": "Rate any of these venues to earn 3x clout. Applied automatically.",
    }


@router.get("/quests/hidden-gems")
async def get_hidden_gem_venues(city: str = "lagos", limit: int = 5):
    """
    Hidden Gem Hunt — mid-week only (Mon–Thu).
    Venues with score < 50 but heating_up momentum.
    Rating these earns 2.5x clout multiplier.
    Returns empty on Fri/Sat/Sun — the hunt only runs mid-week.
    """
    now = datetime.now(timezone.utc)
    weekday = now.weekday()  # 0=Mon, 6=Sun

    if weekday > 3:
        return {
            "quest_type": "hidden_gems",
            "available": False,
            "message": "Hidden Gem Hunt runs Monday to Thursday only. Check back mid-week.",
            "venues": [],
        }

    venues = await db.venues.find(
        {
            "city": city,
            "is_suppressed": {"$ne": True},
            "current_vibe_score": {"$lt": 50},
            "vibe_velocity": "heating_up",
        },
        {"_id": 0, "id": 1, "name": 1, "area": 1, "venue_type": 1,
         "current_vibe_score": 1, "vibe_velocity": 1, "coordinates": 1},
    ).to_list(limit)

    gems = [
        {
            **v,
            "clout_multiplier": 2.5,
            "quest_label": "Hidden Gem",
            "quest_description": "Low on the radar but heating up — discover it before the crowd does.",
        }
        for v in venues
    ]

    return {
        "quest_type": "hidden_gems",
        "available": True,
        "clout_multiplier": 2.5,
        "venues": gems,
        "total": len(gems),
        "instructions": "Rate any of these venues to earn 2.5x clout. Runs Mon–Thu only.",
    }


@router.get("/quests/active")
async def get_active_quests(city: str = "lagos"):
    """
    Combined active quest summary for the frontend quest panel.
    Returns both dark spots and hidden gems (if mid-week) in one call.
    """
    now = datetime.now(timezone.utc)
    weekday = now.weekday()
    cutoff = now - timedelta(hours=48)

    # Dark spots (always active)
    venues = await db.venues.find(
        {"city": city, "is_suppressed": {"$ne": True}},
        {"_id": 0, "id": 1, "name": 1, "area": 1, "current_vibe_score": 1, "coordinates": 1},
    ).to_list(200)

    dark_spot_count = 0
    for venue in venues:
        count = await db.ratings.count_documents({
            "venue_id": venue["id"],
            "timestamp": {"$gte": cutoff},
        })
        if count < 5:
            dark_spot_count += 1

    # Hidden gems (mid-week only)
    gem_count = 0
    if weekday <= 3:
        gem_count = await db.venues.count_documents({
            "city": city,
            "is_suppressed": {"$ne": True},
            "current_vibe_score": {"$lt": 50},
            "vibe_velocity": "heating_up",
        })

    quests = []
    if dark_spot_count > 0:
        quests.append({
            "id": "dark_spots",
            "title": "Pro Quest: Dark Spots",
            "description": f"{dark_spot_count} venue{'s' if dark_spot_count > 1 else ''} need intel — be first to report",
            "clout_multiplier": 3,
            "count": dark_spot_count,
            "available": True,
        })

    if weekday <= 3 and gem_count > 0:
        quests.append({
            "id": "hidden_gems",
            "title": "Hidden Gem Hunt",
            "description": f"{gem_count} spot{'s' if gem_count > 1 else ''} heating up under the radar",
            "clout_multiplier": 2.5,
            "count": gem_count,
            "available": True,
        })

    return {
        "city": city,
        "quests": quests,
        "total_active": len(quests),
    }
