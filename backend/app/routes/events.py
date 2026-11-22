"""
Event routes: concerts, festivals and raves.

  POST   /admin/events                   create an event (super admin)
  DELETE /admin/events/{id}              remove one (super admin)
  GET    /events?city=lagos              events on the map now or this week
  GET    /events/{id}/timing             "when to leave", for ticketed events
  GET    /organiser/events/{id}?key=...  the organiser's live data

The organiser screen is opened with a private link rather than an account, so
a promoter can put it on any phone on the night. The key is compared in
constant time, and a wrong key returns 404 rather than 403 so the link does not
even confirm that an event exists.
"""
import re
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response

from app.config import db
from app.services.auth import require_admin, require_auth
from app.services.crowd_flow import arrival_curve, flow_for
from app.services.event_trust import (
    ON_SITE_FIXES_ALLOWED,
    REPORT_REASONS,
    REPORTS_TO_HIDE,
    drift_suggestion,
    find_duplicate,
    location_status,
    on_site_decision,
    should_hide_for_reports,
    submission_limit_problem,
)
from app.services.events import (
    DOORS_LEAD,
    KIND_EVENT,
    LISTING_COMMUNITY,
    LISTING_OFFICIAL,
    SOURCE_COMMUNITY,
    event_phase,
    event_summary,
    is_held,
    is_listed,
    listing_of,
    new_event_document,
    new_organiser_key,
    promise_for,
    public_event,
    validate_event,
)
from app.services.vibe import calculate_distance
from app.services.leave_timing import advise, gate_consensus
from app.services.presence import present_filter
from app.services.signal_density import compute_signal_density
from app.services.synthetic import real_only_filter

router = APIRouter(tags=["events"])

GATE_WINDOW_MINUTES = 30


def _lagos_time_label(ts: datetime | None) -> str | None:
    if ts is None:
        return None
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    local = ts + timedelta(hours=1)  # WAT, no daylight saving
    return local.strftime("%I:%M %p").lstrip("0")


async def _gate_readings(venue_id: str) -> list[str]:
    since = datetime.now(timezone.utc) - timedelta(minutes=GATE_WINDOW_MINUTES)
    rows = await db.ratings.find(
        {"venue_id": venue_id, "timestamp": {"$gte": since}, "gate": {"$exists": True},
         **real_only_filter()},
        {"gate": 1, "_id": 0},
    ).to_list(500)
    return [r["gate"] for r in rows if r.get("gate")]


async def _event_or_404(event_id: str) -> dict:
    doc = await db.venues.find_one({"id": event_id, "kind": KIND_EVENT})
    if not doc:
        raise HTTPException(status_code=404, detail="Event not found")
    return doc


async def _timing_for(event: dict) -> dict:
    flow = await flow_for([event["id"]], 30)
    gate = await _gate_readings(event["id"])
    advice = advise(
        event_phase(event),
        gate,
        flow["arrivals"],
        flow["departures"],
        event.get("vibe_state") or event.get("energy_level"),
        event.get("energy_source"),
        _lagos_time_label(event.get("starts_at")),
    )
    advice["flow"]["direction"] = flow["direction"]
    advice["gate_readings"] = len(gate)
    return advice


# ── Admin ─────────────────────────────────────────────────────────────────────

@router.post("/admin/events")
async def create_event(payload: dict, user: dict = Depends(require_admin)):
    problems = validate_event(payload)
    if problems:
        raise HTTPException(status_code=422, detail={"problems": problems})
    doc = new_event_document(payload, created_by=user.get("id"))
    key = new_organiser_key()
    await db.venues.insert_one(dict(doc))
    await set_anchor(doc["id"], doc["coordinates"])
    await db.event_keys.insert_one({"event_id": doc["id"], "key": key,
                                    "created_at": datetime.now(timezone.utc)})
    return {
        "event": public_event(doc),
        # Shown once, to the admin who created it, to pass to the organiser.
        "organiser_link": f"/organiser/{doc['id']}?key={key}",
    }


@router.delete("/admin/events/{event_id}")
async def delete_event(event_id: str, user: dict = Depends(require_admin)):
    result = await db.venues.delete_one({"id": event_id, "kind": KIND_EVENT})
    if not result.deleted_count:
        raise HTTPException(status_code=404, detail="Event not found")
    await db.event_keys.delete_many({"event_id": event_id})
    return {"deleted": event_id}


# ── Public ────────────────────────────────────────────────────────────────────

@router.get("/events")
async def list_events(city: str = Query("lagos")):
    """Events on the map now or within the coming week, soonest first."""
    now = datetime.now(timezone.utc)
    docs = await db.venues.find({"kind": KIND_EVENT, "city": city.lower()}).to_list(500)
    listed = [d for d in docs if is_listed(d, now)]
    listed.sort(key=lambda d: d.get("starts_at") or now)
    out = []
    for d in listed:
        item = public_event(d)
        item["event"] = event_summary(d, now)
        item["signal_density"] = compute_signal_density(d)
        out.append(item)
    return out


@router.get("/events/{event_id}/timing")
async def event_timing(event_id: str):
    """
    When to leave. Only ticketed events make this promise; a door-entry event
    returns promise "worth" so the app shows the reading instead.
    """
    event = await _event_or_404(event_id)
    if not is_listed(event):
        raise HTTPException(status_code=404, detail="Event not found")
    if promise_for(event) != "timing":
        return {"promise": "worth", "advice": None}
    return {"promise": "timing", **(await _timing_for(event))}


# ── Organiser ─────────────────────────────────────────────────────────────────

@router.get("/organiser/events/{event_id}")
async def organiser_view(event_id: str, key: str = Query(...)):
    """Everything the promoter needs on the night, behind their private link."""
    event = await _event_for_key(event_id, key)
    event.pop("_id", None)
    return await live_payload(event)


async def gate_scans(event_id: str, now: datetime) -> dict | None:
    """
    Gate scans a ticketing partner reported. Counts only, never people. Shown
    beside the readings, never mixed into them: a partner selling the tickets
    must not be able to move the energy or the advice attendees get.
    """
    rows = await db.event_scans.find({"event_id": event_id}, {"_id": 0}).to_list(2000)
    if not rows:
        return None
    since = now - timedelta(minutes=GATE_WINDOW_MINUTES)

    def ended(r):
        t = r["window_end"]
        return t if t.tzinfo else t.replace(tzinfo=timezone.utc)

    return {
        "total": sum(r["count"] for r in rows),
        "last_30m": sum(r["count"] for r in rows if ended(r) >= since),
        "last_reported_at": max(ended(r) for r in rows).isoformat(),
    }


async def live_payload(event: dict) -> dict:
    """The live picture of one event, for its organiser or ticketing partner."""
    event_id = event["id"]
    now = datetime.now(timezone.utc)
    start = event.get("starts_at")
    if start is not None and start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    curve_from = min(start - DOORS_LEAD, now) if start else now - timedelta(hours=2)

    gate = await _gate_readings(event_id)
    real = event.get("energy_source") == "scouts"
    return {
        "event": {**public_event(event), "event": event_summary(event, now)},
        "present_now": await db.checkins.count_documents(present_filter(event_id, now)),
        "flow": await flow_for([event_id], 30),
        "arrival_curve": await arrival_curve(event_id, curve_from, 10),
        "gate": {
            "consensus": gate_consensus(gate),
            "readings": len(gate),
            "breakdown": {g: gate.count(g) for g in ("clear", "slow", "blocked")},
            "window_minutes": GATE_WINDOW_MINUTES,
        },
        # Only a reading built from real scouts is ever shown as the energy.
        "energy": {
            "label": (event.get("vibe_state") or "").upper() if real else None,
            "score": round(event.get("current_vibe_score", 0)) if real else None,
            "source": event.get("energy_source", "none"),
        },
        "signal_density": compute_signal_density(event),
        "location": await location_picture(event, now),
        "gate_scans": await gate_scans(event_id, now),
        # What the app is telling ticket holders right now, so the promoter
        # sees exactly what their attendees see.
        "attendees_are_told": (await _timing_for(event)) if promise_for(event) == "timing" else None,
        "updated_at": now.isoformat(),
    }


# ── Location: is the pin where the event really is? ──────────────────────────

def _window(event: dict) -> tuple[datetime, datetime]:
    start, end = event.get("starts_at"), event.get("ends_at")
    start = start if start.tzinfo else start.replace(tzinfo=timezone.utc)
    end = end if end.tzinfo else end.replace(tzinfo=timezone.utc)
    return start - DOORS_LEAD, end


async def confirmed_people(event: dict) -> int:
    """Different people whose arrival inside the ground was verified during the event."""
    since, until = _window(event)
    ids = await db.checkins.distinct("user_id", {
        "venue_id": event["id"], "created_at": {"$gte": since, "$lte": until},
        # Manual check-ins are geofence-enforced; automatic ones must carry a verified position.
        "$or": [{"source": {"$ne": "auto"}}, {"verified": True}],
    })
    return len(ids)


async def drift_for(event: dict) -> dict | None:
    since, until = _window(event)
    rows = await db.event_positions.find(
        {"event_id": event["id"], "at": {"$gte": since, "$lte": until}}, {"_id": 0}
    ).sort("at", 1).to_list(5000)
    return drift_suggestion(event, rows)


async def location_picture(event: dict, now: datetime | None = None) -> dict:
    people = await confirmed_people(event)
    return {
        "status": location_status(people, bool(event.get("location_set_on_site"))),
        "confirmed_people": people,
        "set_on_site": bool(event.get("location_set_on_site")),
        "drift": await drift_for(event),
    }


async def _log_move(event: dict, to: dict, by: str, why: str) -> None:
    """Every pin move is kept: who, from where, to where and why."""
    await db.event_location_log.insert_one({
        "event_id": event["id"], "from": event.get("coordinates"), "to": to,
        "by": by, "why": why, "at": datetime.now(timezone.utc),
    })


async def log_position_near_event(event: dict, user_id: str, lat: float, lng: float, kind: str) -> None:
    """
    A refused arrival or check-in at a live event, kept rounded (about 11 m) so
    the drift check can see where people are gathering. Events only, never a
    permanent venue, and only while the event is on.
    """
    from app.services.event_trust import round_position
    from app.services.events import is_event, is_watchable
    if not is_event(event) or not is_watchable(event):
        return
    try:
        await db.event_positions.insert_one({
            "event_id": event["id"], "user_id": user_id, "kind": kind,
            **round_position(lat, lng), "at": datetime.now(timezone.utc),
        })
    except Exception:
        pass  # a lost position must never fail the request that carried it


# ── Community submissions ────────────────────────────────────────────────────
#
# A submission lives in event_submissions until an admin approves it. Only
# then does a public, venue-shaped copy go into venues, the collection dozens
# of routes read in their own ways. Everything private (who submitted it, the
# organiser they claimed, an unverified ticket link, reports, proposed pins,
# the approved anchor) lives in event_private, which no public route reads.
# The same reason organiser keys live in event_keys.

async def _organiser_certification(user_id: str) -> dict | None:
    from app.routes.certification import certified_record
    return await certified_record(user_id, "organiser")


async def _private(event_id: str) -> dict:
    return await db.event_private.find_one({"event_id": event_id}) or {}


async def _set_private(event_id: str, fields: dict) -> None:
    await db.event_private.update_one({"event_id": event_id}, {"$set": fields}, upsert=True)


async def set_anchor(event_id: str, coordinates: dict) -> None:
    """
    The spot an admin approved (or an admin's own event was created at). Every
    on-site move is measured from here and the free-fix allowance starts again.
    Only ever called by an admin action.
    """
    await _set_private(event_id, {"approved_coordinates": coordinates, "on_site_fixes": 0,
                                  "pending_location": None})


COVER_MAX_BYTES = 600_000   # a phone photo resized to about 1200px wide fits easily


def decode_cover(value) -> tuple[tuple[bytes, str] | None, str | None]:
    """A cover photo as (bytes, content type), or the problem with it. JPEG or PNG only."""
    import base64
    import binascii
    if not isinstance(value, str) or len(value) > COVER_MAX_BYTES * 4 // 3 + 4:
        return None, "The cover photo is too large. Pick a smaller one."
    try:
        data = base64.b64decode(value, validate=True)
    except (binascii.Error, ValueError):
        return None, "The cover photo could not be read."
    if data[:3] == bytes([0xFF, 0xD8, 0xFF]):
        return (data, "image/jpeg"), None
    if data[:8] == bytes([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]):
        return (data, "image/png"), None
    return None, "The cover photo must be a JPEG or PNG."


async def _name_is_certified(name: str) -> bool:
    """True when a current VIIBE Certified organiser goes by this name (any case)."""
    from app.services.event_trust import is_certified
    rows = await db.business_certifications.find(
        {"kind": "organiser", "status": "certified",
         "name": {"$regex": f"^{re.escape(name.strip())}$", "$options": "i"}}).to_list(10)
    return any(is_certified(r) for r in rows)


def _submission_view(sub: dict) -> dict:
    """A submission as its submitter sees it."""
    view = public_event({k: v for k, v in sub.items() if k not in ("status", "reason")})
    return view


@router.post("/events/submit")
async def submit_event(payload: dict, user: dict = Depends(require_auth)):
    """
    Anyone signed in can put an event forward. It is not on the map, and no
    phone watches its ground, until an admin approves it. A certified
    organiser's event is Official; anyone else's is a community listing that
    shows no organiser name and no ticket link.
    """
    from app.routes.places import submissions_today_and_pending
    payload = dict(payload)
    if payload.get("place_id"):
        place = await db.places.find_one({"id": payload["place_id"]})
        usable = place and (place.get("status") == "approved"
                            or (place.get("status") == "pending" and place.get("submitted_by") == user["id"]))
        if not usable:
            raise HTTPException(status_code=422, detail={"problems": ["That place is not available."]})
        # The place's checked location wins over anything typed in.
        payload["coordinates"] = place["coordinates"]
        for field, value in (("geofence_radius_m", place.get("ground_radius_m")),
                             ("area", place.get("area")),
                             ("address", place.get("address") or place.get("name"))):
            if not payload.get(field):
                payload[field] = value
        payload["city"] = place.get("city", "lagos")
    problems = validate_event(payload)
    if problems:
        raise HTTPException(status_code=422, detail={"problems": problems})

    pending, today = await submissions_today_and_pending(user["id"])
    limit = submission_limit_problem(pending, today)
    if limit:
        raise HTTPException(status_code=429, detail=limit)

    cover = None
    if payload.get("cover_base64") is not None:
        cover, problem = decode_cover(payload["cover_base64"])
        if problem:
            raise HTTPException(status_code=422, detail={"problems": [problem]})

    cert = await _organiser_certification(user["id"])
    claimed = (payload.get("organiser_name") or "").strip() or None
    if claimed and not cert and await _name_is_certified(claimed):
        # Freedom to name your own host, not to borrow a certified one.
        raise HTTPException(status_code=422, detail={"problems": [
            f"\"{claimed}\" is a VIIBE Certified organiser. Only they can list events under that name."]})
    ticket = payload.get("ticket_url")
    payload["source"] = SOURCE_COMMUNITY
    # A certified organiser lists under their certified name. Anyone else may
    # name a host; it shows marked not verified (services/events.public_event).
    payload["organiser_name"] = cert["name"] if cert else claimed
    payload["ticket_url"] = ticket if cert else None
    doc = new_event_document(payload, created_by=None)
    doc["listing"] = LISTING_OFFICIAL if cert else LISTING_COMMUNITY
    if cover:
        doc["cover_image_url"] = f"/api/events/{doc['id']}/cover"

    listed = await db.venues.find({"kind": KIND_EVENT, "city": doc["city"]}, {"_id": 0}).to_list(2000)
    waiting = await db.event_submissions.find({"city": doc["city"], "status": "pending"}, {"_id": 0}).to_list(2000)
    dup = find_duplicate(doc, listed + waiting)
    if dup:
        detail = {"problems": ["This event looks already listed at the same place and time."]}
        if is_listed(dup):
            detail["existing"] = {"id": dup["id"], "name": dup["name"]}
        raise HTTPException(status_code=409, detail=detail)

    if cover:
        await db.event_covers.insert_one({"event_id": doc["id"], "data": cover[0], "content_type": cover[1],
                                          "created_at": datetime.now(timezone.utc)})
    await db.event_submissions.insert_one({**doc, "status": "pending", "submitted_by": user["id"]})
    await _set_private(doc["id"], {"submitted_by": user["id"], "claimed_organiser": claimed,
                                   "claimed_ticket_url": ticket})
    return {"event": public_event(doc), "status": "pending"}


@router.get("/me/submissions")
async def my_submissions(user: dict = Depends(require_auth)):
    """The submitter's own events and places, with their organiser link once approved."""
    subs = await db.event_submissions.find({"submitted_by": user["id"]}, {"_id": 0}) \
        .sort("created_at", -1).to_list(100)
    out = []
    for s in subs:
        item = {"event": _submission_view(s), "status": s["status"]}
        if s["status"] == "rejected":
            item["reason"] = s.get("reason")
        if s["status"] == "approved":
            live = await db.venues.find_one({"id": s["id"], "kind": KIND_EVENT}, {"_id": 0})
            if live:
                item["event"] = public_event(live)
                if live.get("hidden_for_review"):
                    item["status"] = "under_review"
                else:
                    item["status"] = "live"
                    stored = await db.event_keys.find_one({"event_id": s["id"]})
                    if stored:
                        item["organiser_link"] = f"/organiser/{s['id']}?key={stored['key']}"
        out.append(item)
    from app.services.places import public_place
    places = await db.places.find({"submitted_by": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"events": out,
            "places": [{"place": public_place(p), "status": p.get("status"),
                        "reason": (p.get("review") or {}).get("reason")} for p in places]}


# ── Admin review ─────────────────────────────────────────────────────────────

@router.get("/admin/submissions")
async def submissions_queue(admin: dict = Depends(require_admin)):
    """Submissions waiting for approval and live events taken down by reports."""
    waiting = await db.event_submissions.find({"status": "pending"}, {"_id": 0}).sort("created_at", 1).to_list(200)
    held = await db.venues.find({"kind": KIND_EVENT, "hidden_for_review": True}, {"_id": 0}).to_list(200)
    listed = await db.venues.find({"kind": KIND_EVENT}, {"_id": 0}).to_list(2000)
    out = []
    for r in waiting + held:
        dup = find_duplicate(r, [o for o in listed + waiting if o["id"] != r["id"]])
        priv = await _private(r["id"])
        out.append({
            "event": public_event(r),
            "state": "pending" if r in waiting else "taken_down",
            "submitted_by": priv.get("submitted_by"),
            "claimed_organiser": priv.get("claimed_organiser"),
            "claimed_ticket_url": priv.get("claimed_ticket_url"),
            "reports": await db.event_reports.find({"event_id": r["id"]}, {"_id": 0}).to_list(100),
            "possible_duplicate": {"id": dup["id"], "name": dup["name"]} if dup else None,
        })
    return {"events": out}


@router.post("/admin/events/{event_id}/approve")
async def approve_event(event_id: str, payload: dict | None = None, admin: dict = Depends(require_admin)):
    """
    Approve a submission (it goes on the map) or put a taken-down event back up.
    The admin may correct the pin or the ground size. The approved spot becomes
    the anchor every later on-site move is measured from.
    """
    payload = payload or {}
    sub = await db.event_submissions.find_one({"id": event_id, "status": "pending"}, {"_id": 0})
    live = None if sub else await db.venues.find_one({"id": event_id, "kind": KIND_EVENT}, {"_id": 0})
    event = sub or live
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    fix = {}
    if payload.get("coordinates") or payload.get("geofence_radius_m"):
        check = {**event, **{k: payload[k] for k in ("coordinates", "geofence_radius_m") if payload.get(k)}}
        problems = validate_event(check)
        if problems:
            raise HTTPException(status_code=422, detail={"problems": problems})
        if payload.get("coordinates"):
            fix["coordinates"] = {"lat": float(payload["coordinates"]["lat"]),
                                  "lng": float(payload["coordinates"]["lng"])}
            await _log_move(event, fix["coordinates"], admin["id"], "corrected at approval")
        if payload.get("geofence_radius_m"):
            fix["geofence_radius_m"] = float(payload["geofence_radius_m"])
    now = datetime.now(timezone.utc)
    if sub:
        public = {k: v for k, v in sub.items() if k not in ("status", "submitted_by", "reason")}
        await db.venues.insert_one({**public, **fix, "approved": True})
        await db.event_submissions.update_one({"id": event_id}, {"$set": {"status": "approved", "approved_at": now}})
    else:
        await db.venues.update_one({"id": event_id}, {"$set": {**fix, "hidden_for_review": False},
                                                       "$unset": {"is_suppressed": ""}})
    # A new approval, or an explicit admin correction, sets the anchor. Putting
    # a taken-down event back up keeps the anchor and the fixes already used.
    if sub or fix.get("coordinates"):
        await set_anchor(event_id, fix.get("coordinates") or event["coordinates"])
    await _set_private(event_id, {"review": {"by": admin["id"], "at": now}})
    if not await db.event_keys.find_one({"event_id": event_id}):
        await db.event_keys.insert_one({"event_id": event_id, "key": new_organiser_key(), "created_at": now})
    return {"approved": event_id}


@router.post("/admin/events/{event_id}/reject")
async def reject_event(event_id: str, payload: dict, admin: dict = Depends(require_admin)):
    """Reject a submission, or take a live event down for good. The organiser link stops working."""
    reason = (payload.get("reason") or "").strip()
    if not reason or len(reason) > 500:
        raise HTTPException(status_code=422, detail="Give the reason the submitter will see (at most 500 characters).")
    now = datetime.now(timezone.utc)
    sub = await db.event_submissions.find_one({"id": event_id})
    live = await db.venues.find_one({"id": event_id, "kind": KIND_EVENT})
    if not sub and not live:
        raise HTTPException(status_code=404, detail="Event not found")
    if sub:
        await db.event_submissions.update_one({"id": event_id}, {"$set": {"status": "rejected", "reason": reason}})
    if live:
        await db.venues.delete_one({"id": event_id, "kind": KIND_EVENT})
    await db.event_keys.delete_many({"event_id": event_id})
    await db.event_covers.delete_many({"event_id": event_id})
    await _set_private(event_id, {"review": {"by": admin["id"], "at": now, "reason": reason}})
    return {"rejected": event_id}


def _cover_response(cover: dict) -> Response:
    return Response(content=cover["data"], media_type=cover["content_type"],
                    headers={"Cache-Control": "public, max-age=3600"})


@router.get("/events/{event_id}/cover")
async def event_cover(event_id: str):
    """An event's cover photo, once the event is approved and not taken down."""
    event = await db.venues.find_one({"id": event_id, "kind": KIND_EVENT})
    cover = await db.event_covers.find_one({"event_id": event_id}) if event and not is_held(event) else None
    if not cover:
        raise HTTPException(status_code=404, detail="No cover photo")
    return _cover_response(cover)


@router.get("/admin/events/{event_id}/cover")
async def event_cover_for_review(event_id: str, admin: dict = Depends(require_admin)):
    """The cover photo of any event, pending or not, so it can be checked before approval."""
    cover = await db.event_covers.find_one({"event_id": event_id})
    if not cover:
        raise HTTPException(status_code=404, detail="No cover photo")
    return _cover_response(cover)


@router.post("/admin/events/{event_id}/move")
async def admin_move(event_id: str, payload: dict, admin: dict = Depends(require_admin)):
    """Move the pin, for example to where the crowd is gathering. Logged; becomes the new anchor."""
    event = await _event_or_404(event_id)
    try:
        to = {"lat": float(payload["lat"]), "lng": float(payload["lng"])}
    except (KeyError, TypeError, ValueError):
        raise HTTPException(status_code=422, detail="Give lat and lng.")
    problems = validate_event({**event, "coordinates": to})
    if problems:
        raise HTTPException(status_code=422, detail={"problems": problems})
    why = (payload.get("reason") or "moved by admin")[:200]
    await _log_move(event, to, admin["id"], why)
    await db.venues.update_one({"id": event_id}, {"$set": {"coordinates": to}})
    await set_anchor(event_id, to)
    return {"moved": event_id, "to": to}


@router.get("/admin/events/{event_id}/location")
async def admin_location(event_id: str, admin: dict = Depends(require_admin)):
    event = await _event_or_404(event_id)
    log = await db.event_location_log.find({"event_id": event_id}, {"_id": 0}).sort("at", 1).to_list(200)
    priv = await _private(event_id)
    return {"location": await location_picture(event), "pending_location": priv.get("pending_location"),
            "moves": log}


# ── Reports ──────────────────────────────────────────────────────────────────

@router.post("/events/{event_id}/report")
async def report_event(event_id: str, payload: dict, user: dict = Depends(require_auth)):
    """
    Anyone signed in can report a listed event once. Three different people
    take a community listing off the map until an admin looks; an Official
    event is flagged for review but stays up.
    """
    reason = payload.get("reason")
    if reason not in REPORT_REASONS:
        raise HTTPException(status_code=422, detail=f"Reason must be one of: {', '.join(REPORT_REASONS)}.")
    event = await _event_or_404(event_id)
    if await db.event_reports.find_one({"event_id": event_id, "user_id": user["id"]}):
        return {"reported": event_id, "already": True}
    await db.event_reports.insert_one({"event_id": event_id, "user_id": user["id"], "reason": reason,
                                       "detail": (payload.get("detail") or "")[:500],
                                       "at": datetime.now(timezone.utc)})
    reporters = len(await db.event_reports.distinct("user_id", {"event_id": event_id}))
    if should_hide_for_reports(reporters, listing_of(event) == LISTING_OFFICIAL):
        # is_suppressed too, so the many venue queries that already honour it drop it.
        await db.venues.update_one({"id": event_id}, {"$set": {"hidden_for_review": True, "is_suppressed": True}})
    elif reporters >= REPORTS_TO_HIDE:
        await db.venues.update_one({"id": event_id}, {"$set": {"flagged_for_review": True}})
    return {"reported": event_id}


# ── Organiser on site ────────────────────────────────────────────────────────

async def _event_for_key(event_id: str, key: str) -> dict:
    """The event behind an organiser link. A rejected or taken-down event's link stops working."""
    event = await db.venues.find_one({"id": event_id, "kind": KIND_EVENT})
    stored = await db.event_keys.find_one({"event_id": event_id}) if event else None
    if not event or not stored or not secrets.compare_digest(str(stored.get("key", "")), str(key)):
        raise HTTPException(status_code=404, detail="Event not found")
    if is_held(event):
        raise HTTPException(status_code=404, detail="Event not found")
    return event


@router.post("/organiser/events/{event_id}/here")
async def organiser_here(event_id: str, payload: dict, key: str = Query(...)):
    """
    "I'm here, use my location." The organiser stands at the grounds and the
    phone's fix becomes the centre. Refused when the fix is worse than 50 m.

    Every move is measured from the spot the admin approved, never from the
    last move, and only ON_SITE_FIXES_ALLOWED fixes apply without an admin, so
    an organiser link cannot walk a geofence across the city step by step.
    A longer move, or one past the allowance, waits for an admin.
    """
    event = await _event_for_key(event_id, key)
    try:
        lat, lng = float(payload["lat"]), float(payload["lng"])
    except (KeyError, TypeError, ValueError):
        raise HTTPException(status_code=422, detail="Send lat, lng and accuracy_m from the phone.")
    priv = await _private(event_id)
    anchor = priv.get("approved_coordinates")
    to = {"lat": lat, "lng": lng}
    now = datetime.now(timezone.utc)

    async def hold(distance):
        await _set_private(event_id, {"pending_location": {**to, "distance_m": distance, "at": now}})
        return {"decision": "needs_admin", "distance_m": distance,
                "message": "VIIBE will check this location before moving the pin."}

    # No approved anchor (an event from before anchors existed): fail closed,
    # never measure from wherever the pin happens to be now.
    if not anchor:
        return await hold(None)
    move = calculate_distance(anchor["lat"], anchor["lng"], lat, lng)
    official = listing_of(event) == LISTING_OFFICIAL
    decision = on_site_decision(payload.get("accuracy_m"), move, official)
    if decision == "too_imprecise":
        return {"decision": decision,
                "message": "Your phone's location is not precise enough. Step outside or wait a moment and try again."}
    if decision == "needs_admin":
        return await hold(round(move))
    # Claim one of the free fixes atomically, so two requests at once cannot
    # both slip under the allowance.
    claimed = await db.event_private.find_one_and_update(
        {"event_id": event_id, "on_site_fixes": {"$lt": ON_SITE_FIXES_ALLOWED}},
        {"$inc": {"on_site_fixes": 1}})
    if not claimed:
        return await hold(round(move))
    await _log_move(event, to, "organiser_link", "set on site")
    await db.venues.update_one({"id": event_id}, {"$set": {
        "coordinates": to, "location_set_on_site": True, "location_set_at": now}})
    # A shared place is never changed by an organiser link. An Official
    # organiser's fix is offered to the admin as the place's location.
    if event.get("place_id") and official:
        await db.places.update_one({"id": event["place_id"]}, {"$set": {
            "proposed_location": {**to, "from_event": event_id, "at": now}}})
    return {"decision": "apply", "distance_m": round(move), "to": to}
