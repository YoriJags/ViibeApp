"""
Venue photos from Google Places, for the venue screen's hero image.

How this stays inside Google's terms and our own honesty rule:
  - Only the place ID is stored on the venue. Google allows caching place IDs;
    photo names and photo URLs are short-lived, so they are kept in memory for
    under an hour and never written to the database.
  - Every photo goes out with its author attributions, which the app shows.
  - A match is accepted only if Google's place sits within MATCH_RADIUS_M of
    our coordinates, so a venue never wears another place's photo.
  - The key stays on the server. The app only ever sees a photo URL.

Needs GOOGLE_PLACES_API_KEY with Places API (New) enabled and billing on.
"""
import logging
import os
import time
from math import atan2, cos, radians, sin, sqrt

import httpx

log = logging.getLogger(__name__)

API = "https://places.googleapis.com/v1"
MATCH_RADIUS_M = 250
CACHE_SECONDS = 50 * 60
MISS_SECONDS = 6 * 3600     # a place with no photo, or an API failure, is not retried every view
MAX_WIDTH_PX = 1200

_cache: dict[str, tuple[float, dict | None]] = {}


def _key() -> str:
    return os.environ.get("GOOGLE_PLACES_API_KEY", "")


def _distance_m(a_lat, a_lng, b_lat, b_lng) -> float:
    p1, p2 = radians(a_lat), radians(b_lat)
    dp, dl = radians(b_lat - a_lat), radians(b_lng - a_lng)
    h = sin(dp / 2) ** 2 + cos(p1) * cos(p2) * sin(dl / 2) ** 2
    return 6371000 * 2 * atan2(sqrt(h), sqrt(1 - h))


def pick_match(places: list[dict], lat: float, lng: float) -> str | None:
    """The nearest returned place within MATCH_RADIUS_M of our pin, or None."""
    best = None
    for p in places:
        loc = p.get("location") or {}
        if "latitude" not in loc:
            continue
        d = _distance_m(lat, lng, loc["latitude"], loc["longitude"])
        if d <= MATCH_RADIUS_M and (best is None or d < best[0]):
            best = (d, p.get("id"))
    return best[1] if best else None


async def find_place_id(client: httpx.AsyncClient, venue: dict) -> str | None:
    c = venue.get("coordinates") or {}
    if "lat" not in c:
        return None
    query = ", ".join(x for x in (venue.get("name"), venue.get("address"), venue.get("area"), "Lagos") if x)
    r = await client.post(f"{API}/places:searchText", headers={
        "X-Goog-Api-Key": _key(),
        "X-Goog-FieldMask": "places.id,places.location",
    }, json={
        "textQuery": query,
        "maxResultCount": 5,
        "locationBias": {"circle": {"center": {"latitude": c["lat"], "longitude": c["lng"]},
                                    "radius": float(MATCH_RADIUS_M)}},
    })
    r.raise_for_status()
    return pick_match(r.json().get("places", []), c["lat"], c["lng"])


async def _photo_for_place(client: httpx.AsyncClient, place_id: str) -> dict | None:
    r = await client.get(f"{API}/places/{place_id}", headers={
        "X-Goog-Api-Key": _key(), "X-Goog-FieldMask": "photos"})
    r.raise_for_status()
    photos = r.json().get("photos") or []
    if not photos:
        return None
    photo = photos[0]
    m = await client.get(f"{API}/{photo['name']}/media", headers={"X-Goog-Api-Key": _key()},
                         params={"maxWidthPx": MAX_WIDTH_PX, "skipHttpRedirect": "true"})
    m.raise_for_status()
    uri = m.json().get("photoUri")
    if not uri:
        return None
    return {
        "url": uri,
        "attributions": [
            {"name": a.get("displayName"), "uri": a.get("uri")}
            for a in photo.get("authorAttributions") or [] if a.get("displayName")
        ],
        "source": "google",
    }


async def venue_photo(venue: dict, db) -> dict | None:
    """A photo for the venue, or None. Never raises: a missing photo is not an error."""
    if not _key() or venue.get("kind") == "event":
        return None
    vid = venue["id"]
    hit = _cache.get(vid)
    if hit and hit[0] > time.time():
        return hit[1]

    photo, ttl = None, MISS_SECONDS
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            place_id = venue.get("google_place_id")
            if not place_id:
                place_id = await find_place_id(client, venue)
                if place_id:
                    await db.venues.update_one({"id": vid}, {"$set": {"google_place_id": place_id}})
            if place_id:
                photo = await _photo_for_place(client, place_id)
                if photo:
                    ttl = CACHE_SECONDS
    except httpx.HTTPError as e:
        # Logged without the request, so the key never reaches the logs.
        status = getattr(getattr(e, "response", None), "status_code", None)
        log.warning("place photo for %s failed: %s %s", vid, type(e).__name__, status)
    _cache[vid] = (time.time() + ttl, photo)
    return photo
