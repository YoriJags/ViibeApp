"""
Vibe App - Timeline Routes
24-hour vibe history with hourly aggregation and peak prediction.
"""
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Query

from app.config import db

router = APIRouter(tags=["timeline"])


@router.get("/timeline/{venue_id}")
async def get_venue_timeline(venue_id: str, hours: int = Query(default=24, le=72, ge=1)):
    """Get hourly vibe history for a venue over the past N hours."""
    venue = await db.venues.find_one({"id": venue_id})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    now = datetime.now(timezone.utc)
    start_time = now - timedelta(hours=hours)

    # Aggregate snapshots by hour
    pipeline = [
        {
            "$match": {
                "venue_id": venue_id,
                "timestamp": {"$gte": start_time},
            }
        },
        {
            "$group": {
                "_id": {
                    "year": {"$year": "$timestamp"},
                    "month": {"$month": "$timestamp"},
                    "day": {"$dayOfMonth": "$timestamp"},
                    "hour": {"$hour": "$timestamp"},
                },
                "avg_vibe_score": {"$avg": "$vibe_score"},
                "max_vibe_score": {"$max": "$vibe_score"},
                "avg_energy": {"$avg": {
                    "$switch": {
                        "branches": [
                            {"case": {"$eq": ["$energy_level", "chill"]}, "then": 1},
                            {"case": {"$eq": ["$energy_level", "popping"]}, "then": 2},
                            {"case": {"$eq": ["$energy_level", "electric"]}, "then": 3},
                        ],
                        "default": 1,
                    }
                }},
                "snapshot_count": {"$sum": 1},
            }
        },
        {"$sort": {"_id.year": 1, "_id.month": 1, "_id.day": 1, "_id.hour": 1}},
    ]

    snapshots = await db.vibe_snapshots.aggregate(pipeline).to_list(100)

    # Also count ratings and check-ins per hour
    timeline = []
    peak_score = 0
    peak_hour = None

    for snap in snapshots:
        hour_dt = datetime(
            snap["_id"]["year"],
            snap["_id"]["month"],
            snap["_id"]["day"],
            snap["_id"]["hour"],
            tzinfo=timezone.utc,
        )
        hour_end = hour_dt + timedelta(hours=1)

        rating_count = await db.ratings.count_documents({
            "venue_id": venue_id,
            "timestamp": {"$gte": hour_dt, "$lt": hour_end},
        })

        checkin_count = await db.checkins.count_documents({
            "venue_id": venue_id,
            "created_at": {"$gte": hour_dt, "$lt": hour_end},
        })

        avg_score = round(snap["avg_vibe_score"], 1)
        energy_num = snap["avg_energy"]
        energy_label = "chill" if energy_num < 1.5 else "popping" if energy_num < 2.5 else "electric"

        if avg_score > peak_score:
            peak_score = avg_score
            peak_hour = hour_dt.strftime("%I %p").lstrip("0")

        timeline.append({
            "hour": hour_dt.isoformat(),
            "hour_label": hour_dt.strftime("%I %p").lstrip("0"),
            "avg_vibe_score": avg_score,
            "peak_score": round(snap["max_vibe_score"], 1),
            "energy_level": energy_label,
            "rating_count": rating_count,
            "checkin_count": checkin_count,
        })

    return {
        "venue_id": venue_id,
        "venue_name": venue.get("name", ""),
        "hours": hours,
        "timeline": timeline,
        "peak_hour": peak_hour,
        "peak_score": round(peak_score, 1),
    }


@router.get("/timeline/{venue_id}/peak")
async def get_peak_prediction(venue_id: str):
    """Predict tonight's peak hour based on 7-day rolling average."""
    venue = await db.venues.find_one({"id": venue_id})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)

    # Group by hour-of-day across the last 7 days
    pipeline = [
        {
            "$match": {
                "venue_id": venue_id,
                "timestamp": {"$gte": week_ago},
            }
        },
        {
            "$group": {
                "_id": {"$hour": "$timestamp"},
                "avg_score": {"$avg": "$vibe_score"},
                "count": {"$sum": 1},
            }
        },
        {"$sort": {"avg_score": -1}},
    ]

    results = await db.vibe_snapshots.aggregate(pipeline).to_list(24)

    if not results:
        return {
            "venue_id": venue_id,
            "predicted_peak_hour": None,
            "message": "Not enough data yet. Check back after a few nights!",
        }

    peak = results[0]
    peak_hour_24 = peak["_id"]
    peak_dt = datetime.now(timezone.utc).replace(hour=peak_hour_24, minute=0)
    peak_label = peak_dt.strftime("%I %p").lstrip("0")

    return {
        "venue_id": venue_id,
        "predicted_peak_hour": peak_label,
        "predicted_peak_score": round(peak["avg_score"], 1),
        "data_points": peak["count"],
        "hourly_averages": [
            {
                "hour": r["_id"],
                "avg_score": round(r["avg_score"], 1),
            }
            for r in sorted(results, key=lambda x: x["_id"])
        ],
    }
