"""
The intelligence API gate: hashed keys, tier limits, daily metering, and the
weekly report built from grid history.
"""
import asyncio
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

mongomock_motor = pytest.importorskip("mongomock_motor")
pytest.importorskip("h3")

from app.services import api_access
from app.services.grid import cell_for
from app.services.grid_history import bucket_of, weekly_report


@pytest.fixture
def db(monkeypatch):
    db = mongomock_motor.AsyncMongoMockClient()["viibe_test"]
    import app.config
    import app.routes.public_api as public_api
    import app.services.auth as auth
    for mod in (app.config, api_access, public_api, auth):
        monkeypatch.setattr(mod, "db", db, raising=False)
    api_access._minute.clear()
    return db


def run(coro):
    return asyncio.run(coro)


def issue(name="Heineken", tier="starter"):
    return run(api_access.issue_key(name, tier, "tester"))


# ── Keys ─────────────────────────────────────────────────────────────────────

def test_a_key_is_shown_once_and_stored_only_as_a_hash(db):
    issued = issue()
    key = issued["api_key"]
    assert key.startswith("vik_") and len(key) > 40
    stored = run(db.intel_keys.find_one({"id": issued["key"]["id"]}))
    assert key not in str(stored)
    assert stored["key_hash"] == api_access.hash_key(key)
    assert "key_hash" not in issued["key"]


def test_a_good_key_passes_and_is_counted(db):
    issued = issue()
    for _ in range(3):
        assert run(api_access.check(issued["api_key"]))["id"] == issued["key"]["id"]
    u = run(api_access.usage(issued["key"]["id"]))
    assert u["total"] == 3 and len(u["by_day"]) == 1


@pytest.mark.parametrize("raw,status", [(None, 401), ("", 401), ("vik_nope", 403)])
def test_missing_and_unknown_keys_are_refused(db, raw, status):
    with pytest.raises(HTTPException) as e:
        run(api_access.check(raw))
    assert e.value.status_code == status


def test_a_revoked_key_stops_working(db):
    issued = issue()
    run(api_access.revoke_key(issued["key"]["id"]))
    with pytest.raises(HTTPException) as e:
        run(api_access.check(issued["api_key"]))
    assert e.value.status_code == 403


def test_bad_names_tiers_and_duplicates_are_refused(db):
    for name, tier, status in [("", "starter", 422), ("<b>x</b>", "starter", 422),
                               ("Ok", "platinum", 422)]:
        with pytest.raises(HTTPException) as e:
            run(api_access.issue_key(name, tier))
        assert e.value.status_code == status
    issue("Twice")
    with pytest.raises(HTTPException) as e:
        issue("Twice")
    assert e.value.status_code == 409


# ── Limits ───────────────────────────────────────────────────────────────────

def test_the_minute_limit_holds_and_says_when_to_retry(db, monkeypatch):
    monkeypatch.setitem(api_access.TIERS, "starter", {"per_minute": 3, "per_day": 1000})
    issued = issue()
    for _ in range(3):
        run(api_access.check(issued["api_key"]))
    with pytest.raises(HTTPException) as e:
        run(api_access.check(issued["api_key"]))
    assert e.value.status_code == 429
    assert int(e.value.headers["Retry-After"]) >= 1
    # A refused request is not billed.
    assert run(api_access.usage(issued["key"]["id"]))["total"] == 3


def test_the_minute_window_resets():
    api_access._minute.clear()
    assert api_access._check_minute("k", 2, now=0.0) is None
    assert api_access._check_minute("k", 2, now=10.0) is None
    assert api_access._check_minute("k", 2, now=20.0) == 41
    assert api_access._check_minute("k", 2, now=61.0) is None


def test_the_daily_limit_holds(db, monkeypatch):
    monkeypatch.setitem(api_access.TIERS, "starter", {"per_minute": 1000, "per_day": 2})
    issued = issue()
    run(api_access.check(issued["api_key"]))
    run(api_access.check(issued["api_key"]))
    with pytest.raises(HTTPException) as e:
        run(api_access.check(issued["api_key"]))
    assert e.value.status_code == 429 and "Daily" in e.value.detail


def test_a_burst_cannot_slip_past_the_daily_limit(db, monkeypatch):
    monkeypatch.setitem(api_access.TIERS, "starter", {"per_minute": 1000, "per_day": 5})
    issued = issue()

    async def burst():
        results = await asyncio.gather(
            *[api_access.check(issued["api_key"]) for _ in range(12)], return_exceptions=True
        )
        return results

    results = run(burst())
    assert sum(1 for r in results if not isinstance(r, Exception)) == 5
    assert all(r.status_code == 429 for r in results if isinstance(r, Exception))
    assert run(api_access.usage(issued["key"]["id"]))["total"] == 5


def test_one_keys_traffic_does_not_spend_anothers(db, monkeypatch):
    monkeypatch.setitem(api_access.TIERS, "starter", {"per_minute": 1, "per_day": 1000})
    a, b = issue("A"), issue("B")
    run(api_access.check(a["api_key"]))
    run(api_access.check(b["api_key"]))
    assert run(api_access.usage(b["key"]["id"]))["total"] == 1


# ── Legacy plain-text keys ───────────────────────────────────────────────────

def test_a_legacy_plain_key_is_adopted_as_a_hash_on_first_use(db):
    run(db.api_keys.insert_one({"key": "old-plain-key", "partner": "Eko Atlantic", "active": True}))
    doc = run(api_access.check("old-plain-key"))
    assert doc["name"] == "Eko Atlantic" and doc["tier"] == "starter"
    legacy = run(db.api_keys.find_one({"partner": "Eko Atlantic"}))
    assert legacy["active"] is False and legacy["migrated"] is True
    assert "key" not in legacy and legacy["intel_key_id"] == doc["id"]
    # It keeps working, now through the hashed record, and is not adopted twice.
    assert run(api_access.check("old-plain-key"))["id"] == doc["id"]
    assert run(db.intel_keys.count_documents({})) == 1


# ── Routes ───────────────────────────────────────────────────────────────────

def test_usage_and_weekly_report_routes(db):
    import app.routes.public_api as public_api
    app_ = FastAPI()
    app_.include_router(public_api.router, prefix="/api")
    client = TestClient(app_)
    issued = issue(tier="growth")
    key = {"X-API-Key": issued["api_key"]}

    assert client.get("/api/v1/usage").status_code == 422
    assert client.get("/api/v1/usage", headers={"X-API-Key": "bad"}).status_code == 403

    u = client.get("/api/v1/usage", headers=key).json()
    assert u["tier"] == "growth" and u["limits"]["per_minute"] == 300 and u["total"] == 1

    r = client.get("/api/v1/reports/weekly", params={"city": "Lagos"}, headers=key).json()
    assert r["enough"] is False and "No trusted readings" in r["note"]
    assert r["hottest"] == [] and r["heated_up"] == [] and r["busiest_night"] is None


def test_admin_key_routes_need_an_admin(db):
    import app.routes.api_keys_admin as admin_routes
    app_ = FastAPI()
    app_.include_router(admin_routes.router, prefix="/api")
    client = TestClient(app_)
    assert client.get("/api/admin/api-keys").status_code == 401
    assert client.post("/api/admin/api-keys", json={"name": "X"}).status_code == 401

    run(db.users.insert_one({"id": "u1", "username": "tobi"}))
    run(db.user_sessions.insert_one({"user_id": "u1", "session_token": "t",
                                     "expires_at": datetime.now(timezone.utc) + timedelta(days=1)}))
    plain = {"Authorization": "Bearer t"}
    assert client.get("/api/admin/api-keys", headers=plain).status_code == 403

    run(db.users.update_one({"id": "u1"}, {"$set": {"is_super_admin": True}}))
    made = client.post("/api/admin/api-keys", json={"name": "Lagos State", "tier": "enterprise"}, headers=plain)
    assert made.status_code == 200 and made.json()["api_key"].startswith("vik_")
    listed = client.get("/api/admin/api-keys", headers=plain).json()
    assert [k["name"] for k in listed["keys"]] == ["Lagos State"]
    assert "key_hash" not in str(listed) and "api_key" not in str(listed)
    kid = made.json()["key"]["id"]
    assert client.delete(f"/api/admin/api-keys/{kid}", headers=plain).json() == {"revoked": kid}


# ── Weekly report ────────────────────────────────────────────────────────────

VI = cell_for(6.4307, 3.4374, 8)
IKEJA = cell_for(6.6018, 3.3515, 8)
LEKKI = cell_for(6.4390, 3.4720, 8)
# Friday 13 Nov 2026, 22:00 in Lagos.
FRI = datetime(2026, 11, 13, 21, 0, tzinfo=timezone.utc)


def hrow(cell, at, score, solid=True, area=None):
    return {"cell": cell, "res": 8, "bucket": bucket_of(at), "city": "lagos", "area": area,
            "score": score, "confidence": 0.8 if solid else 0.3, "solid": solid}


def test_weekly_report_names_the_hottest_the_risers_and_the_busiest_night():
    sat = FRI + timedelta(days=1)
    this_week = [
        hrow(VI, FRI, 80, area="Victoria Island"), hrow(VI, FRI + timedelta(minutes=10), 85, area="Victoria Island"),
        hrow(VI, sat, 75, area="Victoria Island"),
        hrow(IKEJA, FRI, 60, area="Ikeja"), hrow(IKEJA, sat, 70, area="Ikeja"),
        hrow(LEKKI, sat + timedelta(hours=1), 99, solid=False),          # one loud voice: ignored
    ]
    last_week = [
        hrow(VI, FRI - timedelta(days=7), 78), hrow(VI, sat - timedelta(days=7), 82),
        hrow(IKEJA, FRI - timedelta(days=7), 40), hrow(IKEJA, sat - timedelta(days=7), 50),
    ]
    r = weekly_report(this_week, last_week)
    assert r["enough"] is True
    assert r["coverage"] == {"trusted_readings": 5, "cells": 2, "nights": 2}
    assert [c["area"] for c in r["hottest"]] == ["Victoria Island", "Ikeja"]
    assert r["hottest"][0]["mean_nightly_peak"] == 80.0          # (85 + 75) / 2
    assert r["hottest"][0]["minutes_at_50_plus"] == 30
    # VI held level (80 vs 80); Ikeja rose from 45 to 65.
    assert [(c["area"], c["change"]) for c in r["heated_up"]] == [("Ikeja", 20.0)]
    assert r["heated_up"][0]["last_week_mean_nightly_peak"] == 45.0
    assert r["busiest_night"] == {"date": "2026-11-13", "peak": 85.0}
    assert r["peak_hour_lagos"] == 22


def test_a_single_night_is_not_called_a_rise():
    this_week = [hrow(VI, FRI, 90)]
    last_week = [hrow(VI, FRI - timedelta(days=7), 10)]
    assert weekly_report(this_week, last_week)["heated_up"] == []


def test_a_week_with_nothing_trusted_reports_nothing():
    r = weekly_report([hrow(VI, FRI, 90, solid=False)], [])
    assert r["enough"] is False
    assert r["hottest"] == [] and r["busiest_night"] is None and r["peak_hour_lagos"] is None
