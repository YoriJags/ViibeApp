"""
Surge Policy — honest-scarcity rules for the Vibe Reactor.

Pure, closed-form functions (no DB, no I/O) so every rule is unit-testable.
The route (routes/surge.py) gathers the inputs; this module decides.

Three rules, all strict-mode (SURGE_STRICT env, default on):

1. Presence damping — bolts without verified coordinates inside the venue
   geofence count at REMOTE_TAP_WEIGHT (0.2x). Remote hype exists; it cannot
   drive levels. Verified taps count fully.

2. ELECTRIC corroboration gate — charge is capped just below the ELECTRIC
   threshold unless BOTH hold in the last 30 minutes:
     • >= MIN_PRESENT_TAPPERS unique verified-present tappers
     • >= 1 vibe check with energy 'lit' or 'peak'
   ELECTRIC fires city-wide pushes; it is the level that must not lie.
   Levels below it stay easy and fun.

3. Sustain window — ELECTRIC is entered only after charge has held at or
   above the threshold for SUSTAIN_MINUTES. A burst spike is POPPING at
   its ceiling, not peak energy.

Rationale: 3 crewmates could previously reach ELECTRIC in <4 minutes from
anywhere (no geofence on bolts), triggering "get in now" notifications.
That is the coordinated-ring shape, and it breaks the brand promise:
"we'd rather show you nothing than lie to you."
"""
from datetime import datetime

ELECTRIC_THRESHOLD = 0.84   # charge_pct at which ELECTRIC begins (mirrors LEVELS)
ELECTRIC_CAP = 0.839        # where charge parks when the gate is closed
REMOTE_TAP_WEIGHT = 0.2     # weight multiplier for taps without verified presence
MIN_PRESENT_TAPPERS = 5     # unique verified-present tappers needed for ELECTRIC
SUSTAIN_MINUTES = 10        # minutes charge must hold >= threshold before ELECTRIC


def presence_weight(is_present: bool) -> float:
    """Weight multiplier for a bolt tap based on verified presence."""
    return 1.0 if is_present else REMOTE_TAP_WEIGHT


def max_gate_open(present_tappers_30m: int, hot_ratings_30m: int) -> bool:
    """Corroboration gate: enough verified bodies AND at least one hot vibe check."""
    return present_tappers_30m >= MIN_PRESENT_TAPPERS and hot_ratings_30m >= 1


def apply_max_gate(charge_pct: float, gate_open: bool) -> float:
    """Cap charge below ELECTRIC while the corroboration gate is closed."""
    if charge_pct >= ELECTRIC_THRESHOLD and not gate_open:
        return ELECTRIC_CAP
    return charge_pct


def sustain_state(
    charge_pct: float,
    candidate_since: datetime | None,
    now: datetime,
) -> tuple[float, datetime | None]:
    """
    Track how long charge has held at/above the ELECTRIC threshold.

    Returns (effective_charge, new_candidate_since):
      • Below threshold      -> candidacy resets, charge passes through.
      • At/above, no candidacy yet -> candidacy starts now, charge capped.
      • At/above, held < SUSTAIN_MINUTES -> still capped.
      • At/above, held >= SUSTAIN_MINUTES -> ELECTRIC, charge passes through.
    """
    if charge_pct < ELECTRIC_THRESHOLD:
        return charge_pct, None
    if candidate_since is None:
        return ELECTRIC_CAP, now
    held_minutes = (now - candidate_since).total_seconds() / 60
    if held_minutes < SUSTAIN_MINUTES:
        return ELECTRIC_CAP, candidate_since
    return charge_pct, candidate_since


# Deprecated aliases, kept so nothing calling the old names breaks.
electric_gate_open = max_gate_open
apply_electric_gate = apply_max_gate
