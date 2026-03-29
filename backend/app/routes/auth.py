"""
Vibe App - Authentication Routes
Phone-based auth (signup/login via users routes), session management.
All auth endpoints return a session_token for the client to store and send as Bearer token.
"""
from fastapi import APIRouter, HTTPException, Request, Response

from app.config import db
from app.services.auth import get_current_user, _hash_token

router = APIRouter(tags=["auth"])


@router.get("/auth/me")
async def get_me(request: Request):
    """Get the currently authenticated user."""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


@router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout by clearing the session."""
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header[7:]

    if session_token:
        await db.user_sessions.delete_one({"session_token": _hash_token(session_token)})
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out"}
