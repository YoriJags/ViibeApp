"""
Venue Live — Merchant push blasts, "Heading There" intent, Venue Follow.

Routes:
  POST   /api/venues/:id/live-push        merchant sends a live blast to followers + nearby
  GET    /api/venues/:id/live-pushes      recent pushes for a venue (public feed)
  POST   /api/venues/:id/heading          user taps "I'm heading there"
  DELETE /api/venues/:id/heading          user cancels heading
  GET    /api/venues/:id/heading-count    how many people are heading there right now
  POST   /api/venues/:id/follow           follow a venue
  DELETE /api/venues/:id/follow           unfollow a venue
  GET    /api/venues/me/following         all venues the current user follows
  GET    /api/venues/following/feed       live-push feed from followed venues
"""
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional
from app.config import db, logger, sio
from app.services.notifications import send_push_notification
from app.services.attribution import (
    IntentFunnel,
    ArrivalStats,
    assemble_report,
    AVG_SPEND_NGN,
)

router = APIRouter()

# ─── helpers ──────────────────────────────────────────────────────────────────

async def _require_user(authorization: str) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ")[1]
    user = await db.users.find_one({"token": token})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    return user

async def _require_merchant_for_venue(user: dict, venue_id: str) -> dict:
    venue = await db.venues.find_one({"id": venue_id})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")
    if venue.get("owner_id") != user["id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not your venue")
    return venue

def _now() -> datetime:
    return datetime.now(timezone.utc)

# ─── schemas ──────────────────────────────────────────────────────────────────

class LivePushRequest(BaseModel):
    message: str          # "Floor is packed, DJ just dropped — free entry till 1am"
    venue_type: Optional[str] = None  # optional override; defaults to venue.category

# ─── MERCHANT: SEND LIVE PUSH ─────────────────────────────────────────────────

@router.post("/venues/{venue_id}/live-push")
async def send_live_push(
    venue_id: str,
    body: LivePushRequest,
    authorization: str = Header(default=""),
):
    user = await _require_user(authorization)
    venue = await _require_merchant_for_venue(user, venue_id)

    if not body.message or not body.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    if len(body.message) > 500:
        raise HTTPException(status_code=400, detail="Message too long (max 500 chars)")

    # Rate-limit: max 1 push per 30 minutes per venue
    recent = await db.venue_live_pushes.find_one({
        "venue_id": venue_id,
        "sent_at": {"$gte": _now() - timedelta(minutes=30)},
    })
    if recent:
        raise HTTPException(
            status_code=429,
            detail="You can only send one live update every 30 minutes"
        )

    venue_name = venue.get("name", "A venue")
    venue_category = body.venue_type or venue.get("category", "venue")

    # Persist the push
    push_doc = {
        "venue_id": venue_id,
        "venue_name": venue_name,
        "venue_category": venue_category,
        "merchant_id": user["id"],
        "message": body.message.strip(),
        "sent_at": _now(),
        "heading_count": 0,  # will grow as users tap "heading there"
    }
    result = await db.venue_live_pushes.insert_one(push_doc)
    push_id = str(result.inserted_id)

    # ── notify followers ──────────────────────────────────────────────────────
    followers = await db.venue_follows.find({"venue_id": venue_id}).to_list(2000)
    follower_ids = {f["user_id"] for f in followers}

    sent = 0
    for fid in follower_ids:
        ok = await send_push_notification(
            user_id=fid,
            title=f"🔥 {venue_name} is live",
            body=body.message.strip(),
            data={
                "type": "venue_live_push",
                "venue_id": venue_id,
                "push_id": push_id,
                "venue_name": venue_name,
            },
        )
        if ok:
            sent += 1

    # ── Socket.IO real-time broadcast (in-app) ─────────────────────────────────
    await sio.emit("venue_live_push", {
        "venue_id": venue_id,
        "venue_name": venue_name,
        "venue_category": venue_category,
        "message": body.message.strip(),
        "push_id": push_id,
        "sent_at": _now().isoformat(),
    })

    logger.info(f"Live push from venue {venue_id}: {sent} push notifications sent")

    return {
        "success": True,
        "push_id": push_id,
        "notifications_sent": sent,
        "followers_reached": len(follower_ids),
    }


# ─── PUBLIC: GET RECENT LIVE PUSHES FOR A VENUE ───────────────────────────────

@router.get("/venues/{venue_id}/live-pushes")
async def get_venue_live_pushes(venue_id: str, limit: int = 5):
    venue = await db.venues.find_one({"id": venue_id})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    cutoff = _now() - timedelta(hours=6)  # only show last 6 hours
    pushes = await db.venue_live_pushes.find(
        {"venue_id": venue_id, "sent_at": {"$gte": cutoff}},
        {"_id": 0}
    ).sort("sent_at", -1).limit(limit).to_list(limit)

    for p in pushes:
        if isinstance(p.get("sent_at"), datetime):
            p["sent_at"] = p["sent_at"].isoformat()

    return {"pushes": pushes}


# ─── PUBLIC: FOLLOWING FEED ───────────────────────────────────────────────────

@router.get("/venues/following/feed")
async def get_following_feed(
    limit: int = 20,
    authorization: str = Header(default=""),
):
    user = await _require_user(authorization)

    follows = await db.venue_follows.find({"user_id": user["id"]}).to_list(500)
    venue_ids = [f["venue_id"] for f in follows]

    if not venue_ids:
        return {"pushes": [], "followed_count": 0}

    cutoff = _now() - timedelta(hours=12)
    pushes = await db.venue_live_pushes.find(
        {"venue_id": {"$in": venue_ids}, "sent_at": {"$gte": cutoff}},
        {"_id": 0}
    ).sort("sent_at", -1).limit(limit).to_list(limit)

    for p in pushes:
        if isinstance(p.get("sent_at"), datetime):
            p["sent_at"] = p["sent_at"].isoformat()

    return {"pushes": pushes, "followed_count": len(venue_ids)}


# ─── HEADING THERE ────────────────────────────────────────────────────────────

class IntentRequest(BaseModel):
    status: str  # "enroute" | "maybe" | "pass"

VALID_INTENTS = {"enroute", "maybe", "pass"}

async def _get_intent_counts(venue_id: str) -> dict:
    now = _now()
    pipeline = [
        {"$match": {"venue_id": venue_id, "expires_at": {"$gt": now}}},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}},
    ]
    rows = await db.venue_headings.aggregate(pipeline).to_list(10)
    counts = {"enroute": 0, "maybe": 0, "pass": 0}
    for row in rows:
        if row["_id"] in counts:
            counts[row["_id"]] = row["count"]
    return counts


@router.post("/venues/{venue_id}/heading")
async def set_heading(
    venue_id: str,
    body: IntentRequest,
    authorization: str = Header(default=""),
):
    user = await _require_user(authorization)

    if body.status not in VALID_INTENTS:
        raise HTTPException(status_code=400, detail=f"status must be one of: {sorted(VALID_INTENTS)}")

    venue = await db.venues.find_one({"id": venue_id})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    expires = _now() + timedelta(hours=3)

    await db.venue_headings.update_one(
        {"user_id": user["id"], "venue_id": venue_id},
        {"$set": {
            "user_id": user["id"],
            "venue_id": venue_id,
            "status": body.status,
            "created_at": _now(),
            "expires_at": expires,
        }},
        upsert=True,
    )

    counts = await _get_intent_counts(venue_id)
    await sio.emit("heading_update", {"venue_id": venue_id, **counts})
    return {"success": True, **counts}


@router.delete("/venues/{venue_id}/heading")
async def cancel_heading(
    venue_id: str,
    authorization: str = Header(default=""),
):
    user = await _require_user(authorization)
    await db.venue_headings.delete_one({"user_id": user["id"], "venue_id": venue_id})
    counts = await _get_intent_counts(venue_id)
    await sio.emit("heading_update", {"venue_id": venue_id, **counts})
    return {"success": True, **counts}


@router.get("/venues/{venue_id}/heading-count")
async def get_heading_count(venue_id: str):
    counts = await _get_intent_counts(venue_id)
    return {"venue_id": venue_id, **counts}


# ─── FOLLOW / UNFOLLOW ────────────────────────────────────────────────────────

@router.post("/venues/{venue_id}/follow")
async def follow_venue(
    venue_id: str,
    authorization: str = Header(default=""),
):
    user = await _require_user(authorization)

    venue = await db.venues.find_one({"id": venue_id})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    existing = await db.venue_follows.find_one({"user_id": user["id"], "venue_id": venue_id})
    if existing:
        return {"success": True, "following": True, "message": "Already following"}

    await db.venue_follows.insert_one({
        "user_id": user["id"],
        "venue_id": venue_id,
        "venue_name": venue.get("name", ""),
        "venue_category": venue.get("category", ""),
        "created_at": _now(),
    })

    count = await db.venue_follows.count_documents({"venue_id": venue_id})
    return {"success": True, "following": True, "followers": count}


@router.delete("/venues/{venue_id}/follow")
async def unfollow_venue(
    venue_id: str,
    authorization: str = Header(default=""),
):
    user = await _require_user(authorization)
    await db.venue_follows.delete_one({"user_id": user["id"], "venue_id": venue_id})
    count = await db.venue_follows.count_documents({"venue_id": venue_id})
    return {"success": True, "following": False, "followers": count}


@router.get("/venues/me/following")
async def get_following(authorization: str = Header(default="")):
    user = await _require_user(authorization)

    follows = await db.venue_follows.find(
        {"user_id": user["id"]},
        {"_id": 0, "venue_id": 1, "venue_name": 1, "venue_category": 1, "created_at": 1}
    ).to_list(500)

    venue_ids = [f["venue_id"] for f in follows]

    # Enrich with live venue data
    venues = []
    if venue_ids:
        raw = await db.venues.find({"id": {"$in": venue_ids}}).to_list(500)
        venues = [
            {
                "id": v.get("id"),
                "name": v.get("name"),
                "category": v.get("category"),
                "vibe_score": v.get("vibe_score", 0),
                "energy_level": v.get("energy_level", "quiet"),
                "district": v.get("district", ""),
                "city": v.get("city", "Lagos"),
            }
            for v in raw
        ]

    return {"following": venues, "count": len(venues)}


# ─── CHECK FOLLOW STATUS ──────────────────────────────────────────────────────

@router.get("/venues/{venue_id}/follow-status")
async def get_follow_status(
    venue_id: str,
    authorization: str = Header(default=""),
):
    if not authorization or not authorization.startswith("Bearer "):
        return {"following": False}
    token = authorization.split(" ")[1]
    user = await db.users.find_one({"token": token})
    if not user:
        return {"following": False}

    existing = await db.venue_follows.find_one({"user_id": user["id"], "venue_id": venue_id})
    follower_count = await db.venue_follows.count_documents({"venue_id": venue_id})
    heading_count = await db.venue_headings.count_documents({
        "venue_id": venue_id,
        "expires_at": {"$gt": _now()},
    })
    return {
        "following": existing is not None,
        "followers": follower_count,
        "heading_count": heading_count,
    }


# ─── MERCHANT: BLAST ATTRIBUTION ─────────────────────────────────────────────

AVG_SPEND_NGN = 8_000  # estimated avg spend per verified visit

@router.get("/merchant/venues/{venue_id}/blast-attribution")
async def get_blast_attribution(
    venue_id: str,
    authorization: str = Header(None),
):
    """
    Attribution dashboard: for each blast sent, how many scouts visited within
    2 hours, and what's the estimated revenue impact.
    Powers the investor ROI story: "Your blast drove 23 verified visits = ₦184,000."
    """
    user = await _require_user(authorization)
    if user.get("merchant_venue_id") != venue_id and not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Not your venue")

    blasts = await db.venue_live_pushes.find(
        {"venue_id": venue_id},
        {"_id": 0},
    ).sort("sent_at", -1).limit(10).to_list(10)

    results = []
    for blast in blasts:
        sent_at = blast.get("sent_at")
        if isinstance(sent_at, str):
            sent_at = datetime.fromisoformat(sent_at.replace("Z", "+00:00"))
        if not sent_at:
            continue
        window_end = sent_at + timedelta(hours=2)

        # Count unique scouts who rated this venue in the 2h window after blast
        post_blast_pipeline = [
            {"$match": {
                "venue_id": venue_id,
                "timestamp": {"$gte": sent_at, "$lte": window_end},
            }},
            {"$group": {"_id": "$user_id"}},
            {"$count": "unique_visits"},
        ]
        result = await db.ratings.aggregate(post_blast_pipeline).to_list(1)
        unique_visits = result[0]["unique_visits"] if result else 0

        followers_reached = blast.get("followers_reached", blast.get("heading_count", 0))
        conversion_rate = round((unique_visits / followers_reached * 100), 1) if followers_reached > 0 else 0
        estimated_revenue = unique_visits * AVG_SPEND_NGN

        results.append({
            "blast_id": str(blast.get("_id", "")),
            "message": blast.get("message", ""),
            "sent_at": sent_at.isoformat(),
            "followers_reached": followers_reached,
            "visits_2h": unique_visits,
            "conversion_rate": conversion_rate,
            "estimated_revenue_ngn": estimated_revenue,
        })

    total_visits = sum(r["visits_2h"] for r in results)
    total_revenue = sum(r["estimated_revenue_ngn"] for r in results)
    avg_conversion = round(sum(r["conversion_rate"] for r in results) / len(results), 1) if results else 0

    return {
        "venue_id": venue_id,
        "blasts": results,
        "summary": {
            "total_blasts": len(results),
            "total_verified_visits": total_visits,
            "total_estimated_revenue_ngn": total_revenue,
            "avg_conversion_rate": avg_conversion,
        },
    }


# ─── MERCHANT: ALWAYS-ON ATTRIBUTION (no blast required) ──────────────────────
# The money organ. Answers "did VIIBE bring me people?" even on a night the
# merchant never sent a blast — intent (views/taps/enroute) -> verified arrivals
# (geofence check-ins + ratings) -> lift vs the venue's own last-N comparable
# windows -> naira. Honest-scarcity: thin samples report low confidence, never
# a fabricated lift.

async def _unique_arrivals_in(venue_id: str, start: datetime, end: datetime) -> set:
    """Distinct verified bodies in [start, end): geofence check-ins + ratings,
    deduped by user. One scout who checked in AND rated is one arrival."""
    checkins = await db.checkins.find(
        {"venue_id": venue_id, "created_at": {"$gte": start, "$lt": end}},
        {"user_id": 1, "_id": 0},
    ).to_list(5000)
    ratings = await db.ratings.find(
        {"venue_id": venue_id, "timestamp": {"$gte": start, "$lt": end}},
        {"user_id": 1, "_id": 0},
    ).to_list(5000)
    return {d["user_id"] for d in (checkins + ratings) if d.get("user_id")}


@router.get("/merchant/venues/{venue_id}/attribution")
async def get_venue_attribution(
    venue_id: str,
    hours: float = 4.0,
    baseline_weeks: int = 4,
    authorization: str = Header(default=""),
):
    user = await _require_user(authorization)
    await _require_merchant_for_venue(user, venue_id)

    now = _now()
    window_start = now - timedelta(hours=hours)

    # ── Intent funnel (top of funnel demand) ──────────────────────────────────
    profile_views = await db.venue_intent_events.count_documents(
        {"venue_id": venue_id, "type": "profile_view", "ts": {"$gte": window_start}}
    )
    direction_taps = await db.venue_intent_events.count_documents(
        {"venue_id": venue_id, "type": "direction", "ts": {"$gte": window_start}}
    )
    enroute_intents = await db.venue_headings.count_documents(
        {"venue_id": venue_id, "status": "enroute", "created_at": {"$gte": window_start}}
    )
    funnel = IntentFunnel(
        profile_views=profile_views,
        direction_taps=direction_taps,
        enroute_intents=enroute_intents,
    )

    # ── Identified intent users (for matched conversion) ──────────────────────
    intent_event_users = await db.venue_intent_events.find(
        {"venue_id": venue_id, "type": "direction", "ts": {"$gte": window_start},
         "user_id": {"$ne": None}},
        {"user_id": 1, "_id": 0},
    ).to_list(5000)
    heading_users = await db.venue_headings.find(
        {"venue_id": venue_id, "status": "enroute", "created_at": {"$gte": window_start}},
        {"user_id": 1, "_id": 0},
    ).to_list(5000)
    intent_user_ids = {d["user_id"] for d in (intent_event_users + heading_users) if d.get("user_id")}

    # ── Verified arrivals this window ─────────────────────────────────────────
    arrival_ids = await _unique_arrivals_in(venue_id, window_start, now)
    arrivals = ArrivalStats(verified_arrivals=len(arrival_ids), arrival_user_ids=frozenset(arrival_ids))

    # ── Baseline: same clock-window on the prior N weeks ──────────────────────
    baseline_counts = []
    for wk in range(1, baseline_weeks + 1):
        b_start = window_start - timedelta(weeks=wk)
        b_end = now - timedelta(weeks=wk)
        baseline_counts.append(len(await _unique_arrivals_in(venue_id, b_start, b_end)))

    report = assemble_report(
        window_hours=hours,
        funnel=funnel,
        arrivals=arrivals,
        intent_user_ids=intent_user_ids,
        baseline_arrival_counts=baseline_counts,
        avg_spend=AVG_SPEND_NGN,
    )

    return {
        "venue_id": venue_id,
        "window_hours": report.window_hours,
        "funnel": {
            "profile_views": report.funnel.profile_views,
            "direction_taps": report.funnel.direction_taps,
            "enroute_intents": report.funnel.enroute_intents,
            "total_intent": report.funnel.total_intent,
        },
        "verified_arrivals": report.verified_arrivals,
        "matched_conversions": report.matched_conversions,
        "matched_conversion_pct": report.matched_conversion_pct,
        "lift": {
            "current": report.lift.current,
            "baseline": report.lift.baseline,
            "lift_pct": report.lift.lift_pct,
            "honest": report.lift.honest,
        },
        "estimated_revenue_ngn": report.estimated_revenue_ngn,
        "confidence": report.confidence,
    }
