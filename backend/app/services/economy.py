"""
Vibe App - Economy Config Service

Provides a cached read of the live economy config from MongoDB.
Falls back to defaults if DB is unavailable. Cache TTL: 5 minutes.
Call invalidate_economy_cache() immediately after admin updates the config.
"""
from datetime import datetime, timezone
from app.config import db, logger

_cache: dict | None = None
_cache_at: datetime | None = None
_CACHE_TTL_SECONDS = 300  # 5 minutes

DEFAULT_ECONOMY_CONFIG = {
    "pulse_drops": {
        "spark":     {"name": "Spark",     "price": 5000,  "duration_hours": 2, "radius_km": 2,  "glow_boost": 20,  "chart_placement": None, "description": "2km radius push + 20% glow increase"},
        "flare":     {"name": "Flare",     "price": 15000, "duration_hours": 4, "radius_km": 5,  "glow_boost": 40,  "chart_placement": 3,    "description": "5km radius push + Top 3 chart placement"},
        "supernova": {"name": "Supernova", "price": 50000, "duration_hours": 8, "radius_km": 50, "glow_boost": 100, "chart_placement": 1,    "description": "City-wide push + #1 Trending + Custom Map Icon"},
    },
    "campaigns": {
        "2x_2h": 3000, "2x_4h": 5000, "2x_8h": 8000,
        "3x_2h": 7000, "3x_4h": 12000, "3x_8h": 20000,
    },
    "wallet": {
        "min_topup": 1000,
        "platform_fee_percent": 10,
    },
    "clout": {
        "rating_base": 10,
        "checkin": 2,
        "pulse_drop": 3,
        "cooldown_skip_cost": 50,
    },
    "streaks": {
        "milestone_3d": 5,
        "milestone_7d": 15,
        "milestone_14d": 30,
        "milestone_30d": 50,
    },
}


async def get_economy_config() -> dict:
    """Return live economy config with 5-min in-memory cache."""
    global _cache, _cache_at
    now = datetime.now(timezone.utc)

    if _cache and _cache_at and (now - _cache_at).total_seconds() < _CACHE_TTL_SECONDS:
        return _cache

    try:
        doc = await db.config.find_one({"key": "economy_config"})
        if doc and doc.get("value"):
            _cache = doc["value"]
            _cache_at = now
            return _cache
    except Exception as e:
        logger.warning(f"Economy config DB read failed, using defaults: {e}")

    return DEFAULT_ECONOMY_CONFIG


def invalidate_economy_cache():
    """Bust the in-memory cache so the next request reads fresh values from DB."""
    global _cache, _cache_at
    _cache = None
    _cache_at = None
