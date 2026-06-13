"""
Solo Reactor core tests — early-mover multiplier + signature math, no Mongo.
"""
import pytest

from app.services.solo_reactor import (
    early_multiplier,
    retro_clout,
    solo_signature,
    MAX_EARLY_MULT,
)


# ─── Early multiplier ─────────────────────────────────────────────────────────

def test_alone_at_venue_that_packs_out_gets_max():
    # 1 scout when active, peaked at a big crowd → near MAX.
    m = early_multiplier(scouts_when_active=1, peak_scouts=1000)
    assert m == pytest.approx(MAX_EARLY_MULT, abs=0.05)


def test_arriving_at_peak_gives_no_bonus():
    assert early_multiplier(scouts_when_active=50, peak_scouts=50) == 1.0


def test_halfway_crowd_is_partial_bonus():
    # ratio 0.5 → 1 + 0.5*(3-1) = 2.0
    assert early_multiplier(10, 20) == pytest.approx(2.0, abs=0.01)


def test_degenerate_inputs_are_neutral():
    assert early_multiplier(0, 100) == 1.0
    assert early_multiplier(5, 0) == 1.0


def test_more_scouts_than_peak_clamps_to_one():
    # Shouldn't happen, but defensive: never penalise below 1.0.
    assert early_multiplier(80, 50) == 1.0


# ─── Retro clout ──────────────────────────────────────────────────────────────

def test_retro_clout_is_bonus_over_base():
    # base 30, alone→pack (mult≈3) → bonus ≈ 30*(3-1)=60
    bonus = retro_clout(30, scouts_when_active=1, peak_scouts=1000)
    assert bonus == pytest.approx(60, abs=2)


def test_retro_clout_zero_with_no_early_edge():
    assert retro_clout(30, scouts_when_active=50, peak_scouts=50) == 0


# ─── Solo signature ───────────────────────────────────────────────────────────

def test_signature_dormant_when_no_taps():
    assert solo_signature(0, 0, 0).label == "DORMANT"


def test_signature_igniter_high_tempo_and_force():
    assert solo_signature(40, peak_g=2.6, avg_bpm=130).label == "IGNITER"


def test_signature_heavy_force_low_tempo():
    assert solo_signature(20, peak_g=2.4, avg_bpm=80).label == "HEAVY"


def test_signature_steady_rhythm():
    assert solo_signature(20, peak_g=1.4, avg_bpm=118).label == "STEADY"


def test_signature_warming_low_everything():
    assert solo_signature(5, peak_g=1.1, avg_bpm=70).label == "WARMING"


def test_signature_rounds_stats():
    s = solo_signature(12, peak_g=2.345, avg_bpm=127.6)
    assert s.peak_g == 2.35
    assert s.avg_bpm == 128
