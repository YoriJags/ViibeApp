"""
Events: concerts, festivals and raves, with a date.

An event is stored as a venue document with kind="event". That is deliberate.
Every part of VIIBE (readings, auto check-in, the energy score, transitions,
the Big Screen, Signal Density) is keyed to a venue_id. Modelling an event as
a venue with a time window means all of it works for events on day one, and
only what is genuinely event-specific lives here.

What is event-specific:

  1. A time window. An event exists on the map only around its dates, and its
     geofence is temporary: a festival ground is not a venue the rest of the year.
  2. Entry type, which decides the promise the app makes:
       ticketed  Decided when the ticket was bought. The question on the night
                 is timing: when to leave, how bad the gate is. (See
                 leave_timing.py.)
       door      Decided on the night. The question is whether it's worth going.
     IDENTITY.md records why these are different promises.
  3. An organiser, who gets a live screen for their own event, opened with a
     private link rather than an account. See routes/events.py.
"""
import secrets
from datetime import datetime, timedelta, timezone

KIND_EVENT = "event"

ENTRY_TICKETED = "ticketed"
ENTRY_DOOR = "door"
ENTRIES = (ENTRY_TICKETED, ENTRY_DOOR)

EVENT_TYPES = ("concert", "festival", "rave")

PROMISE_TIMING = "timing"
PROMISE_WORTH = "worth"

# How long before the start an event appears on the map and in listings.
LISTED_BEFORE = timedelta(days=7)
# How long after the end it stays visible, so people can see how it went.
LISTED_AFTER = timedelta(hours=2)
# Doors are "opening" for this long before the advertised start.
DOORS_LEAD = timedelta(hours=2)

# A festival ground is bigger than a club. Bounds keep a typo from drawing a
# geofence over half of Lagos or one too small to ever fire.
DEFAULT_GROUND_RADIUS_M = 250
MIN_RADIUS_M = 60
MAX_RADIUS_M = 1500
MAX_DURATION = timedelta(days=4)


def _aware(ts):
    if ts is None:
        return None
    if isinstance(ts, str):
        ts = datetime.fromisoformat(ts.replace("Z", "+00:00"))
    return ts.replace(tzinfo=timezone.utc) if ts.tzinfo is None else ts


def is_event(doc: dict) -> bool:
    return (doc or {}).get("kind") == KIND_EVENT


def promise_for(event: dict) -> str:
    """Which question the app answers for this event."""
    return PROMISE_TIMING if event.get("entry") == ENTRY_TICKETED else PROMISE_WORTH


def event_phase(event: dict, now: datetime | None = None) -> str:
    """
    Where an event is in its life:

        upcoming   listed, but doors are not open yet
        doors      within DOORS_LEAD of the start
        live       between start and end
        ended      after the end
    """
    now = now or datetime.now(timezone.utc)
    start, end = _aware(event.get("starts_at")), _aware(event.get("ends_at"))
    if start is None or end is None:
        return "ended"  # an undated event can never be shown as live
    if now >= end:
        return "ended"
    if now >= start:
        return "live"
    if now >= start - DOORS_LEAD:
        return "doors"
    return "upcoming"


def is_listed(event: dict, now: datetime | None = None) -> bool:
    """Whether the event should appear on the map and in listings right now."""
    now = now or datetime.now(timezone.utc)
    start, end = _aware(event.get("starts_at")), _aware(event.get("ends_at"))
    if start is None or end is None:
        return False
    return start - LISTED_BEFORE <= now <= end + LISTED_AFTER


def is_watchable(event: dict, now: datetime | None = None) -> bool:
    """
    Whether the phone should watch this event's ground for arrivals. Only from
    doors to end: a temporary geofence must not fire on an empty field the
    week before, or count people who happen to live next to it.
    """
    return event_phase(event, now) in ("doors", "live")


def event_summary(event: dict, now: datetime | None = None) -> dict:
    """The small block the app attaches to an event so it can render the right promise."""
    return {
        "phase": event_phase(event, now),
        "entry": event.get("entry", ENTRY_DOOR),
        "promise": promise_for(event),
        "event_type": event.get("venue_type"),
        "starts_at": _aware(event.get("starts_at")).isoformat() if event.get("starts_at") else None,
        "ends_at": _aware(event.get("ends_at")).isoformat() if event.get("ends_at") else None,
        "host_venue_id": event.get("host_venue_id"),
    }


def validate_event(payload: dict) -> list[str]:
    """Plain-English problems with an event before it is saved. Empty means valid."""
    problems = []
    if not (payload.get("name") or "").strip():
        problems.append("The event needs a name.")
    if payload.get("venue_type") not in EVENT_TYPES:
        problems.append(f"Type must be one of: {', '.join(EVENT_TYPES)}.")
    if payload.get("entry") not in ENTRIES:
        problems.append("Entry must be 'ticketed' or 'door'.")

    coords = payload.get("coordinates") or {}
    try:
        lat, lng = float(coords.get("lat")), float(coords.get("lng"))
        if not (-90 <= lat <= 90 and -180 <= lng <= 180):
            problems.append("Coordinates are out of range.")
    except (TypeError, ValueError):
        problems.append("The event needs coordinates for the grounds.")

    radius = payload.get("geofence_radius_m", DEFAULT_GROUND_RADIUS_M)
    try:
        radius = float(radius)
        if not (MIN_RADIUS_M <= radius <= MAX_RADIUS_M):
            problems.append(f"The ground radius must be between {MIN_RADIUS_M} and {MAX_RADIUS_M} metres.")
    except (TypeError, ValueError):
        problems.append("The ground radius must be a number of metres.")

    try:
        start, end = _aware(payload.get("starts_at")), _aware(payload.get("ends_at"))
    except (TypeError, ValueError):
        start = end = None
        problems.append("Start and end must be dates and times.")
    if start is None or end is None:
        if "Start and end must be dates and times." not in problems:
            problems.append("The event needs a start and an end.")
    elif end <= start:
        problems.append("The end must be after the start.")
    elif end - start > MAX_DURATION:
        problems.append("An event can run for at most 4 days.")
    return problems


def new_organiser_key() -> str:
    """
    The private link secret for an organiser's live screen.

    Stored in its own collection (event_keys), never on the event document.
    Dozens of endpoints return whole venue documents; a secret kept on the
    event would leak through whichever one forgot to exclude it.
    """
    return secrets.token_urlsafe(24)


def new_event_document(payload: dict, created_by: str | None = None) -> dict:
    """The venue-shaped document for a new event. Holds no secrets."""
    import uuid
    return {
        "id": str(uuid.uuid4()),
        "kind": KIND_EVENT,
        "name": payload["name"].strip(),
        "address": (payload.get("address") or "").strip(),
        "area": (payload.get("area") or "").strip(),
        "city": (payload.get("city") or "lagos").lower(),
        "venue_type": payload["venue_type"],
        "entry": payload["entry"],
        "coordinates": {"lat": float(payload["coordinates"]["lat"]),
                        "lng": float(payload["coordinates"]["lng"])},
        "geofence_radius_m": float(payload.get("geofence_radius_m") or DEFAULT_GROUND_RADIUS_M),
        "starts_at": _aware(payload["starts_at"]),
        "ends_at": _aware(payload["ends_at"]),
        "host_venue_id": payload.get("host_venue_id"),
        "organiser_name": (payload.get("organiser_name") or "").strip() or None,
        "created_by": created_by,
        "created_at": datetime.now(timezone.utc),
        # Venue fields every existing system expects, at honest empty values.
        "current_vibe_score": 0.0,
        "energy_level": "quiet",
        "vibe_state": "quiet",
        "capacity_level": "sparse",
        "gate_level": "clear",
        "vibe_velocity": "stable",
        "total_ratings_24h": 0,
        "energy_source": "none",
        "is_featured": False,
        "is_verified": False,
    }


def public_event(doc: dict) -> dict:
    """An event as anyone may see it, with dates as ISO strings."""
    out = {k: v for k, v in doc.items() if k != "_id"}
    for k in ("starts_at", "ends_at", "created_at"):
        if isinstance(out.get(k), datetime):
            out[k] = _aware(out[k]).isoformat()
    return out
