"""
Async Moment charge core tests — closed-form decay + cap math, no Mongo.
"""
import math
import pytest

from app.services.moment_charge import (
    contribution_weight,
    current_charge,
    is_unlocked,
    progress,
    participants,
    CHARGE_TAU,
    UNLOCK_THRESHOLD,
    PER_SCOUT_CAP,
    DEFAULT_WEIGHT,
)


def test_weights_rank_gestures_above_taps():
    assert contribution_weight("shake") > contribution_weight("tap")
    assert contribution_weight("unknown_kind") == DEFAULT_WEIGHT


def test_fresh_contributions_sum_full_weight():
    now = 1000.0
    c = [(now, "shake", "a"), (now, "tap", "b")]
    # shake 1.0 + tap 0.25, no decay
    assert current_charge(c, now=now) == pytest.approx(1.25, abs=1e-3)


def test_charge_decays_over_time():
    c = [(1000.0, "shake", "a")]
    fresh = current_charge(c, now=1000.0)
    later = current_charge(c, now=1000.0 + CHARGE_TAU)  # one tau later
    assert later == pytest.approx(fresh * math.exp(-1), rel=0.02)


def test_per_scout_cap_blocks_solo_farming():
    now = 1000.0
    # One scout shakes 10 times — capped at PER_SCOUT_CAP.
    solo = [(now, "shake", "a")] * 10
    assert current_charge(solo, now=now) == pytest.approx(PER_SCOUT_CAP, abs=1e-3)


def test_many_scouts_clear_threshold():
    now = 1000.0
    # 9 distinct scouts each shake once (1.0) → 9.0 >= threshold(8.0)
    c = [(now, "shake", f"s{i}") for i in range(9)]
    charge = current_charge(c, now=now)
    assert charge >= UNLOCK_THRESHOLD
    assert is_unlocked(charge) is True


def test_not_unlocked_below_threshold():
    now = 1000.0
    c = [(now, "tap", f"s{i}") for i in range(5)]  # 5 * 0.25 = 1.25
    assert is_unlocked(current_charge(c, now=now)) is False


def test_progress_is_clamped_fraction():
    assert progress(4.0, threshold=8.0) == 0.5
    assert progress(20.0, threshold=8.0) == 1.0
    assert progress(0.0, threshold=8.0) == 0.0


def test_participants_are_distinct_scouts():
    c = [(1.0, "shake", "a"), (2.0, "tap", "a"), (3.0, "shake", "b")]
    assert participants(c) == {"a", "b"}
