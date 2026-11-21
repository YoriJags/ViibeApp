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
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query

from app.config import db
from app.services.auth import require_admin, require_auth
from app.services.crowd_flow import arrival_curve, flow_for
from app.services.event_trust import (
    REPORT_REASONS,
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
    event = await db.venues.find_one({"id": event_id, "kind": KIND_EVENT}, {"_id": 0})
    stored = await db.event_keys.find_one({"event_id": event_id}) if event else None
    if not event or not stored or not secrets.compare_digest(str(stored.get("key", "")), str(key)):
        raise HTTPException(status_code=404, detail="Event not found")
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

async def _organiser_certification(user_id: str) -> dict | None:
    from app.routes.certification import certified_record
    return await certified_record(user_id, "organiser")


@router.post("/events/submit")
async def submit_event(payload: dict, user: dict = Depends(require_auth)):
    """
    Anyone signed in can put an event forward. It stays off the map, and no
    phone watches its ground, until an admin approves it. A certified
    organiser's event is Official; anyone else's is a community listing that
    shows no organiser name and no ticket link.
    """
    from app.routes.places import submissions_today_and_pending
    payload = dict(payload)
    place = None
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

    cert = await _organiser_certification(user["id"])
    claimed = (payload.get("organiser_name") or "").strip() or None
    payload["source"] = SOURCE_COMMUNITY
    payload["organiser_name"] = cert["name"] if cert else None
    doc = new_event_document(payload, created_by=user["id"])
    doc.update({
        "submitted_by": user["id"],
        "approved": False,
        "listing": LISTING_OFFICIAL if cert else LISTING_COMMUNITY,
        # What they claimed, for the admin only. Never shown publicly.
        "claimed_organiser": claimed,
    })

    nearby = await db.venues.find({"kind": KIND_EVENT, "city": doc["city"], "rejected": {"$ne": True}},
                                  {"_id": 0}).to_list(2000)
    dup = find_duplicate(doc, nearby)
    if dup:
        detail = {"problems": ["This event looks already listed at the same place and time."]}
        if is_listed(dup):
            detail["existing"] = {"id": dup["id"], "name": dup["name"]}
        raise HTTPException(status_code=409, detail=detail)

    await db.venues.insert_one(dict(doc))
    return {"event": public_event(doc), "status": "pending"}


@router.get("/me/submissions")
async def my_submissions(user: dict = Depends(require_auth)):
    """The submitter's own events and places, with their organiser link once approved."""
    events = await db.venues.find({"kind": KIND_EVENT, "submitted_by": user["id"]}, {"_id": 0}) \
        .sort("created_at", -1).to_list(100)
    out = []
    for e in events:
        status = ("rejected" if e.get("rejected") else "under_review" if e.get("hidden_for_review")
                  else "live" if e.get("approved") else "pending")
        item = {"event": public_event(e), "status": status}
        if status == "rejected":
            item["reason"] = e.get("rejected_reason")
        if e.get("approved"):
            stored = await db.event_keys.find_one({"event_id": e["id"]})
            if stored:
                item["organiser_link"] = f"/organiser/{e['id']}?key={stored['key']}"
        out.append(item)
    from app.services.places import public_place
    places = await db.places.find({"submitted_by": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"events": out,
            "places": [{"place": public_place(p), "status": p.get("status"),
                        "reason": (p.get("review") or {}).get("reason")} for p in places]}


# ── Admin review ─────────────────────────────────────────────────────────────

@router.get("/admin/submissions")
async def submissions_queue(admin: dict = Depends(require_admin)):
    """Events waiting for approval or taken down by reports, with near duplicates."""
    rows = await db.venues.find(
        {"kind": KIND_EVENT, "rejected": {"$ne": True},
         "$or": [{"source": SOURCE_COMMUNITY, "approved": {"$ne": True}}, {"hidden_for_review": True}]},
        {"_id": 0}).sort("created_at", 1).to_list(200)
    others = await db.venues.find({"kind": KIND_EVENT, "rejected": {"$ne": True}}, {"_id": 0}).to_list(2000)
    out = []
    for r in rows:
        dup = find_duplicate(r, [o for o in others if o["id"] != r["id"]])
        out.append({
            "event": public_event(r),
            "submitted_by": r.get("submitted_by"),
            "claimed_organiser": r.get("claimed_organiser"),
            "reports": r.get("reports", []),
            "hidden_for_review": bool(r.get("hidden_for_review")),
            "possible_duplicate": {"id": dup["id"], "name": dup["name"]} if dup else None,
        })
    return {"events": out}


@router.post("/admin/events/{event_id}/approve")
async def approve_event(event_id: str, payload: dict | None = None, admin: dict = Depends(require_admin)):
    payload = payload or {}
    event = await _event_or_404(event_id)
    update = {"approved": True, "hidden_for_review": False,
              "review": {"by": admin["id"], "at": datetime.now(timezone.utc)}}
    if payload.get("coordinates") or payload.get("geofence_radius_m"):
        check = {**event, **{k: payload[k] for k in ("coordinates", "geofence_radius_m") if payload.get(k)}}
        problems = validate_event(check)
        if problems:
            raise HTTPException(status_code=422, detail={"problems": problems})
        if payload.get("coordinates"):
            to = {"lat": float(payload["coordinates"]["lat"]), "lng": float(payload["coordinates"]["lng"])}
            await _log_move(event, to, admin["id"], "corrected at approval")
            update["coordinates"] = to
        if payload.get("geofence_radius_m"):
            update["geofence_radius_m"] = float(payload["geofence_radius_m"])
    await db.venues.update_one({"id": event_id}, {"$set": update})
    if not await db.event_keys.find_one({"event_id": event_id}):
        await db.event_keys.insert_one({"event_id": event_id, "key": new_organiser_key(),
                                        "created_at": datetime.now(timezone.utc)})
    return {"approved": event_id}


@router.post("/admin/events/{event_id}/reject")
async def reject_event(event_id: str, payload: dict, admin: dict = Depends(require_admin)):
    reason = (payload.get("reason") or "").strip()
    if not reason or len(reason) > 500:
        raise HTTPException(status_code=422, detail="Give the reason the submitter will see (at most 500 characters).")
    await _event_or_404(event_id)
    await db.venues.update_one({"id": event_id}, {"$set": {
        "rejected": True, "approved": False, "rejected_reason": reason,
        "review": {"by": admin["id"], "at": datetime.now(timezone.utc)}}})
    return {"rejected": event_id}


@router.post("/admin/events/{event_id}/move")
async def admin_move(event_id: str, payload: dict, admin: dict = Depends(require_admin)):
    """Move the pin, for example to where the crowd is gathering. Logged with the reason."""
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
    await db.venues.update_one({"id": event_id}, {"$set": {"coordinates": to}, "$unset": {"pending_location": ""}})
    return {"moved": event_id, "to": to}


@router.get("/admin/events/{event_id}/location")
async def admin_location(event_id: str, admin: dict = Depends(require_admin)):
    event = await _event_or_404(event_id)
    log = await db.event_location_log.find({"event_id": event_id}, {"_id": 0}).sort("at", 1).to_list(200)
    return {"location": await location_picture(event), "pending_location": event.get("pending_location"),
            "moves": log}


# ── Reports ──────────────────────────────────────────────────────────────────

@router.post("/events/{event_id}/report")
async def report_event(event_id: str, payload: dict, user: dict = Depends(require_auth)):
    """
    Anyone signed in can report an event once. Three different people take a
    community listing off the map until an admin looks; an Official event is
    flagged for review but stays up.
    """
    reason = payload.get("reason")
    if reason not in REPORT_REASONS:
        raise HTTPException(status_code=422, detail=f"Reason must be one of: {', '.join(REPORT_REASONS)}.")
    detail = (payload.get("detail") or "")[:500]
    event = await _event_or_404(event_id)
    if any(r.get("user_id") == user["id"] for r in event.get("reports", [])):
        return {"reported": event_id, "already": True}
    report = {"user_id": user["id"], "reason": reason, "detail": detail, "at": datetime.now(timezone.utc)}
    reporters = {r["user_id"] for r in event.get("reports", [])} | {user["id"]}
    update = {"$push": {"reports": report}}
    if should_hide_for_reports(len(reporters), listing_of(event) == LISTING_OFFICIAL):
        update["$set"] = {"hidden_for_review": True}
    await db.venues.update_one({"id": event_id}, update)
    return {"reported": event_id}


# ── Organiser on site ────────────────────────────────────────────────────────

async def _event_for_key(event_id: str, key: str) -> dict:
    event = await db.venues.find_one({"id": event_id, "kind": KIND_EVENT})
    stored = await db.event_keys.find_one({"event_id": event_id}) if event else None
    if not event or not stored or not secrets.compare_digest(str(stored.get("key", "")), str(key)):
        raise HTTPException(status_code=404, detail="Event not found")
    return event


@router.post("/organiser/events/{event_id}/here")
async def organiser_here(event_id: str, payload: dict, key: str = Query(...)):
    """
    "I'm here, use my location." The organiser stands at the grounds and the
    phone's fix becomes the centre. Refused when the fix is worse than 50 m.
    A short move is applied; a long one waits for an admin, so an organiser
    link cannot carry a geofence across the city to watch who arrives.
    """
    event = await _event_for_key(event_id, key)
    try:
        lat, lng = float(payload["lat"]), float(payload["lng"])
    except (KeyError, TypeError, ValueError):
        raise HTTPException(status_code=422, detail="Send lat, lng and accuracy_m from the phone.")
    c = event["coordinates"]
    move = calculate_distance(c["lat"], c["lng"], lat, lng)
    certified = listing_of(event) == LISTING_OFFICIAL
    decision = on_site_decision(payload.get("accuracy_m"), move, certified)
    to = {"lat": lat, "lng": lng}
    if decision == "too_imprecise":
        return {"decision": decision,
                "message": "Your phone's location is not precise enough. Step outside or wait a moment and try again."}
    now = datetime.now(timezone.utc)
    if decision == "needs_admin":
        await db.venues.update_one({"id": event_id}, {"$set": {
            "pending_location": {**to, "distance_m": round(move), "at": now, "by": "organiser_link"}}})
        return {"decision": decision, "distance_m": round(move),
                "message": "That is far from the approved spot, so VIIBE will check it before moving the pin."}
    await _log_move(event, to, "organiser_link", "set on site")
    await db.venues.update_one({"id": event_id}, {"$set": {
        "coordinates": to, "location_set_on_site": True, "location_set_at": now}})
    # The place learns the on-site fix too, once, so the next event there starts right.
    if event.get("place_id"):
        place = await db.places.find_one({"id": event["place_id"]})
        if place and not place.get("on_site_fix_at"):
            pc = place["coordinates"]
            if calculate_distance(pc["lat"], pc["lng"], lat, lng) <= 300:
                await db.places.update_one({"id": place["id"]}, {"$set": {
                    "coordinates": to, "location_source": "on_site", "on_site_fix_at": now}})
    return {"decision": "apply", "distance_m": round(move), "to": to}
