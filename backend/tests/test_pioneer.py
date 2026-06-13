"""
First Spark / Pioneer core tests — closed-form, no Mongo.
Verifies the cold-start reward + vindication math.
"""
import pytest

from app.services.pioneer import (
    evaluate_pioneer,
    is_vindicated,
    call_quality,
    vindication_reward,
    badge_tier,
    PIONEER_CLOUT,
    VINDICATION_CLOUT,
    HEAT_THRESHOLD,
    MIN_RISE,
)


# ─── Who is the pioneer ───────────────────────────────────────────────────────

def test_first_scout_is_pioneer():
    o = evaluate_pioneer(prior_presence_tonight=0, already_claimed=False)
    assert o.is_pioneer is True
    assert o.clout_awarded == PIONEER_CLOUT


def test_second_scout_is_not_pioneer():
    o = evaluate_pioneer(prior_presence_tonight=3, already_claimed=False)
    assert o.is_pioneer is False
    assert o.clout_awarded == 0


def test_already_claimed_blocks_pioneer_even_if_count_zero():
    # Defensive: race where the count looks empty but a claim exists.
    o = evaluate_pioneer(prior_presence_tonight=0, already_claimed=True)
    assert o.is_pioneer is False
    assert o.clout_awarded == 0


# ─── Vindication ──────────────────────────────────────────────────────────────

def test_vindicated_when_threshold_and_rise_met():
    # Called at 20, venue peaked at 88 → reached 70+ and rose 68.
    assert is_vindicated(20, 88) is True


def test_not_vindicated_if_below_threshold():
    # Rose a lot but never crossed the heat threshold.
    assert is_vindicated(10, HEAT_THRESHOLD - 1) is False


def test_not_vindicated_if_rise_too_small():
    # Already warm when called → small rise to peak, not a real "call".
    assert is_vindicated(HEAT_THRESHOLD, HEAT_THRESHOLD + MIN_RISE - 1) is False


def test_vindicated_exactly_at_bounds():
    assert is_vindicated(HEAT_THRESHOLD - MIN_RISE, HEAT_THRESHOLD) is True


# ─── Call quality + reward ────────────────────────────────────────────────────

def test_call_quality_rewards_lower_calls():
    # Calling from 5 → 95 is a better call than 50 → 95.
    assert call_quality(5, 95) > call_quality(50, 95)


def test_call_quality_zero_when_no_rise():
    assert call_quality(80, 80) == 0.0
    assert call_quality(80, 60) == 0.0


def test_vindication_reward_zero_when_not_vindicated():
    assert vindication_reward(80, 85) == 0  # rise < MIN_RISE


def test_vindication_reward_scales_with_quality():
    low_call = vindication_reward(10, 95)   # huge rise from near-dead
    warm_call = vindication_reward(40, 90)  # smaller rise
    assert low_call > warm_call
    assert low_call >= VINDICATION_CLOUT


# ─── Badge tiers ──────────────────────────────────────────────────────────────

def test_badge_tiers():
    assert badge_tier(0) is None
    assert badge_tier(1) == "First Spark"
    assert badge_tier(3) == "Pioneer"
    assert badge_tier(10) == "Prophet"
    assert badge_tier(25) == "Oracle"
    assert badge_tier(100) == "Oracle"
