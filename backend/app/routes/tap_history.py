"""
Tap History — cross-venue bolt tap breakdown per scout.

Scouts can see how many taps they've contributed tonight and all time,
broken down by venue and grouped by night.

Routes:
  GET /api/me/tap-history   — authenticated user's tap stats
"""
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends
from app.config import db
from app.services.auth import require_auth

router = APIRouter(tags=["tap_history"])


def _night_start(dt: datetime) -> datetime:
    """5PM–7AM rolling night window."""
    if dt.hour < 7:
        base = dt - timedelta(days=1)
    else:
        base = dt
    return base.replace(hour=17, minute=0, second=0, microsecond=0)


@router.get("/me/tap-history")
async def get_tap_history(user: dict = Depends(require_auth)):
    user_id = user["id"]
    now = datetime.now(timezone.utc)
    tonight_start = _night_start(now)
    last_30_days   = now - timedelta(days=30)

    # ── Tonight: per-venue tap breakdown ────────────────────────────────────
    tonight_pipeline = [
        {"$match": {"user_id": user_id, "created_at": {"$gte": tonight_start}}},
        {"$group": {"_id": "$venue_id", "tap_count": {"$sum": 1}}},
        {"$sort": {"tap_count": -1}},
        {"$limit": 20},
    ]
    tonight_docs = await db.venue_bolts.aggregate(tonight_pipeline).to_list(20)

    # Enrich with venue names + current surge level
    tonight_venues = []
    for doc in tonight_docs:
        venue = await db.venues.find_one({"id": doc["_id"]}, {"name": 1, "area": 1})
        # Latest surge record for this venue
        surge = await db.venue_bolts.find_one(
            {"venue_id": doc["_id"]},
            sort=[("created_at", -1)],
        )
        tonight_venues.append({
            "venue_id": doc["_id"],
            "venue_name": venue["name"] if venue else "Unknown",
            "venue_area": venue.get("area", "") if venue else "",
            "tap_count": doc["tap_count"],
        })

    tonight_total = sum(v["tap_count"] for v in tonight_venues)

    # ── All-time stats ───────────────────────────────────────────────────────
    alltime_pipeline = [
        {"$match": {"user_id": user_id}},
        {"$group": {"_id": "$venue_id", "tap_count": {"$sum": 1}}},
        {"$sort": {"tap_count": -1}},
    ]
    alltime_docs = await db.venue_bolts.aggregate(alltime_pipeline).to_list(None)
    alltime_total = sum(d["tap_count"] for d in alltime_docs)

    top_venue_doc = alltime_docs[0] if alltime_docs else None
    top_venue = None
    if top_venue_doc:
        v = await db.venues.find_one({"id": top_venue_doc["_id"]}, {"name": 1})
        top_venue = {
            "venue_id": top_venue_doc["_id"],
            "venue_name": v["name"] if v else "Unknown",
            "tap_count": top_venue_doc["tap_count"],
        }

    # ── Per-night history (last 30 days, grouped by night window) ───────────
    history_pipeline = [
        {"$match": {"user_id": user_id, "created_at": {"$gte": last_30_days}}},
        {
            "$project": {
                "venue_id": 1,
                "created_at": 1,
                # Shift so 5PM becomes midnight of that "night"
                "night_day": {
                    "$dateToString": {
                        "format": "%Y-%m-%d",
                        "date": {
                            "$dateSubtract": {
                                "startDate": "$created_at",
                                "unit": "hour",
                                "amount": 17,
                            }
                        },
                        "timezone": "UTC",
                    }
                },
            }
        },
        {
            "$group": {
                "_id": "$night_day",
                "total_taps": {"$sum": 1},
                "venues": {"$addToSet": "$venue_id"},
            }
        },
        {"$sort": {"_id": -1}},
        {"$limit": 30},
    ]
    history_docs = await db.venue_bolts.aggregate(history_pipeline).to_list(30)
    history = [
        {
            "date": d["_id"],
            "total_taps": d["total_taps"],
            "venue_count": len(d["venues"]),
        }
        for d in history_docs
    ]

    return {
        "tonight": {
            "total_taps": tonight_total,
            "venues": tonight_venues,
        },
        "all_time": {
            "total_taps": alltime_total,
            "top_venue": top_venue,
            "venues_tapped": len(alltime_docs),
        },
        "history": history,
    }
