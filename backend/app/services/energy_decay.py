"""
Energy Decay Engine — VIIBE V-Pixel keystone (PLAN.md Phase 1).

Treats venue / cell energy as a 4-layer signal model with independent decay
constants. Energy bleeds out automatically; new signals fight the decay.
The whole point: stale peaks become mathematically impossible.

Layers
------
L1 — Active     (taps, G-force, BPM)              τ =   45s   half-life ~31s
L2 — Presence   (dwell heartbeats, geofence)      τ =  180s   half-life ~125s
L3 — Ambient    (mic dB, BLE density)             τ =  480s   half-life ~333s
L4 — Inference  (Lindy, historical phase, prior)  τ = 3600s   half-life ~2500s

Energy at time t (per V-Pixel):
    E(t) = Σ_i  w_i · S_i · exp(-(t - t_i_last) / τ_i)

Where S_i is the latest sample for layer i and w_i are the blend weights.

Cross-validation gates (encoded in `compute()`):
    G1 — L1 high & L2 collapsing  → trust L2, discount L1   (kills home-tap fraud)
    G2 — <2 distinct scouts in 60s → confidence < 0.5        (translucent render)
    G3 — zero presence heartbeats in 90s → L2 collapses      (regardless of L1)

This module is pure Python. No I/O, no Mongo, no Redis. State containers are
in-memory; persistence is a P2 concern. Tests live in `tests/test_energy_decay.py`.

# TODO(scale-gate-A): when migrating to TimescaleDB + PostGIS at Series A,
# the per-cell decay clock becomes a continuous aggregate; this in-memory
# tick loop becomes the warm cache only. Cell IDs migrate to H3 hex indices.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Dict, Optional

# ─── Layer constants ──────────────────────────────────────────────────────────

TAU_L1 = 45.0    # active   — taps, G-force, BPM
TAU_L2 = 180.0   # presence — dwell heartbeats
TAU_L3 = 480.0   # ambient  — mic dB, BLE density
TAU_L4 = 3600.0  # inference — Lindy, prior

# Blend weights — sum to 1.0, fast layers dominate when present
W_L1 = 0.45
W_L2 = 0.30
W_L3 = 0.15
W_L4 = 0.10

# Trust gates
PRESENCE_HEARTBEAT_DEAD_S = 90.0   # G3 — zero heartbeats within this → L2 dies
SCOUT_CONFIRMATION_WINDOW_S = 60.0  # G2 — must see ≥2 scouts in this window
MIN_SCOUTS_FOR_CONFIDENCE = 2

# Cross-validation: if L1 sample is hot but L2 is decaying fast, discount L1
L1_HOT_THRESHOLD = 0.6      # normalised L1 sample [0..1]
L2_COLLAPSE_RATIO = 0.3     # L2 below 30% of its last sample = collapsing
L1_DISCOUNT_FACTOR = 0.25   # apply L1 at 25% of nominal weight when gated

LAYER_NAMES = ("L1", "L2", "L3", "L4")


# ─── State containers ─────────────────────────────────────────────────────────

@dataclass
class LayerSignal:
    """A single layer's latest sample + when it landed."""
    value: float = 0.0          # normalised [0..1]
    last_ts: float = -1.0       # epoch seconds; <0 = never seen
    last_sample_value: float = 0.0  # what we last received raw (for collapse detection)


@dataclass
class ScoutContribution:
    """Per-scout contribution snapshot — used for departures + confirmation gate."""
    scout_id: str
    last_ts: float
    last_l1: float = 0.0
    last_l2: float = 0.0


@dataclass
class VPixelState:
    """Per-V-Pixel state container. Cell ID is the dict key in the registry."""
    cell_id: str
    L1: LayerSignal = field(default_factory=LayerSignal)
    L2: LayerSignal = field(default_factory=LayerSignal)
    L3: LayerSignal = field(default_factory=LayerSignal)
    L4: LayerSignal = field(default_factory=LayerSignal)
    scouts: Dict[str, ScoutContribution] = field(default_factory=dict)

    def layer(self, name: str) -> LayerSignal:
        return getattr(self, name)


# ─── Pure functions ───────────────────────────────────────────────────────────

def _decay(signal: LayerSignal, tau: float, now: float) -> float:
    """Exponential decay of a single layer's value at time `now`."""
    if signal.last_ts < 0:
        return 0.0
    age = max(0.0, now - signal.last_ts)
    return signal.value * math.exp(-age / tau)


def _active_scouts(state: VPixelState, now: float, window_s: float) -> int:
    """Count distinct scouts with contribution inside the window."""
    cutoff = now - window_s
    return sum(1 for c in state.scouts.values() if c.last_ts >= cutoff)


def _l2_is_collapsing(state: VPixelState, now: float) -> bool:
    """L2 is collapsing if its current decayed value is < 30% of its last raw sample."""
    if state.L2.last_sample_value <= 0:
        return False
    current = _decay(state.L2, TAU_L2, now)
    return current < (state.L2.last_sample_value * L2_COLLAPSE_RATIO)


def _presence_is_dead(state: VPixelState, now: float) -> bool:
    """
    G3 — zero presence heartbeats within the dead window.
    Only fires when L2 was previously seen and has gone stale. A never-seen
    L2 isn't "dead" — it's absent, and absent already evaluates to zero.
    """
    if state.L2.last_ts < 0:
        return False
    return (now - state.L2.last_ts) > PRESENCE_HEARTBEAT_DEAD_S


@dataclass
class EnergyReading:
    """Output of `compute()` — what the V-Pixel API serves."""
    energy: float          # blended [0..1]
    confidence: float      # [0..1] — 0 if no signal, 0.5 if single-scout, 1 if all gates pass
    layer_breakdown: Dict[str, float]   # decayed value per layer
    active_scouts: int
    gates_failed: list     # list of "G1" / "G2" / "G3" strings — useful for UI debug


def compute(state: VPixelState, now: float) -> EnergyReading:
    """
    Pure function. Returns the cell's current energy + confidence + diagnostics.
    Does NOT mutate state. Safe to call from any thread / coroutine.
    """
    l1 = _decay(state.L1, TAU_L1, now)
    l2 = _decay(state.L2, TAU_L2, now)
    l3 = _decay(state.L3, TAU_L3, now)
    l4 = _decay(state.L4, TAU_L4, now)

    gates_failed = []

    # G3 — presence heartbeats dead → L2 collapses to zero, period
    if _presence_is_dead(state, now):
        l2 = 0.0
        gates_failed.append("G3")

    # G1 — L1 hot but L2 collapsing → trust L2, discount L1 (home-tap fraud)
    w_l1 = W_L1
    if l1 > L1_HOT_THRESHOLD and _l2_is_collapsing(state, now):
        w_l1 = W_L1 * L1_DISCOUNT_FACTOR
        gates_failed.append("G1")

    # Renormalise weights when a layer is actively dead so blend stays [0..1]
    weights = [w_l1, W_L2, W_L3, W_L4]
    values  = [l1, l2, l3, l4]
    weight_sum = sum(weights)
    energy = sum(w * v for w, v in zip(weights, values)) / weight_sum if weight_sum > 0 else 0.0
    energy = max(0.0, min(1.0, energy))

    # G2 — confidence depends on scout confirmation in the recent window
    active = _active_scouts(state, now, SCOUT_CONFIRMATION_WINDOW_S)
    if active < MIN_SCOUTS_FOR_CONFIDENCE and energy > 0.05:
        # Single-scout cells render translucent
        confidence = 0.5
        gates_failed.append("G2")
    elif energy <= 0.05:
        # Cold cell — confidence still high (we *know* it's cold)
        confidence = 1.0
    else:
        confidence = 1.0

    return EnergyReading(
        energy=round(energy, 4),
        confidence=confidence,
        layer_breakdown={
            "L1": round(l1, 4),
            "L2": round(l2, 4),
            "L3": round(l3, 4),
            "L4": round(l4, 4),
        },
        active_scouts=active,
        gates_failed=gates_failed,
    )


# ─── Mutators (state-changing) ────────────────────────────────────────────────

def apply_signal(
    state: VPixelState,
    layer: str,
    value: float,
    scout_id: Optional[str],
    now: float,
) -> None:
    """
    Apply a new sample to a layer. `value` must be normalised [0..1].
    `scout_id` is optional (L4 inference doesn't have one); when present
    it's tracked for the confirmation + departure gates.
    """
    if layer not in LAYER_NAMES:
        raise ValueError(f"unknown layer {layer!r}, expected one of {LAYER_NAMES}")
    value = max(0.0, min(1.0, value))

    sig = state.layer(layer)
    # Set the new value as the live signal — older decay is replaced, not blended.
    # This is correct: a fresh sample IS the current truth for that layer.
    sig.value = value
    sig.last_ts = now
    sig.last_sample_value = value

    if scout_id:
        contrib = state.scouts.get(scout_id) or ScoutContribution(scout_id=scout_id, last_ts=now)
        contrib.last_ts = now
        if layer == "L1":
            contrib.last_l1 = value
        elif layer == "L2":
            contrib.last_l2 = value
        state.scouts[scout_id] = contrib


def apply_departure(state: VPixelState, scout_id: str, now: float) -> None:
    """
    Geofence-exit detected. Subtract this scout's contribution.
    Implementation: drop them from the scout map and *immediately decay* L1/L2
    proportionally to their share. Rest is left to the natural decay clock.
    """
    contrib = state.scouts.pop(scout_id, None)
    if contrib is None:
        return

    remaining = max(1, len(state.scouts))  # avoid div-by-zero; keep dignity
    # Fractional reduction — if a single scout was 50% of the cell, removing them halves L1/L2
    total_l1 = sum(c.last_l1 for c in state.scouts.values()) + contrib.last_l1
    total_l2 = sum(c.last_l2 for c in state.scouts.values()) + contrib.last_l2

    if total_l1 > 0:
        share = contrib.last_l1 / total_l1
        state.L1.value = max(0.0, state.L1.value * (1.0 - share))
    if total_l2 > 0:
        share = contrib.last_l2 / total_l2
        state.L2.value = max(0.0, state.L2.value * (1.0 - share))

    # last_sample_value stays — the historical "what was the peak" record


def prune_stale_scouts(state: VPixelState, now: float, max_age_s: float = 300.0) -> int:
    """Remove scouts who haven't contributed in `max_age_s`. Returns count pruned."""
    cutoff = now - max_age_s
    stale = [sid for sid, c in state.scouts.items() if c.last_ts < cutoff]
    for sid in stale:
        del state.scouts[sid]
    return len(stale)


# ─── Registry — in-memory cell store ──────────────────────────────────────────
# P2 wires this to real ingest paths. P4 exposes it via /api/grid/vpixels.
# # TODO(scale-gate-A): replace with Redis hash + per-cell shard at Series A.

class CellRegistry:
    """
    Thin map of cell_id → VPixelState. Single-instance memory only.
    Multi-replica deploys need Redis (P2 follow-up).
    """
    def __init__(self) -> None:
        self._cells: Dict[str, VPixelState] = {}

    def get_or_create(self, cell_id: str) -> VPixelState:
        cell = self._cells.get(cell_id)
        if cell is None:
            cell = VPixelState(cell_id=cell_id)
            self._cells[cell_id] = cell
        return cell

    def get(self, cell_id: str) -> Optional[VPixelState]:
        return self._cells.get(cell_id)

    def all_cells(self):
        return self._cells.values()

    def __len__(self) -> int:
        return len(self._cells)


# Module-level singleton — services import this directly.
registry = CellRegistry()
