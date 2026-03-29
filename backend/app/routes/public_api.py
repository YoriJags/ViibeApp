"""
Viibe Public Read API — v1
External, API-key-authenticated endpoints for data licensing and partners.

Design principles:
  - Clean response schemas: no internal fields (_id, glow_boost, admin_override_score, etc.)
  - Every score carries full audit provenance (sample_size, confidence, signal_weights)
  - Versioned at /v1/ — backwards-compatible changes only within this version
  - API key required via X-API-Key header
  - Read-only — no mutations exposed

To issue an API key:
  db.api_keys.insert_one({
      "key": "<uuid>",
      "partner": "<partner name>",
      "created_at": datetime.utcnow(),
      "active": True,
      "scopes": ["venues:read", "scores:read", "history:read"],
  })
"""
import hashlib
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Header, Query
from app.config import db

router = APIRouter(prefix="/v1", tags=["public-api-v1"])


# ── API Key authentication dependency ─────────────────────────────────────────

def _hash_api_key(key: str) -> str:
    """SHA-256 hash an API key for secure database lookup."""
    return hashlib.sha256(key.encode()).hexdigest()


async def _require_api_key(x_api_key: str = Header(...)):
    """
    Validate X-API-Key header against the api_keys collection.
    Keys are matched by their SHA-256 hash (key_hash field).
    Legacy plaintext key field is checked as a fallback during migration.
    """
    if not x_api_key:
        raise HTTPException(status_code=401, detail="X-API-Key header required")

    key_hash = _hash_api_key(x_api_key)
    # Primary: hash-based lookup (secure)
    key_doc = await db.api_keys.find_one({"key_hash": key_hash, "active": True})
    if not key_doc:
        # Fallback: plaintext lookup for keys issued before migration
        key_doc = await db.api_keys.find_one({"key": x_api_key, "active": True})
    if not key_doc:
        raise HTTPException(status_code=403, detail="Invalid or inactive API key")
    return key_doc


def _clean_venue(v: dict) -> dict:
    """Strip internal fields and return a clean, licensable venue record."""
    return {
        "id":              v.get("id"),
        "name":            v.get("name"),
        "area":            v.get("area"),
        "city":            v.get("city"),
        "venue_type":      v.get("venue_type"),
        "coordinates":     v.get("coordinates"),
        "current_score":   v.get("current_vibe_score"),
        "energy_level":    v.get("energy_level"),
        "vibe_state":      v.get("vibe_state"),
        "capacity_level":  v.get("capacity_level"),
        "gate_level":      v.get("gate_level"),
        "vibe_velocity":   v.get("vibe_velocity"),
        "score_confidence": v.get("score_confidence"),
        "active_scouts":   v.get("active_scouts"),
        "total_ratings_24h": v.get("total_ratings_24h"),
        "last_rated_mins_ago": v.get("last_rated_mins_ago"),
        "vibe_tier":       v.get("vibe_tier"),
        "avg_score_30d":   v.get("avg_score_30d"),
        "is_open_now":     v.get("is_open_now"),
        "music_genre":     v.get("music_genre"),
        "updated_at":      v.get("last_snapshot_time"),
    }


def _clean_snapshot(s: dict) -> dict:
    """Return a clean, auditable score snapshot record."""
    return {
        "venue_id":               s.get("venue_id"),
        "vibe_score":             s.get("vibe_score"),
        "energy_level":           s.get("energy_level"),
        "capacity_level":         s.get("capacity_level"),
        "gate_level":             s.get("gate_level"),
        "timestamp":              s.get("timestamp"),
        # ── Audit provenance ──────────────────────────────────────────
        "sample_size":            s.get("sample_size", 0),
        "active_scouts":          s.get("active_scouts", 0),
        "score_confidence":       s.get("score_confidence", "low"),
        "total_weight":           s.get("total_weight", 0),
        "submission_window_start": s.get("submission_window_start"),
        "submission_window_end":   s.get("submission_window_end"),
        "fraud_excluded":         s.get("fraud_excluded", 0),
        "decay_protected":        s.get("decay_protected", False),
        "kinetic_momentum":       s.get("kinetic_momentum", 0),
        "signal_weights":         s.get("signal_weights", {}),
        "total_ratings_24h":      s.get("total_ratings_24h", 0),
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/venues")
async def list_venues(
    city: str = Query("lagos", description="City code (e.g. lagos, abuja)"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    min_score: float = Query(0, ge=0, le=100),
    x_api_key: str = Header(...),
):
    """
    List venues with live scores and audit provenance.
    Sorted by current score descending.
    """
    await _require_api_key(x_api_key)

    cursor = db.venues.find(
        {
            "city": city,
            "is_suppressed": {"$ne": True},
            "current_vibe_score": {"$gte": min_score},
        },
        {"_id": 0},
    ).sort("current_vibe_score", -1).skip(offset).limit(limit)

    venues = await cursor.to_list(limit)
    return {
        "api_version": "v1",
        "city": city,
        "count": len(venues),
        "offset": offset,
        "data": [_clean_venue(v) for v in venues],
    }


@router.get("/venues/{venue_id}/score")
async def get_venue_score(
    venue_id: str,
    x_api_key: str = Header(...),
):
    """
    Current live score for a venue with full audit provenance.
    Pulls the most recent vibe_snapshot for the complete metadata record.
    """
    await _require_api_key(x_api_key)

    venue = await db.venues.find_one({"id": venue_id, "is_suppressed": {"$ne": True}}, {"_id": 0})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    # Pull the latest snapshot for full audit trail
    latest_snapshot = await db.vibe_snapshots.find_one(
        {"venue_id": venue_id},
        {"_id": 0},
        sort=[("timestamp", -1)],
    )

    return {
        "api_version": "v1",
        "venue": _clean_venue(venue),
        "score_record": _clean_snapshot(latest_snapshot) if latest_snapshot else None,
    }


@router.get("/venues/{venue_id}/history")
async def get_venue_score_history(
    venue_id: str,
    hours: int = Query(24, ge=1, le=168, description="Hours of history to return (max 7 days)"),
    x_api_key: str = Header(...),
):
    """
    Score history for a venue with per-snapshot audit provenance.
    Each record includes sample_size, confidence, signal_weights, and submission window.
    """
    await _require_api_key(x_api_key)

    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0, "name": 1, "city": 1})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    snapshots = await db.vibe_snapshots.find(
        {"venue_id": venue_id, "timestamp": {"$gte": since}},
        {"_id": 0},
    ).sort("timestamp", 1).to_list(1000)

    return {
        "api_version": "v1",
        "venue_id": venue_id,
        "venue_name": venue.get("name"),
        "city": venue.get("city"),
        "hours_requested": hours,
        "record_count": len(snapshots),
        "data": [_clean_snapshot(s) for s in snapshots],
    }


@router.get("/city/{city}/pulse")
async def get_city_pulse(
    city: str,
    x_api_key: str = Header(...),
):
    """
    City-level aggregate pulse with top venues and energy distribution.
    """
    await _require_api_key(x_api_key)

    venues = await db.venues.find(
        {"city": city, "is_suppressed": {"$ne": True}},
        {"_id": 0, "current_vibe_score": 1, "energy_level": 1, "vibe_state": 1,
         "total_ratings_24h": 1, "area": 1, "id": 1, "name": 1},
    ).to_list(500)

    if not venues:
        raise HTTPException(status_code=404, detail=f"No venues found for city: {city}")

    active = [v for v in venues if v.get("current_vibe_score", 0) > 0]
    city_score = round(
        sum(v["current_vibe_score"] for v in active) / len(active), 1
    ) if active else 0.0

    state_dist: dict = {}
    for v in venues:
        state = v.get("vibe_state", "quiet")
        state_dist[state] = state_dist.get(state, 0) + 1

    top_venues = sorted(active, key=lambda v: v["current_vibe_score"], reverse=True)[:10]

    return {
        "api_version": "v1",
        "city": city,
        "city_score": city_score,
        "active_venues": len(active),
        "total_venues": len(venues),
        "state_distribution": state_dist,
        "top_venues": [
            {
                "id": v.get("id"),
                "name": v.get("name"),
                "area": v.get("area"),
                "score": v.get("current_vibe_score"),
                "state": v.get("vibe_state"),
                "ratings_24h": v.get("total_ratings_24h"),
            }
            for v in top_venues
        ],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
