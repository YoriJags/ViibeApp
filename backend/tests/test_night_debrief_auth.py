"""
The night debrief names the places a person went tonight. It used to answer
anyone who knew a user id. Only the signed-in owner may read it now.
"""
import asyncio
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

mongomock_motor = pytest.importorskip("mongomock_motor")


@pytest.fixture
def client(monkeypatch):
    db = mongomock_motor.AsyncMongoMockClient()["viibe_test"]
    import app.config
    import app.routes.ai_features as ai_features
    import app.services.auth as auth
    for mod in (app.config, ai_features, auth):
        monkeypatch.setattr(mod, "db", db, raising=False)

    for uid, token in (("u1", "t1"), ("u2", "t2")):
        asyncio.run(db.users.insert_one({"id": uid, "username": uid}))
        asyncio.run(db.user_sessions.insert_one({
            "user_id": uid, "session_token": token,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=1)}))

    app_ = FastAPI()
    app_.include_router(ai_features.router, prefix="/api")
    return TestClient(app_)


def test_signed_out_is_refused(client):
    assert client.get("/api/users/u1/night-debrief").status_code == 401


def test_another_user_is_refused(client):
    r = client.get("/api/users/u1/night-debrief", headers={"Authorization": "Bearer t2"})
    assert r.status_code == 403


def test_owner_can_read(client):
    r = client.get("/api/users/u1/night-debrief", headers={"Authorization": "Bearer t1"})
    assert r.status_code == 200
    assert r.json()["debrief"] is None
