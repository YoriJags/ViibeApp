"""
Viibe - Passive Venue Onboarding Pipeline

Venues exist in the system BEFORE they know about Viibe.
Scouts can rate them from day one. When we approach a venue, we show them
their own data: "Here's 6 weeks of scout ratings at your location."

Design:
  - Bulk-ingest venues from coordinate + public data (Google Places, OSM, manual)
  - Duplicates detected by coordinate proximity (50m) OR name+area match
  - All seeded venues start as: claim_status="unclaimed", is_verified=False
  - Scouts can rate immediately — no merchant action required
  - Merchant claim flow unchanged (claims.py) — venue just already exists

Admin-only. Requires is_admin or is_super_admin on the requesting user.
"""
import uuid
from datetime import datetime, timezone
from math import radians, sin, cos, sqrt, atan2
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from app.config import db

router = APIRouter(tags=["venue-seeder"])

DEDUP_RADIUS_M = 50  # venues within 50m of same name are considered duplicates


class VenueSeedItem(BaseModel):
    name: str
    address: str
    area: str
    city: str = "lagos"
    venue_type: str = "other"
    lat: float
    lng: float
    music_genre: Optional[str] = None
    source: Optional[str] = None  # e.g. "google_places", "osm", "manual"
    external_id: Optional[str] = None  # external system ID for dedup tracking


class VenueSeedRequest(BaseModel):
    venues: list[VenueSeedItem]


def _haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371000
    phi1, phi2 = radians(lat1), radians(lat2)
    dphi = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    a = sin(dphi / 2) ** 2 + cos(phi1) * cos(phi2) * sin(dlng / 2) ** 2
    return R * 2 * atan2(sqrt(a), sqrt(1 - a))


async def _is_duplicate(name: str, area: str, city: str, lat: float, lng: float) -> bool:
    """
    Check for an existing venue by:
      1. Name + area match (case-insensitive) in same city
      2. Coordinate proximity within DEDUP_RADIUS_M
    """
    # Name + area match
    existing = await db.venues.find_one({
        "city": city,
        "name": {"$regex": f"^{name}$", "$options": "i"},
        "area": {"$regex": f"^{area}$", "$options": "i"},
    })
    if existing:
        return True

    # Coordinate proximity — check venues in city within bounding box first
    lat_delta = DEDUP_RADIUS_M / 111320
    lng_delta = DEDUP_RADIUS_M / (111320 * cos(radians(lat)))
    nearby = await db.venues.find({
        "city": city,
        "coordinates.lat": {"$gte": lat - lat_delta, "$lte": lat + lat_delta},
        "coordinates.lng": {"$gte": lng - lng_delta, "$lte": lng + lng_delta},
    }).to_list(20)

    for v in nearby:
        coords = v.get("coordinates", {})
        dist = _haversine_m(lat, lng, coords.get("lat", 0), coords.get("lng", 0))
        if dist <= DEDUP_RADIUS_M:
            return True

    return False


@router.post("/admin/venues/seed")
async def seed_venues(payload: VenueSeedRequest, request: Request):
    """
    Bulk-seed venues as unclaimed records from external data sources.
    Scouts can rate them immediately. Merchants claim them later via /api/claims.

    Returns a summary of inserted vs skipped (duplicates).
    """
    user_id = request.headers.get("X-User-Id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    user = await db.users.find_one({"id": user_id})
    if not user or not (user.get("is_admin") or user.get("is_super_admin")):
        raise HTTPException(status_code=403, detail="Admin access required")

    inserted = []
    skipped = []
    now = datetime.now(timezone.utc)

    for item in payload.venues:
        if await _is_duplicate(item.name, item.area, item.city, item.lat, item.lng):
            skipped.append({"name": item.name, "reason": "duplicate"})
            continue

        venue_doc = {
            "id":           str(uuid.uuid4()),
            "name":         item.name,
            "address":      item.address,
            "area":         item.area,
            "city":         item.city,
            "venue_type":   item.venue_type,
            "coordinates":  {"lat": item.lat, "lng": item.lng},
            "music_genre":  item.music_genre,
            # ── Passive onboarding state ──────────────────────────────
            "claim_status":  "unclaimed",
            "is_verified":   False,
            "is_featured":   False,
            "viibe_certified": False,
            # ── Seed provenance ───────────────────────────────────────
            "seeded_from":   item.source or "manual",
            "external_id":   item.external_id,
            "seeded_at":     now,
            "seeded_by":     user_id,
            # ── Defaults ─────────────────────────────────────────────
            "current_vibe_score": 0.0,
            "energy_level":  "quiet",
            "vibe_state":    "quiet",
            "capacity_level": "sparse",
            "gate_level":    "clear",
            "vibe_velocity": "stable",
            "total_ratings_24h": 0,
            "glow_boost":    0,
            "geofence_radius_m": 100,
            "created_at":    now,
        }

        await db.venues.insert_one(venue_doc)
        inserted.append({"name": item.name, "id": venue_doc["id"]})

    return {
        "inserted": len(inserted),
        "skipped":  len(skipped),
        "venues":   inserted,
        "duplicates": skipped,
    }


@router.get("/admin/venues/unclaimed")
async def list_unclaimed_venues(
    city: str = "lagos",
    limit: int = 50,
    offset: int = 0,
    request: Request = None,
):
    """
    List unclaimed venues with their accumulated scout data.
    Use this to identify which venues are ready to approach with a data pitch.
    """
    user_id = request.headers.get("X-User-Id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    user = await db.users.find_one({"id": user_id})
    if not user or not (user.get("is_admin") or user.get("is_super_admin")):
        raise HTTPException(status_code=403, detail="Admin access required")

    venues = await db.venues.find(
        {"city": city, "claim_status": "unclaimed"},
        {"_id": 0},
    ).sort("total_ratings_24h", -1).skip(offset).limit(limit).to_list(limit)

    # Enrich each with snapshot count (weeks of data accumulated)
    result = []
    for v in venues:
        snapshot_count = await db.vibe_snapshots.count_documents({"venue_id": v["id"]})
        result.append({
            "id":               v.get("id"),
            "name":             v.get("name"),
            "area":             v.get("area"),
            "venue_type":       v.get("venue_type"),
            "seeded_from":      v.get("seeded_from"),
            "seeded_at":        v.get("seeded_at"),
            "total_ratings_24h": v.get("total_ratings_24h", 0),
            "snapshot_count":   snapshot_count,
            "current_score":    v.get("current_vibe_score", 0),
            "vibe_tier":        v.get("vibe_tier"),
        })

    return {
        "city":  city,
        "count": len(result),
        "data":  result,
    }
