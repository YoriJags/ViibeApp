"""
Vibe App - Authentication Routes
Google OAuth session exchange, session management, login/signup.
All auth endpoints return a session_token for the client to store and send as Bearer token.
"""
import uuid
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Request, Response
import httpx

from app.config import db, SESSION_EXPIRY_DAYS
from app.models import User, UserCreate, UserLogin
from app.services.auth import get_current_user, create_session_token

router = APIRouter(tags=["auth"])


@router.post("/auth/session")
async def create_session(request: Request, response: Response):
    """Exchange session_id for session_token after Google OAuth."""
    body = await request.json()
    session_id = body.get("session_id")

    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")

    async with httpx.AsyncClient() as client:
        auth_response = await client.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id},
        )

    if auth_response.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session_id")

    auth_data = auth_response.json()
    email = auth_data.get("email")
    name = auth_data.get("name")
    picture = auth_data.get("picture")

    existing_user = await db.users.find_one({"email": email}, {"_id": 0})

    if existing_user:
        user_id = existing_user["id"]
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"name": name, "picture": picture}},
        )
    else:
        user_id = str(uuid.uuid4())
        new_user = User(
            id=user_id,
            username=email.split("@")[0],
            phone="",
            email=email,
            name=name,
            picture=picture,
            auth_provider="google",
        )
        await db.users.insert_one(new_user.dict())

    # Create our own session token (not the OAuth provider's)
    session_token = await create_session_token(user_id)

    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=SESSION_EXPIRY_DAYS * 24 * 60 * 60,
    )

    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    return {
        **user,
        "session_token": session_token,
    }


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
        await db.user_sessions.delete_one({"session_token": session_token})
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out"}
