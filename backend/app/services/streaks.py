"""
Vibe App - Streak Service
Tracks consecutive-day activity streaks and clout multipliers.
"""
from datetime import datetime, timezone
from app.config import db, logger


STREAK_MILESTONES = {
    3: {"clout": 5, "badge": None},
    7: {"clout": 15, "badge": "On Fire"},
    14: {"clout": 30, "badge": None},
    30: {"clout": 50, "badge": "Legend"},
}


def get_multiplier(streak_days: int) -> float:
    """Calculate clout multiplier from streak length. Caps at 2x at 10 days."""
    return 1.0 + min(streak_days * 0.1, 1.0)


async def update_streak(user_id: str) -> dict:
    """
    Update a user's streak after a qualifying action (rating or check-in).
    Returns streak info including whether it was extended and any milestone hit.
    """
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    streak_doc = await db.streaks.find_one({"user_id": user_id})

    if not streak_doc:
        # First ever activity - create streak
        new_streak = {
            "user_id": user_id,
            "current_streak": 1,
            "longest_streak": 1,
            "last_activity_date": today,
            "multiplier": get_multiplier(1),
            "milestones_claimed": [],
        }
        await db.streaks.insert_one(new_streak)
        return {"extended": True, "current_streak": 1, "multiplier": get_multiplier(1), "milestone": None}

    last_date = streak_doc.get("last_activity_date", "")

    if last_date == today:
        # Already active today - no change
        return {
            "extended": False,
            "current_streak": streak_doc["current_streak"],
            "multiplier": streak_doc.get("multiplier", 1.0),
            "milestone": None,
        }

    # Calculate days since last activity
    try:
        last_dt = datetime.strptime(last_date, "%Y-%m-%d")
        today_dt = datetime.strptime(today, "%Y-%m-%d")
        days_gap = (today_dt - last_dt).days
    except (ValueError, TypeError):
        days_gap = 999  # Force reset on invalid date

    if days_gap == 1:
        # Consecutive day - extend streak
        new_count = streak_doc["current_streak"] + 1
    elif days_gap == 2:
        # One day missed — check for a streak freeze
        user_doc = await db.users.find_one({"id": user_id}, {"streak_freezes": 1})
        freezes_left = (user_doc or {}).get("streak_freezes", 0)
        if freezes_left > 0:
            # Consume one freeze, preserve streak
            await db.users.update_one({"id": user_id}, {"$inc": {"streak_freezes": -1}})
            new_count = streak_doc["current_streak"]
            logger.info(f"Streak freeze consumed for {user_id} — streak preserved at {new_count}")
        else:
            new_count = 1
    else:
        # Gap too large — reset to 1 regardless
        new_count = 1

    longest = max(streak_doc.get("longest_streak", 0), new_count)
    multiplier = get_multiplier(new_count)

    # Check for milestone
    milestone_hit = None
    milestones_claimed = streak_doc.get("milestones_claimed", [])
    if new_count in STREAK_MILESTONES and new_count not in milestones_claimed:
        milestone_hit = STREAK_MILESTONES[new_count]
        milestones_claimed.append(new_count)

        # Award milestone clout
        await db.users.update_one(
            {"id": user_id},
            {"$inc": {"clout_points": milestone_hit["clout"]}},
        )
        logger.info(f"Streak milestone {new_count} for user {user_id}: +{milestone_hit['clout']} clout")

    await db.streaks.update_one(
        {"user_id": user_id},
        {"$set": {
            "current_streak": new_count,
            "longest_streak": longest,
            "last_activity_date": today,
            "multiplier": multiplier,
            "milestones_claimed": milestones_claimed,
        }},
    )

    return {
        "extended": new_count > 1 or days_gap == 1,
        "current_streak": new_count,
        "multiplier": multiplier,
        "milestone": milestone_hit,
    }


async def get_streak(user_id: str) -> dict:
    """Get a user's current streak data."""
    streak_doc = await db.streaks.find_one({"user_id": user_id}, {"_id": 0})

    if not streak_doc:
        return {
            "current_streak": 0,
            "longest_streak": 0,
            "multiplier": 1.0,
            "last_activity_date": None,
            "milestones_claimed": [],
            "next_milestone": 3,
            "next_milestone_clout": 5,
        }

    # Check if streak is still active (last activity was today or yesterday)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    last_date = streak_doc.get("last_activity_date", "")

    try:
        last_dt = datetime.strptime(last_date, "%Y-%m-%d")
        today_dt = datetime.strptime(today, "%Y-%m-%d")
        days_gap = (today_dt - last_dt).days
    except (ValueError, TypeError):
        days_gap = 999

    current = streak_doc.get("current_streak", 0)
    if days_gap > 1:
        # Streak has expired but not yet reset (will reset on next action)
        current = 0

    # Find next milestone
    next_milestone = None
    next_milestone_clout = None
    for m in sorted(STREAK_MILESTONES.keys()):
        if m > current:
            next_milestone = m
            next_milestone_clout = STREAK_MILESTONES[m]["clout"]
            break

    return {
        "current_streak": current,
        "longest_streak": streak_doc.get("longest_streak", 0),
        "multiplier": get_multiplier(current) if current > 0 else 1.0,
        "last_activity_date": last_date,
        "milestones_claimed": streak_doc.get("milestones_claimed", []),
        "next_milestone": next_milestone,
        "next_milestone_clout": next_milestone_clout,
    }
