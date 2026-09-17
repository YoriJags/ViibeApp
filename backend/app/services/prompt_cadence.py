"""
Prompt cadence: how often VIIBE asks, once it knows you are in a room.

The staleness problem was never that people refuse to update a reading. It is
that nobody remembers to. Asking someone to remember is asking them to do work,
and this must never feel like work.

So the app asks. Once the geofence confirms a scout is actually inside a venue,
a rhythm starts, and the scout picks that rhythm once and never thinks about it
again. Being asked at the right moment costs two seconds. Remembering to do it
costs attention all night, which is the expensive thing.

Four guards stop a helpful rhythm becoming a nuisance, because an app that
nags gets its notifications turned off and then it has nothing:

  1. **Only inside.** No check-in, no prompts. Reading a room you left is
     exactly the stale data this exists to prevent.
  2. **Never during the settle.** A scout who just read the room is not asked
     again until their reading is actually going stale.
  3. **Capped per night.** However tight the cadence, there is a ceiling. The
     scout is a person having a night out, not a sensor.
  4. **Off is a real option.** It is a setting, not a dark pattern.
"""
from datetime import datetime, timedelta, timezone

# What a scout chooses between. Minutes between prompts while they are in a room.
CADENCE_OPTIONS = {
    "often":  20,    # for a room that is moving fast
    "normal": 35,    # the default
    "rare":   60,    # a light touch
    "off":    None,  # never ask, and mean it
}

DEFAULT_CADENCE = "normal"

# Hard ceiling per venue per night, whatever the cadence says.
MAX_PROMPTS_PER_NIGHT = 6

# A reading is not stale the moment it lands. Never prompt inside this window,
# even on the tightest cadence.
MIN_MINUTES_AFTER_READING = 12


def cadence_minutes(cadence: str | None) -> int | None:
    """Minutes for a cadence key. Unknown values fall back to the default,
    never to the most aggressive option."""
    if cadence == "off":
        return None
    return CADENCE_OPTIONS.get(cadence or DEFAULT_CADENCE, CADENCE_OPTIONS[DEFAULT_CADENCE])


def minutes_until_due(last_reading_at: datetime | None,
                      cadence: str | None,
                      now: datetime | None = None) -> float | None:
    """
    Minutes until this scout should next be asked. None when they never should.

    A scout who has not read this venue at all is due immediately: they are
    standing in a room we know nothing about, which is the most valuable
    reading available anywhere on the map.
    """
    minutes = cadence_minutes(cadence)
    if minutes is None:
        return None
    if last_reading_at is None:
        return 0.0

    now = now or datetime.now(timezone.utc)
    if last_reading_at.tzinfo is None:
        last_reading_at = last_reading_at.replace(tzinfo=timezone.utc)

    elapsed = (now - last_reading_at).total_seconds() / 60
    wait = max(minutes, MIN_MINUTES_AFTER_READING)
    return max(0.0, wait - elapsed)


def is_prompt_due(last_reading_at: datetime | None,
                  cadence: str | None,
                  is_checked_in: bool,
                  prompts_tonight: int = 0,
                  now: datetime | None = None) -> bool:
    """All four guards, in one call."""
    if not is_checked_in:
        return False
    if cadence == "off":
        return False
    try:
        used = int(prompts_tonight or 0)
    except (TypeError, ValueError):
        used = 0
    if used >= MAX_PROMPTS_PER_NIGHT:
        return False

    remaining = minutes_until_due(last_reading_at, cadence, now)
    return remaining is not None and remaining <= 0


def prompt_plan(last_reading_at: datetime | None,
                cadence: str | None,
                is_checked_in: bool,
                prompts_tonight: int = 0,
                now: datetime | None = None) -> dict:
    """
    Everything the app needs to run the rhythm itself, in one payload, so the
    client does not have to poll or reimplement any of these rules.
    """
    minutes = cadence_minutes(cadence)
    due = is_prompt_due(last_reading_at, cadence, is_checked_in, prompts_tonight, now)
    remaining = minutes_until_due(last_reading_at, cadence, now)

    if not is_checked_in:
        reason = "not in a venue"
    elif cadence == "off":
        reason = "prompts are off"
    elif (prompts_tonight or 0) >= MAX_PROMPTS_PER_NIGHT:
        reason = "enough for tonight"
    elif due:
        reason = "your reading is going stale"
    else:
        reason = "reading is still fresh"

    return {
        "due": due,
        "cadence": cadence or DEFAULT_CADENCE,
        "cadence_minutes": minutes,
        "minutes_until_due": None if remaining is None else round(remaining, 1),
        "prompts_tonight": prompts_tonight or 0,
        "max_per_night": MAX_PROMPTS_PER_NIGHT,
        "reason": reason,
    }


# ── Persistence ───────────────────────────────────────────────────────────────

async def get_cadence(user_id: str) -> str:
    """A scout's chosen rhythm, defaulting to normal rather than to aggressive."""
    from app.config import db
    row = await db.alert_preferences.find_one({"user_id": user_id}, {"prompt_cadence": 1})
    cadence = (row or {}).get("prompt_cadence")
    return cadence if cadence in CADENCE_OPTIONS else DEFAULT_CADENCE


async def set_cadence(user_id: str, cadence: str) -> str:
    """Store a chosen rhythm. Rejects anything not on the menu."""
    from app.config import db
    if cadence not in CADENCE_OPTIONS:
        raise ValueError(f"unknown cadence: {cadence}")
    await db.alert_preferences.update_one(
        {"user_id": user_id},
        {"$set": {"user_id": user_id, "prompt_cadence": cadence}},
        upsert=True,
    )
    return cadence


async def build_plan(user_id: str, venue_id: str) -> dict:
    """
    The live prompt plan for this scout at this venue, read from real state:
    their cadence, their last reading here, whether they are actually checked
    in, and how often they have already been asked tonight.
    """
    from app.config import db
    from app.services.stake import night_window_start

    cadence = await get_cadence(user_id)
    night_start = night_window_start()

    checkin = await db.checkins.find_one(
        {"user_id": user_id, "venue_id": venue_id, "status": "active"}
    )

    last = await db.ratings.find_one(
        {"user_id": user_id, "venue_id": venue_id},
        {"timestamp": 1},
        sort=[("timestamp", -1)],
    )

    prompts_tonight = await db.prompt_log.count_documents({
        "user_id": user_id,
        "venue_id": venue_id,
        "at": {"$gte": night_start},
    })

    plan = prompt_plan(
        (last or {}).get("timestamp"),
        cadence,
        is_checked_in=bool(checkin),
        prompts_tonight=prompts_tonight,
    )
    plan["venue_id"] = venue_id
    return plan


async def record_prompt(user_id: str, venue_id: str) -> None:
    """
    Log that we asked, so the nightly cap is real rather than advisory.
    Best effort: failing to log must never block the prompt itself.
    """
    from app.config import db
    try:
        await db.prompt_log.insert_one({
            "user_id": user_id,
            "venue_id": venue_id,
            "at": datetime.now(timezone.utc),
        })
    except Exception:
        pass
