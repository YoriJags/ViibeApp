"""
Unit tests for app.services.vibe — pure calculation functions.

No database or network access required; all DB-dependent helpers
(compute_scout_credibility, aggregate_venue_vibe) are tested separately
using the mock_db fixture from conftest.py.
"""
import pytest
import math
from app.services.vibe import (
    calculate_vibe_score,
    get_venue_state,
    calculate_distance,
    is_within_geofence,
    compute_scout_credibility,
)
from app.models import Coordinates

pytestmark = pytest.mark.unit


# ---------------------------------------------------------------------------
# calculate_vibe_score
# ---------------------------------------------------------------------------

class TestCalculateVibeScore:
    def test_peak_energy_full_crowd_no_venue_specific(self):
        score = calculate_vibe_score("peak", "full", "clear")
        # e=100*0.8=80, vs=50*0.2=10, base=90, mult=1.15 → 103.5 → capped at 100
        assert score == 100.0

    def test_quiet_energy_gives_low_score(self):
        score = calculate_vibe_score("quiet", "sparse", "clear")
        # e=0*0.8=0, vs=50*0.2=10, base=10, mult=0.92 → 9.2
        assert score == pytest.approx(9.2, abs=0.1)

    def test_chill_energy_vibrant_crowd(self):
        score = calculate_vibe_score("chill", "vibrant", "blocked")
        # e=25*0.8=20, vs=50*0.2=10, base=30, mult=1.05 → 31.5
        assert score == pytest.approx(31.5, abs=0.1)

    def test_warming_energy_no_venue_specific(self):
        score = calculate_vibe_score("warming", "sparse", "slow")
        # e=50*0.8=40, vs=50*0.2=10, base=50, mult=0.92 → 46.0
        assert score == pytest.approx(46.0, abs=0.1)

    def test_lit_energy_full_crowd(self):
        score = calculate_vibe_score("lit", "full", "clear")
        # e=75*0.8=60, vs=50*0.2=10, base=70, mult=1.15 → 80.5
        assert score == pytest.approx(80.5, abs=0.1)

    def test_venue_specific_killing_it_boosts_score(self):
        base_score = calculate_vibe_score("warming", "vibrant", "clear")
        boosted_score = calculate_vibe_score("warming", "vibrant", "clear", venue_specific="killing_it")
        assert boosted_score > base_score

    def test_venue_specific_mellow_lowers_score(self):
        base_score = calculate_vibe_score("warming", "vibrant", "clear")
        lowered_score = calculate_vibe_score("warming", "vibrant", "clear", venue_specific="mellow")
        assert lowered_score < base_score

    def test_score_never_exceeds_100(self):
        score = calculate_vibe_score("peak", "full", "clear", venue_specific="killing_it")
        assert score <= 100.0

    def test_score_never_below_zero(self):
        score = calculate_vibe_score("quiet", "sparse", "blocked", venue_specific="mellow")
        assert score >= 0.0

    def test_unknown_energy_defaults_to_chill(self):
        # energy_scores.get("unknown", 25) → defaults to chill (25)
        score_unknown = calculate_vibe_score("unknown", "vibrant", "clear")
        score_chill = calculate_vibe_score("chill", "vibrant", "clear")
        assert score_unknown == score_chill

    def test_returns_float_rounded_to_one_decimal(self):
        score = calculate_vibe_score("lit", "vibrant", "slow")
        assert isinstance(score, float)
        assert round(score, 1) == score


# ---------------------------------------------------------------------------
# get_venue_state
# ---------------------------------------------------------------------------

class TestGetVenueState:
    def test_score_above_85_is_peak(self):
        assert get_venue_state(85.0, "full") == "peak"
        assert get_venue_state(100.0, "sparse") == "peak"

    def test_score_65_to_84_is_lit(self):
        assert get_venue_state(65.0, "sparse") == "lit"
        assert get_venue_state(84.9, "vibrant") == "lit"

    def test_charged_state_requires_large_crowd(self):
        # Score in warming range (45-64) with vibrant/full → "charged"
        assert get_venue_state(50.0, "full") == "charged"
        assert get_venue_state(50.0, "vibrant") == "charged"

    def test_warming_state_when_sparse_crowd_in_mid_range(self):
        assert get_venue_state(50.0, "sparse") == "warming"

    def test_chill_state_for_low_scores(self):
        assert get_venue_state(20.0, "sparse") == "chill"
        assert get_venue_state(44.9, "sparse") == "chill"

    def test_quiet_state_for_very_low_scores(self):
        assert get_venue_state(0.0, "sparse") == "quiet"
        assert get_venue_state(19.9, "full") == "quiet"

    def test_custom_charged_threshold(self):
        # Lagos Island mode: threshold lowered to 35
        # Score=40, capacity=full, threshold=35 → charged
        assert get_venue_state(40.0, "full", charged_threshold=35) == "charged"
        # With default threshold (45): score=40 → warming
        assert get_venue_state(40.0, "full", charged_threshold=45) == "chill"


# ---------------------------------------------------------------------------
# calculate_distance (Haversine)
# ---------------------------------------------------------------------------

class TestCalculateDistance:
    def test_same_point_is_zero(self):
        d = calculate_distance(6.4281, 3.4219, 6.4281, 3.4219)
        assert d == pytest.approx(0.0, abs=0.01)

    def test_known_distance_lagos_to_abuja(self):
        # Lagos center ↔ Abuja center — roughly 530 km
        d = calculate_distance(6.4281, 3.4219, 9.0579, 7.4951)
        assert 500_000 < d < 560_000

    def test_short_distance_within_venue_geofence(self):
        # Two points ~50 m apart
        d = calculate_distance(6.4281, 3.4219, 6.4285, 3.4219)
        assert d < 200  # should be tens of metres

    def test_distance_is_symmetric(self):
        d1 = calculate_distance(6.4281, 3.4219, 9.0579, 7.4951)
        d2 = calculate_distance(9.0579, 7.4951, 6.4281, 3.4219)
        assert d1 == pytest.approx(d2, rel=1e-6)

    def test_returns_metres_not_km(self):
        # Lagos ↔ Abuja should be hundreds of thousands of metres, not hundreds
        d = calculate_distance(6.4281, 3.4219, 9.0579, 7.4951)
        assert d > 1000  # definitely more than 1 km in metres


# ---------------------------------------------------------------------------
# is_within_geofence
# ---------------------------------------------------------------------------

class TestIsWithinGeofence:
    def test_user_at_venue_is_within(self):
        user = Coordinates(lat=6.4281, lng=3.4219)
        venue = Coordinates(lat=6.4281, lng=3.4219)
        assert is_within_geofence(user, venue, radius_m=100) is True

    def test_user_far_away_is_outside(self):
        user = Coordinates(lat=6.5000, lng=3.5000)
        venue = Coordinates(lat=6.4281, lng=3.4219)
        assert is_within_geofence(user, venue, radius_m=100) is False

    def test_user_just_inside_boundary(self):
        # Move user ~80 m north of venue (latitude shift ≈ 0.00072°/80m)
        user = Coordinates(lat=6.4281 + 0.00072, lng=3.4219)
        venue = Coordinates(lat=6.4281, lng=3.4219)
        assert is_within_geofence(user, venue, radius_m=100) is True

    def test_user_just_outside_boundary(self):
        # Move user ~200 m north of venue
        user = Coordinates(lat=6.4281 + 0.0018, lng=3.4219)
        venue = Coordinates(lat=6.4281, lng=3.4219)
        assert is_within_geofence(user, venue, radius_m=100) is False

    def test_custom_radius_respected(self):
        user = Coordinates(lat=6.4281, lng=3.4219)
        venue = Coordinates(lat=6.4381, lng=3.4219)  # ~1.1 km away
        assert is_within_geofence(user, venue, radius_m=100) is False
        assert is_within_geofence(user, venue, radius_m=2000) is True


# ---------------------------------------------------------------------------
# compute_scout_credibility (requires DB mock)
# ---------------------------------------------------------------------------

class TestComputeScoutCredibility:
    @pytest.mark.asyncio
    async def test_new_scout_gets_floor_weight(self, mock_db):
        mock_db.ratings.count_documents = pytest.mark.asyncio
        mock_db.ratings.count_documents = __import__('unittest.mock', fromlist=['AsyncMock']).AsyncMock(return_value=0)
        result = await compute_scout_credibility("user-new")
        assert result == pytest.approx(0.15, abs=0.01)

    @pytest.mark.asyncio
    async def test_experienced_scout_gets_full_weight(self, mock_db):
        from unittest.mock import AsyncMock
        mock_db.ratings.count_documents = AsyncMock(return_value=30)
        result = await compute_scout_credibility("user-veteran")
        assert result == pytest.approx(1.0, abs=0.01)

    @pytest.mark.asyncio
    async def test_mid_experience_scout(self, mock_db):
        from unittest.mock import AsyncMock
        mock_db.ratings.count_documents = AsyncMock(return_value=15)
        result = await compute_scout_credibility("user-mid")
        # min(1.0, max(0.15, 15/30)) = 0.5
        assert result == pytest.approx(0.5, abs=0.01)

    @pytest.mark.asyncio
    async def test_credibility_caps_at_one(self, mock_db):
        from unittest.mock import AsyncMock
        mock_db.ratings.count_documents = AsyncMock(return_value=100)
        result = await compute_scout_credibility("user-legend")
        assert result <= 1.0
