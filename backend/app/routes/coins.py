"""
Vibe App - Vibe Coins Economy
Scouts earn Vibe Coins for ratings, check-ins, streaks, and squad bonuses.
Coins can be cashed out directly to a Nigerian bank account via Paystack Transfer.
Clout (reputation) is unchanged — coins are the parallel economic layer.
"""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from app.config import db
from app.services.auth import require_auth
from app.services.payments import (
    resolve_bank_account,
    create_transfer_recipient,
    initiate_transfer,
    get_banks,
)

router = APIRouter(tags=["coins"])

# ── Economy constants ─────────────────────────────────────────────────────────
COIN_EARN = {
    "rating":      10,
    "checkin":     15,
    "squad_bonus": 20,
    "streak_day":   5,
}
VIBE_PLUS_MULTIPLIER = 2

# Cashout: kobo per 100 coins
CASHOUT_RATE_FREE      = 4000   # ₦40 per 100 coins
CASHOUT_RATE_VIBE_PLUS = 5000   # ₦50 per 100 coins
CASHOUT_MIN_COINS      = 500    # minimum coins to cash out
CASHOUT_PLATFORM_CUT   = 0.20  # 20% kept by platform

# Anti-fraud gates
MIN_ACCOUNT_AGE_DAYS   = 30
MIN_VERIFIED_RATINGS   = 20
# ─────────────────────────────────────────────────────────────────────────────


# ── Shared helper (imported by ratings, checkins, etc.) ──────────────────────
async def award_coins(
    user_id: str,
    amount: int,
    type_: str,
    venue_id: str | None = None,
    reference: str | None = None,
) -> None:
    """Atomically add coins to a scout's balance and log the transaction."""
    now = datetime.now(timezone.utc)
    await db.vibe_coins.update_one(
        {"user_id": user_id},
        {
            "$inc": {"balance": amount, "total_earned": amount},
            "$set": {"updated_at": now},
            "$setOnInsert": {"total_cashed_out": 0, "created_at": now},
        },
        upsert=True,
    )
    await db.coin_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "amount": amount,
        "type": type_,
        "venue_id": venue_id,
        "reference": reference,
        "timestamp": now,
    })
# ─────────────────────────────────────────────────────────────────────────────


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/coins/balance")
async def get_coin_balance(user: dict = Depends(require_auth)):
    """Return scout's Vibe Coins balance, stats, and recent transactions."""
    user_id = user["id"]
    wallet = await db.vibe_coins.find_one({"user_id": user_id}, {"_id": 0})

    is_vibe_plus = (
        user.get("is_vibe_plus")
        and user.get("vibe_plus_expires_at", "") > datetime.now(timezone.utc).isoformat()
    )
    cashout_rate = CASHOUT_RATE_VIBE_PLUS if is_vibe_plus else CASHOUT_RATE_FREE

    txns = await db.coin_transactions.find(
        {"user_id": user_id},
        {"_id": 0},
        sort=[("timestamp", -1)],
        limit=20,
    ).to_list(20)
    for t in txns:
        if isinstance(t.get("timestamp"), datetime):
            t["timestamp"] = t["timestamp"].isoformat()

    return {
        "balance": wallet["balance"] if wallet else 0,
        "total_earned": wallet["total_earned"] if wallet else 0,
        "total_cashed_out": wallet["total_cashed_out"] if wallet else 0,
        "cashout_rate_kobo": cashout_rate,     # per 100 coins
        "cashout_rate_naira": cashout_rate / 100,
        "cashout_min_coins": CASHOUT_MIN_COINS,
        "is_vibe_plus": is_vibe_plus,
        "transactions": txns,
    }


@router.get("/coins/banks")
async def list_banks():
    """Return Nigerian bank list for the bank picker UI (cached by client)."""
    banks = await get_banks()
    return {"banks": banks}


class BankAccountBody(BaseModel):
    account_number: str
    bank_code: str


@router.post("/coins/bank-account")
async def save_bank_account(body: BankAccountBody, user: dict = Depends(require_auth)):
    """
    Verify and save a scout's bank account for cashout.
    Creates a Paystack Transfer Recipient and stores the recipient_code.
    """
    user_id = user["id"]

    # Resolve account with Paystack to get account_name
    try:
        resolved = await resolve_bank_account(body.account_number, body.bank_code)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    account_name = resolved["account_name"]

    # Create Paystack Transfer Recipient
    try:
        recipient_code = await create_transfer_recipient(
            account_name, body.account_number, body.bank_code
        )
    except ValueError as e:
        raise HTTPException(status_code=502, detail=str(e))

    # Save to user record
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "bank_account": {
                "account_number": body.account_number,
                "account_number_masked": f"****{body.account_number[-4:]}",
                "bank_code": body.bank_code,
                "account_name": account_name,
            },
            "paystack_recipient_code": recipient_code,
        }},
    )

    return {
        "ok": True,
        "account_name": account_name,
        "account_number_masked": f"****{body.account_number[-4:]}",
    }


@router.get("/coins/bank-account")
async def get_bank_account(user: dict = Depends(require_auth)):
    """Return the scout's saved bank account (masked)."""
    acct = user.get("bank_account")
    if not acct:
        return {"saved": False}
    return {
        "saved": True,
        "account_name": acct["account_name"],
        "account_number_masked": acct["account_number_masked"],
        "bank_code": acct["bank_code"],
    }


class CashoutBody(BaseModel):
    coins: int


@router.post("/coins/cashout")
async def request_cashout(body: CashoutBody, user: dict = Depends(require_auth)):
    """
    Cash out Vibe Coins to the scout's bank account via Paystack Transfer.
    Anti-fraud: account age >= 30 days, verified ratings >= 20, bank account saved.
    """
    user_id = user["id"]
    now = datetime.now(timezone.utc)

    # ── Fraud gates ───────────────────────────────────────────────────────────
    created_at_raw = user.get("created_at")
    if created_at_raw:
        created_at = datetime.fromisoformat(created_at_raw) if isinstance(created_at_raw, str) else created_at_raw
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        age_days = (now - created_at).days
        if age_days < MIN_ACCOUNT_AGE_DAYS:
            raise HTTPException(
                status_code=403,
                detail=f"Account must be at least {MIN_ACCOUNT_AGE_DAYS} days old to cash out"
            )

    verified_ratings = await db.ratings.count_documents({"user_id": user_id})
    if verified_ratings < MIN_VERIFIED_RATINGS:
        raise HTTPException(
            status_code=403,
            detail=f"You need at least {MIN_VERIFIED_RATINGS} ratings before cashing out"
        )

    if not user.get("paystack_recipient_code"):
        raise HTTPException(status_code=400, detail="Add a bank account before cashing out")

    # ── Coin validation ───────────────────────────────────────────────────────
    if body.coins < CASHOUT_MIN_COINS:
        raise HTTPException(
            status_code=400,
            detail=f"Minimum cashout is {CASHOUT_MIN_COINS} coins"
        )

    wallet = await db.vibe_coins.find_one({"user_id": user_id})
    current_balance = wallet["balance"] if wallet else 0
    if body.coins > current_balance:
        raise HTTPException(status_code=400, detail="Insufficient coin balance")

    # ── Compute naira ─────────────────────────────────────────────────────────
    is_vibe_plus = (
        user.get("is_vibe_plus")
        and user.get("vibe_plus_expires_at", "") > now.isoformat()
    )
    rate_kobo = CASHOUT_RATE_VIBE_PLUS if is_vibe_plus else CASHOUT_RATE_FREE
    gross_naira_kobo = int((body.coins / 100) * rate_kobo)
    platform_cut_kobo = int(gross_naira_kobo * CASHOUT_PLATFORM_CUT)
    payout_kobo = gross_naira_kobo - platform_cut_kobo
    payout_naira = payout_kobo / 100

    # ── Initiate Paystack Transfer ────────────────────────────────────────────
    cashout_id = str(uuid.uuid4())
    try:
        transfer = await initiate_transfer(
            user["paystack_recipient_code"],
            payout_kobo,
            f"Vibe Coins Cashout — {body.coins} coins",
        )
    except ValueError as e:
        raise HTTPException(status_code=502, detail=f"Transfer failed: {e}")

    # ── Deduct coins atomically ───────────────────────────────────────────────
    await db.vibe_coins.update_one(
        {"user_id": user_id},
        {
            "$inc": {"balance": -body.coins, "total_cashed_out": body.coins},
            "$set": {"updated_at": now},
        },
    )
    await db.coin_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "amount": -body.coins,
        "type": "cashout",
        "reference": transfer["transfer_code"],
        "timestamp": now,
    })

    # ── Log cashout request + platform revenue ────────────────────────────────
    await db.cashout_requests.insert_one({
        "id": cashout_id,
        "user_id": user_id,
        "amount_coins": body.coins,
        "amount_naira": payout_naira,
        "platform_cut_naira": platform_cut_kobo / 100,
        "status": transfer["status"],
        "paystack_transfer_code": transfer["transfer_code"],
        "timestamp": now,
    })
    await db.platform_revenue.insert_one({
        "id": str(uuid.uuid4()),
        "type": "coin_cashout_cut",
        "user_id": user_id,
        "amount": platform_cut_kobo / 100,
        "timestamp": now,
    })

    return {
        "ok": True,
        "coins_deducted": body.coins,
        "naira_sent": payout_naira,
        "transfer_code": transfer["transfer_code"],
        "status": transfer["status"],
        "new_balance": current_balance - body.coins,
    }
