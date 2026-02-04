from fastapi import FastAPI, APIRouter, HTTPException, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timedelta
import socketio
import math
import asyncio
from bson import ObjectId

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
app = FastAPI(title="Vibe App API", version="1.0.0")

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
    clout_points: int = 0
    scout_status: Literal["newbie", "regular", "scout", "elite"] = "newbie"
    rating_accuracy_score: float = 0.0
    total_ratings: int = 0
    fast_lane_passes: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)

class VenueCreate(BaseModel):
    name: str
    address: str
    area: str
    coordinates: Coordinates
    owner_id: Optional[str] = None

class Venue(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    address: str
    area: str
    coordinates: Coordinates
    current_vibe_score: float = 0.0
    energy_level: Literal["chill", "popping", "electric"] = "chill"
    capacity_level: Literal["sparse", "vibrant", "full"] = "sparse"
    gate_level: Literal["clear", "slow", "blocked"] = "clear"
    vibe_velocity: Literal["heating_up", "cooling_down", "stable"] = "stable"
    total_ratings_24h: int = 0
    owner_id: Optional[str] = None
    is_featured: bool = False
    photo_url: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class RatingCreate(BaseModel):
    user_id: str
    venue_id: str
    energy: Literal["chill", "popping", "electric"]
    capacity: Literal["sparse", "vibrant", "full"]
    gate: Literal["clear", "slow", "blocked"]
    photo_base64: Optional[str] = None
    coordinates: Coordinates  # For geofence verification

class Rating(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    venue_id: str
    energy: Literal["chill", "popping", "electric"]
    capacity: Literal["sparse", "vibrant", "full"]
    gate: Literal["clear", "slow", "blocked"]
    photo_base64: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    is_correction: bool = False
    vibe_score: float = 0.0

class CheckIn(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    venue_id: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    coordinates: Coordinates
    verified: bool = False

class CheckInCreate(BaseModel):
    user_id: str
    venue_id: str
    coordinates: Coordinates

class PulseDropCreate(BaseModel):
    venue_id: str
    message: str
    deal_type: Literal["discount", "free_entry", "vip_access", "special_event"]
    radius_km: float = 5.0
    duration_minutes: int = 60

class PulseDrop(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    venue_id: str
    venue_name: str = ""
    message: str
    deal_type: Literal["discount", "free_entry", "vip_access", "special_event"]
    radius_km: float = 5.0
    expires_at: datetime
    created_at: datetime = Field(default_factory=datetime.utcnow)

class LeaderboardEntry(BaseModel):
    venue: Venue
    rank: int
    trend: Literal["up", "down", "stable"]

# ===== Helper Functions =====

def calculate_vibe_score(energy: str, capacity: str, gate: str) -> float:
    """Calculate vibe score from rating components"""
    energy_scores = {"chill": 1, "popping": 2, "electric": 3}
    capacity_scores = {"sparse": 1, "vibrant": 2, "full": 3}
    gate_scores = {"clear": 3, "slow": 2, "blocked": 1}  # Clear is better
    
    total = energy_scores[energy] + capacity_scores[capacity] + gate_scores[gate]
    return (total / 9) * 100  # Normalize to 0-100

def calculate_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance in meters between two coordinates using Haversine formula"""
    R = 6371000  # Earth's radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lng2 - lng1)
    
    a = math.sin(delta_phi/2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c

def is_within_geofence(user_coords: Coordinates, venue_coords: Coordinates, radius_m: float = 50) -> bool:
    """Check if user is within geofence radius of venue"""
    distance = calculate_distance(
        user_coords.lat, user_coords.lng,
        venue_coords.lat, venue_coords.lng
    )
    return distance <= radius_m

async def calculate_venue_aggregate(venue_id: str) -> dict:
    """Calculate aggregated vibe data for a venue using time-decay algorithm"""
    now = datetime.utcnow()
    hour_ago = now - timedelta(hours=1)
    
    # Get ratings from last hour
    ratings = await db.ratings.find({
        "venue_id": venue_id,
        "timestamp": {"$gte": hour_ago}
    }).to_list(1000)
    
    if not ratings:
        return {
            "current_vibe_score": 0,
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
        
        minutes_ago = (now - rating_time).total_seconds() / 60
        
        # Time decay multiplier
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
        
        # Weighted voting for levels
        energy_counts[rating["energy"]] += weight
        capacity_counts[rating["capacity"]] += weight
        gate_counts[rating["gate"]] += weight
    
    # Calculate weighted average score
    total_weight = sum(w for _, w in weighted_scores)
    avg_score = sum(s * w for s, w in weighted_scores) / total_weight if total_weight > 0 else 0
    
    # Determine dominant levels
    energy_level = max(energy_counts, key=energy_counts.get)
    capacity_level = max(capacity_counts, key=capacity_counts.get)
    gate_level = max(gate_counts, key=gate_counts.get)
    
    # Calculate velocity (compare recent vs older ratings)
    recent_ratings = [r for r in ratings if (now - r.get("timestamp", now)).total_seconds() / 60 <= 15]
    older_ratings = [r for r in ratings if (now - r.get("timestamp", now)).total_seconds() / 60 > 15]
    
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
    
    # Count 24h ratings
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
    """Update user's clout based on rating accuracy"""
    venue = await db.venues.find_one({"id": venue_id})
    if not venue:
        return
    
    venue_avg = venue.get("current_vibe_score", 50)
    accuracy = 100 - abs(rating_score - venue_avg)
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        return
    
    # Update accuracy score (rolling average)
    total_ratings = user.get("total_ratings", 0)
    current_accuracy = user.get("rating_accuracy_score", 0)
    new_accuracy = ((current_accuracy * total_ratings) + accuracy) / (total_ratings + 1)
    
    # Calculate clout points
    clout_bonus = int(accuracy / 10)
    if venue.get("current_vibe_score", 0) > 70:  # Extra points for hot venues
        clout_bonus += 5
    
    new_clout = user.get("clout_points", 0) + clout_bonus
    new_total = total_ratings + 1
    
    # Determine scout status
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
    """Join a venue room for real-time updates"""
    venue_id = data.get('venue_id')
    if venue_id:
        await sio.enter_room(sid, f"venue_{venue_id}")
        logger.info(f"Client {sid} joined venue room: {venue_id}")

@sio.event
async def leave_venue(sid, data):
    """Leave a venue room"""
    venue_id = data.get('venue_id')
    if venue_id:
        await sio.leave_room(sid, f"venue_{venue_id}")
        logger.info(f"Client {sid} left venue room: {venue_id}")

@sio.event
async def subscribe_leaderboard(sid):
    """Subscribe to leaderboard updates"""
    await sio.enter_room(sid, "leaderboard")
    logger.info(f"Client {sid} subscribed to leaderboard")

async def broadcast_venue_update(venue_id: str):
    """Broadcast venue update to all clients in the room"""
    venue = await db.venues.find_one({"id": venue_id})
    if venue:
        venue["id"] = venue.get("id", str(venue.get("_id", "")))
        await sio.emit('venue_update', venue, room=f"venue_{venue_id}")

async def broadcast_leaderboard():
    """Broadcast updated leaderboard to all subscribers"""
    venues = await db.venues.find().sort("current_vibe_score", -1).to_list(50)
    leaderboard = []
    for i, v in enumerate(venues):
        v["id"] = v.get("id", str(v.get("_id", "")))
        leaderboard.append({
            "venue": v,
            "rank": i + 1,
            "trend": v.get("vibe_velocity", "stable")
        })
    await sio.emit('leaderboard_update', leaderboard, room="leaderboard")

# ===== API Routes =====

@api_router.get("/")
async def root():
    return {"message": "Vibe App API", "version": "1.0.0"}

@api_router.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

# User endpoints
@api_router.post("/users", response_model=User)
async def create_user(user_data: UserCreate):
    # Check if username exists
    existing = await db.users.find_one({"username": user_data.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    user = User(**user_data.dict())
    await db.users.insert_one(user.dict())
    return user

@api_router.get("/users/{user_id}", response_model=User)
async def get_user(user_id: str):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return User(**user)

@api_router.get("/users/phone/{phone}", response_model=User)
async def get_user_by_phone(phone: str):
    user = await db.users.find_one({"phone": phone})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return User(**user)

# Venue endpoints
@api_router.post("/venues", response_model=Venue)
async def create_venue(venue_data: VenueCreate):
    venue = Venue(**venue_data.dict())
    await db.venues.insert_one(venue.dict())
    return venue

@api_router.get("/venues", response_model=List[Venue])
async def get_venues(area: Optional[str] = None):
    query = {}
    if area:
        query["area"] = area
    venues = await db.venues.find(query).to_list(100)
    return [Venue(**v) for v in venues]

@api_router.get("/venues/{venue_id}", response_model=Venue)
async def get_venue(venue_id: str):
    venue = await db.venues.find_one({"id": venue_id})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")
    return Venue(**venue)

@api_router.get("/venues/nearby/{lat}/{lng}")
async def get_nearby_venues(lat: float, lng: float, radius_km: float = 5.0):
    """Get venues within radius of coordinates"""
    venues = await db.venues.find().to_list(100)
    nearby = []
    
    for v in venues:
        coords = v.get("coordinates", {})
        distance = calculate_distance(lat, lng, coords.get("lat", 0), coords.get("lng", 0))
        if distance <= radius_km * 1000:
            v["distance_m"] = round(distance)
            nearby.append(v)
    
    nearby.sort(key=lambda x: x.get("distance_m", 0))
    return nearby

# Rating endpoints
@api_router.post("/ratings")
async def create_rating(rating_data: RatingCreate):
    """Create or update a rating (2-rate limit per 24h)"""
    # Get venue for geofence check
    venue = await db.venues.find_one({"id": rating_data.venue_id})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")
    
    # Geofence verification
    venue_coords = Coordinates(**venue["coordinates"])
    if not is_within_geofence(rating_data.coordinates, venue_coords, radius_m=50):
        raise HTTPException(
            status_code=403, 
            detail="You must be at the venue to rate. Please get closer."
        )
    
    # Check 24h rating limit
    now = datetime.utcnow()
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
    
    # Calculate vibe score
    vibe_score = calculate_vibe_score(
        rating_data.energy, 
        rating_data.capacity, 
        rating_data.gate
    )
    
    # Create rating
    is_correction = len(existing_ratings) == 1
    rating = Rating(
        **rating_data.dict(exclude={"coordinates"}),
        vibe_score=vibe_score,
        is_correction=is_correction
    )
    
    # If correction, mark previous as superseded (but keep for history)
    if is_correction and existing_ratings:
        await db.ratings.update_one(
            {"id": existing_ratings[0]["id"]},
            {"$set": {"superseded": True}}
        )
    
    await db.ratings.insert_one(rating.dict())
    
    # Update venue aggregate
    aggregate = await calculate_venue_aggregate(rating_data.venue_id)
    await db.venues.update_one(
        {"id": rating_data.venue_id},
        {"$set": aggregate}
    )
    
    # Update user clout
    await update_user_clout(rating_data.user_id, rating_data.venue_id, vibe_score)
    
    # Broadcast updates via Socket.IO
    await broadcast_venue_update(rating_data.venue_id)
    await broadcast_leaderboard()
    
    return {
        "rating": rating.dict(),
        "is_correction": is_correction,
        "remaining_ratings": 1 if not is_correction else 0,
        "venue_vibe_score": aggregate["current_vibe_score"]
    }

@api_router.get("/ratings/venue/{venue_id}")
async def get_venue_ratings(venue_id: str, hours: int = 24):
    """Get ratings for a venue within specified hours"""
    cutoff = datetime.utcnow() - timedelta(hours=hours)
    ratings = await db.ratings.find({
        "venue_id": venue_id,
        "timestamp": {"$gte": cutoff},
        "superseded": {"$ne": True}
    }).sort("timestamp", -1).to_list(100)
    
    return ratings

@api_router.get("/ratings/user/{user_id}/venue/{venue_id}")
async def get_user_venue_ratings(user_id: str, venue_id: str):
    """Check user's rating status for a venue"""
    now = datetime.utcnow()
    day_ago = now - timedelta(hours=24)
    
    ratings = await db.ratings.find({
        "user_id": user_id,
        "venue_id": venue_id,
        "timestamp": {"$gte": day_ago}
    }).to_list(10)
    
    return {
        "ratings_count": len(ratings),
        "can_rate": len(ratings) < 2,
        "is_correction_available": len(ratings) == 1,
        "ratings": ratings
    }

# Check-in endpoints
@api_router.post("/checkins")
async def create_checkin(checkin_data: CheckInCreate):
    """Create a silent check-in with geofence verification"""
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

@api_router.get("/checkins/user/{user_id}")
async def get_user_checkins(user_id: str, hours: int = 24):
    """Get user's recent check-ins"""
    cutoff = datetime.utcnow() - timedelta(hours=hours)
    checkins = await db.checkins.find({
        "user_id": user_id,
        "timestamp": {"$gte": cutoff}
    }).sort("timestamp", -1).to_list(50)
    
    return checkins

# Leaderboard endpoints
@api_router.get("/leaderboard")
async def get_leaderboard(limit: int = 20):
    """Get live venue leaderboard sorted by vibe score"""
    venues = await db.venues.find().sort("current_vibe_score", -1).limit(limit).to_list(limit)
    
    leaderboard = []
    for i, v in enumerate(venues):
        leaderboard.append({
            "venue": Venue(**v).dict(),
            "rank": i + 1,
            "trend": "up" if v.get("vibe_velocity") == "heating_up" else 
                    "down" if v.get("vibe_velocity") == "cooling_down" else "stable"
        })
    
    return leaderboard

# Pulse Drops endpoints
@api_router.post("/pulse-drops")
async def create_pulse_drop(drop_data: PulseDropCreate):
    """Create a pulse drop (merchant feature)"""
    venue = await db.venues.find_one({"id": drop_data.venue_id})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")
    
    expires_at = datetime.utcnow() + timedelta(minutes=drop_data.duration_minutes)
    
    pulse_drop = PulseDrop(
        **drop_data.dict(exclude={"duration_minutes"}),
        venue_name=venue["name"],
        expires_at=expires_at
    )
    
    await db.pulse_drops.insert_one(pulse_drop.dict())
    
    # Broadcast to all connected clients
    await sio.emit('pulse_drop', {
        "drop": pulse_drop.dict(),
        "venue": venue
    })
    
    return pulse_drop

@api_router.get("/pulse-drops/nearby/{lat}/{lng}")
async def get_nearby_pulse_drops(lat: float, lng: float, radius_km: float = 5.0):
    """Get active pulse drops near location"""
    now = datetime.utcnow()
    
    # Get active drops
    drops = await db.pulse_drops.find({
        "expires_at": {"$gte": now}
    }).to_list(50)
    
    nearby_drops = []
    for drop in drops:
        venue = await db.venues.find_one({"id": drop["venue_id"]})
        if venue:
            coords = venue.get("coordinates", {})
            distance = calculate_distance(lat, lng, coords.get("lat", 0), coords.get("lng", 0))
            if distance <= drop.get("radius_km", 5) * 1000:
                drop["venue"] = venue
                drop["distance_m"] = round(distance)
                nearby_drops.append(drop)
    
    return nearby_drops

# Merchant Dashboard endpoints
@api_router.get("/merchant/venue/{venue_id}/stats")
async def get_venue_stats(venue_id: str):
    """Get detailed stats for venue owner"""
    venue = await db.venues.find_one({"id": venue_id})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")
    
    now = datetime.utcnow()
    hour_ago = now - timedelta(hours=1)
    day_ago = now - timedelta(hours=24)
    week_ago = now - timedelta(days=7)
    
    # Get rating counts
    ratings_1h = await db.ratings.count_documents({
        "venue_id": venue_id,
        "timestamp": {"$gte": hour_ago}
    })
    
    ratings_24h = await db.ratings.count_documents({
        "venue_id": venue_id,
        "timestamp": {"$gte": day_ago}
    })
    
    ratings_7d = await db.ratings.count_documents({
        "venue_id": venue_id,
        "timestamp": {"$gte": week_ago}
    })
    
    # Get check-in counts
    checkins_24h = await db.checkins.count_documents({
        "venue_id": venue_id,
        "timestamp": {"$gte": day_ago},
        "verified": True
    })
    
    # Get hourly trend data
    hourly_scores = []
    for h in range(24):
        start = now - timedelta(hours=h+1)
        end = now - timedelta(hours=h)
        ratings = await db.ratings.find({
            "venue_id": venue_id,
            "timestamp": {"$gte": start, "$lt": end}
        }).to_list(100)
        
        if ratings:
            avg_score = sum(r.get("vibe_score", 0) for r in ratings) / len(ratings)
        else:
            avg_score = 0
        
        hourly_scores.append({
            "hour": h,
            "score": round(avg_score, 1),
            "count": len(ratings)
        })
    
    return {
        "venue": Venue(**venue).dict(),
        "ratings_1h": ratings_1h,
        "ratings_24h": ratings_24h,
        "ratings_7d": ratings_7d,
        "checkins_24h": checkins_24h,
        "hourly_trend": hourly_scores,
        "current_rank": await get_venue_rank(venue_id)
    }

async def get_venue_rank(venue_id: str) -> int:
    """Get venue's current rank on leaderboard"""
    venues = await db.venues.find().sort("current_vibe_score", -1).to_list(100)
    for i, v in enumerate(venues):
        if v.get("id") == venue_id:
            return i + 1
    return 0

# Seed data endpoint
@api_router.post("/seed")
async def seed_data():
    """Seed Lagos venues for testing"""
    # Clear existing data
    await db.venues.delete_many({})
    await db.ratings.delete_many({})
    await db.users.delete_many({})
    await db.checkins.delete_many({})
    await db.pulse_drops.delete_many({})
    
    # Lagos venues (Victoria Island & Ikoyi)
    venues_data = [
        {
            "name": "Club Quilox",
            "address": "50 Saka Tinubu Street, Victoria Island",
            "area": "Victoria Island",
            "coordinates": {"lat": 6.4281, "lng": 3.4219},
            "current_vibe_score": 85,
            "energy_level": "electric",
            "capacity_level": "vibrant",
            "gate_level": "slow",
            "vibe_velocity": "heating_up",
            "is_featured": True
        },
        {
            "name": "Hard Rock Cafe Lagos",
            "address": "Landmark Village, Victoria Island",
            "area": "Victoria Island",
            "coordinates": {"lat": 6.4235, "lng": 3.4452},
            "current_vibe_score": 72,
            "energy_level": "popping",
            "capacity_level": "vibrant",
            "gate_level": "clear",
            "vibe_velocity": "stable"
        },
        {
            "name": "Shiro Lagos",
            "address": "The Wheatbaker Hotel, Ikoyi",
            "area": "Ikoyi",
            "coordinates": {"lat": 6.4502, "lng": 3.4378},
            "current_vibe_score": 68,
            "energy_level": "popping",
            "capacity_level": "sparse",
            "gate_level": "clear",
            "vibe_velocity": "cooling_down"
        },
        {
            "name": "Backyard BBQ",
            "address": "32 Bourdillon Road, Ikoyi",
            "area": "Ikoyi",
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
            "coordinates": {"lat": 6.4489, "lng": 3.4298},
            "current_vibe_score": 78,
            "energy_level": "popping",
            "capacity_level": "vibrant",
            "gate_level": "slow",
            "vibe_velocity": "heating_up",
            "is_featured": True
        },
        {
            "name": "Sky Restaurant & Lounge",
            "address": "Eko Hotel, Victoria Island",
            "area": "Victoria Island",
            "coordinates": {"lat": 6.4253, "lng": 3.4168},
            "current_vibe_score": 62,
            "energy_level": "chill",
            "capacity_level": "vibrant",
            "gate_level": "clear",
            "vibe_velocity": "stable"
        },
        {
            "name": "DNA Nightclub",
            "address": "Plot 4 Ozumba Mbadiwe Ave, Victoria Island",
            "area": "Victoria Island",
            "coordinates": {"lat": 6.4318, "lng": 3.4267},
            "current_vibe_score": 91,
            "energy_level": "electric",
            "capacity_level": "full",
            "gate_level": "blocked",
            "vibe_velocity": "heating_up",
            "is_featured": True
        },
        {
            "name": "The Place Restaurant",
            "address": "9 Musa Yar'Adua Street, Victoria Island",
            "area": "Victoria Island",
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
            "coordinates": {"lat": 6.4312, "lng": 3.4145},
            "current_vibe_score": 82,
            "energy_level": "electric",
            "capacity_level": "vibrant",
            "gate_level": "slow",
            "vibe_velocity": "stable"
        },
        {
            "name": "Cubana Lagos",
            "address": "1 Adeola Odeku Street, Victoria Island",
            "area": "Victoria Island",
            "coordinates": {"lat": 6.4289, "lng": 3.4232},
            "current_vibe_score": 76,
            "energy_level": "popping",
            "capacity_level": "vibrant",
            "gate_level": "slow",
            "vibe_velocity": "heating_up"
        }
    ]
    
    # Create venues
    for venue_data in venues_data:
        venue = Venue(**venue_data)
        await db.venues.insert_one(venue.dict())
    
    # Create test user
    test_user = User(
        username="vibe_tester",
        phone="+2341234567890",
        clout_points=150,
        scout_status="regular",
        rating_accuracy_score=72.5,
        total_ratings=15
    )
    await db.users.insert_one(test_user.dict())
    
    return {
        "message": "Data seeded successfully",
        "venues_created": len(venues_data),
        "test_user_id": test_user.id
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

@sio.event
async def shutdown_db_client():
    client.close()
