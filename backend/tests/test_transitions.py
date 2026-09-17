"""
Energy transitions: carrying both audiences through a room changing.

The test that matters most is `test_cooling_is_announced_to_watchers`. Every
competitor only ever announces good news, because that is what venues want sent.
Telling someone the room they were about to cross Lagos for is dying is the
message that earns trust, and it has to keep working.
"""
import pytest

from app.services.transitions import (
    COOLDOWN_MINUTES,
    MIN_READINGS_FOR_PEAK,
    MIN_READINGS_TO_ANNOUNCE,
    detect_transition,
    has_enough_evidence,
    should_announce,
    transition_copy,
)


# ── Detection ─────────────────────────────────────────────────────────────────

def test_rising_and_cooling_are_both_detected():
    up = detect_transition("warming", "lit")
    down = detect_transition("lit", "warming")
    assert up["direction"] == "rising"
    assert down["direction"] == "cooling"


def test_no_previous_state_is_not_a_transition():
    """A venue's first ever reading has not 'changed' from anything."""
    assert detect_transition(None, "lit") is None
    assert detect_transition("", "lit") is None


def test_same_state_is_not_a_transition():
    assert detect_transition("lit", "lit") is None


def test_warming_to_charged_is_not_an_energy_change():
    """
    CHARGED is the same energy in a fuller room, not a hotter room. Announcing
    it as a rise would be the product telling a small lie every time a venue
    filled up without getting better.
    """
    assert detect_transition("warming", "charged") is None
    assert detect_transition("charged", "warming") is None


def test_unknown_states_are_ignored_rather_than_guessed():
    assert detect_transition("electric", "lit") is None
    assert detect_transition("lit", "popping") is None


def test_steps_measures_distance_travelled():
    assert detect_transition("quiet", "peak")["steps"] == 4
    assert detect_transition("lit", "peak")["steps"] == 1


# ── Evidence guard ────────────────────────────────────────────────────────────

def test_one_person_cannot_announce_a_transition_to_a_city():
    t = detect_transition("warming", "lit")
    assert not has_enough_evidence(t, 1)
    assert has_enough_evidence(t, MIN_READINGS_TO_ANNOUNCE)


def test_a_peak_claim_carries_the_highest_bar():
    """The loudest statement reaches the most people, so it needs the most behind it."""
    peak = detect_transition("lit", "peak")
    ordinary = detect_transition("chill", "warming")
    assert not has_enough_evidence(peak, MIN_READINGS_TO_ANNOUNCE)
    assert has_enough_evidence(ordinary, MIN_READINGS_TO_ANNOUNCE)
    assert has_enough_evidence(peak, MIN_READINGS_FOR_PEAK)


def test_junk_reading_counts_fail_closed():
    t = detect_transition("warming", "lit")
    assert not has_enough_evidence(t, None)
    assert not has_enough_evidence(t, "lots")


# ── Throttle ──────────────────────────────────────────────────────────────────

def test_a_venue_on_a_boundary_cannot_spam():
    t = detect_transition("warming", "lit")
    assert not should_announce(t, 10, minutes_since_last=1)
    assert not should_announce(t, 10, minutes_since_last=COOLDOWN_MINUTES - 1)
    assert should_announce(t, 10, minutes_since_last=COOLDOWN_MINUTES)


def test_first_ever_announcement_is_allowed():
    t = detect_transition("warming", "lit")
    assert should_announce(t, 10, minutes_since_last=None)


def test_nothing_is_announced_without_a_transition():
    assert not should_announce(None, 999, None)


# ── Copy ──────────────────────────────────────────────────────────────────────

def test_the_two_audiences_get_different_sentences():
    """
    Inside the room they can already feel it, so it is confirmation. Outside
    they cannot, so it is news. Sending the same words to both wastes the one
    moment that matters.
    """
    t = detect_transition("warming", "lit")
    copy = transition_copy("Bature", t)
    assert copy["inside"] != copy["outside"]
    assert "Bature" in copy["outside"]
    assert "Bature" not in copy["inside"], "you are standing in it, you know its name"


def test_cooling_is_announced_to_watchers():
    """
    THE test for this module. A product that only reports good news is an
    advertising channel.
    """
    t = detect_transition("peak", "chill")
    copy = transition_copy("Bature", t)
    assert copy["direction"] == "cooling"
    assert "cooling off" in copy["outside"].lower()
    assert "CHILL" in copy["outside"]


def test_peak_gets_its_own_line():
    t = detect_transition("lit", "peak")
    copy = transition_copy("Bature", t)
    assert "PEAK" in copy["inside"]
    assert "PEAK" in copy["outside"]


def test_no_em_dashes_in_any_transition_copy():
    """House rule, and these strings go out as push notifications."""
    for a, b in [("warming", "lit"), ("lit", "peak"), ("peak", "chill"), ("chill", "quiet")]:
        copy = transition_copy("Bature", detect_transition(a, b))
        for key in ("inside", "outside", "nudge"):
            assert "—" not in copy[key], f"em dash in {key}"


def test_every_transition_invites_a_correction():
    """
    Both directions end with a way to say we are wrong. That is the mechanic
    that keeps the reading true and it must never be dropped from the copy.
    """
    for a, b in [("warming", "lit"), ("peak", "chill")]:
        copy = transition_copy("Bature", detect_transition(a, b))
        assert copy["nudge"]
        assert "tap" in copy["nudge"].lower()
