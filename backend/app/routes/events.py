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
from app.services.auth import require_admin
from app.services.crowd_flow import arrival_curve, flow_for
from app.services.events import (
    DOORS_LEAD,
    KIND_EVENT,
    event_phase,
    event_summary,
    is_listed,
    new_event_document,
    new_organiser_key,
    promise_for,
    public_event,
    validate_event,
)
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
        "gate_scans": await gate_scans(event_id, now),
        # What the app is telling ticket holders right now, so the promoter
        # sees exactly what their attendees see.
        "attendees_are_told": (await _timing_for(event)) if promise_for(event) == "timing" else None,
        "updated_at": now.isoformat(),
    }
