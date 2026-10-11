"""
Auto presence: knowing who is in a room without asking them to say so.

This is the passive half of VIIBE, and the closest thing it has to how Google
Maps learns about traffic. Once a scout opts in, the phone's own geofencing
tells us when they walk into a venue and when they leave, with the app closed.
Every installed phone becomes a presence sensor without anyone tapping anything.

What presence is, and what it is not:

  Presence is EVIDENCE. It tells us how many people are in a room, how long
  they stay, and how fast they arrive and leave. It never produces Energy on its
  own. A packed dead room and an electric half-empty one look identical to a
  geofence, which is why Energy still comes from people answering in the room.
  See docs/ENERGY.md.

Rules that keep it honest and respectful:

  1. **No clout, no streak.** Clout is earned by doing something. Walking past a
     venue with the app in your pocket is not doing something, and paying for it
     would invite people to farm it by driving down Admiralty Way.
  2. **Passing is not presence.** A visit under PASS_THROUGH_MINUTES is someone
     walking or driving past, so it is logged but never counted as being there.
  3. **Never published by name.** An auto check-in counts towards how many people
     are in a room, but never appears in any list of who is there. Someone who
     simply walked in did not choose to announce themselves.
  4. **Self-healing.** Phones die and operating systems kill tasks, so an exit can
     be lost. Auto check-ins expire on their own rather than leaving a person
     "present" at a venue they left hours ago.
  5. **A manual check-in always wins.** It is an explicit choice, so an automatic
     event never overrides or closes it on the strength of an overlapping
     geofence next door.
"""
from datetime import datetime, timedelta, timezone

SOURCE_AUTO = "auto"

# Safety net for lost exit events. Long enough for a night out, short enough
# that someone whose phone died does not haunt a venue until morning.
AUTO_TTL_HOURS = 3

# Under this, it was a walk-past or a drive-past, not a visit.
PASS_THROUGH_MINUTES = 3

# Geofence boundaries flap: a phone at the edge of a venue can fire exit and
# enter seconds apart. A re-entry inside this window continues the same visit
# rather than starting a new one.
REENTER_GRACE_MINUTES = 2

# How far beyond the venue's own radius a reported position may sit before we
# refuse the event. Geofence callbacks fire late and positions are coarse, so
# this is generous on purpose; it exists to stop obviously spoofed claims.
POSITION_TOLERANCE_MULTIPLIER = 3


def _aware(ts: datetime | None) -> datetime | None:
    if ts is None:
        return None
    return ts.replace(tzinfo=timezone.utc) if ts.tzinfo is None else ts


def is_auto(checkin: dict | None) -> bool:
    return bool(checkin) and checkin.get("source") == SOURCE_AUTO


def is_present(checkin: dict, now: datetime | None = None) -> bool:
    """
    Whether a check-in counts as a person being in the room right now.

    Manual check-ins count immediately: the person said they were there.
    Auto check-ins count only once they have outlasted a walk-past.
    """
    now = now or datetime.now(timezone.utc)
    if not checkin or checkin.get("status") != "active":
        return False
    expires = _aware(checkin.get("expires_at"))
    if expires is not None and expires <= now:
        return False
    if not is_auto(checkin):
        return True
    created = _aware(checkin.get("created_at"))
    if created is None:
        return False
    return (now - created) >= timedelta(minutes=PASS_THROUGH_MINUTES)


def present_filter(venue_id: str, now: datetime | None = None) -> dict:
    """
    The Mongo filter equivalent of `is_present`, for counting at a venue.
    Built from the same constants so the two can never disagree.
    """
    now = now or datetime.now(timezone.utc)
    return {
        "venue_id": venue_id,
        "status": "active",
        "expires_at": {"$gt": now},
        "$or": [
            {"source": {"$ne": SOURCE_AUTO}},
            {"created_at": {"$lte": now - timedelta(minutes=PASS_THROUGH_MINUTES)}},
        ],
    }


def classify_visit(entered_at: datetime, left_at: datetime) -> dict:
    """How long a visit lasted, and whether it was really a visit at all."""
    entered_at, left_at = _aware(entered_at), _aware(left_at)
    minutes = max(0.0, (left_at - entered_at).total_seconds() / 60)
    return {
        "dwell_minutes": round(minutes, 1),
        "pass_through": minutes < PASS_THROUGH_MINUTES,
    }


def decide_enter(active: dict | None,
                 venue_id: str,
                 last_left: dict | None,
                 now: datetime | None = None) -> str:
    """
    What an enter event should do, given the scout's current state.

    Returns one of:
      "noop"         already present here
      "keep_manual"  a manual check-in elsewhere stands; do not override it
      "switch"       an auto check-in elsewhere is replaced by this one
      "resume"       a re-entry inside the grace window continues the last visit
      "open"         a new visit
    """
    now = now or datetime.now(timezone.utc)

    if active:
        if active.get("venue_id") == venue_id:
            return "noop"
        if not is_auto(active):
            return "keep_manual"
        return "switch"

    if last_left and last_left.get("venue_id") == venue_id and is_auto(last_left):
        left_at = _aware(last_left.get("left_at"))
        if left_at is not None and (now - left_at) < timedelta(minutes=REENTER_GRACE_MINUTES):
            return "resume"

    return "open"


def position_plausible(distance_m: float | None, venue_radius_m: float | None) -> bool:
    """
    Reject an enter claim from somewhere nowhere near the venue.

    No position at all is accepted: the operating system's own geofence fired,
    which is its own attestation. A position, when sent, has to be roughly right.
    """
    if distance_m is None:
        return True
    radius = venue_radius_m or 100
    return distance_m <= radius * POSITION_TOLERANCE_MULTIPLIER


def new_auto_checkin(user: dict, venue: dict, now: datetime | None = None) -> dict:
    """The document for a fresh automatic visit. No clout, no streak."""
    now = now or datetime.now(timezone.utc)
    return {
        "user_id": user["id"],
        "username": user.get("username", "Anonymous"),
        "venue_id": venue["id"],
        "venue_name": venue.get("name", ""),
        "status": "active",
        "source": SOURCE_AUTO,
        "created_at": now,
        "expires_at": now + timedelta(hours=AUTO_TTL_HOURS),
    }
