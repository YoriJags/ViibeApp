"""
Ticketing partner API: how a ticketing platform connects its events to VIIBE.

A partner (a ticketing site such as Hippie) gets one API key from a VIIBE
admin and sends it as the X-Viibe-Key header. With it they can:

  PUT    /partner/events/{external_id}         create or update an event, keyed by
                                               THEIR event id, so retries are safe
  GET    /partner/events                       their events
  GET    /partner/events/{external_id}/live    the live picture (crowd, gate, energy,
                                               what ticket holders are being told)
  POST   /partner/events/{external_id}/scans   gate scan counts per time window
  DELETE /partner/events/{external_id}         take an event down

  POST   /admin/partners                       issue a partner key (super admin)

The rules that keep VIIBE honest with a partner on board:
  - A partner can describe its event (name, place, times, entry) but can never
    write a score, an energy level or a reading. Those fields are not accepted.
  - Gate scans are counts per window, never names, emails or ticket ids, and
    they are shown beside the scouts' readings, never mixed into them.
  - A partner sees only its own events. Someone else's id returns 404.
  - Keys are stored as a SHA-256 hash, so the database never holds a usable key.
"""
import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request

from app.config import db
from app.routes.events import live_payload
from app.services.auth import require_admin
from app.services.events import (
    KIND_EVENT,
    LISTED_AFTER,
    DOORS_LEAD,
    event_summary,
    new_event_document,
    new_organiser_key,
    public_event,
    validate_event,
    _aware,
)

router = APIRouter(tags=["partners"])

KEY_PREFIX = "vpk_"
# What a partner may set on its event. Everything else (scores, energy,
# verification, featuring) belongs to VIIBE and is ignored if sent.
PARTNER_FIELDS = (
    "name", "venue_type", "entry", "coordinates", "geofence_radius_m",
    "starts_at", "ends_at", "address", "area", "city", "organiser_name", "ticket_url",
)
MAX_SCAN_WINDOW = timedelta(minutes=60)
MAX_SCANS_PER_WINDOW = 100_000
MAX_EXTERNAL_ID = 128


def hash_key(key: str) -> str:
    return hashlib.sha256(key.encode("utf-8")).hexdigest()


async def require_partner(request: Request) -> dict:
    key = request.headers.get("X-Viibe-Key", "")
    if not key.startswith(KEY_PREFIX):
        raise HTTPException(status_code=401, detail="Send your partner key in the X-Viibe-Key header")
    partner = await db.partners.find_one({"key_hash": hash_key(key), "active": True}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=401, detail="Unknown or revoked partner key")
    return partner


def _check_external_id(external_id: str) -> str:
    external_id = (external_id or "").strip()
    if not external_id or len(external_id) > MAX_EXTERNAL_ID:
        raise HTTPException(status_code=422, detail=f"external_id must be 1 to {MAX_EXTERNAL_ID} characters")
    return external_id


async def _own_event(partner: dict, external_id: str) -> dict:
    event = await db.venues.find_one(
        {"kind": KIND_EVENT, "partner_id": partner["id"], "external_id": external_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


def _partner_view(event: dict) -> dict:
    out = public_event(event)
    out["event"] = event_summary(event)
    return out


# ── Admin ─────────────────────────────────────────────────────────────────────

@router.post("/admin/partners")
async def create_partner(payload: dict, user: dict = Depends(require_admin)):
    name = (payload.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=422, detail="The partner needs a name")
    key = KEY_PREFIX + secrets.token_urlsafe(32)
    partner = {
        "id": str(uuid.uuid4()),
        "name": name,
        "key_hash": hash_key(key),
        "active": True,
        "created_by": user.get("id"),
        "created_at": datetime.now(timezone.utc),
    }
    await db.partners.insert_one(dict(partner))
    # The key is shown once, here. Only its hash is kept.
    return {"partner": {"id": partner["id"], "name": name}, "api_key": key}


@router.delete("/admin/partners/{partner_id}")
async def revoke_partner(partner_id: str, user: dict = Depends(require_admin)):
    result = await db.partners.update_one({"id": partner_id}, {"$set": {"active": False}})
    if not result.matched_count:
        raise HTTPException(status_code=404, detail="Partner not found")
    return {"revoked": partner_id}


# ── Partner ───────────────────────────────────────────────────────────────────

@router.put("/partner/events/{external_id}")
async def upsert_event(external_id: str, payload: dict, partner: dict = Depends(require_partner)):
    """Create the event, or update it if this partner already sent this id."""
    external_id = _check_external_id(external_id)
    fields = {k: payload[k] for k in PARTNER_FIELDS if k in payload}
    existing = await db.venues.find_one(
        {"kind": KIND_EVENT, "partner_id": partner["id"], "external_id": external_id}, {"_id": 0})

    # Validate the event as it will be after the change, not just the patch.
    merged = {**(existing or {}), **fields}
    problems = validate_event(merged)
    if problems:
        raise HTTPException(status_code=422, detail={"problems": problems})

    if existing:
        doc = new_event_document(merged)
        update = {k: doc[k] for k in (
            "name", "venue_type", "entry", "coordinates", "geofence_radius_m",
            "starts_at", "ends_at", "address", "area", "city", "organiser_name")}
        update["ticket_url"] = fields.get("ticket_url", existing.get("ticket_url"))
        update["updated_at"] = datetime.now(timezone.utc)
        await db.venues.update_one({"id": existing["id"]}, {"$set": update})
        event = await db.venues.find_one({"id": existing["id"]}, {"_id": 0})
        return {"created": False, "event": _partner_view(event)}

    doc = new_event_document(fields, created_by=f"partner:{partner['id']}")
    doc.update({"partner_id": partner["id"], "partner_name": partner["name"],
                "external_id": external_id, "ticket_url": fields.get("ticket_url")})
    key = new_organiser_key()
    await db.venues.insert_one(dict(doc))
    await db.event_keys.insert_one({"event_id": doc["id"], "key": key,
                                    "created_at": datetime.now(timezone.utc)})
    return {
        "created": True,
        "event": _partner_view(doc),
        # The organiser's live screen. Shown once, on creation.
        "organiser_link": f"/organiser/{doc['id']}?key={key}",
    }


@router.get("/partner/events")
async def list_partner_events(partner: dict = Depends(require_partner)):
    docs = await db.venues.find(
        {"kind": KIND_EVENT, "partner_id": partner["id"]}, {"_id": 0}).to_list(500)
    docs.sort(key=lambda d: _aware(d.get("starts_at")) or datetime.max.replace(tzinfo=timezone.utc))
    return [_partner_view(d) for d in docs]


@router.get("/partner/events/{external_id}/live")
async def partner_live(external_id: str, partner: dict = Depends(require_partner)):
    event = await _own_event(partner, _check_external_id(external_id))
    return await live_payload(event)


@router.post("/partner/events/{external_id}/scans")
async def report_scans(external_id: str, payload: dict, partner: dict = Depends(require_partner)):
    """
    Gate scans as counts per time window:
      {"windows": [{"start": "...", "end": "...", "count": 42}, ...]}
    Sending the same window again replaces it, so a partner can resend safely.
    """
    event = await _own_event(partner, _check_external_id(external_id))
    windows = payload.get("windows")
    if not isinstance(windows, list) or not windows or len(windows) > 200:
        raise HTTPException(status_code=422, detail="Send 1 to 200 windows")

    start_ok = _aware(event["starts_at"]) - DOORS_LEAD
    end_ok = _aware(event["ends_at"]) + LISTED_AFTER
    now = datetime.now(timezone.utc)
    clean = []
    for i, w in enumerate(windows):
        try:
            ws, we, n = _aware(w["start"]), _aware(w["end"]), int(w["count"])
        except (KeyError, TypeError, ValueError):
            raise HTTPException(status_code=422, detail=f"Window {i}: needs start, end and count")
        if not (we > ws and we - ws <= MAX_SCAN_WINDOW):
            raise HTTPException(status_code=422, detail=f"Window {i}: end must be after start, at most 60 minutes")
        if not (0 <= n <= MAX_SCANS_PER_WINDOW):
            raise HTTPException(status_code=422, detail=f"Window {i}: count out of range")
        if ws < start_ok or we > min(end_ok, now + timedelta(minutes=5)):
            raise HTTPException(status_code=422, detail=f"Window {i}: outside the event, or in the future")
        clean.append((ws, we, n))

    for ws, we, n in clean:
        await db.event_scans.update_one(
            {"event_id": event["id"], "window_start": ws},
            {"$set": {"event_id": event["id"], "partner_id": partner["id"],
                      "window_start": ws, "window_end": we, "count": n,
                      "received_at": now}},
            upsert=True,
        )
    return {"accepted": len(clean)}


@router.delete("/partner/events/{external_id}")
async def delete_partner_event(external_id: str, partner: dict = Depends(require_partner)):
    event = await _own_event(partner, _check_external_id(external_id))
    await db.venues.delete_one({"id": event["id"]})
    await db.event_keys.delete_many({"event_id": event["id"]})
    await db.event_scans.delete_many({"event_id": event["id"]})
    return {"deleted": external_id}
