"""
Vibe App - Vibe+ Subscription Routes
Handles Paystack payment for ₦2,000/month Vibe+ subscription.
Follows the atomic claim pattern from merchant.py to prevent double-credits.
"""
import os
import httpx
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional

from app.config import db, logger
from app.services.auth import require_auth
from app.routes.platform_settings import get_platform_setting

router = APIRouter(tags=["subscriptions"])

PAYSTACK_BASE = "https://api.paystack.co"
DEFAULT_PRICE_KOBO = 200000  # ₦2,000 fallback


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _check_vibe_plus(user: dict) -> bool:
    """
    Check if a user has an active Vibe+ subscription.
    Handles expiry: silently marks is_vibe_plus=False in DB if expired.
    Import this in oracle.py for the premium gate.
    """
    if not user.get("is_vibe_plus"):
        return False

    expires_at = user.get("vibe_plus_expires_at")
    if not expires_at:
        return True  # no expiry set → treat as active (manual grant)

    # Normalize: Motor may return datetime or string
    if isinstance(expires_at, str):
        try:
            expires_at = datetime.fromisoformat(expires_at)
        except ValueError:
            return False

    # Ensure timezone-aware
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    now = datetime.now(timezone.utc)
    if expires_at < now:
        # Silently expire — update DB async fire-and-forget style
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"is_vibe_plus": False}}
        )
        logger.info(f"Vibe+ expired for user {user['id']}")
        return False

    return True


async def _apply_subscription(user_id: str, reference: str) -> dict:
    """
    Internal: activate Vibe+ for 30 days on a user.
    Used by both verify endpoint and webhook handler.
    Returns the updated user fields.
    """
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=30)

    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "is_vibe_plus": True,
            "vibe_plus_expires_at": expires_at,
            "vibe_plus_reference": reference,
        }}
    )

    # Log to platform_revenue for treasury tracking
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    price_kobo = await get_platform_setting("vibe_plus_price_kobo")

    await db.platform_revenue.insert_one({
        "type": "vibe_plus",
        "user_id": user_id,
        "username": user.get("username", "") if user else "",
        "amount": price_kobo / 100,  # store in Naira for consistency
        "reference": reference,
        "city": (user or {}).get("home_city", "unknown"),
        "timestamp": now,
    })

    logger.info(f"Vibe+ activated for user {user_id}, expires {expires_at.isoformat()}")
    return {"is_vibe_plus": True, "expires_at": expires_at.isoformat()}


async def verify_subscription_by_reference(reference: str) -> None:
    """
    Webhook-callable version — no user auth context needed.
    Looks up user_id from pending_subscriptions doc, then applies subscription.
    """
    pending = await db.pending_subscriptions.find_one({"reference": reference})
    if not pending:
        logger.warning(f"Webhook: pending subscription not found for ref {reference}")
        return

    if pending.get("status") == "completed":
        return  # already processed

    # Atomic claim
    result = await db.pending_subscriptions.update_one(
        {"reference": reference, "status": "pending"},
        {"$set": {"status": "verifying"}}
    )
    if result.modified_count == 0:
        return  # another process claimed it

    try:
        api_key = os.environ.get("PAYSTACK_SECRET_KEY", "")
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{PAYSTACK_BASE}/transaction/verify/{reference}",
                headers={"Authorization": f"Bearer {api_key}"},
                timeout=10,
            )

        if resp.status_code != 200:
            raise ValueError(f"Paystack verify returned {resp.status_code}")

        data = resp.json().get("data", {})
        if data.get("status") != "success":
            raise ValueError("Payment not successful")

        await _apply_subscription(pending["user_id"], reference)
        await db.pending_subscriptions.update_one(
            {"reference": reference},
            {"$set": {"status": "completed"}}
        )

    except Exception as e:
        logger.error(f"Webhook subscription verify failed for {reference}: {e}")
        await db.pending_subscriptions.update_one(
            {"reference": reference},
            {"$set": {"status": "failed", "error": str(e)}}
        )


# ── Endpoints ────────────────────────────────────────────────────────────────

class InitializeBody(BaseModel):
    email: Optional[str] = None


@router.post("/subscription/initialize")
async def initialize_subscription(body: InitializeBody, request: Request):
    """
    Initialize a Paystack payment for Vibe+ subscription (₦2,000/month).
    Returns authorization_url + reference for the frontend to open.
    Requires: Bearer token auth.
    """
    user = await require_auth(request)

    try:
        price_kobo = int(await get_platform_setting("vibe_plus_price_kobo"))
    except Exception:
        price_kobo = DEFAULT_PRICE_KOBO

    email = body.email or f"{user.get('username', user['id'][:8])}@vibeapp.ng"

    import time
    reference = f"VIIBE-PLUS-{user['id'][:8]}-{int(time.time())}"

    # Store pending record
    try:
        await db.pending_subscriptions.insert_one({
            "reference": reference,
            "user_id": user["id"],
            "amount_kobo": price_kobo,
            "email": email,
            "status": "pending",
            "created_at": datetime.now(timezone.utc),
            "authorization_url": None,
        })
    except Exception as e:
        logger.error(f"Failed to store pending subscription: {e}")
        raise HTTPException(status_code=500, detail="Could not create payment record. Please try again.")

    api_key = os.environ.get("PAYSTACK_SECRET_KEY", "")

    if not api_key:
        # Dev / no key configured — activate immediately (mock mode)
        mock_url = f"https://checkout.paystack.com/access/{reference}"
        await db.pending_subscriptions.update_one(
            {"reference": reference},
            {"$set": {"authorization_url": mock_url}}
        )
        return {"authorization_url": mock_url, "reference": reference, "mock": True}

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{PAYSTACK_BASE}/transaction/initialize",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "amount": price_kobo,
                    "email": email,
                    "reference": reference,
                    "currency": "NGN",
                    "metadata": {
                        "type": "vibe_plus",
                        "user_id": user["id"],
                        "username": user.get("username", ""),
                    },
                    "callback_url": "https://vibe-app-hc83.vercel.app/subscription/callback",
                },
                timeout=15,
            )

        if resp.status_code == 401:
            logger.error("Paystack API key is invalid (401)")
            raise HTTPException(status_code=502, detail="Payment provider configuration error. Please contact support.")

        if resp.status_code != 200:
            paystack_message = resp.json().get("message", "") if resp.headers.get("content-type", "").startswith("application/json") else ""
            logger.error(f"Paystack init returned {resp.status_code}: {paystack_message}")
            raise HTTPException(status_code=502, detail=f"Payment provider error. Please try again shortly.")

        data = resp.json().get("data", {})
        authorization_url = data.get("authorization_url", "")

        if not authorization_url:
            raise HTTPException(status_code=502, detail="Payment provider did not return a checkout URL.")

        await db.pending_subscriptions.update_one(
            {"reference": reference},
            {"$set": {"authorization_url": authorization_url}}
        )

        return {"authorization_url": authorization_url, "reference": reference}

    except HTTPException:
        raise
    except httpx.TimeoutException:
        logger.error("Paystack API timeout during subscription initialize")
        raise HTTPException(status_code=504, detail="Payment provider timed out. Please try again.")
    except Exception as e:
        logger.error(f"Subscription initialize error: {e}")
        raise HTTPException(status_code=500, detail="Could not start payment. Please try again.")


@router.post("/subscription/verify/{reference}")
async def verify_subscription(reference: str, request: Request):
    """
    Verify Paystack payment and activate Vibe+ for 30 days.
    Idempotent — safe to call multiple times.
    Requires: Bearer token auth.
    """
    user = await require_auth(request)

    pending = await db.pending_subscriptions.find_one({"reference": reference})
    if not pending:
        raise HTTPException(status_code=404, detail="Payment reference not found")

    # Already processed
    if pending.get("status") == "completed":
        return {"success": True, "is_vibe_plus": True, "already_processed": True}

    # Security: ensure this user owns the payment
    if pending["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Payment reference does not belong to this user")

    # Atomic claim to prevent race conditions
    result = await db.pending_subscriptions.update_one(
        {"reference": reference, "status": "pending"},
        {"$set": {"status": "verifying"}}
    )
    if result.modified_count == 0:
        # Either already verifying or completed by another request
        return {"success": True, "message": "Payment already being processed"}

    api_key = os.environ.get("PAYSTACK_SECRET_KEY", "")
    price_kobo = int(await get_platform_setting("vibe_plus_price_kobo"))

    # Mock mode — no API key configured
    if not api_key:
        fields = await _apply_subscription(user["id"], reference)
        await db.pending_subscriptions.update_one(
            {"reference": reference},
            {"$set": {"status": "completed"}}
        )
        return {"success": True, "is_vibe_plus": True, **fields, "mock": True}

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{PAYSTACK_BASE}/transaction/verify/{reference}",
                headers={"Authorization": f"Bearer {api_key}"},
                timeout=10,
            )

        if resp.status_code != 200:
            raise ValueError(f"Paystack returned {resp.status_code}")

        data = resp.json().get("data", {})
        if data.get("status") != "success":
            raise ValueError("Payment not successful on Paystack")
        if data.get("amount", 0) < price_kobo:
            raise ValueError(f"Payment amount {data.get('amount')} < expected {price_kobo}")

        # Activate subscription
        fields = await _apply_subscription(user["id"], reference)
        await db.pending_subscriptions.update_one(
            {"reference": reference},
            {"$set": {"status": "completed"}}
        )
        return {"success": True, "is_vibe_plus": True, **fields}

    except (httpx.RequestError, httpx.TimeoutException) as e:
        logger.error(f"Payment provider unreachable during verify for {reference}: {e}")
        await db.pending_subscriptions.update_one(
            {"reference": reference},
            {"$set": {"status": "pending"}}
        )
        raise HTTPException(status_code=503, detail="Payment provider temporarily unavailable. Please try again.")
    except Exception as e:
        logger.error(f"Subscription verify failed for {reference}: {e}")
        # Reset to pending so user can retry
        await db.pending_subscriptions.update_one(
            {"reference": reference},
            {"$set": {"status": "pending"}}
        )
        raise HTTPException(status_code=400, detail="Payment verification failed. Please try again.")


@router.get("/subscription/status")
async def get_subscription_status(request: Request):
    """
    Returns current Vibe+ subscription status for the authenticated user.
    Re-reads from DB (not cached) to ensure expiry is enforced.
    """
    user = await require_auth(request)

    # Re-read fresh from DB
    fresh_user = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    if not fresh_user:
        raise HTTPException(status_code=404, detail="User not found")

    is_plus = await _check_vibe_plus(fresh_user)
    expires_at = fresh_user.get("vibe_plus_expires_at")

    days_remaining = None
    if is_plus and expires_at:
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at)
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        delta = expires_at - datetime.now(timezone.utc)
        days_remaining = max(0, delta.days)
        expires_at = expires_at.isoformat()
    elif not is_plus:
        expires_at = None

    return {
        "is_vibe_plus": is_plus,
        "expires_at": expires_at,
        "days_remaining": days_remaining,
    }
