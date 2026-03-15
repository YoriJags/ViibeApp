"""
Vibe App - Personal Venue Insider Routes
Deep personal stats for a user at a specific venue.
"""
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends

from app.config import db
from app.services.auth import require_auth

router = APIRouter(tags=["insider"])


@router.get("/me/venues/{venue_id}/insider")
async def get_venue_insider(venue_id: str, user: dict = Depends(require_auth)):
    """Return a user's personal insider stats for a specific venue."""
    uid = user["id"]

    # ── Visit count: all ratings + completed checkins ────────────────────────
    ratings_count = await db.ratings.count_documents({"user_id": uid, "venue_id": venue_id})
    checkins_count = await db.checkins.count_documents(
        {"user_id": uid, "venue_id": venue_id, "status": "checked_out"}
    )
    visit_count = ratings_count + checkins_count

    # ── Fetch all ratings sorted oldest → newest ──────────────────────────────
    ratings = await db.ratings.find(
        {"user_id": uid, "venue_id": venue_id},
    ).sort("timestamp", 1).to_list(200)

    # ── first / last visit ────────────────────────────────────────────────────
    first_visit = None
    last_visit  = None
    if ratings:
        ts_first = ratings[0].get("timestamp")
        ts_last  = ratings[-1].get("timestamp")
        if ts_first:
            first_visit = ts_first.isoformat() if isinstance(ts_first, datetime) else ts_first
        if ts_last:
            last_visit = ts_last.isoformat() if isinstance(ts_last, datetime) else ts_last

    # ── score stats ───────────────────────────────────────────────────────────
    scores = [r["vibe_score"] for r in ratings if "vibe_score" in r]
    personal_avg_score = round(sum(scores) / len(scores), 1) if scores else 0.0

    peak_rating = max(ratings, key=lambda r: r.get("vibe_score", 0)) if ratings else None
    peak_score  = peak_rating["vibe_score"] if peak_rating else 0.0
    peak_date   = None
    if peak_rating:
        ts_peak = peak_rating.get("timestamp")
        if ts_peak:
            peak_date = ts_peak.isoformat() if isinstance(ts_peak, datetime) else ts_peak

    # ── last energy (list sorted ascending, -1 is most recent) ───────────────
    last_rating = ratings[-1] if ratings else None
    last_energy = last_rating.get("energy") if last_rating else None

    # ── regularity label ─────────────────────────────────────────────────────
    if visit_count == 0:
        regularity_label = "First Timer"
    elif visit_count <= 2:
        regularity_label = "Occasional"
    elif visit_count <= 6:
        regularity_label = "Regular"
    else:
        regularity_label = "Local Legend"

    # ── visits this month ─────────────────────────────────────────────────────
    month_ago = datetime.now(timezone.utc) - timedelta(days=30)
    visits_this_month = 0
    for r in ratings:
        ts = r.get("timestamp")
        if ts and isinstance(ts, datetime):
            ts_aware = ts if ts.tzinfo is not None else ts.replace(tzinfo=timezone.utc)
            if ts_aware > month_ago:
                visits_this_month += 1

    # ── taste alignment — user already in auth dependency ────────────────────
    user_prefs  = [p.lower() for p in (user.get("music_preferences") or [])]
    venue_doc   = await db.venues.find_one({"id": venue_id})
    venue_genre = (venue_doc.get("music_genre") or "").lower() if venue_doc else ""

    if not user_prefs or not venue_genre:
        taste_alignment = 50
    else:
        match = any(pref in venue_genre or venue_genre in pref for pref in user_prefs)
        taste_alignment = 90 if match else 35

    return {
        "visit_count":        visit_count,
        "first_visit":        first_visit,
        "last_visit":         last_visit,
        "personal_avg_score": personal_avg_score,
        "peak_score":         peak_score,
        "peak_date":          peak_date,
        "taste_alignment":    taste_alignment,
        "regularity_label":   regularity_label,
        "visits_this_month":  visits_this_month,
        "last_energy":        last_energy,
        "total_ratings_here": ratings_count,
    }
