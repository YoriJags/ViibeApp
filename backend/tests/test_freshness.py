"""Freshness metrics: the number the product lives or dies on."""
from datetime import datetime, timedelta, timezone

from app.services import freshness as fr


def ts(hour, day=11, minute=0):
    return datetime(2026, 9, day, hour, minute, tzinfo=timezone.utc)


# ── median age ───────────────────────────────────────────────────────────────

def test_median_age_of_readings():
    assert fr.median_age_minutes([2, 4, 30]) == 4


def test_median_age_ignores_venues_with_no_reading():
    assert fr.median_age_minutes([None, 6, None, 10]) == 8


def test_median_age_is_none_when_nothing_reported():
    assert fr.median_age_minutes([None, None]) is None


# ── coverage ─────────────────────────────────────────────────────────────────

def test_coverage_counts_only_readings_inside_the_window():
    c = fr.fresh_coverage([2, 9, 40], total_venues=3)
    assert c["fresh"] == 2 and c["pct"] == 66.7


def test_silence_counts_against_coverage():
    """A venue with no reading is not fresh, it is unknown."""
    c = fr.fresh_coverage([3, None, None, None], total_venues=4)
    assert c["fresh"] == 1 and c["pct"] == 25.0


def test_coverage_handles_an_empty_city():
    assert fr.fresh_coverage([], total_venues=0)["pct"] == 0.0


# ── demo separation ──────────────────────────────────────────────────────────

def test_demo_scouts_are_identifiable():
    assert fr.is_demo_user("demo-scout-3")
    assert not fr.is_demo_user("69811ca4-real-user")
    assert not fr.is_demo_user(None)


# ── night grouping ───────────────────────────────────────────────────────────

def test_a_2am_reading_belongs_to_the_night_before():
    assert fr.night_of(ts(2, day=12)) == ts(11).date()


def test_an_11pm_reading_belongs_to_that_same_night():
    assert fr.night_of(ts(23, day=11)) == ts(11).date()


# ── readings per visit ───────────────────────────────────────────────────────

def test_one_reading_per_visit_is_the_stale_baseline():
    rows = [
        {"user_id": "a", "venue_id": "v1", "timestamp": ts(22)},
        {"user_id": "b", "venue_id": "v1", "timestamp": ts(22)},
    ]
    r = fr.readings_per_visit(rows)
    assert r["visits"] == 2 and r["mean"] == 1.0


def test_repeat_readings_in_one_night_count_as_one_visit():
    rows = [
        {"user_id": "a", "venue_id": "v1", "timestamp": ts(22)},
        {"user_id": "a", "venue_id": "v1", "timestamp": ts(23)},
        {"user_id": "a", "venue_id": "v1", "timestamp": ts(1, day=12)},  # still that night
    ]
    r = fr.readings_per_visit(rows)
    assert r["visits"] == 1 and r["mean"] == 3.0 and r["max"] == 3


def test_same_scout_at_two_venues_is_two_visits():
    rows = [
        {"user_id": "a", "venue_id": "v1", "timestamp": ts(22)},
        {"user_id": "a", "venue_id": "v2", "timestamp": ts(23)},
    ]
    assert fr.readings_per_visit(rows)["visits"] == 2


def test_rows_without_a_usable_timestamp_are_skipped():
    rows = [{"user_id": "a", "venue_id": "v1", "timestamp": None},
            {"user_id": "a", "venue_id": "v1", "timestamp": ts(22)}]
    assert fr.readings_per_visit(rows)["visits"] == 1


def test_empty_input_reports_no_visits_rather_than_failing():
    assert fr.readings_per_visit([])["visits"] == 0
