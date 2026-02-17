"""
Vibe App - Streak Routes
View streak data and streak leaderboard.
"""
from fastapi import APIRouter, Depends

from app.config import db
from app.services.auth import require_auth
from app.services.streaks import get_streak

router = APIRouter(tags=["streaks"])


@router.get("/streaks/me")
async def get_my_streak(user: dict = Depends(require_auth)):
    """Get the current user's streak data."""
    streak = await get_streak(user["id"])
    return streak


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
