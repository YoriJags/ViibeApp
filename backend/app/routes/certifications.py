"""
Vibe Certification Routes
Venues that maintain 70+ vibe score for 90+ days earn "Vibe Certified" status.
Optimized: evaluate_certifications uses a single aggregation instead of N+1 per venue.
"""
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Request

from app.config import db, logger
from app.services.auth import get_current_user

router = APIRouter(tags=["certifications"])

CERTIFICATION_THRESHOLD = 70
CERTIFICATION_DAYS = 90


@router.get("/certifications")
async def get_certified_venues(city: str = "lagos"):
    """Public: list all Vibe Certified venues in a city."""
    venues = await db.venues.find(
        {
            "city": city,
            "vibe_certified": True,
        },
        {
            "_id": 0,
            "id": 1,
            "name": 1,
            "area": 1,
            "city": 1,
            "venue_type": 1,
            "current_vibe_score": 1,
            "certified_since": 1,
            "certification_score": 1,
            "coordinates": 1,
        },
    ).sort("current_vibe_score", -1).to_list(100)

    return {"certified_venues": venues, "count": len(venues)}


@router.get("/certifications/{venue_id}")
async def get_certification_details(venue_id: str):
    """Get certification details for a specific venue."""
    venue = await db.venues.find_one({"id": venue_id})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    is_certified = venue.get("vibe_certified", False)
    certified_since = venue.get("certified_since")
    certification_score = venue.get("certification_score", 0)

    days_certified = 0
    if is_certified and certified_since:
        if isinstance(certified_since, str):
            certified_since = datetime.fromisoformat(certified_since.replace("Z", "+00:00"))
        days_certified = (datetime.now(timezone.utc) - certified_since).days

    # Get recent high ratings
    now = datetime.now(timezone.utc)
    month_ago = now - timedelta(days=30)
    recent_ratings = await db.ratings.find({
        "venue_id": venue_id,
        "timestamp": {"$gte": month_ago},
        "vibe_score": {"$gte": 70},
    }, {"_id": 0}).sort("vibe_score", -1).to_list(10)

    return {
        "venue_id": venue_id,
        "venue_name": venue.get("name", ""),
        "is_certified": is_certified,
        "certified_since": certified_since.isoformat() if certified_since else None,
        "days_certified": days_certified,
        "certification_score": certification_score,
        "current_score": venue.get("current_vibe_score", 0),
        "top_recent_ratings": len(recent_ratings),
    }


@router.post("/admin/certifications/evaluate")
async def evaluate_certifications(request: Request):
    """
    Admin: evaluate all venues for Vibe Certification.
    Uses a single aggregation pipeline instead of querying snapshots per venue.
    """
    user = await get_current_user(request)
    if not user or not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")

    now = datetime.now(timezone.utc)
    ninety_days_ago = now - timedelta(days=CERTIFICATION_DAYS)

    # Single aggregation: group snapshots by venue, compute avg score and unique days
    pipeline = [
        {"$match": {"timestamp": {"$gte": ninety_days_ago}}},
        {"$group": {
            "_id": "$venue_id",
            "avg_score": {"$avg": "$vibe_score"},
            "unique_days": {"$addToSet": {
                "$dateToString": {"format": "%Y-%m-%d", "date": "$timestamp"},
            }},
        }},
        {"$project": {
            "_id": 1,
            "avg_score": 1,
            "day_count": {"$size": "$unique_days"},
        }},
    ]

    venue_stats = await db.vibe_snapshots.aggregate(pipeline).to_list(10000)
    stats_map = {s["_id"]: s for s in venue_stats}

    # Get all venues (lightweight - just id, name, certification status)
    all_venues = await db.venues.find(
        {}, {"id": 1, "name": 1, "vibe_certified": 1}
    ).to_list(5000)

    newly_certified = 0
    maintained = 0
    revoked = 0

    # Batch updates instead of individual update_one per venue
    certify_ids = []
    maintain_updates = []
    revoke_ids = []

    for venue in all_venues:
        venue_id = venue["id"]
        stats = stats_map.get(venue_id)
        was_certified = venue.get("vibe_certified", False)

        if not stats:
            if was_certified:
                revoke_ids.append(venue_id)
                revoked += 1
            continue

        meets_criteria = (
            stats["avg_score"] >= CERTIFICATION_THRESHOLD
            and stats["day_count"] >= CERTIFICATION_DAYS
        )

        if meets_criteria and not was_certified:
            certify_ids.append((venue_id, round(stats["avg_score"], 1)))
            newly_certified += 1
        elif meets_criteria and was_certified:
            maintain_updates.append((venue_id, round(stats["avg_score"], 1)))
            maintained += 1
        elif not meets_criteria and was_certified:
            revoke_ids.append(venue_id)
            revoked += 1

    # Execute batch updates
    if certify_ids:
        for vid, score in certify_ids:
            await db.venues.update_one(
                {"id": vid},
                {"$set": {
                    "vibe_certified": True,
                    "certified_since": now,
                    "certification_score": score,
                }},
            )

    if maintain_updates:
        for vid, score in maintain_updates:
            await db.venues.update_one(
                {"id": vid},
                {"$set": {"certification_score": score}},
            )

    if revoke_ids:
        await db.venues.update_many(
            {"id": {"$in": revoke_ids}},
            {"$set": {"vibe_certified": False}},
        )

    logger.info(
        f"Certification evaluation: {newly_certified} new, {maintained} maintained, {revoked} revoked"
    )

    return {
        "newly_certified": newly_certified,
        "maintained": maintained,
        "revoked": revoked,
        "total_evaluated": len(all_venues),
    }
