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
import re
import secrets
from datetime import datetime, timedelta, timezone

KIND_EVENT = "event"

ENTRY_TICKETED = "ticketed"
ENTRY_DOOR = "door"
ENTRIES = (ENTRY_TICKETED, ENTRY_DOOR)

EVENT_TYPES = ("concert", "festival", "rave", "block_party")

# Where an event came from. An admin's own event is trusted as entered. A
# ticketing partner's or a community member's waits for an admin.
SOURCE_ADMIN = "admin"
SOURCE_PARTNER = "partner"
SOURCE_COMMUNITY = "community"

# Who is behind it. Every submission is a claim ("this is Dave's concert")
# until an admin checks the organiser. A community listing shows no organiser
# name and no ticket link, so nobody can borrow an artist's name to sell tickets.
LISTING_COMMUNITY = "community"
LISTING_OFFICIAL = "official"
VERIFY_METHODS = ("official_social_post", "ticketing_partner", "known_promoter", "in_person")

# Fields that never leave the server in a public response.
PRIVATE_FIELDS = ("_id", "created_by", "submitted_by", "reports", "review", "verification",
                  "claimed_organiser", "pending_location", "rejected_reason")

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


def needs_approval(event: dict) -> bool:
    """A partner's or a community member's event waits for an admin; an admin's own does not."""
    return bool(event.get("partner_id")) or event.get("source") == SOURCE_COMMUNITY


def is_held(event: dict) -> bool:
    """
    Kept off the map: not yet approved, or taken down while reports are looked at.

    A partner or a member could otherwise drop a geofence on any spot and watch
    who arrives there.
    """
    if needs_approval(event) and not event.get("approved"):
        return True
    return bool(event.get("hidden_for_review"))


def listing_of(event: dict) -> str:
    """Official once an admin has verified the organiser, or for an admin's own event."""
    if event.get("listing") == LISTING_OFFICIAL:
        return LISTING_OFFICIAL
    return LISTING_COMMUNITY if event.get("source") == SOURCE_COMMUNITY else LISTING_OFFICIAL


def is_listed(event: dict, now: datetime | None = None) -> bool:
    """Whether the event should appear on the map and in listings right now."""
    now = now or datetime.now(timezone.utc)
    if is_held(event):
        return False
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
    if is_held(event):
        return False
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


TEXT_LIMITS = {"name": 120, "address": 200, "area": 80, "organiser_name": 120,
               "description": 600, "dress_code": 80, "price_text": 60}

# The parts of an event its submitter can shape freely (fair game for anyone,
# certified or not). Ticket links and the Official badge are the only things
# held back for certified organisers, because those are where trust and money
# change hands.
LIST_LIMITS = {"lineup": (12, 60), "genres": (6, 24)}
AGE_LIMITS = (None, 16, 18, 21)

# Free text may not carry links or phone numbers: a "buy tickets at" line in a
# description would get round the rule that only certified organisers show a
# ticket link.
_LINK = re.compile(r"(https?://|www\.|\b[\w-]+\.(com|ng|net|org|io|co|me|ly|link|africa)\b|wa\.me|t\.me|bit\.ly)", re.I)
_PHONE = re.compile(r"(\+?\d[\d\s().-]{8,}\d)")
_CONTACT_FIELDS = ("name", "description", "dress_code", "price_text", "organiser_name")


def _has_contact(text: str, phones: bool = True) -> bool:
    """A link, or a run of 11 or more digits that reads as a phone number (080..., +234...)."""
    if _LINK.search(text):
        return True
    return phones and any(sum(c.isdigit() for c in m.group(0)) >= 11 for m in _PHONE.finditer(text))


def _bad_text(value) -> bool:
    """Markup or control characters. Event text is shown on pages and the map."""
    return any(c in "<>" or (ord(c) < 32 and c not in "\t") or ord(c) == 127 for c in str(value))


def validate_event(payload: dict) -> list[str]:
    """Plain-English problems with an event before it is saved. Empty means valid."""
    problems = []
    for field, limit in TEXT_LIMITS.items():
        value = payload.get(field)
        if value is None:
            continue
        if not isinstance(value, str) or len(value) > limit:
            problems.append(f"{field} must be text of at most {limit} characters.")
        elif _bad_text(value):
            problems.append(f"{field} cannot contain < or > or control characters.")
    url = payload.get("ticket_url")
    if url is not None and (not isinstance(url, str) or len(url) > 500
                            or not url.startswith("https://") or _bad_text(url)):
        problems.append("ticket_url must be an https:// link of at most 500 characters.")
    for field, (count, limit) in LIST_LIMITS.items():
        items = payload.get(field)
        if items is None:
            continue
        if (not isinstance(items, list) or len(items) > count
                or any(not isinstance(i, str) or not i.strip() or len(i) > limit or _bad_text(i) for i in items)):
            problems.append(f"{field} must be at most {count} entries of up to {limit} characters each.")
        elif any(_has_contact(i) for i in items):
            problems.append(f"{field} cannot contain links or phone numbers.")
    if payload.get("age_limit") not in AGE_LIMITS:
        problems.append("Age limit must be none, 16, 18 or 21.")
    for field in _CONTACT_FIELDS:
        value = payload.get(field)
        # A price range can look like a phone number, so prices are checked for links only.
        if isinstance(value, str) and _has_contact(value, phones=field != "price_text"):
            problems.append(f"{field} cannot contain links or phone numbers. "
                            "A ticket link shows on events by VIIBE Certified organisers.")
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
        "place_id": payload.get("place_id"),
        "organiser_name": (payload.get("organiser_name") or "").strip() or None,
        "ticket_url": payload.get("ticket_url"),
        "description": (payload.get("description") or "").strip() or None,
        "dress_code": (payload.get("dress_code") or "").strip() or None,
        "price_text": (payload.get("price_text") or "").strip() or None,
        "lineup": [i.strip() for i in payload.get("lineup") or []],
        "genres": [i.strip() for i in payload.get("genres") or []],
        "age_limit": payload.get("age_limit"),
        "cover_image_url": None,
        "source": payload.get("source") or SOURCE_ADMIN,
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
    """
    An event as anyone may see it, with dates as ISO strings.

    Never carries who submitted it. A community listing keeps its host name,
    marked not verified, and drops the ticket link: a link is where a fake
    organiser takes money, so it shows only for certified organisers.
    """
    out = {k: v for k, v in doc.items() if k not in PRIVATE_FIELDS}
    listing = listing_of(doc)
    out["listing"] = listing
    out["organiser_verified"] = listing == LISTING_OFFICIAL and bool(out.get("organiser_name"))
    if listing == LISTING_COMMUNITY:
        out.pop("ticket_url", None)
    for k in ("starts_at", "ends_at", "created_at", "location_set_at"):
        if isinstance(out.get(k), datetime):
            out[k] = _aware(out[k]).isoformat()
    return out
