"""
Vibe App - Merchant Routes
Merchant dashboard, wallet, venue management, sentiment, and pulse drop controls.
"""
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Request
import httpx

from app.config import db, logger, PAYSTACK_SECRET_KEY
from app.models import MerchantWallet, WalletTransaction, VenueUpdateRequest
from app.services.auth import get_current_user
from app.services.economy import get_economy_config

router = APIRouter(tags=["merchant"])


# ===== Wallet Routes =====

@router.get("/merchant/wallet/{venue_id}")
async def get_merchant_wallet(venue_id: str):
    """Get merchant wallet for a venue."""
    wallet = await db.merchant_wallets.find_one({"venue_id": venue_id}, {"_id": 0})
    if not wallet:
        wallet = MerchantWallet(
            merchant_id=venue_id,
            venue_id=venue_id,
        ).dict()
        await db.merchant_wallets.insert_one(wallet)

    transactions = await db.wallet_transactions.find(
        {"wallet_id": wallet["id"]}
    ).sort("timestamp", -1).limit(20).to_list(20)

    return {"wallet": wallet, "transactions": transactions}


@router.post("/merchant/wallet/{venue_id}/topup/initialize")
async def initialize_wallet_topup(venue_id: str, request: Request):
    """Initialize Paystack payment for wallet top-up. Idempotent via idempotency_key."""
    body = await request.json()
    amount = body.get("amount", 0)
    email = body.get("email", "")
    idempotency_key = body.get("idempotency_key", "")

    economy = await get_economy_config()
    min_topup = economy["wallet"]["min_topup"]
    if amount < min_topup:
        raise HTTPException(status_code=400, detail=f"Minimum top-up is ₦{min_topup:,}")

    # Idempotency: if client sends same key, return existing pending topup
    if idempotency_key:
        existing = await db.pending_topups.find_one({
            "idempotency_key": idempotency_key,
            "venue_id": venue_id,
        })
        if existing:
            return {
                "authorization_url": existing.get("authorization_url", ""),
                "reference": existing["reference"],
                "cached": True,
            }

    reference = f"VIBE-TOPUP-{venue_id[:8]}-{uuid.uuid4().hex[:8]}"

    topup_doc = {
        "reference": reference,
        "venue_id": venue_id,
        "amount": amount,
        "status": "pending",
        "created_at": datetime.now(timezone.utc),
    }
    if idempotency_key:
        topup_doc["idempotency_key"] = idempotency_key

    await db.pending_topups.insert_one(topup_doc)

    if PAYSTACK_SECRET_KEY:
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                paystack_response = await client.post(
                    "https://api.paystack.co/transaction/initialize",
                    headers={
                        "Authorization": f"Bearer {PAYSTACK_SECRET_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "email": email,
                        "amount": int(amount * 100),
                        "reference": reference,
                        "metadata": {"venue_id": venue_id, "type": "wallet_topup"},
                    },
                )

                if paystack_response.status_code == 200:
                    data = paystack_response.json()
                    auth_url = data["data"]["authorization_url"]
                    # Store the URL for idempotency lookups
                    await db.pending_topups.update_one(
                        {"reference": reference},
                        {"$set": {"authorization_url": auth_url}},
                    )
                    return {
                        "authorization_url": auth_url,
                        "reference": reference,
                    }
                else:
                    logger.error(f"Paystack init failed: {paystack_response.status_code} - {paystack_response.text}")
                    raise HTTPException(status_code=502, detail="Payment provider error. Please try again.")
        except httpx.TimeoutException:
            logger.error(f"Paystack timeout for reference {reference}")
            raise HTTPException(status_code=504, detail="Payment provider timeout. Please try again.")
        except httpx.RequestError as e:
            logger.error(f"Paystack connection error: {e}")
            raise HTTPException(status_code=502, detail="Could not reach payment provider. Please try again.")

    return {
        "authorization_url": f"https://checkout.paystack.com/mock/{reference}",
        "reference": reference,
        "mock": True,
    }


@router.post("/merchant/wallet/verify/{reference}")
async def verify_wallet_topup(reference: str):
    """Verify Paystack payment and credit wallet. Idempotent - safe to call multiple times."""
    pending = await db.pending_topups.find_one({"reference": reference})
    if not pending:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if pending.get("status") == "completed":
        wallet = await db.merchant_wallets.find_one({"venue_id": pending["venue_id"]}, {"_id": 0})
        return {"message": "Already processed", "success": True, "new_balance": wallet.get("balance", 0) if wallet else 0}

    # Atomically claim this reference to prevent double-credit race condition
    claim = await db.pending_topups.update_one(
        {"reference": reference, "status": "pending"},
        {"$set": {"status": "verifying"}},
    )
    if claim.modified_count == 0:
        # Another request already claimed it
        return {"message": "Already being processed", "success": True}

    verified = False
    if PAYSTACK_SECRET_KEY:
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(
                    f"https://api.paystack.co/transaction/verify/{reference}",
                    headers={"Authorization": f"Bearer {PAYSTACK_SECRET_KEY}"},
                )
                if response.status_code == 200:
                    data = response.json()
                    paystack_data = data.get("data", {})
                    if paystack_data.get("status") == "success":
                        # Verify amount matches what we expected (prevents tampering)
                        paid_amount_kobo = paystack_data.get("amount", 0)
                        expected_kobo = int(pending["amount"] * 100)
                        if paid_amount_kobo >= expected_kobo:
                            verified = True
                        else:
                            logger.warning(f"Amount mismatch: paid={paid_amount_kobo}, expected={expected_kobo}, ref={reference}")
                else:
                    logger.error(f"Paystack verify returned {response.status_code} for {reference}")
        except (httpx.TimeoutException, httpx.RequestError) as e:
            logger.error(f"Paystack verify error for {reference}: {e}")
            # Reset to pending so it can be retried
            await db.pending_topups.update_one(
                {"reference": reference, "status": "verifying"},
                {"$set": {"status": "pending"}},
            )
            raise HTTPException(status_code=502, detail="Could not verify with payment provider. Please retry.")
    else:
        verified = True  # Auto-verify for testing

    if verified:
        # Use atomic $inc to credit wallet (prevents race conditions)
        wallet = await db.merchant_wallets.find_one({"venue_id": pending["venue_id"]})
        if not wallet:
            wallet = MerchantWallet(
                merchant_id=pending["venue_id"],
                venue_id=pending["venue_id"],
            ).dict()
            await db.merchant_wallets.insert_one(wallet)
            wallet = await db.merchant_wallets.find_one({"venue_id": pending["venue_id"]})

        balance_before = wallet.get("balance", 0)

        await db.merchant_wallets.update_one(
            {"venue_id": pending["venue_id"]},
            {"$inc": {
                "balance": pending["amount"],
                "total_deposited": pending["amount"],
            }},
        )

        # Re-read for accurate balance after atomic increment
        updated_wallet = await db.merchant_wallets.find_one({"venue_id": pending["venue_id"]})
        new_balance = updated_wallet.get("balance", 0)

        tx = WalletTransaction(
            wallet_id=wallet["id"],
            type="deposit",
            amount=pending["amount"],
            balance_before=balance_before,
            balance_after=new_balance,
            paystack_reference=reference,
            description="Wallet top-up via Paystack",
        )
        await db.wallet_transactions.insert_one(tx.dict())

        await db.pending_topups.update_one(
            {"reference": reference},
            {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc)}},
        )

        return {"success": True, "new_balance": new_balance}

    # Verification failed - reset to pending for retry
    await db.pending_topups.update_one(
        {"reference": reference, "status": "verifying"},
        {"$set": {"status": "failed"}},
    )
    raise HTTPException(status_code=400, detail="Payment verification failed")


# ===== Merchant Dashboard =====

@router.get("/merchant/venue/{venue_id}/stats")
async def get_merchant_venue_stats(venue_id: str, request: Request):
    """Get detailed stats for venue owner with ROI metrics."""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if user.get("merchant_venue_id") != venue_id:
        raise HTTPException(status_code=403, detail="You can only view your own venue stats")

    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    now = datetime.now(timezone.utc)
    hour_ago = now - timedelta(hours=1)
    day_ago = now - timedelta(hours=24)
    week_ago = now - timedelta(days=7)

    ratings_1h = await db.ratings.count_documents({"venue_id": venue_id, "timestamp": {"$gte": hour_ago}})
    ratings_24h = await db.ratings.count_documents({"venue_id": venue_id, "timestamp": {"$gte": day_ago}})
    ratings_7d = await db.ratings.count_documents({"venue_id": venue_id, "timestamp": {"$gte": week_ago}})

    profile_views = venue.get("profile_views", 0)
    direction_clicks = venue.get("direction_clicks", 0)

    # District average for Heatmap Delta
    district_venues = await db.venues.find({
        "city": venue.get("city"),
        "area": venue.get("area"),
    }, {"_id": 0}).to_list(50)

    district_avg = sum(v.get("current_vibe_score", 0) for v in district_venues) / len(district_venues) if district_venues else 0
    heatmap_delta = venue.get("current_vibe_score", 0) - district_avg

    # Pulse Drop ROI
    recent_drops = await db.pulse_drops.find({
        "venue_id": venue_id,
        "created_at": {"$gte": week_ago},
    }, {"_id": 0}).to_list(20)

    pulse_drop_roi = []
    for drop in recent_drops:
        views_gained = venue.get("profile_views", 0) - drop.get("profile_views_before", 0)
        directions_gained = venue.get("direction_clicks", 0) - drop.get("direction_clicks_before", 0)
        pulse_drop_roi.append({
            "id": drop["id"],
            "tier": drop["tier"],
            "price": drop["price_paid"],
            "profile_views_gained": views_gained,
            "direction_clicks_gained": directions_gained,
            "created_at": drop["created_at"],
        })

    # Hourly trend
    hourly_scores = []
    for h in range(24):
        start = now - timedelta(hours=h + 1)
        end = now - timedelta(hours=h)
        ratings = await db.ratings.find({
            "venue_id": venue_id,
            "timestamp": {"$gte": start, "$lt": end},
        }, {"_id": 0, "vibe_score": 1}).to_list(100)

        avg_score = sum(r.get("vibe_score", 0) for r in ratings) / len(ratings) if ratings else 0
        hourly_scores.append({"hour": h, "score": round(avg_score, 1), "count": len(ratings)})

    # Competition
    competitors = await db.venues.find(
        {"city": venue.get("city"), "area": venue.get("area"), "id": {"$ne": venue_id}},
        {"_id": 0, "id": 1, "name": 1, "current_vibe_score": 1, "area": 1},
    ).sort("current_vibe_score", -1).limit(5).to_list(5)

    all_area_venues = await db.venues.find(
        {"city": venue.get("city"), "area": venue.get("area")},
        {"_id": 0, "id": 1, "current_vibe_score": 1},
    ).sort("current_vibe_score", -1).to_list(100)
    rank = next((i + 1 for i, v in enumerate(all_area_venues) if v["id"] == venue_id), 0)

    wallet = await db.merchant_wallets.find_one({"venue_id": venue_id}, {"_id": 0})

    return {
        "venue": venue,
        "stats": {
            "ratings_1h": ratings_1h,
            "ratings_24h": ratings_24h,
            "ratings_7d": ratings_7d,
            "profile_views": profile_views,
            "direction_clicks": direction_clicks,
            "current_rank": rank,
            "total_area_venues": len(all_area_venues),
        },
        "heatmap_delta": {
            "venue_score": venue.get("current_vibe_score", 0),
            "district_average": round(district_avg, 1),
            "delta": round(heatmap_delta, 1),
        },
        "pulse_drop_roi": pulse_drop_roi,
        "hourly_trend": hourly_scores,
        "competitors": competitors,
        "wallet_balance": wallet.get("balance", 0) if wallet else 0,
        "pulse_drop_tiers": (await get_economy_config())["pulse_drops"],
    }


# ===== Venue Content Management =====

@router.put("/merchant/venue/{venue_id}/update")
async def update_venue_content(venue_id: str, update: VenueUpdateRequest, request: Request):
    """Merchant can update their venue's public info."""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if user.get("merchant_venue_id") != venue_id:
        raise HTTPException(status_code=403, detail="You can only update your own venue")

    venue = await db.venues.find_one({"id": venue_id})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    update_data = {}
    if update.entry_fee is not None:
        update_data["entry_fee"] = update.entry_fee
    if update.music_genre is not None:
        update_data["music_genre"] = update.music_genre
    if update.tables_available is not None:
        update_data["tables_available"] = update.tables_available
    if update.geofence_radius_m is not None:
        update_data["geofence_radius_m"] = max(20, min(500, update.geofence_radius_m))

    if update_data:
        await db.venues.update_one({"id": venue_id}, {"$set": update_data})

    updated_venue = await db.venues.find_one({"id": venue_id}, {"_id": 0})
    return {
        "success": True,
        "message": "Venue updated successfully - changes are now live!",
        "venue": updated_venue,
    }


@router.get("/merchant/venue/{venue_id}/sentiment")
async def get_venue_sentiment(venue_id: str, request: Request):
    """Get vibe sentiment breakdown (gate/queue, capacity ratings)."""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if user.get("merchant_venue_id") != venue_id:
        raise HTTPException(status_code=403, detail="You can only view your own venue data")

    now = datetime.now(timezone.utc)
    day_ago = now - timedelta(hours=24)

    recent_ratings = await db.ratings.find({
        "venue_id": venue_id,
        "timestamp": {"$gte": day_ago},
    }, {"_id": 0}).sort("timestamp", -1).to_list(50)

    gate_counts = {"clear": 0, "slow": 0, "blocked": 0}
    capacity_counts = {"sparse": 0, "vibrant": 0, "full": 0}
    energy_counts = {"chill": 0, "popping": 0, "electric": 0}

    for rating in recent_ratings:
        gate_counts[rating.get("gate", "clear")] += 1
        capacity_counts[rating.get("capacity", "sparse")] += 1
        energy_counts[rating.get("energy", "chill")] += 1

    total = len(recent_ratings) or 1

    dominant_gate = max(gate_counts, key=gate_counts.get)
    dominant_capacity = max(capacity_counts, key=capacity_counts.get)
    dominant_energy = max(energy_counts, key=energy_counts.get)

    wait_estimates = {"clear": "No wait", "slow": "~15 min wait", "blocked": "Long queue (30min+)"}

    return {
        "venue_id": venue_id,
        "total_checks_24h": len(recent_ratings),
        "sentiment": {
            "gate": {
                "dominant": dominant_gate,
                "wait_estimate": wait_estimates[dominant_gate],
                "breakdown": gate_counts,
                "percentage": round(gate_counts[dominant_gate] / total * 100),
            },
            "capacity": {
                "dominant": dominant_capacity,
                "breakdown": capacity_counts,
                "percentage": round(capacity_counts[dominant_capacity] / total * 100),
            },
            "energy": {
                "dominant": dominant_energy,
                "breakdown": energy_counts,
                "percentage": round(energy_counts[dominant_energy] / total * 100),
            },
        },
        "recent_checks": recent_ratings[:5],
    }


# ===== Merchant Pulse Drop =====

@router.post("/merchant/venue/{venue_id}/pulse-drop")
async def trigger_pulse_drop(venue_id: str, tier: str, request: Request):
    """Merchant triggers a Pulse Drop to attract more scouts."""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if user.get("merchant_venue_id") != venue_id:
        raise HTTPException(status_code=403, detail="You can only boost your own venue")

    economy = await get_economy_config()
    pulse_tiers = economy["pulse_drops"]
    if tier not in pulse_tiers:
        raise HTTPException(status_code=400, detail=f"Invalid tier. Choose from: {list(pulse_tiers.keys())}")

    tier_config = pulse_tiers[tier]
    price = tier_config["price"]

    venue = await db.venues.find_one({"id": venue_id})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    # Atomic debit: only succeeds if balance is sufficient (prevents overdraft)
    debit_result = await db.merchant_wallets.update_one(
        {"venue_id": venue_id, "balance": {"$gte": price}},
        {"$inc": {"balance": -price, "total_spent": price}},
    )
    if debit_result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Insufficient wallet balance")

    wallet = await db.merchant_wallets.find_one({"venue_id": venue_id})
    new_balance = wallet.get("balance", 0)

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(hours=tier_config["duration_hours"])

    drop_id = str(uuid.uuid4())
    await db.pulse_drops.insert_one({
        "id": drop_id,
        "venue_id": venue_id,
        "tier": tier,
        "price_paid": price,
        "profile_views_before": venue.get("profile_views", 0),
        "direction_clicks_before": venue.get("direction_clicks", 0),
        "created_at": now,
        "expires_at": expires_at,
    })

    # Record wallet transaction for audit trail
    tx = WalletTransaction(
        wallet_id=wallet["id"],
        type="pulse_drop_spend",
        amount=price,
        balance_before=new_balance + price,
        balance_after=new_balance,
        pulse_drop_id=drop_id,
        description=f"Pulse Drop: {tier_config['name']} tier",
    )
    await db.wallet_transactions.insert_one(tx.dict())

    await db.venues.update_one(
        {"id": venue_id},
        {"$set": {
            "active_pulse_tier": tier,
            "pulse_expires_at": expires_at,
            "glow_boost": tier_config["glow_boost"],
        }},
    )

    # Record platform revenue (fee % from live economy config)
    fee_pct = economy["wallet"]["platform_fee_percent"] / 100
    platform_fee = int(price * fee_pct)
    await db.platform_revenue.insert_one({
        "id": str(uuid.uuid4()),
        "type": "pulse_drop",
        "amount": platform_fee,
        "venue_id": venue_id,
        "city": venue.get("city"),
        "tier": tier,
        "timestamp": now,
    })

    return {
        "success": True,
        "message": f"Pulse Drop activated! Attracting more scouts for {tier_config['duration_hours']} hours.",
        "drop": {
            "id": drop_id,
            "tier": tier,
            "duration_hours": tier_config["duration_hours"],
            "expires_at": expires_at.isoformat(),
            "glow_boost": tier_config["glow_boost"],
            "clout_multiplier": "2x",
        },
        "wallet_balance": new_balance,
    }


@router.get("/merchant/venue/{venue_id}/pulse-status")
async def get_pulse_status(venue_id: str, request: Request):
    """Get current Pulse Drop status with countdown timer."""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if user.get("merchant_venue_id") != venue_id:
        raise HTTPException(status_code=403, detail="You can only view your own venue")

    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    now = datetime.now(timezone.utc)
    pulse_active = False
    time_remaining = None

    if venue.get("active_pulse_tier") and venue.get("pulse_expires_at"):
        pulse_expires_raw = venue.get("pulse_expires_at")
        if isinstance(pulse_expires_raw, datetime):
            pulse_expires = pulse_expires_raw.replace(tzinfo=timezone.utc) if pulse_expires_raw.tzinfo is None else pulse_expires_raw
        else:
            pulse_expires = datetime.fromisoformat(str(pulse_expires_raw).replace("Z", "+00:00"))

        if pulse_expires > now:
            pulse_active = True
            remaining = pulse_expires - now
            time_remaining = {
                "hours": remaining.seconds // 3600,
                "minutes": (remaining.seconds % 3600) // 60,
                "seconds": remaining.seconds % 60,
                "total_seconds": int(remaining.total_seconds()),
            }

    recent_drops = await db.pulse_drops.find({
        "venue_id": venue_id,
    }, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)

    return {
        "is_active": pulse_active,
        "current_tier": venue.get("active_pulse_tier") if pulse_active else None,
        "expires_at": venue.get("pulse_expires_at").isoformat() if pulse_active and venue.get("pulse_expires_at") else None,
        "time_remaining": time_remaining,
        "glow_boost": venue.get("glow_boost", 0) if pulse_active else 0,
        "recent_drops": recent_drops,
        "available_tiers": (await get_economy_config())["pulse_drops"],
    }
