"""
A Viibe (the Moment route) counts only from someone inside the room. It used
to take any signed-in person at their word; the only location check ran on
the phone.
"""
import asyncio
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

mongomock_motor = pytest.importorskip("mongomock_motor")

VENUE = {"id": "mercury", "name": "Mercury", "coordinates": {"lat": 6.4281, "lng": 3.4219},
         "geofence_radius_m": 100}
NOW = datetime.now(timezone.utc)


@pytest.fixture
def env(monkeypatch):
    db = mongomock_motor.AsyncMongoMockClient()["viibe_test"]
    import app.config
    import app.routes.moments as moments
    import app.services.auth as auth
    import app.services.tap_gate as tap_gate
    for mod in (app.config, moments, auth, tap_gate):
        monkeypatch.setattr(mod, "db", db, raising=False)
    tap_gate._inside_cache.clear()
    moments._venue_moments.clear()
    moments._venue_lock_cooldown.clear()

    async def no_push(**kw):
        return None
    monkeypatch.setattr(moments, "notify_moment_locked", no_push)
    emitted = []

    async def emit(event, data=None, room=None, **kw):
        emitted.append((event, data, room))
    monkeypatch.setattr(moments.sio, "emit", emit)

    asyncio.run(db.venues.insert_one(dict(VENUE)))
    for i in range(6):
        uid = f"u{i}"
        asyncio.run(db.users.insert_one({"id": uid, "username": uid}))
        asyncio.run(db.user_sessions.insert_one({"user_id": uid, "session_token": "t" + uid,
                                                 "expires_at": NOW + timedelta(days=1)}))

    app_ = FastAPI()
    app_.include_router(moments.router, prefix="/api")
    return {"client": TestClient(app_), "db": db, "emitted": emitted}


def fire(env, uid, **pos):
    body = {"gesture": "raise_to_face", "timestamp": 0, "venue_id": "mercury",
            "sensor_snapshot": {"g_force": 1.2, "accel_x": 0, "accel_y": 0, "accel_z": 1}, **pos}
    return env["client"].post("/api/venues/mercury/moment", json=body,
                              headers={"Authorization": "Bearer t" + uid})


def test_signed_in_but_nowhere_near_is_refused_and_not_stored(env):
    r = fire(env, "u0", latitude=6.5, longitude=3.5)
    assert r.status_code == 403
    assert asyncio.run(env["db"].moments.count_documents({})) == 0


def test_no_position_and_no_checkin_is_refused(env):
    assert fire(env, "u0").status_code == 403


def test_standing_in_the_room_counts_without_checking_in(env):
    r = fire(env, "u0", latitude=6.4282, longitude=3.4219)
    assert r.status_code == 200


def test_a_checkin_counts_without_a_position(env):
    asyncio.run(env["db"].checkins.insert_one({
        "user_id": "u0", "venue_id": "mercury", "status": "active", "source": "manual",
        "created_at": NOW - timedelta(minutes=10), "expires_at": NOW + timedelta(hours=3)}))
    assert fire(env, "u0").status_code == 200


def test_five_people_inside_lock_it_and_outsiders_do_not_add_up(env):
    for uid in ("u0", "u1", "u2", "u3"):
        assert fire(env, uid, latitude=6.4282, longitude=3.4219).status_code == 200
    # A fifth person far away cannot complete the lock.
    assert fire(env, "u4", latitude=6.6, longitude=3.6).status_code == 403
    assert not any(e == "moment_locked" for e, _, _ in env["emitted"])
    r = fire(env, "u5", latitude=6.4281, longitude=3.4220)
    assert r.json()["moment_locked"] is True
    assert any(e == "moment_locked" for e, _, _ in env["emitted"])


def test_a_viibe_reaches_the_city_and_flashes_only_the_people_who_set_it_off(env):
    for uid in ("u0", "u1", "u2", "u3", "u4"):
        fire(env, uid, latitude=6.4282, longitude=3.4219)
    city = [d for e, d, room in env["emitted"] if e == "viibe"]
    assert len(city) == 1 and city[0]["participant_count"] == 5
    assert "participant_ids" not in city[0]           # the city sees counts, never people
    flashed = sorted(room for e, _, room in env["emitted"] if e == "viibe_flash")
    assert flashed == ["user_u0", "user_u1", "user_u2", "user_u3", "user_u4"]


def test_viibes_endpoint_counts_tonight_without_naming_anyone(env):
    for uid in ("u0", "u1", "u2", "u3", "u4"):
        fire(env, uid, latitude=6.4282, longitude=3.4219)
    body = env["client"].get("/api/venues/mercury/viibes").json()
    assert body["tonight"] == 1
    assert body["latest"]["participant_count"] == 5
    assert "participant_ids" not in body["latest"]
    assert body["latest"]["locked_at"].endswith("+00:00")
