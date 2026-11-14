"""
The city grid API (PLAN.md Phase 4).

  GET /grid/vpixels?bbox=west,south,east,north&zoom=13
  GET /grid/vpixels?city=lagos&zoom=11

Returns the hex cells covering the venues in view: energy, confidence, what
the reading was built from, and where it sits on the decay clock. See
services/grid.py for the rules.

History, which is the licensed product, needs an API key (X-API-Key):

  GET /grid/history?cell=<h3>&hours=24     one cell over time
  GET /grid/night?city=lagos&date=2026-11-13&zoom=12   how a night built
  GET /grid/forecast?cell=<h3>             the cell's usual night, and its peak hour

See services/grid_history.py.
"""
import time
from datetime import date, datetime, timezone
from typing import Optional

import h3
from fastapi import APIRouter, Depends, HTTPException, Query

from app.config import db
from app.services.decay_ingest import read_venue_energy
from app.services.events import is_event, is_listed
from app.services import grid_history
from app.services.freshness import night_of
from app.services.grid import build_grid, resolution_for_zoom
from app.routes.public_api import _require_api_key
from app.services.reading_confidence import attach_confidence

router = APIRouter(tags=["grid"])

# A bbox wider than this is a whole-country query; the grid is a city surface.
MAX_BBOX_DEGREES = 2.0
MAX_VENUES = 1000

# Five-second response cache, in memory. The grid is the same for everyone
# looking at the same patch, and trust only moves on the scale of minutes.
# TODO(scale-gate-A): move to Redis when the API runs on more than one replica.
CACHE_TTL_S = 5.0
_cache: dict[tuple, tuple[float, dict]] = {}
_CACHE_MAX = 256


def _parse_bbox(bbox: str) -> tuple[float, float, float, float]:
    try:
        west, south, east, north = (float(x) for x in bbox.split(","))
    except ValueError:
        raise HTTPException(status_code=422, detail="bbox must be west,south,east,north")
    ok = (-180 <= west < east <= 180) and (-90 <= south < north <= 90)
    if not ok:
        raise HTTPException(status_code=422, detail="bbox must be west,south,east,north")
    if east - west > MAX_BBOX_DEGREES or north - south > MAX_BBOX_DEGREES:
        raise HTTPException(status_code=422, detail="bbox is too large; zoom in to a city")
    return west, south, east, north


@router.get("/grid/vpixels")
async def get_vpixels(
    bbox: Optional[str] = Query(default=None, description="west,south,east,north"),
    city: Optional[str] = Query(default=None, max_length=60),
    zoom: float = Query(default=12, ge=0, le=22),
):
    if not bbox and not city:
        raise HTTPException(status_code=422, detail="Give a bbox or a city")

    resolution = resolution_for_zoom(zoom)
    query: dict = {"is_suppressed": {"$ne": True}}
    if bbox:
        west, south, east, north = _parse_bbox(bbox)
        query["coordinates.lat"] = {"$gte": south, "$lte": north}
        query["coordinates.lng"] = {"$gte": west, "$lte": east}
        # Round the key so a finger's drift on the map still hits the cache.
        key = ("bbox", round(west, 3), round(south, 3), round(east, 3), round(north, 3), resolution)
    else:
        query["city"] = city.lower()
        key = ("city", city.lower(), resolution)

    hit = _cache.get(key)
    if hit and time.monotonic() - hit[0] < CACHE_TTL_S:
        return hit[1]

    now = datetime.now(timezone.utc)
    venues = await db.venues.find(query, {"_id": 0}).to_list(MAX_VENUES)
    # An event ground is on the grid only around its dates, as on the venue list.
    venues = [v for v in venues if not is_event(v) or is_listed(v, now)]

    presence = {}
    for v in venues:
        attach_confidence(v, now)
        reading = read_venue_energy(v["id"], now.timestamp()) if v.get("id") else None
        if reading is not None:
            presence[v["id"]] = reading

    cells = build_grid(venues, resolution, now, presence)
    body = {
        "resolution": resolution,
        "generated_at": now.isoformat(),
        "venues": len(venues),
        "count": len(cells),
        "cells": cells,
    }

    if len(_cache) >= _CACHE_MAX:
        _cache.clear()
    _cache[key] = (time.monotonic(), body)
    return body


# ── History (API key) ────────────────────────────────────────────────────────

def _valid_cell(cell: str) -> str:
    if not h3.is_valid_cell(cell):
        raise HTTPException(status_code=422, detail="cell must be an H3 cell id")
    return cell


@router.get("/grid/history")
async def get_cell_history(
    cell: str = Query(..., max_length=20),
    hours: int = Query(default=24, ge=1, le=grid_history.MAX_HISTORY_HOURS),
    _key: dict = Depends(_require_api_key),
):
    """One cell's real readings over time, oldest first. Gaps are real gaps."""
    rows = await grid_history.cell_history(_valid_cell(cell), hours)
    return {
        "cell": cell,
        "hours": hours,
        "bucket_minutes": grid_history.BUCKET_MINUTES,
        "count": len(rows),
        "series": grid_history.series(rows),
    }


@router.get("/grid/night")
async def get_night(
    city: str = Query(..., max_length=60),
    night: Optional[date] = Query(default=None, alias="date", description="YYYY-MM-DD; default is tonight"),
    zoom: float = Query(default=12, ge=0, le=22),
    _key: dict = Depends(_require_api_key),
):
    """How a night built across a city: the city's timeline and each cell's night."""
    night = night or night_of(datetime.now(timezone.utc))
    resolution = resolution_for_zoom(zoom)
    rows = await grid_history.night_rows(city, night, resolution)

    by_cell: dict[str, list[dict]] = {}
    for r in rows:
        by_cell.setdefault(r["cell"], []).append(r)
    cells = []
    for cell, cell_rows in by_cell.items():
        summary = grid_history.summarise_night(cell_rows)
        if summary:
            cells.append({"cell": cell, **summary})
    cells.sort(key=lambda c: -c["peak_score"])

    return {
        "city": city.lower(),
        "date": night.isoformat(),
        "resolution": resolution,
        "bucket_minutes": grid_history.BUCKET_MINUTES,
        "timeline": grid_history.city_timeline(rows),
        "cells": cells,
    }


@router.get("/grid/forecast")
async def get_cell_forecast(
    cell: str = Query(..., max_length=20),
    _key: dict = Depends(_require_api_key),
):
    """
    The cell's usual night on tonight's day of the week, hour by hour in Lagos
    time, and the hour it usually peaks. Says plainly when there is not enough
    history to say anything.
    """
    rows = await grid_history.same_weekday_rows(_valid_cell(cell))
    curve = grid_history.typical_curve(rows)
    body = {"cell": cell, **curve}
    if not curve["enough"]:
        body["note"] = (
            f"Not enough history: {curve['nights']} past night(s) on this weekday, "
            f"and an hour needs {curve['min_nights']} to be reported."
        )
    return body
