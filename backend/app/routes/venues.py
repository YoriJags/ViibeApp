"""
Vibe App - Venue Routes
Venue listing, details, direction clicks, and city data.
"""
from typing import Optional
from fastapi import APIRouter

from app.config import db, CITIES

router = APIRouter(tags=["venues"])


@router.get("/cities")
async def get_cities():
    """Get all supported cities."""
    return list(CITIES.values())


@router.get("/venues")
async def get_venues(city: Optional[str] = None):
    """Get all venues, optionally filtered by city."""
    query = {"city": city} if city else {}
    venues = await db.venues.find(query, {"_id": 0}).to_list(100)
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

    return venue


@router.post("/venues/{venue_id}/direction-click")
async def record_direction_click(venue_id: str):
    """Record when user clicks direction/location icon."""
    await db.venues.update_one({"id": venue_id}, {"$inc": {"direction_clicks": 1}})
    return {"message": "Direction click recorded"}
