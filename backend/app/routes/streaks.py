"""
Vibe App - Streak Routes
View streak data, leaderboard, and streak freeze management.
"""
from fastapi import APIRouter, Depends, HTTPException

from app.config import db
from app.services.auth import require_auth
from app.services.streaks import get_streak

router = APIRouter(tags=["streaks"])


@router.get("/streaks/me")
async def get_my_streak(user: dict = Depends(require_auth)):
    """Get the current user's streak data."""
    streak = await get_streak(user["id"])
    return streak


FREEZE_COST_CLOUT = 100   # clout points per freeze
FREEZE_MAX_HELD = 3       # max freezes a scout can hold at once


@router.post("/streaks/freeze/purchase")
async def purchase_streak_freeze(user: dict = Depends(require_auth)):
    """
    Spend 100 clout to buy a Streak Freeze.
    Freeze is consumed automatically when a 1-day gap is detected.
    Max 3 freezes held at once.
    """
    user_doc = await db.users.find_one({"id": user["id"]}, {"clout_points": 1, "streak_freezes": 1})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")

    current_freezes = user_doc.get("streak_freezes", 0)
    if current_freezes >= FREEZE_MAX_HELD:
        raise HTTPException(status_code=400, detail=f"Already holding maximum {FREEZE_MAX_HELD} freezes")

    clout = user_doc.get("clout_points", 0)
    if clout < FREEZE_COST_CLOUT:
        raise HTTPException(status_code=402, detail=f"Need {FREEZE_COST_CLOUT} clout — you have {clout}")

    await db.users.update_one(
        {"id": user["id"]},
        {"$inc": {"clout_points": -FREEZE_COST_CLOUT, "streak_freezes": 1}},
    )
    return {
        "success": True,
        "freezes_held": current_freezes + 1,
        "clout_spent": FREEZE_COST_CLOUT,
        "clout_remaining": clout - FREEZE_COST_CLOUT,
    }


@router.get("/streaks/leaderboard")
async def get_streak_leaderboard():
    """Get top 10 longest active streaks."""
    streaks = await db.streaks.find(
        {"current_streak": {"$gte": 1}},
        {"_id": 0},
    ).sort("current_streak", -1).to_list(10)

    leaderboard = []
    for i, s in enumerate(streaks):
        user = await db.users.find_one(
            {"id": s["user_id"]},
            {"_id": 0, "username": 1, "scout_status": 1, "picture": 1},
        )
        leaderboard.append({
            "rank": i + 1,
            "username": user.get("username", "Unknown") if user else "Unknown",
            "scout_status": user.get("scout_status", "newbie") if user else "newbie",
            "current_streak": s["current_streak"],
            "longest_streak": s.get("longest_streak", 0),
            "multiplier": s.get("multiplier", 1.0),
        })

    return {"leaderboard": leaderboard}
