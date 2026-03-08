"""
Resonance — Post-venue quality annotation from scouts.

Resonance is the individual quality signal that sits on top of collective bolt
count. After a scout has been at a venue (submitted a full rating), they can
annotate their session with a 1–5 resonance score:

  1 = Didn't land       — not your scene tonight
  2 = Low vibe          — had its moments
  3 = Decent            — solid but not memorable
  4 = Felt it           — good energy, good time
  5 = Pure resonance    — this one hits different ⚡

Routes:
  POST /api/venues/:venue_id/resonance      — submit resonance score (auth required)
  GET  /api/venues/:venue_id/resonance      — venue's aggregate resonance stats
  GET  /api/me/viibe-score                  — user's personal VIIBE score
"""
import uuid
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from app.config import db
from app.services.auth import require_auth

router = APIRouter(tags=["resonance"])


# ─── Models ──────────────────────────────────────────────────────────────────

class ResonanceCreate(BaseModel):
    score: int = Field(..., ge=1, le=5)
    bolt_count: int = Field(0, ge=0)            # bolts dropped this session
    scene_mood: str | None = None               # scout's scene mood that night


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _night_window() -> datetime:
    """Rolling night window: 5PM → 7AM next day."""
    now = datetime.now(timezone.utc)
    if now.hour < 7:
        base = now - timedelta(days=1)
    else:
        base = now
    return base.replace(hour=17, minute=0, second=0, microsecond=0)


def _night_date_str() -> str:
    """Date string for tonight's night (for deduplication)."""
    start = _night_window()
    return start.strftime("%Y-%m-%d")


# ─── Routes ──────────────────────────────────────────────────────────────────

@router.post("/venues/{venue_id}/resonance")
async def submit_resonance(
    venue_id: str,
    data: ResonanceCreate,
    user: dict = Depends(require_auth),
):
    """Submit a resonance score for a venue visit. One per night per venue."""
    venue = await db.venues.find_one({"id": venue_id})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    user_id = user["id"]
    night_date = _night_date_str()

    # One resonance per user per venue per night
    existing = await db.resonance.find_one({
        "user_id": user_id,
        "venue_id": venue_id,
        "night_date": night_date,
    })
    if existing:
        # Allow update within the same night
        await db.resonance.update_one(
            {"_id": existing["_id"]},
            {"$set": {
                "score": data.score,
                "bolt_count": data.bolt_count,
                "scene_mood": data.scene_mood,
                "updated_at": datetime.now(timezone.utc),
            }},
        )
        doc_id = existing["id"]
    else:
        doc = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "venue_id": venue_id,
            "score": data.score,
            "bolt_count": data.bolt_count,
            "scene_mood": data.scene_mood,
            "night_date": night_date,
            "created_at": datetime.now(timezone.utc),
        }
        await db.resonance.insert_one(doc)
        doc_id = doc["id"]

    # Update venue's rolling resonance aggregate (last 7 days)
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    pipeline = [
        {"$match": {"venue_id": venue_id, "created_at": {"$gte": cutoff}}},
        {"$group": {
            "_id": None,
            "avg_score": {"$avg": "$score"},
            "count": {"$sum": 1},
            "pure_resonance": {"$sum": {"$cond": [{"$eq": ["$score", 5]}, 1, 0]}},
        }},
    ]
    agg = await db.resonance.aggregate(pipeline).to_list(1)
    if agg:
        avg = round(agg[0]["avg_score"], 2)
        count = agg[0]["count"]
        pure = agg[0]["pure_resonance"]
        await db.venues.update_one(
            {"id": venue_id},
            {"$set": {
                "resonance_avg": avg,
                "resonance_count": count,
                "pure_resonance_pct": round(pure / count * 100) if count else 0,
            }},
        )

    return {"id": doc_id, "score": data.score, "night_date": night_date}


@router.get("/venues/{venue_id}/resonance")
async def get_venue_resonance(venue_id: str):
    """Public venue resonance stats — average score + distribution."""
    venue = await db.venues.find_one({"id": venue_id})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    cutoff = datetime.now(timezone.utc) - timedelta(days=7)

    # Score distribution (1–5)
    dist_pipeline = [
        {"$match": {"venue_id": venue_id, "created_at": {"$gte": cutoff}}},
        {"$group": {"_id": "$score", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]
    dist_docs = await db.resonance.aggregate(dist_pipeline).to_list(5)
    distribution = {str(d["_id"]): d["count"] for d in dist_docs}
    total = sum(distribution.values()) if distribution else 0

    return {
        "venue_id": venue_id,
        "avg_score": venue.get("resonance_avg"),
        "total_responses": venue.get("resonance_count", 0),
        "pure_resonance_pct": venue.get("pure_resonance_pct", 0),
        "distribution": distribution,
        "total_7d": total,
    }


@router.get("/me/viibe-score")
async def get_viibe_score(user: dict = Depends(require_auth)):
    """
    Personal VIIBE score — a composite of:
      - Resonance quality (avg resonance score × 20, max 100)
      - Scout consistency (nights out in last 30 days, max 30 pts)
      - Bolt volume (total bolts tonight, max 20 pts)
      - Pure resonance hits (5-star nights, max 10 pts)
    """
    user_id = user["id"]
    now = datetime.now(timezone.utc)
    cutoff_30d = now - timedelta(days=30)
    night_start = _night_window()

    # Resonance quality — last 30 days
    res_pipeline = [
        {"$match": {"user_id": user_id, "created_at": {"$gte": cutoff_30d}}},
        {"$group": {
            "_id": None,
            "avg_score": {"$avg": "$score"},
            "count": {"$sum": 1},
            "pure_count": {"$sum": {"$cond": [{"$eq": ["$score", 5]}, 1, 0]}},
        }},
    ]
    res_agg = await db.resonance.aggregate(res_pipeline).to_list(1)
    avg_res = res_agg[0]["avg_score"] if res_agg else 0
    res_count = res_agg[0]["count"] if res_agg else 0
    pure_count = res_agg[0]["pure_count"] if res_agg else 0

    # Scout consistency — unique nights out in last 30 days
    nights_pipeline = [
        {"$match": {"user_id": user_id, "created_at": {"$gte": cutoff_30d}}},
        {"$group": {"_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}}}},
    ]
    nights_docs = await db.ratings.aggregate(nights_pipeline).to_list(None)
    nights_out = len(nights_docs)

    # Bolt volume tonight
    bolts_tonight = await db.venue_bolts.count_documents({
        "user_id": user_id,
        "created_at": {"$gte": night_start},
    })

    # Compute score components
    quality_pts = min(round(avg_res * 20), 100) if avg_res else 0
    consistency_pts = min(nights_out, 30)
    bolt_pts = min(bolts_tonight * 2, 20)
    pure_pts = min(pure_count * 2, 10)

    viibe_score = quality_pts + consistency_pts + bolt_pts + pure_pts

    # Tier
    if viibe_score >= 120:
        tier, tier_label = "legendary", "Legendary Scout"
    elif viibe_score >= 80:
        tier, tier_label = "elite", "Elite Scout"
    elif viibe_score >= 50:
        tier, tier_label = "active", "Active Scout"
    elif viibe_score >= 20:
        tier, tier_label = "rising", "Rising Scout"
    else:
        tier, tier_label = "new", "New Scout"

    return {
        "viibe_score": viibe_score,
        "tier": tier,
        "tier_label": tier_label,
        "components": {
            "quality": quality_pts,
            "consistency": consistency_pts,
            "bolts_tonight": bolt_pts,
            "pure_resonance": pure_pts,
        },
        "stats": {
            "avg_resonance": round(avg_res, 2) if avg_res else None,
            "resonance_count": res_count,
            "pure_resonance_nights": pure_count,
            "nights_out_30d": nights_out,
            "bolts_tonight": bolts_tonight,
        },
    }
