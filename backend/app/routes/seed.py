"""
Vibe App - Seed & Dev Routes
Test data seeding and developer utilities.
"""
import os
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Request

from app.config import db, CITIES
from app.models import User, Venue, MerchantWallet

router = APIRouter(tags=["dev"])

_DEV_SECRET = os.environ.get("DEV_SEED_SECRET", "")


def _require_dev_secret(request: Request) -> None:
    """Block dev/seed routes unless the correct secret header is provided.
    Set DEV_SEED_SECRET env var. If unset, all dev routes are locked."""
    if not _DEV_SECRET:
        raise HTTPException(status_code=403, detail="Dev routes disabled (DEV_SEED_SECRET not configured)")
    provided = request.headers.get("X-Dev-Secret", "")
    if provided != _DEV_SECRET:
        raise HTTPException(status_code=403, detail="Invalid dev secret")


@router.post("/dev/promote-user")
async def promote_user(request: Request):
    _require_dev_secret(request)
    """Promote a user to admin/merchant for testing. DEV ONLY."""
    body = await request.json()
    user_id = body.get("user_id")
    role = body.get("role")
    venue_id = body.get("venue_id")

    if not user_id or not role:
        raise HTTPException(status_code=400, detail="user_id and role required")

    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    update_data = {}

    if role == "admin":
        update_data = {"is_admin": True}
    elif role == "super_admin":
        update_data = {"is_admin": True, "is_super_admin": True}
    elif role == "merchant":
        if not venue_id:
            raise HTTPException(status_code=400, detail="venue_id required for merchant role")
        venue = await db.venues.find_one({"id": venue_id})
        if not venue:
            raise HTTPException(status_code=404, detail="Venue not found")
        update_data = {"is_merchant": True, "merchant_venue_id": venue_id}
    else:
        raise HTTPException(status_code=400, detail="Invalid role. Use: admin, super_admin, or merchant")

    await db.users.update_one({"id": user_id}, {"$set": update_data})

    updated_user = await db.users.find_one({"id": user_id}, {"_id": 0})
    return {"message": f"User promoted to {role}", "user": updated_user}


@router.post("/seed")
async def seed_data(request: Request):
    """Seed Lagos venues for testing."""
    _require_dev_secret(request)
    await db.venues.delete_many({})
    await db.ratings.delete_many({})
    await db.users.delete_many({})
    await db.pulse_drops.delete_many({})
    await db.platform_revenue.delete_many({})
    await db.merchant_wallets.delete_many({})
    await db.wallet_transactions.delete_many({})
    await db.admin_overrides.delete_many({})
    await db.user_sessions.delete_many({})

    venues_data = [
        {
            "name": "Club Quilox",
            "address": "50 Saka Tinubu Street, Victoria Island",
            "area": "Victoria Island",
            "city": "lagos",
            "venue_type": "club",
            "coordinates": {"lat": 6.4281, "lng": 3.4219},
            "current_vibe_score": 85,
            "energy_level": "electric",
            "capacity_level": "vibrant",
            "gate_level": "slow",
            "vibe_velocity": "heating_up",
            "is_featured": True,
            "is_verified": True,
            "profile_views": 1250,
            "direction_clicks": 340,
            "entry_fee": "NGN20,000",
            "music_genre": "Afrobeats/Amapiano",
            "tables_available": True,
            "last_snapshot_time": datetime.now(timezone.utc) - timedelta(minutes=18),
            "active_pulse_tier": "spark",
            "pulse_expires_at": datetime.now(timezone.utc) + timedelta(hours=4),
            "glow_boost": 10,
        },
        {
            "name": "Hard Rock Cafe Lagos",
            "address": "Landmark Village, Victoria Island",
            "area": "Victoria Island",
            "city": "lagos",
            "venue_type": "restaurant",
            "coordinates": {"lat": 6.4235, "lng": 3.4452},
            "current_vibe_score": 72,
            "energy_level": "popping",
            "capacity_level": "vibrant",
            "gate_level": "clear",
            "vibe_velocity": "stable",
            "is_verified": True,
            "profile_views": 890,
            "direction_clicks": 210,
            "entry_fee": "Free Entry",
            "music_genre": "Rock/Pop",
            "tables_available": True,
            "last_snapshot_time": datetime.now(timezone.utc) - timedelta(minutes=35),
        },
        {
            "name": "Shiro Lagos",
            "address": "The Wheatbaker Hotel, Ikoyi",
            "area": "Ikoyi",
            "city": "lagos",
            "venue_type": "lounge",
            "coordinates": {"lat": 6.4502, "lng": 3.4378},
            "current_vibe_score": 25,
            "energy_level": "chill",
            "capacity_level": "sparse",
            "gate_level": "clear",
            "vibe_velocity": "cooling_down",
            "is_verified": True,
            "profile_views": 650,
            "direction_clicks": 180,
            "entry_fee": "NGN15,000",
            "music_genre": "House/Deep House",
            "tables_available": True,
            "last_snapshot_time": datetime.now(timezone.utc) - timedelta(minutes=12),
            "active_pulse_tier": "flare",
            "pulse_expires_at": datetime.now(timezone.utc) + timedelta(hours=3),
            "glow_boost": 15,
        },
        {
            "name": "Backyard BBQ",
            "address": "32 Bourdillon Road, Ikoyi",
            "area": "Ikoyi",
            "city": "lagos",
            "venue_type": "restaurant",
            "coordinates": {"lat": 6.4521, "lng": 3.4342},
            "current_vibe_score": 55,
            "energy_level": "chill",
            "capacity_level": "sparse",
            "gate_level": "clear",
            "vibe_velocity": "stable",
            "profile_views": 320,
            "direction_clicks": 95,
            "entry_fee": "Free Entry",
            "music_genre": "R&B/Soul",
            "tables_available": True,
            "last_snapshot_time": datetime.now(timezone.utc) - timedelta(hours=1),
        },
        {
            "name": "The Blowfish Hotel",
            "address": "17 Oju Olobun Close, Ikoyi",
            "area": "Ikoyi",
            "city": "lagos",
            "venue_type": "lounge",
            "coordinates": {"lat": 6.4489, "lng": 3.4298},
            "current_vibe_score": 78,
            "energy_level": "popping",
            "capacity_level": "vibrant",
            "gate_level": "slow",
            "vibe_velocity": "heating_up",
            "is_featured": True,
            "is_verified": True,
            "profile_views": 980,
            "direction_clicks": 275,
            "entry_fee": "NGN10,000 (Ladies Free)",
            "music_genre": "Amapiano/House",
            "tables_available": False,
            "last_snapshot_time": datetime.now(timezone.utc) - timedelta(minutes=8),
        },
        {
            "name": "Sky Restaurant & Lounge",
            "address": "Eko Hotel, Victoria Island",
            "area": "Victoria Island",
            "city": "lagos",
            "venue_type": "lounge",
            "coordinates": {"lat": 6.4253, "lng": 3.4168},
            "current_vibe_score": 62,
            "energy_level": "chill",
            "capacity_level": "vibrant",
            "gate_level": "clear",
            "vibe_velocity": "stable",
            "is_verified": True,
            "profile_views": 540,
            "direction_clicks": 145,
            "entry_fee": "NGN5,000",
            "music_genre": "Jazz/Lounge",
            "tables_available": True,
            "last_snapshot_time": datetime.now(timezone.utc) - timedelta(minutes=45),
        },
        {
            "name": "DNA Nightclub",
            "address": "Plot 4 Ozumba Mbadiwe Ave, Victoria Island",
            "area": "Victoria Island",
            "city": "lagos",
            "venue_type": "club",
            "coordinates": {"lat": 6.4318, "lng": 3.4267},
            "current_vibe_score": 91,
            "energy_level": "electric",
            "capacity_level": "full",
            "gate_level": "blocked",
            "vibe_velocity": "heating_up",
            "is_featured": True,
            "is_verified": True,
            "profile_views": 2100,
            "direction_clicks": 580,
            "entry_fee": "NGN30,000",
            "music_genre": "Amapiano/Afrobeats",
            "tables_available": False,
            "last_snapshot_time": datetime.now(timezone.utc) - timedelta(minutes=5),
        },
        {
            "name": "The Place Restaurant",
            "address": "9 Musa Yar'Adua Street, Victoria Island",
            "area": "Victoria Island",
            "city": "lagos",
            "venue_type": "restaurant",
            "coordinates": {"lat": 6.4298, "lng": 3.4198},
            "current_vibe_score": 45,
            "energy_level": "chill",
            "capacity_level": "sparse",
            "gate_level": "clear",
            "vibe_velocity": "cooling_down",
            "profile_views": 280,
            "direction_clicks": 70,
            "entry_fee": "Free Entry",
            "music_genre": "Highlife/Juju",
            "tables_available": True,
            "last_snapshot_time": datetime.now(timezone.utc) - timedelta(hours=2),
        },
        {
            "name": "Sailors Lounge",
            "address": "3 Akin Adesola Street, Victoria Island",
            "area": "Victoria Island",
            "city": "lagos",
            "venue_type": "lounge",
            "coordinates": {"lat": 6.4312, "lng": 3.4145},
            "current_vibe_score": 82,
            "energy_level": "electric",
            "capacity_level": "vibrant",
            "gate_level": "slow",
            "vibe_velocity": "stable",
            "is_verified": True,
            "profile_views": 1150,
            "direction_clicks": 310,
            "entry_fee": "NGN15,000",
            "music_genre": "Hip-Hop/R&B",
            "tables_available": True,
            "last_snapshot_time": datetime.now(timezone.utc) - timedelta(minutes=22),
        },
        {
            "name": "Cubana Lagos",
            "address": "1 Adeola Odeku Street, Victoria Island",
            "area": "Victoria Island",
            "city": "lagos",
            "venue_type": "club",
            "coordinates": {"lat": 6.4289, "lng": 3.4232},
            "current_vibe_score": 76,
            "energy_level": "popping",
            "capacity_level": "vibrant",
            "gate_level": "slow",
            "vibe_velocity": "heating_up",
            "is_verified": True,
            "profile_views": 870,
            "direction_clicks": 230,
            "entry_fee": "NGN10,000",
            "music_genre": "Afrobeats/Dancehall",
            "tables_available": True,
            "last_snapshot_time": datetime.now(timezone.utc) - timedelta(minutes=15),
        },
    ]

    for venue_data in venues_data:
        venue = Venue(**venue_data)
        await db.venues.insert_one(venue.dict())

        wallet = MerchantWallet(
            merchant_id=venue.id,
            venue_id=venue.id,
            balance=25000,
        )
        await db.merchant_wallets.insert_one(wallet.dict())

    test_user = User(
        username="vibe_tester",
        phone="+2341234567890",
        email="test@vibe.app",
        name="Vibe Tester",
        clout_points=150,
        scout_status="regular",
        rating_accuracy_score=72.5,
        total_ratings=15,
    )
    await db.users.insert_one(test_user.dict())

    admin_user = User(
        username="admin",
        phone="+2340000000000",
        email="admin@vibe.app",
        name="Super Admin",
        clout_points=0,
        scout_status="elite",
        is_admin=True,
        is_super_admin=True,
    )
    await db.users.insert_one(admin_user.dict())

    return {
        "message": "Data seeded successfully",
        "venues_created": len(venues_data),
        "test_user_id": test_user.id,
        "admin_user_id": admin_user.id,
        "cities": list(CITIES.keys()),
    }
