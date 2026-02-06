from fastapi import FastAPI, APIRouter, HTTPException, Query, Request, Response, Depends
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timedelta, timezone
import socketio
import math
import httpx
import hmac
import hashlib

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'vibe_app')]

# Paystack Configuration
PAYSTACK_SECRET_KEY = os.environ.get('PAYSTACK_SECRET_KEY', '')
PAYSTACK_PUBLIC_KEY = os.environ.get('PAYSTACK_PUBLIC_KEY', '')

# Create Socket.IO server
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    logger=True,
    engineio_logger=True
)

# Create the main FastAPI app
app = FastAPI(title="Vibe App API", version="3.0.0")

# Create Socket.IO ASGI app
socket_app = socketio.ASGIApp(sio, app)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ===== Constants =====
PULSE_DROP_TIERS = {
    "spark": {
        "name": "Spark",
        "price": 5000,  # NGN
        "radius_km": 2,
        "glow_boost": 20,
        "chart_placement": None,
        "duration_hours": 2,
        "description": "2km radius push + 20% glow increase"
    },
    "flare": {
        "name": "Flare",
        "price": 15000,  # NGN
        "radius_km": 5,
        "glow_boost": 40,
        "chart_placement": 3,  # Top 3
        "duration_hours": 4,
        "description": "5km radius push + Top 3 chart placement"
    },
    "supernova": {
        "name": "Supernova",
        "price": 50000,  # NGN
        "radius_km": 50,  # City-wide
        "glow_boost": 100,
        "chart_placement": 1,  # #1 Trending
        "duration_hours": 8,
        "custom_icon": True,
        "description": "City-wide push + #1 Trending + Custom Map Icon"
    }
}

CITIES = {
    "lagos": {
        "name": "Lagos",
        "code": "lagos",
        "center": {"lat": 6.4281, "lng": 3.4219},
        "radius_km": 30,
        "vibe_weights": {"club": 1.2, "lounge": 0.9, "restaurant": 0.8}
    },
    "abuja": {
        "name": "Abuja",
        "code": "abuja",
        "center": {"lat": 9.0579, "lng": 7.4951},
        "radius_km": 25,
        "vibe_weights": {"club": 0.9, "lounge": 1.3, "restaurant": 1.0}
    },
    "port_harcourt": {
        "name": "Port Harcourt",
        "code": "port_harcourt",
        "center": {"lat": 4.8156, "lng": 7.0498},
        "radius_km": 20,
        "vibe_weights": {"club": 1.1, "lounge": 1.0, "restaurant": 0.9}
    },
    "ibadan": {
        "name": "Ibadan",
        "code": "ibadan",
        "center": {"lat": 7.3775, "lng": 3.9470},
        "radius_km": 20,
        "vibe_weights": {"club": 0.8, "lounge": 1.1, "restaurant": 1.2}
    }
}

# ===== Pydantic Models =====

class Coordinates(BaseModel):
    lat: float
    lng: float

class UserCreate(BaseModel):
    username: str
    phone: str

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    phone: str
    email: Optional[str] = None
    name: Optional[str] = None
    picture: Optional[str] = None
    auth_provider: Literal["local", "google", "apple"] = "local"
    clout_points: int = 0
    scout_status: Literal["newbie", "regular", "scout", "elite"] = "newbie"
    rating_accuracy_score: float = 0.0
    total_ratings: int = 0
    home_city: str = "lagos"
    is_admin: bool = False
    is_super_admin: bool = False
    is_merchant: bool = False
    merchant_venue_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Venue(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    address: str
    area: str
    city: str = "lagos"
    venue_type: Literal["club", "lounge", "restaurant", "bar"] = "club"
    coordinates: Coordinates
    current_vibe_score: float = 0.0
    energy_level: Literal["chill", "popping", "electric"] = "chill"
    capacity_level: Literal["sparse", "vibrant", "full"] = "sparse"
    gate_level: Literal["clear", "slow", "blocked"] = "clear"
    vibe_velocity: Literal["heating_up", "cooling_down", "stable"] = "stable"
    total_ratings_24h: int = 0
    owner_id: Optional[str] = None
    is_featured: bool = False
    is_verified: bool = False
    photo_base64: Optional[str] = None
    # New B2C Intelligence Fields
    entry_fee: Optional[str] = None  # e.g., "₦10,000", "Free", "₦5,000 (Ladies Free)"
    music_genre: Optional[str] = None  # e.g., "Amapiano", "Afrobeats/House", "R&B"
    tables_available: bool = True
    last_snapshot_url: Optional[str] = None  # Live Look thumbnail URL
    last_snapshot_time: Optional[datetime] = None  # When the snapshot was taken
    # Pulse Drop
    active_pulse_tier: Optional[Literal["spark", "flare", "supernova"]] = None
    pulse_expires_at: Optional[datetime] = None
    custom_icon: Optional[str] = None
    glow_boost: float = 0
    # Analytics
    profile_views: int = 0
    direction_clicks: int = 0
    # Override
    admin_override_score: Optional[float] = None
    is_suppressed: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Rating(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    venue_id: str
    energy: Literal["chill", "popping", "electric"]
    capacity: Literal["sparse", "vibrant", "full"]
    gate: Literal["clear", "slow", "blocked"]
    photo_base64: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_correction: bool = False
    vibe_score: float = 0.0
    synced: bool = True  # For offline-first

class RatingCreate(BaseModel):
    user_id: str
    venue_id: str
    energy: Literal["chill", "popping", "electric"]
    capacity: Literal["sparse", "vibrant", "full"]
    gate: Literal["clear", "slow", "blocked"]
    photo_base64: Optional[str] = None
    coordinates: Coordinates
    offline_id: Optional[str] = None  # For offline sync

# Merchant Wallet System
class MerchantWallet(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    merchant_id: str
    venue_id: str
    balance: float = 0.0
    total_deposited: float = 0.0
    total_spent: float = 0.0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class WalletTransaction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    wallet_id: str
    type: Literal["deposit", "pulse_drop_spend", "refund"]
    amount: float
    balance_before: float
    balance_after: float
    reference: Optional[str] = None
    pulse_drop_id: Optional[str] = None
    paystack_reference: Optional[str] = None
    description: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PulseDrop(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    venue_id: str
    venue_name: str = ""
    tier: Literal["spark", "flare", "supernova"]
    message: str
    radius_km: float
    glow_boost: float
    chart_placement: Optional[int] = None
    price_paid: float
    city: str
    expires_at: datetime
    # ROI Metrics
    profile_views_before: int = 0
    profile_views_after: int = 0
    direction_clicks_before: int = 0
    direction_clicks_after: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PulseDropCreate(BaseModel):
    venue_id: str
    tier: Literal["spark", "flare", "supernova"]
    message: str

# Platform Treasury
class PlatformRevenue(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: Literal["pulse_drop"]
    venue_id: str
    venue_name: str
    amount: float
    tier: Optional[str] = None
    city: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AdminOverride(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    venue_id: str
    admin_id: str
    override_type: Literal["boost", "suppress", "verify", "unverify", "score_override"]
    override_value: Optional[float] = None
    reason: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ===== Helper Functions =====

def calculate_vibe_score(energy: str, capacity: str, gate: str) -> float:
    energy_scores = {"chill": 1, "popping": 2, "electric": 3}
    capacity_scores = {"sparse": 1, "vibrant": 2, "full": 3}
    gate_scores = {"clear": 3, "slow": 2, "blocked": 1}
    total = energy_scores[energy] + capacity_scores[capacity] + gate_scores[gate]
    return (total / 9) * 100

def calculate_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371000
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lng2 - lng1)
    a = math.sin(delta_phi/2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

def is_within_geofence(user_coords: Coordinates, venue_coords: Coordinates, radius_m: float = 50) -> bool:
    distance = calculate_distance(
        user_coords.lat, user_coords.lng,
        venue_coords.lat, venue_coords.lng
    )
    return distance <= radius_m

def verify_paystack_signature(payload: str, signature: str) -> bool:
    """Verify Paystack webhook signature"""
    if not PAYSTACK_SECRET_KEY:
        return True  # Skip verification if no key configured
    hash_object = hmac.new(
        PAYSTACK_SECRET_KEY.encode(),
        payload.encode(),
        hashlib.sha512
    )
    computed_signature = hash_object.hexdigest()
    return hmac.compare_digest(computed_signature, signature)

async def calculate_venue_aggregate(venue_id: str) -> dict:
    now = datetime.now(timezone.utc)
    hour_ago = now - timedelta(hours=1)
    
    venue = await db.venues.find_one({"id": venue_id})
    if not venue:
        return {}
    
    if venue.get("is_suppressed"):
        return {
            "current_vibe_score": 0,
            "energy_level": "chill",
            "capacity_level": "sparse",
            "gate_level": "clear",
            "vibe_velocity": "stable",
            "total_ratings_24h": 0
        }
    
    ratings = await db.ratings.find({
        "venue_id": venue_id,
        "timestamp": {"$gte": hour_ago}
    }).to_list(1000)
    
    if not ratings:
        base_score = venue.get("admin_override_score", 0) or 0
        glow_boost = venue.get("glow_boost", 0) or 0
        return {
            "current_vibe_score": min(100, base_score + glow_boost),
            "energy_level": "chill",
            "capacity_level": "sparse",
            "gate_level": "clear",
            "vibe_velocity": "stable",
            "total_ratings_24h": 0
        }
    
    # Time-decay weights: last 15 min = 3x, 15-30 min = 2x, 30-60 min = 1x
    weighted_scores = []
    energy_counts = {"chill": 0, "popping": 0, "electric": 0}
    capacity_counts = {"sparse": 0, "vibrant": 0, "full": 0}
    gate_counts = {"clear": 0, "slow": 0, "blocked": 0}
    
    for rating in ratings:
        rating_time = rating.get("timestamp", now)
        if isinstance(rating_time, str):
            rating_time = datetime.fromisoformat(rating_time.replace('Z', '+00:00'))
        if rating_time.tzinfo is None:
            rating_time = rating_time.replace(tzinfo=timezone.utc)
        
        minutes_ago = (now - rating_time).total_seconds() / 60
        
        if minutes_ago <= 15:
            weight = 3.0
        elif minutes_ago <= 30:
            weight = 2.0
        else:
            weight = 1.0
        
        score = rating.get("vibe_score", calculate_vibe_score(
            rating["energy"], rating["capacity"], rating["gate"]
        ))
        weighted_scores.append((score, weight))
        
        energy_counts[rating["energy"]] += weight
        capacity_counts[rating["capacity"]] += weight
        gate_counts[rating["gate"]] += weight
    
    total_weight = sum(w for _, w in weighted_scores)
    avg_score = sum(s * w for s, w in weighted_scores) / total_weight if total_weight > 0 else 0
    
    # Apply glow boost from active pulse drops
    glow_boost = venue.get("glow_boost", 0) or 0
    avg_score = min(100, avg_score + glow_boost)
    
    # Apply admin override if exists
    if venue.get("admin_override_score") is not None:
        avg_score = venue.get("admin_override_score")
    
    energy_level = max(energy_counts, key=energy_counts.get)
    capacity_level = max(capacity_counts, key=capacity_counts.get)
    gate_level = max(gate_counts, key=gate_counts.get)
    
    # Calculate velocity
    recent_count = sum(1 for r in ratings if (now - r.get("timestamp", now).replace(tzinfo=timezone.utc) if r.get("timestamp", now).tzinfo is None else (now - r.get("timestamp", now))).total_seconds() / 60 <= 15)
    older_count = len(ratings) - recent_count
    
    if recent_count > older_count * 1.5:
        velocity = "heating_up"
    elif recent_count < older_count * 0.5:
        velocity = "cooling_down"
    else:
        velocity = "stable"
    
    day_ago = now - timedelta(hours=24)
    ratings_24h = await db.ratings.count_documents({
        "venue_id": venue_id,
        "timestamp": {"$gte": day_ago}
    })
    
    return {
        "current_vibe_score": round(avg_score, 1),
        "energy_level": energy_level,
        "capacity_level": capacity_level,
        "gate_level": gate_level,
        "vibe_velocity": velocity,
        "total_ratings_24h": ratings_24h
    }

async def update_user_clout(user_id: str, venue_id: str, rating_score: float):
    venue = await db.venues.find_one({"id": venue_id})
    if not venue:
        return
    
    venue_avg = venue.get("current_vibe_score", 50)
    accuracy = 100 - abs(rating_score - venue_avg)
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        return
    
    total_ratings = user.get("total_ratings", 0)
    current_accuracy = user.get("rating_accuracy_score", 0)
    new_accuracy = ((current_accuracy * total_ratings) + accuracy) / (total_ratings + 1)
    
    clout_bonus = int(accuracy / 10)
    if venue.get("current_vibe_score", 0) > 70:
        clout_bonus += 5
    
    new_clout = user.get("clout_points", 0) + clout_bonus
    new_total = total_ratings + 1
    
    if new_accuracy >= 80 and new_total >= 50:
        status = "elite"
    elif new_accuracy >= 70 and new_total >= 20:
        status = "scout"
    elif new_total >= 10:
        status = "regular"
    else:
        status = "newbie"
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "rating_accuracy_score": round(new_accuracy, 1),
            "total_ratings": new_total,
            "clout_points": new_clout,
            "scout_status": status
        }}
    )

async def get_current_user(request: Request) -> Optional[dict]:
    """Get current user from session token or X-User-Id header"""
    # First try X-User-Id header (for mobile app AsyncStorage-based auth)
    user_id = request.headers.get("X-User-Id")
    if user_id:
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if user:
            return user
    
    # Fall back to session token (cookie or Bearer token)
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
    
    if not session_token:
        return None
    
    session = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session:
        return None
    
    expires_at = session.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < datetime.now(timezone.utc):
        return None
    
    user = await db.users.find_one({"id": session["user_id"]}, {"_id": 0})
    return user

# ===== Socket.IO Events =====

connected_clients = set()

@sio.event
async def connect(sid, environ):
    connected_clients.add(sid)
    logger.info(f"Client connected: {sid}, Total: {len(connected_clients)}")
    await sio.emit('connection_status', {'status': 'connected', 'total_connections': len(connected_clients)}, to=sid)

@sio.event
async def disconnect(sid):
    connected_clients.discard(sid)
    logger.info(f"Client disconnected: {sid}, Total: {len(connected_clients)}")

@sio.event
async def join_venue(sid, data):
    venue_id = data.get('venue_id')
    if venue_id:
        await sio.enter_room(sid, f"venue_{venue_id}")

@sio.event
async def join_city(sid, data):
    city = data.get('city', 'lagos')
    await sio.enter_room(sid, f"city_{city}")

@sio.event
async def subscribe_leaderboard(sid, data=None):
    city = data.get('city', 'all') if data else 'all'
    await sio.enter_room(sid, f"leaderboard_{city}")

async def broadcast_venue_update(venue_id: str):
    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0})
    if venue:
        await sio.emit('venue_update', venue, room=f"venue_{venue_id}")
        await sio.emit('venue_update', venue, room=f"city_{venue.get('city', 'lagos')}")

async def broadcast_leaderboard(city: str = "all"):
    query = {} if city == "all" else {"city": city}
    venues = await db.venues.find(query, {"_id": 0}).sort("current_vibe_score", -1).to_list(50)
    
    leaderboard = []
    for i, v in enumerate(venues):
        leaderboard.append({
            "venue": v,
            "rank": i + 1,
            "trend": v.get("vibe_velocity", "stable")
        })
    
    await sio.emit('leaderboard_update', leaderboard, room=f"leaderboard_{city}")

# ===== API Routes =====

@api_router.get("/")
async def root():
    return {"message": "Vibe App API", "version": "3.0.0"}

@api_router.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# ===== Auth Routes =====

@api_router.post("/auth/session")
async def create_session(request: Request, response: Response):
    """Exchange session_id for session_token after Google OAuth"""
    body = await request.json()
    session_id = body.get("session_id")
    
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    
    async with httpx.AsyncClient() as client:
        auth_response = await client.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )
    
    if auth_response.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session_id")
    
    auth_data = auth_response.json()
    email = auth_data.get("email")
    name = auth_data.get("name")
    picture = auth_data.get("picture")
    session_token = auth_data.get("session_token")
    
    existing_user = await db.users.find_one({"email": email}, {"_id": 0})
    
    if existing_user:
        user_id = existing_user["id"]
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"name": name, "picture": picture}}
        )
    else:
        user_id = str(uuid.uuid4())
        new_user = User(
            id=user_id,
            username=email.split("@")[0],
            phone="",
            email=email,
            name=name,
            picture=picture,
            auth_provider="google"
        )
        await db.users.insert_one(new_user.dict())
    
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    session = {
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc)
    }
    await db.user_sessions.insert_one(session)
    
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7*24*60*60
    )
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    return user

@api_router.get("/auth/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out"}

# ===== User Routes =====

class UserLogin(BaseModel):
    phone: str

@api_router.post("/users/login")
async def login_user(login_data: UserLogin):
    """Login by phone number - returns existing user"""
    user = await db.users.find_one({"phone": login_data.phone}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found. Please sign up first.")
    return user

@api_router.post("/users")
async def create_user(user_data: UserCreate):
    # Check if username exists
    existing_username = await db.users.find_one({"username": user_data.username})
    if existing_username:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Check if phone already exists - return that user instead (login flow)
    existing_phone = await db.users.find_one({"phone": user_data.phone}, {"_id": 0})
    if existing_phone:
        return existing_phone
    
    user = User(**user_data.dict())
    await db.users.insert_one(user.dict())
    return user.dict()

@api_router.get("/users/{user_id}")
async def get_user(user_id: str):
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

# ===== City Routes =====

@api_router.get("/cities")
async def get_cities():
    return list(CITIES.values())

# ===== Venue Routes =====

@api_router.get("/venues")
async def get_venues(city: Optional[str] = None):
    query = {"city": city} if city else {}
    venues = await db.venues.find(query, {"_id": 0}).to_list(100)
    return venues

@api_router.get("/venues/{venue_id}")
async def get_venue(venue_id: str):
    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")
    
    # Increment profile views
    await db.venues.update_one({"id": venue_id}, {"$inc": {"profile_views": 1}})
    
    return venue

@api_router.post("/venues/{venue_id}/direction-click")
async def record_direction_click(venue_id: str):
    """Record when user clicks direction/location icon"""
    await db.venues.update_one({"id": venue_id}, {"$inc": {"direction_clicks": 1}})
    return {"message": "Direction click recorded"}

# ===== Trending & Leaderboard Routes =====

@api_router.get("/trending/{city}")
async def get_trending_venues(city: str, limit: int = 10):
    """
    Get trending venues with dynamic scoring formula:
    vibe_score = (avg_energy * 0.5) + (check_in_velocity * 0.3) + (scout_count * 0.2)
    """
    now = datetime.now(timezone.utc)
    hour_ago = now - timedelta(hours=1)
    day_ago = now - timedelta(hours=24)
    
    # Get all venues in the city
    venues = await db.venues.find(
        {"city": city.lower()}, 
        {"_id": 0}
    ).to_list(100)
    
    trending_data = []
    
    for venue in venues:
        venue_id = venue["id"]
        
        # Get ratings from last hour for velocity calculation
        recent_ratings = await db.ratings.find({
            "venue_id": venue_id,
            "timestamp": {"$gte": hour_ago}
        }).to_list(100)
        
        # Get unique scouts (users) who rated in last 24h
        day_ratings = await db.ratings.find({
            "venue_id": venue_id,
            "timestamp": {"$gte": day_ago}
        }).to_list(500)
        
        unique_scouts = len(set(r.get("user_id") for r in day_ratings if r.get("user_id")))
        
        # Calculate metrics
        avg_energy = venue.get("current_vibe_score", 0)
        check_in_velocity = len(recent_ratings) * 10  # Scale up for scoring
        scout_count = unique_scouts * 5  # Scale up for scoring
        
        # Apply formula: (avg_energy * 0.5) + (check_in_velocity * 0.3) + (scout_count * 0.2)
        trending_score = (avg_energy * 0.5) + (check_in_velocity * 0.3) + (scout_count * 0.2)
        
        # Determine trend direction (compare to 6 hours ago)
        six_hours_ago = now - timedelta(hours=6)
        old_ratings = await db.ratings.find({
            "venue_id": venue_id,
            "timestamp": {"$gte": six_hours_ago, "$lt": hour_ago}
        }).to_list(100)
        
        old_velocity = len(old_ratings)
        new_velocity = len(recent_ratings)
        
        if new_velocity > old_velocity:
            trend = "up"
        elif new_velocity < old_velocity:
            trend = "down"
        else:
            trend = "stable"
        
        trending_data.append({
            "venue": venue,
            "trending_score": round(trending_score, 1),
            "energy_percent": min(100, round(avg_energy)),
            "check_in_velocity": len(recent_ratings),
            "scout_count": unique_scouts,
            "trend": trend,
            "last_rating": day_ratings[-1]["timestamp"].isoformat() if day_ratings else None
        })
    
    # Sort by trending score
    trending_data.sort(key=lambda x: x["trending_score"], reverse=True)
    
    # Add ranks
    for i, item in enumerate(trending_data[:limit]):
        item["rank"] = i + 1
    
    return {
        "city": city,
        "venues": trending_data[:limit],
        "last_updated": now.isoformat(),
        "total_venues": len(venues)
    }

@api_router.get("/top-scouts/{city}")
async def get_top_scouts(city: str, limit: int = 5):
    """
    Get top scouts with most verified vibe checks in last 24 hours
    """
    now = datetime.now(timezone.utc)
    day_ago = now - timedelta(hours=24)
    
    # Aggregate ratings by user in last 24h
    pipeline = [
        {
            "$match": {
                "timestamp": {"$gte": day_ago},
                "superseded": {"$ne": True}  # Only count non-superseded ratings
            }
        },
        {
            "$lookup": {
                "from": "venues",
                "localField": "venue_id",
                "foreignField": "id",
                "as": "venue_info"
            }
        },
        {
            "$match": {
                "venue_info.city": city.lower()
            }
        },
        {
            "$group": {
                "_id": "$user_id",
                "check_count": {"$sum": 1},
                "total_vibe_score": {"$sum": "$vibe_score"},
                "venues_rated": {"$addToSet": "$venue_id"},
                "last_check": {"$max": "$timestamp"}
            }
        },
        {
            "$sort": {"check_count": -1}
        },
        {
            "$limit": limit
        }
    ]
    
    scout_stats = await db.ratings.aggregate(pipeline).to_list(limit)
    
    top_scouts = []
    for i, scout in enumerate(scout_stats):
        user_id = scout["_id"]
        if not user_id:
            continue
            
        # Get user details
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user:
            continue
        
        # Determine scout tier based on total ratings
        total_ratings = user.get("total_ratings", 0)
        if total_ratings >= 50:
            tier = "elite"
            ring_color = "#FF3366"
        elif total_ratings >= 25:
            tier = "scout"
            ring_color = "#FFD700"
        elif total_ratings >= 10:
            tier = "regular"
            ring_color = "#00D4FF"
        else:
            tier = "newbie"
            ring_color = "#666666"
        
        top_scouts.append({
            "rank": i + 1,
            "user_id": user_id,
            "username": user.get("username", "Anonymous"),
            "avatar": user.get("picture"),
            "check_count": scout["check_count"],
            "venues_visited": len(scout["venues_rated"]),
            "avg_vibe_contribution": round(scout["total_vibe_score"] / scout["check_count"], 1) if scout["check_count"] > 0 else 0,
            "last_check": scout["last_check"].isoformat() if scout["last_check"] else None,
            "tier": tier,
            "ring_color": ring_color,
            "is_elite": tier == "elite",
            "clout_points": user.get("clout_points", 0),
            "accuracy_score": user.get("rating_accuracy_score", 0)
        })
    
    return {
        "city": city,
        "scouts": top_scouts,
        "last_updated": now.isoformat(),
        "time_window": "24h"
    }

@api_router.get("/scout/{user_id}/profile")
async def get_scout_profile(user_id: str):
    """
    Get scout mini-profile with activity heatmap
    Returns user details, total clout, recent venue visits
    """
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Scout not found")
    
    now = datetime.now(timezone.utc)
    day_ago = now - timedelta(hours=24)
    week_ago = now - timedelta(days=7)
    
    # Get recent ratings with venue info
    recent_ratings = await db.ratings.find({
        "user_id": user_id,
        "timestamp": {"$gte": day_ago}
    }).sort("timestamp", -1).to_list(20)
    
    # Build activity heatmap (recent check-ins with venues)
    activity_heatmap = []
    for rating in recent_ratings:
        venue = await db.venues.find_one({"id": rating["venue_id"]}, {"_id": 0})
        if venue:
            # Ensure rating timestamp has timezone info
            rating_timestamp = rating["timestamp"]
            if rating_timestamp.tzinfo is None:
                rating_timestamp = rating_timestamp.replace(tzinfo=timezone.utc)
            
            time_diff = now - rating_timestamp
            mins_ago = int(time_diff.total_seconds() / 60)
            
            if mins_ago < 60:
                time_str = f"{mins_ago} min{'s' if mins_ago != 1 else ''} ago"
            else:
                hours_ago = mins_ago // 60
                time_str = f"{hours_ago} hour{'s' if hours_ago != 1 else ''} ago"
            
            activity_heatmap.append({
                "venue_id": venue["id"],
                "venue_name": venue["name"],
                "venue_area": venue.get("area", ""),
                "vibe_score": rating.get("vibe_score", 0),
                "energy": rating.get("energy", "chill"),
                "timestamp": rating["timestamp"].isoformat(),
                "time_ago": time_str
            })
    
    # Get weekly stats
    week_ratings = await db.ratings.count_documents({
        "user_id": user_id,
        "timestamp": {"$gte": week_ago}
    })
    
    unique_venues_week = await db.ratings.distinct("venue_id", {
        "user_id": user_id,
        "timestamp": {"$gte": week_ago}
    })
    
    # Determine tier
    total_ratings = user.get("total_ratings", 0)
    if total_ratings >= 50:
        tier = "elite"
        tier_color = "#FF3366"
    elif total_ratings >= 25:
        tier = "scout"
        tier_color = "#FFD700"
    elif total_ratings >= 10:
        tier = "regular"
        tier_color = "#00D4FF"
    else:
        tier = "newbie"
        tier_color = "#666666"
    
    return {
        "user": {
            "id": user["id"],
            "username": user.get("username", "Anonymous"),
            "avatar": user.get("picture"),
            "clout_points": user.get("clout_points", 0),
            "scout_status": user.get("scout_status", "newbie"),
            "rating_accuracy_score": user.get("rating_accuracy_score", 0),
            "total_ratings": total_ratings,
            "tier": tier,
            "tier_color": tier_color
        },
        "activity_heatmap": activity_heatmap,
        "stats": {
            "checks_24h": len(recent_ratings),
            "checks_7d": week_ratings,
            "unique_venues_7d": len(unique_venues_week)
        },
        "last_seen": activity_heatmap[0] if activity_heatmap else None
    }

# ===== Rating Routes =====

@api_router.post("/ratings")
async def create_rating(rating_data: RatingCreate):
    venue = await db.venues.find_one({"id": rating_data.venue_id})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")
    
    venue_coords = Coordinates(**venue["coordinates"])
    if not is_within_geofence(rating_data.coordinates, venue_coords, radius_m=50):
        raise HTTPException(
            status_code=403, 
            detail="You must be at the venue to rate. Please get closer."
        )
    
    now = datetime.now(timezone.utc)
    day_ago = now - timedelta(hours=24)
    
    existing_ratings = await db.ratings.find({
        "user_id": rating_data.user_id,
        "venue_id": rating_data.venue_id,
        "timestamp": {"$gte": day_ago}
    }).sort("timestamp", -1).to_list(10)
    
    if len(existing_ratings) >= 2:
        raise HTTPException(
            status_code=429,
            detail="Rating limit reached. You can rate this venue again in 24 hours."
        )
    
    vibe_score = calculate_vibe_score(
        rating_data.energy, 
        rating_data.capacity, 
        rating_data.gate
    )
    
    is_correction = len(existing_ratings) == 1
    rating = Rating(
        **rating_data.dict(exclude={"coordinates", "offline_id"}),
        vibe_score=vibe_score,
        is_correction=is_correction
    )
    
    if is_correction and existing_ratings:
        await db.ratings.update_one(
            {"id": existing_ratings[0]["id"]},
            {"$set": {"superseded": True}}
        )
    
    await db.ratings.insert_one(rating.dict())
    
    aggregate = await calculate_venue_aggregate(rating_data.venue_id)
    await db.venues.update_one(
        {"id": rating_data.venue_id},
        {"$set": aggregate}
    )
    
    await update_user_clout(rating_data.user_id, rating_data.venue_id, vibe_score)
    
    await broadcast_venue_update(rating_data.venue_id)
    await broadcast_leaderboard(venue.get("city", "lagos"))
    await broadcast_leaderboard("all")
    
    return {
        "rating": rating.dict(),
        "is_correction": is_correction,
        "remaining_ratings": 1 if not is_correction else 0,
        "venue_vibe_score": aggregate.get("current_vibe_score", 0)
    }

@api_router.post("/ratings/sync")
async def sync_offline_ratings(request: Request):
    """Sync ratings that were created offline"""
    body = await request.json()
    ratings = body.get("ratings", [])
    synced = []
    
    for rating_data in ratings:
        try:
            result = await create_rating(RatingCreate(**rating_data))
            synced.append({"offline_id": rating_data.get("offline_id"), "success": True})
        except Exception as e:
            synced.append({"offline_id": rating_data.get("offline_id"), "success": False, "error": str(e)})
    
    return {"synced": synced}

@api_router.get("/ratings/user/{user_id}/venue/{venue_id}")
async def get_user_venue_ratings(user_id: str, venue_id: str):
    now = datetime.now(timezone.utc)
    day_ago = now - timedelta(hours=24)
    
    ratings = await db.ratings.find({
        "user_id": user_id,
        "venue_id": venue_id,
        "timestamp": {"$gte": day_ago}
    }, {"_id": 0}).to_list(10)
    
    return {
        "ratings_count": len(ratings),
        "can_rate": len(ratings) < 2,
        "is_correction_available": len(ratings) == 1,
        "ratings": ratings
    }

# ===== Leaderboard Routes =====

@api_router.get("/leaderboard")
async def get_leaderboard(city: Optional[str] = None, limit: int = 20):
    query = {"is_suppressed": {"$ne": True}}
    if city:
        query["city"] = city
    
    now = datetime.now(timezone.utc)
    venues = await db.venues.find(query, {"_id": 0}).to_list(100)
    
    def sort_key(v):
        if v.get("pulse_expires_at"):
            expires = v.get("pulse_expires_at")
            if isinstance(expires, str):
                expires = datetime.fromisoformat(expires.replace('Z', '+00:00'))
            if expires.tzinfo is None:
                expires = expires.replace(tzinfo=timezone.utc)
            
            if expires > now and v.get("active_pulse_tier"):
                tier_config = PULSE_DROP_TIERS.get(v.get("active_pulse_tier"), {})
                placement = tier_config.get("chart_placement")
                if placement:
                    return (-1000 + placement, -v.get("current_vibe_score", 0))
        
        return (0, -v.get("current_vibe_score", 0))
    
    venues.sort(key=sort_key)
    venues = venues[:limit]
    
    leaderboard = []
    for i, v in enumerate(venues):
        leaderboard.append({
            "venue": v,
            "rank": i + 1,
            "trend": "up" if v.get("vibe_velocity") == "heating_up" else 
                    "down" if v.get("vibe_velocity") == "cooling_down" else "stable",
            "has_pulse_boost": bool(v.get("active_pulse_tier"))
        })
    
    return leaderboard

@api_router.get("/leaderboard/national")
async def get_national_leaderboard(limit: int = 20):
    venues = await db.venues.find({"is_suppressed": {"$ne": True}}, {"_id": 0}).sort("current_vibe_score", -1).limit(limit).to_list(limit)
    
    leaderboard = []
    for i, v in enumerate(venues):
        leaderboard.append({
            "venue": v,
            "rank": i + 1,
            "trend": v.get("vibe_velocity", "stable"),
            "city": v.get("city", "lagos")
        })
    
    return leaderboard

# ===== Merchant Wallet Routes =====

@api_router.get("/merchant/wallet/{venue_id}")
async def get_merchant_wallet(venue_id: str):
    """Get merchant wallet for a venue"""
    wallet = await db.merchant_wallets.find_one({"venue_id": venue_id}, {"_id": 0})
    if not wallet:
        # Create new wallet
        wallet = MerchantWallet(
            merchant_id=venue_id,  # Using venue_id as merchant_id for simplicity
            venue_id=venue_id
        ).dict()
        await db.merchant_wallets.insert_one(wallet)
    
    # Get recent transactions
    transactions = await db.wallet_transactions.find(
        {"wallet_id": wallet["id"]}
    ).sort("timestamp", -1).limit(20).to_list(20)
    
    return {
        "wallet": wallet,
        "transactions": transactions
    }

@api_router.post("/merchant/wallet/{venue_id}/topup/initialize")
async def initialize_wallet_topup(venue_id: str, request: Request):
    """Initialize Paystack payment for wallet top-up"""
    body = await request.json()
    amount = body.get("amount", 0)
    email = body.get("email", "")
    
    if amount < 1000:
        raise HTTPException(status_code=400, detail="Minimum top-up is ₦1,000")
    
    reference = f"VIBE-TOPUP-{venue_id[:8]}-{uuid.uuid4().hex[:8]}"
    
    # Store pending transaction
    await db.pending_topups.insert_one({
        "reference": reference,
        "venue_id": venue_id,
        "amount": amount,
        "status": "pending",
        "created_at": datetime.now(timezone.utc)
    })
    
    # If Paystack is configured, initialize with their API
    if PAYSTACK_SECRET_KEY:
        async with httpx.AsyncClient() as client:
            paystack_response = await client.post(
                "https://api.paystack.co/transaction/initialize",
                headers={
                    "Authorization": f"Bearer {PAYSTACK_SECRET_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "email": email,
                    "amount": int(amount * 100),  # Convert to Kobo
                    "reference": reference,
                    "metadata": {
                        "venue_id": venue_id,
                        "type": "wallet_topup"
                    }
                }
            )
            
            if paystack_response.status_code == 200:
                data = paystack_response.json()
                return {
                    "authorization_url": data["data"]["authorization_url"],
                    "reference": reference
                }
    
    # Mock response for testing without Paystack
    return {
        "authorization_url": f"https://checkout.paystack.com/mock/{reference}",
        "reference": reference,
        "mock": True
    }

@api_router.post("/merchant/wallet/verify/{reference}")
async def verify_wallet_topup(reference: str):
    """Verify Paystack payment and credit wallet"""
    pending = await db.pending_topups.find_one({"reference": reference})
    if not pending:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    if pending.get("status") == "completed":
        return {"message": "Already processed", "success": True}
    
    # Verify with Paystack if configured
    verified = False
    if PAYSTACK_SECRET_KEY:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://api.paystack.co/transaction/verify/{reference}",
                headers={"Authorization": f"Bearer {PAYSTACK_SECRET_KEY}"}
            )
            if response.status_code == 200:
                data = response.json()
                if data.get("data", {}).get("status") == "success":
                    verified = True
    else:
        # Auto-verify for testing
        verified = True
    
    if verified:
        # Credit wallet
        wallet = await db.merchant_wallets.find_one({"venue_id": pending["venue_id"]})
        if not wallet:
            wallet = MerchantWallet(
                merchant_id=pending["venue_id"],
                venue_id=pending["venue_id"]
            ).dict()
            await db.merchant_wallets.insert_one(wallet)
            wallet = await db.merchant_wallets.find_one({"venue_id": pending["venue_id"]})
        
        balance_before = wallet.get("balance", 0)
        new_balance = balance_before + pending["amount"]
        
        await db.merchant_wallets.update_one(
            {"id": wallet["id"]},
            {"$set": {
                "balance": new_balance,
                "total_deposited": wallet.get("total_deposited", 0) + pending["amount"]
            }}
        )
        
        # Record transaction
        tx = WalletTransaction(
            wallet_id=wallet["id"],
            type="deposit",
            amount=pending["amount"],
            balance_before=balance_before,
            balance_after=new_balance,
            paystack_reference=reference,
            description=f"Wallet top-up via Paystack"
        )
        await db.wallet_transactions.insert_one(tx.dict())
        
        # Mark as completed
        await db.pending_topups.update_one(
            {"reference": reference},
            {"$set": {"status": "completed"}}
        )
        
        return {"success": True, "new_balance": new_balance}
    
    raise HTTPException(status_code=400, detail="Payment verification failed")

# ===== Pulse Drop Routes =====

@api_router.get("/pulse-drops/tiers")
async def get_pulse_drop_tiers():
    return PULSE_DROP_TIERS

@api_router.post("/pulse-drops/purchase")
async def purchase_pulse_drop(drop_data: PulseDropCreate):
    """Purchase pulse drop using wallet balance (instant credit to treasury)"""
    venue = await db.venues.find_one({"id": drop_data.venue_id})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")
    
    tier_config = PULSE_DROP_TIERS.get(drop_data.tier)
    if not tier_config:
        raise HTTPException(status_code=400, detail="Invalid tier")
    
    price = tier_config["price"]
    
    # Check wallet balance
    wallet = await db.merchant_wallets.find_one({"venue_id": drop_data.venue_id})
    if not wallet or wallet.get("balance", 0) < price:
        raise HTTPException(
            status_code=402, 
            detail=f"Insufficient balance. Required: ₦{price:,}, Available: ₦{wallet.get('balance', 0) if wallet else 0:,}"
        )
    
    # Deduct from wallet
    balance_before = wallet["balance"]
    new_balance = balance_before - price
    
    await db.merchant_wallets.update_one(
        {"id": wallet["id"]},
        {"$set": {
            "balance": new_balance,
            "total_spent": wallet.get("total_spent", 0) + price
        }}
    )
    
    # Record wallet transaction
    wallet_tx = WalletTransaction(
        wallet_id=wallet["id"],
        type="pulse_drop_spend",
        amount=price,
        balance_before=balance_before,
        balance_after=new_balance,
        description=f"Pulse Drop - {tier_config['name']}"
    )
    await db.wallet_transactions.insert_one(wallet_tx.dict())
    
    # Credit platform treasury immediately
    revenue = PlatformRevenue(
        type="pulse_drop",
        venue_id=drop_data.venue_id,
        venue_name=venue["name"],
        amount=price,
        tier=drop_data.tier,
        city=venue.get("city", "lagos")
    )
    await db.platform_revenue.insert_one(revenue.dict())
    
    # Create pulse drop
    expires_at = datetime.now(timezone.utc) + timedelta(hours=tier_config["duration_hours"])
    
    pulse_drop = PulseDrop(
        venue_id=drop_data.venue_id,
        venue_name=venue["name"],
        tier=drop_data.tier,
        message=drop_data.message,
        radius_km=tier_config["radius_km"],
        glow_boost=tier_config["glow_boost"],
        chart_placement=tier_config.get("chart_placement"),
        price_paid=price,
        city=venue.get("city", "lagos"),
        expires_at=expires_at,
        profile_views_before=venue.get("profile_views", 0),
        direction_clicks_before=venue.get("direction_clicks", 0)
    )
    await db.pulse_drops.insert_one(pulse_drop.dict())
    
    # Update venue with pulse drop effects
    update_data = {
        "active_pulse_tier": drop_data.tier,
        "pulse_expires_at": expires_at,
        "glow_boost": tier_config["glow_boost"]
    }
    if tier_config.get("custom_icon"):
        update_data["custom_icon"] = "supernova"
    
    await db.venues.update_one({"id": drop_data.venue_id}, {"$set": update_data})
    
    # Recalculate venue score with boost
    aggregate = await calculate_venue_aggregate(drop_data.venue_id)
    await db.venues.update_one({"id": drop_data.venue_id}, {"$set": aggregate})
    
    # Broadcast updates
    await broadcast_venue_update(drop_data.venue_id)
    await broadcast_leaderboard(venue.get("city", "lagos"))
    await broadcast_leaderboard("all")
    
    # Emit pulse drop notification
    await sio.emit('pulse_drop', {
        "drop": pulse_drop.dict(),
        "venue": venue,
        "tier": tier_config
    }, room=f"city_{venue.get('city', 'lagos')}")
    
    return {
        "pulse_drop": pulse_drop.dict(),
        "new_wallet_balance": new_balance
    }

@api_router.get("/pulse-drops/nearby/{lat}/{lng}")
async def get_nearby_pulse_drops(lat: float, lng: float, radius_km: float = 10.0):
    now = datetime.now(timezone.utc)
    drops = await db.pulse_drops.find({"expires_at": {"$gte": now}}, {"_id": 0}).to_list(50)
    
    nearby_drops = []
    for drop in drops:
        venue = await db.venues.find_one({"id": drop["venue_id"]}, {"_id": 0})
        if venue:
            coords = venue.get("coordinates", {})
            distance = calculate_distance(lat, lng, coords.get("lat", 0), coords.get("lng", 0))
            if distance <= drop.get("radius_km", 5) * 1000:
                drop["venue"] = venue
                drop["distance_m"] = round(distance)
                nearby_drops.append(drop)
    
    return nearby_drops

# ===== Merchant Dashboard Routes =====

@api_router.get("/merchant/venue/{venue_id}/stats")
async def get_merchant_venue_stats(venue_id: str):
    """Get detailed stats for venue owner with ROI metrics"""
    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")
    
    now = datetime.now(timezone.utc)
    hour_ago = now - timedelta(hours=1)
    day_ago = now - timedelta(hours=24)
    week_ago = now - timedelta(days=7)
    
    # Rating stats
    ratings_1h = await db.ratings.count_documents({"venue_id": venue_id, "timestamp": {"$gte": hour_ago}})
    ratings_24h = await db.ratings.count_documents({"venue_id": venue_id, "timestamp": {"$gte": day_ago}})
    ratings_7d = await db.ratings.count_documents({"venue_id": venue_id, "timestamp": {"$gte": week_ago}})
    
    # Engagement stats
    profile_views = venue.get("profile_views", 0)
    direction_clicks = venue.get("direction_clicks", 0)
    
    # Calculate district average for Heatmap Delta
    district_venues = await db.venues.find({
        "city": venue.get("city"),
        "area": venue.get("area")
    }, {"_id": 0}).to_list(50)
    
    district_avg = sum(v.get("current_vibe_score", 0) for v in district_venues) / len(district_venues) if district_venues else 0
    heatmap_delta = venue.get("current_vibe_score", 0) - district_avg
    
    # Pulse Drop ROI
    recent_drops = await db.pulse_drops.find({
        "venue_id": venue_id,
        "created_at": {"$gte": week_ago}
    }, {"_id": 0}).to_list(20)
    
    pulse_drop_roi = []
    for drop in recent_drops:
        views_gained = venue.get("profile_views", 0) - drop.get("profile_views_before", 0)
        directions_gained = venue.get("direction_clicks", 0) - drop.get("direction_clicks_before", 0)
        pulse_drop_roi.append({
            "id": drop["id"],
            "tier": drop["tier"],
            "price": drop["price_paid"],
            "profile_views_gained": views_gained,
            "direction_clicks_gained": directions_gained,
            "created_at": drop["created_at"]
        })
    
    # Hourly trend
    hourly_scores = []
    for h in range(24):
        start = now - timedelta(hours=h+1)
        end = now - timedelta(hours=h)
        ratings = await db.ratings.find({
            "venue_id": venue_id,
            "timestamp": {"$gte": start, "$lt": end}
        }, {"_id": 0}).to_list(100)
        
        avg_score = sum(r.get("vibe_score", 0) for r in ratings) / len(ratings) if ratings else 0
        hourly_scores.append({"hour": h, "score": round(avg_score, 1), "count": len(ratings)})
    
    # Competition - top 5 venues in same area
    competitors = await db.venues.find(
        {"city": venue.get("city"), "area": venue.get("area"), "id": {"$ne": venue_id}},
        {"_id": 0}
    ).sort("current_vibe_score", -1).limit(5).to_list(5)
    
    # Get venue rank
    all_area_venues = await db.venues.find({"city": venue.get("city"), "area": venue.get("area")}, {"_id": 0}).sort("current_vibe_score", -1).to_list(100)
    rank = next((i+1 for i, v in enumerate(all_area_venues) if v["id"] == venue_id), 0)
    
    # Wallet balance
    wallet = await db.merchant_wallets.find_one({"venue_id": venue_id}, {"_id": 0})
    
    return {
        "venue": venue,
        "stats": {
            "ratings_1h": ratings_1h,
            "ratings_24h": ratings_24h,
            "ratings_7d": ratings_7d,
            "profile_views": profile_views,
            "direction_clicks": direction_clicks,
            "current_rank": rank,
            "total_area_venues": len(all_area_venues)
        },
        "heatmap_delta": {
            "venue_score": venue.get("current_vibe_score", 0),
            "district_average": round(district_avg, 1),
            "delta": round(heatmap_delta, 1)
        },
        "pulse_drop_roi": pulse_drop_roi,
        "hourly_trend": hourly_scores,
        "competitors": competitors,
        "wallet_balance": wallet.get("balance", 0) if wallet else 0,
        "pulse_drop_tiers": PULSE_DROP_TIERS
    }

# ===== Super Admin Routes =====

@api_router.get("/admin/treasury")
async def get_global_treasury(request: Request, city: Optional[str] = None):
    """Get global treasury stats with Revenue Heatmap"""
    user = await get_current_user(request)
    if not user or not user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    now = datetime.now(timezone.utc)
    day_ago = now - timedelta(hours=24)
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)
    
    # Global stats
    total_revenue = await db.platform_revenue.aggregate([
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    
    today_revenue = await db.platform_revenue.aggregate([
        {"$match": {"timestamp": {"$gte": day_ago}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    
    # Revenue by city (Revenue Heatmap)
    city_revenue = await db.platform_revenue.aggregate([
        {"$match": {"timestamp": {"$gte": month_ago}}},
        {"$group": {
            "_id": "$city",
            "total": {"$sum": "$amount"},
            "count": {"$sum": 1}
        }}
    ]).to_list(10)
    
    # Revenue by tier
    tier_revenue = await db.platform_revenue.aggregate([
        {"$match": {"timestamp": {"$gte": month_ago}}},
        {"$group": {
            "_id": "$tier",
            "total": {"$sum": "$amount"},
            "count": {"$sum": 1}
        }}
    ]).to_list(10)
    
    # Network Health
    network_health = {
        "active_connections": len(connected_clients),
        "total_venues": await db.venues.count_documents({}),
        "verified_venues": await db.venues.count_documents({"is_verified": True}),
        "total_users": await db.users.count_documents({}),
        "active_users_24h": len(await db.ratings.distinct("user_id", {"timestamp": {"$gte": day_ago}}))
    }
    
    # Data Freshness
    hour_ago = now - timedelta(hours=1)
    recent_ratings = await db.ratings.count_documents({"timestamp": {"$gte": now - timedelta(minutes=15)}})
    total_hour_ratings = await db.ratings.count_documents({"timestamp": {"$gte": hour_ago}})
    data_freshness = (recent_ratings / total_hour_ratings * 100) if total_hour_ratings > 0 else 100
    
    return {
        "global": {
            "total_revenue": total_revenue[0]["total"] if total_revenue else 0,
            "today_revenue": today_revenue[0]["total"] if today_revenue else 0
        },
        "revenue_by_city": {item["_id"]: {"total": item["total"], "transactions": item["count"]} for item in city_revenue if item["_id"]},
        "revenue_by_tier": {item["_id"]: {"total": item["total"], "transactions": item["count"]} for item in tier_revenue if item["_id"]},
        "network_health": network_health,
        "data_freshness_percent": round(data_freshness, 1)
    }

@api_router.get("/admin/venues")
async def get_admin_venues(request: Request, city: Optional[str] = None, verified: Optional[bool] = None):
    user = await get_current_user(request)
    if not user or not user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    query = {}
    if city:
        query["city"] = city
    if verified is not None:
        query["is_verified"] = verified
    
    venues = await db.venues.find(query, {"_id": 0}).to_list(500)
    return venues

@api_router.post("/admin/venue/{venue_id}/verify")
async def verify_venue(venue_id: str, request: Request):
    user = await get_current_user(request)
    if not user or not user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    body = await request.json()
    verified = body.get("verified", True)
    reason = body.get("reason", "")
    
    await db.venues.update_one({"id": venue_id}, {"$set": {"is_verified": verified}})
    
    override = AdminOverride(
        venue_id=venue_id,
        admin_id=user["id"],
        override_type="verify" if verified else "unverify",
        reason=reason
    )
    await db.admin_overrides.insert_one(override.dict())
    
    return {"message": f"Venue {'verified' if verified else 'unverified'}"}

@api_router.post("/admin/venue/{venue_id}/override")
async def admin_override_venue(venue_id: str, request: Request):
    user = await get_current_user(request)
    if not user or not user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    body = await request.json()
    override_type = body.get("type")
    value = body.get("value")
    reason = body.get("reason", "")
    
    update_data = {}
    if override_type == "suppress":
        update_data["is_suppressed"] = True
    elif override_type == "unsuppress":
        update_data["is_suppressed"] = False
    elif override_type == "score_override":
        update_data["admin_override_score"] = value
    elif override_type == "clear_override":
        update_data["admin_override_score"] = None
        update_data["is_suppressed"] = False
    
    await db.venues.update_one({"id": venue_id}, {"$set": update_data})
    
    aggregate = await calculate_venue_aggregate(venue_id)
    await db.venues.update_one({"id": venue_id}, {"$set": aggregate})
    
    override = AdminOverride(
        venue_id=venue_id,
        admin_id=user["id"],
        override_type=override_type,
        override_value=value,
        reason=reason
    )
    await db.admin_overrides.insert_one(override.dict())
    
    await broadcast_venue_update(venue_id)
    
    return {"message": f"Override applied: {override_type}"}

@api_router.put("/admin/pulse-drop-pricing")
async def update_pulse_drop_pricing(request: Request):
    """Dynamically update Pulse Drop tier pricing"""
    user = await get_current_user(request)
    if not user or not user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    body = await request.json()
    tier = body.get("tier")
    new_price = body.get("price")
    
    if tier not in PULSE_DROP_TIERS:
        raise HTTPException(status_code=400, detail="Invalid tier")
    
    if new_price < 1000:
        raise HTTPException(status_code=400, detail="Minimum price is ₦1,000")
    
    # Store in DB for persistence
    await db.config.update_one(
        {"key": f"pulse_drop_price_{tier}"},
        {"$set": {"value": new_price}},
        upsert=True
    )
    
    # Update in-memory config
    PULSE_DROP_TIERS[tier]["price"] = new_price
    
    return {"message": f"{tier} price updated to ₦{new_price:,}"}

# ===== Paystack Webhook =====

@api_router.post("/webhook/paystack")
async def paystack_webhook(request: Request):
    """Handle Paystack webhook for payment verification"""
    signature = request.headers.get("x-paystack-signature", "")
    body = await request.body()
    
    if not verify_paystack_signature(body.decode(), signature):
        logger.warning("Invalid Paystack webhook signature")
        return JSONResponse(status_code=401, content={"status": "unauthorized"})
    
    payload = await request.json()
    
    if payload.get("event") == "charge.success":
        data = payload.get("data", {})
        reference = data.get("reference", "")
        
        if reference.startswith("VIBE-TOPUP-"):
            # Process wallet top-up
            await verify_wallet_topup(reference)
    
    return JSONResponse(status_code=200, content={"status": "ok"})

# ===== Seed Data Route =====

@api_router.post("/seed")
async def seed_data():
    """Seed Lagos venues for testing"""
    await db.venues.delete_many({})
    await db.ratings.delete_many({})
    await db.users.delete_many({})
    await db.pulse_drops.delete_many({})
    await db.platform_revenue.delete_many({})
    await db.merchant_wallets.delete_many({})
    await db.wallet_transactions.delete_many({})
    await db.admin_overrides.delete_many({})
    await db.user_sessions.delete_many({})
    
    venues_data = [
        {
            "name": "Club Quilox",
            "address": "50 Saka Tinubu Street, Victoria Island",
            "area": "Victoria Island",
            "city": "lagos",
            "venue_type": "club",
            "coordinates": {"lat": 6.4281, "lng": 3.4219},
            "current_vibe_score": 85,
            "energy_level": "electric",
            "capacity_level": "vibrant",
            "gate_level": "slow",
            "vibe_velocity": "heating_up",
            "is_featured": True,
            "is_verified": True,
            "profile_views": 1250,
            "direction_clicks": 340,
            "entry_fee": "₦20,000",
            "music_genre": "Afrobeats/Amapiano",
            "tables_available": True,
            "last_snapshot_time": datetime.now(timezone.utc) - timedelta(minutes=18)
        },
        {
            "name": "Hard Rock Cafe Lagos",
            "address": "Landmark Village, Victoria Island",
            "area": "Victoria Island",
            "city": "lagos",
            "venue_type": "restaurant",
            "coordinates": {"lat": 6.4235, "lng": 3.4452},
            "current_vibe_score": 72,
            "energy_level": "popping",
            "capacity_level": "vibrant",
            "gate_level": "clear",
            "vibe_velocity": "stable",
            "is_verified": True,
            "profile_views": 890,
            "direction_clicks": 210,
            "entry_fee": "Free Entry",
            "music_genre": "Rock/Pop",
            "tables_available": True,
            "last_snapshot_time": datetime.now(timezone.utc) - timedelta(minutes=35)
        },
        {
            "name": "Shiro Lagos",
            "address": "The Wheatbaker Hotel, Ikoyi",
            "area": "Ikoyi",
            "city": "lagos",
            "venue_type": "lounge",
            "coordinates": {"lat": 6.4502, "lng": 3.4378},
            "current_vibe_score": 68,
            "energy_level": "popping",
            "capacity_level": "sparse",
            "gate_level": "clear",
            "vibe_velocity": "cooling_down",
            "is_verified": True,
            "profile_views": 650,
            "direction_clicks": 180,
            "entry_fee": "₦15,000",
            "music_genre": "House/Deep House",
            "tables_available": True,
            "last_snapshot_time": datetime.now(timezone.utc) - timedelta(minutes=12)
        },
        {
            "name": "Backyard BBQ",
            "address": "32 Bourdillon Road, Ikoyi",
            "area": "Ikoyi",
            "city": "lagos",
            "venue_type": "restaurant",
            "coordinates": {"lat": 6.4521, "lng": 3.4342},
            "current_vibe_score": 55,
            "energy_level": "chill",
            "capacity_level": "sparse",
            "gate_level": "clear",
            "vibe_velocity": "stable",
            "profile_views": 320,
            "direction_clicks": 95,
            "entry_fee": "Free Entry",
            "music_genre": "R&B/Soul",
            "tables_available": True,
            "last_snapshot_time": datetime.now(timezone.utc) - timedelta(hours=1)
        },
        {
            "name": "The Blowfish Hotel",
            "address": "17 Oju Olobun Close, Ikoyi",
            "area": "Ikoyi",
            "city": "lagos",
            "venue_type": "lounge",
            "coordinates": {"lat": 6.4489, "lng": 3.4298},
            "current_vibe_score": 78,
            "energy_level": "popping",
            "capacity_level": "vibrant",
            "gate_level": "slow",
            "vibe_velocity": "heating_up",
            "is_featured": True,
            "is_verified": True,
            "profile_views": 980,
            "direction_clicks": 275,
            "entry_fee": "₦10,000 (Ladies Free)",
            "music_genre": "Amapiano/House",
            "tables_available": False,
            "last_snapshot_time": datetime.now(timezone.utc) - timedelta(minutes=8)
        },
        {
            "name": "Sky Restaurant & Lounge",
            "address": "Eko Hotel, Victoria Island",
            "area": "Victoria Island",
            "city": "lagos",
            "venue_type": "lounge",
            "coordinates": {"lat": 6.4253, "lng": 3.4168},
            "current_vibe_score": 62,
            "energy_level": "chill",
            "capacity_level": "vibrant",
            "gate_level": "clear",
            "vibe_velocity": "stable",
            "is_verified": True,
            "profile_views": 540,
            "direction_clicks": 145,
            "entry_fee": "₦5,000",
            "music_genre": "Jazz/Lounge",
            "tables_available": True,
            "last_snapshot_time": datetime.now(timezone.utc) - timedelta(minutes=45)
        },
        {
            "name": "DNA Nightclub",
            "address": "Plot 4 Ozumba Mbadiwe Ave, Victoria Island",
            "area": "Victoria Island",
            "city": "lagos",
            "venue_type": "club",
            "coordinates": {"lat": 6.4318, "lng": 3.4267},
            "current_vibe_score": 91,
            "energy_level": "electric",
            "capacity_level": "full",
            "gate_level": "blocked",
            "vibe_velocity": "heating_up",
            "is_featured": True,
            "is_verified": True,
            "profile_views": 2100,
            "direction_clicks": 580,
            "entry_fee": "₦30,000",
            "music_genre": "Amapiano/Afrobeats",
            "tables_available": False,
            "last_snapshot_time": datetime.now(timezone.utc) - timedelta(minutes=5)
        },
        {
            "name": "The Place Restaurant",
            "address": "9 Musa Yar'Adua Street, Victoria Island",
            "area": "Victoria Island",
            "city": "lagos",
            "venue_type": "restaurant",
            "coordinates": {"lat": 6.4298, "lng": 3.4198},
            "current_vibe_score": 45,
            "energy_level": "chill",
            "capacity_level": "sparse",
            "gate_level": "clear",
            "vibe_velocity": "cooling_down",
            "profile_views": 280,
            "direction_clicks": 70,
            "entry_fee": "Free Entry",
            "music_genre": "Highlife/Juju",
            "tables_available": True,
            "last_snapshot_time": datetime.now(timezone.utc) - timedelta(hours=2)
        },
        {
            "name": "Sailors Lounge",
            "address": "3 Akin Adesola Street, Victoria Island",
            "area": "Victoria Island",
            "city": "lagos",
            "venue_type": "lounge",
            "coordinates": {"lat": 6.4312, "lng": 3.4145},
            "current_vibe_score": 82,
            "energy_level": "electric",
            "capacity_level": "vibrant",
            "gate_level": "slow",
            "vibe_velocity": "stable",
            "is_verified": True,
            "profile_views": 1150,
            "direction_clicks": 310,
            "entry_fee": "₦15,000",
            "music_genre": "Hip-Hop/R&B",
            "tables_available": True,
            "last_snapshot_time": datetime.now(timezone.utc) - timedelta(minutes=22)
        },
        {
            "name": "Cubana Lagos",
            "address": "1 Adeola Odeku Street, Victoria Island",
            "area": "Victoria Island",
            "city": "lagos",
            "venue_type": "club",
            "coordinates": {"lat": 6.4289, "lng": 3.4232},
            "current_vibe_score": 76,
            "energy_level": "popping",
            "capacity_level": "vibrant",
            "gate_level": "slow",
            "vibe_velocity": "heating_up",
            "is_verified": True,
            "profile_views": 870,
            "direction_clicks": 230,
            "entry_fee": "₦10,000",
            "music_genre": "Afrobeats/Dancehall",
            "tables_available": True,
            "last_snapshot_time": datetime.now(timezone.utc) - timedelta(minutes=15)
        }
    ]
    
    for venue_data in venues_data:
        venue = Venue(**venue_data)
        await db.venues.insert_one(venue.dict())
        
        # Create merchant wallet for each venue
        wallet = MerchantWallet(
            merchant_id=venue.id,
            venue_id=venue.id,
            balance=25000  # Starting balance for testing
        )
        await db.merchant_wallets.insert_one(wallet.dict())
    
    # Create test user
    test_user = User(
        username="vibe_tester",
        phone="+2341234567890",
        email="test@vibe.app",
        name="Vibe Tester",
        clout_points=150,
        scout_status="regular",
        rating_accuracy_score=72.5,
        total_ratings=15
    )
    await db.users.insert_one(test_user.dict())
    
    # Create super admin
    admin_user = User(
        username="admin",
        phone="+2340000000000",
        email="admin@vibe.app",
        name="Super Admin",
        clout_points=0,
        scout_status="elite",
        is_admin=True,
        is_super_admin=True
    )
    await db.users.insert_one(admin_user.dict())
    
    return {
        "message": "Data seeded successfully",
        "venues_created": len(venues_data),
        "test_user_id": test_user.id,
        "admin_user_id": admin_user.id,
        "cities": list(CITIES.keys())
    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Socket.IO
app = socketio.ASGIApp(sio, app)
