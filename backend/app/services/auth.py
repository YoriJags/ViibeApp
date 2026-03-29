"""
Vibe App - Authentication Service
Handles session management, token generation, and OTP-based phone verification.

Security model:
- Session tokens: generated with secrets.token_urlsafe(32), stored as SHA-256 hash.
  The raw token is returned to the client exactly once; the DB never holds the
  cleartext value, so a DB dump cannot be used to hijack sessions.
- OTPs: 6-digit code generated with secrets, stored as SHA-256 hash with a TTL.
  Brute-force is prevented by limiting attempts (MAX_OTP_ATTEMPTS) and by the
  rate limiter on the OTP request endpoint.
- Per-user session cap (MAX_SESSIONS_PER_USER) prevents unbounded session growth.
"""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, Request

from app.config import (
    MAX_OTP_ATTEMPTS,
    MAX_SESSIONS_PER_USER,
    OTP_EXPIRY_MINUTES,
    OTP_LENGTH,
    SESSION_EXPIRY_DAYS,
    db,
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def _extract_session_token(request: Request) -> Optional[str]:
    """Extract raw session token from Authorization header or cookie."""
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header[7:]
    return request.cookies.get("session_token") or None


# ── Session management ────────────────────────────────────────────────────────

async def _enforce_session_limit(user_id: str) -> None:
    """Delete the oldest sessions when the per-user cap is exceeded."""
    count = await db.user_sessions.count_documents({"user_id": user_id})
    if count >= MAX_SESSIONS_PER_USER:
        # Fetch oldest session IDs to delete
        excess = count - MAX_SESSIONS_PER_USER + 1
        oldest = await db.user_sessions.find(
            {"user_id": user_id},
            {"_id": 1},
        ).sort("created_at", 1).limit(excess).to_list(length=excess)
        ids = [s["_id"] for s in oldest]
        if ids:
            await db.user_sessions.delete_many({"_id": {"$in": ids}})


async def create_session_token(user_id: str) -> str:
    """
    Create a new session token for a user.

    Returns the raw token to be given to the client.
    Only the SHA-256 hash is persisted so a DB breach cannot replay tokens.
    """
    await _enforce_session_limit(user_id)

    raw_token = secrets.token_urlsafe(32)
    token_hash = _sha256(raw_token)
    expires_at = datetime.now(timezone.utc) + timedelta(days=SESSION_EXPIRY_DAYS)

    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": token_hash,   # store hash only
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc),
    })

    return raw_token   # return raw token to caller (client-bound)


async def get_current_user(request: Request) -> Optional[dict]:
    """
    Resolve the current user from a session token.

    Hashes the incoming raw token before the DB lookup so the cleartext
    token is never compared directly to stored values.
    Returns None on any auth failure (missing token, expired, user gone).
    """
    raw_token = _extract_session_token(request)
    if not raw_token:
        return None

    token_hash = _sha256(raw_token)
    session = await db.user_sessions.find_one(
        {"session_token": token_hash}, {"_id": 0}
    )
    if not session:
        return None

    expires_at = session.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        # TTL index will clean this up; don't leak timing info
        return None

    return await db.users.find_one({"id": session["user_id"]}, {"_id": 0})


# ── FastAPI auth dependencies ─────────────────────────────────────────────────

async def require_auth(request: Request) -> dict:
    """FastAPI dependency: requires a valid authenticated user."""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


async def require_admin(request: Request) -> dict:
    """FastAPI dependency: requires super admin access."""
    user = await require_auth(request)
    if not user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Super admin access required")
    return user


async def require_merchant(request: Request) -> dict:
    """FastAPI dependency: requires merchant access."""
    user = await require_auth(request)
    if not user.get("is_merchant"):
        raise HTTPException(status_code=403, detail="Merchant access required")
    return user


def require_venue_owner(venue_id_param: str = "venue_id"):
    """Factory: FastAPI dependency that requires ownership of a specific venue."""
    async def _check(request: Request) -> dict:
        user = await require_auth(request)
        venue_id = request.path_params.get(venue_id_param)
        if user.get("merchant_venue_id") != venue_id:
            raise HTTPException(status_code=403, detail="You can only access your own venue")
        return user
    return _check


# ── OTP management ────────────────────────────────────────────────────────────

async def generate_and_store_otp(phone: str) -> str:
    """
    Generate a cryptographically random 6-digit OTP, persist its SHA-256 hash,
    and return the plaintext OTP for delivery via SMS.

    Any previous OTP for this phone is replaced (upsert) so there is at most
    one pending OTP per phone number at any time.
    """
    otp = str(secrets.randbelow(10 ** OTP_LENGTH)).zfill(OTP_LENGTH)
    otp_hash = _sha256(otp)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRY_MINUTES)

    await db.phone_otps.update_one(
        {"phone": phone},
        {
            "$set": {
                "otp_hash": otp_hash,
                "expires_at": expires_at,
                "attempts": 0,
                "created_at": datetime.now(timezone.utc),
            }
        },
        upsert=True,
    )

    return otp  # caller must send this to the user via SMS, never log it


async def verify_otp(phone: str, otp_input: str) -> bool:
    """
    Verify the OTP for a phone number.

    - Increments the attempt counter atomically before checking, so a failed
      check still burns an attempt even under concurrent requests.
    - Deletes the OTP document on success (single-use).
    - Returns False (not an exception) so the caller controls the HTTP response
      and avoids leaking whether the phone is registered.
    """
    record = await db.phone_otps.find_one_and_update(
        {"phone": phone},
        {"$inc": {"attempts": 1}},
        return_document=True,  # pymongo ReturnDocument.AFTER equivalent for motor
    )

    if not record:
        return False

    # Expired?
    expires_at = record.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        await db.phone_otps.delete_one({"phone": phone})
        return False

    # Too many attempts? (attempts was already incremented above)
    if record.get("attempts", 1) > MAX_OTP_ATTEMPTS:
        await db.phone_otps.delete_one({"phone": phone})
        return False

    # Constant-time comparison to prevent timing oracle
    expected_hash = record.get("otp_hash", "")
    input_hash = _sha256(otp_input)
    if not secrets.compare_digest(expected_hash, input_hash):
        return False

    # OTP is valid — delete it (single-use)
    await db.phone_otps.delete_one({"phone": phone})
    return True
