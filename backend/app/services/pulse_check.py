"""
Pulse check — the one-tap refresh that keeps a reading from going stale.

A full vibe check is three questions, which is fine once per visit and far
too much to repeat every fifteen minutes. But a reading that is never
repeated is exactly how the map starts lying: energy decays in minutes and
the score decays with it.

So when a scout is still inside the venue and their reading is about to
expire, they are asked one thing instead of three:

    Still like this?   [ Same ]  [ Hotter ]  [ Cooling ]

The answer is expressed as a delta against what the room currently reads,
which is honest (a present person confirming or correcting a live number)
and costs about two seconds. Capacity and door state carry forward from the
venue's current consensus, because those are what the scout is implicitly
confirming by answering at all.
"""
from typing import Optional

# Ladder used by calculate_vibe_score; a delta moves one rung.
ENERGY_LADDER = ["quiet", "chill", "warming", "lit", "peak"]
DELTAS = {"same", "hotter", "cooling"}


def shift_energy(current: Optional[str], delta: str) -> str:
    """
    Move one rung up or down the energy ladder. Clamps at both ends: a room
    already reading peak cannot be reported hotter, and a dead one cannot get
    quieter. An unrecognised current level falls back to the middle rung
    rather than guessing high, so an unknown room never inflates.
    """
    if delta not in DELTAS:
        raise ValueError(f"unknown delta: {delta}")

    try:
        idx = ENERGY_LADDER.index(current)
    except ValueError:
        idx = ENERGY_LADDER.index("warming")

    if delta == "hotter":
        idx += 1
    elif delta == "cooling":
        idx -= 1
    return ENERGY_LADDER[max(0, min(len(ENERGY_LADDER) - 1, idx))]


def carry_forward(venue: dict) -> dict:
    """
    The parts of a reading a one-tap answer does not restate. Defaults are
    deliberately unflattering: an unknown room is sparse with a clear door,
    so a missing value can never manufacture energy.
    """
    capacity = venue.get("capacity_level")
    gate = venue.get("gate_level")
    return {
        "capacity": capacity if capacity in ("sparse", "vibrant", "full") else "sparse",
        "gate": gate if gate in ("clear", "slow", "blocked") else "clear",
    }
