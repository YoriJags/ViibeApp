"""
Vibe App - Venue Reward Pools
Merchants fund a coin pool for their venue. Scouts earn bonus coins when they
rate that venue while the pool is active. Pool deducted from merchant wallet.
"""
import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional

from app.config import db
from app.services.auth import require_auth

router = APIRouter(tags=["reward_pools"])

# ── Pool economy constants ────────────────────────────────────────────────────
POOL_NAIRA_TO_COINS    = 0.2    # ₦1 = 0.2 coins funded (₦5 per coin; platform keeps spread)
POOL_BULK_BONUS        = 0.10   # 10% bonus for ₦25,000+ fund
POOL_DEFAULT_COIN_RATE = 15     # coins per rating from pool (merchant can override)
POOL_DURATION_DAYS     = 7
POOL_MIN_FUND_NAIRA    = 5_000  # ₦5,000 minimum
# ─────────────────────────────────────────────────────────────────────────────


class FundPoolBody(BaseModel):
    amount_naira: int               # amount to deduct from merchant wallet
    coin_rate: Optional[int] = None # coins per rating; defaults to POOL_DEFAULT_COIN_RATE


@router.post("/venues/{venue_id}/reward-pool/fund")
async def fund_reward_pool(
    venue_id: str,
    body: FundPoolBody,
    user: dict = Depends(require_auth),
):
    """
    Merchant funds a scout reward pool for their venue.
    Deducts from the venue's merchant wallet. Pool expires in 7 days.
    Conversion: ₦5,000 → 1,000 coins; ₦25,000+ gets 10% bonus coins.
    """
    if body.amount_naira < POOL_MIN_FUND_NAIRA:
        raise HTTPException(
            status_code=400,
            detail=f"Minimum pool funding is ₦{POOL_MIN_FUND_NAIRA:,}"
        )

    # Verify venue belongs to this merchant
    venue = await db.venues.find_one({"id": venue_id})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")
    if venue.get("merchant_id") and venue["merchant_id"] != user["id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not your venue")

    # Check merchant wallet balance
    wallet = await db.merchant_wallets.find_one({"venue_id": venue_id})
    if not wallet or wallet.get("balance", 0) < body.amount_naira:
        raise HTTPException(status_code=400, detail="Insufficient wallet balance")

    # Compute coins to fund
    coins_funded = int(body.amount_naira * POOL_NAIRA_TO_COINS)
    if body.amount_naira >= 25_000:
        coins_funded = int(coins_funded * (1 + POOL_BULK_BONUS))

    coin_rate = body.coin_rate or POOL_DEFAULT_COIN_RATE
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=POOL_DURATION_DAYS)

    # Deduct from merchant wallet atomically
    result = await db.merchant_wallets.update_one(
        {"venue_id": venue_id, "balance": {"$gte": body.amount_naira}},
        {
            "$inc": {"balance": -body.amount_naira, "total_spent": body.amount_naira},
            "$set": {"updated_at": now},
        },
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Wallet deduction failed — try again")

    # Log wallet transaction
    await db.wallet_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "wallet_id": wallet["id"] if wallet.get("id") else venue_id,
        "type": "reward_pool_fund",
        "amount": -body.amount_naira,
        "balance_before": wallet["balance"],
        "balance_after": wallet["balance"] - body.amount_naira,
        "note": f"Scout reward pool — {coins_funded} coins funded",
        "timestamp": now,
    })

    # Upsert reward pool (top up if one already exists and is active)
    existing_pool = await db.venue_reward_pools.find_one(
        {"venue_id": venue_id, "active": True}
    )
    if existing_pool:
        await db.venue_reward_pools.update_one(
            {"id": existing_pool["id"]},
            {
                "$inc": {
                    "total_coins_funded": coins_funded,
                    "coins_remaining": coins_funded,
                },
                "$set": {
                    "expires_at": expires_at.isoformat(),
                    "coin_rate": coin_rate,
                    "updated_at": now,
                },
            },
        )
        pool_id = existing_pool["id"]
        total_coins = existing_pool["total_coins_funded"] + coins_funded
        coins_remaining = existing_pool["coins_remaining"] + coins_funded
    else:
        pool_id = str(uuid.uuid4())
        total_coins = coins_funded
        coins_remaining = coins_funded
        await db.venue_reward_pools.insert_one({
            "id": pool_id,
            "venue_id": venue_id,
            "funded_by": user["id"],
            "total_coins_funded": coins_funded,
            "coins_remaining": coins_funded,
            "coin_rate": coin_rate,
            "active": True,
            "funded_at": now.isoformat(),
            "expires_at": expires_at.isoformat(),
        })

    # Log platform revenue (the naira→coin spread is the platform's take)
    platform_take = body.amount_naira * (1 - POOL_NAIRA_TO_COINS * 5)  # ≈ platform keeps ₦3/coin
    await db.platform_revenue.insert_one({
        "id": str(uuid.uuid4()),
        "type": "reward_pool_spread",
        "venue_id": venue_id,
        "amount": max(0, platform_take),
        "timestamp": now,
    })

    return {
        "ok": True,
        "pool_id": pool_id,
        "coins_funded": coins_funded,
        "coins_remaining": coins_remaining,
        "coin_rate": coin_rate,
        "expires_at": expires_at.isoformat(),
        "wallet_deducted": body.amount_naira,
    }


@router.get("/venues/{venue_id}/reward-pool")
async def get_reward_pool(venue_id: str):
    """Public: return active reward pool status for a venue."""
    now = datetime.now(timezone.utc)
    pool = await db.venue_reward_pools.find_one(
        {
            "venue_id": venue_id,
            "active": True,
            "coins_remaining": {"$gt": 0},
            "expires_at": {"$gt": now.isoformat()},
        },
        {"_id": 0},
    )
    if not pool:
        return {"active": False}

    return {
        "active": True,
        "coin_rate": pool["coin_rate"],
        "coins_remaining": pool["coins_remaining"],
        "expires_at": pool["expires_at"],
    }
