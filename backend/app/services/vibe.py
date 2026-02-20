"""
Vibe App - Vibe Score Calculation & Venue Aggregation
Core business logic for score computation, clout economy, and geofencing.
"""
import math
from datetime import datetime, timedelta, timezone
from app.config import db, GEOFENCE_RADIUS_METERS
from app.models import Coordinates


def calculate_vibe_score(energy: str, capacity: str, gate: str) -> float:
    """Calculate a 0-100 vibe score from the three rating dimensions.
    Energy: chill(1) < buzzing(1.5) < popping(2) < electric(3)
    Capacity: sparse(1) < vibrant(2) < full(3)
    Gate: blocked(1) < slow(2) < clear(3)
    """
    energy_scores = {"chill": 1, "good_vibes": 1.5, "buzzing": 1.5, "popping": 2, "electric": 3}
    capacity_scores = {"sparse": 1, "vibrant": 2, "full": 3}
    gate_scores = {"clear": 3, "slow": 2, "blocked": 1}
    e = energy_scores.get(energy, 1)
    c = capacity_scores.get(capacity, 1)
    g = gate_scores.get(gate, 1)
    total = e + c + g
    return round((total / 9) * 100, 1)


def calculate_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance in meters between two coordinates using Haversine formula."""
    R = 6371000
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lng2 - lng1)
    a = math.sin(delta_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def is_within_geofence(user_coords: Coordinates, venue_coords: Coordinates, radius_m: float = None) -> bool:
    """Check if user is within geofence radius of venue."""
    if radius_m is None:
        radius_m = GEOFENCE_RADIUS_METERS
    distance = calculate_distance(
        user_coords.lat, user_coords.lng,
        venue_coords.lat, venue_coords.lng
    )
    return distance <= radius_m


async def calculate_venue_aggregate(venue_id: str) -> dict:
    """
    Calculate time-decay weighted aggregate vibe score for a venue.
    Weights: last 15 min = 3x, 15-30 min = 2x, 30-60 min = 1x
    """
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
            "total_ratings_24h": 0,
        }

    ratings = await db.ratings.find({
        "venue_id": venue_id,
        "timestamp": {"$gte": hour_ago},
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
            "total_ratings_24h": 0,
        }

    weighted_scores = []
    energy_counts = {"chill": 0, "popping": 0, "electric": 0}
    capacity_counts = {"sparse": 0, "vibrant": 0, "full": 0}
    gate_counts = {"clear": 0, "slow": 0, "blocked": 0}

    for rating in ratings:
        rating_time = rating.get("timestamp", now)
        if isinstance(rating_time, str):
            rating_time = datetime.fromisoformat(rating_time.replace("Z", "+00:00"))
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
    recent_count = sum(
        1 for r in ratings
        if _minutes_since(r.get("timestamp", now), now) <= 15
    )
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
        "timestamp": {"$gte": day_ago},
    })

    return {
        "current_vibe_score": round(avg_score, 1),
        "energy_level": energy_level,
        "capacity_level": capacity_level,
        "gate_level": gate_level,
        "vibe_velocity": velocity,
        "total_ratings_24h": ratings_24h,
    }


async def update_user_clout(user_id: str, venue_id: str, rating_score: float):
    """Update user's clout points, accuracy score, and scout status after a rating."""
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

    # Base clout calculation
    clout_bonus = int(accuracy / 10)
    if venue.get("current_vibe_score", 0) > 70:
        clout_bonus += 5

    # 2x CLOUT MULTIPLIER for Pulse Drop venues
    is_pulse_boosted = (
        venue.get("active_pulse_tier") is not None
        and venue.get("pulse_expires_at")
        and _parse_datetime(venue.get("pulse_expires_at")) > datetime.now(timezone.utc)
    )
    if is_pulse_boosted:
        clout_bonus = clout_bonus * 2

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
            "scout_status": status,
        }},
    )


async def save_vibe_snapshot(venue_id: str, aggregate: dict):
    """Save a vibe snapshot for timeline history. Called after each rating recalculation."""
    snapshot = {
        "venue_id": venue_id,
        "vibe_score": aggregate.get("current_vibe_score", 0),
        "energy_level": aggregate.get("energy_level", "chill"),
        "capacity_level": aggregate.get("capacity_level", "sparse"),
        "gate_level": aggregate.get("gate_level", "clear"),
        "total_ratings_24h": aggregate.get("total_ratings_24h", 0),
        "timestamp": datetime.now(timezone.utc),
    }
    await db.vibe_snapshots.insert_one(snapshot)

    # Aura Shield check
    await _check_aura_shield(venue_id, aggregate)


async def _check_aura_shield(venue_id: str, aggregate: dict):
    """Check if venue's Aura Shield should trigger an alert."""
    shield = await db.aura_shields.find_one({"venue_id": venue_id})
    if not shield or not shield.get("enabled"):
        return

    score = aggregate.get("current_vibe_score", 100)
    threshold = shield.get("threshold", 50)
    alert_on = shield.get("alert_on", [])

    should_alert = False
    alert_reason = ""

    if "score_drop" in alert_on and score < threshold:
        should_alert = True
        alert_reason = f"Vibe score dropped to {score:.0f}% (threshold: {threshold}%)"

    if "gate_blocked" in alert_on and aggregate.get("gate_level") == "blocked":
        should_alert = True
        alert_reason = "Gate is currently BLOCKED - scouts are reporting delays"

    if "capacity_full" in alert_on and aggregate.get("capacity_level") == "full":
        should_alert = True
        alert_reason = "Venue at FULL capacity - energy may drop"

    if should_alert:
        from app.services.notifications import notify_merchant_vibe_alert
        await notify_merchant_vibe_alert(venue_id, score, alert_reason)


def _parse_datetime(value) -> datetime:
    """Safely parse a datetime value that may be string or datetime."""
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value
    return datetime.fromisoformat(str(value).replace("Z", "+00:00"))


def _minutes_since(timestamp, now: datetime) -> float:
    """Get minutes elapsed since a timestamp."""
    if isinstance(timestamp, str):
        timestamp = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
    if timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=timezone.utc)
    return (now - timestamp).total_seconds() / 60
