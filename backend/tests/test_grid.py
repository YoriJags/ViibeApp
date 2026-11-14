"""
The city grid (PLAN.md Phase 4): venues fold into H3 hex cells that obey the
same honesty rules as a single venue reading.
"""
import asyncio
import time
from datetime import datetime, timedelta, timezone

import pytest

h3 = pytest.importorskip("h3")

from app.services.grid import build_grid, cell_for, decay_state, resolution_for_zoom

NOW = datetime(2026, 11, 14, 23, 0, tzinfo=timezone.utc)

# Two spots in Victoria Island about 60 m apart (one res-9 cell), and one in
# Ikeja, across the city.
VI_A = (6.4307, 3.4374)
VI_B = (6.4310, 3.4378)
IKEJA = (6.6018, 3.3515)


def venue(vid, at, score=70, confidence=0.9, source="scouts", age_min=5, scouts=5):
    return {
        "id": vid,
        "coordinates": {"lat": at[0], "lng": at[1]},
        "current_vibe_score": score,
        "energy_source": source,
        "confidence": confidence,
        "last_rated_at": NOW - timedelta(minutes=age_min),
        "active_scouts": scouts,
    }


def grid(venues, res=9):
    return build_grid(venues, res, NOW)


def test_zoom_picks_the_resolution():
    assert [resolution_for_zoom(z) for z in (5, 10.9, 11, 12.9, 13, 18)] == [7, 7, 8, 8, 9, 9]


def test_neighbours_share_a_cell_and_the_far_side_of_town_does_not():
    assert cell_for(*VI_A, 9) == cell_for(*VI_B, 9)
    cells = grid([venue("a", VI_A), venue("b", VI_B), venue("c", IKEJA)])
    assert len(cells) == 2
    assert sorted(c["venues"] for c in cells) == [1, 2]


def test_a_cell_is_weighted_by_confidence():
    # A trusted 80 and a barely believed 20: the cell sits near the trusted one.
    cells = grid([venue("a", VI_A, score=80, confidence=0.9),
                  venue("b", VI_B, score=20, confidence=0.1)])
    c = cells[0]
    assert c["score"] == 74.0
    assert c["energy"] == 0.74
    assert c["confidence"] == 0.82
    assert c["solid"] is True
    assert c["venues_read"] == 2 and c["active_scouts"] == 10


def test_one_unconfirmed_voice_does_not_paint_the_cell_solid():
    c = grid([venue("a", VI_A, score=100, confidence=0.4, scouts=1)])[0]
    assert c["score"] == 100.0
    assert c["solid"] is False


def test_real_and_demo_are_never_blended():
    c = grid([venue("a", VI_A, score=30, confidence=0.8),
              venue("b", VI_B, score=95, confidence=None, source="demo")])[0]
    assert c["source"] == "scouts"
    assert c["score"] == 30.0
    assert c["venues_read"] == 1


def test_a_demo_only_cell_is_labelled_and_carries_no_confidence():
    c = grid([venue("a", VI_A, score=60, confidence=None, source="demo"),
              venue("b", VI_B, score=80, confidence=None, source="demo")])[0]
    assert c["source"] == "demo"
    assert c["score"] == 70.0
    assert c["confidence"] is None
    assert c["solid"] is False


def test_a_cell_with_no_reading_says_so_and_is_not_called_quiet():
    c = grid([venue("a", VI_A, score=0, confidence=0.0, source="none")])[0]
    assert c["source"] == "none"
    assert c["score"] is None and c["energy"] is None
    assert c["decay_state"] == "none"
    assert c["venues"] == 1 and c["venues_read"] == 0


def test_an_expired_real_reading_does_not_count():
    # reading_confidence gives 0 to an expired reading; the grid must skip it.
    c = grid([venue("a", VI_A, score=90, confidence=0.0, age_min=300)])[0]
    assert c["source"] == "none"


def test_decay_state_follows_the_newest_reading():
    assert [decay_state(m) for m in (None, 0, 15, 16, 90, 91, 179, 180)] == [
        "none", "fresh", "fresh", "fading", "fading", "stale", "stale", "none"]
    c = grid([venue("a", VI_A, age_min=120, confidence=0.3),
              venue("b", VI_B, age_min=10, confidence=0.9)])[0]
    assert c["decay_state"] == "fresh"


def test_cells_come_back_hottest_first_with_unread_last():
    cells = grid([venue("a", VI_A, score=40),
                  venue("c", IKEJA, score=90),
                  venue("n", (6.5244, 3.3792), confidence=0.0, source="none")])
    assert [c["score"] for c in cells] == [90.0, 40.0, None]


def test_boundary_is_a_closed_lnglat_ring_around_the_venue():
    c = grid([venue("a", VI_A)])[0]
    ring = c["boundary"]
    assert ring[0] == ring[-1] and len(ring) == 7
    lngs, lats = [p[0] for p in ring], [p[1] for p in ring]
    assert min(lngs) < VI_A[1] < max(lngs) and min(lats) < VI_A[0] < max(lats)


def test_bad_coordinates_are_skipped_not_fatal():
    cells = grid([venue("a", VI_A), {"id": "x", "coordinates": {"lat": "?", "lng": None}},
                  {"id": "y"}, {"id": "z", "coordinates": {"lat": 200, "lng": 3}}])
    assert len(cells) == 1


def test_a_coarser_cell_contains_the_finer_one():
    fine = grid([venue("a", VI_A)], res=9)[0]["cell"]
    coarse = grid([venue("a", VI_A)], res=7)[0]["cell"]
    assert h3.cell_to_parent(fine, 7) == coarse


def test_resolution_is_bounded():
    with pytest.raises(ValueError):
        build_grid([], 12, NOW)


def test_a_thousand_venues_fold_quickly():
    venues = [venue(f"v{i}", (6.40 + (i % 40) * 0.005, 3.30 + (i // 40) * 0.005)) for i in range(1000)]
    start = time.perf_counter()
    cells = build_grid(venues, 9, NOW)
    assert time.perf_counter() - start < 0.5
    assert sum(c["venues"] for c in cells) == 1000


# ── The route ────────────────────────────────────────────────────────────────

@pytest.fixture
def client(monkeypatch):
    mongomock_motor = pytest.importorskip("mongomock_motor")
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    db = mongomock_motor.AsyncMongoMockClient()["viibe_test"]
    import app.routes.grid as grid_route
    monkeypatch.setattr(grid_route, "db", db)
    grid_route._cache.clear()

    now = datetime.now(timezone.utc)
    docs = [
        {"id": "a", "name": "A", "city": "lagos", "coordinates": {"lat": VI_A[0], "lng": VI_A[1]},
         "current_vibe_score": 80, "energy_source": "scouts", "active_scouts": 5,
         "consensus_count": 5, "consensus_rate": 1.0, "last_rated_at": now - timedelta(minutes=3)},
        {"id": "b", "name": "B", "city": "lagos", "coordinates": {"lat": IKEJA[0], "lng": IKEJA[1]},
         "current_vibe_score": 55, "energy_source": "demo"},
        {"id": "hidden", "name": "H", "city": "lagos", "is_suppressed": True,
         "coordinates": {"lat": VI_B[0], "lng": VI_B[1]}, "current_vibe_score": 99,
         "energy_source": "scouts", "active_scouts": 9, "last_rated_at": now},
    ]
    asyncio.run(db.venues.insert_many(docs))
    app_ = FastAPI()
    app_.include_router(grid_route.router, prefix="/api")
    return TestClient(app_)


def test_city_grid_serves_real_and_demo_cells_and_hides_suppressed(client):
    r = client.get("/api/grid/vpixels", params={"city": "Lagos", "zoom": 14})
    assert r.status_code == 200
    body = r.json()
    assert body["resolution"] == 9 and body["venues"] == 2 and body["count"] == 2
    real = next(c for c in body["cells"] if c["source"] == "scouts")
    assert real["score"] == 80.0 and real["solid"] is True and real["venue_ids"] == ["a"]
    demo = next(c for c in body["cells"] if c["source"] == "demo")
    assert demo["confidence"] is None


def test_bbox_limits_the_grid_to_what_is_in_view(client):
    r = client.get("/api/grid/vpixels", params={"bbox": "3.40,6.40,3.46,6.46", "zoom": 14})
    assert r.status_code == 200
    assert [c["venue_ids"] for c in r.json()["cells"]] == [["a"]]


@pytest.mark.parametrize("params", [
    {},                                         # neither bbox nor city
    {"bbox": "3.4,6.4,3.5"},                    # three numbers
    {"bbox": "a,b,c,d"},                        # not numbers
    {"bbox": "3.5,6.4,3.4,6.5"},                # west east swapped
    {"bbox": "0,0,10,10"},                      # a country, not a city
    {"city": "lagos", "zoom": 40},              # impossible zoom
])
def test_bad_queries_are_refused(client, params):
    assert client.get("/api/grid/vpixels", params=params).status_code == 422
