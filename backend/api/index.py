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

def calculate_vibe_score(energy, capacity, gate, venue_specific=None):
    """Mirror of server.py vibe.py: energy is 80%, venue_specific 20%, capacity is a multiplier. Gate stored only."""
    energy_scores = {"quiet": 0, "chill": 25, "warming": 50, "lit": 75, "peak": 100}
    venue_specific_map = {
        "mellow": 0, "good_set": 50, "killing_it": 100,
        "quiet_atm": 0, "decent_atm": 50, "loud_alive": 100,
        "slow_service": 0, "decent_service": 50, "on_point": 100,
        "flat_crowd": 0, "building_crowd": 50, "going_off": 100,
        "standing_around": 0, "mixed_movement": 50, "packed_dancing": 100,
    }
    capacity_multipliers = {"sparse": 0.92, "vibrant": 1.05, "full": 1.15}
    e = energy_scores.get(energy, 25)
    vs = venue_specific_map.get(venue_specific, 50) if venue_specific else 50
    base = (e * 0.80) + (vs * 0.20)
    multiplier = capacity_multipliers.get(capacity, 1.0)
    return int(min(100.0, base * multiplier))

def get_energy_level(score):
    if score >= 85: return "peak"
    if score >= 65: return "lit"
    if score >= 45: return "warming"
    if score >= 20: return "chill"
    return "quiet"

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
    return 200, {"name": "Viibe Scout API", "version": "3.0.0", "status": "running"}

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

def compute_pulse(venue):
    """Derive Source-of-Pulse data from a venue's total_ratings_24h count."""
    count = min(int(venue.get("total_ratings_24h", 0)), 100)
    if count >= 100:
        tier, next_at = "source", 0
    elif count >= 80:
        tier, next_at = "max_pulse", 100
    elif count >= 60:
        tier, next_at = "electric", 80
    elif count >= 40:
        tier, next_at = "charged", 60
    elif count >= 20:
        tier, next_at = "stirring", 40
    else:
        tier, next_at = "dormant", 20
    return {"count": count, "total": 100, "tier": tier, "next_tier_at": next_at}

def handle_get_venues(query_params):
    db = get_db()
    if not db:
        return 503, {"detail": "Database unavailable"}
    query = {}
    city = query_params.get("city", [None])[0]
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    venues = list(db.venues.find(query, {"_id": 0}).limit(100))
    for v in venues:
        v["pulse"] = compute_pulse(v)
    return 200, venues

def handle_get_venue(venue_id):
    db = get_db()
    if not db:
        return 503, {"detail": "Database unavailable"}
    venue = db.venues.find_one({"id": venue_id}, {"_id": 0})
    if not venue:
        return 404, {"detail": "Venue not found"}
    venue["pulse"] = compute_pulse(venue)
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

    # Validate energy — map legacy values from old clients to new 6-state model
    energy = body.get("energy", "chill")
    _legacy_energy = {"good_vibes": "lit", "buzzing": "lit", "electric": "peak", "popping": "lit", "dead": "quiet"}
    energy = _legacy_energy.get(energy, energy)
    valid_energies = {"quiet", "chill", "warming", "lit", "peak"}
    if energy not in valid_energies:
        return 400, {"detail": f"Invalid energy value '{energy}'. Must be one of: {sorted(valid_energies)}"}

    vibe_score = calculate_vibe_score(energy, body["capacity"], body["gate"], body.get("venue_specific"))
    rating_id = str(uuid.uuid4())
    rating = {
        "id": rating_id,
        "user_id": body["user_id"],
        "venue_id": body["venue_id"],
        "energy": energy,
        "capacity": body["capacity"],
        "gate": body["gate"],
        "venue_specific": body.get("venue_specific"),  # optional 4th dimension
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
    hour_ago = now - timedelta(hours=1)

    pulse_drops = list(db.pulse_drops.find({"end_time": {"$gte": now}, "start_time": {"$lte": now}}, {"_id": 0}))
    sponsored_ids = [p["venue_id"] for p in pulse_drops]

    all_venues = list(db.venues.find({"city": {"$regex": city, "$options": "i"}}, {"_id": 0}).limit(100))
    if not all_venues:
        return 200, {"city": city, "venues": [], "sponsored": [], "last_updated": now.isoformat(), "total_venues": 0}

    def _wrap(v, rank, is_sponsored):
        score = v.get("current_vibe_score", 0)
        recent = db.checkins.count_documents({"venue_id": v["id"], "created_at": {"$gte": hour_ago}})
        scouts = len(db.checkins.distinct("user_id", {"venue_id": v["id"], "created_at": {"$gte": now - timedelta(hours=24)}}))
        trending_score = round((score * 0.5) + (recent * 10 * 0.3) + (scouts * 5 * 0.2), 1)
        return {
            "venue": v,
            "trending_score": trending_score,
            "energy_percent": min(100, round(score)),
            "check_in_velocity": recent,
            "scout_count": scouts,
            "trend": "up" if recent > 0 else "stable",
            "last_rating": None,
            "is_sponsored": is_sponsored,
            "is_pulse_boosted": is_sponsored,
            "clout_multiplier": 2 if is_sponsored else 1,
            "rank": rank,
        }

    sponsored_venues = []
    organic_venues = []
    for v in all_venues:
        is_sp = v["id"] in sponsored_ids
        if is_sp:
            sponsored_venues.append(v)
        else:
            organic_venues.append(v)

    organic_venues.sort(key=lambda x: x.get("current_vibe_score", 0), reverse=True)
    sponsored_venues.sort(key=lambda x: x.get("current_vibe_score", 0), reverse=True)

    organic_wrapped  = [_wrap(v, i + 1, False) for i, v in enumerate(organic_venues[:limit])]
    sponsored_wrapped = [_wrap(v, i + 1, True)  for i, v in enumerate(sponsored_venues)]

    return 200, {
        "city": city,
        "venues": organic_wrapped,
        "sponsored": sponsored_wrapped,
        "last_updated": now.isoformat(),
        "total_venues": len(all_venues),
    }

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

def handle_get_venue_top_scouts(venue_id):
    """Return top scouts for a specific venue (most ratings, then highest clout)."""
    db = get_db()
    if not db:
        return 503, {"detail": "Database unavailable"}
    # Aggregate ratings for this venue grouped by user_id
    pipeline = [
        {"$match": {"venue_id": venue_id}},
        {"$group": {
            "_id": "$user_id",
            "ratings_count": {"$sum": 1},
            "clout_earned": {"$sum": {"$ifNull": ["$clout_earned", 10]}}
        }},
        {"$sort": {"ratings_count": -1, "clout_earned": -1}},
        {"$limit": 5}
    ]
    top = list(db.ratings.aggregate(pipeline))
    result = []
    for i, entry in enumerate(top):
        user_id = entry["_id"]
        user = db.users.find_one(
            {"id": user_id},
            {"_id": 0, "username": 1, "scout_status": 1}
        ) or {}
        result.append({
            "rank": i + 1,
            "user_id": user_id,
            "username": user.get("username", "Anonymous"),
            "scout_status": user.get("scout_status", "newbie"),
            "ratings_count": entry["ratings_count"],
            "clout_earned": entry["clout_earned"],
            "tier_color": get_scout_tier_color(user.get("scout_status", "newbie"))
        })
    return 200, result

# ── Vibe Oracle heuristic tables ──────────────────────────────────────────
_ORACLE_PEAK_WINDOWS = {
    "club":        {"weekday": ("12:30am","2:00am"),  "weekend": ("1:00am","3:00am")},
    "lounge":      {"weekday": ("10:00pm","12:00am"), "weekend": ("11:00pm","1:00am")},
    "bar":         {"weekday": ("9:00pm","11:30pm"),  "weekend": ("10:00pm","1:00am")},
    "restaurant":  {"weekday": ("7:00pm","9:30pm"),   "weekend": ("8:00pm","10:00pm")},
    "concert":     {"weekday": ("8:00pm","10:30pm"),  "weekend": ("8:00pm","11:00pm")},
    "rave":        {"weekday": ("11:00pm","4:00am"),  "weekend": ("12:00am","5:00am")},
    "block_party": {"weekday": ("5:00pm","10:00pm"),  "weekend": ("4:00pm","11:00pm")},
    "event":       {"weekday": ("6:00pm","9:00pm"),   "weekend": ("5:00pm","10:00pm")},
    "church":      {"weekday": ("9:00am","11:30am"),  "weekend": ("9:00am","12:00pm")},
}
_ORACLE_BASE_CONF = {"club":82,"lounge":78,"bar":75,"restaurant":80,"concert":85,"rave":70,"block_party":88,"event":80,"church":90}
_ORACLE_ENERGY_LABELS = {"club":"peak","lounge":"lit","bar":"lit","restaurant":"warming","concert":"peak","rave":"peak","block_party":"peak","event":"lit","church":"uplifting"}

def _oracle_best_arrival(peak_start_str):
    """Return '45 min before X' as a human string."""
    import re as _re
    m = _re.match(r'(\d+):(\d+)(am|pm)', peak_start_str)
    if not m:
        return peak_start_str
    h, mi, period = int(m.group(1)), int(m.group(2)), m.group(3)
    total_min = (h % 12 + (12 if period == 'pm' else 0)) * 60 + mi - 45
    if total_min < 0:
        total_min += 24 * 60
    arr_h, arr_m = divmod(total_min, 60)
    arr_period = 'am' if arr_h < 12 else 'pm'
    arr_h = arr_h % 12 or 12
    return f"{arr_h}:{arr_m:02d}{arr_period}"

def handle_get_oracle(venue_id):
    """Predict peak time and confidence for a venue using heuristics."""
    db = get_db()
    if not db:
        # Return a graceful fallback so frontend doesn't break without DB
        return 200, {"insufficient_data": True}
    venue = db.venues.find_one({"id": venue_id}, {"_id": 0})
    if not venue:
        return 404, {"detail": "Venue not found"}

    venue_type = venue.get("venue_type", "club")
    now = datetime.now()
    day_of_week = now.weekday()  # 0=Mon, 6=Sun
    is_weekend = day_of_week >= 4  # Fri/Sat/Sun
    day_key = "weekend" if is_weekend else "weekday"
    day_label = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"][day_of_week]

    windows = _ORACLE_PEAK_WINDOWS.get(venue_type, _ORACLE_PEAK_WINDOWS["club"])
    peak_start, peak_end = windows[day_key]
    best_arrival = _oracle_best_arrival(peak_start)

    # Confidence calculation
    base_conf = _ORACLE_BASE_CONF.get(venue_type, 75)
    velocity = venue.get("vibe_velocity", "stable")
    velocity_delta = {"heating_up": 8, "stable": 0, "cooling_down": -10}.get(velocity, 0)
    activity = venue.get("total_ratings_24h", 0)
    activity_delta = 5 if activity > 30 else (-5 if activity < 10 else 0)
    confidence = max(50, min(95, base_conf + velocity_delta + activity_delta))

    # Headline
    energy_label = _ORACLE_ENERGY_LABELS.get(venue_type, "lit")
    headline = f"{venue.get('name', 'This venue')} will be {energy_label} by {peak_start} tonight"

    # Signals
    signals = []
    if is_weekend:
        signals.append({"icon": "🌙", "label": f"{day_label} Night", "type": "day_of_week"})
    else:
        signals.append({"icon": "📅", "label": f"{day_label} Night", "type": "day_of_week"})
    if velocity == "heating_up":
        signals.append({"icon": "📈", "label": "Heating Up", "type": "velocity"})
    elif velocity == "cooling_down":
        signals.append({"icon": "📉", "label": "Cooling Down", "type": "velocity"})
    music = venue.get("music_genre", "")
    if music:
        signals.append({"icon": "🎵", "label": music.split("/")[0].strip(), "type": "genre"})
    if venue.get("vibe_certified"):
        signals.append({"icon": "✅", "label": "Vibe Certified", "type": "certification"})
    signals = signals[:3]  # max 3 chips

    # Current trajectory (simple: just based on confidence + velocity)
    if velocity == "heating_up":
        trajectory = "rising"
    elif velocity == "cooling_down":
        trajectory = "fading"
    elif activity > 25:
        trajectory = "peaking"
    else:
        trajectory = "rising"

    return 200, {
        "venue_id": venue_id,
        "headline": headline,
        "confidence": confidence,
        "peak_window_start": peak_start,
        "peak_window_end": peak_end,
        "best_arrival": best_arrival,
        "current_trajectory": trajectory,
        "signals": signals,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


def handle_get_user_dna(user_id):
    """Compute user's vibe affinity fingerprint from their rating history."""
    db = get_db()
    if not db:
        return 200, {"insufficient_data": True}

    ratings = list(db.ratings.find({"user_id": user_id}, {"_id": 0, "venue_id": 1, "vibe_score": 1, "timestamp": 1}))
    if len(ratings) < 3:
        return 200, {"insufficient_data": True, "min_ratings": 3, "current_ratings": len(ratings)}

    # Group by venue_type
    type_scores = {}  # venue_type -> [scores]
    type_hours = []   # hours of rating for night_style
    venue_cache = {}
    for r in ratings:
        vid = r.get("venue_id")
        if vid not in venue_cache:
            v = db.venues.find_one({"id": vid}, {"_id": 0, "venue_type": 1})
            venue_cache[vid] = v.get("venue_type", "other") if v else "other"
        vtype = venue_cache[vid]
        if vtype not in type_scores:
            type_scores[vtype] = []
        type_scores[vtype].append(r.get("vibe_score", 50))
        ts = r.get("timestamp")
        if ts:
            h = ts.hour if isinstance(ts, datetime) else 0
            type_hours.append(h)

    # Average per type
    avgs = {vt: sum(scores)/len(scores) for vt, scores in type_scores.items()}
    max_avg = max(avgs.values()) or 1
    # Normalize to 0-100
    normalized = {vt: round((avg / max_avg) * 100) for vt, avg in avgs.items()}

    def label(score):
        if score >= 80: return "Electric"
        if score >= 60: return "Popping"
        if score >= 40: return "Chill"
        return "Low Key"

    affinities = sorted([
        {"venue_type": vt, "score": normalized[vt], "rating_count": len(type_scores[vt]), "label": label(normalized[vt])}
        for vt in normalized
    ], key=lambda x: x["score"], reverse=True)

    # Dominant type = most ratings (frequency)
    dominant_type = max(type_scores, key=lambda vt: len(type_scores[vt]))

    # Night style from avg hour
    avg_hour = sum(type_hours) / len(type_hours) if type_hours else 22
    if avg_hour < 22 and avg_hour >= 6:
        night_style = "early_bird"
        night_style_label = "Early Bird — you like to get there first"
    elif avg_hour >= 0 and avg_hour < 4:
        night_style = "night_owl"
        night_style_label = "Night Owl — you peak after midnight"
    else:
        night_style = "midnight_crew"
        night_style_label = "Midnight Crew — you hit your stride at midnight"

    return 200, {
        "user_id": user_id,
        "affinities": affinities,
        "dominant_type": dominant_type,
        "night_style": night_style,
        "night_style_label": night_style_label,
        "total_ratings_analyzed": len(ratings),
        "computed_at": datetime.now(timezone.utc).isoformat(),
    }


def handle_planner_chat(body):
    """Night Planner — keyword-based venue recommendation. Claude path activates via ANTHROPIC_API_KEY."""
    city = body.get("city", "lagos").lower()
    message = body.get("message", "").strip()
    history = body.get("history", [])
    conversation_id = body.get("conversation_id") or str(uuid.uuid4())

    if not message:
        return 400, {"detail": "Message is required"}

    db = get_db()
    venues = list(db.venues.find({"city": city}, {"_id": 0}).limit(30)) if db else []

    # ── Claude path ──────────────────────────────────────────────────────
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if api_key and venues:
        try:
            import anthropic
            venue_ctx = json.dumps([{
                "id": v["id"], "name": v["name"], "area": v.get("area",""),
                "venue_type": v.get("venue_type",""), "current_vibe_score": v.get("current_vibe_score",50),
                "energy_level": v.get("energy_level","chill"), "capacity_level": v.get("capacity_level","sparse"),
                "gate_level": v.get("gate_level","clear"), "entry_fee": v.get("entry_fee","Free"),
                "music_genre": v.get("music_genre",""), "vibe_velocity": v.get("vibe_velocity","stable"),
            } for v in venues], ensure_ascii=False)
            system = (
                "You are Vibe, a nightlife AI concierge for Nigeria. Tonight's live venue data:\n"
                f"{venue_ctx}\n\n"
                "Rules: Recommend 1-3 venues max from the data. Be warm, Nigerian-casual (use 'squad', 'vibe', 'mad'). "
                "Respond in JSON only: {\"reply\": \"...\", \"venue_ids\": [\"id1\",\"id2\"], \"follow_up_prompts\": [\"...\",\"...\"]}"
            )
            messages = history + [{"role": "user", "content": message}]
            client = anthropic.Anthropic(api_key=api_key)
            resp = client.messages.create(model="claude-haiku-4-5-20251001", max_tokens=600, system=system, messages=messages)
            raw = resp.content[0].text.strip()
            parsed = json.loads(raw)
            rec_venues = [v for v in venues if v["id"] in parsed.get("venue_ids", [])]
            result_venues = [{"venue_id": v["id"], "name": v["name"], "area": v.get("area",""),
                              "current_vibe_score": v.get("current_vibe_score",50),
                              "energy_level": v.get("energy_level","chill"),
                              "entry_fee": v.get("entry_fee","Free"),
                              "music_genre": v.get("music_genre",""),
                              "match_reason": "Recommended by AI", "match_score": 90} for v in rec_venues]
            return 200, {"conversation_id": conversation_id, "reply": parsed.get("reply",""),
                         "venues": result_venues, "follow_up_prompts": parsed.get("follow_up_prompts",[]),
                         "powered_by": "claude"}
        except Exception as e:
            logging.warning(f"Claude planner failed, falling back to rules: {e}")

    # ── Rule-based path ──────────────────────────────────────────────────
    msg = message.lower()
    AREAS = ["lekki","vi","victoria island","ikeja","ikoyi","surulere","yaba","ajah","gbagada","maryland"]
    GENRES = ["afrobeats","afrobeat","amapiano","house","highlife","hiphop","hip hop","r&b","rnb"]
    BUDGET_KW = ["budget","cheap","free","affordable","low key","lowkey"]
    CLUB_KW = ["club","dance","turn up","turnup","party","rave"]
    LOUNGE_KW = ["lounge","chill","relax","quiet","sit down","vibe","grown"]
    GROUP_KW = ["squad","crew","group","gang","6","7","8","9","10","large"]

    target_area = next((a for a in AREAS if a in msg), None)
    target_genre = next((g for g in GENRES if g in msg), None)
    want_budget = any(k in msg for k in BUDGET_KW)
    want_club = any(k in msg for k in CLUB_KW)
    want_lounge = any(k in msg for k in LOUNGE_KW)
    want_group = any(k in msg for k in GROUP_KW)

    scored = []
    for v in venues:
        s = v.get("current_vibe_score", 50)
        if target_area and target_area in v.get("area","").lower(): s += 20
        if target_genre and target_genre in v.get("music_genre","").lower(): s += 15
        if want_budget and "free" in v.get("entry_fee","").lower(): s += 20
        if want_club and v.get("venue_type") == "club": s += 15
        if want_lounge and v.get("venue_type") in ["lounge","bar"]: s += 15
        if want_group and v.get("capacity_level") in ["vibrant","full"]: s += 10
        scored.append((s, v))

    scored.sort(key=lambda x: x[0], reverse=True)
    top = [v for _, v in scored[:3]]

    # Build reply
    if not top:
        reply = "I couldn't find a match right now — try a different area or vibe?"
        follow_ups = ["Show me all venues", "Any clubs nearby?"]
    else:
        names = " and ".join(f"**{v['name']}**" for v in top)
        reply = f"Your squad is set! Based on your vibe, check out {names} tonight."
        if target_area:
            reply += f" All in {target_area.title()}."
        if top[0].get("vibe_velocity") == "heating_up":
            reply += f" {top[0]['name']} is heating up fast right now."
        follow_ups = ["What's the gate like?", "Any free entry spots?", f"More in {target_area.title() if target_area else 'Lagos'}"]

    result_venues = [{"venue_id": v["id"], "name": v["name"], "area": v.get("area",""),
                      "current_vibe_score": v.get("current_vibe_score",50),
                      "energy_level": v.get("energy_level","chill"), "entry_fee": v.get("entry_fee","Free"),
                      "music_genre": v.get("music_genre",""),
                      "match_reason": _build_match_reason(v, target_genre, target_area, want_budget),
                      "match_score": min(95, v.get("current_vibe_score",50) + 20)} for v in top]

    return 200, {"conversation_id": conversation_id, "reply": reply,
                 "venues": result_venues, "follow_up_prompts": follow_ups[:3],
                 "powered_by": "rules"}

def _build_match_reason(venue, genre, area, budget):
    parts = []
    if genre and genre in venue.get("music_genre","").lower(): parts.append(genre.title())
    if area and area in venue.get("area","").lower(): parts.append(f"in {area.title()}")
    if budget and "free" in venue.get("entry_fee","").lower(): parts.append("Free entry")
    if not parts: parts.append(f"{venue.get('venue_type','').title()} vibes")
    return " · ".join(parts)


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
         "energy_level": "peak", "capacity_level": "vibrant", "gate_level": "slow",
         "vibe_velocity": "heating_up", "total_ratings_24h": 45, "is_featured": True,
         "is_verified": True, "profile_views": 1250, "direction_clicks": 340,
         "entry_fee": "\u20a610,000", "music_genre": "Afrobeats/Hip-Hop", "tables_available": True},
        {"id": str(uuid.uuid4()), "name": "Hard Rock Cafe", "address": "Plot 1 Water Corporation Dr",
         "area": "Victoria Island", "city": "lagos", "venue_type": "bar",
         "coordinates": {"lat": 6.4301, "lng": 3.4245}, "current_vibe_score": 72,
         "energy_level": "lit", "capacity_level": "vibrant", "gate_level": "clear",
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


_DEFAULT_ECONOMY_CONFIG = {
    "pulse_drops": {
        "spark": {"price": 5000, "duration_hours": 2, "radius_km": 2, "glow_boost": 20},
        "flare": {"price": 15000, "duration_hours": 4, "radius_km": 5, "glow_boost": 40},
        "supernova": {"price": 50000, "duration_hours": 8, "radius_km": 50, "glow_boost": 100},
    },
    "campaigns": {
        "2x_2h": 3000, "2x_4h": 5000, "2x_8h": 8000,
        "3x_2h": 7000, "3x_4h": 12000, "3x_8h": 20000,
    },
    "wallet": {"min_topup": 1000, "platform_fee_percent": 10},
    "clout": {"rating_base": 10, "checkin": 2, "pulse_drop": 3, "cooldown_skip_cost": 50},
    "streaks": {"milestone_3d": 5, "milestone_7d": 15, "milestone_14d": 30, "milestone_30d": 50},
}


def handle_get_economy_config():
    """GET /api/admin/economy-config"""
    db = get_db()
    if not db:
        return 200, {"config": _DEFAULT_ECONOMY_CONFIG, "is_default": True}
    doc = db.config.find_one({"key": "economy_config"})
    if doc:
        return 200, {"config": doc["value"], "is_default": False,
                     "last_updated": doc.get("updated_at", "").isoformat() if hasattr(doc.get("updated_at", ""), "isoformat") else None}
    return 200, {"config": _DEFAULT_ECONOMY_CONFIG, "is_default": True}


def handle_update_economy_config(body):
    """PUT /api/admin/economy-config"""
    import copy
    db = get_db()
    if not db:
        return 503, {"detail": "Database unavailable"}
    section = body.get("section")
    updates = body.get("updates")
    if not section or updates is None:
        return 400, {"detail": "'section' and 'updates' are required"}
    if section not in _DEFAULT_ECONOMY_CONFIG:
        return 400, {"detail": f"Unknown section: '{section}'"}
    doc = db.config.find_one({"key": "economy_config"})
    config = copy.deepcopy(doc["value"]) if doc else copy.deepcopy(_DEFAULT_ECONOMY_CONFIG)
    if isinstance(config[section], dict) and isinstance(updates, dict):
        config[section].update(updates)
    else:
        config[section] = updates
    now = datetime.now(timezone.utc)
    db.config.update_one({"key": "economy_config"}, {"$set": {"value": config, "updated_at": now}}, upsert=True)
    return 200, {"message": f"'{section}' updated", "config": config}


QUICK_PULSE_CLOUT    = 3
QUICK_PULSE_COOLDOWN = 15 * 60  # 15 minutes


def _get_pulse_label(score: float) -> str:
    if score >= 85: return "PEAK"
    if score >= 65: return "LIT"
    if score >= 45: return "WARMING"
    if score >= 20: return "CHILL"
    return "QUIET"


def handle_get_city_pulse(city: str):
    """GET /api/city-pulse/{city} — live city heartbeat with 30-min sparkline."""
    db = get_db()
    if not db:
        return 503, {"detail": "Database unavailable"}

    now             = datetime.now(timezone.utc)
    hour_ago        = now - timedelta(hours=1)
    thirty_min_ago  = now - timedelta(minutes=30)
    midnight        = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # Venues with recent activity (ratings or reactions in last hour)
    rating_venue_ids  = db.ratings.distinct("venue_id",  {"timestamp": {"$gte": hour_ago}})
    reaction_venue_ids= db.reactions.distinct("venue_id", {"timestamp": {"$gte": hour_ago}})
    active_ids = list(set(rating_venue_ids) | set(reaction_venue_ids))

    active_venues = list(db.venues.find(
        {"city": city, "id": {"$in": active_ids}},
        {"_id": 0, "id": 1, "name": 1, "current_vibe_score": 1, "total_ratings_24h": 1}
    )) if active_ids else []

    if active_venues:
        total_weight = sum(max(v.get("total_ratings_24h", 1), 1) for v in active_venues)
        weighted_sum = sum(
            v.get("current_vibe_score", 0) * max(v.get("total_ratings_24h", 1), 1)
            for v in active_venues
        )
        pulse_score = round(weighted_sum / total_weight, 1)
        top_venue   = max(active_venues, key=lambda v: v.get("current_vibe_score", 0))
        trending    = {"name": top_venue["name"], "score": int(top_venue["current_vibe_score"])}
        hot_venues  = sum(1 for v in active_venues if v.get("current_vibe_score", 0) >= 65)
    else:
        pulse_score = 0
        trending    = None
        hot_venues  = 0

    # Active scouts: unique raters + reactors in last hour
    rating_scouts   = set(db.ratings.distinct("user_id",  {"timestamp": {"$gte": hour_ago}}))
    reaction_scouts = set(db.reactions.distinct("user_id", {"timestamp": {"$gte": hour_ago}}))
    active_scouts   = len(rating_scouts | reaction_scouts)

    pulses_tonight = db.quick_pulses.count_documents({"city": city, "timestamp": {"$gte": midnight}})

    # 30-min sparkline: 6 data points × 5-min buckets
    snapshots = list(db.vibe_snapshots.find(
        {"timestamp": {"$gte": thirty_min_ago},
         "venue_id": {"$in": active_ids} if active_ids else {"$exists": True}},
        {"_id": 0, "timestamp": 1, "vibe_score": 1}
    )) if active_ids else []

    buckets = {}
    for snap in snapshots:
        snap_time = snap.get("timestamp", now)
        if isinstance(snap_time, str):
            snap_time = datetime.fromisoformat(snap_time.replace("Z", "+00:00"))
        if snap_time.tzinfo is None:
            snap_time = snap_time.replace(tzinfo=timezone.utc)
        minutes_ago = (now - snap_time).total_seconds() / 60
        bucket = min(5, int(minutes_ago / 5))
        buckets.setdefault(bucket, []).append(snap.get("vibe_score", 0))

    sparkline = []
    last_val = pulse_score
    for i in range(5, -1, -1):
        if i in buckets and buckets[i]:
            last_val = round(sum(buckets[i]) / len(buckets[i]), 1)
        sparkline.append(last_val)

    # Trend
    if sparkline and sparkline[-1] > sparkline[0] + 5:
        trend = "heating_up"
    elif sparkline and sparkline[-1] < sparkline[0] - 5:
        trend = "cooling_down"
    else:
        trend = "stable"

    return 200, {
        "city":           city,
        "pulse_score":    pulse_score,
        "pulse_label":    _get_pulse_label(pulse_score),
        "trend":          trend,
        "active_scouts":  active_scouts,
        "live_venues":    len(active_venues),
        "hot_venues":     hot_venues,
        "pulses_tonight": pulses_tonight,
        "trending_venue": trending,
        "sparkline":      sparkline,
        "updated_at":     now.isoformat(),
    }


def _vercel_compute_burst(user_id: str, venue_id: str, db) -> dict:
    """
    Detect burst pattern from last 4 taps by this user at this venue.
    Returns multiplier + rhythm classification.
    """
    recent = list(db.reactions.find(
        {"user_id": user_id, "venue_id": venue_id},
        sort=[("timestamp", -1)],
        limit=4,
    ))
    if len(recent) < 2:
        return {"multiplier": 1.0, "rhythm": "casual", "tap_count": 1}

    intervals = [
        (recent[i]["timestamp"] - recent[i + 1]["timestamp"]).total_seconds() * 1000
        for i in range(min(len(recent) - 1, 3))
    ]

    if len(intervals) >= 3 and all(iv < 600 for iv in intervals):
        return {"multiplier": 2.0, "rhythm": "frenzy", "tap_count": len(recent)}
    elif len(intervals) >= 2 and all(iv < 800 for iv in intervals[:2]):
        return {"multiplier": 1.5, "rhythm": "frantic", "tap_count": len(recent)}
    elif len(intervals) >= 2 and all(300 <= iv <= 700 for iv in intervals[:2]):
        return {"multiplier": 1.3, "rhythm": "rhythmic", "tap_count": len(recent)}
    return {"multiplier": 1.0, "rhythm": "casual", "tap_count": 1}


def _vercel_weighted_rpm(venue_id: str, window_start, db) -> float:
    """Sum reaction weights in window / 5 minutes."""
    pipeline = [
        {"$match": {"venue_id": venue_id, "timestamp": {"$gte": window_start}}},
        {"$group": {"_id": None, "total_weight": {"$sum": {"$ifNull": ["$weight", 1.0]}}}},
    ]
    result = list(db.reactions.aggregate(pipeline))
    weighted_total = result[0]["total_weight"] if result else 0
    return round(weighted_total / 5, 1)


def handle_react_to_venue(venue_id: str, headers: dict):
    """POST /api/venues/{venue_id}/react — live bolt reaction. JWT-authenticated."""
    db = get_db()
    if not db:
        return 503, {"detail": "Database unavailable"}

    user = get_current_user(headers)
    if not user:
        return 401, {"detail": "Not authenticated"}

    user_id = user["id"]
    now = datetime.now(timezone.utc)

    venue = db.venues.find_one({"id": venue_id}, {"_id": 0})
    if not venue:
        return 404, {"detail": "Venue not found"}

    # Per-user rate cap: 60 taps/min
    minute_ago = now - timedelta(minutes=1)
    user_recent = db.reactions.count_documents({
        "user_id": user_id,
        "venue_id": venue_id,
        "timestamp": {"$gte": minute_ago},
    })
    if user_recent >= 60:
        return 429, {"detail": "Slow down — reaction cap reached"}

    # Detect burst BEFORE inserting (reads previous taps only)
    burst = _vercel_compute_burst(user_id, venue_id, db)

    db.reactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "venue_id": venue_id,
        "timestamp": now,
        "weight": burst["multiplier"],
    })

    # Weighted reaction rate: burst taps count more
    window_start = now - timedelta(minutes=5)
    reactions_per_min = _vercel_weighted_rpm(venue_id, window_start, db)

    scout_pipeline = [
        {"$match": {"venue_id": venue_id, "timestamp": {"$gte": window_start}}},
        {"$group": {"_id": "$user_id"}},
        {"$count": "total"},
    ]
    scout_result = list(db.reactions.aggregate(scout_pipeline))
    active_scouts = scout_result[0]["total"] if scout_result else 1

    return 200, {
        "ok": True,
        "reactions_per_min": reactions_per_min,
        "active_scouts": active_scouts,
        "burst": burst,
    }


def handle_get_reaction_rate(venue_id: str):
    """GET /api/venues/{venue_id}/reactions/rate — current weighted reaction rate."""
    db = get_db()
    if not db:
        return 503, {"detail": "Database unavailable"}

    now          = datetime.now(timezone.utc)
    window_start = now - timedelta(minutes=5)

    reactions_per_min = _vercel_weighted_rpm(venue_id, window_start, db)

    pipeline = [
        {"$match": {"venue_id": venue_id, "timestamp": {"$gte": window_start}}},
        {"$group": {"_id": "$user_id"}},
        {"$count": "total"},
    ]
    scout_result = list(db.reactions.aggregate(pipeline))
    active_scouts = scout_result[0]["total"] if scout_result else 0

    return 200, {
        "reactions_per_min": reactions_per_min,
        "active_scouts": active_scouts,
    }


def handle_drop_quick_pulse(body):
    """POST /api/pulse — scout drops a quick pulse. Awards 3 clout."""
    db = get_db()
    if not db:
        return 503, {"detail": "Database unavailable"}

    user_id  = body.get("user_id")
    venue_id = body.get("venue_id")
    coords   = body.get("coordinates", {})

    user  = db.users.find_one({"id": user_id},  {"_id": 0})
    venue = db.venues.find_one({"id": venue_id}, {"_id": 0})
    if not user:  return 404, {"detail": "User not found"}
    if not venue: return 404, {"detail": "Venue not found"}

    # Geofence — events/festivals get 500m radius
    event_types = {"event", "festival", "concert", "block_party"}
    geofence_m  = venue.get("geofence_radius_m", 100)
    if venue.get("venue_type") in event_types:
        geofence_m = max(geofence_m, 500)

    dist = calculate_distance(
        coords.get("lat", 0), coords.get("lng", 0),
        venue["coordinates"]["lat"], venue["coordinates"]["lng"]
    )
    if dist > geofence_m:
        return 400, {"detail": f"Must be within {int(geofence_m)}m of venue to pulse"}

    # 15-min cooldown per user-venue pair
    now    = datetime.now(timezone.utc)
    cutoff = now - timedelta(seconds=QUICK_PULSE_COOLDOWN)
    recent = db.quick_pulses.find_one(
        {"user_id": user_id, "venue_id": venue_id, "timestamp": {"$gte": cutoff}},
        {"_id": 0, "timestamp": 1}
    )
    if recent:
        last_ts = recent["timestamp"]
        if isinstance(last_ts, str): last_ts = datetime.fromisoformat(last_ts)
        if last_ts.tzinfo is None:   last_ts = last_ts.replace(tzinfo=timezone.utc)
        remaining = int(QUICK_PULSE_COOLDOWN - (now - last_ts).total_seconds())
        return 429, {"detail": "Pulse cooldown active", "cooldown_remaining_seconds": remaining}

    # Record + award clout
    db.quick_pulses.insert_one({
        "id": str(uuid.uuid4()), "user_id": user_id,
        "venue_id": venue_id, "city": venue.get("city", "lagos"),
        "timestamp": now,
    })
    db.users.update_one({"id": user_id}, {"$inc": {"clout_points": QUICK_PULSE_CLOUT}})

    return 200, {
        "success":      True,
        "clout_earned": QUICK_PULSE_CLOUT,
        "new_clout":    user.get("clout_points", 0) + QUICK_PULSE_CLOUT,
        "venue_id":     venue_id,
    }


# ========================
# Venue Live Handlers
# ========================

def _get_intent_counts_sync(db, venue_id):
    """Sync aggregation: returns {enroute, maybe, pass} counts for active headings."""
    now = datetime.now(timezone.utc)
    pipeline = [
        {"$match": {"venue_id": venue_id, "expires_at": {"$gt": now}}},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}},
    ]
    rows = list(db.venue_headings.aggregate(pipeline))
    counts = {"enroute": 0, "maybe": 0, "pass": 0}
    for row in rows:
        if row["_id"] in counts:
            counts[row["_id"]] = row["count"]
    return counts


def handle_get_following(headers):
    db = get_db()
    if not db:
        return 503, {"detail": "Database unavailable"}
    user = get_current_user(headers)
    if not user:
        return 401, {"detail": "Not authenticated"}
    follows = list(db.venue_follows.find(
        {"user_id": user["id"]},
        {"_id": 0, "venue_id": 1, "venue_name": 1, "venue_category": 1}
    ).limit(500))
    venue_ids = [f["venue_id"] for f in follows]
    venues = []
    if venue_ids:
        raw = list(db.venues.find({"id": {"$in": venue_ids}}, {"_id": 0}))
        venues = [
            {
                "id": v.get("id"),
                "name": v.get("name"),
                "category": v.get("venue_type"),
                "vibe_score": v.get("current_vibe_score", 0),
                "energy_level": v.get("energy_level", "quiet"),
                "area": v.get("area", ""),
                "city": v.get("city", "lagos"),
            }
            for v in raw
        ]
    return 200, {"following": venues, "count": len(venues)}


def handle_get_following_feed(headers):
    db = get_db()
    if not db:
        return 503, {"detail": "Database unavailable"}
    user = get_current_user(headers)
    if not user:
        return 401, {"detail": "Not authenticated"}
    follows = list(db.venue_follows.find({"user_id": user["id"]}, {"venue_id": 1}).limit(500))
    venue_ids = [f["venue_id"] for f in follows]
    if not venue_ids:
        return 200, {"pushes": [], "followed_count": 0}
    cutoff = datetime.now(timezone.utc) - timedelta(hours=12)
    pushes = list(db.venue_live_pushes.find(
        {"venue_id": {"$in": venue_ids}, "sent_at": {"$gte": cutoff}},
        {"_id": 0}
    ).sort("sent_at", -1).limit(20))
    for p in pushes:
        if isinstance(p.get("sent_at"), datetime):
            p["sent_at"] = p["sent_at"].isoformat()
    return 200, {"pushes": pushes, "followed_count": len(venue_ids)}


def handle_get_heading_count(venue_id):
    db = get_db()
    if not db:
        return 503, {"detail": "Database unavailable"}
    counts = _get_intent_counts_sync(db, venue_id)
    return 200, {"venue_id": venue_id, **counts}


def handle_get_follow_status(venue_id, headers):
    db = get_db()
    if not db:
        return 503, {"detail": "Database unavailable"}
    user = get_current_user(headers)
    existing = db.venue_follows.find_one({"user_id": user["id"], "venue_id": venue_id}) if user else None
    follower_count = db.venue_follows.count_documents({"venue_id": venue_id})
    now = datetime.now(timezone.utc)
    heading_count = db.venue_headings.count_documents({
        "venue_id": venue_id,
        "expires_at": {"$gt": now},
    })
    return 200, {
        "following": existing is not None,
        "followers": follower_count,
        "heading_count": heading_count,
    }


def handle_get_venue_live_pushes(venue_id):
    db = get_db()
    if not db:
        return 503, {"detail": "Database unavailable"}
    cutoff = datetime.now(timezone.utc) - timedelta(hours=6)
    pushes = list(db.venue_live_pushes.find(
        {"venue_id": venue_id, "sent_at": {"$gte": cutoff}},
        {"_id": 0}
    ).sort("sent_at", -1).limit(5))
    for p in pushes:
        if isinstance(p.get("sent_at"), datetime):
            p["sent_at"] = p["sent_at"].isoformat()
    return 200, {"pushes": pushes}


def handle_send_live_push(venue_id, body, headers):
    db = get_db()
    if not db:
        return 503, {"detail": "Database unavailable"}
    user = get_current_user(headers)
    if not user:
        return 401, {"detail": "Not authenticated"}
    venue = db.venues.find_one({"id": venue_id}, {"_id": 0})
    if not venue:
        return 404, {"detail": "Venue not found"}
    if venue.get("owner_id") != user["id"] and not user.get("is_admin"):
        return 403, {"detail": "Not your venue"}
    message = (body.get("message") or "").strip()
    if not message:
        return 400, {"detail": "Message cannot be empty"}
    if len(message) > 500:
        return 400, {"detail": "Message too long (max 500 chars)"}
    now = datetime.now(timezone.utc)
    recent = db.venue_live_pushes.find_one({
        "venue_id": venue_id,
        "sent_at": {"$gte": now - timedelta(minutes=30)},
    })
    if recent:
        return 429, {"detail": "You can only send one live update every 30 minutes"}
    venue_name = venue.get("name", "A venue")
    venue_category = body.get("venue_type") or venue.get("venue_type", "venue")
    push_doc = {
        "venue_id": venue_id,
        "venue_name": venue_name,
        "venue_category": venue_category,
        "merchant_id": user["id"],
        "message": message,
        "sent_at": now,
        "heading_count": 0,
    }
    result = db.venue_live_pushes.insert_one(push_doc)
    push_id = str(result.inserted_id)
    follower_count = db.venue_follows.count_documents({"venue_id": venue_id})
    return 200, {
        "success": True,
        "push_id": push_id,
        "notifications_sent": 0,
        "followers_reached": follower_count,
    }


def handle_set_heading(venue_id, body, headers):
    db = get_db()
    if not db:
        return 503, {"detail": "Database unavailable"}
    user = get_current_user(headers)
    if not user:
        return 401, {"detail": "Not authenticated"}
    status = body.get("status", "")
    if status not in {"enroute", "maybe", "pass"}:
        return 400, {"detail": "status must be one of: enroute, maybe, pass"}
    venue = db.venues.find_one({"id": venue_id})
    if not venue:
        return 404, {"detail": "Venue not found"}
    now = datetime.now(timezone.utc)
    expires = now + timedelta(hours=3)
    db.venue_headings.update_one(
        {"user_id": user["id"], "venue_id": venue_id},
        {"$set": {
            "user_id": user["id"],
            "venue_id": venue_id,
            "status": status,
            "created_at": now,
            "expires_at": expires,
        }},
        upsert=True,
    )
    counts = _get_intent_counts_sync(db, venue_id)
    return 200, {"success": True, **counts}


def handle_cancel_heading(venue_id, headers):
    db = get_db()
    if not db:
        return 503, {"detail": "Database unavailable"}
    user = get_current_user(headers)
    if not user:
        return 401, {"detail": "Not authenticated"}
    db.venue_headings.delete_one({"user_id": user["id"], "venue_id": venue_id})
    counts = _get_intent_counts_sync(db, venue_id)
    return 200, {"success": True, **counts}


def handle_follow_venue(venue_id, headers):
    db = get_db()
    if not db:
        return 503, {"detail": "Database unavailable"}
    user = get_current_user(headers)
    if not user:
        return 401, {"detail": "Not authenticated"}
    venue = db.venues.find_one({"id": venue_id}, {"_id": 0})
    if not venue:
        return 404, {"detail": "Venue not found"}
    existing = db.venue_follows.find_one({"user_id": user["id"], "venue_id": venue_id})
    if existing:
        count = db.venue_follows.count_documents({"venue_id": venue_id})
        return 200, {"success": True, "following": True, "message": "Already following", "followers": count}
    db.venue_follows.insert_one({
        "user_id": user["id"],
        "venue_id": venue_id,
        "venue_name": venue.get("name", ""),
        "venue_category": venue.get("venue_type", ""),
        "created_at": datetime.now(timezone.utc),
    })
    count = db.venue_follows.count_documents({"venue_id": venue_id})
    return 200, {"success": True, "following": True, "followers": count}


def handle_unfollow_venue(venue_id, headers):
    db = get_db()
    if not db:
        return 503, {"detail": "Database unavailable"}
    user = get_current_user(headers)
    if not user:
        return 401, {"detail": "Not authenticated"}
    db.venue_follows.delete_one({"user_id": user["id"], "venue_id": venue_id})
    count = db.venue_follows.count_documents({"venue_id": venue_id})
    return 200, {"success": True, "following": False, "followers": count}


def handle_get_momentum():
    """Venue momentum — score delta vs 60 min ago."""
    db = get_db()
    if not db:
        return 503, {"detail": "Database unavailable"}
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(minutes=90)
    window_end = now - timedelta(minutes=30)
    venues = list(db.venues.find({}, {"_id": 0, "id": 1, "name": 1, "current_vibe_score": 1}))
    result = []
    for venue in venues:
        vid = venue.get("id")
        current = venue.get("current_vibe_score", 0)
        snap = list(db.vibe_snapshots.aggregate([
            {"$match": {"venue_id": vid, "timestamp": {"$gte": window_start, "$lte": window_end}}},
            {"$group": {"_id": None, "avg": {"$avg": "$vibe_score"}}},
        ]))
        prev = round(snap[0]["avg"], 1) if snap else None
        delta = round(current - prev, 1) if prev is not None else 0.0
        if delta >= 5:
            momentum = "rising"
        elif delta <= -5:
            momentum = "fading"
        elif current >= 70:
            momentum = "peaking"
        else:
            momentum = "stable"
        result.append({"id": vid, "name": venue.get("name"), "current_score": current,
                        "score_1h_ago": prev, "delta": delta, "momentum": momentum})
    return 200, {"momentum": result, "computed_at": now.isoformat()}


def handle_get_missed_peaks(headers):
    """Missed peaks for followed venues."""
    db = get_db()
    if not db:
        return 503, {"detail": "Database unavailable"}
    user = get_current_user(headers)
    if not user:
        return 401, {"detail": "Not authenticated"}
    now = datetime.now(timezone.utc)
    since = now - timedelta(hours=24)
    follows = list(db.venue_follows.find({"user_id": user["id"], "active": True}, {"venue_id": 1}))
    followed_ids = [f["venue_id"] for f in follows]
    if not followed_ids:
        return 200, {"missed": []}
    missed = []
    for venue_id in followed_ids:
        peaks = list(db.vibe_snapshots.aggregate([
            {"$match": {"venue_id": venue_id, "timestamp": {"$gte": since}, "vibe_score": {"$gte": 70}}},
            {"$group": {"_id": None, "peak_score": {"$max": "$vibe_score"}, "peak_time": {"$last": "$timestamp"}}},
        ]))
        if not peaks:
            continue
        peak = peaks[0]
        did_rate = db.ratings.count_documents({"user_id": user["id"], "venue_id": venue_id, "timestamp": {"$gte": since}})
        did_checkin = db.checkins.count_documents({"user_id": user["id"], "venue_id": venue_id, "created_at": {"$gte": since}})
        if did_rate == 0 and did_checkin == 0:
            vdoc = db.venues.find_one({"id": venue_id}, {"_id": 0, "name": 1, "area": 1})
            missed.append({
                "venue_id": venue_id,
                "venue_name": vdoc.get("name") if vdoc else "Unknown",
                "area": vdoc.get("area") if vdoc else "",
                "peak_score": round(peak["peak_score"], 1),
                "message": f"Hit {round(peak['peak_score'])}% while you were away",
            })
    missed.sort(key=lambda x: x["peak_score"], reverse=True)
    return 200, {"missed": missed[:5]}


def handle_get_scene_report():
    """Auto-generated last-night scene report."""
    db = get_db()
    if not db:
        return 503, {"detail": "Database unavailable"}
    now = datetime.now(timezone.utc)
    today_3am = now.replace(hour=3, minute=0, second=0, microsecond=0)
    report_end = today_3am
    report_start = today_3am - timedelta(hours=8)
    top_raw = list(db.vibe_snapshots.aggregate([
        {"$match": {"timestamp": {"$gte": report_start, "$lte": report_end}}},
        {"$group": {"_id": "$venue_id", "peak_score": {"$max": "$vibe_score"}, "avg_score": {"$avg": "$vibe_score"}}},
        {"$sort": {"peak_score": -1}},
        {"$limit": 5},
    ]))
    if not top_raw:
        return 200, {"available": False, "message": "No data for last night yet."}
    top_venues = []
    for v in top_raw:
        vdoc = db.venues.find_one({"id": v["_id"]}, {"_id": 0, "name": 1, "area": 1})
        top_venues.append({
            "venue_id": v["_id"],
            "venue_name": vdoc.get("name") if vdoc else v["_id"],
            "area": vdoc.get("area") if vdoc else "",
            "peak_score": round(v["peak_score"], 1),
            "avg_score": round(v["avg_score"], 1),
        })
    winner = top_venues[0]
    surge_raw = list(db.vibe_snapshots.aggregate([
        {"$match": {"timestamp": {"$gte": report_start, "$lte": report_end}}},
        {"$group": {"_id": "$venue_id", "max_score": {"$max": "$vibe_score"}, "min_score": {"$min": "$vibe_score"}}},
        {"$addFields": {"surge": {"$subtract": ["$max_score", "$min_score"]}}},
        {"$sort": {"surge": -1}},
        {"$limit": 1},
    ]))
    surge_venue = None
    if surge_raw:
        s = surge_raw[0]
        sdoc = db.venues.find_one({"id": s["_id"]}, {"_id": 0, "name": 1})
        surge_venue = {
            "venue_id": s["_id"],
            "venue_name": sdoc.get("name") if sdoc else s["_id"],
            "surge": round(s["surge"], 1),
        }
    return 200, {
        "available": True,
        "winner": winner,
        "top_venues": top_venues,
        "surge_venue": surge_venue,
        "headline": f"{winner['venue_name']} peaked at {winner['peak_score']}% last night",
    }


def handle_get_coins_balance(headers):
    db = get_db()
    if not db: return 503, {"detail": "Database unavailable"}
    user = get_current_user(headers)
    if not user: return 401, {"detail": "Not authenticated"}
    CASHOUT_RATE_FREE, CASHOUT_RATE_VIBE_PLUS = 4000, 5000
    is_vibe_plus = False
    vp_expires = user.get("vibe_plus_expires_at")
    now_iso = datetime.now(timezone.utc).isoformat()
    if vp_expires and vp_expires > now_iso: is_vibe_plus = True
    rate = CASHOUT_RATE_VIBE_PLUS if is_vibe_plus else CASHOUT_RATE_FREE
    wallet = db.vibe_coins.find_one({"user_id": user["id"]}, {"_id": 0}) or {}
    txns = list(db.coin_transactions.find({"user_id": user["id"]}, {"_id": 0}).sort("timestamp", -1).limit(20))
    for t in txns:
        if isinstance(t.get("timestamp"), datetime): t["timestamp"] = t["timestamp"].isoformat()
    return 200, {
        "balance": wallet.get("balance", 0),
        "total_earned": wallet.get("total_earned", 0),
        "total_cashed_out": wallet.get("total_cashed_out", 0),
        "cashout_rate_naira": rate // 100,
        "cashout_min_coins": 500,
        "is_vibe_plus": is_vibe_plus,
        "transactions": txns,
    }


def handle_get_banks(headers):
    db = get_db()
    if not db: return 503, {"detail": "Database unavailable"}
    paystack_key = os.environ.get("PAYSTACK_SECRET_KEY", "")
    if not paystack_key: return 200, {"banks": []}
    try:
        import urllib.request
        req = urllib.request.Request("https://api.paystack.co/bank", headers={"Authorization": f"Bearer {paystack_key}"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
        banks = [{"name": b["name"], "code": b["code"]} for b in data.get("data", [])]
        return 200, {"banks": banks}
    except Exception:
        return 200, {"banks": []}


def handle_get_bank_account(headers):
    db = get_db()
    if not db: return 503, {"detail": "Database unavailable"}
    user = get_current_user(headers)
    if not user: return 401, {"detail": "Not authenticated"}
    udoc = db.users.find_one({"id": user["id"]}, {"_id": 0, "paystack_recipient_code": 1, "bank_account": 1})
    if not udoc or not udoc.get("paystack_recipient_code"):
        return 200, {"saved": False}
    acct = udoc.get("bank_account", {})
    return 200, {
        "saved": True,
        "account_name": acct.get("account_name"),
        "account_number_masked": acct.get("account_number_masked"),
        "bank_code": acct.get("bank_code"),
    }


def handle_get_reward_pool(venue_id):
    db = get_db()
    if not db: return 503, {"detail": "Database unavailable"}
    now = datetime.now(timezone.utc)
    pool = db.venue_reward_pools.find_one(
        {"venue_id": venue_id, "active": True, "coins_remaining": {"$gt": 0}, "expires_at": {"$gt": now.isoformat()}},
        {"_id": 0},
    )
    if not pool: return 200, {"active": False}
    return 200, {"active": True, "coin_rate": pool["coin_rate"], "coins_remaining": pool["coins_remaining"], "expires_at": pool["expires_at"]}


# ========================
# Intelligence Layer Routes
# ========================

_AREA_BOUNDS = {
    "victoria_island": {"lat": (6.41, 6.45), "lng": (3.39, 3.45)},
    "lekki":           {"lat": (6.43, 6.47), "lng": (3.45, 3.58)},
    "ikoyi":           {"lat": (6.44, 6.47), "lng": (3.42, 3.47)},
    "surulere":        {"lat": (6.49, 6.53), "lng": (3.34, 3.38)},
    "ikeja":           {"lat": (6.59, 6.63), "lng": (3.33, 3.37)},
    "yaba":            {"lat": (6.50, 6.53), "lng": (3.36, 3.40)},
    "ajah":            {"lat": (6.46, 6.50), "lng": (3.57, 3.65)},
    "maryland":        {"lat": (6.55, 6.58), "lng": (3.35, 3.38)},
}

_WEATHER_IMPACT = {
    "Clear":         ("ideal", "+",  "Dry night — expect peak turnout"),
    "Clouds":        ("neutral", "~", "Overcast but fine — won't affect the scene"),
    "Rain":          ("poor",   "−",  "Rain in Lagos kills the vibe — 30-40% fewer people"),
    "Drizzle":       ("poor",   "−",  "Light rain — expect later starts and thinner early crowds"),
    "Thunderstorm":  ("dead",   "−−", "Storm warning — venues will be thin tonight"),
    "Haze":          ("neutral", "~", "Harmattan haze — not ideal but people still go out"),
    "Mist":          ("neutral", "~", "Light mist — negligible effect"),
}


def _classify_area(venue):
    """Map a venue to its area using lat/lng bounds or its area field."""
    lat = venue.get("coordinates", {}).get("lat")
    lng = venue.get("coordinates", {}).get("lng")
    if lat and lng:
        for area, bounds in _AREA_BOUNDS.items():
            if bounds["lat"][0] <= lat <= bounds["lat"][1] and bounds["lng"][0] <= lng <= bounds["lng"][1]:
                return area
    raw = venue.get("area", "").lower().replace(" ", "_")
    return raw if raw else "other"


def handle_get_area_pulse(city: str):
    """GET /api/area-pulse/{city} — per-neighbourhood aggregated vibe score."""
    db = get_db()
    if not db:
        return 503, {"detail": "Database unavailable"}
    venues = list(db.venues.find({"city": city}, {"_id": 0,
        "id": 1, "name": 1, "current_vibe_score": 1, "vibe_velocity": 1,
        "coordinates": 1, "area": 1, "total_ratings_24h": 1}))
    area_map: dict = {}
    for v in venues:
        area = _classify_area(v)
        if area not in area_map:
            area_map[area] = {"scores": [], "names": [], "velocities": []}
        area_map[area]["scores"].append(v.get("current_vibe_score", 0))
        area_map[area]["names"].append(v["name"])
        area_map[area]["velocities"].append(v.get("vibe_velocity", "stable"))
    areas = []
    for area, data in area_map.items():
        scores = data["scores"]
        avg = round(sum(scores) / len(scores), 1) if scores else 0
        top_venue = data["names"][scores.index(max(scores))] if scores else ""
        velocities = data["velocities"]
        if velocities.count("heating_up") > len(velocities) * 0.4:
            trend = "heating_up"
        elif velocities.count("cooling_down") > len(velocities) * 0.4:
            trend = "cooling_down"
        else:
            trend = "stable"
        areas.append({"area": area, "display_name": area.replace("_", " ").title(),
                       "avg_score": avg, "venue_count": len(scores),
                       "top_venue": top_venue, "trend": trend})
    areas.sort(key=lambda x: x["avg_score"], reverse=True)
    return 200, {"city": city, "areas": areas, "updated_at": datetime.now(timezone.utc).isoformat()}


def handle_get_weather(city: str):
    """GET /api/weather/{city} — weather with nightlife impact classification."""
    city_coords = {
        "lagos": (6.5244, 3.3792),
        "abuja": (9.0579, 7.4951),
        "port_harcourt": (4.8156, 7.0498),
        "ibadan": (7.3775, 3.9470),
    }
    coords = city_coords.get(city, (6.5244, 3.3792))
    api_key = os.environ.get("OPENWEATHER_API_KEY", "")
    if not api_key:
        return 200, {"available": False, "message": "Weather service not configured"}
    try:
        import urllib.request
        url = f"https://api.openweathermap.org/data/2.5/weather?lat={coords[0]}&lon={coords[1]}&appid={api_key}&units=metric"
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read())
        condition = data["weather"][0]["main"]
        temp = data["main"]["temp"]
        humidity = data["main"]["humidity"]
        impact, symbol, message = _WEATHER_IMPACT.get(condition, ("neutral", "~", "Conditions normal"))
        return 200, {
            "available": True, "condition": condition,
            "temp_c": round(temp, 1), "humidity": humidity,
            "nightlife_impact": impact, "impact_symbol": symbol,
            "message": message,
        }
    except Exception as e:
        return 200, {"available": False, "message": str(e)}


def handle_get_tonight(city: str):
    """GET /api/tonight/{city} — weighted top-pick recommendation for tonight."""
    db = get_db()
    if not db:
        return 503, {"detail": "Database unavailable"}
    now = datetime.now(timezone.utc)
    two_h_ago = now - timedelta(hours=2)
    venues = list(db.venues.find({"city": city}, {"_id": 0,
        "id": 1, "name": 1, "area": 1, "current_vibe_score": 1, "vibe_velocity": 1,
        "music_genre": 1, "entry_fee": 1, "venue_type": 1,
        "total_ratings_24h": 1}))
    if not venues:
        return 200, {"available": False}
    scored = []
    for v in venues:
        score = v.get("current_vibe_score", 0)
        velocity = v.get("vibe_velocity", "stable")
        vel_bonus = 15 if velocity == "heating_up" else -10 if velocity == "cooling_down" else 0
        recent_count = db.ratings.count_documents({"venue_id": v["id"], "timestamp": {"$gte": two_h_ago}})
        activity_bonus = min(20, recent_count * 2)
        total = (score * 0.55) + (vel_bonus * 0.20) + (activity_bonus * 0.25)
        scored.append((total, v))
    scored.sort(key=lambda x: x[0], reverse=True)
    top = scored[0][1]
    alts = [v for _, v in scored[1:4]]
    return 200, {
        "available": True,
        "pick": {
            "venue_id": top["id"],
            "name": top["name"],
            "area": top.get("area", ""),
            "score": top.get("current_vibe_score", 0),
            "velocity": top.get("vibe_velocity", "stable"),
            "music_genre": top.get("music_genre", ""),
            "entry_fee": top.get("entry_fee", "Free"),
            "venue_type": top.get("venue_type", ""),
        },
        "alternatives": [
            {"venue_id": v["id"], "name": v["name"], "area": v.get("area", ""),
             "score": v.get("current_vibe_score", 0)} for v in alts
        ],
    }


def handle_get_arrival_intel(venue_id: str):
    """GET /api/venues/{id}/arrival-intel — best arrival time from check-in/rating timing."""
    db = get_db()
    if not db:
        return 503, {"detail": "Database unavailable"}
    venue = db.venues.find_one({"id": venue_id}, {"_id": 0, "name": 1})
    if not venue:
        return 404, {"detail": "Venue not found"}
    since = datetime.now(timezone.utc) - timedelta(days=14)
    # Use ratings as proxy for arrival timing
    ratings = list(db.ratings.find({"venue_id": venue_id, "timestamp": {"$gte": since}},
                                    {"_id": 0, "timestamp": 1}))
    if len(ratings) < 5:
        return 200, {"available": False, "message": "Not enough data yet"}
    # Night hours in WAT (UTC+1): 19-23h and 0-3h UTC (= 20-24h and 1-4h WAT)
    NIGHT_HOURS_UTC = list(range(18, 24)) + list(range(0, 4))
    hour_counts: dict = {}
    for r in ratings:
        ts = r.get("timestamp")
        if isinstance(ts, str):
            ts = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        if ts and ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        if ts:
            h_utc = ts.hour
            if h_utc in NIGHT_HOURS_UTC:
                h_wat = (h_utc + 1) % 24
                hour_counts[h_wat] = hour_counts.get(h_wat, 0) + 1
    if not hour_counts:
        return 200, {"available": False, "message": "No night-time activity data"}
    peak_h = max(hour_counts, key=hour_counts.get)
    # Recommend arriving 1h before peak
    recommend_h = (peak_h - 1) % 24
    hourly = []
    for h_utc in NIGHT_HOURS_UTC:
        h_wat = (h_utc + 1) % 24
        hourly.append({"hour_wat": h_wat,
                        "hour_label": f"{h_wat:02d}:00",
                        "activity": hour_counts.get(h_wat, 0)})
    return 200, {
        "available": True,
        "venue_name": venue.get("name"),
        "peak_hour": f"{peak_h:02d}:00 WAT",
        "recommended_arrival": f"{recommend_h:02d}:00 WAT",
        "insight": f"Arrive by {recommend_h:02d}:00 WAT to beat the queue — peak hits around {peak_h:02d}:00 WAT.",
        "hourly": hourly,
    }


def handle_get_crowd_composition(venue_id: str):
    """GET /api/venues/{id}/crowd-composition — persona breakdown of recent raters."""
    db = get_db()
    if not db:
        return 503, {"detail": "Database unavailable"}
    four_h_ago = datetime.now(timezone.utc) - timedelta(hours=4)
    recent_ratings = list(db.ratings.find({"venue_id": venue_id, "timestamp": {"$gte": four_h_ago}},
                                           {"_id": 0, "user_id": 1}))
    if not recent_ratings:
        return 200, {"available": False}
    user_ids = [r["user_id"] for r in recent_ratings]
    personas: dict = {"turn_up": 0, "grown_sexy": 0, "culture": 0, "chill_set": 0}
    for uid in user_ids:
        user = db.users.find_one({"id": uid}, {"_id": 0, "vibe_persona": 1})
        persona = user.get("vibe_persona", "turn_up") if user else "turn_up"
        if persona in personas:
            personas[persona] += 1
        else:
            personas["turn_up"] += 1
    total = sum(personas.values())
    breakdown = [{"persona": k, "count": v, "pct": round((v / total) * 100) if total else 0}
                 for k, v in personas.items()]
    breakdown.sort(key=lambda x: x["pct"], reverse=True)
    dominant = breakdown[0]["persona"] if breakdown else "turn_up"
    return 200, {
        "available": True,
        "sample_size": total,
        "dominant_persona": dominant,
        "breakdown": breakdown,
    }


def handle_get_venue_reputation(venue_id: str):
    """GET /api/venues/{id}/reputation — 90-day rolling reputation score."""
    db = get_db()
    if not db:
        return 503, {"detail": "Database unavailable"}
    since = datetime.now(timezone.utc) - timedelta(days=90)
    snaps = list(db.vibe_snapshots.find({"venue_id": venue_id, "timestamp": {"$gte": since}},
                                         {"_id": 0, "vibe_score": 1, "user_id": 1, "timestamp": 1}))
    if len(snaps) < 10:
        return 200, {"available": False, "message": "Not enough history"}
    scores = [s["vibe_score"] for s in snaps]
    avg = sum(scores) / len(scores)
    # Consistency: lower std_dev = more consistent
    variance = sum((s - avg) ** 2 for s in scores) / len(scores)
    std_dev = variance ** 0.5
    consistency = max(0, 100 - std_dev * 2)
    # Loyalty: unique raters returning (at least 2 ratings in window)
    from collections import Counter
    user_counts = Counter(s.get("user_id") for s in snaps if s.get("user_id"))
    loyal = sum(1 for c in user_counts.values() if c >= 2)
    loyalty_score = min(100, loyal * 5)
    reputation = round((avg * 0.40) + (consistency * 0.30) + (loyalty_score * 0.30), 1)
    tier = "legendary" if reputation >= 85 else "trusted" if reputation >= 70 else "established" if reputation >= 50 else "building"
    return 200, {
        "available": True,
        "reputation_score": reputation,
        "tier": tier,
        "avg_vibe": round(avg, 1),
        "consistency": round(consistency, 1),
        "loyalty_score": round(loyalty_score, 1),
        "sample_size": len(snaps),
        "days_analyzed": 90,
    }


# ── Tap History ───────────────────────────────────────────────────────────────

def handle_get_tap_history(headers):
    """GET /api/me/tap-history — cross-venue bolt tap breakdown per scout."""
    db = get_db()
    if not db:
        return 503, {"detail": "Database unavailable"}
    user = get_current_user(headers)
    if not user:
        return 401, {"detail": "Not authenticated"}
    user_id = user["id"]
    now = datetime.now(timezone.utc)
    if now.hour < 7:
        base = now - timedelta(days=1)
    else:
        base = now
    tonight_start = base.replace(hour=17, minute=0, second=0, microsecond=0)
    last_30 = now - timedelta(days=30)

    # Tonight per-venue
    tonight_pipeline = [
        {"$match": {"user_id": user_id, "created_at": {"$gte": tonight_start}}},
        {"$group": {"_id": "$venue_id", "tap_count": {"$sum": 1}}},
        {"$sort": {"tap_count": -1}},
        {"$limit": 20},
    ]
    tonight_docs = list(db.venue_bolts.aggregate(tonight_pipeline))
    tonight_venues = []
    for doc in tonight_docs:
        venue = db.venues.find_one({"id": doc["_id"]}, {"name": 1, "area": 1})
        tonight_venues.append({
            "venue_id": doc["_id"],
            "venue_name": venue["name"] if venue else "Unknown",
            "venue_area": venue.get("area", "") if venue else "",
            "tap_count": doc["tap_count"],
        })
    tonight_total = sum(v["tap_count"] for v in tonight_venues)

    # All-time
    alltime_docs = list(db.venue_bolts.aggregate([
        {"$match": {"user_id": user_id}},
        {"$group": {"_id": "$venue_id", "tap_count": {"$sum": 1}}},
        {"$sort": {"tap_count": -1}},
    ]))
    alltime_total = sum(d["tap_count"] for d in alltime_docs)
    top_venue = None
    if alltime_docs:
        tv = db.venues.find_one({"id": alltime_docs[0]["_id"]}, {"name": 1})
        top_venue = {
            "venue_id": alltime_docs[0]["_id"],
            "venue_name": tv["name"] if tv else "Unknown",
            "tap_count": alltime_docs[0]["tap_count"],
        }

    # Per-night history
    history_docs = list(db.venue_bolts.aggregate([
        {"$match": {"user_id": user_id, "created_at": {"$gte": last_30}}},
        {"$project": {
            "venue_id": 1, "created_at": 1,
            "night_day": {"$dateToString": {
                "format": "%Y-%m-%d",
                "date": {"$dateSubtract": {"startDate": "$created_at", "unit": "hour", "amount": 17}},
                "timezone": "UTC",
            }},
        }},
        {"$group": {"_id": "$night_day", "total_taps": {"$sum": 1}, "venues": {"$addToSet": "$venue_id"}}},
        {"$sort": {"_id": -1}},
        {"$limit": 30},
    ]))
    history = [{"date": d["_id"], "total_taps": d["total_taps"], "venue_count": len(d["venues"])} for d in history_docs]

    return 200, {
        "tonight": {"total_taps": tonight_total, "venues": tonight_venues},
        "all_time": {"total_taps": alltime_total, "top_venue": top_venue, "venues_tapped": len(alltime_docs)},
        "history": history,
    }


# ── Vibe DNA (tap-enriched) ───────────────────────────────────────────────────
# handle_get_user_dna is already defined above (line ~668) — it returns rating affinities.
# Extended version with tap affinities added here under a new name; route_get dispatches to it.

def handle_get_user_dna_v2(user_id):
    """GET /api/users/{id}/dna — ratings + tap affinities."""
    status, base = handle_get_user_dna(user_id)
    if status != 200 or base.get("insufficient_data"):
        return status, base
    db = get_db()
    if not db:
        return status, base

    # Tap affinities by venue type
    bolt_docs = list(db.venue_bolts.aggregate([
        {"$match": {"user_id": user_id}},
        {"$group": {"_id": "$venue_id", "tap_count": {"$sum": 1}}},
        {"$sort": {"tap_count": -1}},
        {"$limit": 50},
    ]))
    tap_type_counts = {}
    for doc in bolt_docs:
        v = db.venues.find_one({"id": doc["_id"]}, {"venue_type": 1})
        vtype = v.get("venue_type", "other") if v else "other"
        tap_type_counts[vtype] = tap_type_counts.get(vtype, 0) + doc["tap_count"]

    tap_total = sum(tap_type_counts.values()) or 1
    tap_affinities = sorted([
        {"venue_type": vt, "tap_count": cnt, "share": round(cnt / tap_total * 100)}
        for vt, cnt in tap_type_counts.items()
    ], key=lambda x: x["tap_count"], reverse=True)

    base["tap_affinities"] = tap_affinities
    base["top_tap_type"] = tap_affinities[0]["venue_type"] if tap_affinities else None
    base["total_bolts_analyzed"] = sum(tap_type_counts.values())
    return 200, base


# ── Venue Battle ──────────────────────────────────────────────────────────────

def handle_get_active_battle():
    """GET /api/battles/active — current active battle or null."""
    db = get_db()
    if not db:
        return 503, {"detail": "Database unavailable"}
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=30)
    battle = db.battles.find_one({"created_at": {"$gte": cutoff}}, sort=[("created_at", -1)])
    if not battle:
        return 200, {"battle": None}

    def enrich(b):
        va_id, vb_id = b["venue_a_id"], b["venue_b_id"]
        va = db.venues.find_one({"id": va_id}, {"name": 1, "area": 1, "energy_level": 1, "current_vibe_score": 1}) or {}
        vb = db.venues.find_one({"id": vb_id}, {"name": 1, "area": 1, "energy_level": 1, "current_vibe_score": 1}) or {}
        taps_a, taps_b = b.get("taps_a", 0), b.get("taps_b", 0)
        total = taps_a + taps_b or 1
        ends_at = b["created_at"] + timedelta(minutes=30)
        secs_left = max(0, int((ends_at - datetime.now(timezone.utc)).total_seconds()))
        return {
            "id": b["id"],
            "status": "active" if secs_left > 0 else "ended",
            "seconds_left": secs_left,
            "venue_a": {"id": va_id, "name": va.get("name", "Unknown"), "area": va.get("area", ""), "energy_level": va.get("energy_level", "chill"), "vibe_score": va.get("current_vibe_score", 0), "taps": taps_a, "share": round(taps_a / total * 100)},
            "venue_b": {"id": vb_id, "name": vb.get("name", "Unknown"), "area": vb.get("area", ""), "energy_level": vb.get("energy_level", "chill"), "vibe_score": vb.get("current_vibe_score", 0), "taps": taps_b, "share": round(taps_b / total * 100)},
            "total_taps": taps_a + taps_b,
            "winner": ("a" if taps_a > taps_b else "b" if taps_b > taps_a else "tie") if secs_left == 0 else None,
        }
    return 200, {"battle": enrich(battle)}


def handle_tap_battle(battle_id, side, headers):
    """POST /api/battles/{id}/tap/{side} — cast a bolt."""
    db = get_db()
    if not db:
        return 503, {"detail": "Database unavailable"}
    user = get_current_user(headers)
    if not user:
        return 401, {"detail": "Not authenticated"}
    if side not in ("a", "b"):
        return 400, {"detail": "Side must be 'a' or 'b'"}
    battle = db.battles.find_one({"id": battle_id})
    if not battle:
        return 404, {"detail": "Battle not found"}
    if datetime.now(timezone.utc) > battle["created_at"] + timedelta(minutes=30):
        return 410, {"detail": "Battle has ended"}
    if db.battle_taps.find_one({"battle_id": battle_id, "user_id": user["id"]}):
        return 429, {"detail": "Already tapped in this battle"}
    db.battle_taps.insert_one({"battle_id": battle_id, "user_id": user["id"], "side": side, "created_at": datetime.now(timezone.utc)})
    inc = "taps_a" if side == "a" else "taps_b"
    db.battles.update_one({"id": battle_id}, {"$inc": {inc: 1}})
    updated = db.battles.find_one({"id": battle_id})
    # Enrich inline
    _, result = handle_get_active_battle()
    return 200, result


def handle_create_battle(body):
    """POST /api/battles — create a new battle."""
    db = get_db()
    if not db:
        return 503, {"detail": "Database unavailable"}
    va, vb = body.get("venue_a_id"), body.get("venue_b_id")
    if not va or not vb:
        return 400, {"detail": "venue_a_id and venue_b_id required"}
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=30)
    if db.battles.find_one({"created_at": {"$gte": cutoff}}):
        return 409, {"detail": "A battle is already active"}
    bid = str(uuid.uuid4())[:8]
    db.battles.insert_one({"id": bid, "venue_a_id": va, "venue_b_id": vb, "taps_a": 0, "taps_b": 0, "created_at": datetime.now(timezone.utc)})
    return handle_get_active_battle()


# ── City Heat Map ─────────────────────────────────────────────────────────────

def handle_get_heat_map(city):
    """GET /api/heat-map/{city} — venue heat intensity grid."""
    db = get_db()
    if not db:
        return 503, {"detail": "Database unavailable"}
    import re as _re
    venues = list(db.venues.find({"city": {"$regex": city, "$options": "i"}},
        {"_id": 0, "id": 1, "name": 1, "area": 1, "lat": 1, "lng": 1, "current_vibe_score": 1, "energy_level": 1, "capacity_level": 1}))
    one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
    heat_points = []
    for v in venues:
        bolt_1h = db.venue_bolts.count_documents({"venue_id": v["id"], "created_at": {"$gte": one_hour_ago}})
        heat_points.append({
            "venue_id": v["id"], "name": v["name"], "area": v.get("area", ""),
            "lat": v.get("lat"), "lng": v.get("lng"),
            "vibe_score": v.get("current_vibe_score", 0),
            "energy_level": v.get("energy_level", "quiet"),
            "bolt_velocity_1h": bolt_1h,
            "heat_intensity": min(100, v.get("current_vibe_score", 0) + min(bolt_1h * 2, 30)),
        })
    area_map = {}
    for p in heat_points:
        area = p["area"] or "Other"
        area_map.setdefault(area, {"venues": [], "total_heat": 0, "bolt_total": 0})
        area_map[area]["venues"].append(p)
        area_map[area]["total_heat"] += p["heat_intensity"]
        area_map[area]["bolt_total"] += p["bolt_velocity_1h"]
    areas = sorted([
        {"area": area, "venue_count": len(info["venues"]), "avg_heat": round(info["total_heat"] / len(info["venues"])), "bolt_total_1h": info["bolt_total"], "top_venue": max(info["venues"], key=lambda x: x["heat_intensity"])["name"]}
        for area, info in area_map.items()
    ], key=lambda x: x["avg_heat"], reverse=True)
    return 200, {"city": city, "heat_points": heat_points, "areas": areas, "generated_at": datetime.now(timezone.utc).isoformat()}


# ── Afterhours / Night Recap ──────────────────────────────────────────────────

def handle_get_night_recap(headers):
    """GET /api/me/night-recap — tonight's activity debrief."""
    db = get_db()
    if not db:
        return 503, {"detail": "Database unavailable"}
    user = get_current_user(headers)
    if not user:
        return 401, {"detail": "Not authenticated"}
    user_id = user["id"]
    now = datetime.now(timezone.utc)
    if now.hour < 7:
        base = now - timedelta(days=1)
    else:
        base = now
    night_start = base.replace(hour=17, minute=0, second=0, microsecond=0)

    checkins_tonight = db.checkins.count_documents({"user_id": user_id, "created_at": {"$gte": night_start}})
    ratings_tonight  = db.ratings.count_documents({"user_id": user_id, "created_at": {"$gte": night_start}})

    bolt_docs = list(db.venue_bolts.aggregate([
        {"$match": {"user_id": user_id, "created_at": {"$gte": night_start}}},
        {"$group": {"_id": "$venue_id", "tap_count": {"$sum": 1}}},
        {"$sort": {"tap_count": -1}},
    ]))
    bolts_tonight = sum(d["tap_count"] for d in bolt_docs)

    top_venue = None
    if bolt_docs:
        v = db.venues.find_one({"id": bolt_docs[0]["_id"]}, {"name": 1, "area": 1, "energy_level": 1})
        if v:
            top_venue = {"venue_id": bolt_docs[0]["_id"], "venue_name": v["name"], "venue_area": v.get("area", ""), "energy_level": v.get("energy_level", "chill"), "tap_count": bolt_docs[0]["tap_count"]}

    checkin_docs = list(db.checkins.find({"user_id": user_id, "created_at": {"$gte": night_start}}, {"venue_id": 1, "venue_name": 1}))
    seen = {}
    for d in checkin_docs:
        seen[d["venue_id"]] = d.get("venue_name", "Unknown")
    venues_visited = [{"id": vid, "name": name} for vid, name in seen.items()]

    heat_score = checkins_tonight * 5 + ratings_tonight * 4 + bolts_tonight
    LEVELS = [(0, 0, "cold", "Cold", "#3A3A4E"), (1, 9, "warming", "Warming", "#6655FF"), (10, 24, "hot", "Hot", "#FF9933"), (25, 9999, "on_fire", "On Fire", "#FF3366")]
    level_row = LEVELS[0]
    for row in LEVELS:
        if heat_score >= row[0]:
            level_row = row
    _, _, heat_level, heat_label, heat_color = level_row

    streak_doc = db.streaks.find_one({"user_id": user_id}) or {}
    user_doc = db.users.find_one({"id": user_id}, {"hot_nights": 1}) or {}

    return 200, {
        "checkins_tonight": checkins_tonight, "ratings_tonight": ratings_tonight,
        "bolts_tonight": bolts_tonight, "venues_visited": venues_visited,
        "top_venue": top_venue, "heat_score": heat_score,
        "heat_level": heat_level, "heat_label": heat_label, "heat_color": heat_color,
        "streak_days": streak_doc.get("current_streak", 0),
        "hot_nights": user_doc.get("hot_nights", 0),
        "is_hot_night": heat_level in ("hot", "on_fire"),
        "night_start": night_start.isoformat(),
    }


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
    m = re.match(r'^/api/venues/([^/]+)/top-scouts$', path)
    if m:
        return handle_get_venue_top_scouts(m.group(1))
    m = re.match(r'^/api/venues/([^/]+)/oracle$', path)
    if m:
        return handle_get_oracle(m.group(1))
    m = re.match(r'^/api/users/([^/]+)/dna$', path)
    if m:
        return handle_get_user_dna_v2(m.group(1))
    m = re.match(r'^/api/ratings/status/([^/]+)/([^/]+)$', path)
    if m:
        return handle_get_rating_status(m.group(1), m.group(2))
    m = re.match(r'^/api/city-pulse/([^/]+)$', path)
    if m:
        return handle_get_city_pulse(m.group(1))
    m = re.match(r'^/api/venues/([^/]+)/reactions/rate$', path)
    if m:
        return handle_get_reaction_rate(m.group(1))
    m = re.match(r'^/api/crews/([^/]+)/locations$', path)
    if m:
        return handle_crew_locations(m.group(1), headers)
    # Venue Live — Follow status, heading count, live pushes
    if path == "/api/venues/me/following":
        return handle_get_following(headers)
    if path == "/api/venues/following/feed":
        return handle_get_following_feed(headers)
    m = re.match(r'^/api/venues/([^/]+)/heading-count$', path)
    if m:
        return handle_get_heading_count(m.group(1))
    m = re.match(r'^/api/venues/([^/]+)/follow-status$', path)
    if m:
        return handle_get_follow_status(m.group(1), headers)
    m = re.match(r'^/api/venues/([^/]+)/live-pushes$', path)
    if m:
        return handle_get_venue_live_pushes(m.group(1))
    if path == "/api/admin/config":
        return handle_admin_get_config()
    if path == "/api/admin/economy-config":
        return handle_get_economy_config()

    # Momentum, Missed Peaks, Scene Report
    if path == "/api/momentum":
        return handle_get_momentum()
    if path == "/api/notifications/missed-peaks":
        return handle_get_missed_peaks(headers)
    if path == "/api/scene-report":
        return handle_get_scene_report()

    # Coins + Reward Pool GET routes
    if path == "/api/coins/balance":
        return handle_get_coins_balance(headers)
    if path == "/api/coins/banks":
        return handle_get_banks(headers)
    if path == "/api/coins/bank-account":
        return handle_get_bank_account(headers)
    m = re.match(r'^/api/venues/([^/]+)/reward-pool$', path)
    if m:
        return handle_get_reward_pool(m.group(1))

    # Intelligence Layer GET routes
    m = re.match(r'^/api/area-pulse/([^/]+)$', path)
    if m:
        return handle_get_area_pulse(m.group(1))
    m = re.match(r'^/api/weather/([^/]+)$', path)
    if m:
        return handle_get_weather(m.group(1))
    m = re.match(r'^/api/tonight/([^/]+)$', path)
    if m:
        return handle_get_tonight(m.group(1))
    m = re.match(r'^/api/venues/([^/]+)/arrival-intel$', path)
    if m:
        return handle_get_arrival_intel(m.group(1))
    m = re.match(r'^/api/venues/([^/]+)/crowd-composition$', path)
    if m:
        return handle_get_crowd_composition(m.group(1))
    m = re.match(r'^/api/venues/([^/]+)/reputation$', path)
    if m:
        return handle_get_venue_reputation(m.group(1))

    # Tap History
    if path == "/api/me/tap-history":
        return handle_get_tap_history(headers)

    # Venue Battle
    if path == "/api/battles/active":
        return handle_get_active_battle()

    # City Heat Map
    m = re.match(r'^/api/heat-map/([^/]+)$', path)
    if m:
        return handle_get_heat_map(m.group(1))

    # Afterhours night recap
    if path == "/api/me/night-recap":
        return handle_get_night_recap(headers)

    return 404, {"detail": "Not found"}

def route_put(path, body, headers):
    """Route PUT requests."""
    if path == "/api/admin/config":
        return handle_admin_update_config(body)
    if path == "/api/admin/economy-config":
        return handle_update_economy_config(body)
    m = re.match(r'^/api/admin/venues/([^/]+)$', path)
    if m:
        return handle_admin_update_venue(m.group(1), body)
    return 404, {"detail": "Not found"}

def route_delete(path, headers):
    """Route DELETE requests."""
    m = re.match(r'^/api/admin/venues/([^/]+)$', path)
    if m:
        return handle_admin_delete_venue(m.group(1))
    # Venue Live — DELETE routes
    m = re.match(r'^/api/venues/([^/]+)/heading$', path)
    if m:
        return handle_cancel_heading(m.group(1), headers)
    m = re.match(r'^/api/venues/([^/]+)/follow$', path)
    if m:
        return handle_unfollow_venue(m.group(1), headers)
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
    if path == "/api/planner/chat":
        return handle_planner_chat(body)
    if path == "/api/pulse":
        return handle_drop_quick_pulse(body)

    # Dynamic routes
    m = re.match(r'^/api/venues/([^/]+)/react$', path)
    if m:
        return handle_react_to_venue(m.group(1), headers)
    m = re.match(r'^/api/venues/([^/]+)/direction-click$', path)
    if m:
        return handle_direction_click(m.group(1))
    # Venue Live — POST routes
    m = re.match(r'^/api/venues/([^/]+)/live-push$', path)
    if m:
        return handle_send_live_push(m.group(1), body, headers)
    m = re.match(r'^/api/venues/([^/]+)/heading$', path)
    if m:
        return handle_set_heading(m.group(1), body, headers)
    m = re.match(r'^/api/venues/([^/]+)/follow$', path)
    if m:
        return handle_follow_venue(m.group(1), headers)

    # Coins POST routes
    if path == "/api/coins/bank-account":
        return handle_post_bank_account(body, headers)
    if path == "/api/coins/cashout":
        return handle_post_cashout(body, headers)

    # Reward Pool POST route
    m = re.match(r'^/api/venues/([^/]+)/reward-pool/fund$', path)
    if m:
        return handle_fund_reward_pool(m.group(1), body, headers)

    # Venue Battle POST routes
    if path == "/api/battles":
        return handle_create_battle(body)
    m = re.match(r'^/api/battles/([^/]+)/tap/([ab])$', path)
    if m:
        return handle_tap_battle(m.group(1), m.group(2), headers)

    return 404, {"detail": "Not found"}


def handle_post_bank_account(body, headers):
    """Resolve + save bank account for coin cashouts."""
    db = get_db()
    if not db: return 503, {"detail": "Database unavailable"}
    user = get_current_user(headers)
    if not user: return 401, {"detail": "Not authenticated"}
    account_number = body.get("account_number", "")
    bank_code = body.get("bank_code", "")
    if not account_number or not bank_code:
        return 400, {"detail": "account_number and bank_code required"}
    paystack_key = os.environ.get("PAYSTACK_SECRET_KEY", "")
    if not paystack_key:
        return 503, {"detail": "Payment service not configured"}
    try:
        import urllib.request, urllib.parse
        resolve_url = f"https://api.paystack.co/bank/resolve?account_number={account_number}&bank_code={bank_code}"
        req = urllib.request.Request(resolve_url, headers={"Authorization": f"Bearer {paystack_key}"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            rdata = json.loads(resp.read())
        if not rdata.get("status"):
            return 400, {"ok": False, "detail": "Could not resolve account"}
        account_name = rdata["data"]["account_name"]
        # Create Paystack Transfer Recipient
        rcpt_data = json.dumps({"type": "nuban", "name": account_name, "account_number": account_number, "bank_code": bank_code, "currency": "NGN"}).encode()
        req2 = urllib.request.Request("https://api.paystack.co/transferrecipient", data=rcpt_data,
                                       headers={"Authorization": f"Bearer {paystack_key}", "Content-Type": "application/json"})
        with urllib.request.urlopen(req2, timeout=10) as resp2:
            rcpt = json.loads(resp2.read())
        recipient_code = rcpt.get("data", {}).get("recipient_code")
        masked = f"****{account_number[-4:]}"
        db.users.update_one({"id": user["id"]}, {"$set": {
            "paystack_recipient_code": recipient_code,
            "bank_account": {"account_name": account_name, "account_number_masked": masked, "bank_code": bank_code},
        }})
        return 200, {"ok": True, "account_name": account_name, "account_number_masked": masked}
    except Exception as e:
        return 500, {"ok": False, "detail": str(e)}


def handle_post_cashout(body, headers):
    """Request a coin cashout via Paystack Transfer."""
    db = get_db()
    if not db: return 503, {"detail": "Database unavailable"}
    user = get_current_user(headers)
    if not user: return 401, {"detail": "Not authenticated"}
    coins = int(body.get("coins", 0))
    if coins < 500: return 400, {"detail": "Minimum cashout is 500 coins"}
    wallet = db.vibe_coins.find_one({"user_id": user["id"]}) or {}
    if wallet.get("balance", 0) < coins: return 400, {"detail": "Insufficient coin balance"}
    udoc = db.users.find_one({"id": user["id"]}, {"_id": 0, "paystack_recipient_code": 1})
    if not udoc or not udoc.get("paystack_recipient_code"): return 400, {"detail": "No bank account saved"}
    is_vibe_plus = False
    vp_expires = user.get("vibe_plus_expires_at")
    now_iso = datetime.now(timezone.utc).isoformat()
    if vp_expires and vp_expires > now_iso: is_vibe_plus = True
    rate_kobo = 5000 if is_vibe_plus else 4000
    naira_kobo = int((coins / 100) * rate_kobo)
    paystack_key = os.environ.get("PAYSTACK_SECRET_KEY", "")
    if not paystack_key: return 503, {"detail": "Payment service not configured"}
    try:
        import urllib.request
        xfer_data = json.dumps({"source": "balance", "recipient": udoc["paystack_recipient_code"],
                                 "amount": naira_kobo, "reason": "Vibe Coins Cashout"}).encode()
        req = urllib.request.Request("https://api.paystack.co/transfer", data=xfer_data,
                                      headers={"Authorization": f"Bearer {paystack_key}", "Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            xdata = json.loads(resp.read())
        transfer_code = xdata.get("data", {}).get("transfer_code", "")
        db.vibe_coins.update_one({"user_id": user["id"]},
                                  {"$inc": {"balance": -coins, "total_cashed_out": coins}}, upsert=True)
        db.coin_transactions.insert_one({"id": str(uuid.uuid4()), "user_id": user["id"],
                                          "amount": -coins, "type": "cashout", "timestamp": datetime.now(timezone.utc)})
        naira_sent = naira_kobo // 100
        db.platform_revenue.insert_one({"id": str(uuid.uuid4()), "type": "coin_cashout_cut",
                                         "user_id": user["id"], "amount": int(naira_sent * 0.20),
                                         "timestamp": datetime.now(timezone.utc)})
        return 200, {"ok": True, "transfer_code": transfer_code, "naira_sent": naira_sent, "coins_deducted": coins}
    except Exception as e:
        return 500, {"ok": False, "detail": str(e)}


def handle_fund_reward_pool(venue_id, body, headers):
    """Merchant funds a scout reward pool from wallet."""
    db = get_db()
    if not db: return 503, {"detail": "Database unavailable"}
    user = get_current_user(headers)
    if not user: return 401, {"detail": "Not authenticated"}
    amount_naira = int(body.get("amount_naira", 0))
    if amount_naira < 5000: return 400, {"detail": "Minimum pool funding is ₦5,000"}
    venue = db.venues.find_one({"id": venue_id})
    if not venue: return 404, {"detail": "Venue not found"}
    wallet = db.merchant_wallets.find_one({"venue_id": venue_id})
    if not wallet or wallet.get("balance", 0) < amount_naira: return 400, {"detail": "Insufficient wallet balance"}
    coins_funded = int(amount_naira * 0.2)
    if amount_naira >= 25000: coins_funded = int(coins_funded * 1.1)
    coin_rate = int(body.get("coin_rate", 15))
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=7)
    result = db.merchant_wallets.update_one(
        {"venue_id": venue_id, "balance": {"$gte": amount_naira}},
        {"$inc": {"balance": -amount_naira, "total_spent": amount_naira}, "$set": {"updated_at": now}},
    )
    if result.modified_count == 0: return 400, {"detail": "Wallet deduction failed"}
    existing = db.venue_reward_pools.find_one({"venue_id": venue_id, "active": True})
    if existing:
        db.venue_reward_pools.update_one({"id": existing["id"]}, {
            "$inc": {"total_coins_funded": coins_funded, "coins_remaining": coins_funded},
            "$set": {"expires_at": expires_at.isoformat(), "coin_rate": coin_rate},
        })
        pool_id = existing["id"]
    else:
        pool_id = str(uuid.uuid4())
        db.venue_reward_pools.insert_one({"id": pool_id, "venue_id": venue_id, "funded_by": user["id"],
                                           "total_coins_funded": coins_funded, "coins_remaining": coins_funded,
                                           "coin_rate": coin_rate, "active": True,
                                           "funded_at": now.isoformat(), "expires_at": expires_at.isoformat()})
    return 200, {"ok": True, "pool_id": pool_id, "coins_funded": coins_funded, "coin_rate": coin_rate, "expires_at": expires_at.isoformat()}


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
