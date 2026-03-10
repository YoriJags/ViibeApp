"""
Vibe App - Vibe Score Calculation & Venue Aggregation
Core business logic for score computation, clout economy, and geofencing.
"""
import math
from datetime import datetime, timedelta, timezone
from app.config import db, GEOFENCE_RADIUS_METERS
from app.models import Coordinates


def calculate_vibe_score(energy: str, capacity: str, gate: str, venue_specific: str = None) -> float:
    """Calculate a 0-100 vibe score.

    Energy is the primary signal (80%). Venue-specific context is secondary (20%).
    Capacity acts as a potential-energy multiplier — it amplifies real energy but
    cannot create energy where none exists. Gate is stored for context only.

    Energy:        quiet=0, chill=25, warming=50, lit=75, peak=100
    Capacity mult: sparse=0.92x, vibrant=1.05x, full=1.15x
    """
    energy_scores = {"quiet": 0, "chill": 25, "warming": 50, "lit": 75, "peak": 100}
    venue_specific_map = {
        # Club / Rave — DJ set quality
        "mellow": 0, "good_set": 50, "killing_it": 100,
        # Bar — atmosphere
        "quiet_atm": 0, "decent_atm": 50, "loud_alive": 100,
        # Lounge — service vibe
        "slow_service": 0, "decent_service": 50, "on_point": 100,
        # Concert / Event — crowd response
        "flat_crowd": 0, "building_crowd": 50, "going_off": 100,
        # Block Party / Festival — movement
        "standing_around": 0, "mixed_movement": 50, "packed_dancing": 100,
    }
    capacity_multipliers = {"sparse": 0.92, "vibrant": 1.05, "full": 1.15}

    e = energy_scores.get(energy, 25)
    vs = venue_specific_map.get(venue_specific, 50) if venue_specific else 50
    base = (e * 0.80) + (vs * 0.20)
    multiplier = capacity_multipliers.get(capacity, 1.0)
    return round(min(100.0, base * multiplier), 1)


def get_venue_state(score: float, capacity: str) -> str:
    """Derive the display state label from score + capacity.

    CHARGED is a special state: the score is in the warming range but the crowd
    is large — potential energy that could convert to kinetic at any moment.
    """
    if score >= 85:
        return "peak"
    if score >= 65:
        return "lit"
    if score >= 45:
        return "charged" if capacity in ("full", "vibrant") else "warming"
    if score >= 20:
        return "chill"
    return "quiet"


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


async def compute_scout_credibility(user_id: str) -> float:
    """
    Scout credibility weight — 0.1 to 1.0.
    Based purely on experience (total ratings submitted).
    New scouts start at low weight; established scouts carry full weight.
    30+ ratings = full credibility. No ML, no manipulation — just track record.
    """
    total = await db.ratings.count_documents({"user_id": user_id})
    # 0 ratings → 0.15 (floor, not zero — every voice counts a little)
    # 10 ratings → 0.48
    # 30 ratings → 1.0 (cap)
    return min(1.0, max(0.15, total / 30))


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
            "energy_level": "quiet",
            "vibe_state": "quiet",
            "capacity_level": "sparse",
            "gate_level": "clear",
            "vibe_velocity": "stable",
            "total_ratings_24h": 0,
            "viibe_certified": False,
        }

    # Exclude ratings still in the provisional burst-detection hold
    ratings = await db.ratings.find({
        "venue_id": venue_id,
        "timestamp": {"$gte": hour_ago},
        "$or": [
            {"provisional": {"$ne": True}},
            {"provisional_until": {"$lte": now}},
        ],
    }).to_list(1000)

    if not ratings:
        base_score = venue.get("admin_override_score", 0) or 0
        glow_boost = venue.get("glow_boost", 0) or 0
        return {
            "current_vibe_score": min(100, base_score + glow_boost),
            "energy_level": "quiet",
            "vibe_state": "quiet",
            "capacity_level": "sparse",
            "gate_level": "clear",
            "vibe_velocity": "stable",
            "total_ratings_24h": 0,
            "viibe_certified": False,
        }

    weighted_scores = []
    energy_counts = {"quiet": 0, "chill": 0, "warming": 0, "lit": 0, "peak": 0}
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
            time_weight = 3.0
        elif minutes_ago <= 30:
            time_weight = 2.0
        else:
            time_weight = 1.0

        # Scout credibility weight: stored on rating at submission time.
        # Fallback 0.5 for legacy ratings that predate credibility scoring.
        credibility = rating.get("credibility_weight", 0.5)
        weight = time_weight * credibility

        score = rating.get("vibe_score", calculate_vibe_score(
            rating["energy"], rating["capacity"], rating["gate"],
            rating.get("venue_specific")
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

    # Derive display state — CHARGED when warming energy meets a full crowd
    vibe_state = get_venue_state(avg_score, capacity_level)

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

    # VIIBE CERTIFIED: peak energy + max pulse active simultaneously
    viibe_certified = avg_score >= 85 and ratings_24h >= 80
    viibe_certified_at = now if viibe_certified else None

    await db.venues.update_one(
        {"id": venue_id},
        {"$set": {
            "viibe_certified": viibe_certified,
            "viibe_certified_at": viibe_certified_at,
        }},
    )

    result = {
        "current_vibe_score": round(avg_score, 1),
        "energy_level": energy_level,
        "vibe_state": vibe_state,
        "capacity_level": capacity_level,
        "gate_level": gate_level,
        "vibe_velocity": velocity,
        "total_ratings_24h": ratings_24h,
        "viibe_certified": viibe_certified,
    }

    # Fire any matching venue energy alerts (non-blocking import avoids circular dep)
    from app.routes.alerts import check_venue_alerts
    await check_venue_alerts(venue_id, avg_score)

    return result


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

    # 3x PRO QUEST — Dark Spot bonus (venue with < 5 ratings in last 48h)
    # These are the blind spots in the intelligence map; scouts who light them up earn 3x.
    if await _is_dark_spot(venue_id):
        clout_bonus = int(clout_bonus * 3)

    # 2.5x HIDDEN GEM HUNT — Mid-week only (Mon–Thu), low-score but heating-up venues
    if _is_hidden_gem(venue):
        clout_bonus = int(clout_bonus * 2.5)

    # Hard cap: multipliers stack but total bonus cannot exceed 4x original
    clout_bonus = min(clout_bonus, int(accuracy / 10) * 4 + 20)

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


async def _is_dark_spot(venue_id: str) -> bool:
    """
    Pro Quest trigger: returns True if venue has fewer than 5 ratings in the last 48 hours.
    These are intelligence blind spots — scouts who report from here earn 3x clout.
    Anti-cheat: does NOT award dark spot bonus more than once per user per venue per day.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(hours=48)
    count = await db.ratings.count_documents({
        "venue_id": venue_id,
        "timestamp": {"$gte": cutoff},
    })
    return count < 5


def _is_hidden_gem(venue: dict) -> bool:
    """
    Hidden Gem Hunt trigger (mid-week only, Mon–Thu).
    Returns True if venue score is below 50 but momentum is heating_up.
    These are emerging spots that scouts discover before the crowd arrives.
    """
    now = datetime.now(timezone.utc)
    weekday = now.weekday()  # 0=Mon, 6=Sun
    if weekday > 3:          # Fri/Sat/Sun excluded — already hot nights
        return False
    score = venue.get("current_vibe_score", 100)
    velocity = venue.get("vibe_velocity", "stable")
    return score < 50 and velocity == "heating_up"
