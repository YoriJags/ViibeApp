"""
Energy transitions: telling both audiences when a room changes.

A venue moving from WARMING to LIT is the single most useful moment this
product produces, and until now it passed silently. There are two audiences for
it and they need different sentences:

  **Inside the room.** People with an active check-in. They can already feel it.
  What they get is confirmation and a reason to refresh the reading, not news.

  **Outside the room.** People who put this venue on their list. They cannot
  feel it, and this is the whole reason they added it. This is news.

The part that matters most, and that nobody else will do:

    **Cooling is announced too.**

Every other app in this category only ever tells you a place is popping, because
that is the message venues want sent. Telling someone the room they were about
to cross Lagos for is dying saves them an hour and ten thousand naira, and it is
the single most trust-building message we can send. A product that only reports
good news is an advertising channel. We are not one.

Three guards keep transitions honest rather than noisy:

  1. **Evidence required.** A transition is only announced when enough readings
     stand behind it. One person cannot announce a peak to a city.
  2. **Throttled.** One announcement per venue per cooldown, so a room sitting
     on a boundary cannot flap and spam.
  3. **Real movement only.** Movement between states of equal rank is tracked
     but never announced as an energy change, because it is not one.
"""
from datetime import datetime, timedelta, timezone

# The canonical ladder from docs/ENERGY.md. CHARGED shares a rank with WARMING
# because it is the same energy in a fuller room, not a higher energy.
RANK = {
    "quiet": 0,
    "chill": 1,
    "warming": 2,
    "charged": 2,
    "lit": 3,
    "peak": 4,
}

LABEL = {
    "quiet": "QUIET",
    "chill": "CHILL",
    "warming": "WARMING",
    "charged": "CHARGED",
    "lit": "LIT",
    "peak": "PEAK",
}

# Evidence floor. A transition announced to a city needs more than one voice.
MIN_READINGS_TO_ANNOUNCE = 3

# A peak claim reaches the most people, so it carries the highest bar.
MIN_READINGS_FOR_PEAK = 5

# One announcement per venue per this many minutes.
COOLDOWN_MINUTES = 25


def detect_transition(previous_state: str | None, new_state: str | None) -> dict | None:
    """
    Work out whether a venue actually changed energy, and which way.

    Returns None when nothing meaningful happened: no previous state to compare
    against, an unrecognised state, or movement that does not change rank
    (WARMING to CHARGED is a fuller room, not a hotter one).
    """
    if not previous_state or not new_state:
        return None
    if previous_state not in RANK or new_state not in RANK:
        return None
    if previous_state == new_state:
        return None

    before, after = RANK[previous_state], RANK[new_state]
    if before == after:
        return None

    return {
        "from": previous_state,
        "to": new_state,
        "from_label": LABEL[previous_state],
        "to_label": LABEL[new_state],
        "direction": "rising" if after > before else "cooling",
        "steps": abs(after - before),
        "reached_peak": new_state == "peak",
    }


def has_enough_evidence(transition: dict, readings_count: int) -> bool:
    """
    Enough independent readings to stand behind the claim.

    A peak fires to the widest audience, so it needs the most behind it. This is
    the same principle as the ELECTRIC gate: the louder the statement, the more
    corroboration it requires.
    """
    try:
        n = int(readings_count or 0)
    except (TypeError, ValueError):
        n = 0
    needed = MIN_READINGS_FOR_PEAK if transition.get("reached_peak") else MIN_READINGS_TO_ANNOUNCE
    return n >= needed


def should_announce(transition: dict | None,
                    readings_count: int,
                    minutes_since_last: float | None) -> bool:
    """All three guards, in one place."""
    if not transition:
        return False
    if not has_enough_evidence(transition, readings_count):
        return False
    if minutes_since_last is not None and minutes_since_last < COOLDOWN_MINUTES:
        return False
    return True


def transition_copy(venue_name: str, transition: dict) -> dict:
    """
    The two sentences. Same event, different audience, different job.

    Inside: they already feel it, so confirm and invite a refresh.
    Outside: they cannot feel it, so tell them plainly and let them decide.

    No em dashes, per house style.
    """
    to_label = transition["to_label"]
    rising = transition["direction"] == "rising"

    if rising:
        if transition["reached_peak"]:
            inside = f"This room just hit PEAK. You are in it."
            outside = f"{venue_name} just hit PEAK."
        else:
            inside = f"This room just went {to_label}."
            outside = f"{venue_name} just went {to_label}."
        nudge = "Still reading right? One tap keeps it true."
    else:
        # The honest half. Nobody else sends this message.
        inside = f"Energy here is dropping to {to_label}."
        outside = f"{venue_name} is cooling off. Now reading {to_label}."
        nudge = "If that is wrong, say so. One tap."

    return {
        "inside": inside,
        "outside": outside,
        "nudge": nudge,
        "direction": transition["direction"],
        "to": transition["to"],
        "to_label": to_label,
    }


# ── Delivery ──────────────────────────────────────────────────────────────────

async def _minutes_since_last_announcement(venue_id: str) -> float | None:
    from app.config import db
    row = await db.transition_log.find_one({"venue_id": venue_id}, sort=[("fired_at", -1)])
    if not row or not row.get("fired_at"):
        return None
    fired = row["fired_at"]
    if fired.tzinfo is None:
        fired = fired.replace(tzinfo=timezone.utc)
    return (datetime.now(timezone.utc) - fired).total_seconds() / 60


async def announce_transition(venue: dict, previous_state: str | None, new_state: str | None) -> dict:
    """
    Detect, guard, and deliver an energy transition to both audiences.

    Best effort throughout: a failure to notify must never break the rating that
    triggered it. Returns what happened, so it can be logged or tested.
    """
    from app.config import db, sio, logger

    transition = detect_transition(previous_state, new_state)
    if not transition:
        return {"announced": False, "reason": "no meaningful transition"}

    venue_id = venue.get("id")
    readings = venue.get("total_ratings_24h", 0)

    minutes_since = await _minutes_since_last_announcement(venue_id)
    if not should_announce(transition, readings, minutes_since):
        return {
            "announced": False,
            "reason": "guarded",
            "readings": readings,
            "minutes_since_last": minutes_since,
        }

    venue_name = venue.get("name", "A venue")
    copy = transition_copy(venue_name, transition)
    now = datetime.now(timezone.utc)

    payload = {
        "venue_id": venue_id,
        "venue_name": venue_name,
        "from": transition["from"],
        "to": transition["to"],
        "direction": transition["direction"],
        "message": copy["outside"],
        "inside_message": copy["inside"],
        "nudge": copy["nudge"],
        "at": now.isoformat(),
    }

    delivered = {"in_room": 0, "watchers": 0}

    # Inside the room, and anyone watching this venue's live feed.
    try:
        await sio.emit("energy_transition", payload, room=f"venue_{venue_id}")
        await sio.emit("energy_transition", payload, room=f"city_{venue.get('city', 'lagos')}")
    except Exception as e:
        logger.warning(f"transition socket emit failed: {e}")

    # Outside: people who put this venue on their list.
    try:
        delivered = await _push_to_watchers(venue_id, copy, payload, delivered)
    except Exception as e:
        logger.warning(f"transition push failed: {e}")

    try:
        await db.transition_log.insert_one({
            "venue_id": venue_id,
            "from": transition["from"],
            "to": transition["to"],
            "direction": transition["direction"],
            "readings": readings,
            "fired_at": now,
            "delivered": delivered,
        })
    except Exception as e:
        logger.warning(f"transition log failed: {e}")

    return {"announced": True, "transition": transition, "copy": copy, "delivered": delivered}


async def _push_to_watchers(venue_id: str, copy: dict, payload: dict, delivered: dict) -> dict:
    """
    Notify the people who put this venue on their list.

    A watcher asked to hear about this venue, so both directions are sent. Being
    told a place is dying is the message that earns the trust.
    """
    from app.config import db
    from app.services.expo_push import send_push_notifications

    watchers = await db.venue_alerts.find({"venue_id": venue_id}, {"user_id": 1}).to_list(500)
    user_ids = [w["user_id"] for w in watchers if w.get("user_id")]
    if not user_ids:
        return delivered

    # Do not tell someone standing in the room that a place they are inside is
    # worth travelling to. They already know, and they got the inside message.
    inside = await db.checkins.find(
        {"venue_id": venue_id, "status": "active", "user_id": {"$in": user_ids}},
        {"user_id": 1},
    ).to_list(500)
    inside_ids = {c["user_id"] for c in inside}
    delivered["in_room"] = len(inside_ids)

    outside_ids = [u for u in user_ids if u not in inside_ids]
    if not outside_ids:
        return delivered

    tokens = await db.push_tokens.find(
        {"user_id": {"$in": outside_ids}}, {"expo_push_token": 1},
    ).to_list(500)
    token_list = [t["expo_push_token"] for t in tokens if t.get("expo_push_token")]
    if token_list:
        await send_push_notifications(
            token_list,
            title=payload["venue_name"],
            body=copy["outside"],
            data={"venue_id": venue_id, "type": "energy_transition",
                  "direction": copy["direction"]},
        )
    delivered["watchers"] = len(token_list)
    return delivered
