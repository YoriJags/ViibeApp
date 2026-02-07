"""
Vercel Serverless Function Entry Point
This is a simplified version of the API for Vercel deployment.
"""
from fastapi import FastAPI, APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Literal
import os
import logging
import uuid
from datetime import datetime, timedelta, timezone
import math

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create the main FastAPI app
app = FastAPI(title="Vibe Scout API", version="3.0.0")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB connection - lazy loading to handle cold starts
db = None

def get_db():
    global db
    if db is None:
        try:
            from motor.motor_asyncio import AsyncIOMotorClient
            mongo_url = os.environ.get('MONGO_URL')
            if not mongo_url:
                logger.error("MONGO_URL environment variable not set")
                return None
            client = AsyncIOMotorClient(mongo_url)
            db_name = os.environ.get('DB_NAME', 'vibe_app')
            db = client[db_name]
            logger.info(f"Connected to MongoDB database: {db_name}")
        except Exception as e:
            logger.error(f"Failed to connect to MongoDB: {e}")
            return None
    return db

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
    database = get_db()
    if not database:
        return None
    user_id = request.headers.get("X-User-Id")
    if not user_id:
        return None
    user = await database.users.find_one({"id": user_id}, {"_id": 0})
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
    database = get_db()
    db_status = "connected" if database is not None else "disconnected"
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "platform": "vercel",
        "database": db_status
    }

# ========================
# ROOT ENDPOINT
# ========================

@app.get("/")
async def root():
    return {
        "name": "Vibe Scout API",
        "version": "3.0.0",
        "status": "running",
        "docs": "/docs"
    }

# ========================
# USER ENDPOINTS
# ========================

@api_router.post("/users")
async def create_user(request: CreateUserRequest):
    database = get_db()
    if not database:
        raise HTTPException(status_code=503, detail="Database unavailable")
    
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
    await database.users.insert_one(user)
    user.pop("_id", None)
    return user

@api_router.get("/users/{user_id}")
async def get_user(user_id: str):
    database = get_db()
    if not database:
        raise HTTPException(status_code=503, detail="Database unavailable")
    
    user = await database.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

# ========================
# VENUE ENDPOINTS
# ========================

@api_router.get("/venues")
async def get_venues(city: Optional[str] = None):
    database = get_db()
    if not database:
        raise HTTPException(status_code=503, detail="Database unavailable")
    
    query = {}
    if city:
        query["city"] = city.lower()
    venues = await database.venues.find(query, {"_id": 0}).to_list(100)
    return venues

@api_router.get("/venues/{venue_id}")
async def get_venue(venue_id: str):
    database = get_db()
    if not database:
        raise HTTPException(status_code=503, detail="Database unavailable")
    
    venue = await database.venues.find_one({"id": venue_id}, {"_id": 0})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")
    return venue

@api_router.post("/venues/{venue_id}/direction-click")
async def record_direction_click(venue_id: str):
    database = get_db()
    if not database:
        raise HTTPException(status_code=503, detail="Database unavailable")
    
    await database.venues.update_one(
        {"id": venue_id},
        {"$inc": {"direction_clicks": 1}}
    )
    return {"success": True}

# ========================
# RATING ENDPOINTS
# ========================

@api_router.post("/ratings")
async def create_rating(request: CreateRatingRequest):
    database = get_db()
    if not database:
        raise HTTPException(status_code=503, detail="Database unavailable")
    
    # Validate user
    user = await database.users.find_one({"id": request.user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Validate venue
    venue = await database.venues.find_one({"id": request.venue_id}, {"_id": 0})
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
        "timestamp": datetime.now(timezone.utc),
        "verified": True
    }
    
    await database.ratings.insert_one(rating)
    
    # Update venue score
    recent_ratings = await database.ratings.find(
        {"venue_id": request.venue_id},
        {"_id": 0, "vibe_score": 1}
    ).sort("timestamp", -1).limit(10).to_list(10)
    
    if recent_ratings:
        avg_score = sum(r["vibe_score"] for r in recent_ratings) / len(recent_ratings)
        energy_level = get_energy_level(int(avg_score))
        
        await database.venues.update_one(
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
    now = datetime.now(timezone.utc)
    
    # Check if venue has active pulse drop (2x clout)
    active_pulse = await database.pulse_drops.find_one({
        "venue_id": request.venue_id,
        "start_time": {"$lte": now},
        "end_time": {"$gte": now}
    })
    
    clout_multiplier = 2 if active_pulse else 1
    clout_earned = base_clout * clout_multiplier
    
    # Update user clout
    await database.users.update_one(
        {"id": request.user_id},
        {"$inc": {"clout_points": clout_earned, "total_ratings": 1}}
    )
    
    rating.pop("_id", None)
    return {
        "rating": rating,
        "clout_earned": clout_earned,
        "multiplier": clout_multiplier,
        "sponsored": bool(active_pulse)
    }

# ========================
# TRENDING ENDPOINTS
# ========================

@api_router.get("/trending/{city}")
async def get_trending(city: str, limit: int = 20):
    database = get_db()
    if not database:
        raise HTTPException(status_code=503, detail="Database unavailable")
    
    now = datetime.now(timezone.utc)
    
    # Get venues with active pulse drops (sponsored)
    sponsored_venues = []
    pulse_drops = await database.pulse_drops.find({
        "end_time": {"$gte": now},
        "start_time": {"$lte": now}
    }, {"_id": 0}).to_list(50)
    
    sponsored_venue_ids = [p["venue_id"] for p in pulse_drops]
    
    if sponsored_venue_ids:
        sponsored = await database.venues.find(
            {"id": {"$in": sponsored_venue_ids}, "city": city.lower()},
            {"_id": 0}
        ).sort("current_vibe_score", -1).to_list(10)
        
        for venue in sponsored:
            pulse = next((p for p in pulse_drops if p["venue_id"] == venue["id"]), None)
            venue["is_sponsored"] = True
            venue["pulse_tier"] = pulse["tier"] if pulse else None
            sponsored_venues.append(venue)
    
    # Get organic trending (exclude sponsored)
    organic_venues = await database.venues.find(
        {"city": city.lower(), "id": {"$nin": sponsored_venue_ids}},
        {"_id": 0}
    ).sort("current_vibe_score", -1).limit(limit).to_list(limit)
    
    for venue in organic_venues:
        venue["is_sponsored"] = False
    
    return {"sponsored": sponsored_venues, "organic": organic_venues}

@api_router.get("/top-scouts/{city}")
async def get_top_scouts(city: str, limit: int = 10):
    database = get_db()
    if not database:
        raise HTTPException(status_code=503, detail="Database unavailable")
    
    scouts = await database.users.find(
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
# SEED DATA ENDPOINT
# ========================

@api_router.post("/seed")
async def seed_data():
    database = get_db()
    if not database:
        raise HTTPException(status_code=503, detail="Database unavailable")
    
    # Check if already seeded
    existing_venues = await database.venues.count_documents({})
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
        await database.venues.insert_one(venue)
    
    # Create super admin user
    admin_id = str(uuid.uuid4())
    admin_user = {
        "id": admin_id,
        "username": "superadmin",
        "phone": "+2341234567890",
        "home_city": "lagos",
        "clout_points": 1000,
        "scout_status": "elite",
        "total_ratings": 50,
        "is_admin": True,
        "is_super_admin": True,
        "is_merchant": False,
        "created_at": datetime.now(timezone.utc)
    }
    await database.users.insert_one(admin_user)
    
    return {
        "message": "Data seeded successfully",
        "venues_created": len(venues),
        "admin_user_id": admin_id
    }

# Include the router
app.include_router(api_router)

# Vercel handler
handler = app
