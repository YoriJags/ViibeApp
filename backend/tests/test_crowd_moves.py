"""
Crowd moves: where people go next, from verified auto check-in, never naming
anyone and never reporting a route fewer than five people made.
"""
import asyncio
from datetime import datetime, timedelta, timezone

import pytest

from app.services.crowd_moves import (
    MIN_PEOPLE, moves_from_arrivals, next_from, routes, usual_move_hour,
)

# Friday 13 Nov 2026, 22:00 in Lagos.
FRI = datetime(2026, 11, 13, 21, 0, tzinfo=timezone.utc)


def arr(user, venue, minutes):
    return {"user_id": user, "venue_id": venue, "at": FRI + timedelta(minutes=minutes)}


def crowd(n, origin, dest, gap=60, start=0, prefix="u"):
    out = []
    for i in range(n):
        out += [arr(f"{prefix}{i}", origin, start + i), arr(f"{prefix}{i}", dest, start + i + gap)]
    return out


def test_two_places_on_one_night_make_a_move():
    m = moves_from_arrivals([arr("a", "mercury", 0), arr("a", "quilox", 50)])
    assert m == [{"user_id": "a", "from": "mercury", "to": "quilox", "at": FRI + timedelta(minutes=50)}]


def test_a_return_to_the_same_place_is_not_a_move():
    assert moves_from_arrivals([arr("a", "mercury", 0), arr("a", "mercury", 40)]) == []


def test_too_long_a_gap_is_not_a_move():
    assert moves_from_arrivals([arr("a", "mercury", 0), arr("a", "quilox", 181)]) == []


def test_tonight_and_tomorrow_night_are_not_one_move():
    # 23:00 on Friday and 22:00 on Saturday, both in Lagos: different nights.
    a = arr("a", "mercury", 60)
    b = {"user_id": "a", "venue_id": "quilox", "at": FRI + timedelta(days=1)}
    assert moves_from_arrivals([a, b]) == []


def test_a_move_after_midnight_stays_on_the_same_night():
    # 01:30 to 03:00 Lagos time on Saturday morning is still Friday night.
    m = moves_from_arrivals([arr("a", "mercury", 210), arr("a", "quilox", 300)])
    assert len(m) == 1


def test_demo_accounts_and_broken_rows_are_ignored():
    rows = [arr("demo-scout-1", "mercury", 0), arr("demo-scout-1", "quilox", 30),
            {"user_id": "b", "venue_id": None, "at": FRI}, {"user_id": "c", "venue_id": "x", "at": "late"}]
    assert moves_from_arrivals(rows) == []


def test_a_chain_of_three_places_is_two_moves():
    m = moves_from_arrivals([arr("a", "x", 0), arr("a", "y", 30), arr("a", "z", 60)])
    assert [(x["from"], x["to"]) for x in m] == [("x", "y"), ("y", "z")]


def test_a_route_needs_five_different_people():
    four = moves_from_arrivals(crowd(MIN_PEOPLE - 1, "mercury", "quilox"))
    assert routes(four) == []
    five = moves_from_arrivals(crowd(MIN_PEOPLE, "mercury", "quilox"))
    assert routes(five) == [{"from": "mercury", "to": "quilox", "people": 5}]


def test_one_person_looping_counts_once():
    loops = []
    for k in range(6):
        loops += [arr("a", "mercury", k * 20), arr("a", "quilox", k * 20 + 10)]
    assert routes(moves_from_arrivals(loops), min_people=1) == [
        {"from": "mercury", "to": "quilox", "people": 1},
        {"from": "quilox", "to": "mercury", "people": 1},
    ]


def test_next_from_names_destinations_with_shares_and_hides_small_ones():
    rows = crowd(6, "mercury", "quilox") + crowd(5, "mercury", "hardrock", prefix="v") \
        + crowd(2, "mercury", "secret_spot", prefix="w")
    result = next_from(moves_from_arrivals(rows), "mercury")
    assert result["left_for_somewhere"] == 13
    assert result["enough"] is True
    assert result["destinations"] == [
        {"to": "quilox", "people": 6, "share": 0.46},
        {"to": "hardrock", "people": 5, "share": 0.38},
    ]
    assert "secret_spot" not in str(result)


def test_next_from_with_too_few_people_says_nothing():
    result = next_from(moves_from_arrivals(crowd(3, "mercury", "quilox")), "mercury")
    assert result["enough"] is False and result["destinations"] == []
    assert result["left_for_somewhere"] == 3


def test_usual_move_hour_is_in_lagos_time():
    rows = crowd(5, "mercury", "quilox", gap=90)  # arrive about 23:30 Lagos
    assert usual_move_hour(moves_from_arrivals(rows), "mercury", "quilox") == 23
    assert usual_move_hour([], "mercury", "quilox") is None


# ── Routes ───────────────────────────────────────────────────────────────────

@pytest.fixture
def env(monkeypatch):
    mongomock_motor = pytest.importorskip("mongomock_motor")
    pytest.importorskip("h3")
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    db = mongomock_motor.AsyncMongoMockClient()["viibe_test"]
    import app.config
    import app.routes.grid as grid_route
    import app.routes.venues as venues_route
    import app.services.api_access as api_access
    for mod in (app.config, grid_route, venues_route, api_access):
        monkeypatch.setattr(mod, "db", db, raising=False)
    api_access._minute.clear()

    now = datetime.now(timezone.utc).replace(hour=21, minute=0, second=0, microsecond=0) - timedelta(days=1)
    asyncio.run(db.venues.insert_many([
        {"id": "mercury", "name": "Mercury Lagos", "city": "lagos", "area": "Victoria Island",
         "coordinates": {"lat": 6.4307, "lng": 3.4374}},
        {"id": "quilox", "name": "Quilox", "city": "lagos", "area": "Victoria Island",
         "coordinates": {"lat": 6.4290, "lng": 3.4210}},
        {"id": "ikeja", "name": "Ikeja Spot", "city": "lagos", "area": "Ikeja",
         "coordinates": {"lat": 6.6018, "lng": 3.3515}},
    ]))
    events = []
    for i in range(6):
        events += [
            {"user_id": f"u{i}", "venue_id": "mercury", "kind": "enter", "action": "open", "verified": True,
             "at": now + timedelta(minutes=i)},
            {"user_id": f"u{i}", "venue_id": "ikeja", "kind": "enter", "action": "switch", "verified": True,
             "at": now + timedelta(minutes=60 + i)},
        ]
    # Unverified arrivals never count, however many there are.
    for i in range(10):
        events += [
            {"user_id": f"x{i}", "venue_id": "mercury", "kind": "enter", "action": "open", "verified": False,
             "at": now + timedelta(minutes=i)},
            {"user_id": f"x{i}", "venue_id": "quilox", "kind": "enter", "action": "switch", "verified": False,
             "at": now + timedelta(minutes=30 + i)},
        ]
    asyncio.run(db.presence_events.insert_many(events))
    asyncio.run(db.api_keys.insert_one({"key": "k1", "active": True}))

    app_ = FastAPI()
    app_.include_router(grid_route.router, prefix="/api")
    app_.include_router(venues_route.router, prefix="/api")
    return TestClient(app_)


def test_where_next_route(env):
    r = env.get("/api/venues/mercury/next").json()
    assert r["venue_name"] == "Mercury Lagos"
    assert r["left_for_somewhere"] == 6
    assert [(d["name"], d["people"], d["share"]) for d in r["destinations"]] == [("Ikeja Spot", 6, 1.0)]
    assert r["destinations"][0]["area"] == "Ikeja"
    assert env.get("/api/venues/nowhere/next").status_code == 404


def test_grid_flows_route_needs_a_key_and_reports_area_routes(env):
    assert env.get("/api/grid/flows", params={"city": "lagos"}).status_code == 422
    r = env.get("/api/grid/flows", params={"city": "lagos", "zoom": 12}, headers={"X-API-Key": "k1"}).json()
    assert r["resolution"] == 8 and r["min_people"] == 5
    assert len(r["routes"]) == 1
    route = r["routes"][0]
    assert route["people"] == 6
    assert route["from_area"] == "Victoria Island" and route["to_area"] == "Ikeja"
