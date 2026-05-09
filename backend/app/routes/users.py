"""
Vibe App - User Routes
User registration, login, and profile retrieval.
Returns session tokens on signup/login for proper auth.
"""
from fastapi import APIRouter, Depends, HTTPException

from app.config import db
from app.models import User, UserCreate, UserLogin, MusicPreferencesUpdate, ReactorSkinUpdate, ZodiacUpdate
from app.services.auth import create_session_token, require_auth
from app.services.scout_identity import get_scout_identity
from pydantic import BaseModel as PydanticBase


class CallNameUpdate(PydanticBase):
    call_name: str | None = None


class PushTokenUpdate(PydanticBase):
    push_token: str

router = APIRouter(tags=["users"])


@router.post("/users/login")
async def login_user(login_data: UserLogin):
    """Login by phone number - returns existing user with session token and scout identity context."""
    user = await db.users.find_one({"phone": login_data.phone}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found. Please sign up first.")

    session_token = await create_session_token(user["id"])
    identity = await get_scout_identity(user)
    # Strip internal/sensitive fields before returning
    _INTERNAL_FIELDS = {"is_super_admin", "is_admin", "phone", "email"}
    safe_user = {k: v for k, v in user.items() if k not in _INTERNAL_FIELDS}
    return {**safe_user, "session_token": session_token, "identity": identity}


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
    identity = await get_scout_identity(user.dict())
    return {**user.dict(), "session_token": session_token, "identity": identity}


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


@router.get("/users/me/identity")
async def get_my_identity(user: dict = Depends(require_auth)):
    """
    Return the authenticated user's scout identity context.

    The frontend uses this to:
      - Route to the correct onboarding flow (identity.onboarding)
      - Gate features by capability (identity.capabilities)
      - Show tier progression (identity.ratings_to_next)
      - Understand the user's role in the network (identity.role)

    This endpoint is the single source of truth for identity — never hardcode
    tier logic in the frontend.
    """
    return await get_scout_identity(user)


@router.put("/users/me/music-preferences")
async def update_music_preferences(
    payload: MusicPreferencesUpdate,
    user: dict = Depends(require_auth),
):
    """
    Save music genre preferences for the authenticated user.
    These are bridged into the Vibe DNA affinity engine and Night Planner
    to prioritise venues matching the scout's musical taste.
    Genres are free-form strings (e.g. "Afrobeats", "Amapiano", "House").
    """
    if not payload.genres:
        raise HTTPException(status_code=400, detail="genres list cannot be empty")
    # Normalise: strip whitespace, deduplicate, cap at 10
    genres = list(dict.fromkeys(g.strip() for g in payload.genres if g.strip()))[:10]
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"music_preferences": genres}},
    )
    return {"success": True, "music_preferences": genres}


VALID_PRESET_KEYS = {"default", "gold", "emerald", "arctic", "rose", "void", "inferno"}

@router.put("/users/me/reactor-skin")
async def update_reactor_skin(
    payload: ReactorSkinUpdate,
    user: dict = Depends(require_auth),
):
    """
    Save the user's reactor skin preference.
    Accepts a preset key (e.g. "gold") or a custom hex value ("custom:#FF6D00").
    Custom skins are gated to VIBE+ users on the frontend; the API stores
    whatever is sent so the app can enforce the gate without backend round-trips.
    """
    skin = payload.skin.strip()

    if skin.startswith("custom:"):
        # Validate hex portion: must be #RRGGBB
        hex_part = skin[7:]
        import re
        if not re.fullmatch(r"#[0-9A-Fa-f]{6}", hex_part):
            raise HTTPException(status_code=400, detail="Invalid hex color. Use #RRGGBB format.")
    elif skin not in VALID_PRESET_KEYS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown skin. Valid presets: {', '.join(sorted(VALID_PRESET_KEYS))}",
        )

    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"reactor_skin": skin}},
    )
    return {"success": True, "reactor_skin": skin}


VALID_ZODIAC_SIGNS = {
    "aries", "taurus", "gemini", "cancer", "leo", "virgo",
    "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces",
}

@router.put("/users/me/zodiac")
async def update_zodiac(
    payload: ZodiacUpdate,
    user: dict = Depends(require_auth),
):
    """
    Save or clear the user's zodiac sign.
    Purely optional — None clears it. Used for Cosmic Vibe readings.
    """
    sign = payload.sign.strip().lower() if payload.sign else None

    if sign and sign not in VALID_ZODIAC_SIGNS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown sign. Valid: {', '.join(sorted(VALID_ZODIAC_SIGNS))}",
        )

    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"zodiac_sign": sign}},
    )
    return {"success": True, "zodiac_sign": sign}


@router.put("/users/me/push-token")
async def register_push_token(
    payload: PushTokenUpdate,
    user: dict = Depends(require_auth),
):
    """Register or update the user's Expo push token for re-engagement notifications."""
    token = payload.push_token.strip()
    if not token.startswith("ExponentPushToken"):
        raise HTTPException(status_code=400, detail="Invalid Expo push token format.")
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"push_token": token}},
    )
    return {"success": True}


@router.put("/users/me/call-name")
async def update_call_name(
    payload: CallNameUpdate,
    user: dict = Depends(require_auth),
):
    """Save what the user wants to be called inside the app. Max 30 chars."""
    name = payload.call_name.strip() if payload.call_name else None
    if name and len(name) > 30:
        raise HTTPException(status_code=400, detail="Call name must be 30 characters or less.")

    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"call_name": name}},
    )
    return {"success": True, "call_name": name}
