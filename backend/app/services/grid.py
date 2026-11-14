"""
The city grid (PLAN.md Phase 4): Lagos as hexagons, not only venue pins.

A venue reading is a sensor. A cell is what the sensors add up to over a patch
of the city: its energy, how far to trust it, and what it was built from. This
is the surface the map's heat layer and, later, the paid history API read.

Cells are H3 hexagons (Uber's index), so every zoom has a clean parent and
child and a cell id means the same patch of ground forever.

Honesty rules, the same ones a single venue obeys:

  * Real and demo readings are never blended. A cell with any real reading is
    built from the real ones only; a cell with only demo readings is labelled
    demo and carries no confidence.
  * A reading counts in proportion to its confidence, so one unconfirmed
    voice cannot paint a neighbourhood.
  * A cell with venues but no reading says so (source "none"); it is never
    drawn as quiet, because not knowing is not the same as knowing it is quiet.

Pure functions over venue payloads that already carry confidence
(services/reading_confidence.attach_confidence). No I/O.

# TODO(scale-gate-A): swap to TimescaleDB + PostGIS at Series A. Cells then
# become a continuous aggregate over raw signals instead of a fold over venues.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Iterable, Optional

import h3

from app.services.energy_decay import EnergyReading
from app.services.reading_confidence import (
    FRESH_FULL_MIN, STALE_MIN, EXPIRED_MIN, SOLID_AT, _as_utc,
)
from app.services.synthetic import SOURCE_DEMO, SOURCE_NONE, SOURCE_SCOUTS

# Map zoom -> H3 resolution. Hexagon edge: res 7 about 1.4 km (the city at a
# glance), res 8 about 530 m (a district), res 9 about 200 m (a street corner).
MIN_RES, MAX_RES = 7, 9


def resolution_for_zoom(zoom: float) -> int:
    if zoom < 11:
        return 7
    if zoom < 13:
        return 8
    return 9


def cell_for(lat: float, lng: float, resolution: int) -> str:
    return h3.latlng_to_cell(lat, lng, resolution)


def _coords(venue: dict) -> Optional[tuple[float, float]]:
    c = venue.get("coordinates") or {}
    try:
        lat, lng = float(c.get("lat")), float(c.get("lng"))
    except (TypeError, ValueError):
        return None
    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        return None
    return lat, lng


def decay_state(age_minutes: Optional[float]) -> str:
    """Where the cell's newest reading sits on the decay clock."""
    if age_minutes is None or age_minutes >= EXPIRED_MIN:
        return "none"
    if age_minutes <= FRESH_FULL_MIN:
        return "fresh"
    if age_minutes <= STALE_MIN:
        return "fading"
    return "stale"


def _boundary(cell: str) -> list[list[float]]:
    """Closed GeoJSON ring, [lng, lat] order."""
    ring = [[round(lng, 6), round(lat, 6)] for lat, lng in h3.cell_to_boundary(cell)]
    ring.append(ring[0])
    return ring


def _fold(cell: str, venues: list[dict], now: datetime,
          presence: dict[str, EnergyReading]) -> dict:
    real = [v for v in venues
            if v.get("energy_source") == SOURCE_SCOUTS and (v.get("confidence") or 0) > 0]
    demo = [v for v in venues if v.get("energy_source") == SOURCE_DEMO]

    lat, lng = h3.cell_to_latlng(cell)
    out = {
        "cell": cell,
        "center": {"lat": round(lat, 6), "lng": round(lng, 6)},
        "boundary": _boundary(cell),
        "venues": len(venues),
        "venues_read": 0,
        "venue_ids": [v["id"] for v in venues if v.get("id")],
        "energy": None,          # 0..1
        "score": None,           # 0..100, the same scale a venue uses
        "confidence": None,      # 0..1
        "solid": False,          # the honest-map rule: draw saturated only if True
        "source": SOURCE_NONE,
        "decay_state": "none",
        "active_scouts": 0,
        "layer_breakdown": None,
    }

    if real:
        weights = [float(v["confidence"]) for v in real]
        total = sum(weights)
        score = sum(w * float(v.get("current_vibe_score") or 0) for w, v in zip(weights, real)) / total
        # The confidence of the evidence that actually drives the number.
        confidence = sum(w * w for w in weights) / total
        ages = []
        for v in real:
            last = _as_utc(v.get("last_rated_at"))
            if last is not None:
                ages.append(max(0.0, (now - last).total_seconds() / 60.0))
        out.update({
            "venues_read": len(real),
            "score": round(score, 1),
            "energy": round(score / 100.0, 3),
            "confidence": round(confidence, 2),
            "solid": confidence >= SOLID_AT,
            "source": SOURCE_SCOUTS,
            "decay_state": decay_state(min(ages) if ages else None),
            "active_scouts": sum(int(v.get("active_scouts") or 0) for v in real),
        })
    elif demo:
        score = sum(float(v.get("current_vibe_score") or 0) for v in demo) / len(demo)
        out.update({
            "venues_read": len(demo),
            "score": round(score, 1),
            "energy": round(score / 100.0, 3),
            "source": SOURCE_DEMO,
            "decay_state": "fresh",
        })

    # What the decay engine currently holds for the venues in this cell.
    layers = [presence[v["id"]].layer_breakdown for v in venues if v.get("id") in presence]
    if layers:
        out["layer_breakdown"] = {
            name: round(sum(l.get(name, 0.0) for l in layers) / len(layers), 4)
            for name in ("L1", "L2", "L3", "L4")
        }
    return out


def build_grid(venues: Iterable[dict], resolution: int, now: Optional[datetime] = None,
               presence: Optional[dict[str, EnergyReading]] = None) -> list[dict]:
    """
    Fold venue payloads into hex cells at one resolution. Venues without usable
    coordinates are skipped. Cells come back hottest first, unread cells last.
    """
    if not (MIN_RES <= resolution <= MAX_RES):
        raise ValueError(f"resolution must be {MIN_RES}..{MAX_RES}")
    now = _as_utc(now) or datetime.now(timezone.utc)
    presence = presence or {}

    buckets: dict[str, list[dict]] = {}
    for v in venues:
        at = _coords(v)
        if at is None:
            continue
        buckets.setdefault(cell_for(at[0], at[1], resolution), []).append(v)

    cells = [_fold(cell, vs, now, presence) for cell, vs in buckets.items()]
    cells.sort(key=lambda c: (c["score"] is None, -(c["score"] or 0), c["cell"]))
    return cells
