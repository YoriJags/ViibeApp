"""
Add Lagos venues for concerts, festivals and raves, plus one labelled test event.

Coordinates come from OpenStreetMap (Nominatim), looked up on 7 Nov 2026, not
estimated. Venues go in unclaimed with no reading (energy_source "none"), so
nothing glows until a scout actually rates them. Duplicates are skipped by the
seeder's own check (same name and area, or within 50 m), so this is safe to
re-run.

Usage (from backend/):
    railway run python scripts/add_lagos_venues.py            # dry run
    railway run python scripts/add_lagos_venues.py --apply
"""
import asyncio
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.config import db  # noqa: E402
from app.routes.venue_seeder import VenueSeedItem, seed_items  # noqa: E402
from app.services.events import (  # noqa: E402
    KIND_EVENT, new_event_document, new_organiser_key, validate_event,
)

V = VenueSeedItem
VENUES = [
    V(name="Mercury Lagos", address="99 Ajose Adeogun Street", area="Victoria Island",
      venue_type="lounge", lat=6.4307508, lng=3.4374689),
    V(name="Eko Convention Centre", address="Eko Hotel, Adetokunbo Ademola Street", area="Victoria Island",
      venue_type="concert", lat=6.4270738, lng=3.4302864, geofence_radius_m=200),
    V(name="Muri Okunola Park", address="Muri Okunola Park", area="Victoria Island",
      venue_type="festival", lat=6.4378201, lng=3.4250833, geofence_radius_m=200),
    V(name="Tafawa Balewa Square", address="Obalende", area="Lagos Island",
      venue_type="festival", lat=6.4470740, lng=3.4015101, geofence_radius_m=300),
    V(name="Freedom Park", address="Freedom Park", area="Lagos Island",
      venue_type="concert", lat=6.4488192, lng=3.3965307, geofence_radius_m=150),
    V(name="Terra Kulture", address="Joseph Nahman Close", area="Victoria Island",
      venue_type="concert", lat=6.4252631, lng=3.4266492),
    V(name="Federal Palace Hotel", address="6-8 Ahmadu Bello Way", area="Victoria Island",
      venue_type="concert", lat=6.4305593, lng=3.4073679, geofence_radius_m=150),
    V(name="Teslim Balogun Stadium", address="Western Avenue", area="Surulere",
      venue_type="concert", lat=6.4997711, lng=3.3607844, geofence_radius_m=300),
    V(name="National Arts Theatre", address="Iganmu", area="Iganmu",
      venue_type="concert", lat=6.4764769, lng=3.3694918, geofence_radius_m=250),
    V(name="Lagos Polo Club", address="Awolowo Road", area="Ikoyi",
      venue_type="festival", lat=6.4454664, lng=3.4217099, geofence_radius_m=300),
]
for v in VENUES:
    v.source = "osm"

# A test event, labelled as one, so the event features can be seen end to end.
# Tonight, Saturday 7 Nov 2026, 8 pm to 3 am Lagos time (WAT is UTC+1).
TEST_EVENT = {
    "name": "VIIBE Test Event",
    "organiser_name": "VIIBE",
    "venue_type": "festival",
    "entry": "ticketed",
    "address": "Muri Okunola Park",
    "area": "Victoria Island",
    "city": "lagos",
    "coordinates": {"lat": 6.4378201, "lng": 3.4250833},
    "geofence_radius_m": 250,
    "starts_at": datetime(2026, 11, 7, 19, 0, tzinfo=timezone.utc),
    "ends_at": datetime(2026, 11, 8, 2, 0, tzinfo=timezone.utc),
}


async def main(apply: bool) -> None:
    if not apply:
        print("Dry run. Would add (duplicates skipped on --apply):")
        for v in VENUES:
            print(f"  {v.name} | {v.area} | {v.venue_type} | {v.lat},{v.lng} | r={v.geofence_radius_m}m")
        print(f"  event: {TEST_EVENT['name']} {TEST_EVENT['starts_at']} to {TEST_EVENT['ends_at']}")
        return

    result = await seed_items(VENUES, user_id="script:add_lagos_venues")
    print(f"venues inserted {result['inserted']}, skipped {result['skipped']}")
    for d in result["duplicates"]:
        print("  skipped:", d["name"], d["reason"])

    problems = validate_event(TEST_EVENT)
    if problems:
        raise SystemExit(f"event invalid: {problems}")
    existing = await db.venues.find_one({"kind": KIND_EVENT, "name": TEST_EVENT["name"],
                                         "starts_at": TEST_EVENT["starts_at"]})
    if existing:
        print("event already exists:", existing["id"])
        return
    doc = new_event_document(TEST_EVENT, created_by="script:add_lagos_venues")
    key = new_organiser_key()
    await db.venues.insert_one(dict(doc))
    await db.event_keys.insert_one({"event_id": doc["id"], "key": key,
                                    "created_at": datetime.now(timezone.utc)})
    print("event created:", doc["id"])
    print("organiser link: /organiser/" + doc["id"] + "?key=" + key)


if __name__ == "__main__":
    asyncio.run(main("--apply" in sys.argv))
