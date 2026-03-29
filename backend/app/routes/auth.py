"""
Vibe App - Authentication Routes
Phone-based auth (signup/login via users routes), session management, OTP delivery.

Auth flow:
  1. POST /auth/otp/request   { phone }          → sends OTP via SMS
  2. POST /users/login        { phone, otp }     → verifies OTP, returns session_token
     POST /users             { username, phone, otp } → same for new accounts
"""
import os
from fastapi import APIRouter, HTTPException, Request, Response

from app.config import db
from app.models import OTPRequest
from app.services.auth import (
    _extract_session_token,
    generate_and_store_otp,
    get_current_user,
)
from app.services.sms import send_otp

router = APIRouter(tags=["auth"])

_SECURE_COOKIE = os.environ.get("ENVIRONMENT", "production").lower() != "development"


@router.post("/auth/otp/request")
async def request_otp(payload: OTPRequest):
    """
    Send a one-time password to the given phone number.

    Rate-limited to 3 requests / 60 s per IP (enforced in RateLimitMiddleware).
    Always returns 200 — never reveal whether the phone is registered.
    """
    otp = await generate_and_store_otp(payload.phone)
    await send_otp(payload.phone, otp)
    # Intentionally vague response — do not leak whether phone is registered
    return {"message": "If that number is valid, an OTP has been sent."}


@router.get("/auth/me")
async def get_me(request: Request):
    """Get the currently authenticated user."""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


@router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """
    Invalidate the current session.

    Hashes the incoming raw token before the DB lookup, matching the storage
    convention in auth.py (only hashes are persisted).
    """
    from app.services.auth import _sha256  # local import to avoid circular at module level

    raw_token = _extract_session_token(request)
    if raw_token:
        token_hash = _sha256(raw_token)
        await db.user_sessions.delete_one({"session_token": token_hash})

    response.delete_cookie(
        key="session_token",
        path="/",
        httponly=True,
        secure=_SECURE_COOKIE,
        samesite="lax",
    )
    return {"message": "Logged out"}
