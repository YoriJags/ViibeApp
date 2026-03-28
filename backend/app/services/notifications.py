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


async def notify_achievement_unlocked(user_id: str, badge_name: str, badge_description: str, badge_emoji: str = "🏆"):
    """Push + email when a scout unlocks an achievement badge."""
    # Push notification
    await send_push_notification(
        user_id=user_id,
        title=f"{badge_emoji} Badge Unlocked: {badge_name}",
        body=badge_description,
        data={"type": "achievement_unlocked", "badge": badge_name},
    )

    # Email notification (fire-and-forget)
    user = await db.users.find_one({"id": user_id})
    if user and user.get("email"):
        from app.services.email import send_achievement_email
        await send_achievement_email(
            user_email=user["email"],
            user_name=user.get("username", "Scout"),
            badge_name=badge_name,
            badge_description=badge_description,
            badge_emoji=badge_emoji,
        )


async def notify_vibe_spike(venue_id: str, new_score: float, vibe_label: str):
    """Notify scouts whose Vibe DNA matches a venue type when that venue score spikes."""
    venue = await db.venues.find_one({"id": venue_id})
    if not venue:
        return

    venue_name = venue.get("name", "A venue")
    venue_type = venue.get("category", "club")  # e.g. 'club', 'lounge', 'restaurant'

    # Find users whose top DNA affinity matches this venue type + have nearby_alerts on
    # Using a simple heuristic: users who have rated this venue type most
    prefs_with_token = await db.alert_preferences.find(
        {"expo_push_token": {"$exists": True, "$ne": ""}, "nearby_alerts": True}
    ).to_list(500)

    for pref in prefs_with_token:
        user_id = pref["user_id"]

        # Check if user has rated this venue type before (simple proxy for affinity)
        rating_count = await db.ratings.count_documents({
            "user_id": user_id,
            "venue_type": venue_type,
        })
        if rating_count < 2:
            continue  # Not enough affinity signal

        await send_push_notification(
            user_id=user_id,
            title=f"{venue_name} is {vibe_label}!",
            body=f"Your kind of vibe is live right now.",
            data={"type": "vibe_spike", "venue_id": venue_id, "score": new_score},
        )


async def notify_moment_locked(venue_id: str, venue_name: str, participant_count: int):
    """
    Notify users near a venue when a Moment Locks.

    Target audience — users most likely to be physically nearby:
      1. Users who have checked into this venue in the last 7 days
      2. Users who have this venue in their lobby
    De-duped. Respects nearby_alerts preference.
    Capped at 200 recipients to avoid notification spam at large venues.

    Message is intentional FOMO: short, real, no fluff.
    """
    from datetime import timedelta
    now    = __import__('datetime').datetime.now(__import__('datetime').timezone.utc)
    cutoff = now - timedelta(days=7)

    # Gather candidate user IDs from both sources
    checkin_ids = {
        e["user_id"]
        async for e in db.checkins.find(
            {"venue_id": venue_id, "timestamp": {"$gte": cutoff}},
            {"user_id": 1},
        )
    }
    lobby_ids = {
        e["user_id"]
        async for e in db.lobby.find({"venue_id": venue_id}, {"user_id": 1})
    }
    candidate_ids = list(checkin_ids | lobby_ids)[:200]

    sent = 0
    for user_id in candidate_ids:
        prefs = await db.alert_preferences.find_one({"user_id": user_id})
        if not prefs or not prefs.get("nearby_alerts", True):
            continue
        token = prefs.get("expo_push_token", "")
        if not token.startswith("ExponentPushToken"):
            continue

        # Vary the copy slightly so it doesn't feel templated
        body = (
            f"Something just happened at {venue_name}."
            if participant_count < 10
            else f"{participant_count} scouts felt it simultaneously at {venue_name}."
        )

        success = await send_push_notification(
            user_id=user_id,
            title="⚡ MOMENT LOCKED",
            body=body,
            data={
                "type":              "moment_locked",
                "venue_id":          venue_id,
                "participant_count": participant_count,
            },
        )
        if success:
            sent += 1

    logger.info(f"moment_locked push — venue={venue_id} sent={sent}/{len(candidate_ids)}")


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
