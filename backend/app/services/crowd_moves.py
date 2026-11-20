"""
Crowd moves: where people go next.

Built from auto check-in. When the same phone makes a verified arrival at one
place and then a verified arrival at another on the same night, that is one
move. Added up over many phones it answers "after Mercury, where does the
crowd go", and across the grid, which areas feed which.

The rules, which matter more here than anywhere, because this is data about
where people physically go:

  * Only verified arrivals count (a real position near the venue). Any
    account can claim an unverified one.
  * A move is between two DIFFERENT places, within MAX_GAP of each other, on
    the same night. A trip home and out again tomorrow is not a move.
  * Nobody is ever shown. A route is reported only when at least
    MIN_PEOPLE different people made it; smaller routes are dropped, not
    rounded. Counts are people, not trips, so one person bar-hopping in a
    loop counts once per route.
  * Demo accounts are never counted.

Pure functions first; the queries that touch Mongo are at the bottom.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Iterable, Optional

from app.services.crowd_flow import ARRIVAL_ACTIONS
from app.services.freshness import is_demo_user, night_of

MAX_GAP = timedelta(hours=3)
MIN_PEOPLE = 5          # privacy and honesty floor for any reported route
LOOKBACK_DAYS = 28      # "usually" means the last four weeks


def _utc(ts) -> Optional[datetime]:
    if not isinstance(ts, datetime):
        return None
    return ts if ts.tzinfo else ts.replace(tzinfo=timezone.utc)


def moves_from_arrivals(arrivals: Iterable[dict]) -> list[dict]:
    """
    Turn verified arrivals into moves. Each arrival is {user_id, venue_id, at}.
    Returns [{user_id, from, to, at}] where `at` is the arrival at `to`.
    """
    by_user: dict[str, list[tuple[datetime, str]]] = {}
    for a in arrivals:
        uid, vid, at = a.get("user_id"), a.get("venue_id"), _utc(a.get("at"))
        if not uid or not vid or at is None or is_demo_user(uid):
            continue
        by_user.setdefault(uid, []).append((at, vid))

    moves = []
    for uid, visits in by_user.items():
        visits.sort()
        for (t1, v1), (t2, v2) in zip(visits, visits[1:]):
            if v1 == v2:
                continue
            if t2 - t1 > MAX_GAP or night_of(t1) != night_of(t2):
                continue
            moves.append({"user_id": uid, "from": v1, "to": v2, "at": t2})
    return moves


def routes(moves: Iterable[dict], key=lambda m: (m["from"], m["to"]),
           min_people: int = MIN_PEOPLE) -> list[dict]:
    """
    Count distinct people per route and keep the routes enough people made.
    `key` maps a move to its (origin, destination); return None to skip it.
    Busiest first.
    """
    people: dict[tuple, set] = {}
    for m in moves:
        k = key(m)
        if k is None or k[0] == k[1]:
            continue
        people.setdefault(k, set()).add(m["user_id"])
    out = [{"from": k[0], "to": k[1], "people": len(p)} for k, p in people.items() if len(p) >= min_people]
    out.sort(key=lambda r: (-r["people"], r["from"], r["to"]))
    return out


def next_from(moves: Iterable[dict], origin: str, min_people: int = MIN_PEOPLE) -> dict:
    """
    Where people who were at `origin` went next, with each destination's share
    of everyone who moved on. `left_for_somewhere` counts every person who
    moved on, including to destinations too small to name.
    """
    moved = [m for m in moves if m["from"] == origin]
    everyone = {m["user_id"] for m in moved}
    found = routes(moved, min_people=min_people)
    for r in found:
        r["share"] = round(r["people"] / len(everyone), 2) if everyone else 0.0
    return {
        "origin": origin,
        "left_for_somewhere": len(everyone),
        "enough": bool(found),
        "min_people": min_people,
        "destinations": [{"to": r["to"], "people": r["people"], "share": r["share"]} for r in found],
    }


def usual_move_hour(moves: Iterable[dict], origin: str, destination: str) -> Optional[int]:
    """The Lagos hour people most often arrive at `destination` from `origin`."""
    from app.services.peak_forecast import lagos_hour

    hours: dict[int, set] = {}
    for m in moves:
        if m["from"] == origin and m["to"] == destination:
            hours.setdefault(lagos_hour(m["at"]), set()).add(m["user_id"])
    if not hours:
        return None
    return max(hours, key=lambda h: (len(hours[h]), -h))


# ── Queries ──────────────────────────────────────────────────────────────────

async def arrivals_since(since: datetime, venue_ids: Optional[list[str]] = None,
                         user_ids: Optional[list[str]] = None) -> list[dict]:
    from app.config import db

    q: dict = {"kind": "enter", "action": {"$in": list(ARRIVAL_ACTIONS)}, "verified": True,
               "at": {"$gte": since}}
    if venue_ids is not None:
        q["venue_id"] = {"$in": venue_ids}
    if user_ids is not None:
        q["user_id"] = {"$in": user_ids}
    return await db.presence_events.find(
        q, {"_id": 0, "user_id": 1, "venue_id": 1, "at": 1}
    ).to_list(200_000)


async def moves_from_venue(venue_id: str, days: int = LOOKBACK_DAYS,
                           now: Optional[datetime] = None) -> list[dict]:
    """Every move out of one venue in the window, read without scanning the whole city."""
    now = now or datetime.now(timezone.utc)
    since = now - timedelta(days=days)
    here = await arrivals_since(since, venue_ids=[venue_id])
    users = list({a["user_id"] for a in here if a.get("user_id")})
    if not users:
        return []
    return [m for m in moves_from_arrivals(await arrivals_since(since, user_ids=users))
            if m["from"] == venue_id]
