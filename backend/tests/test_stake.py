"""
The Call: conviction stakes on a reading.

The tests that matter are the ones proving a Call cannot become a way to buy
influence: it must be scarce, symmetric, and void when it cannot be judged.
"""
import pytest
from datetime import datetime, timedelta, timezone

from app.services.stake import (
    CALLS_PER_NIGHT,
    CLOUT_AT_STAKE,
    calls_remaining,
    grade_call,
    is_settled,
    night_window_start,
    stake_multiplier,
)


# ── Scarcity ──────────────────────────────────────────────────────────────────

def test_budget_is_scarce_and_cannot_go_negative():
    assert calls_remaining(0) == CALLS_PER_NIGHT
    assert calls_remaining(CALLS_PER_NIGHT) == 0
    assert calls_remaining(CALLS_PER_NIGHT + 50) == 0


def test_budget_survives_junk_input():
    assert calls_remaining(None) == CALLS_PER_NIGHT
    assert calls_remaining("three") == CALLS_PER_NIGHT
    assert calls_remaining(-5) == CALLS_PER_NIGHT


def test_night_window_rolls_over_at_seven_am_not_midnight():
    """A call made at 2AM belongs to the night that started the evening before."""
    two_am = datetime(2026, 9, 17, 2, 0, tzinfo=timezone.utc)
    start = night_window_start(two_am)
    assert start.day == 16
    assert start.hour == 17

    ten_pm = datetime(2026, 9, 17, 22, 0, tzinfo=timezone.utc)
    assert night_window_start(ten_pm).day == 17


# ── Weight effect is bounded ──────────────────────────────────────────────────

def test_a_call_is_conviction_not_a_megaphone():
    assert stake_multiplier(False) == 1.0
    assert 1.0 < stake_multiplier(True) < 1.5


# ── Settlement timing ─────────────────────────────────────────────────────────

def test_a_call_cannot_be_graded_before_the_room_has_had_time():
    now = datetime.now(timezone.utc)
    assert not is_settled(now - timedelta(minutes=5), now)
    assert is_settled(now - timedelta(minutes=45), now)


def test_naive_timestamps_are_handled():
    now = datetime.now(timezone.utc)
    naive = (now - timedelta(minutes=45)).replace(tzinfo=None)
    assert is_settled(naive, now)


# ── Grading ───────────────────────────────────────────────────────────────────

def test_ungradeable_calls_are_void_and_pay_nothing():
    """
    Closes the obvious exploit: staking a dead venue nobody else will read,
    then collecting because nothing contradicted you.
    """
    result = grade_call(80, [])
    assert result["verdict"] == "void"
    assert result["clout_delta"] == 0

    one_reading = grade_call(80, [79])
    assert one_reading["verdict"] == "void"
    assert one_reading["clout_delta"] == 0


def test_a_correct_call_pays():
    result = grade_call(80, [78, 82, 81])
    assert result["verdict"] == "right"
    assert result["clout_delta"] > 0
    assert result["outcome"] == pytest.approx(80.3, abs=0.2)


def test_a_wrong_call_costs():
    result = grade_call(90, [30, 35, 28])
    assert result["verdict"] == "wrong"
    assert result["clout_delta"] < 0


def test_upside_and_downside_are_symmetric():
    """A Call is a risk. If it only ever helped it would just be a louder tap."""
    right = grade_call(80, [80, 80], consensus_at_time=40)
    wrong = grade_call(80, [20, 20], consensus_at_time=40)
    assert right["clout_delta"] == -wrong["clout_delta"]


def test_being_right_alone_pays_more_than_being_right_with_the_crowd():
    alone = grade_call(85, [84, 86], consensus_at_time=35)
    with_crowd = grade_call(85, [84, 86], consensus_at_time=84)
    assert alone["clout_delta"] > with_crowd["clout_delta"]
    # Echoing the consensus earns the base stake and essentially nothing on top.
    assert with_crowd["clout_delta"] == pytest.approx(CLOUT_AT_STAKE, abs=1)
    assert alone["clout_delta"] >= CLOUT_AT_STAKE * 1.5


def test_being_loudly_wrong_costs_more_than_being_quietly_wrong():
    loud = grade_call(95, [20, 20], consensus_at_time=25)
    quiet = grade_call(45, [20, 20], consensus_at_time=44)
    assert loud["clout_delta"] < quiet["clout_delta"] < 0


def test_a_near_miss_still_counts_as_right():
    """The room is not graded to the point. Close is correct."""
    result = grade_call(80, [70, 72])
    assert result["verdict"] == "right"


def test_grading_without_a_consensus_still_works():
    result = grade_call(80, [80, 80], consensus_at_time=None)
    assert result["verdict"] == "right"
    assert result["clout_delta"] == CLOUT_AT_STAKE
