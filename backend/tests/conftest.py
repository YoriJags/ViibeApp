"""
Shared pytest fixtures for Vibe App backend tests.

Database-dependent tests use AsyncMock to patch `app.config.db` so no live
MongoDB connection is required. Pure-logic tests (vibe score, rate limiter, etc.)
need no fixtures at all.

We stub out `app.config` early (via sys.modules) so that Motor/pymongo are never
imported during test collection — Motor pulls in the system cryptography package
which may conflict in some environments.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone
import logging

import sys
import os

# Ensure the backend package is importable when pytest is run from backend/
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# ---------------------------------------------------------------------------
# Stub app.config BEFORE any app modules are imported, so Motor/pymongo are
# never loaded during test collection.
# ---------------------------------------------------------------------------

_mock_db = MagicMock()

_mock_sio = MagicMock()

_config_stub = MagicMock()
_config_stub.db = _mock_db
_config_stub.sio = _mock_sio
_config_stub.logger = logging.getLogger("vibe_test")
_config_stub.GEOFENCE_RADIUS_METERS = 100
_config_stub.MAX_RATINGS_PER_VENUE_PER_DAY = 2
_config_stub.RATING_COOLDOWN_MINUTES = 5
_config_stub.SESSION_EXPIRY_DAYS = 7
_config_stub.VIBE_SCORE_WINDOW_HOURS = 1
_config_stub.PULSE_DROP_TIERS = {
    "spark":     {"price": 5000,  "radius_km": 2,  "glow_boost": 20,  "duration_hours": 2, "chart_placement": None},
    "flare":     {"price": 15000, "radius_km": 5,  "glow_boost": 40,  "duration_hours": 4, "chart_placement": 3},
    "supernova": {"price": 50000, "radius_km": 50, "glow_boost": 100, "duration_hours": 8, "chart_placement": 1},
}
_config_stub.CITIES = {
    "lagos": {"name": "Lagos", "code": "lagos", "center": {"lat": 6.4281, "lng": 3.4219}, "radius_km": 30},
}

sys.modules.setdefault("app.config", _config_stub)


# ---------------------------------------------------------------------------
# Mock MongoDB database
# ---------------------------------------------------------------------------

def make_mock_collection():
    """Return a MagicMock that looks like a Motor collection."""
    col = MagicMock()
    col.find_one = AsyncMock(return_value=None)
    col.find = MagicMock(return_value=MagicMock(
        to_list=AsyncMock(return_value=[])
    ))
    col.insert_one = AsyncMock(return_value=MagicMock(inserted_id="mock_id"))
    col.update_one = AsyncMock(return_value=MagicMock(modified_count=1))
    col.delete_one = AsyncMock(return_value=MagicMock(deleted_count=1))
    col.count_documents = AsyncMock(return_value=0)
    return col


@pytest.fixture
def mock_db():
    """
    Patch app.config.db with a mock that has common collections pre-wired.
    Yields the mock so individual tests can override return values.
    """
    db = MagicMock()
    db.ratings = make_mock_collection()
    db.users = make_mock_collection()
    db.venues = make_mock_collection()
    db.streaks = make_mock_collection()
    db.config = make_mock_collection()
    db.checkins = make_mock_collection()
    db.lobby = make_mock_collection()
    db.crews = make_mock_collection()

    with patch("app.config.db", db), \
         patch("app.services.vibe.db", db), \
         patch("app.services.streaks.db", db), \
         patch("app.services.economy.db", db):
        yield db


@pytest.fixture
def utc_now():
    """Return current UTC datetime (timezone-aware)."""
    return datetime.now(timezone.utc)


@pytest.fixture
def sample_user():
    return {
        "id": "user-abc-123",
        "username": "scout_tunde",
        "phone": "+2348000000001",
        "clout_points": 50,
        "total_ratings": 5,
        "scout_status": "newbie",
        "streak_freezes": 0,
        "is_admin": False,
        "is_merchant": False,
        "is_vibe_plus": False,
    }


@pytest.fixture
def sample_venue():
    return {
        "id": "venue-xyz-999",
        "name": "Club Quilox",
        "area": "Victoria Island",
        "city": "lagos",
        "venue_type": "club",
        "coordinates": {"lat": 6.4281, "lng": 3.4219},
        "current_vibe_score": 75.0,
        "geofence_radius_m": 100,
        "is_suppressed": False,
    }
