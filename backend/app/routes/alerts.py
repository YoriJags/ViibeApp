"""
Vibe App - Alert Routes
Push notification token registration and preference management.
"""
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends

from app.config import db
from app.models import AlertRegister, AlertPreferences
from app.services.auth import require_auth

router = APIRouter(tags=["alerts"])


@router.post("/alerts/register")
async def register_push_token(data: AlertRegister, user: dict = Depends(require_auth)):
    """Register an Expo push notification token."""
    if not data.expo_push_token.startswith("ExponentPushToken"):
        raise HTTPException(status_code=400, detail="Invalid Expo push token format")

    await db.alert_preferences.update_one(
        {"user_id": user["id"]},
        {
            "$set": {
                "expo_push_token": data.expo_push_token,
                "updated_at": datetime.now(timezone.utc),
            },
            "$setOnInsert": {
                "user_id": user["id"],
                "lobby_alerts": True,
                "streak_reminders": True,
                "crew_alerts": True,
                "nearby_alerts": False,
                "created_at": datetime.now(timezone.utc),
            },
        },
        upsert=True,
    )

    return {"message": "Push token registered"}


@router.put("/alerts/preferences")
async def update_preferences(data: AlertPreferences, user: dict = Depends(require_auth)):
    """Update notification preferences."""
    await db.alert_preferences.update_one(
        {"user_id": user["id"]},
        {
            "$set": {
                "lobby_alerts": data.lobby_alerts,
                "streak_reminders": data.streak_reminders,
                "crew_alerts": data.crew_alerts,
                "nearby_alerts": data.nearby_alerts,
                "updated_at": datetime.now(timezone.utc),
            },
        },
    )

    return {"message": "Preferences updated"}


@router.get("/alerts/preferences")
async def get_preferences(user: dict = Depends(require_auth)):
    """Get current notification preferences."""
    prefs = await db.alert_preferences.find_one(
        {"user_id": user["id"]},
        {"_id": 0},
    )

    if not prefs:
        return {
            "lobby_alerts": True,
            "streak_reminders": True,
            "crew_alerts": True,
            "nearby_alerts": False,
            "registered": False,
        }

    prefs["registered"] = bool(prefs.get("expo_push_token"))
    return prefs
