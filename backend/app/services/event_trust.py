"""
The rules that keep submitted events and places honest.

Anyone signed in can put an event forward, so every submission is a claim
until it is proven: that the event is real, that it is where the pin says,
and that the person behind it is who they say (someone can claim to be Dave).

The rules, each with the harm it stops:

  Spam              at most MAX_PENDING waiting and MAX_PER_DAY a day per person.
  Duplicates        a second event at the same ground with overlapping times
                    is refused and pointed at the one already listed.
  Fake or abusive   REPORTS_TO_HIDE different people reporting a community
                    listing take it off the map until an admin looks.
  Tracking people   a pin can only move a short way without an admin
                    (ON_SITE_MOVE_LIMIT_M, more for a certified organiser),
                    only from a precise phone fix, and every move is logged.
  Wrong location    confirmed by the crowd (CROWD_CONFIRM_PEOPLE verified
                    arrivals inside), and drift is suggested, never applied,
                    when people gather somewhere else.

Pure functions only: the routes do the reading and writing.
"""
from datetime import datetime, timedelta, timezone

from app.services.vibe import calculate_distance

MAX_PENDING = 3
MAX_PER_DAY = 5

DUPLICATE_DISTANCE_M = 300

REPORTS_TO_HIDE = 3
REPORT_REASONS = ("fake", "wrong_location", "impersonation", "scam_tickets", "other")

ON_SITE_ACCURACY_M = 50
ON_SITE_MOVE_LIMIT_M = 300
CERTIFIED_MOVE_LIMIT_M = 1000

CROWD_CONFIRM_PEOPLE = 5
DRIFT_PEOPLE = 5
DRIFT_SEARCH_M = 1500
# Positions logged near an event are rounded to about 11 m. Enough to see where
# a crowd is, too coarse to follow a person.
POSITION_DECIMALS = 4

CERTIFICATION_LENGTH = timedelta(days=365)


def _aware(ts):
    if ts is None:
        return None
    if isinstance(ts, str):
        ts = datetime.fromisoformat(ts.replace("Z", "+00:00"))
    return ts if ts.tzinfo else ts.replace(tzinfo=timezone.utc)


def submission_limit_problem(pending: int, today: int) -> str | None:
    if pending >= MAX_PENDING:
        return f"You already have {MAX_PENDING} submissions waiting for review."
    if today >= MAX_PER_DAY:
        return f"You can submit at most {MAX_PER_DAY} a day."
    return None


def overlaps(a_start, a_end, b_start, b_end) -> bool:
    a_start, a_end, b_start, b_end = map(_aware, (a_start, a_end, b_start, b_end))
    if None in (a_start, a_end, b_start, b_end):
        return False
    return a_start < b_end and b_start < a_end


def find_duplicate(candidate: dict, existing: list[dict]) -> dict | None:
    """An event already at the same ground (within 300 m) with overlapping times."""
    c = candidate["coordinates"]
    for e in existing:
        if e.get("id") == candidate.get("id") or e.get("rejected"):
            continue
        ec = e.get("coordinates") or {}
        if "lat" not in ec:
            continue
        near = calculate_distance(c["lat"], c["lng"], ec["lat"], ec["lng"]) <= DUPLICATE_DISTANCE_M
        if near and overlaps(candidate["starts_at"], candidate["ends_at"], e.get("starts_at"), e.get("ends_at")):
            return e
    return None


def should_hide_for_reports(distinct_reporters: int, official: bool) -> bool:
    """A community listing comes off the map at 3 reports. An Official one is only flagged."""
    return not official and distinct_reporters >= REPORTS_TO_HIDE


def on_site_decision(accuracy_m, move_m: float, certified: bool) -> str:
    """
    What to do with an organiser's "I'm here" fix.

        too_imprecise  the phone's fix is worse than 50 m: refuse, try again outside
        apply          close enough to the approved spot: move the centre
        needs_admin    too far: keep it as a proposal for an admin
    """
    try:
        if accuracy_m is None or float(accuracy_m) > ON_SITE_ACCURACY_M:
            return "too_imprecise"
    except (TypeError, ValueError):
        return "too_imprecise"
    limit = CERTIFIED_MOVE_LIMIT_M if certified else ON_SITE_MOVE_LIMIT_M
    return "apply" if move_m <= limit else "needs_admin"


def round_position(lat: float, lng: float) -> dict:
    return {"lat": round(float(lat), POSITION_DECIMALS), "lng": round(float(lng), POSITION_DECIMALS)}


def location_status(confirmed_people: int, set_on_site: bool) -> str:
    """
    How far the event's location has been proven.

        confirmed  enough verified people arrived inside it
        on_site    the organiser fixed it standing there, no crowd yet
        unconfirmed  only the pin or the place record so far
    """
    if confirmed_people >= CROWD_CONFIRM_PEOPLE:
        return "confirmed"
    return "on_site" if set_on_site else "unconfirmed"


def drift_suggestion(event: dict, positions: list[dict]) -> dict | None:
    """
    Where people are gathering instead, if it is not inside the ground.

    positions: refused arrivals and check-ins near the event, each
    {"user_id", "lat", "lng"}. One point per person (their latest), only within
    DRIFT_SEARCH_M of the pin. Suggests a move when at least DRIFT_PEOPLE
    different people cluster outside the ground. Never applied by itself.
    """
    c = event.get("coordinates") or {}
    radius = float(event.get("geofence_radius_m") or 250)
    latest = {}
    for p in positions:
        try:
            d = calculate_distance(c["lat"], c["lng"], float(p["lat"]), float(p["lng"]))
        except (KeyError, TypeError, ValueError):
            continue
        if radius < d <= DRIFT_SEARCH_M:
            latest[p["user_id"]] = (float(p["lat"]), float(p["lng"]))
    if len(latest) < DRIFT_PEOPLE:
        return None
    lats = sorted(v[0] for v in latest.values())
    lngs = sorted(v[1] for v in latest.values())
    # The median, not the mean: one person far off should not drag the suggestion.
    mid = len(lats) // 2
    lat, lng = lats[mid], lngs[mid]
    dist = calculate_distance(c["lat"], c["lng"], lat, lng)
    if dist <= radius:
        return None
    return {"lat": round(lat, POSITION_DECIMALS), "lng": round(lng, POSITION_DECIMALS),
            "distance_m": round(dist), "people": len(latest)}


def is_certified(record: dict | None, now: datetime | None = None) -> bool:
    if not record or record.get("status") != "certified":
        return False
    expires = _aware(record.get("expires_at"))
    return expires is None or expires > (now or datetime.now(timezone.utc))
