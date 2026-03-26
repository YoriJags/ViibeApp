"""
VIIBE Agent API — v1

Public endpoint designed for AI agents, assistants, and third-party integrations.
Answers the question: "Where is the best energy right now?"

Authentication: API key via X-Agent-Key header or ?api_key= query param.
Rate limit: 60 requests/minute per key (enforced by RateLimitMiddleware).

Endpoints (public, key-gated):
  GET /api/v1/agent/venues/live       — Top venues by live energy, filterable by city/category
  GET /api/v1/agent/venues/{venue_id} — Single venue energy snapshot
  GET /api/v1/agent/city/pulse        — City-level energy summary

Endpoints (admin only):
  POST /api/v1/agent/keys             — Issue a new API key
  GET  /api/v1/agent/keys             — List all API keys + usage stats
  DELETE /api/v1/agent/keys/{key}     — Revoke a key
"""
import secrets
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel

from app.config import db, logger
from app.services.auth import get_current_user

router = APIRouter(prefix="/v1/agent", tags=["Agent API"])

# ── API key validation ────────────────────────────────────────────────────────

AGENT_API_KEYS_COLLECTION = "agent_api_keys"


async def _validate_api_key(request: Request) -> dict:
    """
    Check X-Agent-Key header or ?api_key= param against the agent_api_keys collection.
    Returns the key document on success, raises 401 on failure.
    """
    key = (
        request.headers.get("X-Agent-Key")
        or request.query_params.get("api_key")
    )
    if not key:
        raise HTTPException(
            status_code=401,
            detail="API key required. Pass X-Agent-Key header or ?api_key= param.",
        )

    record = await db[AGENT_API_KEYS_COLLECTION].find_one(
        {"key": key, "active": True}, {"_id": 0}
    )
    if not record:
        raise HTTPException(status_code=401, detail="Invalid or inactive API key.")

    # Bump usage counter — fire and forget
    await db[AGENT_API_KEYS_COLLECTION].update_one(
        {"key": key},
        {
            "$inc": {"request_count": 1},
            "$set": {"last_used_at": datetime.now(timezone.utc).isoformat()},
        },
    )
    return record


# ── Helpers ───────────────────────────────────────────────────────────────────

def _energy_label(score: float) -> str:
    if score >= 85:
        return "PEAK"
    if score >= 70:
        return "HIGH"
    if score >= 50:
        return "BUILDING"
    if score >= 30:
        return "MODERATE"
    return "LOW"


def _serialize_venue(v: dict) -> dict:
    """Return a clean, agent-friendly venue snapshot."""
    score = v.get("current_vibe_score") or v.get("vibe_score") or 0
    return {
        "id":             v.get("id"),
        "name":           v.get("name"),
        "category":       v.get("category"),
        "city":           v.get("city"),
        "neighbourhood":  v.get("neighbourhood"),
        "energy_score":   round(score, 1),
        "energy_label":   _energy_label(score),
        "active_scouts":  v.get("active_scouts", 0),
        "is_surging":     bool(v.get("is_surging", False)),
        "peak_time":      v.get("peak_time"),
        "music_genre":    v.get("music_genre"),
        "capacity_signal": v.get("capacity_signal"),   # "spacious" | "moderate" | "packed"
        "momentum":        v.get("vibe_velocity"),      # "rising" | "falling" | "stable" | "peaking"
        "consensus_label": v.get("consensus_label"),    # "electric" | "chill" | "mixed" | "insufficient"
        "consensus_rate":  v.get("consensus_rate"),     # 0.0–1.0 agreement score
        "avg_dwell_mins":  v.get("avg_dwell_minutes"),  # how long scouts are staying
        "score_confidence": v.get("score_confidence"),  # "high" | "medium" | "low"
        "last_updated":   v.get("last_activity_at") or v.get("updated_at"),
    }


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/venues/live")
async def get_live_venues(
    request:  Request,
    city:     Optional[str] = Query(None, description="City slug, e.g. 'lagos' or 'dubai'"),
    category: Optional[str] = Query(None, description="Venue category, e.g. 'club', 'lounge', 'concert'"),
    min_score: float        = Query(0,    description="Minimum energy score (0–100)"),
    limit:    int           = Query(10,   ge=1, le=50, description="Number of results (max 50)"),
):
    """
    Returns the top venues by live energy score.

    Designed for AI agents answering: *"Where is the best energy right now?"*

    Response is sorted by energy score descending. Results reflect data from
    the last 5 minutes of scout activity.
    """
    await _validate_api_key(request)

    query: dict = {"current_vibe_score": {"$gte": min_score}}
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    if category:
        query["category"] = {"$regex": category, "$options": "i"}

    venues = await db.venues.find(
        query,
        {
            "_id": 0, "id": 1, "name": 1, "category": 1, "city": 1,
            "neighbourhood": 1, "current_vibe_score": 1, "vibe_score": 1,
            "active_scouts": 1, "is_surging": 1, "peak_time": 1,
            "music_genre": 1, "capacity_signal": 1, "last_activity_at": 1,
            "updated_at": 1,
        },
    ).sort("current_vibe_score", -1).limit(limit).to_list(limit)

    return {
        "query": {
            "city":      city,
            "category":  category,
            "min_score": min_score,
            "limit":     limit,
        },
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "count":  len(venues),
        "venues": [_serialize_venue(v) for v in venues],
        "data_freshness": "real-time (≤5 min)",
        "powered_by": "VIIBE Scene Intelligence — viibez.com",
    }


@router.get("/venues/{venue_id}")
async def get_venue_snapshot(
    venue_id: str,
    request:  Request,
):
    """
    Returns a real-time energy snapshot for a specific venue.

    Useful for agents that know the venue and want a live energy reading.
    """
    await _validate_api_key(request)

    venue = await db.venues.find_one(
        {"id": venue_id},
        {
            "_id": 0, "id": 1, "name": 1, "category": 1, "city": 1,
            "neighbourhood": 1, "current_vibe_score": 1, "vibe_score": 1,
            "active_scouts": 1, "is_surging": 1, "peak_time": 1,
            "music_genre": 1, "capacity_signal": 1, "last_activity_at": 1,
            "updated_at": 1, "address": 1, "description": 1,
        },
    )
    if not venue:
        raise HTTPException(status_code=404, detail=f"Venue '{venue_id}' not found.")

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "venue": _serialize_venue(venue),
        "powered_by": "VIIBE Scene Intelligence — viibez.com",
    }


@router.get("/city/pulse")
async def get_city_pulse(
    request: Request,
    city:    Optional[str] = Query(None, description="City slug, e.g. 'lagos' or 'dubai'"),
):
    """
    Returns a city-level energy summary.

    Useful for agents answering: *"How alive is Dubai right now?"*
    Returns total active scouts, venue count by energy tier, and the top 3 venues.
    """
    await _validate_api_key(request)

    query: dict = {}
    if city:
        query["city"] = {"$regex": city, "$options": "i"}

    venues = await db.venues.find(
        query,
        {"_id": 0, "id": 1, "name": 1, "category": 1, "city": 1,
         "current_vibe_score": 1, "vibe_score": 1, "active_scouts": 1, "is_surging": 1},
    ).to_list(500)

    if not venues:
        return {"city": city, "status": "no_data", "generated_at": datetime.now(timezone.utc).isoformat()}

    scores   = [v.get("current_vibe_score") or v.get("vibe_score") or 0 for v in venues]
    scouts   = sum(v.get("active_scouts", 0) for v in venues)
    surging  = sum(1 for v in venues if v.get("is_surging"))
    avg      = round(sum(scores) / len(scores), 1) if scores else 0

    tiers = {"PEAK": 0, "HIGH": 0, "BUILDING": 0, "MODERATE": 0, "LOW": 0}
    for s in scores:
        tiers[_energy_label(s)] += 1

    top3 = sorted(venues, key=lambda v: v.get("current_vibe_score") or v.get("vibe_score") or 0, reverse=True)[:3]

    return {
        "city":           city or "all",
        "generated_at":   datetime.now(timezone.utc).isoformat(),
        "city_energy":    avg,
        "city_label":     _energy_label(avg),
        "total_venues":   len(venues),
        "active_scouts":  scouts,
        "surging_venues": surging,
        "venue_tiers":    tiers,
        "top_venues":     [_serialize_venue(v) for v in top3],
        "data_freshness": "real-time (≤5 min)",
        "powered_by":     "VIIBE Scene Intelligence — viibez.com",
    }


# ── Admin: API key management ─────────────────────────────────────────────────

class IssueKeyRequest(BaseModel):
    label:       str                   # human name, e.g. "Marriott Dubai Concierge"
    partner:     Optional[str] = None  # company / org name
    rate_limit:  int           = 60    # requests per minute
    notes:       Optional[str] = None


@router.post("/keys")
async def issue_api_key(body: IssueKeyRequest, request: Request):
    """Issue a new Agent API key. Super admin only."""
    user = await get_current_user(request)
    if not user or not user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Super admin access required.")

    key = "viibe_" + secrets.token_urlsafe(32)
    record = {
        "key":           key,
        "label":         body.label,
        "partner":       body.partner,
        "rate_limit":    body.rate_limit,
        "notes":         body.notes,
        "active":        True,
        "request_count": 0,
        "created_at":    datetime.now(timezone.utc).isoformat(),
        "last_used_at":  None,
    }
    await db[AGENT_API_KEYS_COLLECTION].insert_one(record)
    record.pop("_id", None)
    return {"status": "issued", "api_key": record}


@router.get("/keys")
async def list_api_keys(request: Request):
    """List all Agent API keys with usage stats. Super admin only."""
    user = await get_current_user(request)
    if not user or not user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Super admin access required.")

    keys = await db[AGENT_API_KEYS_COLLECTION].find(
        {}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    return {"count": len(keys), "keys": keys}


@router.delete("/keys/{key}")
async def revoke_api_key(key: str, request: Request):
    """Revoke (deactivate) an Agent API key. Super admin only."""
    user = await get_current_user(request)
    if not user or not user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Super admin access required.")

    result = await db[AGENT_API_KEYS_COLLECTION].update_one(
        {"key": key}, {"$set": {"active": False}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Key not found.")
    return {"status": "revoked", "key": key}
