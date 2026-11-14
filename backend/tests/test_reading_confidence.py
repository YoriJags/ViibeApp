"""
Reading confidence (PLAN.md Phase 3): the trust gates, and a replay of one
hundred simulated venues, honest and adversarial, to prove that nothing
untrustworthy ever draws solid on the map.
"""
import random
from datetime import datetime, timedelta, timezone

from app.services.energy_decay import VPixelState, apply_signal, compute
from app.services.reading_confidence import (
    SOLID_AT, band, corroboration_factor, freshness_factor, reading_confidence,
)

NOW = datetime(2026, 11, 14, 23, 0, tzinfo=timezone.utc)
T = NOW.timestamp()


def venue(scouts=5, age_min=5, consensus_count=None, consensus_rate=1.0, source="scouts"):
    return {
        "id": "v1",
        "energy_source": source,
        "active_scouts": scouts,
        "last_rated_at": NOW - timedelta(minutes=age_min),
        "consensus_count": scouts if consensus_count is None else consensus_count,
        "consensus_rate": consensus_rate,
    }


def presence_alive():
    cell = VPixelState(cell_id="v1")
    apply_signal(cell, "L2", 1.0, "s1", T - 20)
    apply_signal(cell, "L2", 1.0, "s2", T - 10)
    return compute(cell, T)


def presence_lost():
    cell = VPixelState(cell_id="v1")
    apply_signal(cell, "L2", 1.0, "s1", T - 120)
    return compute(cell, T)


def taps_without_presence():
    """Home-tap fraud: presence went quiet minutes ago, hot taps keep landing."""
    cell = VPixelState(cell_id="v1")
    apply_signal(cell, "L2", 1.0, "s1", T - 300)
    apply_signal(cell, "L1", 1.0, "s1", T - 2)
    return compute(cell, T)


def conf(v, presence=None):
    return reading_confidence(v, NOW, presence)


# ── The four parts ───────────────────────────────────────────────────────────

def test_five_fresh_agreeing_scouts_with_presence_is_fully_trusted():
    r = conf(venue(), presence_alive())
    assert r["confidence"] == 1.0
    assert r["confidence_gates"] == []
    assert r["score_confidence"] == "high"


def test_unknown_presence_costs_a_little_and_fails_nothing():
    r = conf(venue())
    assert 0.8 <= r["confidence"] < 1.0
    assert r["confidence_gates"] == []


def test_more_scouts_never_lowers_confidence():
    scores = [conf(venue(scouts=n))["confidence"] for n in range(0, 9)]
    assert scores == sorted(scores)
    assert corroboration_factor(50) == 1.0


def test_an_older_reading_is_never_more_trusted():
    scores = [conf(venue(age_min=m))["confidence"] for m in (0, 10, 30, 60, 89, 120, 179, 200)]
    assert scores == sorted(scores, reverse=True)
    assert freshness_factor(15) == 1.0
    assert freshness_factor(180) == 0.0


def test_disagreement_lowers_confidence():
    agree = conf(venue(consensus_rate=1.0))["confidence"]
    split = conf(venue(consensus_rate=0.4))["confidence"]
    assert split < agree


# ── The gates ────────────────────────────────────────────────────────────────

def test_a_single_scout_is_never_solid():
    r = conf(venue(scouts=1, age_min=0), presence_alive())
    assert r["confidence"] < SOLID_AT
    assert "single_scout" in r["confidence_gates"]


def test_hot_taps_without_presence_are_never_solid():
    r = conf(venue(scouts=8, age_min=0), taps_without_presence())
    assert r["confidence"] < SOLID_AT
    assert "taps_without_presence" in r["confidence_gates"]


def test_lost_presence_is_never_solid():
    r = conf(venue(scouts=8, age_min=0), presence_lost())
    assert r["confidence"] < SOLID_AT
    assert "presence_lost" in r["confidence_gates"]


def test_a_stale_reading_is_never_solid():
    r = conf(venue(scouts=8, age_min=100), presence_alive())
    assert r["confidence"] < SOLID_AT
    assert "stale" in r["confidence_gates"]


def test_an_expired_reading_is_no_reading():
    r = conf(venue(scouts=8, age_min=181))
    assert r["confidence"] == 0.0
    assert r["confidence_gates"] == ["no_reading"]


# ── What is not evidence ─────────────────────────────────────────────────────

def test_demo_is_neither_trusted_nor_distrusted():
    r = conf(venue(source="demo"))
    assert r["confidence"] is None
    assert r["confidence_gates"] == ["demo"]


def test_no_reading_is_zero_not_a_flattering_default():
    assert conf({"id": "v1", "energy_source": "none"})["confidence"] == 0.0
    assert conf({"id": "v1"})["confidence"] == 0.0
    # Stale evidence fields left on a venue with no source do not count.
    assert conf({**venue(), "energy_source": "none"})["confidence"] == 0.0


def test_naive_and_string_timestamps_are_read_as_utc():
    naive = venue()
    naive["last_rated_at"] = (NOW - timedelta(minutes=5)).replace(tzinfo=None)
    text = venue()
    text["last_rated_at"] = (NOW - timedelta(minutes=5)).isoformat()
    assert conf(naive)["confidence"] == conf(text)["confidence"] == conf(venue())["confidence"]


def test_band_follows_the_score():
    assert band(None) == band(0.0) == band(0.49) == "low"
    assert band(0.5) == band(0.74) == "medium"
    assert band(0.75) == band(1.0) == "high"


# ── Replay: one hundred simulated venues ─────────────────────────────────────

def test_replay_of_one_hundred_venues_never_draws_a_lie_solid():
    """
    Sixty honest rooms and forty attacks or decayed readings. Every attack must
    draw faded; every well-evidenced honest room must draw solid.
    """
    rng = random.Random(1411)
    attacks = [
        lambda: (venue(scouts=1, age_min=rng.uniform(0, 10)), presence_alive()),          # one loud voice
        lambda: (venue(scouts=rng.randint(2, 20), age_min=0), taps_without_presence()),   # home-tap ring
        lambda: (venue(scouts=rng.randint(2, 20), age_min=0), presence_lost()),           # room emptied
        lambda: (venue(scouts=rng.randint(2, 20), age_min=rng.uniform(91, 400)), None),   # stale peak
        lambda: (venue(scouts=0, age_min=0), presence_alive()),                           # nobody behind it
    ]
    solid_lies = []
    for i in range(40):
        v, p = attacks[i % len(attacks)]()
        if conf(v, p)["confidence"] >= SOLID_AT:
            solid_lies.append((i, v))
    assert solid_lies == []

    faded_truths = []
    for i in range(60):
        v = venue(scouts=rng.randint(3, 20), age_min=rng.uniform(0, 30),
                  consensus_rate=rng.uniform(0.6, 1.0))
        p = presence_alive() if i % 2 else None
        r = conf(v, p)
        if r["confidence"] < SOLID_AT or r["confidence_gates"]:
            faded_truths.append((i, v, r))
    assert faded_truths == []
