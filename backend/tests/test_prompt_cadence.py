"""
Prompt cadence: the app asks so nobody has to remember.

The guards are the product here. A rhythm that nags gets notifications turned
off, and then VIIBE has no way to reach anyone at all.
"""
import pytest
from datetime import datetime, timedelta, timezone

from app.services.prompt_cadence import (
    CADENCE_OPTIONS,
    DEFAULT_CADENCE,
    MAX_PROMPTS_PER_NIGHT,
    MIN_MINUTES_AFTER_READING,
    cadence_minutes,
    is_prompt_due,
    minutes_until_due,
    prompt_plan,
)

NOW = datetime(2026, 9, 17, 23, 0, tzinfo=timezone.utc)


def ago(minutes: int) -> datetime:
    return NOW - timedelta(minutes=minutes)


# ── Cadence resolution ────────────────────────────────────────────────────────

def test_every_option_resolves():
    for key in CADENCE_OPTIONS:
        cadence_minutes(key)  # must not raise


def test_off_means_off():
    assert cadence_minutes("off") is None


def test_unknown_cadence_falls_back_to_default_not_to_aggressive():
    """A bad value must never silently opt someone into the tightest rhythm."""
    fallback = cadence_minutes("nonsense")
    assert fallback == CADENCE_OPTIONS[DEFAULT_CADENCE]
    assert fallback > CADENCE_OPTIONS["often"]
    assert cadence_minutes(None) == CADENCE_OPTIONS[DEFAULT_CADENCE]


# ── Timing ────────────────────────────────────────────────────────────────────

def test_a_scout_who_has_not_read_this_room_is_due_immediately():
    """
    Standing in a room nobody has read is the most valuable reading on the map,
    so there is nothing to wait for.
    """
    assert minutes_until_due(None, "normal", NOW) == 0.0


def test_a_fresh_reading_is_not_chased():
    assert minutes_until_due(ago(2), "normal", NOW) > 0


def test_a_stale_reading_is_due():
    assert minutes_until_due(ago(90), "normal", NOW) == 0.0


def test_the_tightest_cadence_still_respects_the_settle_window():
    """
    'often' is 20 minutes, but even a hypothetical faster setting could never
    ask inside the settle window.
    """
    just_read = minutes_until_due(ago(1), "often", NOW)
    assert just_read >= MIN_MINUTES_AFTER_READING - 1 - 1


def test_naive_timestamps_are_handled():
    naive = ago(90).replace(tzinfo=None)
    assert minutes_until_due(naive, "normal", NOW) == 0.0


# ── Guards ────────────────────────────────────────────────────────────────────

def test_never_prompts_someone_who_is_not_in_a_venue():
    """Reading a room you already left is the stale data this exists to prevent."""
    assert not is_prompt_due(ago(200), "often", is_checked_in=False, now=NOW)


def test_off_is_honoured_even_when_long_overdue():
    assert not is_prompt_due(ago(500), "off", is_checked_in=True, now=NOW)


def test_the_nightly_cap_holds():
    assert is_prompt_due(ago(200), "often", True, prompts_tonight=0, now=NOW)
    assert not is_prompt_due(ago(200), "often", True,
                             prompts_tonight=MAX_PROMPTS_PER_NIGHT, now=NOW)


def test_junk_prompt_counts_do_not_unlock_unlimited_prompts():
    assert is_prompt_due(ago(200), "often", True, prompts_tonight=None, now=NOW)
    assert is_prompt_due(ago(200), "often", True, prompts_tonight="many", now=NOW)


# ── Plan payload ──────────────────────────────────────────────────────────────

def test_plan_explains_itself_in_every_state():
    """The client shows these reasons, so none of them may be blank."""
    cases = [
        (ago(200), "normal", False, 0),
        (ago(200), "off",    True,  0),
        (ago(200), "normal", True,  MAX_PROMPTS_PER_NIGHT),
        (ago(200), "normal", True,  0),
        (ago(2),   "normal", True,  0),
    ]
    for last, cadence, checked_in, used in cases:
        plan = prompt_plan(last, cadence, checked_in, used, NOW)
        assert plan["reason"]
        assert "due" in plan
        assert plan["max_per_night"] == MAX_PROMPTS_PER_NIGHT


def test_plan_is_due_only_when_every_guard_passes():
    good = prompt_plan(ago(200), "normal", True, 0, NOW)
    assert good["due"] is True
    assert good["reason"] == "your reading is going stale"

    for bad in (
        prompt_plan(ago(200), "normal", False, 0, NOW),
        prompt_plan(ago(200), "off", True, 0, NOW),
        prompt_plan(ago(200), "normal", True, MAX_PROMPTS_PER_NIGHT, NOW),
        prompt_plan(ago(1), "normal", True, 0, NOW),
    ):
        assert bad["due"] is False


def test_off_reports_no_countdown_rather_than_a_fake_one():
    plan = prompt_plan(ago(200), "off", True, 0, NOW)
    assert plan["cadence_minutes"] is None
    assert plan["minutes_until_due"] is None
