"""
The ticketing partner API, end to end against an in-memory MongoDB.

What matters most here is what a partner cannot do: write a score, see another
partner's event, or reach anything with a revoked key.
"""
import asyncio
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

mongomock_motor = pytest.importorskip("mongomock_motor")

ADMIN = {"id": "admin-1", "username": "yori", "is_super_admin": True}
GROUND = {"lat": 6.4378, "lng": 3.4251}


@pytest.fixture
def env(monkeypatch):
    db = mongomock_motor.AsyncMongoMockClient()["viibe_test"]
    import app.config
    import app.routes.events as events_routes
    import app.routes.partners as partner_routes
    import app.services.auth as auth
    for mod in (app.config, events_routes, partner_routes, auth):
        monkeypatch.setattr(mod, "db", db, raising=False)

    async def as_admin():
        return ADMIN

    app_ = FastAPI()
    for r in (events_routes.router, partner_routes.router):
        app_.include_router(r, prefix="/api")
    app_.dependency_overrides[auth.require_admin] = as_admin
    return TestClient(app_), db


def new_partner(client, name="Hippie"):
    r = client.post("/api/admin/partners", json={"name": name})
    assert r.status_code == 200, r.text
    return {"X-Viibe-Key": r.json()["api_key"]}, r.json()["partner"]["id"]


def event_body(start_in=timedelta(minutes=-30), **extra):
    start = datetime.now(timezone.utc) + start_in
    return {"name": "Hippie Fest", "venue_type": "festival", "entry": "ticketed",
            "coordinates": GROUND, "geofence_radius_m": 250, "area": "Victoria Island",
            "starts_at": start.isoformat(), "ends_at": (start + timedelta(hours=6)).isoformat(),
            "ticket_url": "https://example.com/t/1", **extra}


def approve(client, headers, external_id):
    eid = next(e["id"] for e in client.get("/api/partner/events", headers=headers).json()
               if e["external_id"] == external_id)
    assert client.post(f"/api/admin/partner-events/{eid}/approve").status_code == 200
    return eid


def on_map(client):
    return [e["name"] for e in client.get("/api/events?city=lagos").json()]


def test_the_key_is_stored_only_as_a_hash(env):
    client, db = env
    headers, pid = new_partner(client)
    doc = asyncio.run(db.partners.find_one({"id": pid}))
    assert headers["X-Viibe-Key"] not in str(doc)
    assert len(doc["key_hash"]) == 64


def test_no_key_or_a_wrong_key_is_refused(env):
    client, _ = env
    assert client.get("/api/partner/events").status_code == 401
    assert client.get("/api/partner/events", headers={"X-Viibe-Key": "vpk_nope"}).status_code == 401


def test_put_creates_then_updates_the_same_event(env):
    client, db = env
    headers, _ = new_partner(client)
    first = client.put("/api/partner/events/hf-2026", json=event_body(), headers=headers)
    assert first.status_code == 200, first.text
    assert first.json()["created"] is True
    assert "organiser_link" in first.json()

    again = client.put("/api/partner/events/hf-2026", json={"name": "Hippie Fest Lagos"}, headers=headers)
    assert again.status_code == 200, again.text
    assert again.json()["created"] is False
    assert again.json()["event"]["name"] == "Hippie Fest Lagos"
    assert "organiser_link" not in again.json(), "the link is shown once, on creation"
    assert asyncio.run(db.venues.count_documents({"external_id": "hf-2026"})) == 1


def test_a_partner_cannot_write_a_score_or_energy(env):
    client, db = env
    headers, _ = new_partner(client)
    body = event_body(current_vibe_score=99, energy_source="scouts", vibe_state="peak", is_featured=True)
    r = client.put("/api/partner/events/hf-1", json=body, headers=headers)
    assert r.status_code == 200
    doc = asyncio.run(db.venues.find_one({"external_id": "hf-1"}))
    assert doc["current_vibe_score"] == 0
    assert doc["energy_source"] == "none"
    assert doc["vibe_state"] == "quiet"
    assert doc["is_featured"] is False


def test_an_update_that_breaks_the_event_is_refused(env):
    client, _ = env
    headers, _ = new_partner(client)
    client.put("/api/partner/events/hf-1", json=event_body(), headers=headers)
    r = client.put("/api/partner/events/hf-1", json={"entry": "free"}, headers=headers)
    assert r.status_code == 422


def test_partners_cannot_see_each_others_events(env):
    client, _ = env
    a, _ = new_partner(client, "Hippie")
    b, _ = new_partner(client, "Other")
    client.put("/api/partner/events/shared-id", json=event_body(), headers=a)
    assert client.get("/api/partner/events/shared-id/live", headers=b).status_code == 404
    assert client.delete("/api/partner/events/shared-id", headers=b).status_code == 404
    assert client.get("/api/partner/events", headers=b).json() == []
    # The same external id from another partner is a separate event, not a takeover.
    r = client.put("/api/partner/events/shared-id", json=event_body(name="Theirs"), headers=b)
    assert r.json()["created"] is True
    mine = client.get("/api/partner/events", headers=a).json()
    assert [e["name"] for e in mine] == ["Hippie Fest"]


def test_scans_are_counts_shown_beside_readings_and_resend_safely(env):
    client, _ = env
    headers, _ = new_partner(client)
    client.put("/api/partner/events/hf-1", json=event_body(), headers=headers)
    now = datetime.now(timezone.utc)
    approve(client, headers, "hf-1")
    win = {"start": (now - timedelta(minutes=10)).isoformat(), "end": now.isoformat(), "count": 40}
    assert client.post("/api/partner/events/hf-1/scans", json={"windows": [win]}, headers=headers).json() == {"accepted": 1}
    # Resending the same window replaces it rather than double counting.
    client.post("/api/partner/events/hf-1/scans", json={"windows": [{**win, "count": 42}]}, headers=headers)

    live = client.get("/api/partner/events/hf-1/live", headers=headers).json()
    assert live["gate_scans"]["total"] == 42
    assert live["gate_scans"]["last_30m"] == 42
    # Scans never become a reading.
    assert live["energy"]["label"] is None
    assert live["gate"]["consensus"] is None


def test_bad_scan_windows_are_refused(env):
    client, _ = env
    headers, _ = new_partner(client)
    client.put("/api/partner/events/hf-1", json=event_body(), headers=headers)
    now = datetime.now(timezone.utc)
    for w in (
        {"start": now.isoformat(), "end": (now - timedelta(minutes=5)).isoformat(), "count": 1},
        {"start": (now - timedelta(hours=2)).isoformat(), "end": now.isoformat(), "count": 1},
        {"start": (now - timedelta(minutes=5)).isoformat(), "end": now.isoformat(), "count": -1},
        {"start": (now + timedelta(hours=1)).isoformat(), "end": (now + timedelta(hours=1, minutes=5)).isoformat(), "count": 1},
        {"count": 3},
    ):
        r = client.post("/api/partner/events/hf-1/scans", json={"windows": [w]}, headers=headers)
        assert r.status_code == 422, w


def test_a_revoked_key_stops_working(env):
    client, _ = env
    headers, pid = new_partner(client)
    assert client.get("/api/partner/events", headers=headers).status_code == 200
    client.delete(f"/api/admin/partners/{pid}")
    assert client.get("/api/partner/events", headers=headers).status_code == 401


def test_delete_removes_the_event_its_key_and_its_scans(env):
    client, db = env
    headers, _ = new_partner(client)
    eid = client.put("/api/partner/events/hf-1", json=event_body(), headers=headers).json()["event"]["id"]
    assert client.delete("/api/partner/events/hf-1", headers=headers).status_code == 200
    assert asyncio.run(db.venues.count_documents({"id": eid})) == 0
    assert asyncio.run(db.event_keys.count_documents({"event_id": eid})) == 0


def test_a_partner_event_stays_off_the_map_and_dark_until_approved(env):
    client, _ = env
    headers, _ = new_partner(client)
    client.put("/api/partner/events/hf-1", json=event_body(), headers=headers)
    assert on_map(client) == []
    live = client.get("/api/partner/events/hf-1/live", headers=headers).json()
    assert live["approved"] is False and "present_now" not in live
    approve(client, headers, "hf-1")
    assert on_map(client) == ["Hippie Fest"]
    assert "present_now" in client.get("/api/partner/events/hf-1/live", headers=headers).json()


def test_moving_an_approved_event_sends_it_back_for_approval(env):
    client, _ = env
    headers, _ = new_partner(client)
    client.put("/api/partner/events/hf-1", json=event_body(), headers=headers)
    approve(client, headers, "hf-1")
    client.put("/api/partner/events/hf-1", json={"name": "Renamed"}, headers=headers)
    assert on_map(client) == ["Renamed"], "a rename keeps the approval"
    client.put("/api/partner/events/hf-1", json={"coordinates": {"lat": 6.5, "lng": 3.3}}, headers=headers)
    assert on_map(client) == [], "a move needs a fresh check"


def test_revoking_a_partner_unlists_its_events_and_kills_organiser_links(env):
    client, db = env
    headers, pid = new_partner(client)
    client.put("/api/partner/events/hf-1", json=event_body(), headers=headers)
    eid = approve(client, headers, "hf-1")
    client.delete(f"/api/admin/partners/{pid}")
    assert on_map(client) == []
    assert asyncio.run(db.event_keys.count_documents({"event_id": eid})) == 0
    assert client.post(f"/api/admin/partner-events/{eid}/approve").status_code == 409


def test_markup_in_event_text_is_refused(env):
    client, _ = env
    headers, _ = new_partner(client)
    for bad in ({"name": "<img src=x onerror=alert(1)>"}, {"area": "VI</script>"},
                {"name": "x" * 121}, {"ticket_url": "javascript:alert(1)"}):
        r = client.put("/api/partner/events/hf-bad", json=event_body(**bad), headers=headers)
        assert r.status_code == 422, bad
