"""
Tonight's Heat — nightly Scout Heat score. Resets each night at 5AM.

Heat is about what you did TONIGHT, not your career history.
Every night is a clean slate. Anyone can be On Fire.

Levels:
  Cold     (0 pts)  — Not out yet tonight
  Warming  (1-9)    — You showed up
  Hot      (10-24)  — You're moving
  On Fire  (25+)    — The scene feels you

Also tracks: hot_nights (career count of nights where user reached Hot or above).
"47 Hot Nights" is your honest, unfakeable reputation.

Routes:
  GET /api/me/aura          — Current user's heat (authenticated)
  GET /api/users/:id/aura   — Any user's public heat
"""
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from app.config import db
from app.services.auth import require_auth

router = APIRouter(tags=["aura"])

HEAT_LEVELS = [
    (0,  0,   "cold",     "Cold",     "#3A3A4E"),
    (1,  9,   "warming",  "Warming",  "#6655FF"),
    (10, 24,  "hot",      "Hot",      "#FF9933"),
    (25, 9999, "on_fire", "On Fire",  "#FF3366"),
]


def _night_window() -> datetime:
    """Returns the start of the current nightlife night (5PM rolling window).
    Night runs from 5PM until 7AM the next day.
    If it's before 7AM, the night started yesterday at 5PM.
    """
    now = datetime.now(timezone.utc)
    if now.hour < 7:
        # Early hours (midnight–7AM): night started yesterday at 5PM
        yesterday = now - timedelta(days=1)
        return yesterday.replace(hour=17, minute=0, second=0, microsecond=0)
    else:
        return now.replace(hour=17, minute=0, second=0, microsecond=0)


async def _compute_heat(user_id: str) -> dict:
    night_start = _night_window()

    # Tonight's activity counts
    checkins_tonight = await db.checkins.count_documents({
        "user_id": user_id,
        "created_at": {"$gte": night_start},
    })
    ratings_tonight = await db.ratings.count_documents({
        "user_id": user_id,
        "created_at": {"$gte": night_start},
    })
    bolts_tonight = await db.venue_bolts.count_documents({
        "user_id": user_id,
        "created_at": {"$gte": night_start},
    })

    heat_score = checkins_tonight * 5 + ratings_tonight * 4 + bolts_tonight * 1

    # Determine level
    level_row = HEAT_LEVELS[0]
    for row in HEAT_LEVELS:
        if heat_score >= row[0]:
            level_row = row
    lo, hi, lv, lbl, color = level_row

    level_idx = [r[2] for r in HEAT_LEVELS].index(lv)
    next_row = HEAT_LEVELS[min(level_idx + 1, len(HEAT_LEVELS) - 1)]

    if lv == "on_fire":
        progress = 1.0
        pts_to_next = 0
        next_label = None
    else:
        pts_to_next = next_row[0] - heat_score
        span = next_row[0] - lo
        progress = round((heat_score - lo) / span, 3) if span > 0 else 0.0
        next_label = next_row[3]

    # Hot Nights: track nights where user reached Hot or On Fire
    user_doc = await db.users.find_one({"id": user_id}, {"hot_nights": 1}) or {}
    hot_nights_count = user_doc.get("hot_nights", 0)

    if lv in ("hot", "on_fire"):
        already_logged = await db.hot_night_log.find_one({
            "user_id": user_id,
            "night_start": night_start,
        })
        if not already_logged:
            await db.hot_night_log.insert_one({
                "user_id": user_id,
                "night_start": night_start,
                "level_reached": lv,
            })
            await db.users.update_one(
                {"id": user_id},
                {"$inc": {"hot_nights": 1}},
            )
            hot_nights_count += 1

    # Streak still tracked separately
    streak_doc = await db.streaks.find_one({"user_id": user_id}) or {}
    streak_days = streak_doc.get("current_streak", 0)

    return {
        "heat_score": heat_score,
        "heat_level": lv,
        "heat_label": lbl,
        "heat_color": color,
        "heat_progress": min(progress, 1.0),
        "pts_to_next": pts_to_next,
        "next_level_label": next_label,
        "checkins_tonight": checkins_tonight,
        "ratings_tonight": ratings_tonight,
        "bolts_tonight": bolts_tonight,
        "hot_nights": hot_nights_count,
        "streak_days": streak_days,
        # Backwards-compat keys (ScoutAuraChip reads these)
        "aura_level": lv,
        "aura_label": lbl,
        "aura_color": color,
        "aura_progress": min(progress, 1.0),
    }


@router.get("/me/aura")
async def get_my_aura(user: dict = Depends(require_auth)):
    return await _compute_heat(user["id"])


@router.get("/users/{user_id}/aura")
async def get_user_aura(user_id: str):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return await _compute_heat(user_id)
