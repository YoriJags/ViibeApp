"""
Live taps count only from a signed-in person who is inside. They used to be
taken on trust: the phone named its own user id and the only location check
ran on the phone.
"""
import asyncio
from datetime import datetime, timedelta, timezone

import pytest

mongomock_motor = pytest.importorskip("mongomock_motor")

NOW = datetime.now(timezone.utc)


@pytest.fixture
def env(monkeypatch):
    db = mongomock_motor.AsyncMongoMockClient()["viibe_test"]
    import app.config
    import app.services.auth as auth
    import app.services.realtime as realtime
    import app.services.tap_gate as tap_gate
    for mod in (app.config, auth, tap_gate, realtime):
        monkeypatch.setattr(mod, "db", db, raising=False)
    tap_gate._inside_cache.clear()
    realtime._refusal_told.clear()

    # Stand-in socket server: sessions per sid, and a record of what was emitted.
    sessions, emitted = {}, []

    async def save_session(sid, data):
        sessions[sid] = dict(data)

    async def get_session(sid):
        return sessions.get(sid, {})

    async def emit(event, data=None, room=None, to=None, **kw):
        emitted.append((event, data, room or to))

    rooms = {}   # sid -> rooms it is in

    async def enter_room(sid, room, **kw):
        rooms.setdefault(sid, set()).add(room)

    async def leave_room(sid, room, **kw):
        rooms.setdefault(sid, set()).discard(room)

    monkeypatch.setattr(realtime.sio, "save_session", save_session)
    monkeypatch.setattr(realtime.sio, "get_session", get_session)
    monkeypatch.setattr(realtime.sio, "emit", emit)
    monkeypatch.setattr(realtime.sio, "enter_room", enter_room)
    monkeypatch.setattr(realtime.sio, "leave_room", leave_room)

    ingested = []
    monkeypatch.setattr(realtime, "ingest_pulse", lambda **kw: ingested.append(kw))

    async def no_persist(**kw):
        return None
    monkeypatch.setattr(realtime, "_persist_vibe_pulse", no_persist)

    def run(coro):
        return asyncio.run(coro)

    run(db.users.insert_many([{"id": "inside"}, {"id": "outside"}]))
    for uid in ("inside", "outside"):
        run(db.user_sessions.insert_one({"user_id": uid, "session_token": "tok-" + uid,
                                         "expires_at": NOW + timedelta(days=1)}))
    run(db.checkins.insert_one({"user_id": "inside", "venue_id": "mercury", "status": "active",
                                "source": "manual", "created_at": NOW - timedelta(minutes=20),
                                "expires_at": NOW + timedelta(hours=3)}))
    return {"db": db, "rt": realtime, "gate": tap_gate, "sessions": sessions,
            "emitted": emitted, "ingested": ingested, "run": run, "rooms": rooms}


def pulse(env, sid, venue="mercury", claimed_user="inside"):
    env["run"](env["rt"].vibe_pulse(sid, {"venue_id": venue, "user_id": claimed_user, "avg_g_force": 1.8}))


def refusals(env):
    return [d for e, d, _ in env["emitted"] if e == "tap_refused"]


def test_a_signed_in_person_inside_is_counted_as_themselves(env):
    env["run"](env["rt"].connect("s1", {}, {"token": "tok-inside"}))
    pulse(env, "s1", claimed_user="someone-else")
    assert [i["scout_id"] for i in env["ingested"]] == ["inside"]
    assert refusals(env) == []


def test_a_socket_with_no_session_cannot_tap_whatever_id_it_claims(env):
    env["run"](env["rt"].connect("s1", {}, None))
    pulse(env, "s1", claimed_user="inside")
    assert env["ingested"] == []
    assert refusals(env) == [{"venue_id": "mercury", "reason": "not_signed_in"}]


def test_a_signed_in_person_who_is_not_inside_cannot_tap(env):
    env["run"](env["rt"].connect("s2", {}, {"token": "tok-outside"}))
    pulse(env, "s2")
    assert env["ingested"] == []
    assert refusals(env) == [{"venue_id": "mercury", "reason": "not_inside"}]


def test_being_inside_one_venue_does_not_let_you_tap_another(env):
    env["run"](env["rt"].connect("s1", {}, {"token": "tok-inside"}))
    pulse(env, "s1", venue="quilox")
    assert env["ingested"] == []


def test_authenticate_after_connecting_and_signing_out(env):
    rt = env["rt"]
    env["run"](rt.connect("s1", {}, None))
    env["run"](rt.authenticate("s1", {"token": "tok-inside"}))
    pulse(env, "s1")
    assert len(env["ingested"]) == 1
    env["run"](rt.authenticate("s1", {"token": None}))
    pulse(env, "s1")
    assert len(env["ingested"]) == 1
    assert ("authenticated", {"signed_in": False}, "s1") in env["emitted"]


def test_a_socket_sits_in_its_owners_room_and_moves_when_they_change(env):
    # A Viibe flashes a person's phones through this room, so a signed-out or
    # switched socket must never stay in the old owner's room.
    rt, run = env["rt"], env["run"]
    run(rt.connect("s1", {}, {"token": "tok-inside"}))
    assert env["rooms"]["s1"] == {"user_inside"}
    run(rt.authenticate("s1", {"token": "tok-outside"}))
    assert env["rooms"]["s1"] == {"user_outside"}
    run(rt.authenticate("s1", {"token": None}))
    assert env["rooms"]["s1"] == set()


def test_a_bad_or_expired_token_is_signed_out(env):
    env["run"](env["db"].user_sessions.insert_one({"user_id": "inside", "session_token": "old",
                                                    "expires_at": NOW - timedelta(days=1)}))
    for token in ("nonsense", "old", 42):
        env["run"](env["rt"].authenticate("s9", {"token": token}))
        assert env["sessions"]["s9"] == {}


def test_a_recent_bolt_from_inside_the_geofence_counts_as_inside(env):
    env["run"](env["db"].venue_bolts.insert_one({"venue_id": "quilox", "user_id": "outside", "present": True,
                                                 "ts": NOW - timedelta(minutes=5)}))
    env["run"](env["db"].venue_bolts.insert_one({"venue_id": "hardrock", "user_id": "outside", "present": True,
                                                 "ts": NOW - timedelta(minutes=40)}))
    env["run"](env["db"].venue_bolts.insert_one({"venue_id": "shiro", "user_id": "outside", "present": False,
                                                 "ts": NOW - timedelta(minutes=1)}))
    gate, run = env["gate"], env["run"]
    assert run(gate.is_inside("outside", "quilox")) is True
    assert run(gate.is_inside("outside", "hardrock")) is False     # too long ago
    assert run(gate.is_inside("outside", "shiro")) is False        # position was outside


def test_an_auto_checkin_counts_only_when_verified_and_past_a_walk_by(env):
    db, gate, run = env["db"], env["gate"], env["run"]
    run(db.checkins.insert_one({"user_id": "outside", "venue_id": "a", "status": "active", "source": "auto",
                                "verified": False, "created_at": NOW - timedelta(minutes=30),
                                "expires_at": NOW + timedelta(hours=3)}))
    run(db.checkins.insert_one({"user_id": "outside", "venue_id": "b", "status": "active", "source": "auto",
                                "verified": True, "created_at": NOW - timedelta(seconds=30),
                                "expires_at": NOW + timedelta(hours=3)}))
    run(db.checkins.insert_one({"user_id": "outside", "venue_id": "c", "status": "active", "source": "auto",
                                "verified": True, "created_at": NOW - timedelta(minutes=30),
                                "expires_at": NOW + timedelta(hours=3)}))
    assert run(gate.is_inside("outside", "a")) is False
    assert run(gate.is_inside("outside", "b")) is False
    assert run(gate.is_inside("outside", "c")) is True


def test_answers_are_cached_and_forget_clears_them(env):
    db, gate, run = env["db"], env["gate"], env["run"]
    assert run(gate.is_inside("outside", "quilox", mono=0.0)) is False
    run(db.venue_bolts.insert_one({"venue_id": "quilox", "user_id": "outside", "present": True, "ts": NOW}))
    assert run(gate.is_inside("outside", "quilox", mono=10.0)) is False   # cached
    gate.forget("outside", "quilox")
    assert run(gate.is_inside("outside", "quilox", mono=11.0)) is True


def test_refusals_are_not_repeated_on_every_tap(env):
    env["run"](env["rt"].connect("s2", {}, {"token": "tok-outside"}))
    for _ in range(20):
        pulse(env, "s2")
    assert len(refusals(env)) == 1


def test_tap_velocity_is_gated_the_same_way(env):
    rt, run = env["rt"], env["run"]
    run(rt.connect("s2", {}, {"token": "tok-outside"}))
    run(rt.tap_velocity("s2", {"venue_id": "mercury", "user_id": "inside", "intensity": "power"}))
    assert not any(e == "kinetics_update" for e, _, _ in env["emitted"])
    run(rt.connect("s1", {}, {"token": "tok-inside"}))
    run(rt.tap_velocity("s1", {"venue_id": "mercury", "intensity": "power"}))
    assert any(e == "kinetics_update" for e, _, _ in env["emitted"])
