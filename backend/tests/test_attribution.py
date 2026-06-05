"""
Attribution core tests — the money math.

Closed-form expected values so a regression in conversion / lift / revenue is
impossible to merge. No Mongo: the route orchestrates queries, this verifies
the arithmetic the merchant ROI report is built on.
"""
import pytest

from app.services.attribution import (
    IntentFunnel,
    ArrivalStats,
    LiftResult,
    count_unique_arrivals,
    matched_conversion,
    compute_lift,
    estimate_revenue,
    assemble_report,
    AVG_SPEND_NGN,
    MIN_BASELINE_WINDOWS,
    THIN_ARRIVALS,
)


# ─── Funnel ───────────────────────────────────────────────────────────────────

def test_funnel_total():
    f = IntentFunnel(profile_views=40, direction_taps=12, enroute_intents=5)
    assert f.total_intent == 57


# ─── Unique arrivals ──────────────────────────────────────────────────────────

def test_unique_arrivals_dedupes_across_checkins_and_ratings():
    # s1 both checked in and rated; s2 rated twice; s3 once → 3 bodies, not 5.
    records = [
        {"user_id": "s1"},  # checkin
        {"user_id": "s1"},  # rating
        {"user_id": "s2"},  # rating
        {"user_id": "s2"},  # rating correction
        {"user_id": "s3"},  # checkin
    ]
    stats = count_unique_arrivals(records)
    assert stats.verified_arrivals == 3
    assert stats.arrival_user_ids == frozenset({"s1", "s2", "s3"})


def test_unique_arrivals_ignores_missing_user():
    records = [{"user_id": "s1"}, {"user_id": None}, {}]
    assert count_unique_arrivals(records).verified_arrivals == 1


# ─── Matched conversion ───────────────────────────────────────────────────────

def test_matched_conversion_basic():
    # 4 identified intent users, 2 of them arrived → 50%.
    matched, pct = matched_conversion(["a", "b", "c", "d"], ["b", "d", "z"])
    assert matched == 2
    assert pct == 50.0


def test_matched_conversion_no_intent_is_zero():
    matched, pct = matched_conversion([], ["a", "b"])
    assert matched == 0
    assert pct == 0.0


def test_matched_conversion_ignores_falsy_ids():
    matched, pct = matched_conversion(["a", None, ""], ["a"])
    assert matched == 1
    assert pct == 100.0


# ─── Lift (honest-scarcity) ───────────────────────────────────────────────────

def test_lift_refuses_thin_baseline():
    r = compute_lift(20, [16], min_windows=MIN_BASELINE_WINDOWS)  # only 1 window
    assert r.honest is False
    assert r.lift_pct is None
    assert r.baseline is None
    assert r.current == 20


def test_lift_computes_against_mean_baseline():
    # current 20 vs mean(16,14,18,12)=15 → +33.3%
    r = compute_lift(20, [16, 14, 18, 12])
    assert r.honest is True
    assert r.baseline == 15.0
    assert r.lift_pct == pytest.approx(33.3, abs=0.1)


def test_lift_negative_when_below_baseline():
    r = compute_lift(8, [16, 16])  # mean 16 → -50%
    assert r.lift_pct == -50.0
    assert r.honest is True


def test_lift_zero_baseline_is_unquantifiable():
    # Real arrivals tonight, none on comparable prior nights → can't claim a %.
    r = compute_lift(10, [0, 0])
    assert r.honest is False
    assert r.lift_pct is None


# ─── Revenue ──────────────────────────────────────────────────────────────────

def test_revenue_scales_with_arrivals():
    assert estimate_revenue(23) == 23 * AVG_SPEND_NGN
    assert estimate_revenue(0) == 0
    assert estimate_revenue(-5) == 0  # never negative


# ─── Full report + confidence ─────────────────────────────────────────────────

def _funnel():
    return IntentFunnel(profile_views=30, direction_taps=10, enroute_intents=4)


def test_report_full_confidence_with_arrivals_and_baseline():
    arrivals = ArrivalStats(verified_arrivals=20, arrival_user_ids=frozenset({f"s{i}" for i in range(20)}))
    report = assemble_report(
        window_hours=4,
        funnel=_funnel(),
        arrivals=arrivals,
        intent_user_ids=["s0", "s1", "x"],     # 2 of 3 arrived
        baseline_arrival_counts=[16, 14, 18, 12],
    )
    assert report.verified_arrivals == 20
    assert report.matched_conversions == 2
    assert report.matched_conversion_pct == pytest.approx(66.7, abs=0.1)
    assert report.lift.honest is True
    assert report.estimated_revenue_ngn == 20 * AVG_SPEND_NGN
    assert report.confidence == 1.0


def test_report_zero_arrivals_zero_confidence():
    arrivals = ArrivalStats(verified_arrivals=0, arrival_user_ids=frozenset())
    report = assemble_report(4, _funnel(), arrivals, [], [16, 14])
    assert report.confidence == 0.0
    assert report.estimated_revenue_ngn == 0


def test_report_thin_arrivals_low_confidence():
    arrivals = ArrivalStats(verified_arrivals=THIN_ARRIVALS - 1, arrival_user_ids=frozenset({"s1", "s2"}))
    report = assemble_report(4, _funnel(), arrivals, [], [16, 14])
    assert report.confidence == 0.4


def test_report_arrivals_but_no_baseline_mid_confidence():
    arrivals = ArrivalStats(verified_arrivals=10, arrival_user_ids=frozenset({f"s{i}" for i in range(10)}))
    report = assemble_report(4, _funnel(), arrivals, [], [16])  # baseline too thin
    assert report.lift.honest is False
    assert report.confidence == 0.7
