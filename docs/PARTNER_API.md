# VIIBE ticketing partner API

For ticketing platforms that want their events live on VIIBE: on the map, with
"When to leave" for ticket holders and a live gate and crowd screen for the
organiser.

Base URL: `https://vibeapp-production-1835.up.railway.app/api`

Every call sends your key in a header:

```
X-Viibe-Key: vpk_...
```

Ask VIIBE for a key. It is shown once; keep it on your server, never in a
browser or app.

## 1. Put an event on VIIBE

`PUT /partner/events/{your_event_id}`

Use your own event id. Sending the same id again updates the event, so it is
safe to retry or to call on every change.

```json
{
  "name": "Hippie Fest",
  "venue_type": "festival",
  "entry": "ticketed",
  "coordinates": { "lat": 6.4378, "lng": 3.4251 },
  "geofence_radius_m": 250,
  "starts_at": "2026-12-20T18:00:00+01:00",
  "ends_at": "2026-12-21T03:00:00+01:00",
  "address": "Muri Okunola Park",
  "area": "Victoria Island",
  "city": "lagos",
  "organiser_name": "Hippie",
  "ticket_url": "https://your-site/tickets/123"
}
```

| Field | Rules |
|---|---|
| `venue_type` | `concert`, `festival` or `rave` |
| `entry` | `ticketed` (VIIBE answers "when to leave") or `door` (VIIBE answers "is it worth going") |
| `coordinates` | The middle of the grounds |
| `geofence_radius_m` | 60 to 1500. Covers the grounds, not the street outside |
| `starts_at`, `ends_at` | ISO 8601 with a timezone. At most 4 days long |

On creation the reply includes `organiser_link`, the organiser's private live
screen. It is shown once. Give it to the organiser.

The event appears on VIIBE 7 days before it starts and stays until 2 hours after
it ends. Phones check people in automatically only from doors (2 hours before
the start) to the end.

## 2. Send gate scans (optional, recommended)

`POST /partner/events/{your_event_id}/scans`

Counts per time window, never names, emails or ticket numbers.

```json
{ "windows": [ { "start": "2026-12-20T19:00:00+01:00", "end": "2026-12-20T19:10:00+01:00", "count": 42 } ] }
```

- Windows are at most 60 minutes long, and between doors and 2 hours after the end.
- Sending a window with the same `start` again replaces it, so resending is safe.
- Up to 200 windows per call. Every 5 to 10 minutes works well.

Scans appear on the organiser's screen as "Tickets scanned". They are kept apart
from the crowd's readings: a ticket seller can never change the energy VIIBE
shows or the advice ticket holders get. That independence is what makes the
reading worth trusting.

## 3. Read the live picture

`GET /partner/events/{your_event_id}/live`

Returns the following:

- People inside now.
- Arrivals and departures in the last 30 minutes.
- An arrivals chart.
- The gate, as reported by people there.
- Energy, shown only when real people have rated it.
- Your gate scans.
- What VIIBE is telling ticket holders right now.

Use it to show a "Live on VIIBE" panel on your event page.

## Also

- `GET /partner/events`: your events.
- `DELETE /partner/events/{your_event_id}`: take an event down.

## What you cannot do

- Set a score, energy level or reading. Those fields are ignored.
- See or change another partner's events. Another partner's id returns 404.

Errors are plain English: `401` for a missing or wrong key, `404` for an
unknown event, and `422` with a list of problems for a bad event or bad scan
window.
