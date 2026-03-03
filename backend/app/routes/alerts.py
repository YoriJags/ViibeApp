"""
Vibe App - Alert Routes
Push notification token registration, preference management,
and venue energy threshold alerts.

Energy Alert schema (db.venue_alerts):
  user_id       — owner
  venue_id      — which venue
  venue_name    — denormalised for notification copy
  condition     — 'gte' (at least) | 'lte' (at most)
  threshold     — 'quiet' | 'chill' | 'warming' | 'lit' | 'peak'
  label         — user's custom name, e.g. "Quilox goes off"
  note          — optional personal context, e.g. "going with Tunde"
  active        — bool (user can pause without deleting)
  last_triggered — UTC, prevents re-firing within cooldown
  created_at

Condition logic:
  'gte' → notify when score >= threshold  (e.g. "tell me when it's at least LIT")
  'lte' → notify when score <= threshold  (e.g. "tell me when it's no more than CHILL")
"""
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, Literal
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from app.config import db, logger
from app.models import AlertRegister, AlertPreferences
from app.services.auth import require_auth

router = APIRouter(tags=["alerts"])

# Don't re-fire the same alert within this many minutes
ALERT_COOLDOWN_MINUTES = 60

# Energy label → numeric score
ENERGY_SCORES = {"quiet": 0, "chill": 25, "warming": 50, "lit": 75, "peak": 100}

def _score_to_label(score: float) -> str:
    if score >= 85: return "peak"
    if score >= 65: return "lit"
    if score >= 45: return "warming"
    if score >= 20: return "chill"
    return "quiet"


# ─── Venue-Alert Schemas ─────────────────────────────────────────────────────

class VenueAlertCreate(BaseModel):
    venue_id: str
    condition: Literal["gte", "lte"]
    threshold: Literal["quiet", "chill", "warming", "lit", "peak"]
    label: Optional[str] = None    # custom name — auto-generated if blank
    note: Optional[str] = None     # personal context (e.g. "going with Tunde")

class VenueAlertUpdate(BaseModel):
    condition: Optional[Literal["gte", "lte"]] = None
    threshold: Optional[Literal["quiet", "chill", "warming", "lit", "peak"]] = None
    label: Optional[str] = None
    note: Optional[str] = None
    active: Optional[bool] = None


@router.post("/alerts/register")
async def register_push_token(data: AlertRegister, user: dict = Depends(require_auth)):
    """Register an Expo push notification token."""
    if not data.expo_push_token.startswith("ExponentPushToken"):
        raise HTTPException(status_code=400, detail="Invalid Expo push token format")

    await db.alert_preferences.update_one(
        {"user_id": user["id"]},
        {
            "$set": {
                "expo_push_token": data.expo_push_token,
                "updated_at": datetime.now(timezone.utc),
            },
            "$setOnInsert": {
                "user_id": user["id"],
                "lobby_alerts": True,
                "streak_reminders": True,
                "crew_alerts": True,
                "nearby_alerts": False,
                "created_at": datetime.now(timezone.utc),
            },
        },
        upsert=True,
    )

    return {"message": "Push token registered"}


@router.put("/alerts/preferences")
async def update_preferences(data: AlertPreferences, user: dict = Depends(require_auth)):
    """Update notification preferences."""
    await db.alert_preferences.update_one(
        {"user_id": user["id"]},
        {
            "$set": {
                "lobby_alerts": data.lobby_alerts,
                "streak_reminders": data.streak_reminders,
                "crew_alerts": data.crew_alerts,
                "nearby_alerts": data.nearby_alerts,
                "updated_at": datetime.now(timezone.utc),
            },
        },
    )

    return {"message": "Preferences updated"}


@router.get("/alerts/preferences")
async def get_preferences(user: dict = Depends(require_auth)):
    """Get current notification preferences."""
    prefs = await db.alert_preferences.find_one(
        {"user_id": user["id"]},
        {"_id": 0},
    )

    if not prefs:
        return {
            "lobby_alerts": True,
            "streak_reminders": True,
            "crew_alerts": True,
            "nearby_alerts": False,
            "registered": False,
        }

    prefs["registered"] = bool(prefs.get("expo_push_token"))
    return prefs


# ─── Venue Energy Alert CRUD ─────────────────────────────────────────────────

@router.get("/alerts/venue")
async def list_venue_alerts(user: dict = Depends(require_auth)):
    """List all venue energy alerts for the current user."""
    alerts = await db.venue_alerts.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return {"alerts": alerts}


@router.post("/alerts/venue")
async def create_venue_alert(body: VenueAlertCreate, user: dict = Depends(require_auth)):
    """
    Create a venue energy alert.
    One alert per user/venue/condition combo — updating threshold is allowed.
    """
    venue = await db.venues.find_one({"id": body.venue_id}, {"_id": 0})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    # Upsert: if same user/venue/condition exists, update it
    existing = await db.venue_alerts.find_one({
        "user_id": user["id"],
        "venue_id": body.venue_id,
        "condition": body.condition,
    })

    condition_phrase = "at least" if body.condition == "gte" else "at most"
    auto_label = body.label or f"When {venue['name']} is {condition_phrase} {body.threshold}"

    if existing:
        await db.venue_alerts.update_one(
            {"id": existing["id"]},
            {"$set": {
                "threshold": body.threshold,
                "label": body.label or existing.get("label"),
                "note": body.note if body.note is not None else existing.get("note"),
                "active": True,
                "updated_at": datetime.now(timezone.utc),
            }}
        )
        updated = await db.venue_alerts.find_one({"id": existing["id"]}, {"_id": 0})
        return {"alert": updated, "created": False}

    alert = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "venue_id": body.venue_id,
        "venue_name": venue["name"],
        "venue_area": venue.get("area", ""),
        "condition": body.condition,
        "threshold": body.threshold,
        "label": auto_label,
        "note": body.note,
        "active": True,
        "last_triggered": None,
        "created_at": datetime.now(timezone.utc),
    }
    await db.venue_alerts.insert_one(alert)
    alert.pop("_id", None)
    return {"alert": alert, "created": True}


@router.patch("/alerts/venue/{alert_id}")
async def update_venue_alert(
    alert_id: str,
    body: VenueAlertUpdate,
    user: dict = Depends(require_auth),
):
    """Update threshold, condition, label, note, or active state."""
    alert = await db.venue_alerts.find_one({"id": alert_id, "user_id": user["id"]})
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    updates: dict = {"updated_at": datetime.now(timezone.utc)}
    if body.condition  is not None: updates["condition"]  = body.condition
    if body.threshold  is not None: updates["threshold"]  = body.threshold
    if body.label      is not None: updates["label"]      = body.label
    if body.note       is not None: updates["note"]       = body.note
    if body.active     is not None: updates["active"]     = body.active

    await db.venue_alerts.update_one({"id": alert_id}, {"$set": updates})
    updated = await db.venue_alerts.find_one({"id": alert_id}, {"_id": 0})
    return {"alert": updated}


@router.delete("/alerts/venue/{alert_id}")
async def delete_venue_alert(alert_id: str, user: dict = Depends(require_auth)):
    """Delete a venue energy alert."""
    result = await db.venue_alerts.delete_one({"id": alert_id, "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"ok": True}


# ─── Alert Fire Check (called after every venue score update) ─────────────────

async def check_venue_alerts(venue_id: str, new_score: float):
    """
    Called from vibe.py after calculate_venue_aggregate().
    Checks all active alerts for this venue and fires push notifications.
    """
    now = datetime.now(timezone.utc)
    cooldown_cutoff = now - timedelta(minutes=ALERT_COOLDOWN_MINUTES)
    current_label = _score_to_label(new_score)

    alerts = await db.venue_alerts.find({
        "venue_id": venue_id,
        "active": True,
        "$or": [
            {"last_triggered": None},
            {"last_triggered": {"$lt": cooldown_cutoff}},
        ],
    }).to_list(200)

    for alert in alerts:
        threshold_score = ENERGY_SCORES.get(alert["threshold"], 0)
        condition = alert.get("condition", "gte")

        triggered = (
            (condition == "gte" and new_score >= threshold_score) or
            (condition == "lte" and new_score <= threshold_score)
        )
        if not triggered:
            continue

        await db.venue_alerts.update_one(
            {"id": alert["id"]},
            {"$set": {"last_triggered": now}}
        )

        # Get user's push token
        prefs = await db.alert_preferences.find_one({"user_id": alert["user_id"]})
        push_token = prefs.get("expo_push_token") if prefs else None
        if not push_token:
            continue

        condition_phrase = "is now" if condition == "gte" else "is at"
        body_text = (
            f"{alert['venue_name']} {condition_phrase} "
            f"{current_label.upper()} ({int(new_score)})"
        )
        if alert.get("note"):
            body_text += f" — {alert['note']}"

        await _send_push(
            token=push_token,
            title=alert["label"],
            body=body_text,
            data={"venue_id": venue_id, "score": new_score, "label": current_label},
        )


async def _send_push(token: str, title: str, body: str, data: dict):
    """Fire an Expo push notification. Non-blocking — logs failures, never raises."""
    import httpx
    token_preview = token[:30] + "…" if len(token) > 30 else token
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.post(
                "https://exp.host/--/api/v2/push/send",
                json={
                    "to": token,
                    "title": title,
                    "body": body,
                    "data": data,
                    "sound": "default",
                    "priority": "high",
                },
            )
        if resp.status_code == 200:
            result = resp.json()
            # Expo wraps errors inside a 200 response under data[0].status
            ticket = result.get("data", [{}])[0] if result.get("data") else {}
            if ticket.get("status") == "error":
                details = ticket.get("details", {})
                error_msg = ticket.get("message", "unknown")
                logger.warning(
                    f"[push] Expo rejected ticket | token={token_preview} "
                    f"| error={error_msg} | details={details}"
                )
            else:
                logger.info(
                    f"[push] Sent OK | token={token_preview} | title='{title}'"
                )
        else:
            logger.warning(
                f"[push] Expo returned HTTP {resp.status_code} | "
                f"token={token_preview} | body={resp.text[:200]}"
            )
    except httpx.TimeoutException:
        logger.warning(f"[push] Timeout reaching Expo | token={token_preview}")
    except Exception as e:
        logger.error(f"[push] Unexpected error | token={token_preview} | {e}")
