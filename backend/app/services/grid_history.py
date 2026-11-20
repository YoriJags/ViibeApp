"""
Grid history: the city grid, kept over time.

The live grid answers "where is the energy now". Kept every ten minutes, it
answers the questions people pay for: how did Friday build, when does this
area peak, how does tonight compare with a usual night.

Only real readings are history. A demo cell is never recorded, and an unread
cell writes no row: a gap in the series means "nobody was reading here", which
is the truth, and is never filled in with a guess.

Forecasts obey the same rule as every other number in the product: built from
the cell's own past, on the same day of the week, and silent until there are
enough nights behind them.

Pure functions first; the recorder and the queries that touch Mongo are at
the bottom.

# TODO(scale-gate-A): swap to TimescaleDB + PostGIS at Series A. This
# collection becomes a hypertable and the curves become continuous aggregates.
"""
from __future__ import annotations

import asyncio
import os
from datetime import datetime, timedelta, timezone
from typing import Iterable, Optional

from app.services.freshness import night_of
from app.services.peak_forecast import lagos_hour
from app.services.reading_confidence import SOLID_AT, _as_utc
from app.services.synthetic import SOURCE_SCOUTS

BUCKET_MINUTES = 10
RESOLUTIONS = (7, 8, 9)

# Forecasts: same weekday, this many weeks back, and no claim without at least
# MIN_NIGHTS separate nights that have a trusted reading in the hour.
LOOKBACK_WEEKS = 8
MIN_NIGHTS = 3

# How far back a single query may reach.
MAX_HISTORY_HOURS = 24 * 7


def bucket_of(ts: datetime) -> datetime:
    """The ten-minute bucket a moment falls in (UTC, floored)."""
    ts = _as_utc(ts)
    return ts.replace(minute=ts.minute - ts.minute % BUCKET_MINUTES, second=0, microsecond=0)


def _most_common(values: list) -> Optional[str]:
    return max(set(values), key=values.count) if values else None


def rows_from_cells(cells: Iterable[dict], resolution: int, bucket: datetime,
                    city_of: dict[str, str], area_of: Optional[dict[str, str]] = None,
                    viibes_of: Optional[dict[str, int]] = None) -> list[dict]:
    """History rows for one fold of the grid. Real cells only.

    viibes_of: venue id -> rooms that went Viibe in this bucket. A Viibe is
    five or more people inside feeling the same moment, so it marks the exact
    ten minutes a cell went off, which a score alone cannot show."""
    area_of = area_of or {}
    viibes_of = viibes_of or {}
    rows = []
    for c in cells:
        if c.get("source") != SOURCE_SCOUTS or c.get("score") is None:
            continue
        ids = c.get("venue_ids", [])
        rows.append({
            "cell": c["cell"],
            "res": resolution,
            "bucket": bucket,
            "city": _most_common([city_of[v] for v in ids if city_of.get(v)]),
            # The neighbourhood most of the cell's venues call home, so a report
            # can say "Victoria Island" instead of a cell id.
            "area": _most_common([area_of[v] for v in ids if area_of.get(v)]),
            "score": c["score"],
            "confidence": c.get("confidence"),
            "solid": bool(c.get("solid")),
            "venues": c.get("venues", 0),
            "venues_read": c.get("venues_read", 0),
            "active_scouts": c.get("active_scouts", 0),
            "decay_state": c.get("decay_state"),
            "viibes": sum(viibes_of.get(v, 0) for v in ids),
        })
    return rows


def _point(row: dict) -> dict:
    return {
        "at": _as_utc(row["bucket"]).isoformat(),
        "score": row["score"],
        "confidence": row.get("confidence"),
        "solid": bool(row.get("solid")),
        "active_scouts": row.get("active_scouts", 0),
        "viibes": row.get("viibes", 0),
    }


def series(rows: Iterable[dict]) -> list[dict]:
    """One cell's rows as a time series, oldest first."""
    return [_point(r) for r in sorted(rows, key=lambda r: _as_utc(r["bucket"]))]


def summarise_night(rows: Iterable[dict]) -> Optional[dict]:
    """
    How one cell's night went: when it peaked, how high, when it first held a
    trusted reading at or above 50 (when the night "built"), and for how long
    it stayed there. Built only from trusted readings; None if there are none.
    """
    trusted = sorted((r for r in rows if r.get("solid")), key=lambda r: _as_utc(r["bucket"]))
    if not trusted:
        return None
    peak = max(trusted, key=lambda r: (r["score"], -_as_utc(r["bucket"]).timestamp()))
    hot = [r for r in trusted if r["score"] >= 50]
    return {
        "peak_score": peak["score"],
        "peak_at": _as_utc(peak["bucket"]).isoformat(),
        "built_at": _as_utc(hot[0]["bucket"]).isoformat() if hot else None,
        "minutes_at_50_plus": len(hot) * BUCKET_MINUTES,
        "first_reading_at": _as_utc(trusted[0]["bucket"]).isoformat(),
        "last_reading_at": _as_utc(trusted[-1]["bucket"]).isoformat(),
        "trusted_readings": len(trusted),
        "viibes": sum(r.get("viibes", 0) for r in rows),
    }


def city_timeline(rows: Iterable[dict]) -> list[dict]:
    """
    The city across one night, bucket by bucket: its confidence-weighted
    energy over the cells that had a real reading, and how many of those
    cells were trusted.
    """
    by_bucket: dict[datetime, list[dict]] = {}
    for r in rows:
        by_bucket.setdefault(_as_utc(r["bucket"]), []).append(r)
    out = []
    for bucket in sorted(by_bucket):
        cells = by_bucket[bucket]
        weights = [float(c.get("confidence") or 0) for c in cells]
        total = sum(weights)
        out.append({
            "at": bucket.isoformat(),
            "score": round(sum(w * c["score"] for w, c in zip(weights, cells)) / total, 1) if total else None,
            "cells_read": len(cells),
            "cells_trusted": sum(1 for c in cells if c.get("solid")),
            "active_scouts": sum(int(c.get("active_scouts") or 0) for c in cells),
        })
    return out


def typical_curve(rows: Iterable[dict], min_nights: int = MIN_NIGHTS) -> dict:
    """
    The cell's usual night, hour by hour (Lagos time), from trusted readings
    on past nights. An hour is reported only when at least `min_nights`
    separate nights back it; the peak hour only when some hour qualifies.

    Returns {"hours": {hour: {"score", "nights"}}, "peak_hour", "nights",
    "enough": bool}. When not enough, "hours" is empty and nothing is guessed.
    """
    # hour -> night -> scores
    seen: dict[int, dict] = {}
    nights = set()
    for r in rows:
        if not r.get("solid"):
            continue
        ts = _as_utc(r["bucket"])
        night = night_of(ts)
        nights.add(night)
        seen.setdefault(lagos_hour(ts), {}).setdefault(night, []).append(float(r["score"]))

    hours = {}
    for hour, per_night in seen.items():
        if len(per_night) < min_nights:
            continue
        # Each night counts once, so one long night cannot outvote three short ones.
        night_means = [sum(v) / len(v) for v in per_night.values()]
        hours[hour] = {"score": round(sum(night_means) / len(night_means), 1), "nights": len(per_night)}

    peak_hour = max(hours, key=lambda h: hours[h]["score"]) if hours else None
    return {
        "hours": dict(sorted(hours.items())),
        "peak_hour": peak_hour,
        "nights": len(nights),
        "enough": bool(hours),
        "min_nights": min_nights,
    }


def weekly_report(this_week: Iterable[dict], last_week: Iterable[dict]) -> dict:
    """
    "Where the scene heated up this week", from one resolution of history.

    Built only from trusted readings. A cell's level for a week is the mean of
    its nightly peaks, so one freak night does not define it. A cell is said to
    have heated up only if it has at least two nights in BOTH weeks; otherwise
    the comparison would be between a pattern and an accident.
    """
    import h3

    def per_cell(rows):
        cells: dict[str, dict] = {}
        for r in rows:
            if not r.get("solid"):
                continue
            c = cells.setdefault(r["cell"], {"nights": {}, "area": r.get("area"), "hot_buckets": 0})
            night = night_of(_as_utc(r["bucket"]))
            c["nights"][night] = max(c["nights"].get(night, 0.0), float(r["score"]))
            if r["score"] >= 50:
                c["hot_buckets"] += 1
            c["area"] = c["area"] or r.get("area")
        return cells

    def level(c):
        return sum(c["nights"].values()) / len(c["nights"])

    def describe(cell, c, **extra):
        lat, lng = h3.cell_to_latlng(cell)
        return {
            "cell": cell,
            "area": c["area"],
            "center": {"lat": round(lat, 5), "lng": round(lng, 5)},
            "nights": len(c["nights"]),
            "mean_nightly_peak": round(level(c), 1),
            "best_night_peak": round(max(c["nights"].values()), 1),
            "minutes_at_50_plus": c["hot_buckets"] * BUCKET_MINUTES,
            **extra,
        }

    this_week = list(this_week)
    now_cells, before_cells = per_cell(this_week), per_cell(last_week)
    trusted = [r for r in this_week if r.get("solid")]

    hottest = sorted(now_cells, key=lambda k: -level(now_cells[k]))[:5]
    risers = []
    for cell, c in now_cells.items():
        b = before_cells.get(cell)
        if b and len(c["nights"]) >= 2 and len(b["nights"]) >= 2:
            change = level(c) - level(b)
            if change > 0:
                risers.append((change, cell))
    risers.sort(reverse=True)

    by_night: dict = {}
    by_hour: dict[int, list[float]] = {}
    for r in trusted:
        ts = _as_utc(r["bucket"])
        night = night_of(ts)
        by_night[night] = max(by_night.get(night, 0.0), float(r["score"]))
        by_hour.setdefault(lagos_hour(ts), []).append(float(r["score"]))
    busiest = max(by_night, key=by_night.get) if by_night else None
    peak_hour = max(by_hour, key=lambda h: sum(by_hour[h]) / len(by_hour[h])) if by_hour else None

    return {
        "enough": bool(trusted),
        "coverage": {
            "trusted_readings": len(trusted),
            "cells": len(now_cells),
            "nights": len(by_night),
        },
        "hottest": [describe(k, now_cells[k]) for k in hottest],
        "heated_up": [
            describe(cell, now_cells[cell], change=round(change, 1),
                     last_week_mean_nightly_peak=round(level(before_cells[cell]), 1))
            for change, cell in risers[:5]
        ],
        "busiest_night": {"date": busiest.isoformat(), "peak": round(by_night[busiest], 1)} if busiest else None,
        "peak_hour_lagos": peak_hour,
    }


# ── Recorder ─────────────────────────────────────────────────────────────────

def recording_enabled() -> bool:
    return os.environ.get("GRID_HISTORY", "1") != "0"


async def record_grid(now: Optional[datetime] = None) -> int:
    """Fold the whole grid at every resolution and store this bucket. Returns rows written."""
    from app.config import db
    from app.services.decay_ingest import read_venue_energy
    from app.services.events import is_event, is_listed
    from app.services.grid import build_grid
    from app.services.reading_confidence import attach_confidence

    now = _as_utc(now) or datetime.now(timezone.utc)
    venues = await db.venues.find(
        {"is_suppressed": {"$ne": True}, "energy_source": SOURCE_SCOUTS}, {"_id": 0}
    ).to_list(5000)
    venues = [v for v in venues if not is_event(v) or is_listed(v, now)]
    if not venues:
        return 0

    presence = {}
    for v in venues:
        attach_confidence(v, now)
        reading = read_venue_energy(v["id"], now.timestamp()) if v.get("id") else None
        if reading is not None:
            presence[v["id"]] = reading
    city_of = {v["id"]: v.get("city") for v in venues if v.get("id")}
    area_of = {v["id"]: v.get("area") for v in venues if v.get("id")}

    bucket = bucket_of(now)
    # Viibes in this bucket so far. The pass repeats within a bucket and
    # replaces the row, so counting from the bucket start stays exact.
    viibes_of: dict[str, int] = {}
    async for lock in db.moment_locks.find(
        {"locked_at": {"$gte": bucket, "$lt": bucket + timedelta(minutes=BUCKET_MINUTES)}},
        {"_id": 0, "venue_id": 1},
    ):
        viibes_of[lock["venue_id"]] = viibes_of.get(lock["venue_id"], 0) + 1

    written = 0
    for res in RESOLUTIONS:
        for row in rows_from_cells(build_grid(venues, res, now, presence), res, bucket,
                                   city_of, area_of, viibes_of):
            # One upsert per cell: a city is a few hundred cells at most, and a
            # second pass in the same bucket replaces the row, never doubles it.
            await db.grid_history.update_one(
                {"cell": row["cell"], "bucket": bucket}, {"$set": row}, upsert=True
            )
            written += 1
    return written


async def record_loop():
    """Keep the grid on a clock. One bad pass must not stop every later one."""
    from app.config import logger

    while True:
        await asyncio.sleep(BUCKET_MINUTES * 60)
        try:
            await record_grid()
        except Exception as e:
            logger.warning(f"Grid history pass failed: {e}")


# ── Queries ──────────────────────────────────────────────────────────────────

async def cell_history(cell: str, hours: int, now: Optional[datetime] = None) -> list[dict]:
    from app.config import db

    now = _as_utc(now) or datetime.now(timezone.utc)
    since = now - timedelta(hours=min(max(1, hours), MAX_HISTORY_HOURS))
    return await db.grid_history.find(
        {"cell": cell, "bucket": {"$gte": since}}, {"_id": 0}
    ).sort("bucket", 1).to_list(5000)


def night_bounds(night) -> tuple[datetime, datetime]:
    """The UTC span of one night, matching freshness.night_of."""
    from app.services.freshness import NIGHT_ROLLOVER_HOURS

    start = datetime(night.year, night.month, night.day, tzinfo=timezone.utc) + timedelta(hours=NIGHT_ROLLOVER_HOURS)
    return start, start + timedelta(days=1)


async def night_rows(city: str, night, resolution: int) -> list[dict]:
    from app.config import db

    start, end = night_bounds(night)
    return await db.grid_history.find(
        {"city": city.lower(), "res": resolution, "bucket": {"$gte": start, "$lt": end}}, {"_id": 0}
    ).sort("bucket", 1).to_list(20000)


async def same_weekday_rows(cell: str, now: Optional[datetime] = None) -> list[dict]:
    """A cell's rows from past nights that fall on tonight's day of the week."""
    from app.config import db

    now = _as_utc(now) or datetime.now(timezone.utc)
    tonight = night_of(now)
    rows = await db.grid_history.find(
        {"cell": cell, "bucket": {"$gte": now - timedelta(weeks=LOOKBACK_WEEKS)}}, {"_id": 0}
    ).to_list(20000)
    return [
        r for r in rows
        if (n := night_of(_as_utc(r["bucket"]))) != tonight and n.weekday() == tonight.weekday()
    ]


async def week_rows(city: str, resolution: int, end: datetime) -> tuple[list[dict], list[dict]]:
    """History for the seven days up to `end`, and for the seven before that."""
    from app.config import db

    end = _as_utc(end)
    mid, start = end - timedelta(days=7), end - timedelta(days=14)

    async def span(a, b):
        return await db.grid_history.find(
            {"city": city.lower(), "res": resolution, "bucket": {"$gte": a, "$lt": b}}, {"_id": 0}
        ).to_list(50000)

    return await span(mid, end), await span(start, mid)
