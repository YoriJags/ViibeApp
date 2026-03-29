"""
Vibe App - Configuration & Database Connection
Centralizes all environment variables, constants, and database setup.
"""
import os
import logging
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import socketio

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

# ===== Runtime environment =====
ENVIRONMENT = os.environ.get("ENVIRONMENT", "development")

# ===== Database =====
MONGO_URL = os.environ.get('MONGO_URL', '')
DB_NAME = os.environ.get('DB_NAME', 'vibe_app')

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# ===== Paystack =====
PAYSTACK_SECRET_KEY = os.environ.get('PAYSTACK_SECRET_KEY', '')
PAYSTACK_PUBLIC_KEY = os.environ.get('PAYSTACK_PUBLIC_KEY', '')

# ===== CORS =====
# Comma-separated list of allowed origins.
# Production: set ALLOWED_ORIGINS=https://viibez.com,https://app.viibez.com
# Development: defaults to common local dev ports.
_raw_origins = os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:8081,http://localhost:19006",
)
ALLOWED_ORIGINS: list[str] = [o.strip() for o in _raw_origins.split(",") if o.strip()]

# ===== Socket.IO =====
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins=ALLOWED_ORIGINS,
    logger=False,
    engineio_logger=False,
)

# ===== Logging =====
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('vibe_app')

# ===== Constants =====
GEOFENCE_RADIUS_METERS = 100  # Default fallback; venues override via geofence_radius_m
MAX_RATINGS_PER_VENUE_PER_DAY = 2
RATING_COOLDOWN_MINUTES = 5       # Scouts can re-rate same venue every 5 minutes
SESSION_EXPIRY_DAYS = 7
VIBE_SCORE_WINDOW_HOURS = 1

PULSE_DROP_TIERS = {
    "spark": {
        "name": "Spark",
        "price": 5000,
        "radius_km": 2,
        "glow_boost": 20,
        "chart_placement": None,
        "duration_hours": 2,
        "description": "2km radius push + 20% glow increase",
    },
    "flare": {
        "name": "Flare",
        "price": 15000,
        "radius_km": 5,
        "glow_boost": 40,
        "chart_placement": 3,
        "duration_hours": 4,
        "description": "5km radius push + Top 3 chart placement",
    },
    "supernova": {
        "name": "Supernova",
        "price": 50000,
        "radius_km": 50,
        "glow_boost": 100,
        "chart_placement": 1,
        "duration_hours": 8,
        "custom_icon": True,
        "description": "City-wide push + #1 Trending + Custom Map Icon",
    },
}

async def ensure_indexes():
    """Create MongoDB indexes for optimal query performance."""
    # ratings: most queried collection - time-windowed lookups per user/venue
    await db.ratings.create_index([("user_id", 1), ("venue_id", 1), ("timestamp", -1)])
    await db.ratings.create_index([("venue_id", 1), ("timestamp", -1)])
    await db.ratings.create_index([("timestamp", -1), ("superseded", 1)])
    # taxonomy_id: sparse index for future multi-market queries (null = default Lagos template)
    await db.ratings.create_index("taxonomy_id", sparse=True)

    # venues: city+score for leaderboard, city+area for district ranking
    await db.venues.create_index([("city", 1), ("current_vibe_score", -1)])
    await db.venues.create_index([("city", 1), ("area", 1)])
    await db.venues.create_index("id", unique=True)

    # users: login/signup lookups + leaderboard sorting
    await db.users.create_index("id", unique=True)
    await db.users.create_index("phone", unique=True)
    await db.users.create_index("username", unique=True)
    await db.users.create_index([("clout_points", -1)])

    # user_sessions: auth lookups on every request
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)

    # pulse_drops: venue history + admin ledger
    await db.pulse_drops.create_index([("venue_id", 1), ("created_at", -1)])
    await db.pulse_drops.create_index([("created_at", -1)])

    # merchant_wallets + transactions
    await db.merchant_wallets.create_index("venue_id", unique=True)
    await db.wallet_transactions.create_index([("wallet_id", 1), ("timestamp", -1)])

    # platform_revenue: time-range analytics
    await db.platform_revenue.create_index([("timestamp", -1)])
    await db.platform_revenue.create_index("city")
    await db.platform_revenue.create_index("tier")

    # pending_topups: payment reference lookup + idempotency
    await db.pending_topups.create_index("reference", unique=True)
    await db.pending_topups.create_index("idempotency_key", sparse=True)

    # pending_subscriptions: Vibe+ payment reference + user lookup
    await db.pending_subscriptions.create_index("reference", unique=True)
    await db.pending_subscriptions.create_index("user_id")

    # lobby: user shortlist lookups
    await db.lobby.create_index([("user_id", 1), ("venue_id", 1)], unique=True)
    await db.lobby.create_index([("user_id", 1), ("added_at", -1)])

    # config: key lookups
    await db.config.create_index("key", unique=True)

    # ghost check-ins: TTL auto-expiry + venue/user lookups
    await db.checkins.create_index("expires_at", expireAfterSeconds=0)
    await db.checkins.create_index([("venue_id", 1), ("status", 1)])
    await db.checkins.create_index([("user_id", 1), ("status", 1)])

    # vibe streaks: per-user unique + leaderboard
    await db.streaks.create_index("user_id", unique=True)
    await db.streaks.create_index([("current_streak", -1)])

    # venue stories: TTL auto-expiry + venue/user lookups
    await db.stories.create_index("expires_at", expireAfterSeconds=0)
    await db.stories.create_index([("venue_id", 1), ("created_at", -1)])
    await db.stories.create_index([("user_id", 1), ("created_at", -1)])

    # vibe snapshots: permanent audit-grade records — no TTL
    # Snapshots carry full score provenance (sample_size, confidence_band, signal_weights)
    # and must be retained indefinitely for data licensing due diligence.
    # MIGRATION: if upgrading from the 72h TTL version, drop the old index:
    #   db.vibe_snapshots.drop_index("timestamp_1")
    await db.vibe_snapshots.create_index([("venue_id", 1), ("timestamp", -1)])
    await db.vibe_snapshots.create_index([("timestamp", -1)])

    # crews: invite code lookup + member lookup
    await db.crews.create_index("invite_code", unique=True)
    await db.crews.create_index("members")
    await db.crew_votes.create_index([("crew_id", 1), ("status", 1)])

    # alert preferences: per-user unique
    await db.alert_preferences.create_index("user_id", unique=True)

    # aura shields: per-venue unique
    await db.aura_shields.create_index("venue_id", unique=True)

    # campaigns: venue+status, city+status+expiry, TTL auto-cleanup
    # Partial unique index prevents two active campaigns per venue (race condition fix)
    await db.campaigns.create_index(
        [("venue_id", 1)],
        unique=True,
        partialFilterExpression={"status": "active"},
        name="unique_active_campaign_per_venue",
    )
    await db.campaigns.create_index([("city", 1), ("status", 1), ("expires_at", 1)])
    await db.campaigns.create_index("expires_at", expireAfterSeconds=0)

    # certifications: certified venues sorted by score
    await db.venues.create_index([("vibe_certified", 1), ("current_vibe_score", -1)])

    # rolling deep sessions: TTL 2h, one session per crew
    await db.rolling_deep_sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.rolling_deep_sessions.create_index("crew_id", unique=True)

    # emoji pulse: TTL 2h, query by venue + time window
    await db.venue_emoji_pulses.create_index("expires_at", expireAfterSeconds=0)
    await db.venue_emoji_pulses.create_index([("venue_id", 1), ("ts", -1)])
    await db.venue_emoji_pulses.create_index(
        [("venue_id", 1), ("user_id", 1)], unique=True
    )

    # api_keys: external partner key lookups (public read API)
    # key_hash: hashed key for secure lookups (key field retained for migration)
    await db.api_keys.create_index("key", unique=True, sparse=True)
    await db.api_keys.create_index("key_hash", unique=True, sparse=True)
    await db.api_keys.create_index([("active", 1)])

    # agent_api_keys: key_hash for secure lookups
    await db.agent_api_keys.create_index("key_hash", unique=True, sparse=True)
    await db.agent_api_keys.create_index([("active", 1)])

    # phone_otps: OTP verification — TTL auto-expiry + unique per phone
    await db.phone_otps.create_index("phone", unique=True)
    await db.phone_otps.create_index("expires_at", expireAfterSeconds=0)

    # NDPR compliance collections
    await db.consent_records.create_index("user_id", unique=True)
    await db.consent_audit_log.create_index([("user_id", 1), ("timestamp", -1)])
    await db.deletion_requests.create_index([("user_id", 1), ("status", 1)])
    await db.deletion_requests.create_index([("status", 1), ("deletion_due_by", 1)])

    logger.info("MongoDB indexes ensured")


CITIES = {
    "lagos": {
        "name": "Lagos",
        "code": "lagos",
        "center": {"lat": 6.4281, "lng": 3.4219},
        "radius_km": 30,
        "vibe_weights": {"club": 1.2, "lounge": 0.9, "restaurant": 0.8},
    },
    "abuja": {
        "name": "Abuja",
        "code": "abuja",
        "center": {"lat": 9.0579, "lng": 7.4951},
        "radius_km": 25,
        "vibe_weights": {"club": 0.9, "lounge": 1.3, "restaurant": 1.0},
    },
    "port_harcourt": {
        "name": "Port Harcourt",
        "code": "port_harcourt",
        "center": {"lat": 4.8156, "lng": 7.0498},
        "radius_km": 20,
        "vibe_weights": {"club": 1.1, "lounge": 1.0, "restaurant": 0.9},
    },
    "ibadan": {
        "name": "Ibadan",
        "code": "ibadan",
        "center": {"lat": 7.3775, "lng": 3.9470},
        "radius_km": 20,
        "vibe_weights": {"club": 0.8, "lounge": 1.1, "restaurant": 1.2},
    },
}
