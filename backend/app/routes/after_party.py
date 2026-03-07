"""
AfterParty Mode — Post-night debrief for scouts.

Aggregates tonight's checkins, ratings, bolts, aura peak, and top venue
into a "Your Night" summary. Triggered when a scout winds down.

Night window: 5PM → 7AM (same as aura.py).

Routes:
  GET /me/night-recap   — authenticated user's tonight summary
"""
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends
from app.config import db
from app.services.auth import require_auth

router = APIRouter(tags=["after_party"])


def _night_start() -> datetime:
    now = datetime.now(timezone.utc)
    if now.hour < 7:
        base = now - timedelta(days=1)
    else:
        base = now
    return base.replace(hour=17, minute=0, second=0, microsecond=0)


@router.get("/me/night-recap")
async def get_night_recap(user: dict = Depends(require_auth)):
    user_id = user["id"]
    night_start = _night_start()

    # Tonight's counts
    checkins_tonight = await db.checkins.count_documents({
        "user_id": user_id, "created_at": {"$gte": night_start},
    })
    ratings_tonight = await db.ratings.count_documents({
        "user_id": user_id, "created_at": {"$gte": night_start},
    })

    # Bolts by venue tonight
    bolt_pipeline = [
        {"$match": {"user_id": user_id, "created_at": {"$gte": night_start}}},
        {"$group": {"_id": "$venue_id", "tap_count": {"$sum": 1}}},
        {"$sort": {"tap_count": -1}},
    ]
    bolt_docs = await db.venue_bolts.aggregate(bolt_pipeline).to_list(20)
    bolts_tonight = sum(d["tap_count"] for d in bolt_docs)

    # Most tapped venue tonight
    top_venue = None
    if bolt_docs:
        v = await db.venues.find_one({"id": bolt_docs[0]["_id"]}, {"name": 1, "area": 1, "energy_level": 1})
        if v:
            top_venue = {
                "venue_id": bolt_docs[0]["_id"],
                "venue_name": v["name"],
                "venue_area": v.get("area", ""),
                "energy_level": v.get("energy_level", "chill"),
                "tap_count": bolt_docs[0]["tap_count"],
            }

    # Venues visited (from checkins)
    checkin_docs = await db.checkins.find(
        {"user_id": user_id, "created_at": {"$gte": night_start}},
        {"venue_id": 1, "venue_name": 1},
    ).to_list(20)
    venues_visited = list({d["venue_id"]: d.get("venue_name", "Unknown") for d in checkin_docs}.items())

    # Aura peak tonight (heat score)
    heat_score = checkins_tonight * 5 + ratings_tonight * 4 + bolts_tonight * 1
    HEAT_LEVELS = [
        (0,  0,   "cold",    "Cold",     "#3A3A4E"),
        (1,  9,   "warming", "Warming",  "#6655FF"),
        (10, 24,  "hot",     "Hot",      "#FF9933"),
        (25, 9999, "on_fire","On Fire",  "#FF3366"),
    ]
    level_row = HEAT_LEVELS[0]
    for row in HEAT_LEVELS:
        if heat_score >= row[0]:
            level_row = row
    _, _, heat_level, heat_label, heat_color = level_row

    # Streak
    streak_doc = await db.streaks.find_one({"user_id": user_id}) or {}
    streak_days = streak_doc.get("current_streak", 0)

    # Hot nights career total
    user_doc = await db.users.find_one({"id": user_id}, {"hot_nights": 1}) or {}
    hot_nights = user_doc.get("hot_nights", 0)

    return {
        "checkins_tonight": checkins_tonight,
        "ratings_tonight": ratings_tonight,
        "bolts_tonight": bolts_tonight,
        "venues_visited": [{"id": vid, "name": name} for vid, name in venues_visited],
        "top_venue": top_venue,
        "heat_score": heat_score,
        "heat_level": heat_level,
        "heat_label": heat_label,
        "heat_color": heat_color,
        "streak_days": streak_days,
        "hot_nights": hot_nights,
        "is_hot_night": heat_level in ("hot", "on_fire"),
        "night_start": night_start.isoformat(),
    }
