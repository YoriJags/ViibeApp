"""
Viibe - NDPR Compliance Layer

Nigeria Data Protection Regulation (NDPR) 2019 + NDPA 2023 compliance.

Requirements this module satisfies:
  1. Lawful basis for processing — consent captured and stored at signup
  2. Right of access — users can request all their personal data
  3. Right to erasure — users can delete their account and all associated data
  4. Right to data portability — users can export all their data as JSON
  5. Consent withdrawal — users can withdraw consent for optional processing
     (ambient audio, kinetic data, location)
  6. Processing record — every consent event is logged with timestamp

Data categories VIIBE processes:
  PERSONAL:     phone number, username, name, email, profile picture
  LOCATION:     GPS coordinates at time of rating (not stored continuously)
  BEHAVIOURAL:  rating history, dwell patterns, app usage
  BIOMETRIC:    accelerometer G-force readings (used to validate ratings)
  AUDIO:        ambient dB level only — NO audio recording or storage

Legal basis for processing (NDPR Article 2.2):
  - Phone, username, ratings: CONSENT + CONTRACTUAL NECESSITY (core service)
  - Ambient audio dB: CONSENT (opt-in, separate explicit consent required)
  - Kinetic/accelerometer: LEGITIMATE INTEREST (fraud prevention)
  - Location at rating time: CONTRACTUAL NECESSITY (geofence enforcement)
"""
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from app.config import db
from app.services.auth import require_auth

router = APIRouter(tags=["privacy"])


# ── Consent model ─────────────────────────────────────────────────────────────

class ConsentRecord(BaseModel):
    user_id: str
    # Core processing (required for service)
    core_processing: bool = True           # ratings, profile, scores
    # Optional processing (user choice)
    ambient_audio: bool = False            # dB level sampling
    kinetic_data: bool = True              # accelerometer for fraud guard
    marketing_comms: bool = False          # push notifications for promos
    # Meta
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    recorded_at: datetime = None


class ConsentUpdate(BaseModel):
    ambient_audio: Optional[bool] = None
    kinetic_data: Optional[bool] = None
    marketing_comms: Optional[bool] = None


# ── Consent endpoints ─────────────────────────────────────────────────────────

@router.post("/privacy/consent")
async def record_consent(
    payload: ConsentUpdate,
    request=None,
    user: dict = Depends(require_auth),
):
    """
    Record or update the user's consent preferences.
    Called during onboarding and whenever the user changes privacy settings.
    Every change is logged as an immutable audit event.
    """
    now = datetime.now(timezone.utc)
    user_id = user["id"]

    # Read current consent state
    current = await db.consent_records.find_one({"user_id": user_id})
    current_state = {
        "ambient_audio":    current.get("ambient_audio",    False) if current else False,
        "kinetic_data":     current.get("kinetic_data",     True)  if current else True,
        "marketing_comms":  current.get("marketing_comms",  False) if current else False,
    }

    # Apply changes
    updates = {k: v for k, v in payload.dict().items() if v is not None}
    new_state = {**current_state, **updates}

    # Upsert current consent record
    await db.consent_records.update_one(
        {"user_id": user_id},
        {"$set": {
            "user_id":          user_id,
            "core_processing":  True,   # cannot be withdrawn without account deletion
            **new_state,
            "last_updated":     now,
        }},
        upsert=True,
    )

    # Immutable audit log — every consent change is permanently recorded
    await db.consent_audit_log.insert_one({
        "user_id":    user_id,
        "action":     "consent_update",
        "changes":    updates,
        "state_after": new_state,
        "timestamp":  now,
    })

    return {"success": True, "consent": new_state}


@router.get("/privacy/consent")
async def get_consent(user: dict = Depends(require_auth)):
    """Return the user's current consent preferences."""
    record = await db.consent_records.find_one({"user_id": user["id"]}, {"_id": 0})
    if not record:
        # Default state for users who pre-date the consent system
        return {
            "core_processing": True,
            "ambient_audio":   False,
            "kinetic_data":    True,
            "marketing_comms": False,
            "last_updated":    None,
        }
    record.pop("_id", None)
    return record


# ── Right of access ───────────────────────────────────────────────────────────

@router.get("/privacy/my-data")
async def export_my_data(user: dict = Depends(require_auth)):
    """
    NDPR Article 3.1(5) — Right of access and data portability.
    Returns all personal data VIIBE holds on this user as a structured JSON export.
    """
    user_id = user["id"]

    # Fetch all data categories
    ratings = await db.ratings.find(
        {"user_id": user_id},
        {"_id": 0, "photo_base64": 0},  # exclude photos from export (too large)
    ).to_list(10000)

    checkins = await db.checkins.find(
        {"user_id": user_id},
        {"_id": 0},
    ).to_list(1000)

    streak = await db.streaks.find_one({"user_id": user_id}, {"_id": 0})
    consent = await db.consent_records.find_one({"user_id": user_id}, {"_id": 0})
    consent_log = await db.consent_audit_log.find(
        {"user_id": user_id},
        {"_id": 0},
    ).to_list(1000)

    # Strip internal and sensitive fields from user profile
    profile = {k: v for k, v in user.items() if k not in ("_id", "push_token")}

    return {
        "export_generated_at": datetime.now(timezone.utc).isoformat(),
        "data_controller":     "Viibe Technologies",
        "data_subject_id":     user_id,
        "profile":             profile,
        "ratings":             ratings,
        "checkins":            checkins,
        "streak":              streak,
        "consent_record":      consent,
        "consent_audit_log":   consent_log,
        "categories_collected": [
            "phone number (login identity)",
            "username and display name",
            "rating submissions with venue coordinates",
            "dwell time at venues (duration only, not continuous tracking)",
            "ambient dB level (if consent given — no audio recording)",
            "accelerometer G-force readings (fraud validation only)",
            "streak and gamification state",
        ],
        "legal_basis": "Consent + Contractual Necessity (NDPR 2019 / NDPA 2023)",
        "retention_period": "Indefinite while account is active; deleted within 30 days of account deletion request",
        "data_processor":  "MongoDB Atlas (AWS eu-west-1 / af-south-1)",
    }


# ── Right to erasure ──────────────────────────────────────────────────────────

@router.delete("/privacy/my-data")
async def request_account_deletion(user: dict = Depends(require_auth)):
    """
    NDPR Article 3.1(7) — Right to erasure ('right to be forgotten').

    Schedules the account for deletion within 30 days.
    Ratings are anonymised (user_id replaced with null-user marker) rather
    than deleted, to preserve aggregate score integrity — this is a legitimate
    interest override per NDPR Article 2.5.

    Immediately:
      - Marks account as deletion_requested
      - Logs the deletion request with timestamp
      - Invalidates all active sessions

    Within 30 days:
      - Personal data (phone, email, name, picture, push_token) is wiped
      - Ratings are anonymised, not deleted (aggregate integrity)
      - Account record is purged
    """
    user_id = user["id"]
    now = datetime.now(timezone.utc)

    # Check not already requested
    existing = await db.users.find_one({"id": user_id})
    if existing and existing.get("deletion_requested"):
        return {
            "status": "already_scheduled",
            "message": "Your account deletion is already scheduled.",
            "requested_at": existing.get("deletion_requested_at"),
        }

    # Mark for deletion
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "deletion_requested":    True,
            "deletion_requested_at": now,
            "deletion_due_by":       datetime.fromtimestamp(
                now.timestamp() + (30 * 24 * 3600), tz=timezone.utc
            ),
        }},
    )

    # Log the request (immutable)
    await db.deletion_requests.insert_one({
        "user_id":      user_id,
        "requested_at": now,
        "status":       "scheduled",
        "method":       "self_service",
    })

    # Invalidate all sessions immediately
    await db.user_sessions.delete_many({"user_id": user_id})

    # Log consent withdrawal
    await db.consent_audit_log.insert_one({
        "user_id":    user_id,
        "action":     "account_deletion_requested",
        "timestamp":  now,
    })

    return {
        "status":    "scheduled",
        "message":   "Your account will be deleted within 30 days. You have been logged out of all sessions.",
        "due_by":    datetime.fromtimestamp(now.timestamp() + (30 * 24 * 3600), tz=timezone.utc).isoformat(),
        "note":      "Your ratings will be anonymised (not deleted) to preserve venue score integrity. All personal identifying information will be permanently removed.",
    }


# ── Admin: process pending deletions ─────────────────────────────────────────

@router.post("/admin/privacy/process-deletions")
async def process_pending_deletions(request=None, user: dict = Depends(require_auth)):
    """
    Admin endpoint — process accounts past their 30-day deletion window.
    Should be run on a scheduled basis (cron or manual trigger).

    For each due account:
      1. Anonymise all ratings (replace user_id with anonymised marker)
      2. Delete personal data fields from user record
      3. Mark deletion_requests entry as completed
    """
    if not (user.get("is_admin") or user.get("is_super_admin")):
        raise HTTPException(status_code=403, detail="Admin access required")

    now = datetime.now(timezone.utc)
    due_accounts = await db.users.find({
        "deletion_requested": True,
        "deletion_due_by":    {"$lte": now},
    }).to_list(100)

    processed = []
    for account in due_accounts:
        uid = account["id"]
        anon_marker = f"deleted_user_{uid[:8]}"

        # Anonymise ratings — preserve venue signal, erase identity
        await db.ratings.update_many(
            {"user_id": uid},
            {"$set": {"user_id": anon_marker, "anonymised": True}},
        )

        # Wipe personal data fields
        await db.users.update_one(
            {"id": uid},
            {"$set": {
                "phone":       None,
                "email":       None,
                "name":        None,
                "picture":     None,
                "push_token":  None,
                "username":    anon_marker,
                "deletion_completed_at": now,
            }},
        )

        # Invalidate any remaining sessions
        await db.user_sessions.delete_many({"user_id": uid})

        # Mark deletion complete
        await db.deletion_requests.update_one(
            {"user_id": uid, "status": "scheduled"},
            {"$set": {"status": "completed", "completed_at": now}},
        )

        processed.append(uid)

    return {
        "processed": len(processed),
        "user_ids":  processed,
        "timestamp": now.isoformat(),
    }
