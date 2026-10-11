"""
Auto presence: the passive sensor layer.

The tests that matter most are the ones about people, not geometry: a walk-past
is not a visit, an auto check-in is never published by name, and a person's
explicit manual check-in is never overridden by an overlapping geofence.
"""
from datetime import datetime, timedelta, timezone

import pytest

from app.services.presence import (
    AUTO_TTL_HOURS,
    PASS_THROUGH_MINUTES,
    REENTER_GRACE_MINUTES,
    SOURCE_AUTO,
    check_position,
    classify_visit,
    decide_enter,
    is_present,
    new_auto_checkin,
    present_filter,
)

NOW = datetime(2026, 10, 11, 23, 30, tzinfo=timezone.utc)


def ago(minutes: float) -> datetime:
    return NOW - timedelta(minutes=minutes)


def checkin(source=None, minutes_old=30, status="active", venue="v1", expires_in=120,
            verified=True):
    doc = {
        "venue_id": venue,
        "status": status,
        "created_at": ago(minutes_old),
        "expires_at": NOW + timedelta(minutes=expires_in),
    }
    if source:
        doc["source"] = source
        doc["verified"] = verified
    return doc


# ── Presence counting ─────────────────────────────────────────────────────────

def test_a_walk_past_is_not_presence():
    """Driving down the expressway past a venue must not add a body to the room."""
    assert not is_present(checkin(SOURCE_AUTO, minutes_old=1), NOW)


def test_an_auto_visit_counts_once_it_outlasts_a_walk_past():
    assert is_present(checkin(SOURCE_AUTO, minutes_old=PASS_THROUGH_MINUTES), NOW)
    assert is_present(checkin(SOURCE_AUTO, minutes_old=45), NOW)


def test_a_manual_check_in_counts_immediately():
    """The person said they were there. No waiting period applies."""
    assert is_present(checkin(None, minutes_old=0), NOW)


def test_expired_and_closed_check_ins_are_not_presence():
    assert not is_present(checkin(SOURCE_AUTO, minutes_old=60, expires_in=-1), NOW)
    assert not is_present(checkin(SOURCE_AUTO, minutes_old=60, status="left"), NOW)


def test_naive_timestamps_from_mongo_are_handled():
    doc = checkin(SOURCE_AUTO, minutes_old=30)
    doc["created_at"] = doc["created_at"].replace(tzinfo=None)
    doc["expires_at"] = doc["expires_at"].replace(tzinfo=None)
    assert is_present(doc, NOW)


def test_an_unverified_auto_visit_never_counts():
    """
    The regression guard for the spoofing hole. An arrival with no position is
    any authenticated request for any venue. It may be logged; it must never
    add a body to a room, however long it has been there.
    """
    assert not is_present(checkin(SOURCE_AUTO, minutes_old=120, verified=False), NOW)
    doc = checkin(SOURCE_AUTO, minutes_old=120)
    del doc["verified"]
    assert not is_present(doc, NOW), "a missing flag must fail closed, not open"


def test_mongo_filter_uses_the_same_rules():
    """The query and the Python check must never disagree about who is present."""
    f = present_filter("v1", NOW)
    assert f["venue_id"] == "v1"
    assert f["status"] == "active"
    assert f["expires_at"] == {"$gt": NOW}
    auto_rule = next(c for c in f["$or"] if "created_at" in c)
    assert auto_rule["created_at"]["$lte"] == NOW - timedelta(minutes=PASS_THROUGH_MINUTES)
    assert auto_rule["verified"] is True


# ── Visits ────────────────────────────────────────────────────────────────────

def test_visit_length_and_walk_past_classification():
    short = classify_visit(ago(2), NOW)
    long = classify_visit(ago(95), NOW)
    assert short["pass_through"] is True
    assert long["pass_through"] is False
    assert long["dwell_minutes"] == pytest.approx(95.0)


def test_clock_skew_never_produces_negative_dwell():
    assert classify_visit(NOW, ago(5))["dwell_minutes"] == 0.0


# ── Enter decisions ───────────────────────────────────────────────────────────

def test_first_arrival_opens_a_visit():
    assert decide_enter(None, "v1", None, NOW) == "open"


def test_a_duplicate_enter_does_nothing():
    assert decide_enter(checkin(SOURCE_AUTO, venue="v1"), "v1", None, NOW) == "noop"


def test_a_manual_check_in_is_never_overridden():
    """
    Venues in VI sit on the same street and their geofences overlap. Standing
    in one can fire an enter for the one next door. A person's explicit choice
    must survive that.
    """
    manual_elsewhere = checkin(None, venue="v2")
    assert decide_enter(manual_elsewhere, "v1", None, NOW) == "keep_manual"


def test_an_auto_visit_elsewhere_is_replaced():
    assert decide_enter(checkin(SOURCE_AUTO, venue="v2"), "v1", None, NOW) == "switch"


def test_boundary_flapping_continues_the_same_visit():
    """Exit then enter seconds apart at the edge of a venue is one visit, not two."""
    just_left = {"venue_id": "v1", "source": SOURCE_AUTO, "left_at": ago(0.5)}
    assert decide_enter(None, "v1", just_left, NOW) == "resume"


def test_coming_back_later_is_a_new_visit():
    left_earlier = {"venue_id": "v1", "source": SOURCE_AUTO,
                    "left_at": ago(REENTER_GRACE_MINUTES + 10)}
    assert decide_enter(None, "v1", left_earlier, NOW) == "open"


def test_grace_window_only_applies_to_the_same_venue():
    left_elsewhere = {"venue_id": "v2", "source": SOURCE_AUTO, "left_at": ago(0.5)}
    assert decide_enter(None, "v1", left_elsewhere, NOW) == "open"


# ── Spoofing guard ────────────────────────────────────────────────────────────

def test_no_position_fails_closed():
    """The server cannot see the operating system, only a request. No position, no count."""
    assert check_position(None, 100) == "missing"


def test_a_position_near_the_venue_is_verified_and_a_far_one_refused():
    assert check_position(150, 100) == "verified"
    assert check_position(5000, 100) == "far"


def test_missing_radius_falls_back_to_a_sane_default():
    assert check_position(250, None) == "verified"
    assert check_position(900, None) == "far"


# ── New visits ────────────────────────────────────────────────────────────────

def test_auto_visits_earn_nothing_and_expire_on_their_own():
    doc = new_auto_checkin({"id": "u1", "username": "yori"}, {"id": "v1", "name": "Bature"}, NOW)
    assert doc["source"] == SOURCE_AUTO
    assert doc["status"] == "active"
    assert doc["expires_at"] == NOW + timedelta(hours=AUTO_TTL_HOURS)
    assert "clout" not in str(doc).lower()


def test_a_new_visit_is_unverified_unless_told_otherwise():
    """Forgetting to pass `verified` can only ever undercount a room."""
    user, venue = {"id": "u1"}, {"id": "v1"}
    assert new_auto_checkin(user, venue, NOW)["verified"] is False
    assert new_auto_checkin(user, venue, NOW, verified=True)["verified"] is True
