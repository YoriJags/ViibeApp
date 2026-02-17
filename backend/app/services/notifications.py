"""
Vibe App - Push Notification Service
Sends notifications via Expo Push API.
"""
import httpx
from app.config import db, logger

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


async def send_push_notification(user_id: str, title: str, body: str, data: dict = None):
    """Send a push notification to a user via Expo Push API."""
    prefs = await db.alert_preferences.find_one({"user_id": user_id})
    if not prefs:
        return False

    token = prefs.get("expo_push_token")
    if not token or not token.startswith("ExponentPushToken"):
        return False

    message = {
        "to": token,
        "title": title,
        "body": body,
        "sound": "default",
    }
    if data:
        message["data"] = data

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(
                EXPO_PUSH_URL,
                json=message,
                headers={"Content-Type": "application/json"},
            )
            if response.status_code == 200:
                logger.info(f"Push sent to {user_id}: {title}")
                return True
            else:
                logger.warning(f"Push failed for {user_id}: {response.status_code}")
                return False
    except Exception as e:
        logger.error(f"Push notification error for {user_id}: {e}")
        return False


async def notify_lobby_hot(venue_id: str):
    """Notify all users who have this venue in their lobby that it went electric."""
    venue = await db.venues.find_one({"id": venue_id})
    if not venue:
        return

    venue_name = venue.get("name", "A venue")

    # Find all users with this venue in their lobby
    lobby_entries = await db.lobby.find({"venue_id": venue_id}).to_list(500)

    for entry in lobby_entries:
        user_id = entry["user_id"]

        # Check if user has lobby alerts enabled
        prefs = await db.alert_preferences.find_one({"user_id": user_id})
        if not prefs or not prefs.get("lobby_alerts", True):
            continue

        await send_push_notification(
            user_id=user_id,
            title="Your spot is on fire!",
            body=f"{venue_name} just went ELECTRIC. The vibes are real tonight.",
            data={"type": "lobby_hot", "venue_id": venue_id},
        )


async def notify_streak_expiring(user_id: str, streak_days: int):
    """Notify a user that their streak is about to expire."""
    prefs = await db.alert_preferences.find_one({"user_id": user_id})
    if not prefs or not prefs.get("streak_reminders", True):
        return

    await send_push_notification(
        user_id=user_id,
        title="Don't lose your streak!",
        body=f"Your {streak_days}-day streak expires at midnight. Rate or check in to keep it alive!",
        data={"type": "streak_expiring"},
    )


async def notify_crew_checkin(crew_id: str, member_name: str, venue_name: str):
    """Notify crew members when someone checks in."""
    crew = await db.crews.find_one({"id": crew_id})
    if not crew:
        return

    for member_id in crew.get("members", []):
        # Don't notify the person who checked in
        prefs = await db.alert_preferences.find_one({"user_id": member_id})
        if not prefs or not prefs.get("crew_alerts", True):
            continue

        await send_push_notification(
            user_id=member_id,
            title="Squad update",
            body=f"{member_name} just arrived at {venue_name}",
            data={"type": "crew_checkin", "crew_id": crew_id},
        )


async def notify_merchant_vibe_alert(venue_id: str, current_score: float, reason: str):
    """Notify merchant when their venue's Aura Shield triggers."""
    venue = await db.venues.find_one({"id": venue_id})
    if not venue:
        return

    owner_id = venue.get("owner_id")
    if not owner_id:
        return

    venue_name = venue.get("name", "Your venue")
    await send_push_notification(
        user_id=owner_id,
        title=f"Aura Shield Alert: {venue_name}",
        body=reason,
        data={"type": "aura_shield", "venue_id": venue_id, "score": current_score},
    )


async def notify_campaign_active(venue_id: str, city: str, multiplier: int):
    """Notify users who have this venue in their lobby about an active campaign."""
    venue = await db.venues.find_one({"id": venue_id})
    if not venue:
        return

    venue_name = venue.get("name", "A venue")
    lobby_entries = await db.lobby.find({"venue_id": venue_id}).to_list(500)

    for entry in lobby_entries:
        await send_push_notification(
            user_id=entry["user_id"],
            title=f"{multiplier}x Clout at {venue_name}!",
            body=f"Energy Campaign is LIVE. Rate now for {multiplier}x Clout!",
            data={"type": "campaign_active", "venue_id": venue_id},
        )
