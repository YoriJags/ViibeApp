"""
First Spark / Pioneer — the cold-start core mechanic.

The first scout to call a dead venue tonight is the Pioneer. They get outsized
clout immediately plus a pending "I called it" claim. If the venue later heats
up, the claim is vindicated into a permanent badge — and the lower the venue was
when they called it, the better the call. This turns the empty-venue problem
("nobody wants to be first") into the reward ("everybody races to be first").

Pure module: decision math only, no Mongo/await. Orchestration (detecting the
first scout, persisting claims, resolving them) lives in the route. Tested with
closed-form values in tests/test_pioneer.py.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

# A venue must reach at least this energy to count as "heated up".
HEAT_THRESHOLD = 70.0
# ...and rise at least this much from where the pioneer called it.
MIN_RISE = 15.0

# Pioneer reward: outsized vs a normal rating (~5–10 clout).
PIONEER_CLOUT = 30
# Bonus clout floor when the call is vindicated (venue actually popped).
VINDICATION_CLOUT = 50


@dataclass(frozen=True)
class PioneerOutcome:
    is_pioneer: bool
    clout_awarded: int
    reason: str


def evaluate_pioneer(prior_presence_tonight: int, already_claimed: bool) -> PioneerOutcome:
    """
    First verified presence tonight AND no pioneer claimed yet → this scout is
    the Pioneer. `prior_presence_tonight` is the count of other verified
    arrivals (check-ins/ratings) at this venue since the night began, excluding
    the current one.
    """
    if already_claimed:
        return PioneerOutcome(False, 0, "venue already has a pioneer tonight")
    if prior_presence_tonight > 0:
        return PioneerOutcome(False, 0, "not the first scout tonight")
    return PioneerOutcome(True, PIONEER_CLOUT, "first spark — you called it first")


def is_vindicated(
    claim_score: float,
    peak_score: float,
    heat_threshold: float = HEAT_THRESHOLD,
    min_rise: float = MIN_RISE,
) -> bool:
    """Vindicated when the venue both reaches the heat threshold AND rose
    meaningfully from the score at the moment the pioneer called it."""
    return peak_score >= heat_threshold and (peak_score - claim_score) >= min_rise


def call_quality(claim_score: float, peak_score: float) -> float:
    """
    0–1 measure of how good the call was. Calling a near-dead venue that later
    peaks scores highest; calling an already-warm venue scores low. 0 if the
    venue didn't rise.
    """
    rise = peak_score - claim_score
    if rise <= 0:
        return 0.0
    return round(min(1.0, rise / 100.0), 3)


def vindication_reward(claim_score: float, peak_score: float) -> int:
    """Bonus clout for a vindicated call, scaled by call quality — earlier,
    lower calls pay more. 0 when not vindicated."""
    if not is_vindicated(claim_score, peak_score):
        return 0
    return VINDICATION_CLOUT + round(call_quality(claim_score, peak_score) * VINDICATION_CLOUT)


def badge_tier(vindicated_count: int) -> Optional[str]:
    """Permanent 'I called it' badge tier from lifetime vindicated calls."""
    if vindicated_count >= 25:
        return "Oracle"
    if vindicated_count >= 10:
        return "Prophet"
    if vindicated_count >= 3:
        return "Pioneer"
    if vindicated_count >= 1:
        return "First Spark"
    return None
