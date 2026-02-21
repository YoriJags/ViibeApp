"""
Energy Campaigns Routes
Merchants pay to create clout-multiplier campaigns that drive foot traffic.
Race condition fixed: partial unique index + DuplicateKeyError handling.
"""
import uuid
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from pymongo.errors import DuplicateKeyError

from app.config import db, logger
from app.services.auth import get_current_user
from app.services.notifications import send_push_notification
from app.services.realtime import emit_campaign_update
from app.services.economy import get_economy_config

router = APIRouter(tags=["campaigns"])


class CampaignCreate(BaseModel):
    multiplier: int  # 2 or 3
    duration_hours: int  # 2, 4, or 8


@router.post("/merchant/venue/{venue_id}/campaigns")
async def create_campaign(venue_id: str, body: CampaignCreate, request: Request):
    """Create an energy campaign. Debits merchant wallet."""
    user = await get_current_user(request)
    if not user or user.get("merchant_venue_id") != venue_id:
        raise HTTPException(status_code=403, detail="Not authorized for this venue")

    if body.multiplier not in (2, 3):
        raise HTTPException(status_code=400, detail="Multiplier must be 2 or 3")
    if body.duration_hours not in (2, 4, 8):
        raise HTTPException(status_code=400, detail="Duration must be 2, 4, or 8 hours")

    economy = await get_economy_config()
    pricing_key = f"{body.multiplier}x_{body.duration_hours}h"
    price = economy["campaigns"].get(pricing_key)
    if not price:
        raise HTTPException(status_code=400, detail="Invalid campaign configuration")

    venue = await db.venues.find_one({"id": venue_id})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    now = datetime.now(timezone.utc)

    # Atomically debit wallet (balance check is part of the filter)
    wallet = await db.merchant_wallets.find_one_and_update(
        {"venue_id": venue_id, "balance": {"$gte": price}},
        {
            "$inc": {"balance": -price, "total_spent": price},
        },
        return_document=True,
    )

    if not wallet:
        raise HTTPException(
            status_code=402,
            detail=f"Insufficient wallet balance. Campaign costs ₦{price:,}",
        )

    campaign_id = str(uuid.uuid4())
    expires_at = now + timedelta(hours=body.duration_hours)

    campaign = {
        "id": campaign_id,
        "venue_id": venue_id,
        "venue_name": venue.get("name", ""),
        "city": venue.get("city", "lagos"),
        "multiplier": body.multiplier,
        "duration_hours": body.duration_hours,
        "price_paid": price,
        "status": "active",
        "ratings_during": 0,
        "clout_distributed": 0,
        "direction_clicks_before": venue.get("direction_clicks", 0),
        "created_at": now,
        "expires_at": expires_at,
    }

    # Insert campaign - partial unique index prevents duplicates per venue
    # If two requests race, only one succeeds; the other gets DuplicateKeyError
    try:
        await db.campaigns.insert_one(campaign)
    except DuplicateKeyError:
        # Refund wallet since campaign creation failed
        await db.merchant_wallets.update_one(
            {"venue_id": venue_id},
            {"$inc": {"balance": price, "total_spent": -price}},
        )
        raise HTTPException(status_code=409, detail="A campaign is already active for this venue")

    # Record transaction
    await db.wallet_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "wallet_id": wallet["id"],
        "type": "campaign_spend",
        "amount": price,
        "balance_before": wallet["balance"] + price,
        "balance_after": wallet["balance"],
        "reference": campaign_id,
        "description": f"Energy Campaign: {body.multiplier}x for {body.duration_hours}h",
        "timestamp": now,
    })

    # Notify lobby users
    city = venue.get("city", "lagos")
    lobby_entries = await db.lobby.find({"venue_id": venue_id}).to_list(500)
    for entry in lobby_entries:
        await send_push_notification(
            user_id=entry["user_id"],
            title=f"{body.multiplier}x Clout at {venue.get('name', 'a venue')}!",
            body=f"Energy Campaign is LIVE. Earn {body.multiplier}x Clout for the next {body.duration_hours} hours!",
            data={"type": "campaign_active", "venue_id": venue_id},
        )

    # Broadcast via Socket.IO
    await emit_campaign_update(city, {
        "venue_id": venue_id,
        "venue_name": venue.get("name", ""),
        "multiplier": body.multiplier,
        "duration_hours": body.duration_hours,
        "expires_at": expires_at.isoformat(),
    })

    return {
        "campaign_id": campaign_id,
        "multiplier": body.multiplier,
        "duration_hours": body.duration_hours,
        "price_paid": price,
        "expires_at": expires_at.isoformat(),
        "wallet_balance": wallet["balance"],
    }


@router.get("/campaigns/active")
async def get_active_campaigns(city: str = "lagos"):
    """Public: get active campaigns in a city."""
    now = datetime.now(timezone.utc)
    campaigns = await db.campaigns.find({
        "city": city,
        "status": "active",
        "expires_at": {"$gt": now},
    }, {"_id": 0}).to_list(50)

    return {"campaigns": campaigns}


@router.get("/merchant/venue/{venue_id}/campaigns")
async def get_campaign_history(venue_id: str, request: Request):
    """Merchant: campaign history + ROI."""
    user = await get_current_user(request)
    if not user or user.get("merchant_venue_id") != venue_id:
        raise HTTPException(status_code=403, detail="Not authorized for this venue")

    campaigns = await db.campaigns.find(
        {"venue_id": venue_id},
        {"_id": 0},
    ).sort("created_at", -1).to_list(50)

    # Calculate ROI for completed campaigns
    for campaign in campaigns:
        if campaign.get("status") == "completed" or (
            campaign.get("expires_at") and
            datetime.fromisoformat(str(campaign["expires_at"]).replace("Z", "+00:00")) < datetime.now(timezone.utc)
        ):
            campaign["status"] = "completed"
            venue = await db.venues.find_one({"id": venue_id})
            clicks_after = venue.get("direction_clicks", 0) if venue else 0
            campaign["direction_clicks_gained"] = clicks_after - campaign.get("direction_clicks_before", 0)

    return {"campaigns": campaigns}


@router.delete("/merchant/venue/{venue_id}/campaigns/{campaign_id}")
async def cancel_campaign(venue_id: str, campaign_id: str, request: Request):
    """Cancel an active campaign (no refund if already started)."""
    user = await get_current_user(request)
    if not user or user.get("merchant_venue_id") != venue_id:
        raise HTTPException(status_code=403, detail="Not authorized for this venue")

    result = await db.campaigns.update_one(
        {"id": campaign_id, "venue_id": venue_id, "status": "active"},
        {"$set": {"status": "cancelled", "cancelled_at": datetime.now(timezone.utc)}},
    )

    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Active campaign not found")

    return {"cancelled": True}
