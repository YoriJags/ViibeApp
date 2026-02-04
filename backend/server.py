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

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'vibe_app')]

# Create Socket.IO server
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    logger=True,
    engineio_logger=True
)

# Create the main FastAPI app
app = FastAPI(title="Vibe App API", version="2.0.0")

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
PLATFORM_FEE_PERCENT = 10
VENUE_SHARE_PERCENT = 90

PULSE_DROP_TIERS = {
    "spark": {
        "name": "Spark",
        "price": 5000,  # NGN
        "radius_km": 2,
        "glow_boost": 20,
        "chart_placement": None,
        "duration_hours": 2
    },
    "flare": {
        "name": "Flare",
        "price": 15000,  # NGN
        "radius_km": 5,
        "glow_boost": 40,
        "chart_placement": 3,  # Top 3
        "duration_hours": 4
    },
    "supernova": {
        "name": "Supernova",
        "price": 50000,  # NGN
        "radius_km": 50,  # City-wide
        "glow_boost": 100,
        "chart_placement": 1,  # #1 Trending
        "duration_hours": 8,
        "custom_icon": True
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
    fast_lane_passes: int = 0
    fast_passes_purchased: List[str] = []  # venue_ids
    home_city: str = "lagos"
    is_admin: bool = False
    is_super_admin: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class VenueCreate(BaseModel):
    name: str
    address: str
    area: str
    city: str = "lagos"
    venue_type: Literal["club", "lounge", "restaurant", "bar"] = "club"
    coordinates: Coordinates
    owner_id: Optional[str] = None
    fast_pass_enabled: bool = False
    fast_pass_price: float = 0

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
    # Fast Pass
    fast_pass_enabled: bool = False
    fast_pass_price: float = 5000  # NGN
    fast_passes_sold_today: int = 0
    # Pulse Drop
    active_pulse_tier: Optional[Literal["spark", "flare", "supernova"]] = None
    pulse_expires_at: Optional[datetime] = None
    custom_icon: Optional[str] = None
    glow_boost: float = 0
    # Override
    admin_override_score: Optional[float] = None
    is_suppressed: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class RatingCreate(BaseModel):
    user_id: str
    venue_id: str
    energy: Literal["chill", "popping", "electric"]
    capacity: Literal["sparse", "vibrant", "full"]
    gate: Literal["clear", "slow", "blocked"]
    photo_base64: Optional[str] = None
    coordinates: Coordinates

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

class CheckIn(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    venue_id: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    coordinates: Coordinates
    verified: bool = False

class CheckInCreate(BaseModel):
    user_id: str
    venue_id: str
    coordinates: Coordinates

class PulseDropCreate(BaseModel):
    venue_id: str
    tier: Literal["spark", "flare", "supernova"]
    message: str

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
    platform_fee: float
    venue_share: float
    city: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class FastPassPurchase(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    venue_id: str
    venue_name: str
    price: float
    platform_fee: float
    venue_share: float
    city: str
    valid_date: datetime
    qr_code: str
    is_used: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Transaction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: Literal["fast_pass", "pulse_drop"]
    venue_id: str
    venue_name: str
    user_id: Optional[str] = None
    amount: float
    platform_fee: float
    venue_share: float
    city: str
    tier: Optional[str] = None  # For pulse drops
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AdminOverride(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    venue_id: str
    admin_id: str
    override_type: Literal["boost", "suppress", "verify", "unverify", "score_override"]
    override_value: Optional[float] = None
    reason: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ===== Auth Models =====
class UserSession(BaseModel):
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

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

async def calculate_venue_aggregate(venue_id: str) -> dict:
    now = datetime.now(timezone.utc)
    hour_ago = now - timedelta(hours=1)
    
    venue = await db.venues.find_one({"id": venue_id})
    if not venue:
        return {}
    
    # Check if suppressed
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
    recent_ratings = [r for r in ratings if (now - r.get("timestamp", now).replace(tzinfo=timezone.utc) if r.get("timestamp", now).tzinfo is None else (now - r.get("timestamp", now))).total_seconds() / 60 <= 15]
    older_ratings = [r for r in ratings if (now - r.get("timestamp", now).replace(tzinfo=timezone.utc) if r.get("timestamp", now).tzinfo is None else (now - r.get("timestamp", now))).total_seconds() / 60 > 15]
    
    if recent_ratings and older_ratings:
        recent_avg = sum(r.get("vibe_score", 50) for r in recent_ratings) / len(recent_ratings)
        older_avg = sum(r.get("vibe_score", 50) for r in older_ratings) / len(older_ratings)
        
        if recent_avg > older_avg + 10:
            velocity = "heating_up"
        elif recent_avg < older_avg - 10:
            velocity = "cooling_down"
        else:
            velocity = "stable"
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
        passes = 3
    elif new_accuracy >= 70 and new_total >= 20:
        status = "scout"
        passes = 1
    elif new_total >= 10:
        status = "regular"
        passes = 0
    else:
        status = "newbie"
        passes = 0
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "rating_accuracy_score": round(new_accuracy, 1),
            "total_ratings": new_total,
            "clout_points": new_clout,
            "scout_status": status,
            "fast_lane_passes": user.get("fast_lane_passes", 0) + passes
        }}
    )

async def get_current_user(request: Request) -> Optional[dict]:
    """Get current user from session token"""
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

@sio.event
async def connect(sid, environ):
    logger.info(f"Client connected: {sid}")
    await sio.emit('connection_status', {'status': 'connected'}, to=sid)

@sio.event
async def disconnect(sid):
    logger.info(f"Client disconnected: {sid}")

@sio.event
async def join_venue(sid, data):
    venue_id = data.get('venue_id')
    if venue_id:
        await sio.enter_room(sid, f"venue_{venue_id}")
        logger.info(f"Client {sid} joined venue room: {venue_id}")

@sio.event
async def leave_venue(sid, data):
    venue_id = data.get('venue_id')
    if venue_id:
        await sio.leave_room(sid, f"venue_{venue_id}")

@sio.event
async def join_city(sid, data):
    city = data.get('city', 'lagos')
    await sio.enter_room(sid, f"city_{city}")
    logger.info(f"Client {sid} joined city room: {city}")

@sio.event
async def subscribe_leaderboard(sid, data=None):
    city = data.get('city', 'all') if data else 'all'
    await sio.enter_room(sid, f"leaderboard_{city}")
    logger.info(f"Client {sid} subscribed to leaderboard: {city}")

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
    return {"message": "Vibe App API", "version": "2.0.0"}

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
    
    # Call Emergent auth to get user data
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
    
    # Check if user exists
    existing_user = await db.users.find_one({"email": email}, {"_id": 0})
    
    if existing_user:
        user_id = existing_user["id"]
        # Update user info
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"name": name, "picture": picture}}
        )
    else:
        # Create new user
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
    
    # Create session
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    session = UserSession(
        user_id=user_id,
        session_token=session_token,
        expires_at=expires_at
    )
    await db.user_sessions.insert_one(session.dict())
    
    # Set cookie
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
    """Get current authenticated user"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout user"""
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out"}

# ===== User Routes =====

@api_router.post("/users", response_model=User)
async def create_user(user_data: UserCreate):
    existing = await db.users.find_one({"username": user_data.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    user = User(**user_data.dict())
    await db.users.insert_one(user.dict())
    return user

@api_router.get("/users/{user_id}")
async def get_user(user_id: str):
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@api_router.get("/users/phone/{phone}")
async def get_user_by_phone(phone: str):
    user = await db.users.find_one({"phone": phone}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

# ===== City Routes =====

@api_router.get("/cities")
async def get_cities():
    """Get all available cities"""
    return list(CITIES.values())

@api_router.get("/cities/{city_code}")
async def get_city(city_code: str):
    """Get city details"""
    if city_code not in CITIES:
        raise HTTPException(status_code=404, detail="City not found")
    return CITIES[city_code]

# ===== Venue Routes =====

@api_router.post("/venues")
async def create_venue(venue_data: VenueCreate):
    venue = Venue(**venue_data.dict())
    await db.venues.insert_one(venue.dict())
    return venue

@api_router.get("/venues")
async def get_venues(city: Optional[str] = None, area: Optional[str] = None, venue_type: Optional[str] = None):
    query = {}
    if city:
        query["city"] = city
    if area:
        query["area"] = area
    if venue_type:
        query["venue_type"] = venue_type
    
    venues = await db.venues.find(query, {"_id": 0}).to_list(100)
    return venues

@api_router.get("/venues/{venue_id}")
async def get_venue(venue_id: str):
    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")
    return venue

@api_router.get("/venues/nearby/{lat}/{lng}")
async def get_nearby_venues(lat: float, lng: float, radius_km: float = 5.0, city: Optional[str] = None):
    query = {"city": city} if city else {}
    venues = await db.venues.find(query, {"_id": 0}).to_list(100)
    nearby = []
    
    for v in venues:
        coords = v.get("coordinates", {})
        distance = calculate_distance(lat, lng, coords.get("lat", 0), coords.get("lng", 0))
        if distance <= radius_km * 1000:
            v["distance_m"] = round(distance)
            nearby.append(v)
    
    nearby.sort(key=lambda x: x.get("distance_m", 0))
    return nearby

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
        **rating_data.dict(exclude={"coordinates"}),
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

@api_router.get("/ratings/venue/{venue_id}")
async def get_venue_ratings(venue_id: str, hours: int = 24):
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    ratings = await db.ratings.find({
        "venue_id": venue_id,
        "timestamp": {"$gte": cutoff},
        "superseded": {"$ne": True}
    }, {"_id": 0}).sort("timestamp", -1).to_list(100)
    return ratings

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

# ===== Check-in Routes =====

@api_router.post("/checkins")
async def create_checkin(checkin_data: CheckInCreate):
    venue = await db.venues.find_one({"id": checkin_data.venue_id})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")
    
    venue_coords = Coordinates(**venue["coordinates"])
    verified = is_within_geofence(checkin_data.coordinates, venue_coords)
    
    checkin = CheckIn(
        **checkin_data.dict(),
        verified=verified
    )
    await db.checkins.insert_one(checkin.dict())
    
    return {
        "checkin": checkin.dict(),
        "verified": verified,
        "can_rate": verified,
        "message": "Check-in verified! You can now rate this venue." if verified else "You're not close enough to check in."
    }

# ===== Leaderboard Routes =====

@api_router.get("/leaderboard")
async def get_leaderboard(city: Optional[str] = None, limit: int = 20):
    """Get live venue leaderboard sorted by vibe score"""
    query = {"is_suppressed": {"$ne": True}}
    if city:
        query["city"] = city
    
    # Get venues with active pulse drop boosts first
    now = datetime.now(timezone.utc)
    venues = await db.venues.find(query, {"_id": 0}).to_list(100)
    
    # Sort by chart placement (if active) then by score
    def sort_key(v):
        # Check if pulse drop is active and has chart placement
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
    """Get national trending chart across all cities"""
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

# ===== Fast Pass Routes =====

@api_router.get("/fast-pass/venues")
async def get_fast_pass_venues(city: Optional[str] = None):
    """Get venues with fast pass enabled"""
    query = {"fast_pass_enabled": True}
    if city:
        query["city"] = city
    
    venues = await db.venues.find(query, {"_id": 0}).to_list(100)
    return venues

@api_router.post("/fast-pass/purchase")
async def purchase_fast_pass(request: Request):
    """Purchase a fast pass for a venue"""
    body = await request.json()
    user_id = body.get("user_id")
    venue_id = body.get("venue_id")
    
    venue = await db.venues.find_one({"id": venue_id})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")
    
    if not venue.get("fast_pass_enabled"):
        raise HTTPException(status_code=400, detail="Fast pass not available for this venue")
    
    price = venue.get("fast_pass_price", 5000)
    platform_fee = price * (PLATFORM_FEE_PERCENT / 100)
    venue_share = price * (VENUE_SHARE_PERCENT / 100)
    
    # Create purchase record
    purchase = FastPassPurchase(
        user_id=user_id,
        venue_id=venue_id,
        venue_name=venue["name"],
        price=price,
        platform_fee=platform_fee,
        venue_share=venue_share,
        city=venue.get("city", "lagos"),
        valid_date=datetime.now(timezone.utc),
        qr_code=f"FP-{uuid.uuid4().hex[:8].upper()}"
    )
    await db.fast_passes.insert_one(purchase.dict())
    
    # Create transaction record
    transaction = Transaction(
        type="fast_pass",
        venue_id=venue_id,
        venue_name=venue["name"],
        user_id=user_id,
        amount=price,
        platform_fee=platform_fee,
        venue_share=venue_share,
        city=venue.get("city", "lagos")
    )
    await db.transactions.insert_one(transaction.dict())
    
    # Update venue fast pass count
    await db.venues.update_one(
        {"id": venue_id},
        {"$inc": {"fast_passes_sold_today": 1}}
    )
    
    # Update user's purchased passes
    await db.users.update_one(
        {"id": user_id},
        {"$push": {"fast_passes_purchased": venue_id}}
    )
    
    return purchase.dict()

@api_router.get("/fast-pass/user/{user_id}")
async def get_user_fast_passes(user_id: str):
    """Get user's fast passes"""
    passes = await db.fast_passes.find({"user_id": user_id, "is_used": False}, {"_id": 0}).to_list(100)
    return passes

# ===== Pulse Drop Routes =====

@api_router.get("/pulse-drops/tiers")
async def get_pulse_drop_tiers():
    """Get available pulse drop tiers and pricing"""
    return PULSE_DROP_TIERS

@api_router.post("/pulse-drops/purchase")
async def purchase_pulse_drop(drop_data: PulseDropCreate, request: Request):
    """Purchase and activate a pulse drop"""
    venue = await db.venues.find_one({"id": drop_data.venue_id})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")
    
    tier_config = PULSE_DROP_TIERS.get(drop_data.tier)
    if not tier_config:
        raise HTTPException(status_code=400, detail="Invalid tier")
    
    price = tier_config["price"]
    platform_fee = price * (PLATFORM_FEE_PERCENT / 100)
    venue_share = price * (VENUE_SHARE_PERCENT / 100)
    
    expires_at = datetime.now(timezone.utc) + timedelta(hours=tier_config["duration_hours"])
    
    # Create pulse drop
    pulse_drop = PulseDrop(
        venue_id=drop_data.venue_id,
        venue_name=venue["name"],
        tier=drop_data.tier,
        message=drop_data.message,
        radius_km=tier_config["radius_km"],
        glow_boost=tier_config["glow_boost"],
        chart_placement=tier_config.get("chart_placement"),
        price_paid=price,
        platform_fee=platform_fee,
        venue_share=venue_share,
        city=venue.get("city", "lagos"),
        expires_at=expires_at
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
    
    # Create transaction
    transaction = Transaction(
        type="pulse_drop",
        venue_id=drop_data.venue_id,
        venue_name=venue["name"],
        amount=price,
        platform_fee=platform_fee,
        venue_share=venue_share,
        city=venue.get("city", "lagos"),
        tier=drop_data.tier
    )
    await db.transactions.insert_one(transaction.dict())
    
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
    
    return pulse_drop.dict()

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
    """Get detailed stats for venue owner"""
    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")
    
    now = datetime.now(timezone.utc)
    hour_ago = now - timedelta(hours=1)
    day_ago = now - timedelta(hours=24)
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)
    
    # Rating stats
    ratings_1h = await db.ratings.count_documents({"venue_id": venue_id, "timestamp": {"$gte": hour_ago}})
    ratings_24h = await db.ratings.count_documents({"venue_id": venue_id, "timestamp": {"$gte": day_ago}})
    ratings_7d = await db.ratings.count_documents({"venue_id": venue_id, "timestamp": {"$gte": week_ago}})
    
    # Check-in stats
    checkins_24h = await db.checkins.count_documents({"venue_id": venue_id, "timestamp": {"$gte": day_ago}, "verified": True})
    
    # Revenue stats
    fast_pass_revenue = await db.transactions.aggregate([
        {"$match": {"venue_id": venue_id, "type": "fast_pass", "timestamp": {"$gte": month_ago}}},
        {"$group": {"_id": None, "total": {"$sum": "$venue_share"}}}
    ]).to_list(1)
    
    pulse_drop_revenue = await db.transactions.aggregate([
        {"$match": {"venue_id": venue_id, "type": "pulse_drop", "timestamp": {"$gte": month_ago}}},
        {"$group": {"_id": None, "total": {"$sum": "$venue_share"}}}
    ]).to_list(1)
    
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
    
    # Competition - top 5 venues in same city
    competitors = await db.venues.find(
        {"city": venue.get("city"), "id": {"$ne": venue_id}},
        {"_id": 0}
    ).sort("current_vibe_score", -1).limit(5).to_list(5)
    
    # Get venue rank
    all_city_venues = await db.venues.find({"city": venue.get("city")}, {"_id": 0}).sort("current_vibe_score", -1).to_list(100)
    rank = next((i+1 for i, v in enumerate(all_city_venues) if v["id"] == venue_id), 0)
    
    return {
        "venue": venue,
        "stats": {
            "ratings_1h": ratings_1h,
            "ratings_24h": ratings_24h,
            "ratings_7d": ratings_7d,
            "checkins_24h": checkins_24h,
            "current_rank": rank,
            "total_city_venues": len(all_city_venues)
        },
        "revenue": {
            "fast_pass_30d": fast_pass_revenue[0]["total"] if fast_pass_revenue else 0,
            "pulse_drop_30d": pulse_drop_revenue[0]["total"] if pulse_drop_revenue else 0,
            "fast_passes_sold_today": venue.get("fast_passes_sold_today", 0)
        },
        "hourly_trend": hourly_scores,
        "competitors": competitors,
        "pulse_drop_tiers": PULSE_DROP_TIERS
    }

@api_router.put("/merchant/venue/{venue_id}/fast-pass")
async def update_fast_pass_settings(venue_id: str, request: Request):
    """Update fast pass settings for a venue"""
    body = await request.json()
    venue = await db.venues.find_one({"id": venue_id})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")
    
    update_data = {}
    if "enabled" in body:
        update_data["fast_pass_enabled"] = body["enabled"]
    if "price" in body:
        update_data["fast_pass_price"] = body["price"]
    
    await db.venues.update_one({"id": venue_id}, {"$set": update_data})
    return {"message": "Fast pass settings updated"}

# ===== Super Admin Routes =====

@api_router.get("/admin/treasury")
async def get_global_treasury(request: Request):
    """Get global treasury stats (super admin only)"""
    user = await get_current_user(request)
    if not user or not user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    now = datetime.now(timezone.utc)
    day_ago = now - timedelta(hours=24)
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)
    
    # Global stats
    total_revenue = await db.transactions.aggregate([
        {"$group": {"_id": None, "total": {"$sum": "$amount"}, "platform": {"$sum": "$platform_fee"}}}
    ]).to_list(1)
    
    today_revenue = await db.transactions.aggregate([
        {"$match": {"timestamp": {"$gte": day_ago}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}, "platform": {"$sum": "$platform_fee"}}}
    ]).to_list(1)
    
    # Revenue by city
    city_revenue = await db.transactions.aggregate([
        {"$match": {"timestamp": {"$gte": month_ago}}},
        {"$group": {"_id": "$city", "total": {"$sum": "$amount"}, "platform": {"$sum": "$platform_fee"}, "count": {"$sum": 1}}}
    ]).to_list(10)
    
    # Revenue by type
    type_revenue = await db.transactions.aggregate([
        {"$match": {"timestamp": {"$gte": month_ago}}},
        {"$group": {"_id": "$type", "total": {"$sum": "$amount"}, "platform": {"$sum": "$platform_fee"}, "count": {"$sum": 1}}}
    ]).to_list(10)
    
    # Venue stats
    total_venues = await db.venues.count_documents({})
    verified_venues = await db.venues.count_documents({"is_verified": True})
    
    # User stats
    total_users = await db.users.count_documents({})
    active_users_24h = await db.ratings.distinct("user_id", {"timestamp": {"$gte": day_ago}})
    
    return {
        "global": {
            "total_revenue": total_revenue[0]["total"] if total_revenue else 0,
            "platform_revenue": total_revenue[0]["platform"] if total_revenue else 0,
            "today_revenue": today_revenue[0]["total"] if today_revenue else 0,
            "today_platform": today_revenue[0]["platform"] if today_revenue else 0
        },
        "by_city": {item["_id"]: {"total": item["total"], "platform": item["platform"], "transactions": item["count"]} for item in city_revenue},
        "by_type": {item["_id"]: {"total": item["total"], "platform": item["platform"], "transactions": item["count"]} for item in type_revenue},
        "venues": {
            "total": total_venues,
            "verified": verified_venues
        },
        "users": {
            "total": total_users,
            "active_24h": len(active_users_24h)
        }
    }

@api_router.get("/admin/venues")
async def get_admin_venues(request: Request, city: Optional[str] = None, verified: Optional[bool] = None):
    """Get all venues for admin management"""
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
    """Verify a venue (super admin only)"""
    user = await get_current_user(request)
    if not user or not user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    body = await request.json()
    verified = body.get("verified", True)
    reason = body.get("reason", "")
    
    await db.venues.update_one({"id": venue_id}, {"$set": {"is_verified": verified}})
    
    # Log override
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
    """Apply admin override to venue (anti-spam, score adjustment)"""
    user = await get_current_user(request)
    if not user or not user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    body = await request.json()
    override_type = body.get("type")  # boost, suppress, score_override
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
    
    # Recalculate venue
    aggregate = await calculate_venue_aggregate(venue_id)
    await db.venues.update_one({"id": venue_id}, {"$set": aggregate})
    
    # Log override
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

@api_router.get("/admin/overrides")
async def get_admin_overrides(request: Request, limit: int = 50):
    """Get recent admin overrides"""
    user = await get_current_user(request)
    if not user or not user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    overrides = await db.admin_overrides.find({}, {"_id": 0}).sort("timestamp", -1).limit(limit).to_list(limit)
    return overrides

# ===== Seed Data Route =====

@api_router.post("/seed")
async def seed_data():
    """Seed Lagos venues for testing"""
    await db.venues.delete_many({})
    await db.ratings.delete_many({})
    await db.users.delete_many({})
    await db.checkins.delete_many({})
    await db.pulse_drops.delete_many({})
    await db.transactions.delete_many({})
    await db.fast_passes.delete_many({})
    await db.admin_overrides.delete_many({})
    await db.user_sessions.delete_many({})
    
    # Lagos venues (Victoria Island & Ikoyi)
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
            "fast_pass_enabled": True,
            "fast_pass_price": 10000
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
            "fast_pass_enabled": True,
            "fast_pass_price": 5000
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
            "is_verified": True
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
            "vibe_velocity": "stable"
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
            "fast_pass_enabled": True,
            "fast_pass_price": 7500
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
            "is_verified": True
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
            "fast_pass_enabled": True,
            "fast_pass_price": 15000
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
            "vibe_velocity": "cooling_down"
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
            "fast_pass_enabled": True,
            "fast_pass_price": 8000
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
            "is_verified": True
        }
    ]
    
    for venue_data in venues_data:
        venue = Venue(**venue_data)
        await db.venues.insert_one(venue.dict())
    
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
