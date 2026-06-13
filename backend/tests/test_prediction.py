"""
Prediction market core tests — closed-form pari-mutuel math, no Mongo.
A wrong payout here = real clout mispaid, so every case is exact.
"""
import pytest

from app.services.prediction import (
    Prediction,
    validate_stake,
    compute_payouts,
    implied_odds,
    MIN_STAKE,
    MAX_STAKE,
)


# ─── Stake validation ─────────────────────────────────────────────────────────

def test_stake_within_bounds_and_balance():
    assert validate_stake(50, balance=100).ok is True


def test_stake_below_minimum():
    c = validate_stake(MIN_STAKE - 1, balance=100)
    assert c.ok is False and "minimum" in c.reason


def test_stake_above_maximum():
    c = validate_stake(MAX_STAKE + 1, balance=10_000)
    assert c.ok is False and "maximum" in c.reason


def test_stake_exceeds_balance():
    c = validate_stake(80, balance=50)
    assert c.ok is False and "insufficient" in c.reason


# ─── Payouts ──────────────────────────────────────────────────────────────────

def test_single_winner_takes_whole_pool():
    preds = [
        Prediction("a", "quilox", 100),
        Prediction("b", "shiro", 50),
        Prediction("c", "shiro", 50),
    ]
    # quilox wins; only 'a' called it → 'a' takes the full 200 pool.
    payouts = compute_payouts(preds, "quilox")
    assert payouts == {"a": 200}


def test_two_winners_split_proportional_to_stake():
    preds = [
        Prediction("a", "quilox", 100),   # winner
        Prediction("b", "quilox", 50),    # winner
        Prediction("c", "shiro", 150),    # loser
    ]
    # pool 300, winning stake 150 → a:300*100/150=200, b:300*50/150=100
    payouts = compute_payouts(preds, "quilox")
    assert payouts == {"a": 200, "b": 100}
    assert sum(payouts.values()) == 300  # whole pool paid out


def test_push_refunds_everyone_when_nobody_called_winner():
    preds = [
        Prediction("a", "shiro", 100),
        Prediction("b", "escape", 50),
    ]
    # 'dna' won, nobody picked it → refund each their stake.
    payouts = compute_payouts(preds, "dna")
    assert payouts == {"a": 100, "b": 50}


def test_rake_skims_the_pool():
    preds = [Prediction("a", "q", 100), Prediction("b", "s", 100)]
    payouts = compute_payouts(preds, "q", rake=0.10)
    # pool 200 * 0.9 = 180, single winner → 180
    assert payouts == {"a": 180}


def test_empty_market_pays_nothing():
    assert compute_payouts([], "q") == {}


def test_same_scout_multiple_stakes_aggregate():
    preds = [Prediction("a", "q", 30), Prediction("a", "q", 70), Prediction("b", "s", 100)]
    payouts = compute_payouts(preds, "q")
    assert payouts == {"a": 200}


# ─── Implied odds ─────────────────────────────────────────────────────────────

def test_implied_odds_reward_contrarian():
    preds = [
        Prediction("a", "popular", 180),
        Prediction("b", "contrarian", 20),
    ]
    # total 200; popular: 200/180≈1.11, contrarian: 200/20=10.0
    assert implied_odds(preds, "popular") == pytest.approx(1.11, abs=0.01)
    assert implied_odds(preds, "contrarian") == 10.0


def test_implied_odds_zero_when_unstaked():
    preds = [Prediction("a", "q", 100)]
    assert implied_odds(preds, "untouched") == 0.0
