"""
Vibe App - Venue Routes
Venue listing, details, direction clicks, and city data.
"""
from typing import Optional
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter

from app.config import db, CITIES

router = APIRouter(tags=["venues"])


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

    return venues


@router.get("/venues/{venue_id}")
async def get_venue(venue_id: str):
    """Get a single venue by ID. Increments profile views."""
    from fastapi import HTTPException
    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    # Increment profile views
    await db.venues.update_one({"id": venue_id}, {"$inc": {"profile_views": 1}})
    venue["pulse"] = compute_pulse(venue)

    return venue


@router.post("/venues/{venue_id}/direction-click")
async def record_direction_click(venue_id: str):
    """Record when user clicks direction/location icon."""
    await db.venues.update_one({"id": venue_id}, {"$inc": {"direction_clicks": 1}})
    return {"message": "Direction click recorded"}
