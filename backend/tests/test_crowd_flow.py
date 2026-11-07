"""Crowd flow: arrivals and departures from auto check-in."""
from datetime import datetime, timedelta, timezone

from app.services.crowd_flow import (
    MIN_FLOW,
    arrival_filter,
    bucketize,
    departure_filter,
    direction,
)

NOW = datetime(2026, 12, 19, 23, 0, tzinfo=timezone.utc)


def test_unverified_arrivals_are_never_counted():
    """Any account can send an enter with no position. It must not count as a body."""
    f = arrival_filter(NOW)
    assert f["verified"] is True
    assert "resume" not in f["action"]["$in"], "a boundary flap is not a new arrival"


def test_walk_pasts_are_never_departures():
    assert departure_filter(NOW)["pass_through"] is False


def test_filters_scope_to_venues_when_given():
    assert arrival_filter(NOW, ["v1"])["venue_id"] == {"$in": ["v1"]}
    assert "venue_id" not in arrival_filter(NOW)


def test_direction_needs_enough_movement_to_say_anything():
    assert direction(MIN_FLOW - 1, 0) == "quiet"
    assert direction(20, 2) == "filling"
    assert direction(2, 20) == "emptying"
    assert direction(10, 9) == "steady"


def test_buckets_include_empty_ones_so_a_lull_is_visible():
    start = NOW - timedelta(minutes=40)
    stamps = [start + timedelta(minutes=2), start + timedelta(minutes=3),
              start + timedelta(minutes=35)]
    b = bucketize(stamps, start, NOW, 10)
    assert [x["count"] for x in b] == [2, 0, 0, 1, 0]


def test_buckets_ignore_out_of_range_and_handle_naive_times():
    start = NOW - timedelta(minutes=20)
    stamps = [start - timedelta(minutes=5), (start + timedelta(minutes=1)).replace(tzinfo=None),
              NOW + timedelta(minutes=5)]
    assert [x["count"] for x in bucketize(stamps, start, NOW, 10)] == [1, 0, 0]


def test_no_buckets_before_the_start():
    assert bucketize([], NOW, NOW - timedelta(minutes=5)) == []
