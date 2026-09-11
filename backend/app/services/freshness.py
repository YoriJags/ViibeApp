"""
Freshness — the one number the product lives or dies on.

VIIBE promises "what this room is like right now". If the median reading
behind a displayed score is four minutes old the map is true; at forty
minutes it is fiction, the venue dashboard is unsellable, and an assistant
querying the API hands someone a wrong answer.

So freshness is not a proxy for the aim, it is the aim, and it gets measured
directly.

Reported metrics:
  median_age_minutes  — median age of the reading behind each venue's score
  fresh_coverage      — share of venues carrying a reading inside the window
  readings_per_visit  — how often one scout re-reports during a single visit

Demo-scout activity is counted separately from real users throughout. Mixing
them would let the ambient engine flatter the numbers, which is the one thing
this module exists to prevent.
"""
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from statistics import median, mean
from typing import Iterable, Optional

DEMO_PREFIX = "demo-scout-"
FRESH_WINDOW_MINUTES = 15
NIGHT_ROLLOVER_HOURS = 6      # a night belongs to the day it started


def median_age_minutes(ages: Iterable[float]) -> Optional[float]:
    """Median reading age. None when nothing has been reported at all."""
    vals = [a for a in ages if a is not None]
    return round(median(vals), 1) if vals else None


def fresh_coverage(ages: Iterable[Optional[float]], total_venues: int,
                   window: int = FRESH_WINDOW_MINUTES) -> dict:
    """
    Share of venues carrying a reading inside the freshness window.
    Venues with no reading count against coverage: silence is not freshness.
    """
    vals = [a for a in ages if a is not None]
    fresh = [a for a in vals if a <= window]
    pct = round(100 * len(fresh) / total_venues, 1) if total_venues else 0.0
    return {"fresh": len(fresh), "total_venues": total_venues,
            "pct": pct, "window_minutes": window}


def is_demo_user(user_id) -> bool:
    return str(user_id or "").startswith(DEMO_PREFIX)


def night_of(ts: datetime) -> "datetime.date":
    """The night a timestamp belongs to, rolling over in the early morning."""
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    return (ts - timedelta(hours=NIGHT_ROLLOVER_HOURS)).date()


def readings_per_visit(rows: Iterable[dict]) -> dict:
    """
    A 'visit' is one scout at one venue on one night. Returns how many
    readings each visit produced. This is the direct measure of whether the
    decay prompt fixed staleness: it should move from about 1 toward 3 or 4.
    """
    visits = defaultdict(int)
    for r in rows:
        ts = r.get("timestamp")
        if not isinstance(ts, datetime):
            continue
        visits[(r.get("user_id"), r.get("venue_id"), night_of(ts))] += 1
    counts = list(visits.values())
    if not counts:
        return {"visits": 0, "mean": None, "median": None, "max": None}
    return {"visits": len(counts), "mean": round(mean(counts), 2),
            "median": median(counts), "max": max(counts)}


async def freshness_report(days: int = 14) -> dict:
    """
    Live freshness report, split into real users and demo scouts so the
    ambient engine can never dress up the real numbers.
    """
    from app.config import db

    now = datetime.now(timezone.utc)
    venues = await db.venues.find(
        {"is_demo": {"$ne": True}}, {"_id": 0, "id": 1, "last_rated_mins_ago": 1}
    ).to_list(500)
    ages = [v.get("last_rated_mins_ago") for v in venues]

    rows = await db.ratings.find(
        {"timestamp": {"$gte": now - timedelta(days=days)}},
        {"_id": 0, "user_id": 1, "venue_id": 1, "timestamp": 1},
    ).to_list(50000)
    real = [r for r in rows if not is_demo_user(r.get("user_id"))]
    demo = [r for r in rows if is_demo_user(r.get("user_id"))]

    return {
        "generated_at": now.isoformat(),
        "window_days": days,
        "median_age_minutes": median_age_minutes(ages),
        "coverage": fresh_coverage(ages, len(venues)),
        "real_users": {
            "ratings": len(real),
            "readings_per_visit": readings_per_visit(real),
        },
        "demo_scouts": {
            "ratings": len(demo),
            "readings_per_visit": readings_per_visit(demo),
        },
        "note": (
            "Coverage and median age are computed across all readings. "
            "readings_per_visit is split so ambient demo activity is never "
            "mistaken for real scout behaviour."
        ),
    }
