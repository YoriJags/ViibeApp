"""One-tap decay refresh: deltas against the room's current reading."""
import pytest

from app.services import pulse_check as pc


# ── energy deltas ────────────────────────────────────────────────────────────

def test_hotter_moves_one_rung_up():
    assert pc.shift_energy("warming", "hotter") == "lit"


def test_cooling_moves_one_rung_down():
    assert pc.shift_energy("lit", "cooling") == "warming"


def test_same_holds_the_reading():
    assert pc.shift_energy("lit", "same") == "lit"


def test_peak_cannot_be_pushed_higher():
    assert pc.shift_energy("peak", "hotter") == "peak"


def test_quiet_cannot_be_pushed_lower():
    assert pc.shift_energy("quiet", "cooling") == "quiet"


def test_unknown_current_level_falls_back_to_the_middle_not_the_top():
    """An unreadable room must never default into looking busy."""
    assert pc.shift_energy(None, "same") == "warming"
    assert pc.shift_energy("nonsense", "same") == "warming"


def test_an_unknown_delta_is_rejected():
    with pytest.raises(ValueError):
        pc.shift_energy("lit", "sideways")


# ── carry forward ────────────────────────────────────────────────────────────

def test_current_capacity_and_door_carry_forward():
    got = pc.carry_forward({"capacity_level": "full", "gate_level": "blocked"})
    assert got == {"capacity": "full", "gate": "blocked"}


def test_missing_values_default_to_the_unflattering_end():
    assert pc.carry_forward({}) == {"capacity": "sparse", "gate": "clear"}


def test_junk_values_do_not_leak_through():
    got = pc.carry_forward({"capacity_level": "packed!!", "gate_level": 7})
    assert got == {"capacity": "sparse", "gate": "clear"}
