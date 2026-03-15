"""
Vibe App - Rating Routes
Submit ratings, offline sync, and user-venue rating status.
"""
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Request

from app.config import db, MAX_RATINGS_PER_VENUE_PER_DAY, RATING_COOLDOWN_MINUTES
from app.models import Rating, RatingCreate, Coordinates
from app.services.vibe import (
    calculate_vibe_score,
    calculate_venue_aggregate,
    compute_scout_credibility,
    is_within_geofence,
    update_user_clout,
)
from app.routes.coins import award_coins, COIN_EARN, VIBE_PLUS_MULTIPLIER

BURST_THRESHOLD = 4        # ratings triggering provisional hold
BURST_WINDOW_MINUTES = 10  # window to detect burst
BURST_HOLD_MINUTES = 15    # how long provisional ratings are held
from app.services.realtime import broadcast_venue_update, broadcast_leaderboard, broadcast_city_pulse
from app.services.streaks import update_streak
from app.services.vibe import save_vibe_snapshot, generate_venue_narrative, check_and_emit_surge_alert

router = APIRouter(tags=["ratings"])


@router.post("/ratings")
async def create_rating(rating_data: RatingCreate):
    """Submit a vibe rating for a venue. Geofence-enforced."""
    venue = await db.venues.find_one({"id": rating_data.venue_id})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    venue_coords = Coordinates(**venue["coordinates"])
    venue_radius = venue.get("geofence_radius_m", 100)
    if not is_within_geofence(rating_data.coordinates, venue_coords, radius_m=venue_radius):
        raise HTTPException(
            status_code=403,
            detail=f"You must be within {int(venue_radius)}m of the venue to rate. Please get closer.",
        )

    now = datetime.now(timezone.utc)
    day_ago = now - timedelta(hours=24)

    existing_ratings = await db.ratings.find({
        "user_id": rating_data.user_id,
        "venue_id": rating_data.venue_id,
        "timestamp": {"$gte": day_ago},
    }).sort("timestamp", -1).to_list(10)

    if len(existing_ratings) >= MAX_RATINGS_PER_VENUE_PER_DAY:
        raise HTTPException(
            status_code=429,
            detail="Rating limit reached. You can rate this venue again in 24 hours.",
        )

    # 5-minute cooldown between ratings (Vibe+ users are exempt)
    user_doc = await db.users.find_one({"id": rating_data.user_id})
    is_vibe_plus = user_doc and user_doc.get("is_vibe_plus") and (
        not user_doc.get("vibe_plus_expires_at")
        or user_doc["vibe_plus_expires_at"] > now
    )
    if not is_vibe_plus and existing_ratings:
        last_rating_time = existing_ratings[0].get("timestamp", now)
        if isinstance(last_rating_time, str):
            last_rating_time = datetime.fromisoformat(last_rating_time.replace("Z", "+00:00"))
        if last_rating_time.tzinfo is None:
            last_rating_time = last_rating_time.replace(tzinfo=timezone.utc)
        seconds_since = (now - last_rating_time).total_seconds()
        cooldown_seconds = RATING_COOLDOWN_MINUTES * 60
        if seconds_since < cooldown_seconds:
            remaining = int(cooldown_seconds - seconds_since)
            raise HTTPException(
                status_code=429,
                detail=f"Vibe is still fresh — wait {remaining}s or upgrade to Vibe+ for unlimited ratings.",
                headers={"X-Cooldown-Remaining": str(remaining)},
            )

    vibe_score = calculate_vibe_score(
        rating_data.energy,
        rating_data.capacity,
        rating_data.gate,
        rating_data.venue_specific,
    )

    # Burst detection: hold rating provisionally if 4+ same-energy ratings in 10 min
    is_provisional = await _check_burst(rating_data.venue_id, rating_data.energy, now)
    provisional_until = (now + timedelta(minutes=BURST_HOLD_MINUTES)) if is_provisional else None

    is_correction = len(existing_ratings) == 1
    rating = Rating(
        **rating_data.dict(exclude={"coordinates", "offline_id"}),
        vibe_score=vibe_score,
        is_correction=is_correction,
    )

    if is_correction and existing_ratings:
        await db.ratings.update_one(
            {"id": existing_ratings[0]["id"]},
            {"$set": {"superseded": True}},
        )

    # Compute and stamp scout credibility weight before insert
    credibility = await compute_scout_credibility(rating_data.user_id)

    rating_doc = rating.dict()
    rating_doc["provisional"] = is_provisional
    rating_doc["provisional_until"] = provisional_until
    rating_doc["credibility_weight"] = credibility
    await db.ratings.insert_one(rating_doc)

    aggregate = await calculate_venue_aggregate(rating_data.venue_id)
    await db.venues.update_one(
        {"id": rating_data.venue_id},
        {"$set": aggregate},
    )

    await update_user_clout(rating_data.user_id, rating_data.venue_id, vibe_score)

    # ── Award Vibe Coins ──────────────────────────────────────────────────────
    # PHASE 1 (now): pool-funded coins only — every coin backed by venue money.
    # PHASE 2 (post-funding): enable PLATFORM_BASE_COINS to award base coins
    #   from platform revenue on every rating, regardless of pool status.
    #   Flip the flag in economy_config when ready.
    PLATFORM_BASE_COINS = False  # set True when platform revenue can fund this

    _now_iso = datetime.now(timezone.utc).isoformat()
    _pool = await db.venue_reward_pools.find_one({
        "venue_id": rating_data.venue_id,
        "active": True,
        "coins_remaining": {"$gt": 0},
        "expires_at": {"$gt": _now_iso},
    })
    _coins = 0
    _pool_bonus = 0

    if _pool:
        _coins = _pool["coin_rate"]
        _pool_bonus = _coins
        await db.venue_reward_pools.update_one(
            {"id": _pool["id"]},
            {"$inc": {"coins_remaining": -_coins}},
        )
        await award_coins(rating_data.user_id, _coins, "pool_rating", rating_data.venue_id)

    elif PLATFORM_BASE_COINS:
        # Future: platform funds base coins from subscription/fee revenue
        rater = await db.users.find_one({"id": rating_data.user_id}, {"is_vibe_plus": 1, "vibe_plus_expires_at": 1})
        _is_vp = rater and rater.get("is_vibe_plus") and rater.get("vibe_plus_expires_at", "") > _now_iso
        _coins = COIN_EARN["rating"] * (VIBE_PLUS_MULTIPLIER if _is_vp else 1)
        await award_coins(rating_data.user_id, _coins, "rating", rating_data.venue_id)
    # ─────────────────────────────────────────────────────────────────────────

    # Update streak + apply multiplier
    streak_result = await update_streak(rating_data.user_id)
    if streak_result.get("multiplier", 1.0) > 1.0:
        bonus = int(vibe_score / 10 * (streak_result["multiplier"] - 1.0))
        if bonus > 0:
            await db.users.update_one(
                {"id": rating_data.user_id},
                {"$inc": {"clout_points": bonus}},
            )

    # Save vibe snapshot for timeline (also triggers Aura Shield check)
    await save_vibe_snapshot(rating_data.venue_id, aggregate)

    # Generate sports-broadcast narrative and patch venue document
    current_score = aggregate.get("current_vibe_score", 0)
    narrative, _ = await generate_venue_narrative(rating_data.venue_id, current_score)
    await db.venues.update_one(
        {"id": rating_data.venue_id},
        {"$set": {"venue_narrative": narrative}},
    )

    # Emit global_surge_alert to city room if score jumped > 15 pts in 15 mins
    await check_and_emit_surge_alert(
        rating_data.venue_id,
        venue.get("name", ""),
        venue.get("city", "lagos"),
        current_score,
    )

    # Check for active energy campaign -> apply campaign clout multiplier
    campaign_multiplier = 1
    now = datetime.now(timezone.utc)
    active_campaign = await db.campaigns.find_one({
        "venue_id": rating_data.venue_id,
        "status": "active",
        "expires_at": {"$gt": now},
    })
    if active_campaign:
        campaign_multiplier = active_campaign.get("multiplier", 1)
        if campaign_multiplier > 1:
            campaign_bonus = int(vibe_score / 10 * (campaign_multiplier - 1))
            if campaign_bonus > 0:
                await db.users.update_one(
                    {"id": rating_data.user_id},
                    {"$inc": {"clout_points": campaign_bonus}},
                )
            # Track campaign attribution
            await db.campaigns.update_one(
                {"id": active_campaign["id"]},
                {"$inc": {"ratings_during": 1, "clout_distributed": campaign_bonus}},
            )

    # Check for squad bonus: 3+ crew members rated same venue within 1 hour
    squad_bonus = await _check_squad_bonus(rating_data.user_id, rating_data.venue_id)

    await broadcast_venue_update(rating_data.venue_id)
    await broadcast_leaderboard(venue.get("city", "lagos"))
    await broadcast_leaderboard("all")
    await broadcast_city_pulse(venue.get("city", "lagos"))

    # ── Icon Spotted: if rater is a Verified/Icon/Legend, fire signal to venue followers ──
    import asyncio as _asyncio
    _asyncio.create_task(_emit_icon_spotted(user_doc, venue, rating_data.venue_id))

    return {
        "rating": rating.dict(),
        "is_correction": is_correction,
        "remaining_ratings": 1 if not is_correction else 0,
        "venue_vibe_score": aggregate.get("current_vibe_score", 0),
        "streak": streak_result,
        "squad_bonus": squad_bonus,
        "campaign_multiplier": campaign_multiplier,
        "coins_earned": _coins,
        "pool_bonus": _pool_bonus,
    }


@router.post("/ratings/sync")
async def sync_offline_ratings(request: Request):
    """Sync ratings that were created offline."""
    body = await request.json()
    ratings = body.get("ratings", [])
    synced = []

    for rating_data in ratings:
        try:
            result = await create_rating(RatingCreate(**rating_data))
            synced.append({"offline_id": rating_data.get("offline_id"), "success": True})
        except Exception as e:
            synced.append({"offline_id": rating_data.get("offline_id"), "success": False, "error": str(e)})

    return {"synced": synced}


@router.get("/ratings/user/{user_id}/venue/{venue_id}")
async def get_user_venue_ratings(user_id: str, venue_id: str):
    """Get a user's ratings for a specific venue in the last 24 hours."""
    now = datetime.now(timezone.utc)
    day_ago = now - timedelta(hours=24)

    ratings = await db.ratings.find({
        "user_id": user_id,
        "venue_id": venue_id,
        "timestamp": {"$gte": day_ago},
    }, {"_id": 0}).to_list(10)

    return {
        "ratings_count": len(ratings),
        "can_rate": len(ratings) < MAX_RATINGS_PER_VENUE_PER_DAY,
        "is_correction_available": len(ratings) == 1,
        "ratings": ratings,
    }


async def _check_burst(venue_id: str, energy: str, now: datetime) -> bool:
    """Returns True if this rating is part of a coordinated burst.

    Detects 4+ identical energy ratings arriving within 10 minutes for the same venue.
    Burst ratings are held in a provisional queue for 15 minutes before being applied.
    Legitimate flash-mobs pass through after the hold; coordinated gaming is diluted.
    """
    window_start = now - timedelta(minutes=BURST_WINDOW_MINUTES)
    count = await db.ratings.count_documents({
        "venue_id": venue_id,
        "energy": energy,
        "timestamp": {"$gte": window_start},
        "provisional": {"$ne": True},
    })
    return count >= BURST_THRESHOLD


SQUAD_BONUS_CLOUT = 10


async def _check_squad_bonus(user_id: str, venue_id: str) -> int:
    """Check if 3+ crew members rated the same venue within 1 hour. Awards squad bonus."""
    crew = await db.crews.find_one({"members": user_id})
    if not crew:
        return 0

    now = datetime.now(timezone.utc)
    hour_ago = now - timedelta(hours=1)
    members = crew.get("members", [])

    # Count how many crew members rated this venue in the last hour
    crew_ratings = await db.ratings.count_documents({
        "user_id": {"$in": members},
        "venue_id": venue_id,
        "timestamp": {"$gte": hour_ago},
    })

    if crew_ratings >= 3:
        # Award bonus to this user
        await db.users.update_one(
            {"id": user_id},
            {"$inc": {"clout_points": SQUAD_BONUS_CLOUT}},
        )
        return SQUAD_BONUS_CLOUT

    return 0


# ── ICON TIER LABELS ─────────────────────────────────────────────────────────
_ICON_TIER_LABELS = {
    "verified": "Verified",
    "icon": "Icon",
    "legend": "Legend",
}

_ICON_TIER_EMOJI = {
    "verified": "✓",
    "icon": "👑",
    "legend": "🔥",
}


async def _emit_icon_spotted(user_doc: dict | None, venue: dict, venue_id: str) -> None:
    """Fire an 'Icon Spotted' signal to venue followers when an Icon rates a venue.

    - Writes a record to `icon_spotted` collection (3-hour TTL index)
    - Emits a Socket.IO event to the venue room so live clients see it instantly
    - Rate-limited: one signal per (icon_user_id, venue_id) per 3 hours
    """
    if not user_doc:
        return
    icon_tier = user_doc.get("icon_tier")
    if not icon_tier:
        return  # regular scout — skip

    now = datetime.now(timezone.utc)
    three_hours_ago = now - timedelta(hours=3)

    # Rate limit: already fired for this icon at this venue in last 3h?
    existing = await db.icon_spotted.find_one({
        "user_id": user_doc["id"],
        "venue_id": venue_id,
        "spotted_at": {"$gte": three_hours_ago},
    })
    if existing:
        return

    label = user_doc.get("icon_label") or icon_tier.capitalize()
    emoji = _ICON_TIER_EMOJI.get(icon_tier, "👑")

    spotted_doc = {
        "user_id": user_doc["id"],
        "username": user_doc.get("username", "Someone"),
        "icon_tier": icon_tier,
        "icon_label": label,
        "venue_id": venue_id,
        "venue_name": venue.get("name", ""),
        "spotted_at": now,
        "expires_at": now + timedelta(hours=3),
    }
    await db.icon_spotted.insert_one(spotted_doc)

    # Socket.IO broadcast to venue room
    try:
        from app.config import sio
        await sio.emit("icon_spotted", {
            "venue_id": venue_id,
            "username": user_doc.get("username", "Someone"),
            "icon_tier": icon_tier,
            "icon_label": label,
            "emoji": emoji,
            "message": f"{emoji} {label} spotted at {venue.get('name', 'this venue')}",
        }, room=f"venue_{venue_id}")
    except Exception:
        pass  # non-critical
