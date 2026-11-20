"""
Where a Viibe leaves a trace after the moment: the person's night recap,
Viibe proof photos, and the grid history buyers read.
"""
import asyncio
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

mongomock_motor = pytest.importorskip("mongomock_motor")

NOW = datetime.now(timezone.utc)
VENUE = {"id": "mercury", "name": "Mercury", "coordinates": {"lat": 6.4281, "lng": 3.4219},
         "geofence_radius_m": 100}


@pytest.fixture
def env(monkeypatch):
    db = mongomock_motor.AsyncMongoMockClient()["viibe_test"]
    import app.config
    import app.routes.after_party as after_party
    import app.routes.stories as stories
    import app.services.auth as auth
    for mod in (app.config, after_party, stories, auth):
        monkeypatch.setattr(mod, "db", db, raising=False)

    async def no_streak(uid):
        return None
    monkeypatch.setattr(stories, "update_streak", no_streak)

    run = asyncio.run
    run(db.venues.insert_one(dict(VENUE)))
    run(db.users.insert_one({"id": "u1", "username": "u1"}))
    run(db.user_sessions.insert_one({"user_id": "u1", "session_token": "t1",
                                     "expires_at": NOW + timedelta(days=1)}))
    app_ = FastAPI()
    app_.include_router(after_party.router, prefix="/api")
    app_.include_router(stories.router, prefix="/api")
    return {"client": TestClient(app_), "db": db, "run": run}


AUTH = {"Authorization": "Bearer t1"}


def lock(env, minutes_ago, ids=("u1", "u2", "u3", "u4", "u5")):
    env["run"](env["db"].moment_locks.insert_one({
        "venue_id": "mercury", "venue_name": "Mercury", "participant_ids": list(ids),
        "participant_count": len(ids), "locked_at": NOW - timedelta(minutes=minutes_ago)}))


def test_the_recap_lists_the_viibes_you_were_in_and_only_those(env):
    lock(env, 30)
    lock(env, 10, ids=("u7", "u8", "u9", "u10", "u11"))   # same room, not you
    r = env["client"].get("/api/me/night-recap", headers=AUTH).json()
    assert r["viibes_tonight"] == 1
    assert r["viibes"][0]["venue_name"] == "Mercury"
    assert r["viibes"][0]["participant_count"] == 5


def story(env, viibe):
    return env["client"].post("/api/stories", headers=AUTH, json={
        "venue_id": "mercury", "media_url": "data:image/jpeg;base64,AAAA", "caption": "",
        "latitude": 6.4282, "longitude": 3.4219, "viibe": viibe})


def test_a_photo_is_viibe_proof_only_if_the_room_just_went_off(env):
    assert story(env, True).json()["viibe_proof"] is False      # nothing happened
    lock(env, 1)
    assert story(env, True).json()["viibe_proof"] is True


def test_an_old_viibe_does_not_make_a_photo_proof(env):
    lock(env, 20)
    assert story(env, True).json()["viibe_proof"] is False


def test_grid_rows_carry_the_viibes_of_their_venues():
    from app.services.grid_history import rows_from_cells, summarise_night
    cells = [{"cell": "c1", "source": "scouts", "score": 70, "solid": True,
              "venue_ids": ["mercury", "quilox"]},
             {"cell": "c2", "source": "scouts", "score": 40, "solid": True, "venue_ids": ["shiro"]}]
    rows = rows_from_cells(cells, 8, NOW, {}, {}, {"mercury": 2, "quilox": 1})
    assert {r["cell"]: r["viibes"] for r in rows} == {"c1": 3, "c2": 0}
    assert summarise_night(rows)["viibes"] == 3
