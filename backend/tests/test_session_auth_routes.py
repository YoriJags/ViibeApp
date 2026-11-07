"""
Routes that read the raw Authorization header used to look the token up as
users.token, a field nothing writes, so every signed-in person got a 401 on
follow and heading. They now resolve the session like every other route.
"""
import asyncio
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

mongomock_motor = pytest.importorskip("mongomock_motor")


@pytest.fixture
def env(monkeypatch):
    db = mongomock_motor.AsyncMongoMockClient()["viibe_test"]
    import app.config
    import app.routes.venue_live as venue_live
    import app.services.auth as auth
    for mod in (app.config, venue_live, auth):
        monkeypatch.setattr(mod, "db", db, raising=False)

    async def quiet(*a, **k):
        return None
    monkeypatch.setattr(venue_live.sio, "emit", quiet)

    asyncio.run(db.users.insert_one({"id": "u1", "username": "tobi"}))
    asyncio.run(db.venues.insert_one({"id": "v1", "name": "Mercury Lagos", "city": "lagos",
                                      "coordinates": {"lat": 6.43, "lng": 3.437}}))
    asyncio.run(db.user_sessions.insert_one({
        "user_id": "u1", "session_token": "good",
        "expires_at": datetime.now(timezone.utc) + timedelta(days=1)}))
    asyncio.run(db.user_sessions.insert_one({
        "user_id": "u1", "session_token": "old",
        "expires_at": datetime.now(timezone.utc) - timedelta(days=1)}))

    app_ = FastAPI()
    app_.include_router(venue_live.router, prefix="/api")
    return TestClient(app_), db


def test_a_signed_in_user_can_follow_and_say_maybe(env):
    client, db = env
    h = {"Authorization": "Bearer good"}
    assert client.post("/api/venues/v1/follow", headers=h).status_code == 200
    assert client.get("/api/venues/v1/follow-status", headers=h).json()["following"] is True
    r = client.post("/api/venues/v1/heading", json={"status": "maybe"}, headers=h)
    assert r.status_code == 200 and r.json()["maybe"] == 1


def test_no_session_or_an_expired_one_is_refused(env):
    client, _ = env
    assert client.post("/api/venues/v1/follow").status_code == 401
    assert client.post("/api/venues/v1/follow", headers={"Authorization": "Bearer old"}).status_code == 401
    assert client.post("/api/venues/v1/follow", headers={"Authorization": "Bearer nope"}).status_code == 401
    assert client.get("/api/venues/v1/follow-status",
                      headers={"Authorization": "Bearer old"}).json()["following"] is False
