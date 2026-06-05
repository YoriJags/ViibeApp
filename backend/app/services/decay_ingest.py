"""
Phase 2 — Layer Ingestion adapter.

Bridges live app events into the Energy Decay Engine (Phase 1). Each raw
signal is normalised to [0..1] and pushed onto the right decay layer for the
venue's V-Pixel. Pure in-memory + synchronous — no Mongo, no await — so it
can be called inline from socket handlers and routes without adding latency
to the hot path. The decay clock + trust gates live in `energy_decay`; this
module only translates and routes.

Signal → layer mapping
----------------------
vibe_pulse (tap, G-force)   -> L1 active    (τ ~45s)
dwell heartbeat             -> L2 presence  (τ ~180s)
ambient dB (mic, opt-in)    -> L3 ambient   (τ ~480s)
geofence exit               -> apply_departure (subtract scout's share)

# TODO(P4): cell_id is the venue_id today. Swap `_cell_for_venue` to an H3
# hex lookup when the grid API lands, so a venue maps to its geographic cell
# and adjacent venues share corridor energy.
"""
from __future__ import annotations

import time
from typing import Optional

from app.services.energy_decay import (
    registry,
    apply_signal,
    apply_departure,
    compute,
    EnergyReading,
)

# ─── Normalisation constants ──────────────────────────────────────────────────

# G-force: a chill body-tap sits near 1.0g, a full peak tap exceeds 2.5g.
G_FORCE_FLOOR = 1.0
G_FORCE_CEIL = 2.5
# A legit tap always carries *some* active energy, even at floor G-force.
MIN_LEGIT_TAP = 0.15
# A stationary "peak" claim (low G but claiming peak) is fraud — cap it hard.
# The engine's G1 gate also discounts this against collapsing presence, but
# capping at ingest keeps the layer honest at the source.
ABUSE_L1_CAP = 0.2

# A presence heartbeat is binary: the scout is physically here. The L2 decay
# clock (τ=180s) handles staleness between heartbeats — we don't fade it here.
PRESENCE_VALUE = 1.0

# Ambient dB is negative (0 = loudest, -160 = silence). Map the useful band.
DB_LOUD = -20.0    # club-loud
DB_QUIET = -80.0   # near-silent room


def _now(now: Optional[float]) -> float:
    return time.time() if now is None else now


def _cell_for_venue(venue_id: str) -> str:
    """Venue → V-Pixel cell id. Identity today; H3 hex at P4."""
    return venue_id


def _norm_g_force(g: float) -> float:
    if g <= G_FORCE_FLOOR:
        return 0.0
    return min(1.0, (g - G_FORCE_FLOOR) / (G_FORCE_CEIL - G_FORCE_FLOOR))


def _norm_db(db_level: float) -> float:
    if db_level <= DB_QUIET:
        return 0.0
    if db_level >= DB_LOUD:
        return 1.0
    return (db_level - DB_QUIET) / (DB_LOUD - DB_QUIET)


# ─── Ingestion entry points (called from the hot path) ────────────────────────

def ingest_pulse(
    venue_id: str,
    scout_id: Optional[str],
    avg_g_force: float = 1.0,
    stationary_peak_abuse: bool = False,
    now: Optional[float] = None,
) -> None:
    """L1 — a kinetic tap from VibeReactor. Strength derives from G-force."""
    if not venue_id:
        return
    value = _norm_g_force(avg_g_force)
    if stationary_peak_abuse:
        value = min(value, ABUSE_L1_CAP)
    else:
        value = max(value, MIN_LEGIT_TAP)
    cell = registry.get_or_create(_cell_for_venue(venue_id))
    apply_signal(cell, "L1", value, scout_id, _now(now))


def ingest_dwell(
    venue_id: str,
    scout_id: Optional[str],
    now: Optional[float] = None,
) -> None:
    """L2 — a presence heartbeat. The scout is inside the geofence right now."""
    if not venue_id:
        return
    cell = registry.get_or_create(_cell_for_venue(venue_id))
    apply_signal(cell, "L2", PRESENCE_VALUE, scout_id, _now(now))


def ingest_ambient(
    venue_id: str,
    db_level: float,
    scout_id: Optional[str] = None,
    now: Optional[float] = None,
) -> None:
    """L3 — opt-in mic dB. Loud room = high ambient energy floor."""
    if not venue_id:
        return
    cell = registry.get_or_create(_cell_for_venue(venue_id))
    apply_signal(cell, "L3", _norm_db(db_level), scout_id, _now(now))


def ingest_exit(
    venue_id: str,
    scout_id: str,
    now: Optional[float] = None,
) -> None:
    """
    Geofence exit — subtract this scout's contribution so departures decay the
    cell honestly instead of waiting out the full decay clock. No-op if the
    cell or scout was never seen.

    (Available + tested now; no backend exit event emits this yet — wired when
    the frontend geofence-exit signal lands.)
    """
    if not venue_id or not scout_id:
        return
    cell = registry.get(_cell_for_venue(venue_id))
    if cell is None:
        return
    apply_departure(cell, scout_id, _now(now))


def read_venue_energy(
    venue_id: str,
    now: Optional[float] = None,
) -> Optional[EnergyReading]:
    """Query surface — current blended energy + confidence for a venue.
    Returns None for a venue that has never received a signal."""
    cell = registry.get(_cell_for_venue(venue_id))
    if cell is None:
        return None
    return compute(cell, _now(now))
