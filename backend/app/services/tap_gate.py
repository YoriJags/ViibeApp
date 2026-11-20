"""
Tap gate: a live tap counts only from a signed-in person who is inside.

Taps arrive over the socket (`tap_velocity`, `vibe_pulse`) many times a
second. They used to be taken on trust: the socket had no idea who was on the
other end, the phone named its own user id, and the only location check ran
on the phone. A script could tap for any venue as anyone, from anywhere.

Now:
  * Who: the socket is tied to a session when it connects or sends
    `authenticate`. The user id is the session's, never the phone's.
  * Where: the person must be inside, by evidence the server checked itself:
      - a check-in at this venue that counts as presence right now
        (services/presence.is_present: manual check-ins enforce the geofence,
        auto check-ins need a verified position and must outlast a walk-past), or
      - a bolt from this venue whose position fell inside its geofence within
        the last PRESENT_WINDOW (routes/surge.py records that).
  * Answers are cached for CACHE_S per person and venue, so a fast tapper costs
    one lookup a minute, not one per tap.

Known limit: positions come from the phone, and a phone can lie about where it
is. A server-side check closes the scripted-tap hole, not the fake-GPS one;
matching taps to the music the room's phones hear is what goes after that.
"""
from __future__ import annotations

import time
from datetime import datetime, timedelta, timezone
from typing import Optional

from app.config import db
from app.services.auth import user_for_session_token
from app.services.presence import present_filter

PRESENT_WINDOW = timedelta(minutes=15)
CACHE_S = 60.0
_CACHE_MAX = 50_000

# (user_id, venue_id) -> (checked at, inside)
_inside_cache: dict[tuple[str, str], tuple[float, bool]] = {}


async def user_id_for_token(token: Optional[str]) -> Optional[str]:
    if not token or not isinstance(token, str):
        return None
    user = await user_for_session_token(token)
    return user.get("id") if user else None


async def _inside_now(user_id: str, venue_id: str, now: datetime) -> bool:
    checkin = await db.checkins.find_one({**present_filter(venue_id, now), "user_id": user_id}, {"_id": 1})
    if checkin:
        return True
    bolt = await db.venue_bolts.find_one(
        {"venue_id": venue_id, "user_id": user_id, "present": True, "ts": {"$gte": now - PRESENT_WINDOW}},
        {"_id": 1},
    )
    return bool(bolt)


async def is_inside(user_id: Optional[str], venue_id: Optional[str],
                    now: Optional[datetime] = None, mono: Optional[float] = None) -> bool:
    if not user_id or not venue_id or not isinstance(venue_id, str):
        return False
    mono = time.monotonic() if mono is None else mono
    key = (user_id, venue_id)
    hit = _inside_cache.get(key)
    if hit and mono - hit[0] < CACHE_S:
        return hit[1]
    inside = await _inside_now(user_id, venue_id, now or datetime.now(timezone.utc))
    if len(_inside_cache) >= _CACHE_MAX:
        _inside_cache.clear()
    _inside_cache[key] = (mono, inside)
    return inside


def forget(user_id: str, venue_id: Optional[str] = None) -> None:
    """Drop cached answers, e.g. right after a check-in so the next tap counts."""
    for key in [k for k in _inside_cache if k[0] == user_id and (venue_id is None or k[1] == venue_id)]:
        _inside_cache.pop(key, None)
