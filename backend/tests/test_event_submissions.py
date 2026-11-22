"""
Community events, places and VIIBE Certified, through the real routes.

Anyone signed in can put an event forward, so every rule here is about not
being fooled: by someone claiming to be Dave, by a duplicate, by a pin dropped
to watch who turns up somewhere, or by a pin in the wrong place.
"""
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

mongomock_motor = pytest.importorskip("mongomock_motor")

ADMIN = {"id": "admin-1", "username": "yori", "is_super_admin": True}
ALICE = {"id": "alice", "username": "alice"}
BOB = {"id": "bob", "username": "bob"}

THEATRE = {"lat": 6.4750, "lng": 3.3690}   # a ground inside Lagos


@pytest.fixture
def env(monkeypatch):
    db = mongomock_motor.AsyncMongoMockClient()["viibe_test"]
    import app.config
    import app.routes.certification as cert_routes
    import app.routes.checkins as checkin_routes
    import app.routes.events as events_routes
    import app.routes.places as places_routes
    import app.routes.venues as venue_routes
    import app.services.auth as auth
    for mod in (app.config, cert_routes, checkin_routes, events_routes, places_routes, venue_routes, auth):
        monkeypatch.setattr(mod, "db", db, raising=False)

    async def no_osm(q, city, client=None):
        return [{"source": "openstreetmap", "osm_id": "way/1", "name": "National Theatre Lagos",
                 "address": "Iganmu, Lagos", "place_type": "theatre",
                 "coordinates": THEATRE, "ground_radius_m": 120}]
    monkeypatch.setattr(places_routes, "search_openstreetmap", no_osm)

    current = {"user": ALICE}

    async def as_admin():
        return ADMIN

    async def as_current():
        return current["user"]

    app_ = FastAPI()
    for r in (events_routes.router, places_routes.router, cert_routes.router, venue_routes.router,
              checkin_routes.router):
        app_.include_router(r, prefix="/api")
    app_.dependency_overrides[auth.require_admin] = as_admin
    app_.dependency_overrides[auth.require_auth] = as_current
    return TestClient(app_), db, current


def body(**over):
    start = datetime.now(timezone.utc) + timedelta(minutes=-30)
    b = {"name": "Dave Live in Lagos", "venue_type": "concert", "entry": "ticketed",
         "coordinates": THEATRE, "geofence_radius_m": 150, "area": "Iganmu",
         "starts_at": start.isoformat(), "ends_at": (start + timedelta(hours=5)).isoformat(),
         "organiser_name": "Dave", "ticket_url": "https://tix.example/dave"}
    b.update(over)
    return b


def submit(client, **over):
    return client.post("/api/events/submit", json=body(**over))


def approve(client, event_id, **payload):
    return client.post(f"/api/admin/events/{event_id}/approve", json=payload)


def run(db_call):
    import asyncio
    return asyncio.run(db_call)


# ── Impersonation and privacy ────────────────────────────────────────────────

def test_a_submission_waits_off_the_map_and_never_shows_who_sent_it(env):
    client, db, _ = env
    r = submit(client)
    assert r.status_code == 200, r.text
    ev = r.json()["event"]
    assert r.json()["status"] == "pending"
    assert "submitted_by" not in ev and "created_by" not in ev
    assert client.get("/api/events?city=lagos").json() == []
    assert all(v.get("id") != ev["id"] for v in client.get("/api/venues?city=lagos").json())


def test_claiming_to_be_dave_shows_a_host_marked_not_verified_and_no_ticket_link(env):
    # People are free to name their host. What they cannot get without being
    # certified is the ticket link (where a fake organiser takes money) or the
    # verified mark.
    client, db, _ = env
    ev = submit(client).json()["event"]
    approve(client, ev["id"])
    listed = client.get("/api/events?city=lagos").json()[0]
    assert listed["listing"] == "community"
    assert listed["organiser_name"] == "Dave" and listed["organiser_verified"] is False
    assert "ticket_url" not in listed
    # The admin still sees what was claimed, from the private record only.
    assert run(db.event_private.find_one({"event_id": ev["id"]}))["claimed_organiser"] == "Dave"
    live = run(db.venues.find_one({"id": ev["id"]}))
    assert not any(k in live for k in ("submitted_by", "claimed_organiser", "ticket_url_claimed", "reports"))
    assert live.get("ticket_url") is None and live.get("created_by") is None


def test_a_pending_submission_is_not_in_the_venues_collection_at_all(env):
    # Dozens of routes read venues in their own ways; a pending or rejected
    # submission must not be there for any of them to leak.
    client, db, _ = env
    ev = submit(client).json()["event"]
    assert run(db.venues.find_one({"id": ev["id"]})) is None
    client.post(f"/api/admin/events/{ev['id']}/reject", json={"reason": "Not real."})
    assert run(db.venues.find_one({"id": ev["id"]})) is None


def test_a_certified_organisers_event_is_official_under_the_certified_name(env):
    client, db, current = env
    client.post("/api/certification/apply", json={
        "kind": "organiser", "name": "Dave Official", "links": ["https://davemusic.example"],
        "contact": "mgmt@davemusic.example"})
    app_id = client.get("/api/admin/certification").json()["applications"][0]["id"]
    assert client.post(f"/api/admin/certification/{app_id}/certify",
                       json={"method": "link_and_contact_confirmed"}).status_code == 200
    ev = submit(client, organiser_name="Anything Typed").json()["event"]
    approve(client, ev["id"])
    listed = client.get("/api/events?city=lagos").json()[0]
    assert listed["listing"] == "official"
    assert listed["organiser_name"] == "Dave Official"
    assert listed["ticket_url"] == "https://tix.example/dave"


def _certify(client, name):
    client.post("/api/certification/apply", json={
        "kind": "organiser", "name": name, "links": ["https://davemusic.example"],
        "contact": "mgmt@davemusic.example"})
    app_id = client.get("/api/admin/certification").json()["applications"][0]["id"]
    client.post(f"/api/admin/certification/{app_id}/certify", json={"method": "link_and_contact_confirmed"})


def test_nobody_else_can_host_under_a_certified_organisers_name(env):
    client, db, current = env
    current["user"] = BOB
    _certify(client, "Dave Official")
    current["user"] = ALICE
    r = submit(client, organiser_name="dave official")
    assert r.status_code == 422 and "VIIBE Certified organiser" in r.text
    assert submit(client, organiser_name="Dave Fan Club").status_code == 200


# ── Making it yours ──────────────────────────────────────────────────────────

def test_anyone_can_describe_their_event_freely(env):
    client, db, _ = env
    ev = submit(client, description="Two stages, food court, bring your crew.",
                lineup=["Dave", "DJ Spinall"], genres=["Afrobeats", "Amapiano"],
                dress_code="All white", price_text="N10000 - 15000", age_limit=18).json()["event"]
    approve(client, ev["id"])
    listed = client.get("/api/events?city=lagos").json()[0]
    assert listed["lineup"] == ["Dave", "DJ Spinall"] and listed["genres"] == ["Afrobeats", "Amapiano"]
    assert listed["dress_code"] == "All white" and listed["age_limit"] == 18
    assert listed["price_text"] == "N10000 - 15000"   # a price range is not a phone number


@pytest.mark.parametrize("field,value", [
    ("description", "Tickets at www.dave-tix.com"),
    ("description", "DM 08031234567 for tables"),
    ("description", "Buy at https://fake.example"),
    ("lineup", ["Dave", "wa.me/2348031234567"]),
    ("price_text", "Pay at davetix.ng"),
])
def test_links_and_phone_numbers_cannot_slip_in_through_free_text(env, field, value):
    client, _, _ = env
    r = submit(client, **{field: value})
    assert r.status_code == 422 and "links or phone numbers" in r.text


def test_a_cover_photo_shows_only_after_approval(env):
    import base64
    client, db, _ = env
    jpeg = bytes([0xFF, 0xD8, 0xFF, 0xE0]) + bytes(64)
    ev = submit(client, cover_base64=base64.b64encode(jpeg).decode()).json()["event"]
    assert ev["cover_image_url"] == f"/api/events/{ev['id']}/cover"
    assert client.get(f"/api/events/{ev['id']}/cover").status_code == 404     # pending
    assert client.get(f"/api/admin/events/{ev['id']}/cover").content == jpeg  # admin can check it
    approve(client, ev["id"])
    r = client.get(f"/api/events/{ev['id']}/cover")
    assert r.status_code == 200 and r.content == jpeg and r.headers["content-type"] == "image/jpeg"
    client.post(f"/api/admin/events/{ev['id']}/reject", json={"reason": "Fake."})
    assert run(db.event_covers.find_one({"event_id": ev["id"]})) is None


def test_a_cover_that_is_not_a_photo_is_refused(env):
    import base64
    client, _, _ = env
    r = submit(client, cover_base64=base64.b64encode(b"<script>").decode())
    assert r.status_code == 422 and "JPEG or PNG" in r.text


# ── Spam and duplicates ──────────────────────────────────────────────────────

def test_at_most_three_waiting_submissions_per_person(env):
    client, _, _ = env
    for i in range(3):
        later = datetime.now(timezone.utc) + timedelta(days=i + 1)
        assert submit(client, name=f"Night {i}", starts_at=later.isoformat(),
                      ends_at=(later + timedelta(hours=4)).isoformat()).status_code == 200
    later = datetime.now(timezone.utc) + timedelta(days=9)
    r = submit(client, name="Fourth", starts_at=later.isoformat(), ends_at=(later + timedelta(hours=4)).isoformat())
    assert r.status_code == 429


def test_the_same_event_twice_is_refused(env):
    client, _, current = env
    ev = submit(client).json()["event"]
    approve(client, ev["id"])
    current["user"] = BOB
    r = submit(client, name="Dave at the Theatre")
    assert r.status_code == 409
    assert r.json()["detail"]["existing"]["id"] == ev["id"]


# ── Approval, rejection, the organiser link ─────────────────────────────────

def test_approval_lists_it_and_only_the_submitter_gets_the_organiser_link(env):
    client, _, current = env
    ev = submit(client).json()["event"]
    approve(client, ev["id"])
    mine = client.get("/api/me/submissions").json()["events"][0]
    assert mine["status"] == "live" and mine["organiser_link"].startswith(f"/organiser/{ev['id']}?key=")
    current["user"] = BOB
    assert client.get("/api/me/submissions").json()["events"] == []


def test_a_rejection_reaches_the_submitter_with_its_reason(env):
    client, _, _ = env
    ev = submit(client).json()["event"]
    client.post(f"/api/admin/events/{ev['id']}/reject", json={"reason": "No proof this is happening."})
    mine = client.get("/api/me/submissions").json()["events"][0]
    assert mine["status"] == "rejected" and mine["reason"] == "No proof this is happening."


# ── Reports ──────────────────────────────────────────────────────────────────

def test_three_different_reports_take_a_community_listing_down(env):
    client, _, current = env
    ev = submit(client).json()["event"]
    approve(client, ev["id"])
    for uid in ("r1", "r1", "r2"):
        current["user"] = {"id": uid}
        client.post(f"/api/events/{ev['id']}/report", json={"reason": "fake"})
    assert len(client.get("/api/events?city=lagos").json()) == 1   # r1 twice counts once
    current["user"] = {"id": "r3"}
    client.post(f"/api/events/{ev['id']}/report", json={"reason": "impersonation"})
    assert client.get("/api/events?city=lagos").json() == []
    queued = client.get("/api/admin/submissions").json()["events"][0]
    assert queued["state"] == "taken_down" and len(queued["reports"]) == 3


def test_reports_flag_but_do_not_hide_an_official_event(env):
    client, _, current = env
    r = client.post("/api/admin/events", json=body(name="Admin Event"))
    ev_id = r.json()["event"]["id"]
    for uid in ("r1", "r2", "r3"):
        current["user"] = {"id": uid}
        client.post(f"/api/events/{ev_id}/report", json={"reason": "fake"})
    assert len(client.get("/api/events?city=lagos").json()) == 1


# ── The organiser on site ────────────────────────────────────────────────────

def organiser_key(client, db, event_id):
    return run(db.event_keys.find_one({"event_id": event_id}))["key"]


def test_an_imprecise_fix_is_refused_and_a_short_one_moves_the_pin(env):
    client, db, _ = env
    ev = submit(client).json()["event"]
    approve(client, ev["id"])
    key = organiser_key(client, db, ev["id"])
    near = {"lat": THEATRE["lat"] + 0.0009, "lng": THEATRE["lng"]}      # about 100 m
    r = client.post(f"/api/organiser/events/{ev['id']}/here?key={key}", json={**near, "accuracy_m": 120})
    assert r.json()["decision"] == "too_imprecise"
    r = client.post(f"/api/organiser/events/{ev['id']}/here?key={key}", json={**near, "accuracy_m": 15})
    assert r.json()["decision"] == "apply"
    doc = run(db.venues.find_one({"id": ev["id"]}))
    assert doc["coordinates"] == near and doc["location_set_on_site"] is True
    assert run(db.event_location_log.count_documents({"event_id": ev["id"]})) == 1


def test_repeated_fixes_cannot_walk_the_pin_away(env):
    client, db, _ = env
    ev = submit(client).json()["event"]
    approve(client, ev["id"])
    key = organiser_key(client, db, ev["id"])
    url = f"/api/organiser/events/{ev['id']}/here?key={key}"
    step = 0.0025  # about 280 m north each time
    r1 = client.post(url, json={"lat": THEATRE["lat"] + step, "lng": THEATRE["lng"], "accuracy_m": 10})
    assert r1.json()["decision"] == "apply"
    # The second step is 560 m from the approved spot, not 280 m from the last fix.
    r2 = client.post(url, json={"lat": THEATRE["lat"] + 2 * step, "lng": THEATRE["lng"], "accuracy_m": 10})
    assert r2.json()["decision"] == "needs_admin"
    # And after two applied fixes, even a short one waits.
    client.post(url, json={"lat": THEATRE["lat"] + 0.0005, "lng": THEATRE["lng"], "accuracy_m": 10})
    r4 = client.post(url, json={"lat": THEATRE["lat"] + 0.0006, "lng": THEATRE["lng"], "accuracy_m": 10})
    assert r4.json()["decision"] == "needs_admin"


def test_without_an_approved_anchor_an_on_site_fix_waits_for_an_admin(env):
    client, db, _ = env
    ev = submit(client).json()["event"]
    approve(client, ev["id"])
    run(db.event_private.update_one({"event_id": ev["id"]}, {"$unset": {"approved_coordinates": ""}}))
    key = organiser_key(client, db, ev["id"])
    r = client.post(f"/api/organiser/events/{ev['id']}/here?key={key}",
                    json={"lat": THEATRE["lat"] + 0.0005, "lng": THEATRE["lng"], "accuracy_m": 10})
    assert r.json()["decision"] == "needs_admin"
    assert run(db.venues.find_one({"id": ev["id"]}))["coordinates"] == THEATRE


def test_putting_a_taken_down_event_back_up_keeps_its_anchor_and_used_fixes(env):
    client, db, current = env
    ev = submit(client).json()["event"]
    approve(client, ev["id"])
    key = organiser_key(client, db, ev["id"])
    url = f"/api/organiser/events/{ev['id']}/here?key={key}"
    for d in (0.0005, 0.0006):
        client.post(url, json={"lat": THEATRE["lat"] + d, "lng": THEATRE["lng"], "accuracy_m": 10})
    for uid in ("r1", "r2", "r3"):
        current["user"] = {"id": uid}
        client.post(f"/api/events/{ev['id']}/report", json={"reason": "fake"})
    approve(client, ev["id"])   # restore, no new coordinates
    priv = run(db.event_private.find_one({"event_id": ev["id"]}))
    assert priv["approved_coordinates"] == THEATRE and priv["on_site_fixes"] == 2
    r = client.post(url, json={"lat": THEATRE["lat"] + 0.0007, "lng": THEATRE["lng"], "accuracy_m": 10})
    assert r.json()["decision"] == "needs_admin"


def test_an_admins_own_event_has_an_anchor_from_the_start(env):
    client, db, _ = env
    ev_id = client.post("/api/admin/events", json=body(name="Admin Night")).json()["event"]["id"]
    assert run(db.event_private.find_one({"event_id": ev_id}))["approved_coordinates"] == THEATRE


def test_a_community_organiser_never_changes_the_shared_place(env):
    client, db, _ = env
    r = client.post("/api/places", json={"name": "National Theatre", "place_type": "theatre",
                                         "city": "lagos", "coordinates": THEATRE})
    place_id = r.json()["place"]["id"]
    client.post(f"/api/admin/places/{place_id}/approve", json={})
    ev = submit(client, place_id=place_id).json()["event"]
    approve(client, ev["id"])
    key = organiser_key(client, db, ev["id"])
    client.post(f"/api/organiser/events/{ev['id']}/here?key={key}",
                json={"lat": THEATRE["lat"] + 0.001, "lng": THEATRE["lng"], "accuracy_m": 10})
    place = run(db.places.find_one({"id": place_id}))
    assert place["coordinates"] == THEATRE and "proposed_location" not in place


def test_a_taken_down_or_rejected_events_organiser_link_stops_working(env):
    client, db, current = env
    ev = submit(client).json()["event"]
    approve(client, ev["id"])
    key = organiser_key(client, db, ev["id"])
    assert client.get(f"/api/organiser/events/{ev['id']}?key={key}").status_code == 200
    for uid in ("r1", "r2", "r3"):
        current["user"] = {"id": uid}
        client.post(f"/api/events/{ev['id']}/report", json={"reason": "fake"})
    assert client.get(f"/api/organiser/events/{ev['id']}?key={key}").status_code == 404
    client.post(f"/api/admin/events/{ev['id']}/reject", json={"reason": "Fake event."})
    assert run(db.event_keys.find_one({"event_id": ev["id"]})) is None


def test_a_far_fix_waits_for_an_admin_and_a_wrong_key_finds_nothing(env):
    client, db, _ = env
    ev = submit(client).json()["event"]
    approve(client, ev["id"])
    key = organiser_key(client, db, ev["id"])
    far = {"lat": THEATRE["lat"] + 0.02, "lng": THEATRE["lng"]}          # about 2.2 km
    r = client.post(f"/api/organiser/events/{ev['id']}/here?key={key}", json={**far, "accuracy_m": 10})
    assert r.json()["decision"] == "needs_admin"
    assert run(db.venues.find_one({"id": ev["id"]}))["coordinates"] == THEATRE
    assert client.post(f"/api/organiser/events/{ev['id']}/here?key=wrong",
                       json={**far, "accuracy_m": 10}).status_code == 404


# ── The crowd confirms or corrects ───────────────────────────────────────────

def test_five_verified_arrivals_confirm_the_location(env):
    client, db, _ = env
    ev = submit(client).json()["event"]
    approve(client, ev["id"])
    now = datetime.now(timezone.utc)
    for i in range(5):
        run(db.checkins.insert_one({"user_id": f"p{i}", "venue_id": ev["id"], "source": "auto",
                                    "verified": True, "created_at": now}))
    run(db.checkins.insert_one({"user_id": "p9", "venue_id": ev["id"], "source": "auto",
                                "verified": False, "created_at": now}))
    loc = client.get(f"/api/admin/events/{ev['id']}/location").json()["location"]
    assert loc["status"] == "confirmed" and loc["confirmed_people"] == 5


def test_people_gathering_elsewhere_suggest_a_move_that_only_an_admin_applies(env):
    client, db, current = env
    ev = submit(client).json()["event"]
    approve(client, ev["id"])
    real_spot = {"lat": THEATRE["lat"] + 0.004, "lng": THEATRE["lng"]}   # about 440 m north
    for i in range(5):
        current["user"] = {"id": f"fan{i}"}
        r = client.post("/api/checkins", json={"venue_id": ev["id"], "latitude": real_spot["lat"],
                                                 "longitude": real_spot["lng"]})
        assert r.status_code in (403, 404)
    drift = client.get(f"/api/admin/events/{ev['id']}/location").json()["location"]["drift"]
    assert drift and drift["people"] == 5 and 400 <= drift["distance_m"] <= 480
    assert run(db.venues.find_one({"id": ev["id"]}))["coordinates"] == THEATRE   # never by itself
    client.post(f"/api/admin/events/{ev['id']}/move", json={**real_spot, "reason": "crowd is here"})
    assert run(db.venues.find_one({"id": ev["id"]}))["coordinates"] == real_spot


# ── Places ───────────────────────────────────────────────────────────────────

def test_an_event_at_an_approved_place_takes_the_places_location(env):
    client, db, _ = env
    r = client.post("/api/places", json={"name": "National Theatre", "place_type": "theatre",
                                         "city": "lagos", "coordinates": THEATRE,
                                         "location_source": "openstreetmap"})
    place = r.json()["place"]
    assert "submitted_by" not in place and place["status"] == "pending"
    client.post(f"/api/admin/places/{place['id']}/approve", json={})
    ev = submit(client, place_id=place["id"], coordinates={"lat": 6.0, "lng": 3.0},
                geofence_radius_m=None).json()["event"]
    assert ev["coordinates"] == THEATRE and ev["geofence_radius_m"] == 120


def test_a_place_outside_the_city_is_refused_and_search_puts_ours_first(env):
    client, db, _ = env
    r = client.post("/api/places", json={"name": "Somewhere", "city": "lagos",
                                         "coordinates": {"lat": 9.05, "lng": 7.49}})
    assert r.status_code == 422
    r = client.post("/api/places", json={"name": "National Theatre", "place_type": "theatre",
                                         "city": "lagos", "coordinates": THEATRE})
    client.post(f"/api/admin/places/{r.json()['place']['id']}/approve", json={})
    results = client.get("/api/places/search?q=national&city=lagos").json()["results"]
    assert results[0]["source"] == "viibe" and results[1]["source"] == "openstreetmap"


# ── VIIBE Certified ──────────────────────────────────────────────────────────

def test_a_vendor_can_only_certify_the_venue_they_run(env):
    client, db, current = env
    app_ = {"kind": "vendor", "name": "Quilox", "links": ["https://quilox.example"],
            "contact": "+234 800 000 0000", "venue_id": "quilox"}
    assert client.post("/api/certification/apply", json=app_).status_code == 422
    current["user"] = {**ALICE, "merchant_venue_id": "quilox"}
    run(db.venues.insert_one({"id": "quilox", "name": "Quilox", "city": "lagos",
                              "coordinates": {"lat": 6.43, "lng": 3.42}}))
    assert client.post("/api/certification/apply", json=app_).status_code == 200
    app_id = client.get("/api/admin/certification").json()["applications"][0]["id"]
    client.post(f"/api/admin/certification/{app_id}/certify", json={"method": "link_and_contact_confirmed"})
    venue = run(db.venues.find_one({"id": "quilox"}))
    assert venue["business_certified"] is True and venue["business_certified_name"] == "Quilox"


def test_links_must_be_https_and_a_certification_lapses_after_a_year(env):
    client, db, _ = env
    bad = client.post("/api/certification/apply", json={
        "kind": "organiser", "name": "X", "links": ["http://x.example"], "contact": "x@x.example"})
    assert bad.status_code == 422
    from app.services.event_trust import is_certified
    old = {"status": "certified", "expires_at": datetime.now(timezone.utc) - timedelta(days=1)}
    assert is_certified(old) is False
