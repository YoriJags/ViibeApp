"""
Pushes reach real phones, once.

The app registers its token at PUT /users/me/push-token (users.push_token).
Every sender must find it there, never repeat a push the same night, never
push a demo account, and never tell someone what another push already did.
"""
from datetime import datetime, timedelta, timezone

import pytest

mongomock_motor = pytest.importorskip("mongomock_motor")

TOKEN = "ExponentPushToken[abc]"


@pytest.fixture
def env(monkeypatch):
    db = mongomock_motor.AsyncMongoMockClient()["viibe_test"]
    import app.config
    import app.services.notifications as n
    monkeypatch.setattr(app.config, "db", db, raising=False)
    monkeypatch.setattr(n, "db", db)
    sent = []

    async def fake_send(user_id, title, body, data=None):
        token = await n.push_token_for(user_id)
        if token:
            sent.append((user_id, title, body))
        return bool(token)
    monkeypatch.setattr(n, "send_push_notification", fake_send)
    return n, db, sent


def run(coro):
    import asyncio
    return asyncio.run(coro)


def test_the_token_the_app_registers_is_the_one_senders_find(env):
    n, db, _ = env
    run(db.users.insert_many([{"id": "u1", "push_token": TOKEN}, {"id": "demo-scout-1", "push_token": TOKEN}]))
    assert run(n.push_token_for("u1")) == TOKEN
    assert run(n.push_token_for("demo-scout-1")) is None
    assert run(n.push_tokens_for(["u1", "u1", "demo-scout-1", "nobody"])) == [TOKEN]


def test_crew_hears_once_and_the_arriver_never_hears_about_themselves(env):
    n, db, sent = env
    run(db.users.insert_many([{"id": u, "push_token": f"ExponentPushToken[{u}]"} for u in ("a", "b", "c")]))
    run(db.crews.insert_one({"id": "crew1", "name": "Lagos Night Owls", "members": ["a", "b", "c"]}))
    run(n.notify_crew_checkin("crew1", "a", "Ada", "v1", "Quilox"))
    run(n.notify_crew_checkin("crew1", "a", "Ada", "v1", "Quilox"))   # same night, same venue
    assert sorted(u for u, _, _ in sent) == ["b", "c"]
    assert "Ada just arrived at Quilox" in sent[0][2]


def test_a_crew_member_who_turned_crew_alerts_off_hears_nothing(env):
    n, db, sent = env
    run(db.users.insert_many([{"id": u, "push_token": f"ExponentPushToken[{u}]"} for u in ("a", "b")]))
    run(db.alert_preferences.insert_one({"user_id": "b", "crew_alerts": False}))
    run(db.crews.insert_one({"id": "crew1", "members": ["a", "b"]}))
    run(n.notify_crew_checkin("crew1", "a", "Ada", "v1", "Quilox"))
    assert sent == []


def test_peak_reaches_saved_spots_once_and_skips_people_already_alerted(env):
    n, db, sent = env
    run(db.venues.insert_one({"id": "v1", "name": "Quilox", "venue_type": "club", "city": "lagos"}))
    run(db.users.insert_many([{"id": u, "push_token": f"ExponentPushToken[{u}]"} for u in ("saver", "watcher")]))
    run(db.lobby.insert_many([{"user_id": "saver", "venue_id": "v1"}, {"user_id": "watcher", "venue_id": "v1"}]))
    run(db.venue_alerts.insert_one({"user_id": "watcher", "venue_id": "v1"}))
    run(n.notify_lobby_hot("v1"))
    run(n.notify_lobby_hot("v1"))
    assert [u for u, _, _ in sent] == ["saver"]
    assert sent[0][1] == "Quilox just hit Peak"


def test_vibe_spike_finds_fans_of_the_room_type_once_a_night(env):
    n, db, sent = env
    now = datetime.now(timezone.utc)
    run(db.venues.insert_many([
        {"id": "v1", "name": "Quilox", "venue_type": "club", "city": "lagos"},
        {"id": "v2", "name": "Escape", "venue_type": "club", "city": "lagos"},
        {"id": "v3", "name": "Cova", "venue_type": "lounge", "city": "lagos"},
    ]))
    run(db.users.insert_many([{"id": u, "push_token": f"ExponentPushToken[{u}]"} for u in ("fan", "casual", "lounger")]))
    run(db.ratings.insert_many(
        [{"user_id": "fan", "venue_id": "v2", "timestamp": now - timedelta(days=i)} for i in range(2)]
        + [{"user_id": "casual", "venue_id": "v2", "timestamp": now}]
        + [{"user_id": "lounger", "venue_id": "v3", "timestamp": now - timedelta(days=i)} for i in range(3)]
        + [{"user_id": "demo-scout-9", "venue_id": "v2", "timestamp": now - timedelta(days=i)} for i in range(5)]))
    run(n.notify_vibe_spike("v1", 90, "peak"))
    run(n.notify_vibe_spike("v2", 91, "peak"))   # a second Peak the same night
    assert [u for u, _, _ in sent] == ["fan"]
    assert sent[0][1] == "Quilox is Peak"


def test_streak_reminder_goes_to_people_active_yesterday_but_not_today(env):
    n, db, sent = env
    now = datetime(2026, 11, 22, 19, 30, tzinfo=timezone.utc)   # 8:30pm Lagos
    yesterday, today = "2026-11-21", "2026-11-22"
    run(db.users.insert_many([{"id": u, "push_token": f"ExponentPushToken[{u}]"} for u in ("keep", "done", "new", "demo-scout-2")]))
    run(db.streaks.insert_many([
        {"user_id": "keep", "current_streak": 4, "last_activity_date": yesterday},
        {"user_id": "done", "current_streak": 5, "last_activity_date": today},
        {"user_id": "new", "current_streak": 1, "last_activity_date": yesterday},
        {"user_id": "demo-scout-2", "current_streak": 9, "last_activity_date": yesterday},
    ]))
    run(n.streak_reminder_pass(now))
    run(n.streak_reminder_pass(now))
    assert [u for u, _, _ in sent] == ["keep"]
    assert sent[0][1] == "Your 4-night streak ends tonight"


def test_a_badge_is_announced_once(env):
    n, db, sent = env
    run(db.users.insert_one({"id": "u1", "push_token": TOKEN}))
    run(n.notify_achievement_unlocked("u1", "On Fire", "7 nights in a row."))
    run(n.notify_achievement_unlocked("u1", "On Fire", "7 nights in a row."))
    assert len(sent) == 1
