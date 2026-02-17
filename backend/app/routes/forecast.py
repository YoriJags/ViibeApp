"""
Vibe Forecast Routes
Predicted energy curves for tonight.
"""
from fastapi import APIRouter, HTTPException, Request

from app.config import db
from app.services.auth import get_current_user
from app.services.forecast import generate_forecast, get_forecast_accuracy

router = APIRouter(tags=["forecast"])


@router.get("/forecast/{venue_id}")
async def get_public_forecast(venue_id: str):
    """Public: get tonight's vibe forecast for a venue."""
    venue = await db.venues.find_one({"id": venue_id})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    forecast = await generate_forecast(venue_id)
    if not forecast:
        return {
            "venue_id": venue_id,
            "venue_name": venue.get("name", ""),
            "forecast": None,
            "message": "Not enough historical data for forecast",
        }

    return {
        "venue_id": venue_id,
        "venue_name": venue.get("name", ""),
        **forecast,
    }


@router.get("/merchant/venue/{venue_id}/forecast")
async def get_merchant_forecast(venue_id: str, request: Request):
    """Merchant: detailed forecast with accuracy history."""
    user = await get_current_user(request)
    if not user or user.get("merchant_venue_id") != venue_id:
        raise HTTPException(status_code=403, detail="Not authorized for this venue")

    venue = await db.venues.find_one({"id": venue_id})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    forecast = await generate_forecast(venue_id)
    accuracy = await get_forecast_accuracy(venue_id)

    return {
        "venue_id": venue_id,
        "venue_name": venue.get("name", ""),
        "forecast": forecast,
        "accuracy": accuracy,
    }
