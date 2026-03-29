"""
Vibe App - Authentication Service
Handles user session management, token generation, and auth dependencies.

Session tokens are stored as SHA-256 hashes in the database.
Only the plaintext token is returned to the client and never persisted.
"""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from fastapi import Request, HTTPException, Depends
from typing import Optional
from app.config import db, SESSION_EXPIRY_DAYS


def _hash_token(token: str) -> str:
    """SHA-256 hash a session token for safe database storage."""
    return hashlib.sha256(token.encode()).hexdigest()


async def create_session_token(user_id: str) -> str:
    """
    Create a new session token for a user and store its hash in the database.
    Returns the plaintext token (never stored, only sent to client once).
    """
    session_token = secrets.token_urlsafe(32)
    token_hash = _hash_token(session_token)
    expires_at = datetime.now(timezone.utc) + timedelta(days=SESSION_EXPIRY_DAYS)

    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": token_hash,   # Only the hash is persisted
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc),
    })

    return session_token  # Plaintext returned to client once


async def get_current_user(request: Request) -> Optional[dict]:
    """
    Get current user from session token.
    Checks: Authorization Bearer header -> session_token cookie.
    Returns None if no valid session found.
    """
    session_token = _extract_session_token(request)
    if not session_token:
        return None

    token_hash = _hash_token(session_token)
    session = await db.user_sessions.find_one({"session_token": token_hash}, {"_id": 0})
    if not session:
        return None

    expires_at = session.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at < datetime.now(timezone.utc):
        return None

    user = await db.users.find_one({"id": session["user_id"]}, {"_id": 0})
    return user


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
    """Factory for FastAPI dependency: requires user to own the specific venue."""
    async def _check(request: Request) -> dict:
        user = await require_auth(request)
        venue_id = request.path_params.get(venue_id_param)
        if user.get("merchant_venue_id") != venue_id:
            raise HTTPException(status_code=403, detail="You can only access your own venue")
        return user
    return _check


def _extract_session_token(request: Request) -> Optional[str]:
    """Extract session token from Authorization header or cookie."""
    # Try Authorization: Bearer <token> header first
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header[7:]

    # Fall back to session cookie
    session_token = request.cookies.get("session_token")
    if session_token:
        return session_token

    return None
