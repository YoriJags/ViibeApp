# VIIBE Intelligence API

Live and historical crowd energy for a city, as data you can build on.

VIIBE reads how alive a place is from people who are physically there. This
API gives you that reading for single venues, for hexagonal areas of the city,
and over time.

Base URL: `https://vibeapp-production-1835.up.railway.app/api`

## What you can trust

Every reading carries a `confidence` from 0 to 1. It says how far to believe
the reading right now, and it falls as a reading ages.

- At 0.5 or above the reading is confirmed (`solid: true` on a cell).
- Below 0.5 at least one trust check failed. `confidence_gates` names it:
  `single_scout`, `stale`, `presence_lost`, `taps_without_presence`.
- Sample or demo data is never returned as a reading. Where nobody has read a
  place, the API says there is no reading. It does not report "quiet".

History and reports are built from confirmed readings only. A gap in a series
means nobody was reading there at that time.

## Your key

Send your key in the `X-API-Key` header on every request. Keep it secret; we
store only a hash of it and cannot show it to you again.

| Tier | Requests a minute | Requests a day |
|---|---|---|
| starter | 60 | 5,000 |
| growth | 300 | 50,000 |
| enterprise | 1,200 | 500,000 |

Over a limit you get status 429. For the per-minute limit, the `Retry-After`
header says how many seconds to wait.

`GET /v1/usage` returns your tier, your limits and your requests per day.

## Live

| Endpoint | Returns |
|---|---|
| `GET /v1/venues?city=lagos` | Venues with a live reading, hottest first |
| `GET /v1/venues/{id}/score` | One venue's reading with its full audit record |
| `GET /v1/city/{city}/energy` | The city's energy and its top venues |
| `GET /grid/vpixels?city=lagos&zoom=12` | The city as hexagonal cells |
| `GET /grid/vpixels?bbox=west,south,east,north&zoom=14` | Cells inside a box |

`zoom` picks the cell size: below 11 gives cells about 1.4 km across a side,
11 to 12 about 530 m, 13 and above about 200 m. Cell ids are H3 indexes, so a
cell id always means the same patch of ground.

A cell:

```json
{
  "cell": "88589c8b59fffff",
  "center": {"lat": 6.4312, "lng": 3.4391},
  "boundary": [[3.4421, 6.4338], "..."],
  "venues": 3,
  "venues_read": 2,
  "score": 74.0,
  "energy": 0.74,
  "confidence": 0.82,
  "solid": true,
  "source": "scouts",
  "decay_state": "fresh",
  "active_scouts": 10
}
```

`source` is `scouts` for a real reading, `demo` for sample data (no
confidence, never in history) and `none` where there is no reading.

## History

| Endpoint | Returns |
|---|---|
| `GET /v1/venues/{id}/history?hours=24` | One venue's score over time |
| `GET /grid/history?cell={cell}&hours=24` | One cell over time, in ten-minute steps, up to seven days |
| `GET /grid/night?city=lagos&date=2026-11-13&zoom=12` | How a night built: the city's timeline and, for each cell, when it built, when it peaked and how long it held |
| `GET /grid/forecast?cell={cell}` | The cell's usual night on tonight's weekday, hour by hour in Lagos time, and its usual peak hour |
| `GET /grid/flows?city=lagos&zoom=12&date=` | Which areas feed which: people moving between cells on the same night, last four weeks by default |
| `GET /v1/reports/weekly?city=lagos` | The week: hottest areas, areas that rose against last week, the busiest night, the city's peak hour |

A night runs from 07:00 Lagos time to 07:00 the next day and is named for the
day it started.

The forecast reports an hour only when at least three past nights on the same
weekday back it. Until then it returns `"enough": false` and says how many
nights it has. The weekly report calls an area a riser only when it has at
least two nights of confirmed readings in both weeks.

Crowd moves come from phones that check in automatically. A move is two
verified arrivals at different places on the same night, at most three hours
apart. A route is reported only when at least five different people made it;
smaller routes are left out, never estimated. No individual is ever returned.

## Errors

| Status | Meaning |
|---|---|
| 401 or 422 | The `X-API-Key` header is missing |
| 403 | The key is unknown or revoked |
| 404 | No such venue |
| 422 | A parameter is malformed; the message says which |
| 429 | A rate limit was reached |
