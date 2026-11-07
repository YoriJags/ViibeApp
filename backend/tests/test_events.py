"""
Events and "when to leave".

The tests that matter: an event never shows as live outside its dates, the
organiser key never leaks, and "when to leave" never gives advice its evidence
cannot back, including never letting demo energy say a room is going.
"""
from datetime import datetime, timedelta, timezone

import pytest

from app.services.events import (
    DOORS_LEAD,
    ENTRY_DOOR,
    ENTRY_TICKETED,
    LISTED_BEFORE,
    PROMISE_TIMING,
    PROMISE_WORTH,
    event_phase,
    is_listed,
    is_watchable,
    new_event_document,
    new_organiser_key,
    promise_for,
    public_event,
    validate_event,
)
from app.services.leave_timing import advise, gate_consensus

NOW = datetime(2026, 12, 19, 21, 0, tzinfo=timezone.utc)


def ev(start_in_h=1, length_h=6, entry=ENTRY_TICKETED):
    start = NOW + timedelta(hours=start_in_h)
    return {"kind": "event", "entry": entry, "venue_type": "festival",
            "starts_at": start, "ends_at": start + timedelta(hours=length_h)}


def good_payload(**kw):
    p = {"name": "Afro Nation Lagos", "venue_type": "festival", "entry": "ticketed",
         "coordinates": {"lat": 6.42, "lng": 3.41}, "geofence_radius_m": 400,
         "starts_at": NOW.isoformat(), "ends_at": (NOW + timedelta(hours=8)).isoformat()}
    p.update(kw)
    return p


# ── Phases and visibility ─────────────────────────────────────────────────────

def test_phases_follow_the_clock():
    assert event_phase(ev(start_in_h=10), NOW) == "upcoming"
    assert event_phase(ev(start_in_h=1), NOW) == "doors"
    assert event_phase(ev(start_in_h=-1), NOW) == "live"
    assert event_phase(ev(start_in_h=-10, length_h=6), NOW) == "ended"


def test_an_undated_event_can_never_be_live():
    assert event_phase({"kind": "event"}, NOW) == "ended"
    assert not is_listed({"kind": "event"}, NOW)
    assert not is_watchable({"kind": "event"}, NOW)


def test_listing_window():
    assert is_listed(ev(start_in_h=24 * 6), NOW)
    assert not is_listed(ev(start_in_h=24 * 8), NOW)
    assert not is_listed(ev(start_in_h=-12, length_h=6), NOW), "long over, off the map"


def test_the_phone_only_watches_the_ground_from_doors_to_end():
    """A temporary geofence must not fire on an empty field the week before."""
    assert not is_watchable(ev(start_in_h=24), NOW)
    assert is_watchable(ev(start_in_h=1), NOW)
    assert is_watchable(ev(start_in_h=-2), NOW)
    assert not is_watchable(ev(start_in_h=-10, length_h=6), NOW)


def test_entry_type_decides_the_promise():
    assert promise_for({"entry": ENTRY_TICKETED}) == PROMISE_TIMING
    assert promise_for({"entry": ENTRY_DOOR}) == PROMISE_WORTH
    assert promise_for({}) == PROMISE_WORTH


# ── Validation ────────────────────────────────────────────────────────────────

def test_a_good_event_validates():
    assert validate_event(good_payload()) == []


@pytest.mark.parametrize("change,fragment", [
    ({"name": " "}, "name"),
    ({"venue_type": "restaurant"}, "Type"),
    ({"entry": "free"}, "Entry"),
    ({"coordinates": {}}, "coordinates"),
    ({"geofence_radius_m": 5000}, "radius"),
    ({"ends_at": NOW.isoformat()}, "after the start"),
    ({"ends_at": (NOW + timedelta(days=9)).isoformat()}, "4 days"),
])
def test_bad_events_are_explained(change, fragment):
    problems = validate_event(good_payload(**change))
    assert problems and any(fragment in p for p in problems), problems


def test_the_event_document_holds_no_secret():
    """
    The organiser key lives in its own collection. Dozens of endpoints return
    whole venue documents; a key stored on the event would leak through them.
    """
    doc = new_event_document(good_payload())
    assert not any("key" in k for k in doc), [k for k in doc if "key" in k]
    assert len(new_organiser_key()) >= 24
    assert new_organiser_key() != new_organiser_key()


def test_a_new_event_starts_with_no_reading():
    doc = new_event_document(good_payload())
    assert doc["kind"] == "event"
    assert doc["energy_source"] == "none"
    assert doc["current_vibe_score"] == 0.0


# ── Gate consensus ────────────────────────────────────────────────────────────

def test_one_reading_is_not_a_gate_reading():
    assert gate_consensus(["clear"]) is None


def test_a_tie_resolves_to_the_worse_gate():
    """Calling a jammed gate clear costs someone an hour. Err the other way."""
    assert gate_consensus(["clear", "blocked"]) == "blocked"
    assert gate_consensus(["clear", "clear", "slow"]) == "clear"


# ── When to leave ─────────────────────────────────────────────────────────────

def test_no_evidence_means_no_advice():
    a = advise("live", [], 0, 0)
    assert a["advice"] == "no_data"


def test_a_jammed_gate_says_wait():
    assert advise("live", ["blocked", "blocked", "clear"], 20, 0)["advice"] == "wait"


def test_go_now_needs_real_energy():
    real = advise("live", ["clear", "clear"], 10, 0, "lit", "scouts")
    demo = advise("live", ["clear", "clear"], 10, 0, "lit", "demo")
    assert real["advice"] == "go_now"
    assert demo["advice"] == "no_rush", "demo energy must never say a room is going"
    assert demo["energy"] is None


def test_building_room():
    assert advise("live", ["slow", "slow"], 10, 0, "warming", "scouts")["advice"] == "go_soon"


def test_winding_down_when_people_leave():
    a = advise("live", ["clear", "clear"], 2, 15, "lit", "scouts")
    assert a["advice"] == "winding_down"


def test_flow_without_a_gate_reading_says_only_what_the_flow_shows():
    a = advise("doors", [], 12, 0)
    assert a["advice"] == "filling"
    assert "12" in a["detail"]


def test_upcoming_and_ended():
    assert advise("upcoming", starts_at_label="8:00 PM")["headline"] == "Starts at 8:00 PM."
    assert advise("ended")["advice"] == "ended"


def test_advice_never_claims_what_it_cannot_know():
    """No travel times, no set times, no em dashes in anything it says."""
    cases = [
        advise("live", ["clear", "clear"], 10, 0, "peak", "scouts"),
        advise("live", ["blocked", "blocked"], 10, 0),
        advise("live", [], 9, 0),
        advise("live", [], 0, 0),
    ]
    for a in cases:
        text = (a["headline"] + " " + a["detail"]).lower()
        assert "headliner" not in text
        assert "minutes away" not in text and "leave in" not in text
        assert "—" not in text
