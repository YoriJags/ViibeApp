"""
Vibe App - Pulse Drop Routes (Public)
Public-facing pulse drop endpoints: tiers, purchase, nearby drops.
"""
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException

from app.config import db, sio, PULSE_DROP_TIERS
from app.models import PulseDrop, PulseDropCreate, PlatformRevenue, MerchantWallet, WalletTransaction
from app.services.vibe import calculate_venue_aggregate, calculate_distance
from app.services.realtime import broadcast_venue_update, broadcast_leaderboard

router = APIRouter(tags=["pulse_drops"])


@router.get("/pulse-drops/tiers")
async def get_pulse_drop_tiers():
    """Get available Pulse Drop tiers and pricing."""
    return PULSE_DROP_TIERS


@router.post("/pulse-drops/purchase")
async def purchase_pulse_drop(drop_data: PulseDropCreate):
    """Purchase pulse drop using wallet balance (instant credit to treasury)."""
    venue = await db.venues.find_one({"id": drop_data.venue_id})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    tier_config = PULSE_DROP_TIERS.get(drop_data.tier)
    if not tier_config:
        raise HTTPException(status_code=400, detail="Invalid tier")

    price = tier_config["price"]

    wallet = await db.merchant_wallets.find_one({"venue_id": drop_data.venue_id})
    if not wallet or wallet.get("balance", 0) < price:
        raise HTTPException(
            status_code=402,
            detail=f"Insufficient balance. Required: NGN{price:,}, Available: NGN{wallet.get('balance', 0) if wallet else 0:,}",
        )

    # Deduct from wallet
    balance_before = wallet["balance"]
    new_balance = balance_before - price

    await db.merchant_wallets.update_one(
        {"id": wallet["id"]},
        {"$set": {
            "balance": new_balance,
            "total_spent": wallet.get("total_spent", 0) + price,
        }},
    )

    wallet_tx = WalletTransaction(
        wallet_id=wallet["id"],
        type="pulse_drop_spend",
        amount=price,
        balance_before=balance_before,
        balance_after=new_balance,
        description=f"Pulse Drop - {tier_config['name']}",
    )
    await db.wallet_transactions.insert_one(wallet_tx.dict())

    # Credit platform treasury
    revenue = PlatformRevenue(
        type="pulse_drop",
        venue_id=drop_data.venue_id,
        venue_name=venue["name"],
        amount=price,
        tier=drop_data.tier,
        city=venue.get("city", "lagos"),
    )
    await db.platform_revenue.insert_one(revenue.dict())

    # Create pulse drop
    expires_at = datetime.now(timezone.utc) + timedelta(hours=tier_config["duration_hours"])

    pulse_drop = PulseDrop(
        venue_id=drop_data.venue_id,
        venue_name=venue["name"],
        tier=drop_data.tier,
        message=drop_data.message,
        radius_km=tier_config["radius_km"],
        glow_boost=tier_config["glow_boost"],
        chart_placement=tier_config.get("chart_placement"),
        price_paid=price,
        city=venue.get("city", "lagos"),
        expires_at=expires_at,
        profile_views_before=venue.get("profile_views", 0),
        direction_clicks_before=venue.get("direction_clicks", 0),
    )
    await db.pulse_drops.insert_one(pulse_drop.dict())

    # Update venue with pulse drop effects
    update_data = {
        "active_pulse_tier": drop_data.tier,
        "pulse_expires_at": expires_at,
        "glow_boost": tier_config["glow_boost"],
    }
    if tier_config.get("custom_icon"):
        update_data["custom_icon"] = "supernova"

    await db.venues.update_one({"id": drop_data.venue_id}, {"$set": update_data})

    # Recalculate venue score with boost
    aggregate = await calculate_venue_aggregate(drop_data.venue_id)
    await db.venues.update_one({"id": drop_data.venue_id}, {"$set": aggregate})

    # Broadcast updates
    await broadcast_venue_update(drop_data.venue_id)
    await broadcast_leaderboard(venue.get("city", "lagos"))
    await broadcast_leaderboard("all")

    await sio.emit("pulse_drop", {
        "drop": pulse_drop.dict(),
        "venue": venue,
        "tier": tier_config,
    }, room=f"city_{venue.get('city', 'lagos')}")

    return {
        "pulse_drop": pulse_drop.dict(),
        "new_wallet_balance": new_balance,
    }


@router.get("/pulse-drops/nearby/{lat}/{lng}")
async def get_nearby_pulse_drops(lat: float, lng: float, radius_km: float = 10.0):
    """Get active pulse drops near a location."""
    now = datetime.now(timezone.utc)
    drops = await db.pulse_drops.find({"expires_at": {"$gte": now}}, {"_id": 0}).to_list(50)

    nearby_drops = []
    for drop in drops:
        venue = await db.venues.find_one({"id": drop["venue_id"]}, {"_id": 0})
        if venue:
            coords = venue.get("coordinates", {})
            distance = calculate_distance(lat, lng, coords.get("lat", 0), coords.get("lng", 0))
            if distance <= drop.get("radius_km", 5) * 1000:
                drop["venue"] = venue
                drop["distance_m"] = round(distance)
                nearby_drops.append(drop)

    return nearby_drops
