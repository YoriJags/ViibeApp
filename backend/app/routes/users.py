"""
Vibe App - User Routes
User registration, login, and profile retrieval.
Returns session tokens on signup/login for proper auth.
"""
from fastapi import APIRouter, HTTPException

from app.config import db
from app.models import User, UserCreate, UserLogin
from app.services.auth import create_session_token

router = APIRouter(tags=["users"])


@router.post("/users/login")
async def login_user(login_data: UserLogin):
    """Login by phone number - returns existing user with session token."""
    user = await db.users.find_one({"phone": login_data.phone}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found. Please sign up first.")

    session_token = await create_session_token(user["id"])
    return {**user, "session_token": session_token}


@router.post("/users")
async def create_user(user_data: UserCreate):
    """Create a new user or return existing user if phone matches. Returns session token."""
    existing_username = await db.users.find_one({"username": user_data.username})
    if existing_username:
        raise HTTPException(status_code=400, detail="Username already exists")

    # Check if phone already exists - return that user instead (login flow)
    existing_phone = await db.users.find_one({"phone": user_data.phone}, {"_id": 0})
    if existing_phone:
        session_token = await create_session_token(existing_phone["id"])
        return {**existing_phone, "session_token": session_token}

    user = User(**user_data.dict())
    await db.users.insert_one(user.dict())

    session_token = await create_session_token(user.id)
    return {**user.dict(), "session_token": session_token}


@router.get("/users/{user_id}")
async def get_user(user_id: str):
    """Get a user by ID. Sensitive fields (phone, email) are excluded."""
    user = await db.users.find_one(
        {"id": user_id},
        {"_id": 0, "phone": 0, "email": 0, "session_token": 0},
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
