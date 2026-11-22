"""
Vibe App - Push Notification Service
Sends notifications via Expo Push API.

Where a phone's token lives: the app registers it at PUT /users/me/push-token,
which writes users.push_token (and mirrors it into alert_preferences). Every
sender looks it up through push_token_for / push_tokens_for, so no push depends
on a collection nothing writes to.
"""
from datetime import datetime, timedelta, timezone

import httpx
from app.config import db, logger

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
DEMO_PREFIX = "demo-scout-"


def _valid(token) -> bool:
    return isinstance(token, str) and token.startswith("ExponentPushToken")


async def push_token_for(user_id: str) -> str | None:
    """The user's Expo token: alert preferences first, then the user record."""
    if not user_id or str(user_id).startswith(DEMO_PREFIX):
        return None
    prefs = await db.alert_preferences.find_one({"user_id": user_id}, {"expo_push_token": 1})
    if prefs and _valid(prefs.get("expo_push_token")):
        return prefs["expo_push_token"]
    user = await db.users.find_one({"id": user_id}, {"push_token": 1})
    return user["push_token"] if user and _valid(user.get("push_token")) else None


async def push_tokens_for(user_ids: list[str]) -> list[str]:
    """Tokens for many users at once, one per user, demo accounts skipped."""
    ids = [u for u in dict.fromkeys(user_ids) if u and not str(u).startswith(DEMO_PREFIX)]
    if not ids:
        return []
    found: dict[str, str] = {}
    async for p in db.alert_preferences.find({"user_id": {"$in": ids}}, {"user_id": 1, "expo_push_token": 1}):
        if _valid(p.get("expo_push_token")):
            found[p["user_id"]] = p["expo_push_token"]
    missing = [u for u in ids if u not in found]
    if missing:
        async for u in db.users.find({"id": {"$in": missing}}, {"id": 1, "push_token": 1}):
            if _valid(u.get("push_token")):
                found[u["id"]] = u["push_token"]
    return list(dict.fromkeys(found.values()))


def night_key(now: datetime | None = None) -> str:
    """The Lagos night a moment belongs to: noon to noon, so 2am counts as last night."""
    now = now or datetime.now(timezone.utc)
    return (now + timedelta(hours=1) - timedelta(hours=12)).strftime("%Y-%m-%d")


async def first_time(key: str) -> bool:
    """True the first time a key is seen; every later call is False. Stops repeat pushes."""
    try:
        if await db.push_log.find_one({"key": key}):
            return False
        # The unique index on key (app/config.py) makes a racing second insert fail.
        await db.push_log.insert_one({"key": key, "at": datetime.now(timezone.utc)})
        return True
    except Exception:
        return False


async def send_push_notification(user_id: str, title: str, body: str, data: dict = None):
    """Send a push notification to a user via Expo Push API."""
    token = await push_token_for(user_id)
    if not token:
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


async def _allowed(user_id: str, pref: str) -> bool:
    """A user hears this kind of push unless they turned it off (default on)."""
    prefs = await db.alert_preferences.find_one({"user_id": user_id}, {pref: 1})
    return not prefs or prefs.get(pref, True) is not False


async def _watchers(venue_id: str) -> set[str]:
    """People with an alert on this venue; transitions.py already tells them."""
    rows = await db.venue_alerts.find({"venue_id": venue_id}, {"user_id": 1}).to_list(1000)
    return {r["user_id"] for r in rows if r.get("user_id")}


async def notify_lobby_hot(venue_id: str):
    """
    Tell the people who saved this venue to their lobby that it just hit Peak.
    Once per person per venue per night; people with an alert on the venue are
    skipped because the transition push already told them.
    """
    venue = await db.venues.find_one({"id": venue_id})
    if not venue:
        return
    venue_name = venue.get("name", "A venue")
    night = night_key()
    skip = await _watchers(venue_id)
    lobby_entries = await db.lobby.find({"venue_id": venue_id}).to_list(500)
    for entry in lobby_entries:
        user_id = entry.get("user_id")
        if not user_id or user_id in skip or not await _allowed(user_id, "lobby_alerts"):
            continue
        if not await first_time(f"peak:{user_id}:{venue_id}:{night}"):
            continue
        await send_push_notification(
            user_id=user_id,
            title=f"{venue_name} just hit Peak",
            body="One of your saved spots is at its best right now, from scouts in the room.",
            data={"type": "lobby_hot", "venue_id": venue_id},
        )


async def notify_streak_expiring(user_id: str, streak_days: int):
    """Tell a user their streak ends tonight unless they rate or check in. Once per night."""
    if not await _allowed(user_id, "streak_reminders"):
        return
    if not await first_time(f"streak:{user_id}:{night_key()}"):
        return
    await send_push_notification(
        user_id=user_id,
        title=f"Your {streak_days}-night streak ends tonight",
        body="Rate a room or check in tonight to keep it.",
        data={"type": "streak_expiring"},
    )


async def streak_reminder_pass(now: datetime | None = None) -> int:
    """
    At 8pm Lagos: everyone with a streak of 2 or more who was active yesterday
    but not yet today hears that it ends tonight. Streak days are UTC dates
    (services/streaks.py). Returns how many were considered.
    """
    now = now or datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    yesterday = (now - timedelta(days=1)).strftime("%Y-%m-%d")
    rows = await db.streaks.find(
        {"current_streak": {"$gte": 2}, "last_activity_date": yesterday,
         "user_id": {"$not": {"$regex": f"^{DEMO_PREFIX}"}}},
        {"user_id": 1, "current_streak": 1},
    ).to_list(5000)
    for r in rows:
        if r.get("last_activity_date") == today:
            continue
        await notify_streak_expiring(r["user_id"], r["current_streak"])
    return len(rows)


async def streak_reminder_loop():
    """Checks every 10 minutes; sends during the 8pm Lagos hour (first_time stops repeats)."""
    import asyncio
    while True:
        try:
            lagos_hour = (datetime.now(timezone.utc) + timedelta(hours=1)).hour
            if lagos_hour == 20:
                await streak_reminder_pass()
        except Exception as e:
            logger.warning(f"streak reminder pass failed: {e}")
        await asyncio.sleep(600)


async def notify_crew_checkin(crew_id: str, member_id: str, member_name: str, venue_id: str, venue_name: str):
    """Tell the rest of the crew when one of them arrives somewhere. Once per member per venue per night."""
    crew = await db.crews.find_one({"id": crew_id})
    if not crew:
        return
    if not await first_time(f"crew:{crew_id}:{member_id}:{venue_id}:{night_key()}"):
        return
    for other in crew.get("members", []):
        if other == member_id or not await _allowed(other, "crew_alerts"):
            continue
        await send_push_notification(
            user_id=other,
            title=f"{crew.get('name') or 'Your crew'}",
            body=f"{member_name} just arrived at {venue_name}",
            data={"type": "crew_checkin", "crew_id": crew_id, "venue_id": venue_id},
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
        data={"type": "score_alert", "venue_id": venue_id, "score": current_score},
    )


async def notify_achievement_unlocked(user_id: str, badge_name: str, badge_description: str, badge_emoji: str = "🏆"):
    """Push + email when a scout unlocks an achievement badge. Once per badge."""
    if str(user_id).startswith(DEMO_PREFIX) or not await first_time(f"badge:{user_id}:{badge_name}"):
        return
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
    """
    When a venue hits Peak, tell people who keep rating that kind of room
    (two or more ratings at venues of the same type in the last 30 days).
    At most one of these per person per night; people who watch or saved
    this venue are skipped, the other pushes already reached them.
    """
    venue = await db.venues.find_one({"id": venue_id})
    if not venue:
        return
    venue_name = venue.get("name", "A venue")
    venue_type = venue.get("venue_type") or "club"
    city = venue.get("city", "lagos")
    since = datetime.now(timezone.utc) - timedelta(days=30)

    same_type = [v["id"] async for v in db.venues.find({"venue_type": venue_type, "city": city}, {"id": 1})]
    pipeline = [
        {"$match": {"venue_id": {"$in": same_type}, "timestamp": {"$gte": since},
                    "user_id": {"$not": {"$regex": f"^{DEMO_PREFIX}"}}}},
        {"$group": {"_id": "$user_id", "n": {"$sum": 1}}},
        {"$match": {"n": {"$gte": 2}}},
        {"$limit": 300},
    ]
    fans = [r["_id"] async for r in db.ratings.aggregate(pipeline)]
    skip = await _watchers(venue_id) | {e["user_id"] for e in await db.lobby.find({"venue_id": venue_id}, {"user_id": 1}).to_list(1000)}
    night = night_key()
    for user_id in fans:
        if user_id in skip or not await _allowed(user_id, "nearby_alerts"):
            continue
        if not await first_time(f"spike:{user_id}:{night}"):
            continue
        await send_push_notification(
            user_id=user_id,
            title=f"{venue_name} is {vibe_label.title()}",
            body="Your kind of room is at its best right now.",
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
            {"venue_id": venue_id, "created_at": {"$gte": cutoff}},
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
        if not await _allowed(user_id, "nearby_alerts"):
            continue

        # Vary the copy slightly so it doesn't feel templated
        body = (
            f"Something just went off at {venue_name}."
            if participant_count < 10
            else f"{participant_count} people felt it at once at {venue_name}."
        )

        success = await send_push_notification(
            user_id=user_id,
            title=f"Viibe at {venue_name}",
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
