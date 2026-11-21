"""
Places: permanent locations that host events but are not venues themselves.

The National Theatre, Tafawa Balewa Square, a beach. Dave's concert is an event
at the National Theatre; the next show there reuses the place's location
instead of someone pinning it again, so a location checked once stays checked.

A place is never on the map by itself and never watched by phones. Only an
event at it, inside the event's own time window, is.

Where a location came from is kept, because it decides how far it can be trusted:

  pin            dropped on a map by whoever submitted it
  openstreetmap  picked from an OpenStreetMap search result
  on_site        set from a phone standing at the place (organiser, accuracy <= 50 m)
  crowd          moved by an admin to where verified people actually gathered
"""
import time
import uuid
from datetime import datetime, timezone

import httpx

PLACE_TYPES = ("theatre", "arena", "stadium", "park", "beach", "field", "street", "hall", "other")

# A ground's usual size. Bounded by the event limits (60 to 1500 m) anyway.
DEFAULT_RADIUS_M = {
    "theatre": 120, "hall": 100, "arena": 200, "stadium": 300, "park": 300,
    "beach": 400, "field": 300, "street": 200, "other": 200,
}

STATUS_PENDING = "pending"
STATUS_APPROVED = "approved"
STATUS_REJECTED = "rejected"

SOURCES = ("pin", "openstreetmap", "on_site", "crowd")

# OpenStreetMap search is bounded to the city, so "National Theatre" finds
# Lagos's and not London's. west, south, east, north.
CITY_BOUNDS = {
    "lagos": (2.70, 6.35, 4.35, 6.75),
    "abuja": (7.25, 8.85, 7.65, 9.25),
}

NOMINATIM = "https://nominatim.openstreetmap.org/search"
# Nominatim's usage policy asks for an identifying client name and light use.
# A generic product name, never anything about the person searching.
CLIENT_NAME = "VIIBE-place-search/1.0"
_CACHE: dict[tuple[str, str], tuple[float, list[dict]]] = {}
CACHE_SECONDS = 24 * 3600

TEXT_LIMITS = {"name": 120, "area": 80, "address": 200}


def default_radius(place_type: str) -> int:
    return DEFAULT_RADIUS_M.get(place_type, DEFAULT_RADIUS_M["other"])


def _bad_text(value) -> bool:
    return any(c in "<>" or (ord(c) < 32 and c not in "\t") or ord(c) == 127 for c in str(value))


def validate_place(payload: dict) -> list[str]:
    """Plain-English problems with a place before it is saved. Empty means valid."""
    from app.services.events import MAX_RADIUS_M, MIN_RADIUS_M
    problems = []
    for field, limit in TEXT_LIMITS.items():
        value = payload.get(field)
        if value is None:
            continue
        if not isinstance(value, str) or len(value) > limit:
            problems.append(f"{field} must be text of at most {limit} characters.")
        elif _bad_text(value):
            problems.append(f"{field} cannot contain < or > or control characters.")
    if not (payload.get("name") or "").strip():
        problems.append("The place needs a name.")
    if payload.get("place_type", "other") not in PLACE_TYPES:
        problems.append(f"Place type must be one of: {', '.join(PLACE_TYPES)}.")
    if (payload.get("city") or "lagos").lower() not in CITY_BOUNDS:
        problems.append(f"City must be one of: {', '.join(CITY_BOUNDS)}.")
    coords = payload.get("coordinates") or {}
    try:
        lat, lng = float(coords.get("lat")), float(coords.get("lng"))
        west, south, east, north = CITY_BOUNDS.get((payload.get("city") or "lagos").lower(), CITY_BOUNDS["lagos"])
        if not (south <= lat <= north and west <= lng <= east):
            problems.append("The location is outside the city.")
    except (TypeError, ValueError):
        problems.append("The place needs a location.")
    radius = payload.get("ground_radius_m")
    if radius is not None:
        try:
            if not (MIN_RADIUS_M <= float(radius) <= MAX_RADIUS_M):
                problems.append(f"The ground radius must be between {MIN_RADIUS_M} and {MAX_RADIUS_M} metres.")
        except (TypeError, ValueError):
            problems.append("The ground radius must be a number of metres.")
    if payload.get("location_source", "pin") not in ("pin", "openstreetmap"):
        problems.append("A submitted place is located by a pin or an OpenStreetMap result.")
    return problems


def new_place_document(payload: dict, submitted_by: str, approved: bool = False) -> dict:
    place_type = payload.get("place_type") or "other"
    now = datetime.now(timezone.utc)
    return {
        "id": str(uuid.uuid4()),
        "name": payload["name"].strip(),
        "area": (payload.get("area") or "").strip(),
        "address": (payload.get("address") or "").strip(),
        "city": (payload.get("city") or "lagos").lower(),
        "place_type": place_type,
        "coordinates": {"lat": float(payload["coordinates"]["lat"]),
                        "lng": float(payload["coordinates"]["lng"])},
        "ground_radius_m": float(payload.get("ground_radius_m") or default_radius(place_type)),
        "location_source": payload.get("location_source") or "pin",
        "osm_id": payload.get("osm_id"),
        "status": STATUS_APPROVED if approved else STATUS_PENDING,
        "submitted_by": submitted_by,
        "created_at": now,
        "on_site_fix_at": None,
    }


def public_place(doc: dict) -> dict:
    """A place as anyone may see it: never who submitted it."""
    out = {k: v for k, v in doc.items() if k not in ("_id", "submitted_by", "review")}
    for k in ("created_at", "on_site_fix_at"):
        if isinstance(out.get(k), datetime):
            v = out[k]
            out[k] = (v if v.tzinfo else v.replace(tzinfo=timezone.utc)).isoformat()
    return out


def _osm_type(row: dict) -> str:
    """Map an OpenStreetMap category onto ours, so the default ground size fits."""
    kind = f"{row.get('category', '')}:{row.get('type', '')}"
    for needle, ours in (("theatre", "theatre"), ("stadium", "stadium"), ("arena", "arena"),
                         ("beach", "beach"), ("park", "park"), ("pitch", "field"),
                         ("conference", "hall"), ("events_venue", "hall"), ("community_centre", "hall"),
                         ("highway", "street")):
        if needle in kind:
            return ours
    return "other"


def parse_osm(rows: list[dict]) -> list[dict]:
    out = []
    for r in rows:
        try:
            lat, lng = float(r["lat"]), float(r["lon"])
        except (KeyError, TypeError, ValueError):
            continue
        name = (r.get("name") or (r.get("display_name") or "").split(",")[0]).strip()
        if not name:
            continue
        place_type = _osm_type(r)
        out.append({
            "source": "openstreetmap",
            "osm_id": f"{r.get('osm_type', '')}/{r.get('osm_id', '')}",
            "name": name[:120],
            "address": (r.get("display_name") or "")[:200],
            "place_type": place_type,
            "coordinates": {"lat": lat, "lng": lng},
            "ground_radius_m": default_radius(place_type),
        })
    return out


async def search_openstreetmap(q: str, city: str, client: httpx.AsyncClient | None = None) -> list[dict]:
    """
    Up to five OpenStreetMap places matching q inside the city. Cached a day per
    query, and an empty list (never an error) if the service is slow or down:
    search must not fail because a free public service did.
    """
    q = q.strip()
    key = (q.lower(), city)
    hit = _CACHE.get(key)
    if hit and time.monotonic() - hit[0] < CACHE_SECONDS:
        return hit[1]
    west, south, east, north = CITY_BOUNDS.get(city, CITY_BOUNDS["lagos"])
    params = {"q": q, "format": "jsonv2", "limit": 5, "bounded": 1, "countrycodes": "ng",
              "viewbox": f"{west},{north},{east},{south}"}
    own = client is None
    client = client or httpx.AsyncClient(timeout=6.0, headers={"User-Agent": CLIENT_NAME})
    try:
        r = await client.get(NOMINATIM, params=params)
        if r.status_code != 200:
            return []
        results = parse_osm(r.json())
    except Exception:
        return []  # not cached: a failure should not hide results for a day
    finally:
        if own:
            await client.aclose()
    _CACHE[key] = (time.monotonic(), results)
    return results
