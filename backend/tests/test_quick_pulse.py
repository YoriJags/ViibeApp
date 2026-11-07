"""Quick pulse: only from the signed-in person, only from inside the venue."""
import asyncio

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

mongomock_motor = pytest.importorskip("mongomock_motor")

PIN = {"lat": 6.4307508, "lng": 3.4374689}


@pytest.fixture
def env(monkeypatch):
    db = mongomock_motor.AsyncMongoMockClient()["viibe_test"]
    import app.config
    import app.routes.quick_pulse as qp
    import app.services.auth as auth
    for mod in (app.config, qp, auth):
        monkeypatch.setattr(mod, "db", db, raising=False)
    asyncio.run(db.users.insert_one({"id": "u1", "clout_points": 0}))
    asyncio.run(db.venues.insert_one({"id": "v1", "city": "lagos", "coordinates": PIN,
                                      "geofence_radius_m": 100, "venue_type": "lounge"}))

    async def as_user():
        return {"id": "u1"}

    app_ = FastAPI()
    app_.include_router(qp.router, prefix="/api")
    app_.dependency_overrides[auth.require_auth] = as_user
    return TestClient(app_), db


def test_a_pulse_from_inside_counts_once_per_15_minutes(env):
    client, db = env
    body = {"venue_id": "v1", **PIN}
    r = client.post("/api/pulse", json=body)
    assert r.status_code == 200 and r.json()["clout_earned"] == 3
    assert client.post("/api/pulse", json=body).status_code == 429
    assert asyncio.run(db.quick_pulses.count_documents({})) == 1


def test_a_pulse_from_outside_or_without_a_position_is_refused(env):
    client, db = env
    assert client.post("/api/pulse", json={"venue_id": "v1", "lat": 6.45, "lng": 3.40}).status_code == 400
    assert client.post("/api/pulse", json={"venue_id": "v1"}).status_code == 422
    assert asyncio.run(db.quick_pulses.count_documents({})) == 0


def test_the_body_cannot_name_someone_else(env):
    client, db = env
    client.post("/api/pulse", json={"venue_id": "v1", "user_id": "someone-else", **PIN})
    assert asyncio.run(db.quick_pulses.find_one({}))["user_id"] == "u1"
