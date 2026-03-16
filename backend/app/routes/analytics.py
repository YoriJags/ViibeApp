"""
VIIBE Internal Analytics
Ingests batched events from the frontend, stores in MongoDB `events` collection.

Designed for PostHog migration: event shape mirrors PostHog's capture() API so
the frontend service can be swapped to posthog.capture() with zero schema change.

Routes:
  POST /analytics/events    — batch event ingestion (authenticated)
  GET  /analytics/summary   — admin event summary by type (super-admin only)
"""
from datetime import datetime, timedelta, timezone
from typing import Optional, Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.config import db, logger
from app.services.auth import require_auth

router = APIRouter(tags=["analytics"])


# ── Models ────────────────────────────────────────────────────────────────────

class AnalyticsEvent(BaseModel):
    event:      str
    properties: dict = {}
    user_id:    Optional[str] = None
    timestamp:  Optional[str] = None     # ISO string from client


class EventBatch(BaseModel):
    events: list[AnalyticsEvent]


# ── Ingest ────────────────────────────────────────────────────────────────────

@router.post("/analytics/events", status_code=204)
async def ingest_events(
    batch: EventBatch,
    user: dict = Depends(require_auth),
):
    """
    Batch event ingestion. Frontend sends up to 10 events per call.
    user_id is always stamped server-side from the auth token — client-supplied
    user_id is accepted as a hint but overridden by server truth.
    """
    if not batch.events:
        return

    now = datetime.now(timezone.utc)
    docs = []
    for ev in batch.events[:50]:  # cap at 50 per batch
        try:
            ts = datetime.fromisoformat(ev.timestamp.replace("Z", "+00:00")) if ev.timestamp else now
        except Exception:
            ts = now

        docs.append({
            "event":      ev.event,
            "user_id":    user["id"],             # always server-authoritative
            "properties": ev.properties,
            "session_id": ev.properties.get("session_id"),
            "platform":   ev.properties.get("platform", "mobile"),
            "city":       user.get("home_city", "lagos"),
            "scout_status": user.get("scout_status", "newbie"),
            "is_vibe_plus": user.get("is_vibe_plus", False),
            "client_ts":  ts,
            "server_ts":  now,
        })

    if docs:
        await db.events.insert_many(docs)

    return  # 204 No Content


# ── Summary (super-admin only) ────────────────────────────────────────────────

@router.get("/analytics/summary")
async def event_summary(
    days: int = 7,
    user: dict = Depends(require_auth),
):
    """Top events by count over the last N days. Super-admin only."""
    if not user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Super-admin only")

    since = datetime.now(timezone.utc) - timedelta(days=days)
    pipeline = [
        {"$match": {"server_ts": {"$gte": since}}},
        {"$group": {
            "_id": "$event",
            "count": {"$sum": 1},
            "unique_users": {"$addToSet": "$user_id"},
        }},
        {"$project": {
            "event": "$_id",
            "count": 1,
            "unique_users": {"$size": "$unique_users"},
            "_id": 0,
        }},
        {"$sort": {"count": -1}},
        {"$limit": 50},
    ]
    results = await db.events.aggregate(pipeline).to_list(50)
    return {"days": days, "events": results}


# ── User-level event history (for DNA / intelligence) ─────────────────────────

async def get_user_events(user_id: str, event_names: list[str], limit: int = 200) -> list[dict]:
    """Internal helper — pull recent events for a specific user."""
    return await db.events.find(
        {"user_id": user_id, "event": {"$in": event_names}},
        {"_id": 0},
    ).sort("server_ts", -1).limit(limit).to_list(limit)
