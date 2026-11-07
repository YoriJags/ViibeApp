"""
Crowd flow: people arriving and leaving, from auto check-in.

This is the closest VIIBE comes to how Maps learns about traffic: nobody does
anything, their phones notice them arriving at and leaving a venue. It feeds
three places, and all three count the same way because they all count here:
City Energy's trend, "when to leave" for ticketed events, and the organiser
screen.

What counts:
  An ARRIVAL is a verified enter (a position near the venue) that opened or
  switched a visit. Unverified enters are never counted: any account can send
  one for any venue. See services/presence.py.
  A DEPARTURE is an exit that closed a visit which outlasted a walk-past.
  Driving past a venue is neither.

Flow is evidence of a crowd moving. It is never Energy, and never feeds the
score: a packed room and a dead one fill at the same rate.
"""
from datetime import datetime, timedelta, timezone

MIN_FLOW = 3  # below this, flow says nothing about direction

ARRIVAL_ACTIONS = ("open", "switch")


def arrival_filter(since: datetime, venue_ids: list[str] | None = None) -> dict:
    f = {"kind": "enter", "action": {"$in": list(ARRIVAL_ACTIONS)},
         "verified": True, "at": {"$gte": since}}
    if venue_ids is not None:
        f["venue_id"] = {"$in": venue_ids}
    return f


def departure_filter(since: datetime, venue_ids: list[str] | None = None) -> dict:
    f = {"kind": "exit", "action": "closed", "pass_through": False, "at": {"$gte": since}}
    if venue_ids is not None:
        f["venue_id"] = {"$in": venue_ids}
    return f


def direction(arrivals: int, departures: int) -> str:
    """filling, emptying, steady, or quiet when there is too little to say."""
    if max(arrivals, departures) < MIN_FLOW:
        return "quiet"
    if arrivals >= departures * 1.5:
        return "filling"
    if departures >= arrivals * 1.5:
        return "emptying"
    return "steady"


def bucketize(timestamps: list[datetime], start: datetime, now: datetime,
              minutes: int = 10) -> list[dict]:
    """
    Counts per bucket from `start` to `now`, oldest first. Every bucket in the
    range is present, including empty ones, so a chart never hides a lull.
    """
    start, now = _aware(start), _aware(now)
    if now <= start:
        return []
    size = timedelta(minutes=minutes)
    n = int((now - start) / size) + 1
    counts = [0] * n
    for ts in timestamps:
        ts = _aware(ts)
        if ts is None or ts < start or ts > now:
            continue
        counts[min(n - 1, int((ts - start) / size))] += 1
    return [{"at": (start + i * size).isoformat(), "count": c} for i, c in enumerate(counts)]


def _aware(ts):
    if ts is None:
        return None
    return ts.replace(tzinfo=timezone.utc) if ts.tzinfo is None else ts


async def flow_for(venue_ids: list[str] | None, minutes: int = 30) -> dict:
    """Arrivals and departures in the last `minutes` for these venues (None = all)."""
    from app.config import db
    since = datetime.now(timezone.utc) - timedelta(minutes=minutes)
    arrivals = await db.presence_events.count_documents(arrival_filter(since, venue_ids))
    departures = await db.presence_events.count_documents(departure_filter(since, venue_ids))
    return {
        "arrivals": arrivals,
        "departures": departures,
        "direction": direction(arrivals, departures),
        "window_minutes": minutes,
    }


async def arrival_curve(venue_id: str, start: datetime, minutes: int = 10) -> list[dict]:
    """Arrivals per bucket since `start`, for the organiser screen."""
    from app.config import db
    now = datetime.now(timezone.utc)
    rows = await db.presence_events.find(
        arrival_filter(_aware(start), [venue_id]), {"at": 1, "_id": 0}
    ).to_list(20000)
    return bucketize([r["at"] for r in rows if r.get("at")], start, now, minutes)
