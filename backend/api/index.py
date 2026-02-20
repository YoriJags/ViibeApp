"""
Vercel Serverless Function Entry Point
Uses BaseHTTPRequestHandler (Vercel's native Python handler)
instead of FastAPI to avoid Vercel runtime issubclass bug.
"""
from http.server import BaseHTTPRequestHandler
import json
import os
import uuid
import math
import re
import logging
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse, parse_qs

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ========================
# MongoDB (sync via pymongo)
# ========================
_db = None

def get_db():
    global _db
    if _db is None:
        try:
            from pymongo import MongoClient
            mongo_url = os.environ.get('MONGO_URL')
            if not mongo_url:
                logger.error("MONGO_URL not set")
                return None
            client = MongoClient(mongo_url)
            db_name = os.environ.get('DB_NAME', 'vibe_app')
            _db = client[db_name]
            logger.info(f"Connected to MongoDB: {db_name}")
        except Exception as e:
            logger.error(f"MongoDB connection failed: {e}")
            return None
    return _db

# ========================
# Helper Functions
# ========================

def json_serial(obj):
    """JSON serializer for datetime objects."""
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")

def calculate_vibe_score(energy, capacity, gate):
    energy_scores = {"electric": 95, "popping": 75, "chill": 50, "dead": 20}
    capacity_scores = {"packed": 90, "vibrant": 70, "sparse": 45, "empty": 15}
    gate_scores = {"clear": 100, "slow": 60, "blocked": 30}
    score = (
        energy_scores.get(energy, 50) * 0.5 +
        capacity_scores.get(capacity, 50) * 0.3 +
        gate_scores.get(gate, 50) * 0.2
    )
    return int(score)

def get_energy_level(score):
    if score >= 80: return "electric"
    if score >= 60: return "popping"
    if score >= 40: return "chill"
    return "dead"

def calculate_distance(lat1, lng1, lat2, lng2):
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp/2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dl/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

def get_scout_tier_color(status):
    return {"elite": "#FFD700", "scout": "#C0C0C0", "regular": "#CD7F32"}.get(status, "#94A3B8")

def get_current_user(headers):
    db = get_db()
    if not db:
        return None
    token = None
    auth = headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
    if not token:
        return None
    session = db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        return None
    expires_at = session.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at and expires_at < datetime.now(timezone.utc):
        return None
    return db.users.find_one({"id": session["user_id"]}, {"_id": 0})

# ========================
# Route Handlers
# ========================

def handle_root():
    return 200, {"name": "Vibe Scout API", "version": "3.0.0", "status": "running"}

def handle_health():
    db = get_db()
    return 200, {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "platform": "vercel",
        "database": "connected" if db else "disconnected"
    }

def handle_get_cities():
    return 200, [
        {"name": "Lagos", "code": "lagos", "center": {"lat": 6.5244, "lng": 3.3792}, "radius_km": 50},
        {"name": "Abuja", "code": "abuja", "center": {"lat": 9.0579, "lng": 7.4951}, "radius_km": 40},
        {"name": "Port Harcourt", "code": "port_harcourt", "center": {"lat": 4.8156, "lng": 7.0498}, "radius_km": 30},
        {"name": "Ibadan", "code": "ibadan", "center": {"lat": 7.3775, "lng": 3.9470}, "radius_km": 35}
    ]

def handle_get_venues(query_params):
    db = get_db()
    if not db:
        return 503, {"detail": "Database unavailable"}
    query = {}
    city = query_params.get("city", [None])[0]
    if city:
        query["city"] = city.lower()
    venues = list(db.venues.find(query, {"_id": 0}).limit(100))
    return 200, venues

def handle_get_venue(venue_id):
    db = get_db()
    if not db:
        return 503, {"detail": "Database unavailable"}
    venue = db.venues.find_one({"id": venue_id}, {"_id": 0})
    if not venue:
        return 404, {"detail": "Venue not found"}
    return 200, venue

def handle_get_user(user_id):
    db = get_db()
    if not db:
        return 503, {"detail": "Database unavailable"}
    user = db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        return 404, {"detail": "User not found"}
    return 200, user

def handle_create_user(body):
    db = get_db()
    if not db:
        return 503, {"detail": "Database unavailable"}
    # Check if phone already exists
    existing = db.users.find_one({"phone": body.get("phone")}, {"_id": 0})
    if existing:
        # Return existing user with session
        session_token = str(uuid.uuid4())
        db.user_sessions.insert_one({
            "user_id": existing["id"],
            "session_token": session_token,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=30),
            "created_at": datetime.now(timezone.utc)
        })
        existing["session_token"] = session_token
        return 200, existing

    user_id = str(uuid.uuid4())
    user = {
        "id": user_id,
        "username": body.get("username", ""),
        "phone": body.get("phone", ""),
        "home_city": body.get("home_city", "lagos"),
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
    db.users.insert_one({**user, "_id": None})
    # Clean up _id
    user.pop("_id", None)

    # Create session
    session_token = str(uuid.uuid4())
    db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=30),
        "created_at": datetime.now(timezone.utc)
    })
    user["session_token"] = session_token
    return 200, user

def handle_auth_session(body):
    """Handle Google OAuth session exchange."""
    db = get_db()
    if not db:
        return 503, {"detail": "Database unavailable"}
    session_id = body.get("session_id")
    if not session_id:
        return 400, {"detail": "session_id required"}
    # Exchange with auth provider
    try:
        import urllib.request
        req = urllib.request.Request(
            f"https://auth.emergentagent.com/api/auth/session?session_id={session_id}"
        )
        with urllib.request.urlopen(req) as resp:
            auth_data = json.loads(resp.read())
    except Exception as e:
        return 400, {"detail": f"Auth exchange failed: {str(e)}"}

    email = auth_data.get("email")
    if not email:
        return 400, {"detail": "No email from auth provider"}

    # Find or create user
    user = db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        user_id = str(uuid.uuid4())
        user = {
            "id": user_id,
            "username": auth_data.get("name", email.split("@")[0]),
            "email": email,
            "name": auth_data.get("name", ""),
            "picture": auth_data.get("picture", ""),
            "phone": "",
            "home_city": "lagos",
            "clout_points": 0,
            "scout_status": "newbie",
            "rating_accuracy_score": 100.0,
            "total_ratings": 0,
            "is_admin": False,
            "is_super_admin": False,
            "is_merchant": False,
            "auth_provider": "google",
            "created_at": datetime.now(timezone.utc)
        }
        db.users.insert_one(user)
        user.pop("_id", None)

    # Create session
    session_token = str(uuid.uuid4())
    db.user_sessions.insert_one({
        "user_id": user["id"],
        "session_token": session_token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=30),
        "created_at": datetime.now(timezone.utc)
    })
    return 200, {"user": user, "session_token": session_token}

def handle_auth_me(headers):
    user = get_current_user(headers)
    if not user:
        return 401, {"detail": "Not authenticated"}
    return 200, user

def handle_auth_logout(headers):
    token = None
    auth = headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
    if token:
        db = get_db()
        if db:
            db.user_sessions.delete_one({"session_token": token})
    return 200, {"message": "Logged out"}

RATING_COOLDOWN_SECONDS = 1800  # 30 minutes
RATING_COOLDOWN_CLOUT_COST = 50
MAX_RATINGS_PER_VENUE_PER_DAY = 3

def handle_get_rating_status(user_id, venue_id):
    db = get_db()
    if not db:
        return 503, {"detail": "Database unavailable"}
    now = datetime.now(timezone.utc)
    day_ago = now - timedelta(hours=24)
    recent = list(db.ratings.find(
        {"user_id": user_id, "venue_id": venue_id, "timestamp": {"$gte": day_ago}},
        {"_id": 0, "timestamp": 1}
    ).sort("timestamp", -1).limit(MAX_RATINGS_PER_VENUE_PER_DAY))

    ratings_today = len(recent)
    if ratings_today == 0:
        return 200, {"can_rate": True, "cooldown_remaining_seconds": 0, "ratings_today": 0}

    # Check if a cooldown skip was used after the last rating
    last_ts = recent[0]["timestamp"]
    if isinstance(last_ts, str):
        last_ts = datetime.fromisoformat(last_ts)
    if last_ts.tzinfo is None:
        last_ts = last_ts.replace(tzinfo=timezone.utc)

    skip = db.cooldown_skips.find_one(
        {"user_id": user_id, "venue_id": venue_id, "skipped_at": {"$gte": last_ts}},
        {"_id": 0}
    )
    elapsed = (now - last_ts).total_seconds()
    cooldown_remaining = max(0, RATING_COOLDOWN_SECONDS - elapsed)

    if skip or cooldown_remaining == 0:
        can_rate = ratings_today < MAX_RATINGS_PER_VENUE_PER_DAY
        return 200, {"can_rate": can_rate, "cooldown_remaining_seconds": 0, "ratings_today": ratings_today}

    return 200, {
        "can_rate": False,
        "cooldown_remaining_seconds": int(cooldown_remaining),
        "ratings_today": ratings_today,
        "can_skip": True,
        "clout_cost": RATING_COOLDOWN_CLOUT_COST
    }

def handle_skip_cooldown(body):
    db = get_db()
    if not db:
        return 503, {"detail": "Database unavailable"}
    user_id = body.get("user_id")
    venue_id = body.get("venue_id")
    method = body.get("method", "clout")  # "clout" or "payment"

    if not user_id or not venue_id:
        return 400, {"detail": "user_id and venue_id required"}

    user = db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        return 404, {"detail": "User not found"}

    if method == "clout":
        current_clout = user.get("clout_points", 0)
        if current_clout < RATING_COOLDOWN_CLOUT_COST:
            return 400, {"detail": f"Not enough Clout. Need {RATING_COOLDOWN_CLOUT_COST}, have {current_clout}"}
        db.users.update_one({"id": user_id}, {"$inc": {"clout_points": -RATING_COOLDOWN_CLOUT_COST}})
        clout_remaining = current_clout - RATING_COOLDOWN_CLOUT_COST
    else:
        # Payment path — trust client for now (Paystack ref would be verified here)
        clout_remaining = user.get("clout_points", 0)

    db.cooldown_skips.insert_one({
        "user_id": user_id,
        "venue_id": venue_id,
        "method": method,
        "skipped_at": datetime.now(timezone.utc)
    })
    return 200, {"success": True, "clout_remaining": clout_remaining}

def handle_create_rating(body):
    db = get_db()
    if not db:
        return 503, {"detail": "Database unavailable"}
    user = db.users.find_one({"id": body.get("user_id")}, {"_id": 0})
    if not user:
        return 404, {"detail": "User not found"}
    venue = db.venues.find_one({"id": body.get("venue_id")}, {"_id": 0})
    if not venue:
        return 404, {"detail": "Venue not found"}

    # Cooldown check
    now = datetime.now(timezone.utc)
    day_ago = now - timedelta(hours=24)
    recent_ratings = list(db.ratings.find(
        {"user_id": body["user_id"], "venue_id": body["venue_id"], "timestamp": {"$gte": day_ago}},
        {"_id": 0, "timestamp": 1}
    ).sort("timestamp", -1).limit(1))

    if recent_ratings:
        last_ts = recent_ratings[0]["timestamp"]
        if isinstance(last_ts, str):
            last_ts = datetime.fromisoformat(last_ts)
        if last_ts.tzinfo is None:
            last_ts = last_ts.replace(tzinfo=timezone.utc)
        elapsed = (now - last_ts).total_seconds()
        if elapsed < RATING_COOLDOWN_SECONDS:
            # Check if skip was used
            skip = db.cooldown_skips.find_one(
                {"user_id": body["user_id"], "venue_id": body["venue_id"], "skipped_at": {"$gte": last_ts}},
                {"_id": 0}
            )
            if not skip:
                remaining = int(RATING_COOLDOWN_SECONDS - elapsed)
                return 429, {
                    "detail": "Cooldown active",
                    "cooldown_remaining_seconds": remaining,
                    "can_skip": True,
                    "clout_cost": RATING_COOLDOWN_CLOUT_COST
                }

    coords = body.get("coordinates", {})
    venue_radius = venue.get("geofence_radius_m", 100)
    dist = calculate_distance(
        coords.get("lat", 0), coords.get("lng", 0),
        venue["coordinates"]["lat"], venue["coordinates"]["lng"]
    )
    if dist > venue_radius:
        return 400, {"detail": f"Must be within {int(venue_radius)}m of venue"}

    vibe_score = calculate_vibe_score(body["energy"], body["capacity"], body["gate"])
    rating_id = str(uuid.uuid4())
    rating = {
        "id": rating_id,
        "user_id": body["user_id"],
        "venue_id": body["venue_id"],
        "energy": body["energy"],
        "capacity": body["capacity"],
        "gate": body["gate"],
        "vibe_score": vibe_score,
        "coordinates": coords,
        "timestamp": datetime.now(timezone.utc),
        "verified": True
    }
    db.ratings.insert_one(rating)
    rating.pop("_id", None)

    # Update venue aggregate
    recent = list(db.ratings.find(
        {"venue_id": body["venue_id"]}, {"_id": 0, "vibe_score": 1}
    ).sort("timestamp", -1).limit(10))
    if recent:
        avg = sum(r["vibe_score"] for r in recent) / len(recent)
        db.venues.update_one({"id": body["venue_id"]}, {
            "$set": {"current_vibe_score": int(avg), "energy_level": get_energy_level(int(avg)),
                     "last_rating_at": datetime.now(timezone.utc)},
            "$inc": {"total_ratings_24h": 1}
        })

    # Clout
    now = datetime.now(timezone.utc)
    active_pulse = db.pulse_drops.find_one({
        "venue_id": body["venue_id"], "start_time": {"$lte": now}, "end_time": {"$gte": now}
    })
    multiplier = 2 if active_pulse else 1
    clout = 10 * multiplier
    db.users.update_one({"id": body["user_id"]}, {"$inc": {"clout_points": clout, "total_ratings": 1}})

    return 200, {"rating": rating, "clout_earned": clout, "multiplier": multiplier, "sponsored": bool(active_pulse)}

def handle_get_trending(city, query_params):
    db = get_db()
    if not db:
        return 503, {"detail": "Database unavailable"}
    limit = int(query_params.get("limit", [20])[0])
    now = datetime.now(timezone.utc)

    pulse_drops = list(db.pulse_drops.find({"end_time": {"$gte": now}, "start_time": {"$lte": now}}, {"_id": 0}))
    sponsored_ids = [p["venue_id"] for p in pulse_drops]

    sponsored = []
    if sponsored_ids:
        for v in db.venues.find({"id": {"$in": sponsored_ids}, "city": city.lower()}, {"_id": 0}).sort("current_vibe_score", -1).limit(10):
            pulse = next((p for p in pulse_drops if p["venue_id"] == v["id"]), None)
            v["is_sponsored"] = True
            v["pulse_tier"] = pulse["tier"] if pulse else None
            sponsored.append(v)

    organic = list(db.venues.find(
        {"city": city.lower(), "id": {"$nin": sponsored_ids}}, {"_id": 0}
    ).sort("current_vibe_score", -1).limit(limit))
    for v in organic:
        v["is_sponsored"] = False

    return 200, {"sponsored": sponsored, "organic": organic}

def handle_get_top_scouts(city, query_params):
    db = get_db()
    if not db:
        return 503, {"detail": "Database unavailable"}
    limit = int(query_params.get("limit", [10])[0])
    scouts = list(db.users.find(
        {"home_city": city.lower()},
        {"_id": 0, "id": 1, "username": 1, "clout_points": 1, "scout_status": 1, "total_ratings": 1}
    ).sort("clout_points", -1).limit(limit))
    result = []
    for i, s in enumerate(scouts):
        result.append({
            "rank": i + 1, "id": s["id"],
            "username": s.get("username", "Anonymous"),
            "clout_points": s.get("clout_points", 0),
            "scout_status": s.get("scout_status", "newbie"),
            "total_ratings": s.get("total_ratings", 0),
            "tier_color": get_scout_tier_color(s.get("scout_status", "newbie"))
        })
    return 200, result

def handle_direction_click(venue_id):
    db = get_db()
    if not db:
        return 503, {"detail": "Database unavailable"}
    db.venues.update_one({"id": venue_id}, {"$inc": {"direction_clicks": 1}})
    return 200, {"success": True}

def handle_seed():
    db = get_db()
    if not db:
        return 503, {"detail": "Database unavailable"}
    if db.venues.count_documents({}) > 0:
        return 200, {"message": "Already seeded", "venues_created": 0}
    venues = [
        {"id": str(uuid.uuid4()), "name": "Quilox Nightclub", "address": "28 Ozumba Mbadiwe Ave",
         "area": "Victoria Island", "city": "lagos", "venue_type": "club",
         "coordinates": {"lat": 6.4281, "lng": 3.4219}, "current_vibe_score": 85,
         "energy_level": "electric", "capacity_level": "vibrant", "gate_level": "slow",
         "vibe_velocity": "heating_up", "total_ratings_24h": 45, "is_featured": True,
         "is_verified": True, "profile_views": 1250, "direction_clicks": 340,
         "entry_fee": "\u20a610,000", "music_genre": "Afrobeats/Hip-Hop", "tables_available": True},
        {"id": str(uuid.uuid4()), "name": "Hard Rock Cafe", "address": "Plot 1 Water Corporation Dr",
         "area": "Victoria Island", "city": "lagos", "venue_type": "bar",
         "coordinates": {"lat": 6.4301, "lng": 3.4245}, "current_vibe_score": 72,
         "energy_level": "popping", "capacity_level": "vibrant", "gate_level": "clear",
         "vibe_velocity": "stable", "total_ratings_24h": 28, "is_featured": False,
         "is_verified": True, "profile_views": 890, "direction_clicks": 210,
         "entry_fee": "Free Entry", "music_genre": "Rock/Pop", "tables_available": True}
    ]
    for v in venues:
        db.venues.insert_one(v)
    admin_id = str(uuid.uuid4())
    db.users.insert_one({
        "id": admin_id, "username": "superadmin", "phone": "+2341234567890",
        "home_city": "lagos", "clout_points": 1000, "scout_status": "elite",
        "total_ratings": 50, "is_admin": True, "is_super_admin": True,
        "is_merchant": False, "created_at": datetime.now(timezone.utc)
    })
    return 200, {"message": "Seeded", "venues_created": len(venues), "admin_user_id": admin_id}

def handle_checkins_create(body, headers):
    db = get_db()
    if not db:
        return 503, {"detail": "Database unavailable"}
    user = get_current_user(headers)
    if not user:
        return 401, {"detail": "Not authenticated"}
    venue = db.venues.find_one({"id": body.get("venue_id")}, {"_id": 0})
    if not venue:
        return 404, {"detail": "Venue not found"}
    checkin = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "venue_id": body["venue_id"],
        "venue_name": venue.get("name", ""),
        "lat": body.get("lat", venue["coordinates"].get("lat", 0)),
        "lng": body.get("lng", venue["coordinates"].get("lng", 0)),
        "status": "active",
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(hours=4)
    }
    db.checkins.insert_one(checkin)
    checkin.pop("_id", None)
    return 200, {"success": True, "checkin": checkin}

def handle_crew_locations(crew_id, headers):
    db = get_db()
    if not db:
        return 503, {"detail": "Database unavailable"}
    user = get_current_user(headers)
    if not user:
        return 401, {"detail": "Not authenticated"}

    crew = db.crews.find_one({"id": crew_id}, {"_id": 0})
    if not crew:
        return 404, {"detail": "Crew not found"}

    # Check user is a member
    if user["id"] not in crew.get("members", []):
        return 403, {"detail": "Not a crew member"}

    now = datetime.now(timezone.utc)
    member_ids = crew.get("members", [])
    result = []

    for member_id in member_ids:
        member = db.users.find_one({"id": member_id}, {"_id": 0, "id": 1, "username": 1, "avatar_config": 1})
        if not member:
            continue
        checkin = db.checkins.find_one(
            {"user_id": member_id, "status": "active", "expires_at": {"$gte": now}},
            {"_id": 0}
        )
        if checkin:
            result.append({
                "user_id": member_id,
                "username": member.get("username", "Anonymous"),
                "venue_name": checkin.get("venue_name", ""),
                "venue_id": checkin.get("venue_id", ""),
                "lat": checkin.get("lat", 0),
                "lng": checkin.get("lng", 0),
                "avatar_config": member.get("avatar_config"),
                "checked_in_at": checkin.get("created_at"),
                "is_out": True
            })

    return 200, result

def handle_checkins_me(headers):
    db = get_db()
    if not db:
        return 503, {"detail": "Database unavailable"}
    user = get_current_user(headers)
    if not user:
        return 401, {"detail": "Not authenticated"}
    checkin = db.checkins.find_one(
        {"user_id": user["id"], "status": "active"},
        {"_id": 0}
    )
    return 200, checkin if checkin else None

def handle_ratings_sync(body, headers):
    """Handle offline ratings sync."""
    db = get_db()
    if not db:
        return 503, {"detail": "Database unavailable"}
    ratings = body.get("ratings", [])
    synced = 0
    for r in ratings:
        r["id"] = str(uuid.uuid4())
        r["timestamp"] = datetime.now(timezone.utc)
        r["verified"] = True
        r["vibe_score"] = calculate_vibe_score(r.get("energy", "chill"), r.get("capacity", "sparse"), r.get("gate", "clear"))
        db.ratings.insert_one(r)
        synced += 1
    return 200, {"synced": synced}

# ========================
# Router
# ========================

# ========================
# Admin Handlers
# ========================

def handle_admin_create_venue(body):
    db = get_db()
    if not db:
        return 503, {"detail": "Database unavailable"}
    venue_id = str(uuid.uuid4())
    venue = {
        "id": venue_id,
        "name": body.get("name", "").strip(),
        "address": body.get("address", "").strip(),
        "area": body.get("area", "").strip(),
        "city": body.get("city", "lagos").lower(),
        "venue_type": body.get("venue_type", "club"),
        "coordinates": body.get("coordinates", {"lat": 6.4281, "lng": 3.4219}),
        "geofence_radius_m": body.get("geofence_radius_m", 100),
        "entry_fee": body.get("entry_fee", "Free"),
        "music_genre": body.get("music_genre", "Mixed"),
        "current_vibe_score": 50,
        "energy_level": "chill",
        "capacity_level": "sparse",
        "gate_level": "clear",
        "vibe_velocity": "stable",
        "is_featured": False,
        "total_ratings_24h": 0,
        "description": body.get("description", ""),
        "created_at": datetime.now(timezone.utc),
    }
    if not venue["name"] or not venue["address"] or not venue["area"]:
        return 400, {"detail": "name, address, and area are required"}
    db.venues.insert_one(venue)
    venue.pop("_id", None)
    return 201, venue

def handle_admin_update_venue(venue_id, body):
    db = get_db()
    if not db:
        return 503, {"detail": "Database unavailable"}
    existing = db.venues.find_one({"id": venue_id}, {"_id": 0})
    if not existing:
        return 404, {"detail": "Venue not found"}
    updates = {}
    for field in ["name", "address", "area", "city", "venue_type", "entry_fee", "music_genre", "description", "geofence_radius_m", "is_featured"]:
        if field in body:
            updates[field] = body[field]
    if "coordinates" in body:
        updates["coordinates"] = body["coordinates"]
    updates["updated_at"] = datetime.now(timezone.utc)
    db.venues.update_one({"id": venue_id}, {"$set": updates})
    updated = db.venues.find_one({"id": venue_id}, {"_id": 0})
    return 200, updated

def handle_admin_delete_venue(venue_id):
    db = get_db()
    if not db:
        return 503, {"detail": "Database unavailable"}
    result = db.venues.delete_one({"id": venue_id})
    if result.deleted_count == 0:
        return 404, {"detail": "Venue not found"}
    return 200, {"success": True, "deleted_id": venue_id}

def handle_admin_get_config():
    db = get_db()
    defaults = {
        "clout_per_rating": 10,
        "clout_per_checkin": 2,
        "cooldown_minutes": 30,
        "daily_rating_limit": 3,
        "cooldown_clout_cost": 50,
    }
    if not db:
        return 200, defaults
    config = db.platform_config.find_one({"key": "global"}, {"_id": 0})
    return 200, config or defaults

def handle_admin_update_config(body):
    db = get_db()
    if not db:
        return 503, {"detail": "Database unavailable"}
    config = {
        "key": "global",
        "clout_per_rating": int(body.get("clout_per_rating", 10)),
        "clout_per_checkin": int(body.get("clout_per_checkin", 2)),
        "cooldown_minutes": int(body.get("cooldown_minutes", 30)),
        "daily_rating_limit": int(body.get("daily_rating_limit", 3)),
        "cooldown_clout_cost": int(body.get("cooldown_clout_cost", 50)),
        "updated_at": datetime.now(timezone.utc),
    }
    db.platform_config.update_one({"key": "global"}, {"$set": config}, upsert=True)
    return 200, {"success": True, "config": config}

def route_get(path, query_params, headers):
    """Route GET requests."""
    if path == "/" or path == "":
        return handle_root()
    if path == "/api/health":
        return handle_health()
    if path == "/api/cities":
        return handle_get_cities()
    if path == "/api/venues":
        return handle_get_venues(query_params)
    if path == "/api/auth/me":
        return handle_auth_me(headers)
    if path == "/api/checkins/me":
        return handle_checkins_me(headers)

    # Dynamic routes
    m = re.match(r'^/api/venues/([^/]+)$', path)
    if m:
        return handle_get_venue(m.group(1))
    m = re.match(r'^/api/users/([^/]+)$', path)
    if m:
        return handle_get_user(m.group(1))
    m = re.match(r'^/api/trending/([^/]+)$', path)
    if m:
        return handle_get_trending(m.group(1), query_params)
    m = re.match(r'^/api/top-scouts/([^/]+)$', path)
    if m:
        return handle_get_top_scouts(m.group(1), query_params)
    m = re.match(r'^/api/ratings/status/([^/]+)/([^/]+)$', path)
    if m:
        return handle_get_rating_status(m.group(1), m.group(2))
    m = re.match(r'^/api/crews/([^/]+)/locations$', path)
    if m:
        return handle_crew_locations(m.group(1), headers)
    if path == "/api/admin/config":
        return handle_admin_get_config()

    return 404, {"detail": "Not found"}

def route_put(path, body, headers):
    """Route PUT requests."""
    if path == "/api/admin/config":
        return handle_admin_update_config(body)
    m = re.match(r'^/api/admin/venues/([^/]+)$', path)
    if m:
        return handle_admin_update_venue(m.group(1), body)
    return 404, {"detail": "Not found"}

def route_delete(path, headers):
    """Route DELETE requests."""
    m = re.match(r'^/api/admin/venues/([^/]+)$', path)
    if m:
        return handle_admin_delete_venue(m.group(1))
    return 404, {"detail": "Not found"}

def route_post(path, body, headers):
    """Route POST requests."""
    if path == "/api/users":
        return handle_create_user(body)
    if path == "/api/auth/session":
        return handle_auth_session(body)
    if path == "/api/auth/logout":
        return handle_auth_logout(headers)
    if path == "/api/ratings":
        return handle_create_rating(body)
    if path == "/api/ratings/sync":
        return handle_ratings_sync(body, headers)
    if path == "/api/ratings/skip-cooldown":
        return handle_skip_cooldown(body)
    if path == "/api/seed":
        return handle_seed()
    if path == "/api/checkins":
        return handle_checkins_create(body, headers)
    if path == "/api/admin/venues":
        return handle_admin_create_venue(body)

    # Dynamic routes
    m = re.match(r'^/api/venues/([^/]+)/direction-click$', path)
    if m:
        return handle_direction_click(m.group(1))

    return 404, {"detail": "Not found"}

# ========================
# Vercel Handler
# ========================

class handler(BaseHTTPRequestHandler):
    def _set_cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.send_header('Access-Control-Allow-Credentials', 'true')

    def _send_json(self, status, data):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self._set_cors()
        self.end_headers()
        self.wfile.write(json.dumps(data, default=json_serial).encode())

    def _get_headers(self):
        return {key: self.headers[key] for key in self.headers}

    def _read_body(self):
        length = int(self.headers.get('Content-Length', 0))
        if length > 0:
            try:
                return json.loads(self.rfile.read(length))
            except Exception:
                return {}
        return {}

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip('/')
        query_params = parse_qs(parsed.query)
        try:
            status, data = route_get(path, query_params, self._get_headers())
            self._send_json(status, data)
        except Exception as e:
            logger.error(f"GET {path} error: {e}")
            self._send_json(500, {"detail": str(e)})

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip('/')
        body = self._read_body()
        try:
            status, data = route_post(path, body, self._get_headers())
            self._send_json(status, data)
        except Exception as e:
            logger.error(f"POST {path} error: {e}")
            self._send_json(500, {"detail": str(e)})

    def do_PUT(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip('/')
        body = self._read_body()
        try:
            status, data = route_put(path, body, self._get_headers())
            self._send_json(status, data)
        except Exception as e:
            logger.error(f"PUT {path} error: {e}")
            self._send_json(500, {"detail": str(e)})

    def do_DELETE(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip('/')
        try:
            status, data = route_delete(path, self._get_headers())
            self._send_json(status, data)
        except Exception as e:
            logger.error(f"DELETE {path} error: {e}")
            self._send_json(500, {"detail": str(e)})

    def do_OPTIONS(self):
        self.send_response(200)
        self._set_cors()
        self.end_headers()

    def log_message(self, format, *args):
        """Suppress default stderr logging."""
        pass
