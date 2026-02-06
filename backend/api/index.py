"""
Vercel Serverless Function Entry Point
This is a simplified version of the API for Vercel deployment.
Socket.IO is removed as it's not compatible with serverless functions.
"""
from fastapi import FastAPI, APIRouter, HTTPException, Query, Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timedelta, timezone
import math
import httpx
import hmac
import hashlib

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'vibe_app')]

# Paystack Configuration
PAYSTACK_SECRET_KEY = os.environ.get('PAYSTACK_SECRET_KEY', '')
PAYSTACK_PUBLIC_KEY = os.environ.get('PAYSTACK_PUBLIC_KEY', '')

# Create the main FastAPI app
app = FastAPI(title="Vibe Scout API", version="3.0.0")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ========================
# PYDANTIC MODELS
# ========================

class Coordinates(BaseModel):
    lat: float
    lng: float

class CreateUserRequest(BaseModel):
    username: str
    phone: str
    home_city: str = "lagos"

class CreateRatingRequest(BaseModel):
    user_id: str
    venue_id: str
    energy: Literal["electric", "popping", "chill", "dead"]
    capacity: Literal["packed", "vibrant", "sparse", "empty"]
    gate: Literal["clear", "slow", "blocked"]
    coordinates: Coordinates
    photo_base64: Optional[str] = None

class UpdateVenueRequest(BaseModel):
    entry_fee: Optional[str] = None
    music_genre: Optional[str] = None
    tables_available: Optional[bool] = None
    live_look_url: Optional[str] = None

class PulseDropRequest(BaseModel):
    venue_id: str
    tier: Literal["spark", "flare", "supernova"]
    message: Optional[str] = None

# ========================
# HELPER FUNCTIONS
# ========================

def calculate_vibe_score(energy: str, capacity: str, gate: str) -> int:
    energy_scores = {"electric": 95, "popping": 75, "chill": 50, "dead": 20}
    capacity_scores = {"packed": 90, "vibrant": 70, "sparse": 45, "empty": 15}
    gate_scores = {"clear": 100, "slow": 60, "blocked": 30}
    
    score = (
        energy_scores.get(energy, 50) * 0.5 +
        capacity_scores.get(capacity, 50) * 0.3 +
        gate_scores.get(gate, 50) * 0.2
    )
    return int(score)

def get_energy_level(score: int) -> str:
    if score >= 80: return "electric"
    if score >= 60: return "popping"
    if score >= 40: return "chill"
    return "dead"

def calculate_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371000
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lng2 - lng1)
    
    a = math.sin(delta_phi/2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c

async def get_current_user(request: Request):
    user_id = request.headers.get("X-User-Id")
    if not user_id:
        return None
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    return user

def get_scout_tier_color(status: str) -> str:
    colors = {
        "elite": "#FFD700",
        "scout": "#C0C0C0",
        "regular": "#CD7F32",
        "newbie": "#94A3B8"
    }
    return colors.get(status, "#94A3B8")

# ========================
# HEALTH CHECK
# ========================

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat(), "platform": "vercel"}

# ========================
# USER ENDPOINTS
# ========================

@api_router.post("/users")
async def create_user(request: CreateUserRequest):
    user_id = str(uuid.uuid4())
    user = {
        "id": user_id,
        "username": request.username,
        "phone": request.phone,
        "home_city": request.home_city,
        "clout_points": 0,
        "scout_status": "newbie",
        "rating_accuracy_score": 100.0,
        "total_ratings": 0,
        "is_admin": False,
        "is_super_admin": False,
        "is_merchant": False,
        "auth_provider": "local",
        "created_at": datetime.now(timezone.utc)
    }
    await db.users.insert_one(user)
    user.pop("_id", None)
    return user

@api_router.get("/users/{user_id}")
async def get_user(user_id: str):
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

# ========================
# VENUE ENDPOINTS
# ========================

@api_router.get("/venues")
async def get_venues(city: Optional[str] = None):
    query = {}
    if city:
        query["city"] = city.lower()
    venues = await db.venues.find(query, {"_id": 0}).to_list(100)
    return venues

@api_router.get("/venues/{venue_id}")
async def get_venue(venue_id: str):
    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")
    return venue

@api_router.post("/venues/{venue_id}/direction-click")
async def record_direction_click(venue_id: str):
    await db.venues.update_one(
        {"id": venue_id},
        {"$inc": {"direction_clicks": 1}}
    )
    return {"success": True}

# ========================
# RATING ENDPOINTS
# ========================

@api_router.post("/ratings")
async def create_rating(request: CreateRatingRequest):
    # Validate user
    user = await db.users.find_one({"id": request.user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Validate venue
    venue = await db.venues.find_one({"id": request.venue_id}, {"_id": 0})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")
    
    # Check geofence (50m)
    distance = calculate_distance(
        request.coordinates.lat, request.coordinates.lng,
        venue["coordinates"]["lat"], venue["coordinates"]["lng"]
    )
    
    if distance > 50:
        raise HTTPException(status_code=400, detail="You must be within 50m of the venue to rate")
    
    # Calculate vibe score
    vibe_score = calculate_vibe_score(request.energy, request.capacity, request.gate)
    
    # Create rating
    rating_id = str(uuid.uuid4())
    rating = {
        "id": rating_id,
        "user_id": request.user_id,
        "venue_id": request.venue_id,
        "energy": request.energy,
        "capacity": request.capacity,
        "gate": request.gate,
        "vibe_score": vibe_score,
        "coordinates": request.coordinates.dict(),
        "photo_url": None,
        "timestamp": datetime.now(timezone.utc),
        "verified": True
    }
    
    await db.ratings.insert_one(rating)
    
    # Update venue score
    recent_ratings = await db.ratings.find(
        {"venue_id": request.venue_id},
        {"_id": 0, "vibe_score": 1}
    ).sort("timestamp", -1).limit(10).to_list(10)
    
    if recent_ratings:
        avg_score = sum(r["vibe_score"] for r in recent_ratings) / len(recent_ratings)
        energy_level = get_energy_level(int(avg_score))
        
        await db.venues.update_one(
            {"id": request.venue_id},
            {
                "$set": {
                    "current_vibe_score": int(avg_score),
                    "energy_level": energy_level,
                    "last_rating_at": datetime.now(timezone.utc)
                },
                "$inc": {"total_ratings_24h": 1}
            }
        )
    
    # Calculate clout earned
    base_clout = 10
    
    # Check if venue has active pulse drop (2x clout)
    now = datetime.now(timezone.utc)
    active_pulse = await db.pulse_drops.find_one({
        "venue_id": request.venue_id,
        "start_time": {"$lte": now},
        "end_time": {"$gte": now}
    })
    
    clout_multiplier = 2 if active_pulse else 1
    clout_earned = base_clout * clout_multiplier
    
    # Update user clout
    await db.users.update_one(
        {"id": request.user_id},
        {
            "$inc": {
                "clout_points": clout_earned,
                "total_ratings": 1
            }
        }
    )
    
    rating.pop("_id", None)
    return {
        "rating": rating,
        "clout_earned": clout_earned,
        "multiplier": clout_multiplier,
        "sponsored": bool(active_pulse)
    }

@api_router.get("/ratings/user/{user_id}/venue/{venue_id}")
async def get_user_rating_status(user_id: str, venue_id: str):
    hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
    
    recent_rating = await db.ratings.find_one({
        "user_id": user_id,
        "venue_id": venue_id,
        "timestamp": {"$gte": hour_ago}
    })
    
    total_ratings = await db.ratings.count_documents({
        "user_id": user_id,
        "venue_id": venue_id
    })
    
    return {
        "can_rate": recent_rating is None,
        "ratings_count": total_ratings,
        "cooldown_remaining": 0 if recent_rating is None else 60
    }

# ========================
# TRENDING ENDPOINTS
# ========================

@api_router.get("/trending/{city}")
async def get_trending(city: str, limit: int = 20):
    now = datetime.now(timezone.utc)
    
    # Get venues with active pulse drops (sponsored)
    sponsored_venues = []
    pulse_drops = await db.pulse_drops.find({
        "end_time": {"$gte": now},
        "start_time": {"$lte": now}
    }, {"_id": 0}).to_list(50)
    
    sponsored_venue_ids = [p["venue_id"] for p in pulse_drops]
    
    if sponsored_venue_ids:
        sponsored = await db.venues.find(
            {"id": {"$in": sponsored_venue_ids}, "city": city.lower()},
            {"_id": 0}
        ).sort("current_vibe_score", -1).to_list(10)
        
        for venue in sponsored:
            pulse = next((p for p in pulse_drops if p["venue_id"] == venue["id"]), None)
            venue["is_sponsored"] = True
            venue["pulse_tier"] = pulse["tier"] if pulse else None
            sponsored_venues.append(venue)
    
    # Get organic trending (exclude sponsored)
    organic_venues = await db.venues.find(
        {"city": city.lower(), "id": {"$nin": sponsored_venue_ids}},
        {"_id": 0}
    ).sort("current_vibe_score", -1).limit(limit).to_list(limit)
    
    for venue in organic_venues:
        venue["is_sponsored"] = False
    
    return {
        "sponsored": sponsored_venues,
        "organic": organic_venues
    }

@api_router.get("/top-scouts/{city}")
async def get_top_scouts(city: str, limit: int = 10):
    scouts = await db.users.find(
        {"home_city": city.lower()},
        {"_id": 0, "id": 1, "username": 1, "clout_points": 1, "scout_status": 1, "total_ratings": 1}
    ).sort("clout_points", -1).limit(limit).to_list(limit)
    
    result = []
    for i, scout in enumerate(scouts):
        result.append({
            "rank": i + 1,
            "id": scout["id"],
            "username": scout.get("username", "Anonymous"),
            "clout_points": scout.get("clout_points", 0),
            "scout_status": scout.get("scout_status", "newbie"),
            "total_ratings": scout.get("total_ratings", 0),
            "tier_color": get_scout_tier_color(scout.get("scout_status", "newbie"))
        })
    
    return result

# ========================
# CITIES ENDPOINT
# ========================

@api_router.get("/cities")
async def get_cities():
    return [
        {"name": "Lagos", "code": "lagos", "center": {"lat": 6.5244, "lng": 3.3792}, "radius_km": 50},
        {"name": "Abuja", "code": "abuja", "center": {"lat": 9.0579, "lng": 7.4951}, "radius_km": 40},
        {"name": "Port Harcourt", "code": "port_harcourt", "center": {"lat": 4.8156, "lng": 7.0498}, "radius_km": 30},
        {"name": "Ibadan", "code": "ibadan", "center": {"lat": 7.3775, "lng": 3.9470}, "radius_km": 35}
    ]

# ========================
# ADMIN ENDPOINTS
# ========================

@api_router.get("/admin/treasury")
async def get_admin_treasury(request: Request):
    user = await get_current_user(request)
    if not user or not user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Total revenue
    total_revenue = await db.platform_revenue.aggregate([
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    total = total_revenue[0]["total"] if total_revenue else 0
    
    # Today's revenue
    today_revenue = await db.platform_revenue.aggregate([
        {"$match": {"timestamp": {"$gte": today_start}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    today = today_revenue[0]["total"] if today_revenue else 0
    
    # Revenue by tier
    tier_revenue = await db.pulse_drops.aggregate([
        {"$group": {
            "_id": "$tier",
            "total": {"$sum": "$amount"},
            "count": {"$sum": 1}
        }}
    ]).to_list(10)
    
    revenue_by_tier = {}
    for t in tier_revenue:
        revenue_by_tier[t["_id"]] = {"total": t["total"], "transactions": t["count"]}
    
    # Network health
    total_venues = await db.venues.count_documents({})
    total_users = await db.users.count_documents({})
    verified_venues = await db.venues.count_documents({"is_verified": True})
    
    day_ago = now - timedelta(days=1)
    active_user_ids = await db.ratings.distinct("user_id", {"timestamp": {"$gte": day_ago}})
    
    return {
        "global": {"total_revenue": total, "today_revenue": today},
        "revenue_by_tier": revenue_by_tier,
        "network_health": {
            "active_connections": len(active_user_ids),
            "total_venues": total_venues,
            "total_users": total_users,
            "active_users_24h": len(active_user_ids),
            "verified_venues": verified_venues
        },
        "data_freshness_percent": 100
    }

@api_router.get("/admin/integrity-monitor")
async def get_integrity_monitor(request: Request):
    user = await get_current_user(request)
    if not user or not user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    now = datetime.now(timezone.utc)
    
    # Get sponsored venues
    active_pulses = await db.pulse_drops.find({
        "end_time": {"$gte": now},
        "start_time": {"$lte": now}
    }, {"_id": 0, "venue_id": 1}).to_list(100)
    
    sponsored_ids = [p["venue_id"] for p in active_pulses]
    
    sponsored_venues = await db.venues.find(
        {"id": {"$in": sponsored_ids}},
        {"_id": 0, "id": 1, "name": 1, "current_vibe_score": 1}
    ).to_list(100)
    
    organic_venues = await db.venues.find(
        {"id": {"$nin": sponsored_ids}},
        {"_id": 0, "current_vibe_score": 1}
    ).to_list(500)
    
    # Calculate averages
    sponsored_avg = sum(v.get("current_vibe_score", 0) for v in sponsored_venues) / len(sponsored_venues) if sponsored_venues else 0
    organic_avg = sum(v.get("current_vibe_score", 0) for v in organic_venues) / len(organic_venues) if organic_venues else 0
    
    return {
        "sponsored": {
            "count": len(sponsored_venues),
            "average_energy": round(sponsored_avg, 1),
            "venues": sponsored_venues[:5],
            "distribution": {"electric": 0, "popping": 0, "moderate": 0, "quiet": 0}
        },
        "organic": {
            "count": len(organic_venues),
            "average_energy": round(organic_avg, 1),
            "distribution": {"electric": 0, "popping": 0, "moderate": 0, "quiet": 0}
        },
        "delta": round(sponsored_avg - organic_avg, 1),
        "integrity_warnings": [],
        "health_status": "healthy"
    }

@api_router.get("/admin/clout-economy")
async def get_clout_economy(request: Request):
    user = await get_current_user(request)
    if not user or not user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    # Total clout
    clout_stats = await db.users.aggregate([
        {"$group": {
            "_id": None,
            "total_clout": {"$sum": "$clout_points"},
            "total_users": {"$sum": 1}
        }}
    ]).to_list(1)
    
    total_clout = clout_stats[0]["total_clout"] if clout_stats else 0
    total_users = clout_stats[0]["total_users"] if clout_stats else 0
    avg_clout = round(total_clout / total_users) if total_users > 0 else 0
    
    # Top scouts
    top_scouts = await db.users.find(
        {},
        {"_id": 0, "id": 1, "username": 1, "clout_points": 1, "scout_status": 1, "total_ratings": 1}
    ).sort("clout_points", -1).limit(10).to_list(10)
    
    scouts_list = []
    for i, scout in enumerate(top_scouts):
        scouts_list.append({
            "rank": i + 1,
            "id": scout["id"],
            "username": scout.get("username", "Anonymous"),
            "clout_points": scout.get("clout_points", 0),
            "scout_status": scout.get("scout_status", "newbie"),
            "total_ratings": scout.get("total_ratings", 0),
            "tier_color": get_scout_tier_color(scout.get("scout_status", "newbie"))
        })
    
    return {
        "total_clout_circulation": total_clout,
        "total_users": total_users,
        "average_clout": avg_clout,
        "top_scouts": scouts_list
    }

@api_router.get("/admin/user-analytics")
async def get_user_analytics(request: Request):
    user = await get_current_user(request)
    if not user or not user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    now = datetime.now(timezone.utc)
    day_ago = now - timedelta(days=1)
    week_ago = now - timedelta(days=7)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    total_users = await db.users.count_documents({})
    
    active_user_ids_24h = await db.ratings.distinct("user_id", {"timestamp": {"$gte": day_ago}})
    active_users_24h = len(active_user_ids_24h)
    
    active_user_ids_7d = await db.ratings.distinct("user_id", {"timestamp": {"$gte": week_ago}})
    active_users_7d = len(active_user_ids_7d)
    
    ghost_users = await db.users.count_documents({"total_ratings": {"$lte": 0}})
    ghost_percentage = round((ghost_users / total_users * 100) if total_users > 0 else 0, 1)
    
    new_users_today = await db.users.count_documents({"created_at": {"$gte": today_start}})
    
    tier_pipeline = [
        {"$group": {"_id": "$scout_status", "count": {"$sum": 1}}}
    ]
    tier_stats = await db.users.aggregate(tier_pipeline).to_list(10)
    tier_distribution = {"elite": 0, "scout": 0, "regular": 0, "newbie": 0}
    for stat in tier_stats:
        if stat["_id"] in tier_distribution:
            tier_distribution[stat["_id"]] = stat["count"]
    
    return {
        "total_users": total_users,
        "active_users_24h": active_users_24h,
        "active_users_7d": active_users_7d,
        "ghost_users": ghost_users,
        "ghost_percentage": ghost_percentage,
        "new_users_today": new_users_today,
        "tier_distribution": tier_distribution
    }

@api_router.get("/admin/pulse-ledger")
async def get_pulse_ledger(request: Request):
    user = await get_current_user(request)
    if not user or not user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    drops = await db.pulse_drops.find({}, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
    
    ledger = []
    for drop in drops:
        venue = await db.venues.find_one({"id": drop["venue_id"]}, {"_id": 0, "name": 1, "area": 1, "current_vibe_score": 1})
        if venue:
            ledger.append({
                "drop_id": drop.get("id", str(uuid.uuid4())),
                "venue_name": venue.get("name", "Unknown"),
                "venue_area": venue.get("area", "Unknown"),
                "current_vibe_score": venue.get("current_vibe_score", 0),
                "tier": drop.get("tier", "spark"),
                "amount": drop.get("amount", 0),
                "created_at": drop.get("created_at", datetime.now(timezone.utc)).isoformat() if isinstance(drop.get("created_at"), datetime) else str(drop.get("created_at", "")),
                "scout_activity": "MODERATE",
                "ratings_count": 0,
                "profile_views_gained": 0,
                "direction_clicks_gained": 0
            })
    
    return {"ledger": ledger}

@api_router.post("/admin/clout-airdrop")
async def clout_airdrop(request: Request):
    user = await get_current_user(request)
    if not user or not user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    body = await request.json()
    user_ids = body.get("user_ids", [])
    amount = body.get("amount", 0)
    reason = body.get("reason", "Admin bonus")
    
    if not user_ids or amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid airdrop parameters")
    
    now = datetime.now(timezone.utc)
    
    result = await db.users.update_many(
        {"id": {"$in": user_ids}},
        {"$inc": {"clout_points": amount}}
    )
    
    await db.clout_airdrops.insert_one({
        "id": str(uuid.uuid4()),
        "user_ids": user_ids,
        "amount": amount,
        "reason": reason,
        "admin_id": user["id"],
        "timestamp": now,
        "users_updated": result.modified_count
    })
    
    return {
        "success": True,
        "message": f"Airdropped {amount} clout to {result.modified_count} users",
        "users_updated": result.modified_count
    }

# ========================
# SEED DATA ENDPOINT
# ========================

@api_router.post("/seed")
async def seed_data():
    """Seed the database with test data"""
    
    # Check if already seeded
    existing_venues = await db.venues.count_documents({})
    if existing_venues > 0:
        return {"message": "Database already seeded", "venues_created": 0}
    
    # Create test venues
    venues = [
        {
            "id": str(uuid.uuid4()),
            "name": "Quilox Nightclub",
            "address": "28 Ozumba Mbadiwe Ave",
            "area": "Victoria Island",
            "city": "lagos",
            "venue_type": "club",
            "coordinates": {"lat": 6.4281, "lng": 3.4219},
            "current_vibe_score": 85,
            "energy_level": "electric",
            "capacity_level": "vibrant",
            "gate_level": "slow",
            "vibe_velocity": "heating_up",
            "total_ratings_24h": 45,
            "is_featured": True,
            "is_verified": True,
            "profile_views": 1250,
            "direction_clicks": 340,
            "entry_fee": "₦10,000",
            "music_genre": "Afrobeats/Hip-Hop",
            "tables_available": True
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Hard Rock Cafe",
            "address": "Plot 1 Water Corporation Dr",
            "area": "Victoria Island",
            "city": "lagos",
            "venue_type": "bar",
            "coordinates": {"lat": 6.4301, "lng": 3.4245},
            "current_vibe_score": 72,
            "energy_level": "popping",
            "capacity_level": "vibrant",
            "gate_level": "clear",
            "vibe_velocity": "stable",
            "total_ratings_24h": 28,
            "is_featured": False,
            "is_verified": True,
            "profile_views": 890,
            "direction_clicks": 210,
            "entry_fee": "Free Entry",
            "music_genre": "Rock/Pop",
            "tables_available": True
        }
    ]
    
    for venue in venues:
        await db.venues.insert_one(venue)
    
    # Create super admin user
    admin_id = str(uuid.uuid4())
    admin_user = {
        "id": admin_id,
        "username": "superadmin",
        "phone": "+2341234567890",
        "home_city": "lagos",
        "clout_points": 1000,
        "scout_status": "elite",
        "rating_accuracy_score": 100.0,
        "total_ratings": 50,
        "is_admin": True,
        "is_super_admin": True,
        "is_merchant": False,
        "auth_provider": "local",
        "created_at": datetime.now(timezone.utc)
    }
    await db.users.insert_one(admin_user)
    
    # Create test user
    test_user_id = str(uuid.uuid4())
    test_user = {
        "id": test_user_id,
        "username": "testuser",
        "phone": "+2349876543210",
        "home_city": "lagos",
        "clout_points": 150,
        "scout_status": "regular",
        "rating_accuracy_score": 85.0,
        "total_ratings": 15,
        "is_admin": False,
        "is_super_admin": False,
        "is_merchant": False,
        "auth_provider": "local",
        "created_at": datetime.now(timezone.utc)
    }
    await db.users.insert_one(test_user)
    
    return {
        "message": "Data seeded successfully",
        "venues_created": len(venues),
        "admin_user_id": admin_id,
        "test_user_id": test_user_id,
        "cities": ["lagos", "abuja", "port_harcourt", "ibadan"]
    }

# Include the router
app.include_router(api_router)

# Export for Vercel
handler = app
