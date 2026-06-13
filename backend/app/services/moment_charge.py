"""
Async Moment — cold-start mechanic #4.

The original Moment needs 5 scouts to trigger within an 8-second window — almost
impossible at low density. The async Moment instead lets a venue *charge* across
the night: every contribution (a moment gesture, a tap, an arrival) adds weighted
charge that decays slowly, and when cumulative charge crosses a threshold the
Moment unlocks — no simultaneity required. Everyone who contributed is a
participant. This makes Moments reachable on a quiet Tuesday, not just a packed
Friday.

Pure module: charge math only. Orchestration (persisting contributions, emitting
the unlock) lives in the route. Tested in tests/test_moment_charge.py.
"""
from __future__ import annotations

import math
from typing import Iterable, Tuple

# Weighted charge per contribution kind — a deliberate gesture is worth more
# than a passive tap or a mere arrival.
CHARGE_WEIGHTS = {
    "shake":         1.0,
    "raise_to_face": 0.8,
    "back_tap":      0.6,
    "tap":           0.25,
    "arrival":       0.4,
}
DEFAULT_WEIGHT = 0.25

# Slow decay so charge accumulates over an evening but can't persist for days.
# τ = 2700s (~45 min) → a contribution still counts ~half an hour later.
CHARGE_TAU = 2700.0

# Cumulative weighted charge required to unlock an async Moment.
UNLOCK_THRESHOLD = 8.0

# A single scout can only contribute so much on their own — caps solo farming.
PER_SCOUT_CAP = 3.0

# Contribution = (timestamp_seconds, kind, scout_id)
Contribution = Tuple[float, str, str]


def contribution_weight(kind: str) -> float:
    return CHARGE_WEIGHTS.get(kind, DEFAULT_WEIGHT)


def current_charge(
    contributions: Iterable[Contribution],
    now: float,
    tau: float = CHARGE_TAU,
    per_scout_cap: float = PER_SCOUT_CAP,
) -> float:
    """
    Cumulative decayed charge. Each contribution decays as exp(-(now-t)/τ); each
    scout's total contribution is capped so one person can't unlock it alone.
    """
    per_scout: dict = {}
    for ts, kind, scout_id in contributions:
        age = max(0.0, now - ts)
        weighted = contribution_weight(kind) * math.exp(-age / tau)
        per_scout[scout_id] = per_scout.get(scout_id, 0.0) + weighted
    return round(sum(min(v, per_scout_cap) for v in per_scout.values()), 4)


def is_unlocked(charge: float, threshold: float = UNLOCK_THRESHOLD) -> bool:
    return charge >= threshold


def progress(charge: float, threshold: float = UNLOCK_THRESHOLD) -> float:
    """0–1 toward unlock, for the charging UI."""
    if threshold <= 0:
        return 1.0
    return round(min(1.0, charge / threshold), 3)


def participants(contributions: Iterable[Contribution]) -> set:
    """Distinct scouts who contributed (the Moment's co-authors)."""
    return {scout_id for _, _, scout_id in contributions if scout_id}
