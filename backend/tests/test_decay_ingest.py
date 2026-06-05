"""
Phase 2 — Layer Ingestion integration tests.

Verifies the full roundtrip: raw app signal -> normalise -> decay engine ->
query surface. Exercises the adapter against the real module-level registry,
so a break in either the adapter or the engine wiring fails here.
"""
import pytest

from app.services.energy_decay import registry, TAU_L1
from app.services.decay_ingest import (
    ingest_pulse,
    ingest_dwell,
    ingest_ambient,
    ingest_exit,
    read_venue_energy,
    _norm_g_force,
    _norm_db,
    MIN_LEGIT_TAP,
    ABUSE_L1_CAP,
)


@pytest.fixture(autouse=True)
def _clear_registry():
    """Registry is a module singleton — isolate every test."""
    registry._cells.clear()
    yield
    registry._cells.clear()


# ─── Normalisation ────────────────────────────────────────────────────────────

def test_g_force_normalisation_band():
    assert _norm_g_force(1.0) == 0.0       # floor — a still tap
    assert _norm_g_force(2.5) == 1.0       # ceil — full peak
    assert _norm_g_force(1.75) == pytest.approx(0.5)
    assert _norm_g_force(5.0) == 1.0       # clamped


def test_db_normalisation_band():
    assert _norm_db(-80.0) == 0.0          # silent
    assert _norm_db(-20.0) == 1.0          # club-loud
    assert _norm_db(-50.0) == pytest.approx(0.5)
    assert _norm_db(-160.0) == 0.0         # clamped


# ─── Roundtrip ────────────────────────────────────────────────────────────────

def test_unseen_venue_reads_none():
    assert read_venue_energy("ghost-venue", now=1000.0) is None


def test_pulse_then_read_raises_energy():
    ingest_pulse("quilox", scout_id="s1", avg_g_force=2.5, now=1000.0)
    r = read_venue_energy("quilox", now=1000.0)
    assert r is not None
    assert r.energy > 0.0
    assert r.layer_breakdown["L1"] == pytest.approx(1.0, abs=1e-3)


def test_legit_tap_floors_above_zero():
    # A floor-G tap still registers active energy (it's a real body present).
    ingest_pulse("shiro", scout_id="s1", avg_g_force=1.0, now=1000.0)
    r = read_venue_energy("shiro", now=1000.0)
    assert r.layer_breakdown["L1"] == pytest.approx(MIN_LEGIT_TAP, abs=1e-3)


def test_stationary_peak_abuse_is_capped():
    # Claims peak but low G-force → fraud → hard cap, never full energy.
    ingest_pulse("fraud-bar", scout_id="cheat", avg_g_force=2.5,
                 stationary_peak_abuse=True, now=1000.0)
    r = read_venue_energy("fraud-bar", now=1000.0)
    assert r.layer_breakdown["L1"] <= ABUSE_L1_CAP + 1e-6


def test_energy_decays_after_signal_stops():
    ingest_pulse("escape", scout_id="s1", avg_g_force=2.5, now=1000.0)
    fresh = read_venue_energy("escape", now=1000.0).energy
    # One L1 half-life later (~31s), active layer should be ~half.
    later = read_venue_energy("escape", now=1000.0 + TAU_L1).energy
    assert later < fresh
    assert later == pytest.approx(fresh * 0.37, rel=0.25)  # e^-1 ≈ 0.368


def test_dwell_feeds_presence_layer():
    ingest_dwell("club-joker", scout_id="s1", now=1000.0)
    r = read_venue_energy("club-joker", now=1000.0)
    assert r.layer_breakdown["L2"] == pytest.approx(1.0, abs=1e-3)


def test_ambient_feeds_ambient_layer():
    ingest_ambient("the-vault", db_level=-20.0, scout_id="s1", now=1000.0)
    r = read_venue_energy("the-vault", now=1000.0)
    assert r.layer_breakdown["L3"] == pytest.approx(1.0, abs=1e-3)


def test_two_scouts_reach_full_confidence():
    # G2 gate: a single scout renders translucent (confidence 0.5); two clears it.
    ingest_pulse("dna", scout_id="s1", avg_g_force=2.5, now=1000.0)
    ingest_dwell("dna", scout_id="s1", now=1000.0)
    solo = read_venue_energy("dna", now=1000.0)
    assert solo.confidence == 0.5
    assert "G2" in solo.gates_failed

    ingest_pulse("dna", scout_id="s2", avg_g_force=2.5, now=1001.0)
    ingest_dwell("dna", scout_id="s2", now=1001.0)
    pair = read_venue_energy("dna", now=1001.0)
    assert pair.confidence == 1.0
    assert "G2" not in pair.gates_failed


def test_exit_subtracts_departed_scout():
    # Two scouts build presence; one leaves → cell energy drops, doesn't vanish.
    ingest_dwell("rhapsody", scout_id="s1", now=1000.0)
    ingest_pulse("rhapsody", scout_id="s1", avg_g_force=2.0, now=1000.0)
    ingest_dwell("rhapsody", scout_id="s2", now=1000.0)
    ingest_pulse("rhapsody", scout_id="s2", avg_g_force=2.0, now=1000.0)
    before = read_venue_energy("rhapsody", now=1000.0).energy

    ingest_exit("rhapsody", scout_id="s1", now=1001.0)
    after = read_venue_energy("rhapsody", now=1001.0).energy
    assert after < before
    assert after > 0.0


def test_exit_on_unseen_venue_is_noop():
    ingest_exit("nowhere", scout_id="s1", now=1000.0)  # must not raise
    assert read_venue_energy("nowhere", now=1000.0) is None
