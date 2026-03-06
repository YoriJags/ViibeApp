"""
Viibe App API - Main Entry Point
Assembles FastAPI app from modular route, service, and config modules.
"""
import os
from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware
import socketio

from app.config import sio, logger, ensure_indexes
from app.middleware.rate_limit import RateLimitMiddleware

# Import realtime handlers to register Socket.IO events
import app.services.realtime  # noqa: F401

# Import all route modules
from app.routes.dashboard import router as dashboard_router
from app.routes.auth import router as auth_router
from app.routes.users import router as users_router
from app.routes.venues import router as venues_router
from app.routes.ratings import router as ratings_router
from app.routes.leaderboard import router as leaderboard_router
from app.routes.merchant import router as merchant_router
from app.routes.pulse_drops import router as pulse_drops_router
from app.routes.admin import router as admin_router
from app.routes.webhooks import router as webhooks_router
from app.routes.seed import router as seed_router
from app.routes.lobby import router as lobby_router
from app.routes.checkins import router as checkins_router
from app.routes.streaks import router as streaks_router
from app.routes.stories import router as stories_router
from app.routes.timeline import router as timeline_router
from app.routes.crews import router as crews_router
from app.routes.alerts import router as alerts_router
from app.routes.vibe_intel import router as vibe_intel_router
from app.routes.forecast import router as forecast_router
from app.routes.campaigns import router as campaigns_router
from app.routes.certifications import router as certifications_router
from app.routes.planner import router as planner_router
from app.routes.oracle import router as oracle_router
from app.routes.ai_features import router as ai_features_router
from app.routes.feature_flags import router as feature_flags_router
from app.routes.platform_settings import router as platform_settings_router
from app.routes.subscriptions import router as subscriptions_router
from app.routes.reactions import router as reactions_router
from app.routes.city_pulse import router as city_pulse_router
from app.routes.venue_live import router as venue_live_router
from app.routes.coins import router as coins_router
from app.routes.reward_pools import router as reward_pools_router
from app.routes.momentum import router as momentum_router
from app.routes.intelligence import router as intelligence_router
from app.routes.claims import router as claims_router
from app.routes.bookings import router as bookings_router
from app.routes.surge import router as surge_router
from app.routes.aura import router as aura_router

# ===== Create FastAPI App =====
app = FastAPI(title="Viibe App API", version="3.0.0")

# ===== Create API Router with /api prefix =====
api_router = APIRouter(prefix="/api")

# Register all route modules
api_router.include_router(dashboard_router)
api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(venues_router)
api_router.include_router(ratings_router)
api_router.include_router(leaderboard_router)
api_router.include_router(merchant_router)
api_router.include_router(pulse_drops_router)
api_router.include_router(admin_router)
api_router.include_router(webhooks_router)
# Seed routes only in development
if os.environ.get("ENVIRONMENT", "development") != "production":
    api_router.include_router(seed_router)
api_router.include_router(lobby_router)
api_router.include_router(checkins_router)
api_router.include_router(streaks_router)
api_router.include_router(stories_router)
api_router.include_router(timeline_router)
api_router.include_router(crews_router)
api_router.include_router(alerts_router)
api_router.include_router(vibe_intel_router)
api_router.include_router(forecast_router)
api_router.include_router(campaigns_router)
api_router.include_router(certifications_router)
api_router.include_router(planner_router)
api_router.include_router(oracle_router)
api_router.include_router(ai_features_router)
api_router.include_router(feature_flags_router)
api_router.include_router(platform_settings_router)
api_router.include_router(subscriptions_router)
api_router.include_router(reactions_router)
api_router.include_router(city_pulse_router)
api_router.include_router(venue_live_router)
api_router.include_router(coins_router)
api_router.include_router(reward_pools_router)
api_router.include_router(momentum_router)
api_router.include_router(intelligence_router)
api_router.include_router(claims_router)
api_router.include_router(bookings_router)
api_router.include_router(surge_router)
api_router.include_router(aura_router)

# Include the API router in the main app
app.include_router(api_router)

# ===== Middleware =====
app.add_middleware(RateLimitMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===== Startup Events =====
@app.on_event("startup")
async def startup():
    await ensure_indexes()
    logger.info("Viibe App API started - indexes ensured")

# ===== Socket.IO ASGI App =====
socket_app = socketio.ASGIApp(sio, app)

logger.info("Viibe App API initialized - modular architecture loaded")
