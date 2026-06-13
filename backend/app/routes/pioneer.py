"""
First Spark / Pioneer — orchestration + endpoints.

Wires the pure pioneer core (services/pioneer.py) to Mongo:
  - claim_pioneer_if_first(): called from the rating path; first scout to call a
    venue tonight claims it and gets outsized clout.
  - resolve_pioneers(): called from the score-broadcast path; when a venue heats
    up, the pending claim is vindicated into bonus clout + a permanent badge.
  - GET endpoints to surface the pioneer + a scout's badge.

A "night" is keyed noon→noon (an evening that runs past midnight is one night).
The unique gate is the single pending claim per (venue_id, night); on a dead
venue concurrency is ~nil, so the find-then-insert race is acceptable.
"""
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Header, HTTPException
from typing import Optional

from app.config import db, logger
from app.services.pioneer import (
    evaluate_pioneer,
    is_vindicated,
    vindication_reward,
    badge_tier,
)

router = APIRouter(tags=["pioneer"])

CLAIMS = "pioneer_claims"


def _night_key(now: datetime) -> str:
    """The date the current night started (noon boundary)."""
    anchor = now if now.hour >= 12 else now - timedelta(days=1)
    return anchor.strftime("%Y-%m-%d")


# ─── Orchestration (called from hooks) ────────────────────────────────────────

async def claim_pioneer_if_first(
    venue_id: str,
    scout_id: str,
    venue_score: float,
    now: Optional[datetime] = None,
) -> Optional[dict]:
    """First verified call at this venue tonight → create the pioneer claim and
    award outsized clout. No-op (returns None) if already claimed."""
    if not venue_id or not scout_id:
        return None
    now = now or datetime.now(timezone.utc)
    night = _night_key(now)

    existing = await db[CLAIMS].find_one({"venue_id": venue_id, "night": night})
    outcome = evaluate_pioneer(
        prior_presence_tonight=1 if existing else 0,
        already_claimed=existing is not None,
    )
    if not outcome.is_pioneer:
        return None

    score = round(venue_score or 0, 1)
    claim = {
        "venue_id":      venue_id,
        "scout_id":      scout_id,
        "night":         night,
        "claimed_at":    now,
        "claim_score":   score,
        "peak_score":    score,
        "status":        "pending",
        "clout_awarded": outcome.clout_awarded,
        "resolved_at":   None,
    }
    try:
        await db[CLAIMS].insert_one(claim)
    except Exception:
        return None  # lost the race — someone claimed first

    await db.users.update_one(
        {"id": scout_id}, {"$inc": {"clout_points": outcome.clout_awarded}}
    )
    logger.info(f"Pioneer claimed: {venue_id} night {night} +{outcome.clout_awarded} clout")
    claim.pop("_id", None)
    return claim


async def resolve_pioneers(
    venue_id: str,
    current_score: float,
    now: Optional[datetime] = None,
) -> None:
    """Track the venue's peak tonight and vindicate the pending pioneer claim
    once it heats up. Safe to call on every score update."""
    if not venue_id:
        return
    now = now or datetime.now(timezone.utc)
    night = _night_key(now)

    claim = await db[CLAIMS].find_one(
        {"venue_id": venue_id, "night": night, "status": "pending"}
    )
    if not claim:
        return

    peak = round(max(claim.get("peak_score", 0), current_score or 0), 1)
    if peak != claim.get("peak_score"):
        await db[CLAIMS].update_one({"_id": claim["_id"]}, {"$set": {"peak_score": peak}})

    if is_vindicated(claim["claim_score"], peak):
        bonus = vindication_reward(claim["claim_score"], peak)
        await db[CLAIMS].update_one(
            {"_id": claim["_id"]},
            {"$set": {
                "status":           "vindicated",
                "resolved_at":      now,
                "peak_score":       peak,
                "vindication_clout": bonus,
            }},
        )
        await db.users.update_one(
            {"id": claim["scout_id"]},
            {"$inc": {"clout_points": bonus, "pioneer_vindications": 1}},
        )
        logger.info(f"Pioneer vindicated: {venue_id} scout {claim['scout_id']} +{bonus} clout")


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/venues/{venue_id}/pioneer")
async def get_venue_pioneer(venue_id: str):
    """Who called this venue tonight, and did the call pay off."""
    now = datetime.now(timezone.utc)
    night = _night_key(now)
    claim = await db[CLAIMS].find_one(
        {"venue_id": venue_id, "night": night}, {"_id": 0}
    )
    return {"venue_id": venue_id, "night": night, "pioneer": claim}


@router.get("/scouts/{scout_id}/pioneer-badge")
async def get_pioneer_badge(scout_id: str):
    """A scout's permanent 'I called it' badge from lifetime vindicated calls."""
    vindications = await db[CLAIMS].count_documents(
        {"scout_id": scout_id, "status": "vindicated"}
    )
    pending = await db[CLAIMS].count_documents(
        {"scout_id": scout_id, "status": "pending"}
    )
    return {
        "scout_id":     scout_id,
        "vindications": vindications,
        "pending":      pending,
        "badge":        badge_tier(vindications),
    }
