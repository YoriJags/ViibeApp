"""
End-to-end: events, auto check-in, "when to leave" and the organiser screen,
through the real routes against an in-memory MongoDB.

The pure logic has its own tests. These exist because route code is where a
wrong field name, a missing await or a leaked secret actually hides.
"""
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

mongomock_motor = pytest.importorskip("mongomock_motor")

ADMIN = {"id": "admin-1", "username": "yori", "is_super_admin": True}
SCOUT = {"id": "scout-1", "username": "tobi"}
SCOUT_2 = {"id": "scout-2", "username": "amara"}

GROUND = {"lat": 6.4253, "lng": 3.4100}


@pytest.fixture
def env(monkeypatch):
    db = mongomock_motor.AsyncMongoMockClient()["viibe_test"]

    import app.config
    import app.routes.events as events_routes
    import app.routes.presence as presence_routes
    import app.routes.venues as venue_routes
    import app.routes.merchant as merchant_routes
    import app.services.auth as auth
    for mod in (app.config, events_routes, presence_routes, venue_routes, merchant_routes, auth):
        monkeypatch.setattr(mod, "db", db, raising=False)

    async def no_broadcast(*a, **k):
        return None
    monkeypatch.setattr(presence_routes, "emit_checkin_update", no_broadcast)

    current = {"user": SCOUT}

    async def as_admin():
        return ADMIN

    async def as_current():
        return current["user"]

    app_ = FastAPI()
    for r in (events_routes.router, presence_routes.router, venue_routes.router, merchant_routes.router):
        app_.include_router(r, prefix="/api")
    app_.dependency_overrides[auth.require_admin] = as_admin
    app_.dependency_overrides[auth.require_auth] = as_current
    return TestClient(app_), db, current


def make_event(client, entry="ticketed", start_in=timedelta(minutes=-30), hours=6):
    start = datetime.now(timezone.utc) + start_in
    r = client.post("/api/admin/events", json={
        "name": "Lagos Festival Test", "venue_type": "festival", "entry": entry,
        "coordinates": GROUND, "geofence_radius_m": 300, "area": "Victoria Island",
        "starts_at": start.isoformat(), "ends_at": (start + timedelta(hours=hours)).isoformat(),
    })
    assert r.status_code == 200, r.text
    body = r.json()
    key = body["organiser_link"].split("key=")[1]
    return body["event"]["id"], key


def test_creating_an_event_keeps_its_key_off_the_event(env):
    client, db, _ = env
    event_id, key = make_event(client)
    import asyncio
    doc = asyncio.run(db.venues.find_one({"id": event_id}))
    assert doc["kind"] == "event"
    assert not any("key" in k for k in doc), "the secret must not live on the event"
    stored = asyncio.run(db.event_keys.find_one({"event_id": event_id}))
    assert stored["key"] == key


def test_a_bad_event_is_refused_with_reasons(env):
    client, _, _ = env
    r = client.post("/api/admin/events", json={"name": "", "venue_type": "brunch", "entry": "free"})
    assert r.status_code == 422
    assert len(r.json()["detail"]["problems"]) >= 3


def test_events_appear_on_the_map_only_around_their_dates(env):
    client, _, _ = env
    live_id, _ = make_event(client)
    far_id, _ = make_event(client, start_in=timedelta(days=30))
    ids = {v["id"]: v for v in client.get("/api/venues?city=lagos").json()}
    assert live_id in ids and far_id not in ids
    assert ids[live_id]["event"]["phase"] == "live"
    assert ids[live_id]["event"]["promise"] == "timing"
    listed = [e["id"] for e in client.get("/api/events?city=lagos").json()]
    assert live_id in listed and far_id not in listed


def test_the_organiser_link_refuses_a_wrong_key_without_confirming_the_event(env):
    client, _, _ = env
    event_id, key = make_event(client)
    assert client.get(f"/api/organiser/events/{event_id}?key=wrong").status_code == 404
    assert client.get(f"/api/organiser/events/nope?key={key}").status_code == 404
    ok = client.get(f"/api/organiser/events/{event_id}?key={key}")
    assert ok.status_code == 200
    data = ok.json()
    assert data["energy"]["label"] is None, "no real reading, so no energy shown"
    assert data["gate"]["consensus"] is None


def test_an_arrival_shows_on_the_organiser_screen_and_in_the_flow(env):
    client, _, current = env
    event_id, key = make_event(client)
    current["user"] = SCOUT
    r = client.post("/api/presence/enter", json={"venue_id": event_id, **GROUND})
    assert r.status_code == 200 and r.json()["action"] == "open"
    data = client.get(f"/api/organiser/events/{event_id}?key={key}").json()
    assert data["flow"]["arrivals"] == 1, data["flow"]
    # Under three minutes in, it is still a possible walk-past: not yet "present".
    assert data["present_now"] == 0


def test_an_arrival_without_a_position_is_logged_but_never_counted(env):
    client, _, current = env
    event_id, key = make_event(client)
    current["user"] = SCOUT_2
    assert client.post("/api/presence/enter", json={"venue_id": event_id}).status_code == 200
    data = client.get(f"/api/organiser/events/{event_id}?key={key}").json()
    assert data["flow"]["arrivals"] == 0


def test_a_jammed_gate_tells_ticket_holders_to_wait(env):
    client, db, _ = env
    event_id, key = make_event(client)
    import asyncio
    now = datetime.now(timezone.utc)
    for uid in ("real-a", "real-b"):
        asyncio.run(db.ratings.insert_one({
            "venue_id": event_id, "user_id": uid, "gate": "blocked",
            "timestamp": now - timedelta(minutes=5), "vibe_score": 60,
        }))
    timing = client.get(f"/api/events/{event_id}/timing").json()
    assert timing["promise"] == "timing"
    assert timing["advice"] == "wait"
    told = client.get(f"/api/organiser/events/{event_id}?key={key}").json()["attendees_are_told"]
    assert told["advice"] == "wait", "the organiser sees exactly what attendees see"


def test_demo_gate_readings_never_count(env):
    client, db, _ = env
    event_id, _ = make_event(client)
    import asyncio
    now = datetime.now(timezone.utc)
    for i in range(3):
        asyncio.run(db.ratings.insert_one({
            "venue_id": event_id, "user_id": f"demo-scout-{i}", "gate": "blocked",
            "timestamp": now - timedelta(minutes=5), "synthetic": True,
        }))
    assert client.get(f"/api/events/{event_id}/timing").json()["advice"] == "no_data"


def test_a_door_event_makes_the_worth_promise_instead(env):
    client, _, _ = env
    event_id, _ = make_event(client, entry="door")
    assert client.get(f"/api/events/{event_id}/timing").json() == {"promise": "worth", "advice": None}


def test_merchant_event_routes_now_require_an_owner(env):
    """These three routes used to accept anyone, and crash when signed out."""
    client, _, _ = env
    r = client.post("/api/merchant/venues/any-venue/events", json={
        "name": "x", "event_type": "dj_night", "expected_start": "2026-12-01T20:00:00",
        "expected_end": "2026-12-01T23:00:00", "expected_crowd": 100})
    assert r.status_code == 401
    assert client.delete("/api/merchant/venues/any-venue/events/e1").status_code == 401
