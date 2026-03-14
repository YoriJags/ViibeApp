"""
Quest Timeline — scheduled collective venue boost challenges.

Admin schedules quests ahead of time so users can anticipate and plan around them.
Active quests weigh into venue category ranking: completing a quest bumps the venue
to the top of its category list for 2 hours.

Quest lifecycle:
  scheduled → active (auto at scheduled_at) → completed / failed (auto when window closes)

Routes:
  GET  /quest-timeline              — upcoming + active quests for a city
  GET  /quest-timeline/venue/{id}   — quests for a specific venue
  POST /quest-timeline              — schedule a quest (admin only)
  POST /quest-timeline/{id}/activate — manually activate a scheduled quest
  POST /quest-timeline/{id}/complete — mark completed (called by collective-quest logic)
"""
import uuid
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from app.config import db
from app.services.auth import require_auth

router = APIRouter(tags=["quest_timeline"])

QUEST_WINDOW_MINUTES = 45  # how long each quest stays active


def _serialize_quest(q: dict) -> dict:
    """Convert a quest document to a JSON-safe dict."""
    now = datetime.now(timezone.utc)

    scheduled_at = q.get("scheduled_at")
    if scheduled_at and isinstance(scheduled_at, str):
        scheduled_at = datetime.fromisoformat(scheduled_at)

    starts_in_seconds = None
    seconds_remaining = None
    status = q.get("status", "scheduled")

    if status == "scheduled" and scheduled_at:
        diff = (scheduled_at - now).total_seconds()
        starts_in_seconds = max(0, int(diff))
        if starts_in_seconds == 0:
            # Auto-activate
            status = "active"

    if status == "active" and scheduled_at:
        ends_at = scheduled_at + timedelta(minutes=QUEST_WINDOW_MINUTES)
        diff = (ends_at - now).total_seconds()
        seconds_remaining = max(0, int(diff))
        if seconds_remaining == 0:
            status = "failed" if q.get("achieved", False) is False else "completed"

    return {
        "id": q["id"],
        "venue_id": q["venue_id"],
        "venue_name": q.get("venue_name", "Unknown"),
        "venue_area": q.get("venue_area", ""),
        "venue_type": q.get("venue_type", "club"),
        "city": q.get("city", "lagos"),
        "target_score": q.get("target_score", 85),
        "current_score": q.get("current_score", 0),
        "category": q.get("category", ""),  # e.g. "Top Clubs VI" — rank boost target
        "reward_label": q.get("reward_label", "1.5× Clout"),
        "ranking_boost": q.get("ranking_boost", True),
        "status": status,
        "scheduled_at": scheduled_at.isoformat() if scheduled_at else None,
        "starts_in_seconds": starts_in_seconds,
        "seconds_remaining": seconds_remaining,
        "achieved": q.get("achieved", False),
        "participant_count": q.get("participant_count", 0),
    }


@router.get("/quest-timeline")
async def get_quest_timeline(city: str = Query("lagos"), limit: int = Query(10)):
    """
    Returns upcoming + active quests for a city.
    Sorted by: active first, then soonest scheduled_at.
    """
    now = datetime.now(timezone.utc)
    cutoff_past = now - timedelta(minutes=QUEST_WINDOW_MINUTES + 5)

    quests = await db.quest_schedule.find(
        {
            "city": city,
            "status": {"$in": ["scheduled", "active"]},
            "scheduled_at": {"$gte": cutoff_past},
        },
        {"_id": 0},
    ).sort("scheduled_at", 1).limit(limit).to_list(limit)

    serialized = [_serialize_quest(q) for q in quests]

    # Sort: active first, then by starts_in_seconds
    serialized.sort(key=lambda q: (
        0 if q["status"] == "active" else 1,
        q.get("starts_in_seconds") or 999999,
    ))

    return {"quests": serialized}


@router.get("/quest-timeline/venue/{venue_id}")
async def get_venue_quests(venue_id: str):
    """Upcoming and active quests for a specific venue."""
    now = datetime.now(timezone.utc)
    cutoff_past = now - timedelta(minutes=QUEST_WINDOW_MINUTES + 5)

    quests = await db.quest_schedule.find(
        {
            "venue_id": venue_id,
            "status": {"$in": ["scheduled", "active"]},
            "scheduled_at": {"$gte": cutoff_past},
        },
        {"_id": 0},
    ).sort("scheduled_at", 1).limit(5).to_list(5)

    return {"quests": [_serialize_quest(q) for q in quests]}


@router.post("/quest-timeline")
async def schedule_quest(body: dict, user: dict = Depends(require_auth)):
    """
    Schedule a collective quest (admin only).
    Body: venue_id, scheduled_at (ISO string), target_score, category, reward_label
    """
    if user.get("role") not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Admin only")

    venue_id = body.get("venue_id")
    if not venue_id:
        raise HTTPException(status_code=400, detail="venue_id required")

    venue = await db.venues.find_one({"id": venue_id})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    try:
        scheduled_at = datetime.fromisoformat(body["scheduled_at"])
    except (KeyError, ValueError):
        raise HTTPException(status_code=400, detail="scheduled_at must be ISO datetime")

    if scheduled_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="scheduled_at must be in the future")

    doc = {
        "id": str(uuid.uuid4())[:10],
        "venue_id": venue_id,
        "venue_name": venue["name"],
        "venue_area": venue.get("area", ""),
        "venue_type": venue.get("venue_type", "club"),
        "city": venue.get("city", "lagos"),
        "target_score": body.get("target_score", 85),
        "current_score": venue.get("current_vibe_score", 0),
        "category": body.get("category", ""),
        "reward_label": body.get("reward_label", "1.5× Clout"),
        "ranking_boost": body.get("ranking_boost", True),
        "status": "scheduled",
        "scheduled_at": scheduled_at,
        "achieved": False,
        "participant_count": 0,
        "created_by": user["id"],
        "created_at": datetime.now(timezone.utc),
    }
    await db.quest_schedule.insert_one(doc)
    return {"quest": _serialize_quest(doc)}


@router.post("/quest-timeline/{quest_id}/activate")
async def activate_quest(quest_id: str, user: dict = Depends(require_auth)):
    """Manually activate a scheduled quest (admin)."""
    if user.get("role") not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Admin only")

    quest = await db.quest_schedule.find_one({"id": quest_id})
    if not quest:
        raise HTTPException(status_code=404, detail="Quest not found")

    await db.quest_schedule.update_one(
        {"id": quest_id},
        {"$set": {"status": "active", "scheduled_at": datetime.now(timezone.utc)}},
    )
    updated = await db.quest_schedule.find_one({"id": quest_id}, {"_id": 0})
    return {"quest": _serialize_quest(updated)}


@router.post("/quest-timeline/{quest_id}/complete")
async def complete_quest(quest_id: str, body: dict = {}):
    """
    Mark a quest as completed/failed and apply ranking boost.
    Called by the collective-quest polling logic or manually.
    """
    achieved = body.get("achieved", False)
    participant_count = body.get("participant_count", 0)

    quest = await db.quest_schedule.find_one({"id": quest_id})
    if not quest:
        raise HTTPException(status_code=404, detail="Quest not found")

    await db.quest_schedule.update_one(
        {"id": quest_id},
        {"$set": {
            "status": "completed" if achieved else "failed",
            "achieved": achieved,
            "participant_count": participant_count,
            "completed_at": datetime.now(timezone.utc),
        }},
    )

    # Apply ranking boost: set spotlight_until on the venue for 2 hours
    if achieved and quest.get("ranking_boost"):
        spotlight_until = datetime.now(timezone.utc) + timedelta(hours=2)
        await db.venues.update_one(
            {"id": quest["venue_id"]},
            {"$set": {"spotlight_until": spotlight_until}},
        )

    return {"status": "completed" if achieved else "failed"}
