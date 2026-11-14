"""
Grid history: the grid kept over time, night summaries, and forecasts that
stay silent until the cell's own past can back them.
"""
import asyncio
from datetime import date, datetime, timedelta, timezone

import pytest

pytest.importorskip("h3")

from app.services.grid import cell_for
from app.services.grid_history import (
    BUCKET_MINUTES, bucket_of, city_timeline, night_bounds, rows_from_cells,
    series, summarise_night, typical_curve,
)

CELL = cell_for(6.4307, 3.4374, 9)
# A Friday night in Lagos: 22:00 local is 21:00 UTC.
FRI = datetime(2026, 11, 13, 21, 0, tzinfo=timezone.utc)


def row(at, score, solid=True, confidence=0.8, cell=CELL, scouts=4):
    return {"cell": cell, "res": 9, "bucket": bucket_of(at), "city": "lagos", "score": score,
            "confidence": confidence, "solid": solid, "active_scouts": scouts}


def test_bucket_floors_to_ten_minutes():
    assert bucket_of(datetime(2026, 11, 13, 21, 37, 44, tzinfo=timezone.utc)) == \
        datetime(2026, 11, 13, 21, 30, tzinfo=timezone.utc)
    # Mongo hands timestamps back naive; they are UTC.
    assert bucket_of(datetime(2026, 11, 13, 21, 9)) == datetime(2026, 11, 13, 21, 0, tzinfo=timezone.utc)


def test_only_real_cells_become_history():
    cells = [
        {"cell": "a", "source": "scouts", "score": 70.0, "confidence": 0.8, "solid": True,
         "venues": 2, "venues_read": 2, "active_scouts": 6, "decay_state": "fresh", "venue_ids": ["v1", "v2"]},
        {"cell": "b", "source": "demo", "score": 90.0, "venue_ids": ["v3"]},
        {"cell": "c", "source": "none", "score": None, "venue_ids": ["v4"]},
    ]
    rows = rows_from_cells(cells, 9, bucket_of(FRI), {"v1": "lagos", "v2": "lagos", "v3": "lagos"})
    assert [r["cell"] for r in rows] == ["a"]
    assert rows[0]["city"] == "lagos" and rows[0]["res"] == 9 and rows[0]["score"] == 70.0


def test_series_is_oldest_first():
    s = series([row(FRI + timedelta(minutes=20), 60), row(FRI, 40)])
    assert [p["score"] for p in s] == [40, 60]


def test_a_night_summary_reads_only_trusted_readings():
    rows = [
        row(FRI, 30),
        row(FRI + timedelta(minutes=10), 55),
        row(FRI + timedelta(minutes=20), 99, solid=False, confidence=0.3),  # one loud voice
        row(FRI + timedelta(minutes=30), 78),
        row(FRI + timedelta(minutes=40), 60),
    ]
    s = summarise_night(rows)
    assert s["peak_score"] == 78
    assert s["peak_at"] == (FRI + timedelta(minutes=30)).isoformat()
    assert s["built_at"] == (FRI + timedelta(minutes=10)).isoformat()
    assert s["minutes_at_50_plus"] == 3 * BUCKET_MINUTES
    assert s["trusted_readings"] == 4


def test_a_night_with_no_trusted_reading_has_no_summary():
    assert summarise_night([row(FRI, 90, solid=False)]) is None
    assert summarise_night([]) is None


def test_city_timeline_weights_cells_by_confidence():
    other = cell_for(6.6018, 3.3515, 9)
    t = city_timeline([row(FRI, 80, confidence=0.9), row(FRI, 20, confidence=0.1, solid=False, cell=other)])
    assert len(t) == 1
    assert t[0]["score"] == 74.0
    assert t[0]["cells_read"] == 2 and t[0]["cells_trusted"] == 1 and t[0]["active_scouts"] == 8


def test_a_night_runs_from_morning_to_morning():
    start, end = night_bounds(date(2026, 11, 13))
    assert start == datetime(2026, 11, 13, 6, 0, tzinfo=timezone.utc)
    assert end - start == timedelta(days=1)


# ── Forecast ─────────────────────────────────────────────────────────────────

def nights(n, hour_scores):
    """n past Fridays, each with the given {utc_hour: score}."""
    rows = []
    for w in range(1, n + 1):
        base = FRI - timedelta(weeks=w)
        for hour, score in hour_scores.items():
            rows.append(row(base.replace(hour=hour), score))
    return rows


def test_forecast_is_silent_without_enough_nights():
    c = typical_curve(nights(2, {21: 60, 22: 80}))
    assert c["enough"] is False
    assert c["hours"] == {} and c["peak_hour"] is None
    assert c["nights"] == 2


def test_forecast_reports_the_usual_curve_in_lagos_hours():
    c = typical_curve(nights(3, {21: 60, 22: 80, 23: 70}))
    assert c["enough"] is True
    # 21:00 UTC is 22:00 in Lagos.
    assert c["hours"] == {0: {"score": 70.0, "nights": 3}, 22: {"score": 60.0, "nights": 3},
                          23: {"score": 80.0, "nights": 3}}
    assert c["peak_hour"] == 23
    assert c["hours"][23] == {"score": 80.0, "nights": 3}


def test_an_hour_seen_on_too_few_nights_is_left_out():
    rows = nights(3, {21: 60}) + [row((FRI - timedelta(weeks=1)).replace(hour=23), 100)]
    c = typical_curve(rows)
    assert list(c["hours"]) == [22]
    assert c["peak_hour"] == 22


def test_untrusted_readings_never_feed_a_forecast():
    rows = [row((FRI - timedelta(weeks=w)), 95, solid=False) for w in (1, 2, 3, 4)]
    assert typical_curve(rows)["enough"] is False


def test_each_night_counts_once():
    # One night with six readings of 100 and two nights with one reading of 40:
    # the usual score is the mean of the three nights, not of the eight readings.
    loud = [row(FRI - timedelta(weeks=1) + timedelta(minutes=10 * i), 100) for i in range(6)]
    quiet = [row(FRI - timedelta(weeks=2), 40), row(FRI - timedelta(weeks=3), 40)]
    assert typical_curve(loud + quiet)["hours"][22]["score"] == 60.0


# ── Recorder and routes ──────────────────────────────────────────────────────

@pytest.fixture
def env(monkeypatch):
    mongomock_motor = pytest.importorskip("mongomock_motor")
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    db = mongomock_motor.AsyncMongoMockClient()["viibe_test"]
    import app.config
    import app.routes.grid as grid_route
    import app.routes.public_api as public_api
    import app.services.api_access as api_access
    for mod in (app.config, grid_route, public_api, api_access):
        monkeypatch.setattr(mod, "db", db, raising=False)
    grid_route._cache.clear()
    api_access._minute.clear()

    now = datetime.now(timezone.utc)
    asyncio.run(db.api_keys.insert_one({"key": "k1", "active": True}))
    asyncio.run(db.venues.insert_many([
        {"id": "a", "city": "lagos", "coordinates": {"lat": 6.4307, "lng": 3.4374},
         "current_vibe_score": 80, "energy_source": "scouts", "active_scouts": 5,
         "consensus_count": 5, "consensus_rate": 1.0, "last_rated_at": now - timedelta(minutes=3)},
        {"id": "d", "city": "lagos", "coordinates": {"lat": 6.6018, "lng": 3.3515},
         "current_vibe_score": 95, "energy_source": "demo"},
    ]))
    app_ = FastAPI()
    app_.include_router(grid_route.router, prefix="/api")
    return TestClient(app_), db, now


def test_recorder_stores_real_cells_once_per_bucket(env):
    from app.services.grid_history import record_grid
    client, db, now = env
    assert asyncio.run(record_grid(now)) == 3            # one real cell at three resolutions
    assert asyncio.run(record_grid(now)) == 3            # same bucket: upsert, not a duplicate
    rows = asyncio.run(db.grid_history.find({}).to_list(100))
    assert len(rows) == 3
    assert sorted(r["res"] for r in rows) == [7, 8, 9]
    assert all(r["score"] == 80.0 and r["city"] == "lagos" and r["solid"] for r in rows)


def test_history_needs_a_key(env):
    client, _, _ = env
    for path in ("/api/grid/history?cell=" + CELL, "/api/grid/night?city=lagos", "/api/grid/forecast?cell=" + CELL):
        assert client.get(path).status_code == 422                       # no key header
        assert client.get(path, headers={"X-API-Key": "wrong"}).status_code == 403


def test_history_night_and_forecast_routes(env):
    from app.services.grid_history import record_grid
    client, db, now = env
    asyncio.run(record_grid(now))
    key = {"X-API-Key": "k1"}

    h = client.get("/api/grid/history", params={"cell": CELL, "hours": 2}, headers=key).json()
    assert h["count"] == 1 and h["series"][0]["score"] == 80.0

    n = client.get("/api/grid/night", params={"city": "Lagos", "zoom": 14}, headers=key).json()
    assert n["resolution"] == 9
    assert n["timeline"][0]["cells_trusted"] == 1
    assert n["cells"][0]["cell"] == CELL and n["cells"][0]["peak_score"] == 80.0

    f = client.get("/api/grid/forecast", params={"cell": CELL}, headers=key).json()
    assert f["enough"] is False and "Not enough history" in f["note"]

    bad = client.get("/api/grid/history", params={"cell": "not-a-cell"}, headers=key)
    assert bad.status_code == 422
