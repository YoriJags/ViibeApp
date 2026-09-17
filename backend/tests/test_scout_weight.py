"""
Scout Weight: the new standard for how much a reading counts.

The tests that matter most here are not the curve shapes. They are the ones
that lock in the behaviours the old standard got wrong:

  - being right while disagreeing must pay MORE than agreeing (no herding)
  - a scout whose readings never vary must count for LESS (no constants)
  - the first reading of the night must count for MORE than the fiftieth
  - nothing we cannot justify may ever get a flattering default
"""
import pytest

from app.services.scout_weight import (
    WEIGHT_CEILING,
    WEIGHT_FLOOR,
    calibration_factor,
    compose,
    contrarian_credit,
    discrimination_factor,
    dwell_factor,
    marginal_information_factor,
    presence_factor,
    proximity_factor,
)


# ── Marginal information ──────────────────────────────────────────────────────

def test_first_reading_of_the_night_is_worth_most():
    """The whole incentive gradient depends on this being monotonic."""
    first = marginal_information_factor(0)
    tenth = marginal_information_factor(10)
    fiftieth = marginal_information_factor(50)
    assert first > tenth > fiftieth
    assert first > 1.5
    assert fiftieth < 1.0


def test_marginal_value_never_reaches_zero_or_runs_away():
    for n in (0, 1, 5, 25, 100, 5000):
        f = marginal_information_factor(n)
        assert 0.5 <= f <= 1.7, f


def test_marginal_handles_junk_counts():
    assert marginal_information_factor(None) == marginal_information_factor(0)
    assert marginal_information_factor(-10) == marginal_information_factor(0)
    assert marginal_information_factor("nonsense") == marginal_information_factor(0)


# ── Presence ──────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("minutes,expected_min,expected_max", [
    (0,   0.65, 0.75),
    (15,  0.98, 1.02),
    (90,  1.10, 1.20),
    (600, 1.10, 1.20),
])
def test_dwell_curve(minutes, expected_min, expected_max):
    assert expected_min <= dwell_factor(minutes) <= expected_max


def test_unknown_dwell_is_neutral_not_flattering():
    """Not knowing must never be worth more than knowing they just arrived
    is bad, but it must also never be worth as much as a long stay."""
    assert dwell_factor(0) < dwell_factor(None) < dwell_factor(60)


def test_proximity_rewards_the_middle_of_the_room():
    radius = 200.0
    centre = proximity_factor(0, radius)
    halfway = proximity_factor(100, radius)
    boundary = proximity_factor(200, radius)
    outside = proximity_factor(400, radius)
    assert centre > halfway > boundary > outside


def test_presence_is_bounded_so_it_corroborates_rather_than_decides():
    best = presence_factor(600, 0, 200)
    worst = presence_factor(0, 900, 200)
    assert best <= 1.25
    assert worst >= 0.50


def test_presence_survives_missing_data():
    assert 0.5 <= presence_factor(None, None, 200) <= 1.25
    assert 0.5 <= presence_factor(None, None, 0) <= 1.25


# ── Calibration ───────────────────────────────────────────────────────────────

def test_no_history_is_neutral():
    assert calibration_factor([]) == 1.00


def test_accurate_scouts_outweigh_inaccurate_ones():
    accurate = calibration_factor([(70, 72), (40, 38), (85, 84)])
    inaccurate = calibration_factor([(70, 20), (40, 90), (85, 30)])
    assert accurate > 1.2
    assert inaccurate < 0.9
    assert accurate > inaccurate


# ── Contrarian credit: the herding fix ────────────────────────────────────────

def test_being_right_while_disagreeing_beats_agreeing():
    """
    THE test for this module. Under the old standard the lone correct caller was
    penalised as an outlier and the echo scored perfectly. That is now inverted.
    """
    # Room turned out to be 80.
    lone_caller = contrarian_credit(reading_score=80, consensus_at_time=40, outcome_score=80)
    echo        = contrarian_credit(reading_score=80, consensus_at_time=79, outcome_score=80)
    assert lone_caller > echo, "disagreeing and being right must pay more than agreeing"
    assert echo == pytest.approx(1.0, abs=0.05), "agreeing with consensus adds ~nothing"


def test_being_loudly_wrong_costs_more_than_being_quietly_wrong():
    """Otherwise contrarian credit is farmable by spraying extreme readings."""
    loud_and_wrong  = contrarian_credit(reading_score=95, consensus_at_time=20, outcome_score=20)
    quiet_and_wrong = contrarian_credit(reading_score=95, consensus_at_time=90, outcome_score=20)
    assert loud_and_wrong < quiet_and_wrong < 1.0


def test_contrarian_credit_without_a_consensus_is_neutral():
    assert contrarian_credit(80, None, 80) == pytest.approx(1.0)


# ── Discrimination ────────────────────────────────────────────────────────────

def test_a_scout_who_rates_everything_the_same_carries_less_weight():
    constant = discrimination_factor([85, 85, 85, 85, 85, 85])
    varied   = discrimination_factor([10, 35, 60, 85, 95, 20])
    assert constant < 0.7
    assert varied > 1.0
    assert varied > constant


def test_too_little_history_to_judge_is_neutral():
    assert discrimination_factor([80, 20]) == 1.00
    assert discrimination_factor([]) == 1.00


# ── Composition ───────────────────────────────────────────────────────────────

def test_no_single_factor_can_zero_a_reading_out():
    """Every voice counts a little. That is a product promise, not a constant."""
    assert compose(0.55, 0.50, 0.1, 0.60, 0.60) >= WEIGHT_FLOOR


def test_no_scout_can_run_away_with_the_score():
    assert compose(1.60, 1.25, 1.5, 1.40, 1.15) <= WEIGHT_CEILING


def test_an_ideal_reading_outweighs_a_poor_one_substantially():
    ideal = compose(marginal_information_factor(0), presence_factor(120, 5, 200), 1.2, 1.4, 1.15)
    poor  = compose(marginal_information_factor(80), presence_factor(1, 195, 200), 0.3, 0.6, 0.6)
    assert ideal > poor * 3


def test_volume_alone_no_longer_buys_weight():
    """
    The old standard gave half its weight to rating count. Two scouts identical
    except for history must now be separated by evidence, not attendance.
    """
    veteran_bad_reading = compose(marginal_information_factor(90), presence_factor(0, 195, 200), 1.5)
    newcomer_good_reading = compose(marginal_information_factor(0), presence_factor(75, 10, 200), 0.3)
    assert newcomer_good_reading > veteran_bad_reading
