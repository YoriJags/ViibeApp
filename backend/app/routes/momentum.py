"""
Vibe App - Momentum, Missed Peaks & Scene Report
Three intel-layer endpoints that turn raw score data into narrative.

  GET /api/momentum           — directional score delta for all venues (map arrows)
  GET /api/notifications/missed-peaks — venues that peaked while you weren't there
  GET /api/scene-report       — auto-generated last-night recap
"""
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends

from app.config import db
from app.services.auth import require_auth

router = APIRouter(tags=["momentum"])

# WAT offset: Lagos = UTC+1
_WAT = timezone(timedelta(hours=1))


# ── Helpers ───────────────────────────────────────────────────────────────────

def _classify_momentum(delta: float, current_score: float) -> str:
    """
    rising  — climbing more than +5 points in 1 hour
    peaking — high score (≥70) but movement < 5 pts (at the top)
    fading  — dropping more than 5 points in 1 hour
    stable  — small delta, moderate score
    """
    if delta >= 5:
        return "rising"
    if delta <= -5:
        return "fading"
    if current_score >= 70:
        return "peaking"
    return "stable"


async def _score_1h_ago(venue_id: str, now: datetime) -> float | None:
    """Return avg vibe score for a venue from 60-90 minutes ago."""
    window_start = now - timedelta(minutes=90)
    window_end = now - timedelta(minutes=30)

    pipeline = [
        {
            "$match": {
                "venue_id": venue_id,
                "timestamp": {"$gte": window_start, "$lte": window_end},
            }
        },
        {"$group": {"_id": None, "avg": {"$avg": "$vibe_score"}}},
    ]
    results = await db.vibe_snapshots.aggregate(pipeline).to_list(1)
    if results:
        return round(results[0]["avg"], 1)
    return None


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/momentum")
async def get_venue_momentum():
    """
    Returns directional momentum for all active venues.
    Compares current vibe score vs 60-min-ago snapshot.
    Used by the map to render rising/peaking/fading arrows.
    """
    now = datetime.now(timezone.utc)
    venues = await db.venues.find(
        {}, {"_id": 0, "id": 1, "name": 1, "current_vibe_score": 1}
    ).to_list(100)

    result = []
    for venue in venues:
        current = venue.get("current_vibe_score", 0)
        prev = await _score_1h_ago(venue["id"], now)
        delta = round(current - prev, 1) if prev is not None else 0.0
        momentum = _classify_momentum(delta, current)
        result.append({
            "id": venue["id"],
            "name": venue.get("name"),
            "current_score": current,
            "score_1h_ago": prev,
            "delta": delta,
            "momentum": momentum,  # rising | peaking | fading | stable
        })

    return {"momentum": result, "computed_at": now.isoformat()}


@router.get("/notifications/missed-peaks")
async def get_missed_peaks(user: dict = Depends(require_auth)):
    """
    For each venue the user follows, check if it had a peak (score ≥ 70)
    in the last 24 hours that the user didn't personally witness
    (no rating or check-in from them during that window).
    Returns a "You Missed It" list.
    """
    now = datetime.now(timezone.utc)
    since = now - timedelta(hours=24)

    # Get followed venue IDs
    follows = await db.venue_follows.find(
        {"user_id": user["id"], "active": True}, {"venue_id": 1}
    ).to_list(200)
    followed_ids = [f["venue_id"] for f in follows]

    if not followed_ids:
        return {"missed": []}

    missed = []
    for venue_id in followed_ids:
        # Find peak snapshot in last 24h
        pipeline = [
            {
                "$match": {
                    "venue_id": venue_id,
                    "timestamp": {"$gte": since},
                    "vibe_score": {"$gte": 70},
                }
            },
            {
                "$group": {
                    "_id": None,
                    "peak_score": {"$max": "$vibe_score"},
                    "peak_time": {"$last": "$timestamp"},
                }
            },
        ]
        peaks = await db.vibe_snapshots.aggregate(pipeline).to_list(1)
        if not peaks:
            continue

        peak = peaks[0]
        # Check if user was there (rated or checked in)
        did_rate = await db.ratings.count_documents({
            "user_id": user["id"],
            "venue_id": venue_id,
            "timestamp": {"$gte": since},
        })
        did_checkin = await db.checkins.count_documents({
            "user_id": user["id"],
            "venue_id": venue_id,
            "created_at": {"$gte": since},
        })

        if did_rate == 0 and did_checkin == 0:
            venue_doc = await db.venues.find_one(
                {"id": venue_id}, {"_id": 0, "name": 1, "area": 1}
            )
            peak_time = peak["peak_time"]
            # Convert to WAT for display
            wat_time = peak_time.astimezone(_WAT) if peak_time.tzinfo else peak_time
            missed.append({
                "venue_id": venue_id,
                "venue_name": venue_doc.get("name") if venue_doc else "Unknown Venue",
                "area": venue_doc.get("area") if venue_doc else "",
                "peak_score": round(peak["peak_score"], 1),
                "peak_time": peak_time.isoformat(),
                "peak_time_label": wat_time.strftime("%-I:%M %p") if hasattr(wat_time, 'strftime') else "",
                "message": f"Hit {round(peak['peak_score'])}% while you were away",
            })

    # Sort by peak score descending — biggest miss first
    missed.sort(key=lambda x: x["peak_score"], reverse=True)
    return {"missed": missed[:5]}  # cap at 5


@router.get("/venues/{venue_id}/momentum")
async def get_venue_momentum_detail(venue_id: str):
    """
    Per-venue momentum signal — two measures:

    1. Crowd Velocity: compare check-in count in last 10 min vs prior 10 min.
       Emoji fire reactions boost the signal.
       Returns: velocity ("rising"|"flat"|"falling"), velocity_pct, checkins_last_10m

    2. Vibe Decay: time since last meaningful activity (check-in, rating, emoji pulse).
       After 45-min grace period, score starts shedding 0.5 pts/min, max 25 pts.
       Returns: is_decaying, decay_minutes, decay_points, freshness ("fresh"|"cooling"|"cold")

    No auth required — used on venue cards and detail page.
    """
    now = datetime.now(timezone.utc)

    # ── Crowd Velocity ────────────────────────────────────────────────────────
    win_a_start = now - timedelta(minutes=20)
    win_a_end   = now - timedelta(minutes=10)
    win_b_start = now - timedelta(minutes=10)

    count_a, count_b, fire_recent = await _asyncio_gather(
        db.checkins.count_documents({"venue_id": venue_id, "created_at": {"$gte": win_a_start, "$lt": win_a_end}}),
        db.checkins.count_documents({"venue_id": venue_id, "created_at": {"$gte": win_b_start}}),
        db.venue_emoji_pulses.count_documents({"venue_id": venue_id, "emoji": "fire", "ts": {"$gte": win_b_start}}),
    )

    if count_b > count_a + 1 or (count_b >= 2 and fire_recent >= 3):
        velocity = "rising"
    elif count_a > count_b + 1:
        velocity = "falling"
    else:
        velocity = "flat"

    if count_a > 0:
        velocity_pct = round((count_b - count_a) / count_a * 100)
    elif count_b > 0:
        velocity_pct = 100
    else:
        velocity_pct = 0

    # ── Vibe Decay ────────────────────────────────────────────────────────────
    DECAY_GRACE_MIN = 45
    DECAY_RATE      = 0.5   # pts/min after grace period
    DECAY_MAX       = 25    # cap

    latest_ci, latest_rt, latest_ep = await _asyncio_gather(
        db.checkins.find_one({"venue_id": venue_id}, sort=[("created_at", -1)]),
        db.ratings.find_one({"venue_id": venue_id}, sort=[("timestamp", -1)]),
        db.venue_emoji_pulses.find_one({"venue_id": venue_id}, sort=[("ts", -1)]),
    )

    candidates = []
    if latest_ci and latest_ci.get("created_at"):
        t = latest_ci["created_at"]
        candidates.append(t if t.tzinfo else t.replace(tzinfo=timezone.utc))
    if latest_rt and latest_rt.get("timestamp"):
        t = latest_rt["timestamp"]
        candidates.append(t if t.tzinfo else t.replace(tzinfo=timezone.utc))
    if latest_ep and latest_ep.get("ts"):
        t = latest_ep["ts"]
        candidates.append(t if t.tzinfo else t.replace(tzinfo=timezone.utc))

    is_decaying   = False
    decay_minutes = 0
    decay_points  = 0
    freshness     = "fresh"

    if candidates:
        last_activity  = max(candidates)
        stale_minutes  = (now - last_activity).total_seconds() / 60
        if stale_minutes > DECAY_GRACE_MIN:
            is_decaying   = True
            decay_minutes = stale_minutes - DECAY_GRACE_MIN
            decay_points  = min(round(decay_minutes * DECAY_RATE), DECAY_MAX)
            freshness     = "cold" if decay_minutes > 60 else "cooling"

    return {
        "velocity":        velocity,
        "velocity_pct":    velocity_pct,
        "checkins_last_10m": count_b,
        "is_decaying":     is_decaying,
        "decay_minutes":   round(decay_minutes),
        "decay_points":    decay_points,
        "freshness":       freshness,
    }


async def _asyncio_gather(*coros):
    import asyncio
    return await asyncio.gather(*coros)


@router.get("/scene-report")
async def get_scene_report():
    """
    Last-night scene report: auto-generated from the previous night's data.
    Window: yesterday 7pm UTC → today 3am UTC (approx 8pm–4am WAT).
    Returns top venue, biggest surge, trailblazer scout (first to call it).
    """
    now = datetime.now(timezone.utc)

    # Determine last-night window
    # e.g. if it's 10am UTC, report covers yesterday 19:00 → today 03:00
    today_3am = now.replace(hour=3, minute=0, second=0, microsecond=0)
    if now < today_3am:
        # We're still before 3am UTC — use yesterday's 7pm → today 3am
        report_end = today_3am
        report_start = today_3am - timedelta(hours=8)
    else:
        # After 3am UTC: last night = yesterday 7pm → today 3am
        report_end = today_3am
        report_start = today_3am - timedelta(hours=8)

    # Find top venue by peak score during window
    top_venue_pipeline = [
        {
            "$match": {
                "timestamp": {"$gte": report_start, "$lte": report_end},
            }
        },
        {
            "$group": {
                "_id": "$venue_id",
                "peak_score": {"$max": "$vibe_score"},
                "avg_score": {"$avg": "$vibe_score"},
                "sample_count": {"$sum": 1},
            }
        },
        {"$sort": {"peak_score": -1}},
        {"$limit": 5},
    ]
    top_venues_raw = await db.vibe_snapshots.aggregate(top_venue_pipeline).to_list(5)

    if not top_venues_raw:
        return {
            "available": False,
            "message": "No data for last night yet. Check back tonight.",
            "window_start": report_start.isoformat(),
            "window_end": report_end.isoformat(),
        }

    # Enrich with venue names
    top_venues = []
    for v in top_venues_raw:
        venue_doc = await db.venues.find_one(
            {"id": v["_id"]}, {"_id": 0, "name": 1, "area": 1}
        )
        top_venues.append({
            "venue_id": v["_id"],
            "venue_name": venue_doc.get("name") if venue_doc else v["_id"],
            "area": venue_doc.get("area") if venue_doc else "",
            "peak_score": round(v["peak_score"], 1),
            "avg_score": round(v["avg_score"], 1),
        })

    winner = top_venues[0]

    # Find biggest surge: venue with largest (max_score - min_score) in window
    surge_pipeline = [
        {
            "$match": {
                "timestamp": {"$gte": report_start, "$lte": report_end},
            }
        },
        {
            "$group": {
                "_id": "$venue_id",
                "max_score": {"$max": "$vibe_score"},
                "min_score": {"$min": "$vibe_score"},
            }
        },
        {
            "$addFields": {
                "surge": {"$subtract": ["$max_score", "$min_score"]}
            }
        },
        {"$sort": {"surge": -1}},
        {"$limit": 1},
    ]
    surge_raw = await db.vibe_snapshots.aggregate(surge_pipeline).to_list(1)
    surge_venue = None
    if surge_raw:
        s = surge_raw[0]
        surge_doc = await db.venues.find_one(
            {"id": s["_id"]}, {"_id": 0, "name": 1}
        )
        surge_venue = {
            "venue_id": s["_id"],
            "venue_name": surge_doc.get("name") if surge_doc else s["_id"],
            "surge": round(s["surge"], 1),
            "max_score": round(s["max_score"], 1),
        }

    # Trailblazer: first scout to rate the winning venue in the window
    first_rating = await db.ratings.find_one(
        {
            "venue_id": winner["venue_id"],
            "timestamp": {"$gte": report_start, "$lte": report_end},
        },
        sort=[("timestamp", 1)],
    )
    trailblazer = None
    if first_rating:
        scout_doc = await db.users.find_one(
            {"id": first_rating["user_id"]},
            {"_id": 0, "username": 1, "emoji": 1, "avatar_color": 1},
        )
        if scout_doc:
            trailblazer = {
                "username": scout_doc.get("username"),
                "emoji": scout_doc.get("emoji", "👤"),
            }

    # Format window in WAT
    start_wat = report_start.astimezone(_WAT)
    end_wat = report_end.astimezone(_WAT)
    window_label = f"{start_wat.strftime('%-I%p')}–{end_wat.strftime('%-I%p')} WAT"

    return {
        "available": True,
        "date": report_end.strftime("%A, %d %b"),
        "window_label": window_label,
        "winner": winner,
        "top_venues": top_venues,
        "surge_venue": surge_venue,
        "trailblazer": trailblazer,
        "headline": f"{winner['venue_name']} peaked at {winner['peak_score']}% last night",
    }
