"""
Signal Density: how much evidence sits behind a reading.

The bug this locks shut: this function used to be `compute_pulse` and returned
tiers named dormant / stirring / charged / electric / max_pulse / source. Four
of those words also name states on the ENERGY ladder, so a venue that had merely
received eighty ratings showed "ELECTRIC" to its own owner on the merchant
dashboard, and to a user standing outside it on the nearby CTA.

That is a false claim about someone's business made by the one product whose
moat is not making false claims. See docs/VOCABULARY.md.
"""
import pytest

from app.services.signal_density import LADDER, compute_signal_density

# The canonical energy ladder from docs/ENERGY.md. No signal-density tier may
# ever use one of these words again.
ENERGY_WORDS = {
    "quiet", "chill", "warming", "charged", "lit", "peak",
    # The venue REPUTATION ladder, persisted on the venue document. A density
    # tier must not borrow from this one either.
    "new", "building", "solid", "established", "elite",
    # Historic energy-adjacent words that caused the original collision.
    "electric", "dormant", "stirring", "max_pulse", "source",
}

DENSITY_LADDER = LADDER


@pytest.mark.parametrize("count,expected_tier,expected_next", [
    (0,   "none",      20),
    (19,  "none",      20),
    (20,  "thin",      40),
    (39,  "thin",      40),
    (40,  "partial",   60),
    (59,  "partial",   60),
    (60,  "firm",      80),
    (79,  "firm",      80),
    (80,  "dense",     100),
    (99,  "dense",     100),
    (100, "saturated", 0),
])
def test_tier_boundaries(count, expected_tier, expected_next):
    out = compute_signal_density({"total_ratings_24h": count})
    assert out["tier"] == expected_tier
    assert out["next_tier_at"] == expected_next
    assert out["count"] == count
    assert out["total"] == 100


def test_no_tier_borrows_an_energy_word():
    """The regression guard. If someone reintroduces an energy word here, the
    build fails before a merchant reads it as a claim about their room."""
    for count in range(0, 201, 5):
        tier = compute_signal_density({"total_ratings_24h": count})["tier"]
        assert tier in DENSITY_LADDER, f"unknown tier {tier!r}"
        assert tier not in ENERGY_WORDS, (
            f"signal density tier {tier!r} is also an energy state. "
            "The two ladders must never share vocabulary."
        )


def test_count_is_capped_not_wrapped():
    """A very busy venue saturates. It does not roll over to a lower tier."""
    out = compute_signal_density({"total_ratings_24h": 5000})
    assert out["count"] == 100
    assert out["tier"] == "saturated"


def test_missing_and_junk_counts_read_as_no_signal():
    """Absence of data is 'we know nothing', never a flattering default."""
    assert compute_signal_density({})["tier"] == "none"
    assert compute_signal_density({"total_ratings_24h": None})["tier"] == "none"
    assert compute_signal_density({"total_ratings_24h": "not a number"})["tier"] == "none"
    assert compute_signal_density({"total_ratings_24h": -40})["tier"] == "none"


def test_density_is_independent_of_energy():
    """Density must not move when the energy score moves. They answer different
    questions and the whole rename exists to keep them apart."""
    quiet_but_well_covered = compute_signal_density(
        {"total_ratings_24h": 85, "current_vibe_score": 4}
    )
    loud_but_barely_covered = compute_signal_density(
        {"total_ratings_24h": 3, "current_vibe_score": 97}
    )
    assert quiet_but_well_covered["tier"] == "dense"
    assert loud_but_barely_covered["tier"] == "none"


def test_legacy_name_is_gone():
    """`compute_pulse` must not come back, under that name or as an alias."""
    import app.services.signal_density as mod
    assert not hasattr(mod, "compute_pulse")

    # And the route file must not grow a local copy of it again.
    from pathlib import Path
    route = Path(__file__).resolve().parents[1] / "app" / "routes" / "venues.py"
    assert "def compute_pulse" not in route.read_text(encoding="utf-8")
