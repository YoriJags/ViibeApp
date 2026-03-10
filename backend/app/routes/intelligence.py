"""
Vibe App - Scene Intelligence Layer
Everything that turns raw data into narrative. No ML needed —
just careful aggregation of the signals we're already collecting.

  GET /api/area-pulse/{city}        — area-level heat scores
  GET /api/tonight/{city}           — "The Move Tonight" recommendation
  GET /api/venues/{id}/arrival-intel — best time to arrive
  GET /api/venues/{id}/crowd-composition — live persona breakdown
  GET /api/weather/{city}           — weather + nightlife impact rating
  GET /api/venues/{id}/reputation   — 90-day rolling reputation score
"""
import os
from datetime import datetime, timedelta, timezone
from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException
from typing import Optional

from app.config import db
from app.services.auth import require_auth

router = APIRouter(tags=["intelligence"])

_WAT = timezone(timedelta(hours=1))

# ── Area definitions ──────────────────────────────────────────────────────────
# Lat/lng bounding boxes for Lagos areas
AREA_BOUNDS = {
    "Victoria Island": {"minLat": 6.415, "maxLat": 6.435, "minLng": 3.405, "maxLng": 3.440},
    "Ikoyi":           {"minLat": 6.435, "maxLat": 6.460, "minLng": 3.400, "maxLng": 3.440},
    "Lekki":           {"minLat": 6.430, "maxLat": 6.470, "minLng": 3.440, "maxLng": 3.560},
    "Allen/Ikeja":     {"minLat": 6.590, "maxLat": 6.620, "minLng": 3.340, "maxLng": 3.380},
    "Surulere":        {"minLat": 6.490, "maxLat": 6.520, "minLng": 3.350, "maxLng": 3.380},
}

# Persona weights for crowd composition (matched to vibeStore persona values)
PERSONA_LABELS = {
    "turn_up": {"label": "Turn Up", "emoji": "🔥", "color": "#FF3366"},
    "grown_sexy": {"label": "Grown & Sexy", "emoji": "✨", "color": "#9B59B6"},
    "culture": {"label": "Culture Vulture", "emoji": "🎭", "color": "#3399FF"},
    "chill_set": {"label": "Chill Set", "emoji": "🌊", "color": "#00D4FF"},
}

# OpenWeatherMap city IDs for Nigeria
OWM_CITY_IDS = {
    "lagos": 2332459,
    "abuja": 2347283,
    "port_harcourt": 2317765,
    "ibadan": 2339354,
}

# Nightlife impact of weather conditions
WEATHER_IMPACT = {
    "Clear": ("ideal", "+", "Dry night — expect peak turnout"),
    "Clouds": ("neutral", "=", "Overcast, no impact on turnout"),
    "Rain": ("poor", "−", "Rain in Lagos kills the vibe — expect 30–40% fewer people"),
    "Drizzle": ("soft", "~", "Light drizzle — most will still come out"),
    "Thunderstorm": ("dead", "−−", "Storm warning — venues will be thin"),
    "Mist": ("neutral", "=", "Mild conditions, no major impact"),
    "Haze": ("neutral", "=", "Harmattan haze — dry but cool"),
    "Dust": ("soft", "~", "Dusty air — some may stay in"),
    "Fog": ("neutral", "=", "Low visibility, minor impact"),
    "Tornado": ("dead", "−−", "Severe weather — avoid going out"),
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _venue_in_area(venue: dict, area: str) -> bool:
    bounds = AREA_BOUNDS.get(area)
    if not bounds:
        return False
    coords = venue.get("coordinates", {})
    lat = coords.get("lat", 0)
    lng = coords.get("lng", 0)
    return (bounds["minLat"] <= lat <= bounds["maxLat"] and
            bounds["minLng"] <= lng <= bounds["maxLng"])


async def _get_weather_data(city: str) -> dict | None:
    """Fetch weather from OpenWeatherMap. Returns None if key not set."""
    api_key = os.environ.get("OPENWEATHER_API_KEY")
    if not api_key:
        return None
    city_id = OWM_CITY_IDS.get(city.lower())
    if not city_id:
        return None
    try:
        import httpx
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.get(
                "https://api.openweathermap.org/data/2.5/weather",
                params={"id": city_id, "appid": api_key, "units": "metric"},
            )
            if resp.status_code == 200:
                return resp.json()
    except Exception:
        pass
    return None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/area-pulse/{city}")
async def get_area_pulse(city: str):
    """
    Aggregate vibe scores by area for a city. Returns area-level pulse.
    Venues not in a defined area go into 'Other'.
    """
    venues = await db.venues.find(
        {"city": city} if city != "lagos" else {},
        {"_id": 0, "id": 1, "name": 1, "area": 1, "current_vibe_score": 1,
         "energy_level": 1, "coordinates": 1, "vibe_velocity": 1}
    ).to_list(200)

    # Group by area
    area_data: dict[str, list] = defaultdict(list)
    for venue in venues:
        placed = False
        for area_name in AREA_BOUNDS:
            if _venue_in_area(venue, area_name):
                area_data[area_name].append(venue)
                placed = True
                break
        # Fall back to the venue's own area field
        if not placed and venue.get("area"):
            area_data[venue["area"]].append(venue)

    result = []
    for area_name, area_venues in area_data.items():
        if not area_venues:
            continue
        scores = [v["current_vibe_score"] for v in area_venues]
        avg = round(sum(scores) / len(scores), 1)
        peak = max(scores)
        # Rising areas: more venues heating_up than cooling_down
        rising = sum(1 for v in area_venues if v.get("vibe_velocity") == "heating_up")
        cooling = sum(1 for v in area_venues if v.get("vibe_velocity") == "cooling_down")
        trend = "rising" if rising > cooling else ("cooling" if cooling > rising else "stable")

        # State label
        if avg >= 75:
            state = "electric"
        elif avg >= 55:
            state = "popping"
        elif avg >= 35:
            state = "warming"
        else:
            state = "quiet"

        result.append({
            "area": area_name,
            "avg_score": avg,
            "peak_score": peak,
            "venue_count": len(area_venues),
            "trending": trend,
            "state": state,
            "top_venue": max(area_venues, key=lambda v: v["current_vibe_score"])["name"],
        })

    # Sort by avg score
    result.sort(key=lambda x: x["avg_score"], reverse=True)
    return {"city": city, "areas": result, "computed_at": datetime.now(timezone.utc).isoformat()}


@router.get("/weather/{city}")
async def get_city_weather(city: str):
    """
    Current weather for a city with nightlife impact assessment.
    Falls back gracefully if OPENWEATHER_API_KEY not set.
    """
    data = await _get_weather_data(city)

    if not data:
        # Return a neutral placeholder — app still works without key
        return {
            "city": city,
            "available": False,
            "impact": "neutral",
            "impact_symbol": "=",
            "message": "Weather data unavailable",
        }

    main_condition = data["weather"][0]["main"] if data.get("weather") else "Clear"
    temp_c = data.get("main", {}).get("temp", 28)
    humidity = data.get("main", {}).get("humidity", 70)
    impact_info = WEATHER_IMPACT.get(main_condition, ("neutral", "=", "Conditions normal"))

    # Adjust impact for heat (Lagos heat above 32°C in a club = uncomfortable)
    if temp_c > 32 and impact_info[0] in ("ideal", "neutral"):
        impact_info = ("warm", "~", f"Hot night ({temp_c:.0f}°C) — inside AC venues only")

    return {
        "city": city,
        "available": True,
        "condition": main_condition,
        "description": data["weather"][0].get("description", "").capitalize() if data.get("weather") else "",
        "temp_c": round(temp_c, 1),
        "humidity": humidity,
        "impact": impact_info[0],       # ideal | neutral | soft | poor | dead | warm
        "impact_symbol": impact_info[1], # + | = | ~ | − | −−
        "message": impact_info[2],
        "score_modifier": {             # multiply venue scores by this for weather-adjusted display
            "ideal": 1.0,
            "neutral": 1.0,
            "warm": 0.95,
            "soft": 0.90,
            "poor": 0.75,
            "dead": 0.55,
        }.get(impact_info[0], 1.0),
    }


@router.get("/tonight/{city}")
async def get_tonight_recommendation(city: str):
    """
    "The Move Tonight" — single venue recommendation engine.
    Weighted sum: current score (40%) + velocity (20%) + event signal (20%) + consistency (20%).
    Also returns area pulse summary and top 3 alternatives.
    """
    now = datetime.now(timezone.utc)

    venues = await db.venues.find(
        {}, {"_id": 0, "id": 1, "name": 1, "area": 1, "current_vibe_score": 1,
             "energy_level": 1, "vibe_velocity": 1, "music_genre": 1, "entry_fee": 1}
    ).to_list(100)

    if not venues:
        return {"available": False, "message": "No venue data yet"}

    # Score each venue
    scored = []
    for venue in venues:
        score = venue.get("current_vibe_score", 0)
        velocity = venue.get("vibe_velocity", "stable")

        # Base: current score (40%)
        weighted = score * 0.40

        # Velocity bonus (20%)
        velocity_bonus = {"heating_up": 20, "stable": 10, "cooling_down": 0}.get(velocity, 10)
        weighted += velocity_bonus * 0.20

        # Consistency check: how often has this venue been high in last 7 days? (20%)
        week_ago = now - timedelta(days=7)
        high_snapshots = await db.vibe_snapshots.count_documents({
            "venue_id": venue["id"],
            "vibe_score": {"$gte": 60},
            "timestamp": {"$gte": week_ago},
        })
        consistency_score = min(high_snapshots * 2, 20)  # cap at 20
        weighted += consistency_score * 0.20

        # Recent activity (20%): ratings in last 2h
        two_h_ago = now - timedelta(hours=2)
        recent_ratings = await db.ratings.count_documents({
            "venue_id": venue["id"],
            "timestamp": {"$gte": two_h_ago},
        })
        activity_score = min(recent_ratings * 4, 20)
        weighted += activity_score * 0.20

        scored.append({**venue, "_weight": weighted})

    scored.sort(key=lambda x: x["_weight"], reverse=True)
    top = scored[0]
    alternatives = scored[1:4]

    # Get weather context
    weather = await get_city_weather(city)
    weather_note = weather.get("message") if weather.get("available") else None

    # Build headline
    velocity_phrase = {
        "heating_up": "and still climbing",
        "stable": "holding strong",
        "cooling_down": "but winding down",
    }.get(top.get("vibe_velocity", "stable"), "")

    headline = f"{top['name']} is the move — {top['current_vibe_score']}% {velocity_phrase}"

    return {
        "available": True,
        "headline": headline,
        "top_pick": {
            "venue_id": top["id"],
            "venue_name": top["name"],
            "area": top.get("area"),
            "score": top["current_vibe_score"],
            "velocity": top.get("vibe_velocity"),
            "music_genre": top.get("music_genre"),
            "entry_fee": top.get("entry_fee"),
        },
        "alternatives": [
            {"venue_id": v["id"], "venue_name": v["name"],
             "area": v.get("area"), "score": v["current_vibe_score"]}
            for v in alternatives
        ],
        "weather_note": weather_note,
        "computed_at": now.isoformat(),
    }


@router.get("/venues/{venue_id}/arrival-intel")
async def get_arrival_intel(venue_id: str):
    """
    Best time to arrive at a venue.
    Built from check-in timing + rating timing patterns over last 14 days.
    Returns: hour-by-hour density, recommended arrival, peak hour.
    """
    venue = await db.venues.find_one({"id": venue_id})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    now = datetime.now(timezone.utc)
    two_weeks_ago = now - timedelta(days=14)

    # Aggregate check-ins by hour-of-day
    checkin_pipeline = [
        {"$match": {"venue_id": venue_id, "created_at": {"$gte": two_weeks_ago}}},
        {"$group": {"_id": {"$hour": "$created_at"}, "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]
    checkin_by_hour = await db.checkins.aggregate(checkin_pipeline).to_list(24)

    # Aggregate ratings by hour-of-day
    rating_pipeline = [
        {"$match": {"venue_id": venue_id, "timestamp": {"$gte": two_weeks_ago}}},
        {"$group": {"_id": {"$hour": "$timestamp"}, "count": {"$sum": 1}, "avg_score": {"$avg": "$vibe_score"}}},
        {"$sort": {"_id": 1}},
    ]
    ratings_by_hour = await db.ratings.aggregate(rating_pipeline).to_list(24)

    # Map to hour → density (combine checkins + ratings as activity proxy)
    checkin_map = {r["_id"]: r["count"] for r in checkin_by_hour}
    rating_map = {r["_id"]: {"count": r["count"], "avg": r.get("avg_score", 0)} for r in ratings_by_hour}

    hourly = []
    peak_activity = 0
    peak_hour_utc = None

    for h in range(24):
        checkins = checkin_map.get(h, 0)
        ratings = rating_map.get(h, {}).get("count", 0)
        avg_score = rating_map.get(h, {}).get("avg", 0)
        activity = checkins + ratings * 2  # ratings are stronger signal
        hourly.append({
            "hour_utc": h,
            "hour_wat": (h + 1) % 24,  # WAT = UTC+1
            "hour_label": f"{(h + 1) % 24:02d}:00",
            "activity": activity,
            "avg_score": round(avg_score, 1),
        })
        if activity > peak_activity:
            peak_activity = activity
            peak_hour_utc = h

    # Recommend arriving 30–60 min before peak
    recommended_utc = None
    recommended_label = None
    if peak_hour_utc is not None:
        recommended_utc = (peak_hour_utc - 1) % 24
        recommended_wat = (recommended_utc + 1) % 24
        recommended_label = f"{recommended_wat:02d}:00 WAT"
        peak_wat = (peak_hour_utc + 1) % 24
        peak_label = f"{peak_wat:02d}:00 WAT"
    else:
        peak_label = None

    if not any(h["activity"] > 0 for h in hourly):
        return {
            "venue_id": venue_id,
            "available": False,
            "message": "Not enough scout data yet — check back after more visits.",
        }

    return {
        "venue_id": venue_id,
        "venue_name": venue.get("name"),
        "available": True,
        "peak_hour": peak_label,
        "recommended_arrival": recommended_label,
        "insight": f"Arrive by {recommended_label} to beat the crowd — peak hits around {peak_label}." if recommended_label else None,
        "hourly": [h for h in hourly if h["activity"] > 0],  # only hours with real data
    }


@router.get("/venues/{venue_id}/crowd-composition")
async def get_crowd_composition(venue_id: str):
    """
    Live crowd persona breakdown for a venue.
    Aggregates persona from ratings in the last 4 hours.
    Tells you: who is actually there right now.
    """
    venue = await db.venues.find_one({"id": venue_id})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    now = datetime.now(timezone.utc)
    four_h_ago = now - timedelta(hours=4)

    # Get recent raters' personas
    recent_ratings = await db.ratings.find(
        {"venue_id": venue_id, "timestamp": {"$gte": four_h_ago}},
        {"_id": 0, "user_id": 1}
    ).to_list(200)

    if not recent_ratings:
        return {
            "venue_id": venue_id,
            "available": False,
            "sample_size": 0,
            "message": "No recent ratings — check back when the venue gets active.",
        }

    user_ids = list(set(r["user_id"] for r in recent_ratings))
    # Look up each user's persona
    users = await db.users.find(
        {"id": {"$in": user_ids}},
        {"_id": 0, "id": 1, "persona": 1}
    ).to_list(200)

    persona_counts: dict[str, int] = defaultdict(int)
    total = 0
    for u in users:
        p = u.get("persona")
        if p:
            persona_counts[p] += 1
            total += 1

    if total == 0:
        return {
            "venue_id": venue_id,
            "available": False,
            "sample_size": 0,
            "message": "No persona data from recent raters.",
        }

    # Build composition list sorted by count
    composition = []
    for persona_key, count in sorted(persona_counts.items(), key=lambda x: x[1], reverse=True):
        info = PERSONA_LABELS.get(persona_key, {"label": persona_key, "emoji": "👤", "color": "#888"})
        composition.append({
            "persona": persona_key,
            "label": info["label"],
            "emoji": info["emoji"],
            "color": info["color"],
            "count": count,
            "pct": round(count / total * 100),
        })

    # Dominant persona
    dominant = composition[0] if composition else None
    vibe_description = _describe_composition(composition)

    return {
        "venue_id": venue_id,
        "venue_name": venue.get("name"),
        "available": True,
        "sample_size": total,
        "window_hours": 4,
        "dominant_persona": dominant,
        "composition": composition,
        "vibe_description": vibe_description,
    }


def _describe_composition(composition: list) -> str:
    """Generate a one-line crowd description from persona breakdown."""
    if not composition:
        return "Mixed crowd"
    top = composition[0]
    if top["pct"] >= 70:
        return f"Heavy {top['label']} crowd tonight"
    if top["pct"] >= 50:
        return f"Mostly {top['label']} with a mix"
    if len(composition) >= 2:
        return f"{composition[0]['label']} meets {composition[1]['label']}"
    return "Diverse crowd"


@router.get("/venues/{venue_id}/reputation")
async def get_venue_reputation(venue_id: str):
    """
    90-day rolling reputation score.
    Measures consistency, loyalty (return visits), and peak-to-average ratio.
    Not how hot a venue is tonight — how reliable it is over time.
    """
    venue = await db.venues.find_one({"id": venue_id})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    now = datetime.now(timezone.utc)
    ninety_ago = now - timedelta(days=90)
    thirty_ago = now - timedelta(days=30)

    # Consistency: standard deviation of daily avg scores (lower = more consistent)
    snap_pipeline = [
        {"$match": {"venue_id": venue_id, "timestamp": {"$gte": ninety_ago}}},
        {"$group": {
            "_id": {
                "year": {"$year": "$timestamp"},
                "month": {"$month": "$timestamp"},
                "day": {"$dayOfMonth": "$timestamp"},
            },
            "daily_avg": {"$avg": "$vibe_score"},
        }},
    ]
    daily_snaps = await db.vibe_snapshots.aggregate(snap_pipeline).to_list(90)
    daily_scores = [d["daily_avg"] for d in daily_snaps]

    if len(daily_scores) < 7:
        return {
            "venue_id": venue_id,
            "available": False,
            "message": "Not enough history yet. Come back in a week.",
        }

    avg_score = sum(daily_scores) / len(daily_scores)
    variance = sum((s - avg_score) ** 2 for s in daily_scores) / len(daily_scores)
    std_dev = variance ** 0.5
    consistency_score = max(0, 100 - std_dev * 3)  # 0-100, lower std_dev = higher consistency

    # Loyalty: unique users who rated more than once in 90 days
    rater_pipeline = [
        {"$match": {"venue_id": venue_id, "timestamp": {"$gte": ninety_ago}}},
        {"$group": {"_id": "$user_id", "count": {"$sum": 1}}},
        {"$match": {"count": {"$gt": 1}}},
        {"$count": "returning"},
    ]
    loyalty_result = await db.ratings.aggregate(rater_pipeline).to_list(1)
    returning_scouts = loyalty_result[0]["returning"] if loyalty_result else 0
    total_unique = await db.ratings.count_documents({"venue_id": venue_id, "timestamp": {"$gte": ninety_ago}})
    loyalty_score = min(100, (returning_scouts / max(total_unique, 1)) * 200)  # 0-100

    # Momentum: last 30 days avg vs previous 60 days avg
    last30_scores = [d["daily_avg"] for d in daily_snaps[-30:]] if len(daily_snaps) >= 30 else daily_scores
    prev60_scores = daily_scores[:-30] if len(daily_scores) > 30 else []

    last30_avg = sum(last30_scores) / len(last30_scores) if last30_scores else avg_score
    prev60_avg = sum(prev60_scores) / len(prev60_scores) if prev60_scores else avg_score
    momentum_delta = last30_avg - prev60_avg

    # Composite reputation score (0–100)
    reputation = round(
        (avg_score * 0.40) +
        (consistency_score * 0.30) +
        (loyalty_score * 0.30)
    )

    # Star tier
    if reputation >= 80:
        tier, stars = "Elite", 5
    elif reputation >= 65:
        tier, stars = "Established", 4
    elif reputation >= 50:
        tier, stars = "Solid", 3
    elif reputation >= 35:
        tier, stars = "Building", 2
    else:
        tier, stars = "New", 1

    return {
        "venue_id": venue_id,
        "venue_name": venue.get("name"),
        "available": True,
        "reputation_score": reputation,
        "tier": tier,
        "stars": stars,
        "days_of_data": len(daily_scores),
        "breakdown": {
            "avg_vibe_score": round(avg_score, 1),
            "consistency_score": round(consistency_score, 1),
            "loyalty_score": round(loyalty_score, 1),
            "momentum_delta": round(momentum_delta, 1),
        },
        "insight": _reputation_insight(tier, momentum_delta, consistency_score),
    }


@router.get("/v1/intelligence/attribution")
async def get_attribution(
    venue_id: str,
    period_days: int = 7,
    user: dict = Depends(require_auth),
):
    """
    B2B Data Clean Room — Conversion-to-Venue attribution for merchants.
    Calculates scout arrival and engagement lift following merchant actions
    (pulse drops, live pushes, surge bookings).

    Role-gated: requires is_merchant on the requesting user.
    The merchant must own the requested venue.
    """
    if not user.get("is_merchant") and not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Merchant account required")

    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    # Ownership check — admin can query any venue
    if not user.get("is_admin") and venue.get("owner_id") != user["id"]:
        raise HTTPException(status_code=403, detail="You don't own this venue")

    now = datetime.now(timezone.utc)
    window_start = now - timedelta(days=period_days)

    # ── Merchant events in window ──────────────────────────────────────────────
    pulse_drops = await db.pulse_drops.find(
        {"venue_id": venue_id, "created_at": {"$gte": window_start}},
        {"_id": 0, "created_at": 1, "tier": 1},
    ).to_list(50)

    live_pushes = await db.venue_live_pushes.find(
        {"venue_id": venue_id, "sent_at": {"$gte": window_start}},
        {"_id": 0, "sent_at": 1},
    ).to_list(50)

    surge_bookings = await db.surge_bookings.find(
        {"venue_id": venue_id, "scheduled_at": {"$gte": window_start}, "status": {"$in": ["active", "expired"]}},
        {"_id": 0, "scheduled_at": 1, "tier": 1},
    ).to_list(50)

    # ── Attribution calculation ────────────────────────────────────────────────
    # For each merchant event: compare ratings+checkins in 2h BEFORE vs 2h AFTER
    attribution_events = []
    for event in [
        *[{"type": "pulse_drop", "ts": e["created_at"], "tier": e.get("tier")} for e in pulse_drops],
        *[{"type": "live_push", "ts": e["sent_at"], "tier": None} for e in live_pushes],
        *[{"type": "surge_booking", "ts": e["scheduled_at"], "tier": e.get("tier")} for e in surge_bookings],
    ]:
        ts = event["ts"]
        if isinstance(ts, str):
            ts = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)

        before_start = ts - timedelta(hours=2)
        after_end = ts + timedelta(hours=2)

        arrivals_before = await db.checkins.count_documents({
            "venue_id": venue_id, "created_at": {"$gte": before_start, "$lt": ts},
        })
        arrivals_after = await db.checkins.count_documents({
            "venue_id": venue_id, "created_at": {"$gte": ts, "$lte": after_end},
        })
        ratings_before = await db.ratings.count_documents({
            "venue_id": venue_id, "timestamp": {"$gte": before_start, "$lt": ts},
        })
        ratings_after = await db.ratings.count_documents({
            "venue_id": venue_id, "timestamp": {"$gte": ts, "$lte": after_end},
        })

        # Avg vibe score before vs after
        score_before_agg = await db.ratings.aggregate([
            {"$match": {"venue_id": venue_id, "timestamp": {"$gte": before_start, "$lt": ts}}},
            {"$group": {"_id": None, "avg": {"$avg": "$vibe_score"}}},
        ]).to_list(1)
        score_after_agg = await db.ratings.aggregate([
            {"$match": {"venue_id": venue_id, "timestamp": {"$gte": ts, "$lte": after_end}}},
            {"$group": {"_id": None, "avg": {"$avg": "$vibe_score"}}},
        ]).to_list(1)

        score_before = round(score_before_agg[0]["avg"], 1) if score_before_agg else 0
        score_after = round(score_after_agg[0]["avg"], 1) if score_after_agg else 0
        lift = arrivals_after - arrivals_before
        conversion_rate = round(lift / max(arrivals_before, 1) * 100, 1)

        attribution_events.append({
            "event_type": event["type"],
            "tier": event["tier"],
            "triggered_at": ts.isoformat(),
            "arrivals_2h_before": arrivals_before,
            "arrivals_2h_after": arrivals_after,
            "arrival_lift": lift,
            "ratings_before": ratings_before,
            "ratings_after": ratings_after,
            "score_before": score_before,
            "score_after": score_after,
            "score_delta": round(score_after - score_before, 1),
            "conversion_rate_pct": conversion_rate,
        })

    # ── Period-level summary ───────────────────────────────────────────────────
    total_events = len(attribution_events)
    total_lift = sum(e["arrival_lift"] for e in attribution_events)
    avg_score_delta = (
        round(sum(e["score_delta"] for e in attribution_events) / total_events, 1)
        if total_events else 0
    )

    return {
        "venue_id": venue_id,
        "venue_name": venue.get("name"),
        "period_days": period_days,
        "total_merchant_events": total_events,
        "total_arrival_lift": total_lift,
        "avg_score_delta": avg_score_delta,
        "events": attribution_events,
        "data_note": (
            "Arrivals = check-ins within ±2h of each merchant event. "
            "Score delta = vibe score change from pre- to post-event window."
        ),
        "generated_at": now.isoformat(),
    }


def _reputation_insight(tier: str, delta: float, consistency: float) -> str:
    if delta > 5:
        return f"{tier} venue on the rise — better than it was 30 days ago."
    if delta < -5:
        return f"{tier} venue but trending down — something shifted."
    if consistency >= 75:
        return f"Consistent {tier.lower()} performer. Always delivers."
    if consistency < 40:
        return "Unpredictable nights — could be amazing or dead."
    return f"Solid {tier.lower()} venue. Reliable choice."


# ===== City Intelligence — The Foursquare Data Story =====

@router.get("/data/city-intelligence")
async def get_city_intelligence(city: str = "lagos", days: int = 30):
    """
    Aggregated city-level intelligence — the enterprise data product.
    This is what brands, real estate developers, and event promoters pay for:
    foot traffic patterns, area heat maps, best nights, peak hours city-wide.

    This endpoint tells the Foursquare exit story.
    """
    if days not in (7, 30, 90):
        days = 30

    now = datetime.now(timezone.utc)
    since = now - timedelta(days=days)

    DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

    # All venues in city
    venues = await db.venues.find(
        {"city": city},
        {"_id": 0, "id": 1, "name": 1, "area": 1, "venue_type": 1, "current_vibe_score": 1},
    ).to_list(200)
    venue_ids = [v["id"] for v in venues]
    venue_map = {v["id"]: v for v in venues}

    if not venue_ids:
        return {"available": False, "message": f"No venues in {city}"}

    # ── Top areas by avg score + volume ──────────────────────────────────────
    area_pipeline = [
        {"$match": {"venue_id": {"$in": venue_ids}, "timestamp": {"$gte": since}}},
        {"$addFields": {"area": {
            "$let": {
                "vars": {"vids": venue_ids, "areas": [venue_map[v]["area"] for v in venue_ids]},
                "in": "$venue_id",
            }
        }}},
        {"$group": {
            "_id": "$venue_id",
            "avg_score": {"$avg": "$vibe_score"},
            "total_ratings": {"$sum": 1},
            "unique_scouts": {"$addToSet": "$user_id"},
        }},
    ]
    venue_stats = await db.ratings.aggregate(area_pipeline).to_list(200)

    # Group by area
    area_map: dict = {}
    for vs in venue_stats:
        v = venue_map.get(vs["_id"], {})
        area = v.get("area", "Unknown")
        if area not in area_map:
            area_map[area] = {"ratings": 0, "scores": [], "unique_scouts": set()}
        area_map[area]["ratings"] += vs["total_ratings"]
        area_map[area]["scores"].append(vs["avg_score"])
        area_map[area]["unique_scouts"].update(vs.get("unique_scouts", []))

    top_areas = sorted([
        {
            "area": area,
            "avg_score": round(sum(d["scores"]) / len(d["scores"]), 1),
            "total_ratings": d["ratings"],
            "unique_scouts": len(d["unique_scouts"]),
        }
        for area, d in area_map.items() if d["ratings"] > 0
    ], key=lambda x: x["avg_score"], reverse=True)

    # ── Best nights (day of week breakdown) ───────────────────────────────────
    ratings = await db.ratings.find(
        {"venue_id": {"$in": venue_ids}, "timestamp": {"$gte": since}},
        {"vibe_score": 1, "timestamp": 1, "_id": 0},
    ).to_list(10000)

    dow_map: dict = {i: {"scores": [], "count": 0} for i in range(7)}
    hour_map: dict = {h: {"count": 0} for h in range(24)}

    for r in ratings:
        ts = r["timestamp"]
        if isinstance(ts, str):
            ts = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        dow = ts.weekday()
        dow_map[dow]["scores"].append(r.get("vibe_score", 0))
        dow_map[dow]["count"] += 1
        wat_h = (ts.hour + 1) % 24
        hour_map[wat_h]["count"] += 1

    best_nights = sorted([
        {
            "day": DAY_NAMES[d],
            "avg_score": round(sum(v["scores"]) / len(v["scores"]), 1) if v["scores"] else 0,
            "rating_count": v["count"],
        }
        for d, v in dow_map.items() if v["count"] > 0
    ], key=lambda x: x["avg_score"], reverse=True)

    # ── Peak hours city-wide ──────────────────────────────────────────────────
    max_activity = max((v["count"] for v in hour_map.values()), default=1)
    peak_hours = sorted([
        {
            "hour": h,
            "label": f"{h:02d}:00 WAT",
            "activity_index": round((v["count"] / max_activity) * 100) if max_activity > 0 else 0,
            "count": v["count"],
        }
        for h, v in hour_map.items() if v["count"] > 0
    ], key=lambda x: x["activity_index"], reverse=True)[:8]

    # ── Venue category breakdown ──────────────────────────────────────────────
    cat_map: dict = {}
    for vs in venue_stats:
        v = venue_map.get(vs["_id"], {})
        vtype = v.get("venue_type", "other")
        if vtype not in cat_map:
            cat_map[vtype] = {"count": 0, "scores": []}
        cat_map[vtype]["count"] += 1
        cat_map[vtype]["scores"].append(vs["avg_score"])

    category_breakdown = sorted([
        {
            "type": vtype,
            "venue_count": d["count"],
            "avg_score": round(sum(d["scores"]) / len(d["scores"]), 1) if d["scores"] else 0,
        }
        for vtype, d in cat_map.items()
    ], key=lambda x: x["avg_score"], reverse=True)

    # ── Scout activity summary ────────────────────────────────────────────────
    total_ratings = len(ratings)
    unique_scouts = len(set(r.get("user_id", "") for r in ratings if "user_id" in r))
    # Note: ratings don't always have user_id in projection — get count separately
    unique_count = await db.ratings.distinct(
        "user_id",
        {"venue_id": {"$in": venue_ids}, "timestamp": {"$gte": since}},
    )

    return {
        "city": city,
        "period_days": days,
        "total_venues": len(venues),
        "top_areas": top_areas[:10],
        "best_nights": best_nights,
        "venue_category_breakdown": category_breakdown,
        "peak_hours_city": peak_hours,
        "scout_activity": {
            "total_scouts": len(unique_count),
            "total_ratings": total_ratings,
            "ratings_per_scout": round(total_ratings / max(len(unique_count), 1), 1),
        },
        "generated_at": now.isoformat(),
        "data_note": (
            "Aggregated from verified scout check-ins. "
            "Available as enterprise data feed for brands, real estate, and event promoters."
        ),
    }
