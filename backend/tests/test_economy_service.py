"""
Unit tests for app.services.economy.

Tests the cache logic, DB fallback, and cache invalidation without
requiring a real MongoDB connection.
"""
import pytest
from unittest.mock import AsyncMock, patch
from datetime import datetime, timezone, timedelta

import app.services.economy as economy_module
from app.services.economy import (
    get_economy_config,
    invalidate_economy_cache,
    DEFAULT_ECONOMY_CONFIG,
)

pytestmark = pytest.mark.unit


@pytest.fixture(autouse=True)
def reset_cache():
    """Ensure the module-level cache is cleared before every test."""
    invalidate_economy_cache()
    yield
    invalidate_economy_cache()


class TestGetEconomyConfig:
    @pytest.mark.asyncio
    async def test_returns_db_config_when_available(self, mock_db):
        custom_config = {"pulse_drops": {"spark": {"price": 9999}}}
        mock_db.config.find_one = AsyncMock(return_value={"key": "economy_config", "value": custom_config})

        result = await get_economy_config()

        assert result == custom_config

    @pytest.mark.asyncio
    async def test_falls_back_to_defaults_when_db_returns_none(self, mock_db):
        mock_db.config.find_one = AsyncMock(return_value=None)

        result = await get_economy_config()

        assert result == DEFAULT_ECONOMY_CONFIG

    @pytest.mark.asyncio
    async def test_falls_back_to_defaults_on_db_exception(self, mock_db):
        mock_db.config.find_one = AsyncMock(side_effect=Exception("DB unavailable"))

        result = await get_economy_config()

        assert result == DEFAULT_ECONOMY_CONFIG

    @pytest.mark.asyncio
    async def test_caches_result_and_skips_second_db_call(self, mock_db):
        custom_config = {"pulse_drops": {}}
        mock_db.config.find_one = AsyncMock(return_value={"key": "economy_config", "value": custom_config})

        await get_economy_config()
        await get_economy_config()

        # DB should only be hit once; second call should use cache
        assert mock_db.config.find_one.call_count == 1

    @pytest.mark.asyncio
    async def test_cache_invalidation_forces_fresh_db_read(self, mock_db):
        custom_config = {"pulse_drops": {}}
        mock_db.config.find_one = AsyncMock(return_value={"key": "economy_config", "value": custom_config})

        await get_economy_config()
        invalidate_economy_cache()
        await get_economy_config()

        assert mock_db.config.find_one.call_count == 2

    @pytest.mark.asyncio
    async def test_stale_cache_refetches_after_ttl(self, mock_db):
        custom_config = {"wallet": {"min_topup": 500}}
        mock_db.config.find_one = AsyncMock(return_value={"key": "economy_config", "value": custom_config})

        # Seed cache with a timestamp 6 minutes in the past (> 5 min TTL)
        economy_module._cache = custom_config
        economy_module._cache_at = datetime.now(timezone.utc) - timedelta(minutes=6)

        await get_economy_config()

        assert mock_db.config.find_one.call_count == 1  # refetched


class TestInvalidateEconomyCache:
    def test_clears_cache_and_timestamp(self):
        economy_module._cache = {"some": "data"}
        economy_module._cache_at = datetime.now(timezone.utc)

        invalidate_economy_cache()

        assert economy_module._cache is None
        assert economy_module._cache_at is None


class TestDefaultEconomyConfig:
    def test_default_has_expected_pulse_drop_tiers(self):
        tiers = DEFAULT_ECONOMY_CONFIG["pulse_drops"]
        assert set(tiers.keys()) == {"spark", "flare", "supernova"}

    def test_spark_is_cheapest(self):
        tiers = DEFAULT_ECONOMY_CONFIG["pulse_drops"]
        assert tiers["spark"]["price"] < tiers["flare"]["price"] < tiers["supernova"]["price"]

    def test_supernova_has_widest_radius(self):
        tiers = DEFAULT_ECONOMY_CONFIG["pulse_drops"]
        assert tiers["supernova"]["radius_km"] > tiers["flare"]["radius_km"] > tiers["spark"]["radius_km"]

    def test_wallet_has_min_topup(self):
        assert DEFAULT_ECONOMY_CONFIG["wallet"]["min_topup"] > 0

    def test_clout_rating_base_is_positive(self):
        assert DEFAULT_ECONOMY_CONFIG["clout"]["rating_base"] > 0
