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
        query["city"] = city.lower()
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

    # Validate energy — accept both old 'good_vibes' (legacy) and new 'buzzing'
    energy = body.get("energy", "chill")
    if energy == "good_vibes":
        energy = "buzzing"
    valid_energies = {"chill", "buzzing", "popping", "electric"}
    if energy not in valid_energies:
        return 400, {"detail": f"Invalid energy value '{energy}'. Must be one of: {sorted(valid_energies)}"}

    vibe_score = calculate_vibe_score(energy, body["capacity"], body["gate"])
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
_ORACLE_ENERGY_LABELS = {"club":"electric","lounge":"popping","bar":"popping","restaurant":"warm","concert":"electric","rave":"electric","block_party":"electric","event":"popping","church":"uplifting"}

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
    energy_label = _ORACLE_ENERGY_LABELS.get(venue_type, "popping")
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


def handle_react_to_venue(venue_id: str, body: dict):
    """POST /api/venues/{venue_id}/react — live bolt reaction (Vibe+ only)."""
    db = get_db()
    if not db:
        return 503, {"detail": "Database unavailable"}

    user_id = body.get("user_id")
    if not user_id:
        return 400, {"detail": "user_id required"}

    now = datetime.now(timezone.utc)
    user = db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        return 404, {"detail": "User not found"}

    is_vibe_plus = user.get("is_vibe_plus") and (
        not user.get("vibe_plus_expires_at")
        or user["vibe_plus_expires_at"] > now
    )
    if not is_vibe_plus:
        return 403, {"detail": "Live reactions are a Vibe+ feature. Upgrade to react in real time."}

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

    db.reactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "venue_id": venue_id,
        "timestamp": now,
    })

    # Reaction rate: total taps in last 5 min
    window_start = now - timedelta(minutes=5)
    total_reactions = db.reactions.count_documents({
        "venue_id": venue_id,
        "timestamp": {"$gte": window_start},
    })
    reactions_per_min = round(total_reactions / 5, 1)

    pipeline = [
        {"$match": {"venue_id": venue_id, "timestamp": {"$gte": window_start}}},
        {"$group": {"_id": "$user_id"}},
        {"$count": "total"},
    ]
    scout_result = list(db.reactions.aggregate(pipeline))
    active_scouts = scout_result[0]["total"] if scout_result else 1

    return 200, {
        "ok": True,
        "reactions_per_min": reactions_per_min,
        "active_scouts": active_scouts,
    }


def handle_get_reaction_rate(venue_id: str):
    """GET /api/venues/{venue_id}/reactions/rate — current reaction rate."""
    db = get_db()
    if not db:
        return 503, {"detail": "Database unavailable"}

    now          = datetime.now(timezone.utc)
    window_start = now - timedelta(minutes=5)

    total_reactions = db.reactions.count_documents({
        "venue_id": venue_id,
        "timestamp": {"$gte": window_start},
    })
    reactions_per_min = round(total_reactions / 5, 1)

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
        return handle_get_user_dna(m.group(1))
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
    if path == "/api/admin/config":
        return handle_admin_get_config()
    if path == "/api/admin/economy-config":
        return handle_get_economy_config()

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
        return handle_react_to_venue(m.group(1), body)
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
