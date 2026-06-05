"""
Viibe App - Venue Routes
Venue listing, details, direction clicks, and city data.
"""
from typing import Optional
from datetime import datetime, timedelta, timezone
import asyncio
from fastapi import APIRouter, Header

from app.config import db, CITIES

router = APIRouter(tags=["venues"])


async def _resolve_user_id(authorization: str) -> Optional[str]:
    """Best-effort user id from a Bearer token. Anonymous (None) is fine —
    intent events still count toward window volume even without a person."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    user = await db.users.find_one({"token": authorization.split(" ")[1]}, {"id": 1})
    return user.get("id") if user else None


async def _log_intent(venue_id: str, intent_type: str, authorization: str = "") -> None:
    """
    Append a timestamped intent event for attribution (the money organ).
    `intent_type` ∈ {"profile_view", "direction"}. Runs alongside the existing
    counter `$inc` — counters stay for the legacy dashboard; events power the
    tap→arrival correlation. Best-effort: never breaks the parent request.
    """
    try:
        user_id = await _resolve_user_id(authorization)
        await db.venue_intent_events.insert_one({
            "venue_id": venue_id,
            "type":     intent_type,
            "user_id":  user_id,
            "ts":       datetime.now(timezone.utc),
        })
    except Exception:
        pass


async def _update_venue_scores(venue_id: str) -> None:
    """
    Compute and cache vibe_tier + avg_score_30d on the venue document.
    Runs async in background — does not block the request.
    Refreshes at most once per hour per venue.
    """
    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0, "vibe_tier": 1, "updated_scores_at": 1})
    if not venue:
        return
    # Rate-limit: don't recompute if updated < 1 hour ago
    last = venue.get("updated_scores_at")
    if last:
        if isinstance(last, str):
            last = datetime.fromisoformat(last.replace("Z", "+00:00"))
        if (datetime.now(timezone.utc) - last).total_seconds() < 3600:
            return

    now = datetime.now(timezone.utc)
    thirty_ago = now - timedelta(days=30)

    ratings = await db.ratings.find(
        {"venue_id": venue_id, "timestamp": {"$gte": thirty_ago}},
        {"vibe_score": 1, "_id": 0},
    ).to_list(2000)

    if not ratings:
        return

    avg_30d = round(sum(r.get("vibe_score", 0) for r in ratings) / len(ratings), 1)

    # Simple tier from 30d avg (full 90d computation happens in reputation endpoint)
    if avg_30d >= 80:
        tier = "Elite"
    elif avg_30d >= 65:
        tier = "Established"
    elif avg_30d >= 50:
        tier = "Solid"
    elif avg_30d >= 35:
        tier = "Building"
    else:
        tier = "New"

    await db.venues.update_one(
        {"id": venue_id},
        {"$set": {
            "avg_score_30d": avg_30d,
            "vibe_tier": tier,
            "updated_scores_at": now,
        }},
    )


def compute_is_open_now(venue: dict) -> Optional[bool]:
    """
    Returns True if venue is open now, False if closed, None if no hours set.
    operating_hours format: {"mon": {"open": "18:00", "close": "02:00"}, "sun": null, ...}
    close < open means the venue closes the following day (crosses midnight).
    WAT = UTC+1.
    """
    hours = venue.get("operating_hours")
    if not hours:
        return None

    now_wat = datetime.now(timezone.utc) + timedelta(hours=1)
    day_key = now_wat.strftime("%a").lower()  # "mon", "tue", ...
    day_hours = hours.get(day_key)
    if day_hours is None:
        return False  # closed today

    try:
        open_h, open_m = map(int, day_hours["open"].split(":"))
        close_h, close_m = map(int, day_hours["close"].split(":"))
    except (KeyError, ValueError):
        return None

    now_mins = now_wat.hour * 60 + now_wat.minute
    open_mins = open_h * 60 + open_m
    close_mins = close_h * 60 + close_m

    if close_mins <= open_mins:  # crosses midnight
        return now_mins >= open_mins or now_mins <= close_mins
    return open_mins <= now_mins <= close_mins


def next_open_label(venue: dict) -> Optional[str]:
    """Returns 'Opens at HH:MM' string for the next opening time, or None."""
    hours = venue.get("operating_hours")
    if not hours:
        return None

    now_wat = datetime.now(timezone.utc) + timedelta(hours=1)
    days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
    today_idx = now_wat.weekday()

    for offset in range(7):
        day_key = days[(today_idx + offset) % 7]
        day_hours = hours.get(day_key)
        if not day_hours:
            continue
        try:
            label = day_hours["open"]
            if offset == 0:
                return f"Opens at {label}"
            elif offset == 1:
                return f"Opens tomorrow at {label}"
            else:
                day_name = day_key.capitalize()
                return f"Opens {day_name} at {label}"
        except (KeyError, TypeError):
            continue
    return None


def compute_pulse(venue: dict) -> dict:
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


@router.get("/cities")
async def get_cities():
    """Get all supported cities."""
    return list(CITIES.values())


@router.get("/venues")
async def get_venues(city: Optional[str] = None):
    """Get all venues, optionally filtered by city. Attaches ratings_last_30m for spike detection."""
    query = {"city": city} if city else {}
    venues = await db.venues.find(query, {"_id": 0}).to_list(100)

    # Attach 30-min rating counts for seismic ring display
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=30)
    pipeline = [
        {"$match": {"timestamp": {"$gte": cutoff}}},
        {"$group": {"_id": "$venue_id", "count": {"$sum": 1}}},
    ]
    spike_data = {r["_id"]: r["count"] async for r in db.ratings.aggregate(pipeline)}
    for venue in venues:
        venue["ratings_last_30m"] = spike_data.get(venue.get("id"), 0)
        venue["pulse"] = compute_pulse(venue)
        is_open = compute_is_open_now(venue)
        venue["is_open_now"] = is_open
        if is_open is False:
            venue["next_open"] = next_open_label(venue)

    return venues


@router.get("/venues/{venue_id}")
async def get_venue(venue_id: str, authorization: str = Header(default="")):
    """Get a single venue by ID. Increments profile views."""
    from fastapi import HTTPException
    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    # Increment profile views + refresh reputation scores in background
    await db.venues.update_one({"id": venue_id}, {"$inc": {"profile_views": 1}})
    asyncio.create_task(_log_intent(venue_id, "profile_view", authorization))
    asyncio.create_task(_update_venue_scores(venue_id))

    venue["pulse"] = compute_pulse(venue)
    is_open = compute_is_open_now(venue)
    venue["is_open_now"] = is_open
    if is_open is False:
        venue["next_open"] = next_open_label(venue)

    return venue


@router.post("/venues/{venue_id}/direction-click")
async def record_direction_click(venue_id: str, authorization: str = Header(default="")):
    """Record when user clicks direction/location icon. The strongest pre-arrival
    intent signal — someone asking for directions is about to come."""
    await db.venues.update_one({"id": venue_id}, {"$inc": {"direction_clicks": 1}})
    asyncio.create_task(_log_intent(venue_id, "direction", authorization))
    return {"message": "Direction click recorded"}


@router.get("/venues/{venue_id}/comparative")
async def get_venue_comparative(venue_id: str):
    """
    AI-04: Comparative framing — "Hotter than last Saturday at this time."

    Compares the current vibe score against the same venue's average score
    during the equivalent time window last week (same day-of-week ± 1 hour).

    Returns:
      - label: "hotter" | "cooler" | "similar" | "no_history"
      - current_score: live score right now
      - historical_avg: average score at this time last week
      - framing: human-readable comparison string
      - day_label: e.g. "last Saturday"
    """
    from fastapi import HTTPException

    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0, "current_vibe_score": 1, "name": 1})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    now = datetime.now(timezone.utc)
    current_score = venue.get("current_vibe_score", 0)

    # Same time window last week (± 60 minutes)
    last_week_start = now - timedelta(days=7, hours=1)
    last_week_end   = now - timedelta(days=7) + timedelta(hours=1)

    historical_ratings = await db.ratings.find(
        {
            "venue_id":  venue_id,
            "timestamp": {"$gte": last_week_start, "$lte": last_week_end},
            "provisional": {"$ne": True},
            "low_confidence": {"$ne": True},
        },
        {"vibe_score": 1},
    ).to_list(200)

    if not historical_ratings:
        return {
            "label": "no_history",
            "current_score": current_score,
            "historical_avg": None,
            "framing": None,
            "day_label": None,
        }

    scores = [r["vibe_score"] for r in historical_ratings if r.get("vibe_score") is not None]
    if not scores:
        return {
            "label": "no_history",
            "current_score": current_score,
            "historical_avg": None,
            "framing": None,
            "day_label": None,
        }

    historical_avg = round(sum(scores) / len(scores), 1)
    diff = current_score - historical_avg

    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    day_label = f"last {day_names[now.weekday()]}"

    if diff >= 10:
        label = "hotter"
        framing = f"Hotter than {day_label} at this time"
    elif diff <= -10:
        label = "cooler"
        framing = f"Cooler than {day_label} at this time"
    else:
        label = "similar"
        framing = f"Similar to {day_label} at this time"

    return {
        "label": label,
        "current_score": current_score,
        "historical_avg": historical_avg,
        "diff": round(diff, 1),
        "framing": framing,
        "day_label": day_label,
    }
