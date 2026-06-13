"""
Prediction Market — cold-start mechanic #2.

Before the night unfolds, scouts stake clout on which venue will peak highest.
Pari-mutuel: every stake forms one pool; whoever called the winning venue splits
the pool proportionally to their stake. No house — the crowd's clout flows to the
crowd's correct callers. This makes the app worth opening at 8pm when every venue
is still quiet (you're forecasting, not reporting), and every stake is a
timestamped intent signal for the attribution loop + agent API.

Pure module: staking validation + payout math. Orchestration (clout balances,
market windows, resolution trigger) lives in the route. Tested with closed-form
values in tests/test_prediction.py.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

MIN_STAKE = 5
MAX_STAKE = 500
# Optional clout sink to fight inflation; 0.0 = pure pari-mutuel (whole pool paid out).
DEFAULT_RAKE = 0.0


@dataclass(frozen=True)
class Prediction:
    scout_id: str
    venue_id: str
    stake: int


@dataclass(frozen=True)
class StakeCheck:
    ok: bool
    reason: str


def validate_stake(
    stake: int,
    balance: int,
    min_stake: int = MIN_STAKE,
    max_stake: int = MAX_STAKE,
) -> StakeCheck:
    if stake < min_stake:
        return StakeCheck(False, f"minimum stake is {min_stake}")
    if stake > max_stake:
        return StakeCheck(False, f"maximum stake is {max_stake}")
    if stake > balance:
        return StakeCheck(False, "insufficient clout")
    return StakeCheck(True, "ok")


def compute_payouts(
    predictions: Iterable[Prediction],
    winning_venue_id: str,
    rake: float = DEFAULT_RAKE,
) -> dict:
    """
    Pari-mutuel settlement. Returns {scout_id: payout}.
      - Winners (called the winning venue) split the pool proportional to stake.
      - If nobody called the winner, it's a push — every stake is refunded.
    Payouts are gross (include the scout's own returned stake).
    """
    preds = list(predictions)
    total = sum(p.stake for p in preds)
    if total <= 0:
        return {}

    winners = [p for p in preds if p.venue_id == winning_venue_id]
    winning_stake = sum(p.stake for p in winners)

    if winning_stake == 0:
        refunds: dict = {}
        for p in preds:
            refunds[p.scout_id] = refunds.get(p.scout_id, 0) + p.stake
        return refunds

    pool = total * (1.0 - max(0.0, min(rake, 0.5)))
    payouts: dict = {}
    for w in winners:
        payouts[w.scout_id] = payouts.get(w.scout_id, 0) + round(pool * (w.stake / winning_stake))
    return payouts


def implied_odds(predictions: Iterable[Prediction], venue_id: str) -> float:
    """
    Live decimal odds for a venue = total_pool / stake_on_venue. Surfaced to
    scouts so calling an unpopular (contrarian) venue visibly pays more. 0 when
    nothing is staked on it yet.
    """
    preds = list(predictions)
    total = sum(p.stake for p in preds)
    on_venue = sum(p.stake for p in preds if p.venue_id == venue_id)
    if on_venue <= 0:
        return 0.0
    return round(total / on_venue, 2)
