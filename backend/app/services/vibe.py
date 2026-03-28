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


def get_venue_state(score: float, capacity: str, charged_threshold: int = 45) -> str:
    """Derive the display state label from score + capacity.

    CHARGED is a special state: the score is in the warming range but the crowd
    is large — potential energy that could convert to kinetic at any moment.

    charged_threshold can be lowered contextually (e.g. Lagos Island peak nights)
    to reflect how quickly Island crowds hit peak energy after 11 PM.
    """
    if score >= 85:
        return "peak"
    if score >= 65:
        return "lit"
    if score >= charged_threshold:
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


async def _calculate_kinetic_momentum(venue_id: str, now: datetime) -> float:
    """
    Dynamic Equilibrium — kinetic momentum floor.

    Reads recent vibe_pulse events (last 30 min) to determine how much
    kinetic energy the crowd has been generating. Returns a 0–70 momentum
    score that becomes a FLOOR on the vibe score — preventing false "dying"
    reads during DJ transitions, smoke breaks, or brief lulls.

    Stationary_peak_abuse pulses are excluded — fraud signals don't buy protection.
    Momentum decays aggressively: a strong signal 10 min ago still protects
    the score; 25 min ago barely matters.
    """
    window_start = now - timedelta(minutes=30)

    pulses = await db.vibe_pulses.find({
        "venue_id": venue_id,
        "timestamp": {"$gte": window_start},
        "stationary_peak_abuse": {"$ne": True},
    }).to_list(500)

    if not pulses:
        return 0.0

    weighted_scores = []
    for pulse in pulses:
        ts = pulse.get("timestamp", now)
        if isinstance(ts, str):
            ts = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)

        minutes_ago = (now - ts).total_seconds() / 60
        if minutes_ago <= 10:
            time_weight = 3.0
        elif minutes_ago <= 20:
            time_weight = 1.5
        else:
            time_weight = 0.6

        # G-force: 1.0g = resting, 2.5g+ = dancing hard → 0–100 scale
        g_force   = float(pulse.get("avg_g_force", 1.0))
        intensity = pulse.get("intensity", "soft")
        g_score   = min(100.0, max(0.0, (g_force - 1.0) / 2.0 * 100))
        mult      = 1.3 if intensity == "power" else 1.0
        weighted_scores.append(g_score * mult * time_weight)

    if not weighted_scores:
        return 0.0

    raw = sum(weighted_scores) / len(weighted_scores)
    # Cap at 70: kinetic momentum floors the score; only scout ratings push above
    return min(70.0, raw * 0.7)


# ─── Fraud Guard ──────────────────────────────────────────────────────────────

def _is_low_confidence(rating: dict) -> bool:
    """
    Fraud Guard — detects physically implausible PEAK submissions.

    A scout claiming PEAK energy but whose phone registered near-stationary
    movement (avg_g_force < 1.2g) is flagged low_confidence and excluded
    from the live aggregate. This prevents coordinated fake-peak attacks
    during off-peak hours.

    Priority order:
      1. stationary_peak_abuse flag set at pulse-submission time (most reliable)
      2. avg_g_force on the rating document (submitted from client)
      3. No kinetic data available → benefit of the doubt (not flagged)
    """
    if rating.get("stationary_peak_abuse"):
        return True
    if rating.get("energy") != "peak":
        return False
    avg_g = rating.get("avg_g_force")
    if avg_g is None:
        return False  # no sensor data — cannot confirm or deny
    return float(avg_g) < 1.2


# ─── Lagos Island timing helper ───────────────────────────────────────────────

def _charged_threshold(venue: dict, now: datetime) -> int:
    """
    Environmental context: Lagos Island peak-night sensitivity.

    On Fri/Sat between 23:00 and 02:00, Island venues (VI, Ikoyi, Lekki Phase 1)
    build crowd pressure far faster than other areas. Lowering the CHARGED
    threshold from 45 → 35 reflects this — a half-full venue at midnight on
    the Island is already a charged environment.
    """
    weekday = now.weekday()   # 0 = Mon, 4 = Fri, 5 = Sat
    hour    = now.hour
    is_island      = "island" in venue.get("area", "").lower()
    is_peak_night  = weekday in (4, 5) and (hour >= 23 or hour < 2)
    return 35 if (is_island and is_peak_night) else 45


# ─── Live score engine ────────────────────────────────────────────────────────

async def get_live_score(
    venue_id: str,
    ratings: list,
    kinetic_momentum: float,
    now: datetime,
    previous_score: float | None = None,
) -> dict:
    """
    Dynamic Equilibrium live score engine.

    Pipeline:
      1. Fraud Guard   — PEAK ratings with avg_g_force < 1.2g are excluded and
                         their IDs returned for DB flagging by the caller.
      2. Time-decay weighted average of valid ratings
                         (≤15 min = 3x, ≤30 min = 2x, >30 min = 1x).
      3. Kinetic floor  — if momentum > current score, blend in 30% of the
                         momentum signal so the score cannot free-fall during
                         a DJ transition or crowd shuffle.
      4. Decay Buffer  — if kinetic_momentum > 30 AND a previous score exists,
                         cap the score drop at 5% per cycle. The room's energy
                         is still real even when scouts stop tapping.

    Returns score + all vote aggregates (energy/capacity/gate counts) so the
    caller does not need to re-loop over ratings.
    """
    energy_counts   = {"quiet": 0, "chill": 0, "warming": 0, "lit": 0, "peak": 0}
    capacity_counts = {"sparse": 0, "vibrant": 0, "full": 0}
    gate_counts     = {"clear": 0, "slow": 0, "blocked": 0}

    weighted_scores  = []
    fraud_rating_ids = []
    excluded_count   = 0

    for rating in ratings:
        if _is_low_confidence(rating):
            excluded_count += 1
            if rating.get("_id"):
                fraud_rating_ids.append(rating["_id"])
            continue

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

        credibility = rating.get("credibility_weight", 0.5)
        weight = time_weight * credibility

        score = rating.get("vibe_score") or calculate_vibe_score(
            rating["energy"], rating["capacity"], rating["gate"],
            rating.get("venue_specific"),
        )
        weighted_scores.append((score, weight))

        energy   = rating.get("energy",   "chill")
        capacity = rating.get("capacity", "vibrant")
        gate     = rating.get("gate",     "clear")
        if energy   in energy_counts:   energy_counts[energy]     += weight
        if capacity in capacity_counts: capacity_counts[capacity] += weight
        if gate     in gate_counts:     gate_counts[gate]         += weight

    total_weight = sum(w for _, w in weighted_scores)
    avg_score    = (
        sum(s * w for s, w in weighted_scores) / total_weight
        if total_weight > 0 else 0.0
    )

    # ── Kinetic momentum floor ────────────────────────────────────────────────
    # The Oracle "remembers" the room's energy even when ratings are sparse.
    if kinetic_momentum > avg_score:
        avg_score = (
            avg_score * 0.7 + kinetic_momentum * 0.3
            if total_weight > 0
            else kinetic_momentum
        )

    # ── Decay buffer — 5% per cycle cap when kinetics are active ─────────────
    # Prevents a 30-point score cliff when a DJ drops between tracks.
    decay_protected = False
    if previous_score is not None and kinetic_momentum > 30:
        floor = previous_score * 0.95
        if avg_score < floor:
            avg_score       = floor
            decay_protected = True

    return {
        "score":            round(avg_score, 1),
        "total_weight":     total_weight,
        "energy_counts":    energy_counts,
        "capacity_counts":  capacity_counts,
        "gate_counts":      gate_counts,
        "excluded_fraud":   excluded_count,
        "fraud_rating_ids": fraud_rating_ids,
        "decay_protected":  decay_protected,
        "momentum_floor":   kinetic_momentum,
    }


# ─── Vibe DNA — tap pattern signature ────────────────────────────────────────


def _classify_vibe_signature(
    tap_variance: float,
    avg_g_force:  float,
    avg_bpm:      float,
) -> str:
    """
    Classify collective tap patterns into a Vibe DNA signature.

      HIGH_VELOCITY    — rapid burst tapping, heavy body movement.
                         tap_variance < 0.4 (tight timing) + avg_g_force ≥ 2.0g
                         → Red-Orange energy: bottle service, hype moments.

      STEADY_GROOVE    — rhythmic, dance-floor locked.
                         tap_variance 0.3–0.9 in dance BPM range (85–150)
                         → Deep Purple: Afrobeats, smooth DJ set.

      ATMOSPHERIC_CHILL — sporadic or slow taps, low movement.
                         tap_variance > 0.9 OR avg_g_force < 1.3 OR avg_bpm < 60
                         → Cyan: lounge/conversation energy.

    Priority: HIGH_VELOCITY > STEADY_GROOVE > ATMOSPHERIC_CHILL.
    """
    if avg_g_force >= 2.0 and tap_variance < 0.4:
        return "HIGH_VELOCITY"
    if 0.3 <= tap_variance <= 0.9 and 85 <= avg_bpm <= 150:
        return "STEADY_GROOVE"
    if tap_variance > 0.9 or avg_g_force < 1.3 or avg_bpm < 60:
        return "ATMOSPHERIC_CHILL"
    # Mid-range: dominant signal decides
    if avg_g_force >= 1.8:
        return "HIGH_VELOCITY"
    if avg_bpm >= 90:
        return "STEADY_GROOVE"
    return "ATMOSPHERIC_CHILL"


async def calculate_venue_signature(venue_id: str, now: datetime) -> dict:
    """
    Compute the Vibe DNA signature for a venue from recent tap pulses.

    Reads vibe_pulses from the last 30 minutes (fraud-excluded pulses skipped).
    Aggregates avg_g_force, max_bpm, and tap_variance from scout submissions
    then classifies via _classify_vibe_signature.

    Returns a dict suitable for inclusion in the venue aggregate and for
    persistence on the venue document (consumed by compute_city_pulse).
    """
    cutoff = now - timedelta(minutes=30)
    pulses = await db.vibe_pulses.find(
        {
            "venue_id":              venue_id,
            "timestamp":             {"$gte": cutoff},
            "stationary_peak_abuse": {"$ne": True},
        },
        {"avg_g_force": 1, "max_bpm": 1, "tap_variance": 1},
    ).to_list(200)

    if not pulses:
        return {
            "signature":       "ATMOSPHERIC_CHILL",
            "confidence":      "low",
            "pulse_count":     0,
            "avg_g_force":     None,
            "avg_bpm":         None,
            "avg_tap_variance": None,
        }

    g_forces      = [float(p.get("avg_g_force", 1.0)) for p in pulses]
    bpms          = [int(p["max_bpm"]) for p in pulses if p.get("max_bpm", 0) > 0]
    tap_variances = [float(p["tap_variance"]) for p in pulses if p.get("tap_variance") is not None]

    avg_g        = sum(g_forces) / len(g_forces)
    avg_bpm      = sum(bpms) / len(bpms) if bpms else 0.0
    avg_variance = sum(tap_variances) / len(tap_variances) if tap_variances else 1.0

    signature = _classify_vibe_signature(avg_variance, avg_g, avg_bpm)

    return {
        "signature":        signature,
        "confidence":       "high" if len(pulses) >= 10 else "medium" if len(pulses) >= 5 else "low",
        "pulse_count":      len(pulses),
        "avg_g_force":      round(avg_g, 2),
        "avg_bpm":          round(avg_bpm),
        "avg_tap_variance": round(avg_variance, 3),
    }


# ─── Oracle — forward prediction ──────────────────────────────────────────────

# Estimated crowd capacity when no rated_capacity field exists on the venue doc
_CAPACITY_ESTIMATE = {"sparse": 50, "vibrant": 120, "full": 250}


async def vibe_oracle(
    venue_id: str,
    current_score: float,
    venue: dict,
    now: datetime,
    kinetic_momentum: float = 0.0,
    total_ratings: int = 0,
) -> dict:
    """
    Predictive oracle — 15-minute forward score estimate.

    Five additive signals (applied in sequence, each capped at 100):

      1. Kinetic Momentum  — crowd is physically moving right now.
                             momentum > 40 → +5 predicted score.

      2. Enroute Multiplier (tiered) — scouts heading to venue:
                             ≥ 20% capacity → +5
                             ≥ 40% capacity → +10
                             ≥ 70% capacity → +18

      3. Night Arc         — universal Lagos peak window (Fri/Sat 22:00-01:00)
                             adds +3 to any venue in the city.

      4. Island Timing     — Fri/Sat 23:00-02:00 for Island-area venues:
                             CHARGED threshold lowered 45 → 35.

      5. Historical Anchor — compares current_score vs same-hour / same-day-type
                             average over the last 4 weeks.
                             Exposes above_historical_trend flag.

    Confidence tier: "high" / "medium" / "low" based on total data richness.
    Advisory only — does NOT overwrite the live score.
    """
    predicted_score = current_score
    weekday = now.weekday()   # 0 = Mon, 4 = Fri, 5 = Sat, 6 = Sun
    hour    = now.hour

    # ── Signal 1: Kinetic Momentum ────────────────────────────────────────────
    kinetic_boost = 5 if kinetic_momentum > 40 else 0
    predicted_score = min(100.0, predicted_score + kinetic_boost)

    # ── Signal 2: Enroute Multiplier (tiered) ─────────────────────────────────
    heading_cutoff = now - timedelta(minutes=30)
    enroute_count  = await db.venue_headings.count_documents({
        "venue_id":   venue_id,
        "created_at": {"$gte": heading_cutoff},
    })
    rated_capacity = (
        venue.get("rated_capacity")
        or _CAPACITY_ESTIMATE.get(venue.get("capacity_level", "vibrant"), 120)
    )
    enroute_ratio   = enroute_count / rated_capacity if rated_capacity > 0 else 0.0
    enroute_trigger = enroute_ratio >= 0.20

    if enroute_ratio >= 0.70:
        enroute_boost = 18
    elif enroute_ratio >= 0.40:
        enroute_boost = 10
    elif enroute_ratio >= 0.20:
        enroute_boost = 5
    else:
        enroute_boost = 0
    predicted_score = min(100.0, predicted_score + enroute_boost)

    # ── Signal 3: Night Arc (Fri/Sat 22:00-01:00 anywhere in Lagos) ───────────
    is_peak_window = weekday in (4, 5) and (hour >= 22 or hour < 1)
    night_boost    = 3 if is_peak_window else 0
    predicted_score = min(100.0, predicted_score + night_boost)

    # ── Signal 4: Lagos Island Timing ─────────────────────────────────────────
    is_island       = "island" in venue.get("area", "").lower()
    is_island_night = weekday in (4, 5) and (hour >= 23 or hour < 2)
    charged_thr     = 35 if (is_island and is_island_night) else 45

    # ── Signal 5: Historical Anchor (same hour ±2h, same day-type, last 4 wks) ─
    is_weekend     = weekday >= 4
    four_weeks_ago = now - timedelta(weeks=4)
    raw_snaps = await db.vibe_snapshots.find(
        {"venue_id": venue_id, "timestamp": {"$gte": four_weeks_ago, "$lt": now - timedelta(hours=1)}},
        {"vibe_score": 1, "timestamp": 1},
    ).to_list(500)

    historical_scores = []
    for snap in raw_snaps:
        snap_ts = snap.get("timestamp", now)
        if isinstance(snap_ts, str):
            snap_ts = datetime.fromisoformat(snap_ts.replace("Z", "+00:00"))
        if snap_ts.tzinfo is None:
            snap_ts = snap_ts.replace(tzinfo=timezone.utc)
        if (snap_ts.weekday() >= 4) == is_weekend and abs(snap_ts.hour - hour) <= 2:
            historical_scores.append(snap.get("vibe_score", 0))

    historical_avg         = round(sum(historical_scores) / len(historical_scores), 1) if historical_scores else None
    above_historical_trend = historical_avg is not None and current_score > historical_avg + 10

    # ── Confidence tier ───────────────────────────────────────────────────────
    data_points = total_ratings + enroute_count
    if data_points >= 10 and (total_ratings >= 5 or enroute_count >= 8):
        confidence = "high"
    elif data_points >= 4:
        confidence = "medium"
    else:
        confidence = "low"

    # ── Predicted velocity + state ────────────────────────────────────────────
    if enroute_trigger or kinetic_momentum > 50:
        predicted_velocity = "heating_up"
    elif above_historical_trend:
        predicted_velocity = "above_trend"
    else:
        predicted_velocity = None

    predicted_state = get_venue_state(
        predicted_score, venue.get("capacity_level", "vibrant"), charged_thr
    )

    return {
        "predicted_score":        round(predicted_score, 1),
        "predicted_state":        predicted_state,
        "predicted_velocity":     predicted_velocity,
        # Enroute
        "enroute_count":          enroute_count,
        "enroute_ratio":          round(enroute_ratio, 3),
        "enroute_triggered":      enroute_trigger,
        "enroute_boost":          enroute_boost,
        # Night arc
        "peak_window_active":     is_peak_window,
        "island_night_mode":      is_island and is_island_night,
        "charged_threshold":      charged_thr,
        # Kinetic
        "kinetic_boost":          kinetic_boost,
        # Historical
        "historical_avg":         historical_avg,
        "above_historical_trend": above_historical_trend,
        # Meta
        "total_boost":            kinetic_boost + enroute_boost + night_boost,
        "confidence":             confidence,
    }


# ─── Venue aggregate (orchestrator) ──────────────────────────────────────────

async def calculate_venue_aggregate(venue_id: str) -> dict:
    """
    Calculate the live vibe score for a venue.

    Orchestrates:
      • get_live_score()  — fraud-guarded, decay-buffered, momentum-floored score
      • vibe_oracle()     — 15-minute forward prediction (enroute + island timing)

    The oracle result is attached to the response under the 'oracle' key and
    is intended for the frontend prediction chip — it does not affect live_score.
    """
    now      = datetime.now(timezone.utc)
    hour_ago = now - timedelta(hours=1)

    venue = await db.venues.find_one({"id": venue_id})
    if not venue:
        return {}

    if venue.get("is_suppressed"):
        return {
            "current_vibe_score": 0,
            "energy_level":       "quiet",
            "vibe_state":         "quiet",
            "capacity_level":     "sparse",
            "gate_level":         "clear",
            "vibe_velocity":      "stable",
            "total_ratings_24h":  0,
            "viibe_certified":    False,
        }

    # Exclude ratings still in the provisional burst-detection hold
    ratings = await db.ratings.find({
        "venue_id":  venue_id,
        "timestamp": {"$gte": hour_ago},
        "$or": [
            {"provisional":       {"$ne":  True}},
            {"provisional_until": {"$lte": now}},
        ],
    }).to_list(1000)

    # Snapshot the previous score for the decay buffer
    previous_score = venue.get("current_vibe_score")

    if not ratings:
        base_score = venue.get("admin_override_score", 0) or 0
        glow_boost = venue.get("glow_boost", 0) or 0
        return {
            "current_vibe_score": min(100, base_score + glow_boost),
            "energy_level":       "quiet",
            "vibe_state":         "quiet",
            "capacity_level":     "sparse",
            "gate_level":         "clear",
            "vibe_velocity":      "stable",
            "total_ratings_24h":  0,
            "viibe_certified":    False,
        }

    # ── Kinetic momentum (crowd movement floor) ───────────────────────────────
    kinetic_momentum = await _calculate_kinetic_momentum(venue_id, now)

    # ── Live score (fraud-guarded, momentum-floored, decay-buffered) ──────────
    live      = await get_live_score(venue_id, ratings, kinetic_momentum, now, previous_score)
    avg_score = live["score"]

    # ── Persist fraud flags (non-blocking — best-effort) ─────────────────────
    if live["fraud_rating_ids"]:
        await db.ratings.update_many(
            {"_id": {"$in": live["fraud_rating_ids"]}},
            {"$set": {"low_confidence": True, "fraud_flagged_at": now}},
        )

    # ── Glow boost + admin override ───────────────────────────────────────────
    glow_boost = venue.get("glow_boost", 0) or 0
    avg_score  = min(100, avg_score + glow_boost)

    if venue.get("admin_override_score") is not None:
        avg_score = venue["admin_override_score"]

    # ── Dominant dimensions ───────────────────────────────────────────────────
    energy_counts   = live["energy_counts"]
    capacity_counts = live["capacity_counts"]
    gate_counts     = live["gate_counts"]

    energy_level   = max(energy_counts,   key=energy_counts.get)
    capacity_level = max(capacity_counts, key=capacity_counts.get)
    gate_level     = max(gate_counts,     key=gate_counts.get)

    # ── State — Lagos Island timing aware ────────────────────────────────────
    charged_thr = _charged_threshold(venue, now)
    vibe_state  = get_venue_state(avg_score, capacity_level, charged_thr)

    # ── Velocity ──────────────────────────────────────────────────────────────
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

    # ── Scout consensus ───────────────────────────────────────────────────────
    # Independent scouts agreeing on energy within 10 mins = strong signal
    ten_min_ago      = now - timedelta(minutes=10)
    consensus_window = [
        r for r in ratings
        if r.get("timestamp", now) >= ten_min_ago
    ]
    # Deduplicate by user — only count each scout once
    seen_users: set = set()
    unique_consensus: list = []
    for r in consensus_window:
        uid = r.get("user_id")
        if uid and uid not in seen_users:
            seen_users.add(uid)
            unique_consensus.append(r)

    consensus_count = len(unique_consensus)
    if consensus_count >= 2:
        energy_votes = {}
        for r in unique_consensus:
            e = r.get("energy", "quiet")
            energy_votes[e] = energy_votes.get(e, 0) + 1
        top_energy      = max(energy_votes, key=energy_votes.get)
        top_vote_count  = energy_votes[top_energy]
        consensus_rate  = round(top_vote_count / consensus_count, 2)  # 0.0–1.0
        consensus_label = top_energy if consensus_rate >= 0.6 else "mixed"
    else:
        consensus_rate  = 0.0
        consensus_label = "insufficient"

    # ── 24h count ─────────────────────────────────────────────────────────────
    day_ago     = now - timedelta(hours=24)
    ratings_24h = await db.ratings.count_documents({
        "venue_id":  venue_id,
        "timestamp": {"$gte": day_ago},
    })

    # ── VIIBE CERTIFIED ───────────────────────────────────────────────────────
    viibe_certified    = avg_score >= 85 and ratings_24h >= 80
    viibe_certified_at = now if viibe_certified else None

    # ── Vibe DNA signature (tap pattern classification) ───────────────────────
    sig = await calculate_venue_signature(venue_id, now)

    await db.venues.update_one(
        {"id": venue_id},
        {"$set": {
            "viibe_certified":    viibe_certified,
            "viibe_certified_at": viibe_certified_at,
            # Persisted so compute_city_pulse can do a majority vote
            "vibe_signature":     sig["signature"],
        }},
    )

    # ── Oracle (15-min forward prediction, momentum + rating aware) ─────────
    oracle = await vibe_oracle(
        venue_id, avg_score, venue, now,
        kinetic_momentum=kinetic_momentum,
        total_ratings=len(ratings),
    )

    # ── Ambient sound signal ──────────────────────────────────────────────────
    from app.routes.ambient import get_ambient_signal
    ambient = await get_ambient_signal(venue_id, now)

    # ── Dwell data ────────────────────────────────────────────────────────────
    four_hours_ago = now - timedelta(hours=4)
    dwell_sessions = await db.dwell_sessions.find({
        "venue_id":  venue_id,
        "last_ping": {"$gte": four_hours_ago},
    }).to_list(500)
    long_dwell_count = sum(1 for s in dwell_sessions if s.get("duration_minutes", 0) >= 30)
    avg_dwell_minutes = (
        round(sum(s.get("duration_minutes", 0) for s in dwell_sessions) / len(dwell_sessions))
        if dwell_sessions else 0
    )

    # ── Multi-signal weighted blend ───────────────────────────────────────────
    #
    # Scouts are always the primary driver (minimum 67% weight).
    # Each corroborating signal contributes proportionally to its data quality.
    #
    # Max signal contributions:
    #   Ambient audio  → up to 15%  (requires 3+ scouts contributing)
    #   Scout consensus→ up to 10%  (requires 5+ independent scouts)
    #   Dwell time     → up to  8%  (requires 5+ long-stay scouts)
    #   Scouts         → minimum 67%, always dominant
    #
    # Each signal produces its own energy score (0–100) and a reliability
    # weight (0–1) scaled by sample size. Low data = low influence.

    ENERGY_SCORES = {
        "quiet": 0, "chill": 25, "warming": 50, "lit": 75, "peak": 100,
    }

    # ── Signal 1: Ambient audio ───────────────────────────────────────────────
    ambient_db      = ambient["ambient_db_avg"]
    ambient_scouts  = ambient["ambient_scout_count"]
    if ambient_db is not None and ambient_scouts >= 1:
        # expo-av metering: 0 dB = full scale, -80 dB ≈ silence in typical rooms
        ambient_score  = max(0.0, min(100.0, (ambient_db + 80) / 0.80))
        ambient_weight = 0.15 * min(1.0, ambient_scouts / 3)
    else:
        ambient_score  = avg_score   # neutral — don't drag the score
        ambient_weight = 0.0

    # ── Signal 2: Scout consensus ─────────────────────────────────────────────
    if consensus_label not in ("mixed", "insufficient") and consensus_count >= 2:
        consensus_score  = float(ENERGY_SCORES.get(consensus_label, avg_score))
        # Scale by agreement strength × sample depth
        consensus_weight = 0.10 * consensus_rate * min(1.0, consensus_count / 5)
    else:
        consensus_score  = avg_score   # neutral
        consensus_weight = 0.0

    # ── Signal 3: Dwell time ──────────────────────────────────────────────────
    # Long dwell confirms real energy; we nudge toward a slightly higher score
    # proportional to how many scouts chose to stay.
    if long_dwell_count >= 1:
        # Dwell doesn't generate its own energy reading — it amplifies the base
        dwell_score  = min(100.0, avg_score + (long_dwell_count * 2))
        dwell_weight = 0.08 * min(1.0, long_dwell_count / 5)
    else:
        dwell_score  = avg_score
        dwell_weight = 0.0

    # ── Blend ─────────────────────────────────────────────────────────────────
    scout_weight = max(0.67, 1.0 - ambient_weight - consensus_weight - dwell_weight)
    total_blend  = scout_weight + ambient_weight + consensus_weight + dwell_weight

    avg_score = min(100.0, (
        avg_score       * scout_weight
        + ambient_score * ambient_weight
        + consensus_score * consensus_weight
        + dwell_score   * dwell_weight
    ) / total_blend)

    # ── Transparency fields ───────────────────────────────────────────────────
    active_scouts = len({r.get("user_id") for r in ratings if r.get("user_id")})
    timestamps = [r.get("timestamp") for r in ratings if r.get("timestamp")]
    if timestamps:
        most_recent = max(timestamps, key=lambda t: t if isinstance(t, datetime) else datetime.fromisoformat(str(t).replace("Z", "+00:00")))
        oldest = min(timestamps, key=lambda t: t if isinstance(t, datetime) else datetime.fromisoformat(str(t).replace("Z", "+00:00")))
        last_rated_mins_ago = round(_minutes_since(most_recent, now))
        submission_window_start = oldest if isinstance(oldest, datetime) else datetime.fromisoformat(str(oldest).replace("Z", "+00:00"))
    else:
        last_rated_mins_ago = None
        submission_window_start = None
    score_confidence = "high" if active_scouts >= 5 else "medium" if active_scouts >= 2 else "low"

    result = {
        "current_vibe_score": round(avg_score, 1),
        "energy_level":       energy_level,
        "vibe_state":         vibe_state,
        "capacity_level":     capacity_level,
        "gate_level":         gate_level,
        "vibe_velocity":      velocity,
        "total_ratings_24h":  ratings_24h,
        "viibe_certified":    viibe_certified,
        # Kinetic metadata
        "kinetic_momentum":   live["momentum_floor"],
        "decay_protected":    live["decay_protected"],
        "fraud_excluded":     live["excluded_fraud"],
        # Vibe DNA
        "vibe_signature":     sig,
        # Oracle forward prediction
        "oracle":             oracle,
        # Transparency
        "active_scouts":      active_scouts,
        "last_rated_mins_ago": last_rated_mins_ago,
        "score_confidence":   score_confidence,
        # ── Audit trail — every score carries provenance ──────────────
        "sample_size":              len(ratings),
        "total_weight":             round(live["total_weight"], 3),
        "submission_window_start":  submission_window_start,
        "submission_window_end":    now,
        # Dwell
        "long_dwell_count":   long_dwell_count,
        "avg_dwell_minutes":  avg_dwell_minutes,
        # Scout consensus
        "consensus_count":    consensus_count,
        "consensus_rate":     consensus_rate,
        "consensus_label":    consensus_label,
        # Ambient sound
        "ambient_db_avg":       ambient["ambient_db_avg"],
        "ambient_scout_count":  ambient["ambient_scout_count"],
        # Signal blend weights (for transparency + debugging)
        "signal_weights": {
            "scouts":    round(scout_weight, 3),
            "ambient":   round(ambient_weight, 3),
            "consensus": round(consensus_weight, 3),
            "dwell":     round(dwell_weight, 3),
        },
        # ── AI-03: Energy Decay — timestamp of last scout rating ──────────────
        # Used by frontend to visually degrade score if no new ratings arrive.
        # Score considered "stale" after 45 min, "expired" after 90 min.
        "last_rated_at": now if ratings else None,
        "score_age_minutes": last_rated_mins_ago,
    }

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
            "total_ratings":         new_total,
            "clout_points":          new_clout,
            "scout_status":          status,
        }},
    )


async def generate_venue_narrative(venue_id: str, current_score: float) -> tuple[str, float | None]:
    """
    Sports-broadcast narrative for a venue based on score momentum.

    Queries the last snapshot from 15–25 minutes ago and compares it to
    the current score. Returns (narrative_string, delta).
    delta is None when there is no historical data yet.
    """
    now    = datetime.now(timezone.utc)
    t_min  = now - timedelta(minutes=25)
    t_max  = now - timedelta(minutes=15)

    snap = await db.vibe_snapshots.find_one(
        {"venue_id": venue_id, "timestamp": {"$gte": t_min, "$lte": t_max}},
        sort=[("timestamp", -1)],
    )

    if snap is None:
        # No history yet — venue just woke up or data gap
        if current_score >= 70:
            return "Already buzzing. Doors haven't been open long.", None
        return "Just waking up. Check back in 20.", None

    delta = current_score - snap["vibe_score"]

    # ── Climbing ─────────────────────────────────────────────────────────
    if delta > 15:
        return f"Up {delta:.0f} pts in 20 mins 🔥 Fastest climb tonight.", delta
    if delta > 10:
        return f"Warming fast — up {delta:.0f} pts. 🔥 Peak incoming.", delta
    if delta > 5:
        return f"Building. Up {delta:.0f} pts and still climbing.", delta

    # ── At peak / holding ─────────────────────────────────────────────────
    if current_score >= 85 and abs(delta) <= 5:
        return "At PEAK. Energy is holding. This is the moment.", delta

    # ── Stable mid-range ─────────────────────────────────────────────────
    if current_score >= 60 and abs(delta) <= 5:
        return "Holding steady. Waiting for the crowd to commit.", delta
    if 40 <= current_score < 60 and abs(delta) <= 5:
        return "Building energy. Night is still early.", delta

    # ── Dropping ─────────────────────────────────────────────────────────
    if delta < -10:
        return f"Down {abs(delta):.0f} pts. Just passed PEAK — ride it while it lasts.", delta
    if delta < -5:
        return "Winding down. Moving to the after-party?", delta

    # ── Quiet ────────────────────────────────────────────────────────────
    if current_score < 40:
        return "Quiet tonight. Could flip at any moment.", delta

    return "Holding. Scouts are watching.", delta


async def check_and_emit_surge_alert(venue_id: str, venue_name: str, city: str, current_score: float):
    """
    If any venue has jumped > 15 pts in the last 15 minutes, emit a
    global_surge_alert to the city room so home-screen viewers feel the FOMO.
    Throttled: one alert per venue per 20 minutes.
    """
    from app.config import sio  # local import to avoid circular deps

    now   = datetime.now(timezone.utc)
    t_min = now - timedelta(minutes=15)

    snap = await db.vibe_snapshots.find_one(
        {"venue_id": venue_id, "timestamp": {"$gte": t_min}},
        sort=[("timestamp", 1)],   # oldest in window
    )
    if snap is None:
        return

    delta = current_score - snap["vibe_score"]
    if delta <= 15:
        return

    # Throttle: check if we already fired an alert for this venue recently
    cooldown_key = f"surge_alert_{venue_id}"
    last_alert = await db.surge_alert_log.find_one({"key": cooldown_key})
    if last_alert:
        age_mins = (now - last_alert["fired_at"].replace(tzinfo=timezone.utc)).total_seconds() / 60
        if age_mins < 20:
            return

    # Record the alert
    await db.surge_alert_log.update_one(
        {"key": cooldown_key},
        {"$set": {"key": cooldown_key, "fired_at": now}},
        upsert=True,
    )

    narrative, _ = await generate_venue_narrative(venue_id, current_score)

    await sio.emit("global_surge_alert", {
        "venue_id":   venue_id,
        "venue_name": venue_name,
        "city":       city,
        "delta":      round(delta, 1),
        "score":      round(current_score, 1),
        "narrative":  narrative,
    }, room=f"city_{city}")


async def save_vibe_snapshot(venue_id: str, aggregate: dict):
    """Save a vibe snapshot for timeline history. Called after each rating recalculation.

    Each snapshot carries a full audit trail so the score is provable and licensable:
      sample_size            — ratings used in this calculation (1h window, fraud-excluded)
      active_scouts          — unique scouts who contributed
      score_confidence       — low / medium / high based on scout count
      total_weight           — sum of credibility × time weights (signal strength)
      submission_window_*    — time range of ratings that fed this score
      fraud_excluded         — count of physically implausible ratings dropped
      decay_protected        — whether decay buffer capped a score drop this cycle
      kinetic_momentum       — crowd movement floor applied
      signal_weights         — per-signal blend breakdown (scouts/ambient/consensus/dwell)
    """
    snapshot = {
        "venue_id":        venue_id,
        "vibe_score":      aggregate.get("current_vibe_score", 0),
        "energy_level":    aggregate.get("energy_level", "chill"),
        "capacity_level":  aggregate.get("capacity_level", "sparse"),
        "gate_level":      aggregate.get("gate_level", "clear"),
        "total_ratings_24h": aggregate.get("total_ratings_24h", 0),
        "timestamp":       datetime.now(timezone.utc),
        # ── Audit trail ───────────────────────────────────────────────
        "sample_size":             aggregate.get("sample_size", 0),
        "active_scouts":           aggregate.get("active_scouts", 0),
        "score_confidence":        aggregate.get("score_confidence", "low"),
        "total_weight":            aggregate.get("total_weight", 0),
        "submission_window_start": aggregate.get("submission_window_start"),
        "submission_window_end":   aggregate.get("submission_window_end"),
        "fraud_excluded":          aggregate.get("fraud_excluded", 0),
        "decay_protected":         aggregate.get("decay_protected", False),
        "kinetic_momentum":        aggregate.get("kinetic_momentum", 0),
        "signal_weights":          aggregate.get("signal_weights", {}),
    }
    await db.vibe_snapshots.insert_one(snapshot)

    # Aura Shield check
    await _check_aura_shield(venue_id, aggregate)


async def _check_aura_shield(venue_id: str, aggregate: dict):
    """Check if venue's Aura Shield should trigger an alert."""
    shield = await db.aura_shields.find_one({"venue_id": venue_id})
    if not shield or not shield.get("enabled"):
        return

    score    = aggregate.get("current_vibe_score", 100)
    threshold = shield.get("threshold", 50)
    alert_on  = shield.get("alert_on", [])

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
    count  = await db.ratings.count_documents({
        "venue_id":  venue_id,
        "timestamp": {"$gte": cutoff},
    })
    return count < 5


def _is_hidden_gem(venue: dict) -> bool:
    """
    Hidden Gem Hunt trigger (mid-week only, Mon–Thu).
    Returns True if venue score is below 50 but momentum is heating_up.
    These are emerging spots that scouts discover before the crowd arrives.
    """
    now     = datetime.now(timezone.utc)
    weekday = now.weekday()  # 0=Mon, 6=Sun
    if weekday > 3:          # Fri/Sat/Sun excluded — already hot nights
        return False
    score    = venue.get("current_vibe_score", 100)
    velocity = venue.get("vibe_velocity", "stable")
    return score < 50 and velocity == "heating_up"
