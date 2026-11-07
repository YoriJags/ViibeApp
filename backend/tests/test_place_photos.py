"""Place photos: the match must be the right place, and failures stay quiet."""
import asyncio

import httpx

from app.services import place_photos as pp

PIN = (6.4307508, 3.4374689)  # Mercury Lagos


def test_the_nearest_place_within_range_wins():
    places = [
        {"id": "far", "location": {"latitude": 6.45, "longitude": 3.40}},
        {"id": "near", "location": {"latitude": 6.4308, "longitude": 3.4375}},
        {"id": "close", "location": {"latitude": 6.4320, "longitude": 3.4380}},
    ]
    assert pp.pick_match(places, *PIN) == "near"


def test_a_place_outside_the_radius_is_never_used():
    places = [{"id": "elsewhere", "location": {"latitude": 6.4400, "longitude": 3.4374689}}]
    assert pp.pick_match(places, *PIN) is None
    assert pp.pick_match([{"id": "no-location"}], *PIN) is None


class FakeVenues:
    def __init__(self):
        self.updates = []

    async def update_one(self, q, u):
        self.updates.append((q, u))


class FakeDB:
    venues = FakeVenues()


def test_no_key_means_no_photo_and_no_call(monkeypatch):
    monkeypatch.delenv("GOOGLE_PLACES_API_KEY", raising=False)
    pp._cache.clear()
    venue = {"id": "v1", "name": "Mercury Lagos", "coordinates": {"lat": PIN[0], "lng": PIN[1]}}
    assert asyncio.run(pp.venue_photo(venue, FakeDB())) is None


def test_a_google_refusal_returns_none_and_is_cached(monkeypatch):
    monkeypatch.setenv("GOOGLE_PLACES_API_KEY", "AIza-test")
    pp._cache.clear()
    calls = {"n": 0}

    def handler(request):
        calls["n"] += 1
        return httpx.Response(403, json={"error": {"status": "PERMISSION_DENIED"}})

    real = httpx.AsyncClient
    monkeypatch.setattr(pp.httpx, "AsyncClient",
                        lambda **kw: real(transport=httpx.MockTransport(handler), **kw))
    venue = {"id": "v2", "name": "Mercury Lagos", "coordinates": {"lat": PIN[0], "lng": PIN[1]}}
    assert asyncio.run(pp.venue_photo(venue, FakeDB())) is None
    assert asyncio.run(pp.venue_photo(venue, FakeDB())) is None
    assert calls["n"] == 1, "a refusal is cached, not retried on every view"


def test_a_match_stores_only_the_place_id_and_returns_attributions(monkeypatch):
    monkeypatch.setenv("GOOGLE_PLACES_API_KEY", "AIza-test")
    pp._cache.clear()

    def handler(request):
        path = request.url.path
        if path.endswith("places:searchText"):
            return httpx.Response(200, json={"places": [
                {"id": "ChIJmercury", "location": {"latitude": 6.4308, "longitude": 3.4375}}]})
        if path.endswith("/media"):
            return httpx.Response(200, json={"photoUri": "https://lh3.example/photo.jpg"})
        return httpx.Response(200, json={"photos": [{"name": "places/ChIJmercury/photos/p1",
            "authorAttributions": [{"displayName": "Ada", "uri": "https://maps.google.com/ada"}]}]})

    real = httpx.AsyncClient
    monkeypatch.setattr(pp.httpx, "AsyncClient",
                        lambda **kw: real(transport=httpx.MockTransport(handler), **kw))
    db = FakeDB()
    db.venues = FakeVenues()
    venue = {"id": "v3", "name": "Mercury Lagos", "coordinates": {"lat": PIN[0], "lng": PIN[1]}}
    photo = asyncio.run(pp.venue_photo(venue, db))
    assert photo["url"] == "https://lh3.example/photo.jpg"
    assert photo["attributions"] == [{"name": "Ada", "uri": "https://maps.google.com/ada"}]
    assert db.venues.updates == [({"id": "v3"}, {"$set": {"google_place_id": "ChIJmercury"}})]


def test_events_never_get_a_place_photo(monkeypatch):
    monkeypatch.setenv("GOOGLE_PLACES_API_KEY", "AIza-test")
    assert asyncio.run(pp.venue_photo({"id": "e1", "kind": "event"}, FakeDB())) is None
