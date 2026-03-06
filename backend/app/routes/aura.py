"""
Scout Aura — Personal influence level for public scouts.

Aura reflects a scout's real-world scene footprint:
  check-ins (depth), ratings (quality), bolt contributions (energy),
  streak (consistency), crew size (social reach).

Levels:
  Shadow Scout  (0–15)   — Just getting started
  Rising Scout  (16–40)  — Making moves
  Scene Maker   (41–100) — Recognized presence
  Hot Scout     (101–200)— They know who you are
  VIBE GOD      (201+)   — Top of the city (top 1% enforced)

Routes:
  GET /api/me/aura          — Current user's aura (authenticated)
  GET /api/users/:id/aura   — Any user's public aura
"""
from fastapi import APIRouter, Depends, HTTPException
from app.config import db
from app.services.auth import require_auth

router = APIRouter(tags=["aura"])

LEVELS = [
    (0,   15,  "shadow",     "Shadow Scout", "👤", "#555566"),
    (16,  40,  "rising",     "Rising Scout", "⚡", "#3399FF"),
    (41,  100, "scene_maker","Scene Maker",  "🎯", "#9933FF"),
    (101, 200, "hot",        "Hot Scout",    "🔥", "#FF9933"),
    (201, 999999, "vibe_god","VIBE GOD",     "👑", "#FF3366"),
]

PERKS = {
    "shadow":     ["Explore the scene", "Drop bolt taps", "Rate venues"],
    "rising":     ["Crew invite access", "Priority radar visibility", "+10% clout on ratings"],
    "scene_maker":["Venue insider previews", "Scene Maker badge on profile", "+20% clout"],
    "hot":        ["Merchant perk unlocks (VIP queue)", "Hot Scout crown on map", "+30% clout"],
    "vibe_god":   ["City-wide Aura glow", "VIBE GOD on leaderboard", "Permanent +50% clout boost"],
}

async def _compute_aura(user_id: str) -> dict:
    checkin_count = await db.checkins.count_documents({"user_id": user_id})
    rating_count  = await db.ratings.count_documents({"user_id": user_id})
    bolt_count    = await db.venue_bolts.count_documents({"user_id": user_id})
    streak_doc    = await db.streaks.find_one({"user_id": user_id}) or {}
    streak_days   = streak_doc.get("current_streak", 0)
    crew          = await db.crews.find_one({"member_ids": user_id}) or {}
    crew_size     = len(crew.get("member_ids", [])) if crew else 0

    score = round(checkin_count * 3 + rating_count * 2 + bolt_count * 1 + streak_days * 1.5 + crew_size * 0.5)

    level_row = LEVELS[0]
    for row in LEVELS:
        if score >= row[0]:
            level_row = row
    lo, hi, lv, lbl, icon, color = level_row
    level_idx = LEVELS.index(level_row)
    next_row = LEVELS[min(level_idx + 1, len(LEVELS) - 1)]
    points_to_next = max(0, next_row[0] - score) if lv != "vibe_god" else 0
    progress = round((score - lo) / (hi - lo), 3) if (hi - lo) > 0 else 1.0

    return {
        "aura_score": score,
        "aura_level": lv,
        "aura_label": lbl,
        "aura_icon": icon,
        "aura_color": color,
        "aura_progress": min(progress, 1.0),
        "points_to_next": points_to_next,
        "next_level_label": next_row[3] if lv != "vibe_god" else None,
        "checkin_count": checkin_count,
        "rating_count": rating_count,
        "bolt_count": bolt_count,
        "streak_days": streak_days,
        "crew_size": crew_size,
        "perks": PERKS.get(lv, []),
    }

@router.get("/me/aura")
async def get_my_aura(user: dict = Depends(require_auth)):
    return await _compute_aura(user["id"])

@router.get("/users/{user_id}/aura")
async def get_user_aura(user_id: str):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return await _compute_aura(user_id)
