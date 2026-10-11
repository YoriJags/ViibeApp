"""
Synthetic readings must never pass for evidence.

These guard the flaw found in production: the live API reported Lagos as LIT
with ten active scouts and zero real readings, because demo readings were
blended into scores, counted as scouts, and served to machines.
"""
from app.services.synthetic import (
    DEMO_PREFIX,
    SOURCE_DEMO,
    SOURCE_NONE,
    SOURCE_SCOUTS,
    for_machines,
    has_real_reading,
    is_demo_venue,
    is_synthetic,
    real_only_filter,
    separate,
)


def demo(n=0, **kw):
    return {"user_id": f"{DEMO_PREFIX}{n}", "vibe_score": 90, **kw}


def real(uid="u1", **kw):
    return {"user_id": uid, "vibe_score": 40, **kw}


def test_demo_readings_are_recognised_by_flag_or_by_account():
    assert is_synthetic(demo())
    assert is_synthetic({"user_id": "someone", "synthetic": True})
    assert not is_synthetic(real())
    assert not is_synthetic({})


def test_real_and_demo_readings_are_never_blended():
    """
    The core bug. One real scout saying the room is quiet must not be averaged
    against nine made-up readings saying it is peaking.
    """
    kept, source = separate([demo(0), demo(1), demo(2), real("u1")])
    assert source == SOURCE_SCOUTS
    assert kept == [real("u1")]
    assert all(not is_synthetic(r) for r in kept)


def test_demo_alone_is_labelled_demo():
    kept, source = separate([demo(0), demo(1)])
    assert source == SOURCE_DEMO
    assert len(kept) == 2


def test_nothing_is_labelled_none():
    assert separate([]) == ([], SOURCE_NONE)
    assert separate(None) == ([], SOURCE_NONE)


def test_evidence_counts_exclude_demo_by_flag_and_by_account():
    """Signal Density and VIIBE CERTIFIED both rest on this filter."""
    f = real_only_filter()
    assert f["synthetic"] == {"$ne": True}
    assert DEMO_PREFIX in f["user_id"]["$not"]["$regex"]


def test_machines_never_receive_a_demo_reading():
    venue = {
        "id": "v1", "name": "Bature", "energy_source": SOURCE_DEMO,
        "current_vibe_score": 88, "energy_level": "peak", "vibe_state": "peak",
        "is_surging": True, "viibe_certified": True,
    }
    out = for_machines(venue)
    assert out["current_vibe_score"] is None
    assert out["energy_level"] is None
    assert out["is_surging"] is None
    assert out["viibe_certified"] is None
    assert out["energy_source"] == SOURCE_NONE
    assert out["name"] == "Bature", "identity is fine to share, the reading is not"
    assert venue["current_vibe_score"] == 88, "the original record is not mutated"


def test_real_venues_pass_through_to_machines_untouched():
    venue = {"id": "v1", "energy_source": SOURCE_SCOUTS, "current_vibe_score": 72}
    assert for_machines(venue) is venue


def test_an_unlabelled_venue_is_never_trusted_as_real():
    """
    Regression guard for what happened in production. The first version of this
    test asserted the OPPOSITE: that an unlabelled venue should be treated as
    real, so as not to hide data while aggregates refreshed. One stale venue
    holding six demo readings and no real ones then made the live API report
    Lagos as LIT "from scouts". A missing label must fail closed.
    """
    unlabelled = {"id": "v1", "name": "The Blowfish Hotel", "current_vibe_score": 75.2,
                  "vibe_state": "lit"}
    assert not has_real_reading(unlabelled)
    out = for_machines(unlabelled)
    assert out["current_vibe_score"] is None, "machines must not receive it"
    assert out["vibe_state"] is None
    # For display it is simply not labelled demo; the startup relabel ensures it
    # does not stay unlabelled.
    assert not is_demo_venue(unlabelled)


def test_only_a_positive_real_label_counts_as_real():
    assert has_real_reading({"energy_source": SOURCE_SCOUTS})
    assert not has_real_reading({"energy_source": SOURCE_DEMO})
    assert not has_real_reading({"energy_source": SOURCE_NONE})
    assert not has_real_reading({})
    assert not has_real_reading(None)
