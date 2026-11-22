"""
City-wide figures count only what scouts measured.

The area pulse, the heat map and the scout leaderboard are read by real users
in live mode. A stored score, a demo score or a demo-scout account must never
show up in them as if it happened tonight.
"""
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

mongomock_motor = pytest.importorskip("mongomock_motor")


@pytest.fixture
def env(monkeypatch):
    db = mongomock_motor.AsyncMongoMockClient()["viibe_test"]
    import app.config
    import app.routes.heat_map as heat_map
    import app.routes.intelligence as intelligence
    import app.routes.leaderboard as leaderboard
    for mod in (app.config, heat_map, intelligence, leaderboard):
        monkeypatch.setattr(mod, "db", db, raising=False)
    app_ = FastAPI()
    for r in (heat_map.router, intelligence.router, leaderboard.router):
        app_.include_router(r, prefix="/api")
    return TestClient(app_), db


def run(coro):
    import asyncio
    return asyncio.run(coro)


def venue(i, source, score, area="Victoria Island", city="lagos"):
    return {"id": f"v{i}", "name": f"Venue {i}", "area": area, "city": city, "current_vibe_score": score,
            "energy_source": source, "energy_level": "lit", "vibe_velocity": "stable",
            "coordinates": {"lat": 6.43, "lng": 3.42}}


def test_area_pulse_counts_only_scout_readings(env):
    client, db = env
    run(db.venues.insert_many([
        venue(1, "scouts", 80), venue(2, "demo", 95), venue(3, "none", 60),
        venue(4, "scouts", 70, city="abuja", area="Wuse"),
    ]))
    areas = client.get("/api/area-pulse/lagos").json()["areas"]
    assert len(areas) == 1
    assert areas[0]["avg_score"] == 80 and areas[0]["venue_count"] == 1   # no demo, no stale, no Abuja


def test_a_quiet_night_has_no_areas(env):
    client, db = env
    run(db.venues.insert_many([venue(1, "none", 0), venue(2, "demo", 90)]))
    assert client.get("/api/area-pulse/lagos").json()["areas"] == []
    assert client.get("/api/heat-map/lagos").json()["areas"] == []


def test_heat_map_ignores_scores_scouts_did_not_produce(env):
    client, db = env
    run(db.venues.insert_many([venue(1, "scouts", 70), venue(2, "demo", 99, area="Lekki")]))
    areas = {a["area"]: a for a in client.get("/api/heat-map/lagos").json()["areas"]}
    assert "Victoria Island" in areas and "Lekki" not in areas


def test_demo_scouts_never_top_the_leaderboard(env):
    client, db = env
    now = datetime.now(timezone.utc)
    run(db.venues.insert_one(venue(1, "scouts", 80)))
    run(db.users.insert_many([{"id": "real-1", "username": "ada"}, {"id": "demo-scout-1", "username": "zara_demo3"}]))
    rows = [{"user_id": "demo-scout-1", "venue_id": "v1", "vibe_score": 90, "timestamp": now - timedelta(minutes=i)}
            for i in range(5)]
    rows.append({"user_id": "real-1", "venue_id": "v1", "vibe_score": 70, "timestamp": now})
    run(db.ratings.insert_many(rows))
    names = [s["username"] for s in client.get("/api/top-scouts/lagos").json()["scouts"]]
    assert names == ["ada"]
