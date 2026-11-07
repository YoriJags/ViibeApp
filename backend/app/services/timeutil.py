"""
Dates from Mongo come back naive (the client is not tz_aware), and some old
records store ISO strings. Comparing either with an aware "now" raises
TypeError, which was crashing every rating and coin balance for Vibe+ users,
every second dwell ping, and venue score refreshes. Normalise before comparing.
"""
from datetime import datetime, timezone


def as_utc(ts) -> datetime | None:
    """An aware UTC datetime from a datetime, a naive datetime or an ISO string; None if absent or unreadable."""
    if ts is None or ts == "":
        return None
    if isinstance(ts, str):
        try:
            ts = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        except ValueError:
            return None
    if not isinstance(ts, datetime):
        return None
    return ts.replace(tzinfo=timezone.utc) if ts.tzinfo is None else ts.astimezone(timezone.utc)
