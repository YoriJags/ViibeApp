# Demo vs Live: what each mode shows today

Written 21 Nov 2026 from the code on master (up to 3fdb61a) and from read-only calls to the production API.

## How to read this

- **Demo shows** is what the founder's preview shows, and where it comes from. Most demo data lives in `frontend/src/data/demoData.ts`. Some components carry their own demo constants; those are named.
- **Live shows today** is what a real user sees now, and the real source (endpoint, collection or socket event). Paths are under `/api` on the backend unless shown otherwise.
- **Gap** is one of three:
  - **built, needs data/users**: the feature works. It only needs people using it.
  - **partly built**: something is missing. The missing piece is named.
  - **demo only, not built**: nothing real sits behind it.
- "Could not confirm" means the code did not settle it. The file to check is named.

## What production looks like right now

Checked on 21 Nov 2026 at 09:07 UTC. That is morning in Lagos, not a night, so treat it as a quiet-hours reading.

- `GET /api/venues?city=lagos` returns 20 venues. 19 carry `energy_source: "demo"` and 1 carries `"none"`. None carry `"scouts"`.
- `GET /api/city-energy/lagos` returns CHILL 26, `energy_source: "demo"`, 0 active scouts, 0 readings tonight.
- So the ambient demo engine (`backend/app/services/ambient_demo.py`, switched on by `DEMO_AMBIENT=1`) is running in production. Every live score a user sees today comes from it.
- The backend rule (`backend/app/services/synthetic.py`) is that demo readings are never evidence and every score says where it came from. Some screens honour that label. Several do not. Those are called out below.

## How the two modes split

- Demo is switched on in `src/store/slices/authSlice.ts` (`toggleDemoMode`). It loads `DEMO_USER`, `DEMO_VENUES`, `DEMO_STREAK`, `DEMO_CREW` and `DEMO_ACTIVE_CAMPAIGNS` into the store.
- In demo, most store calls return early with demo constants and never reach the API (`venueSlice.ts`, `scoutSlice.ts`).
- The demo user is admin, super admin and merchant, so every floor is open. `isVibePlus()` and `isFeatureEnabled()` both return true in demo.
- Demo puts the user at a fixed point in Victoria Island and treats them as inside every venue (`app/venue/[id].tsx` line 458).

---

## 1. Home (`app/(public)/index.tsx`)

### City header and LIVE chip
- **Demo shows:** Lagos, no LIVE chip. City reading 82, Lit, from `DEMO_CITY_PULSE`.
- **Live shows today:** City name. The LIVE chip shows only when `/city-energy/{city}` reports `energy_source: "scouts"`. Today it is hidden.
- **Gap:** built, needs data/users.

### Tonight hero (`TonightHero`, `CityWelcomeCard`)
- **Demo shows:** 10PM, city Lit 82, taste match "Escape Nightclub 94%" (`DEMO_TONIGHT`), vibe score 87, 40 clout tonight, "2 away from Night Owl", 3 venues visited, 120 clout, 1 new badge, "Quilox hit 87% while you were there". These numbers are written into `index.tsx` lines 781 to 795.
- **Live shows today:** A new user (no check-in, no persona) gets `CityWelcomeCard`. Everyone else gets `TonightHero` with the real clock, the city reading only if scouts made it (otherwise "quiet"), and real crew counts. Taste match, vibe score, clout tonight, badge distance and best moment are empty. Visited count and clout are 0.
- **Gap:** partly built. A taste match is already computed from `/users/{id}/dna` (`vibeMatchVenue`, line 428) but is never passed to the hero. There is no live source for clout tonight, badge distance, venues visited tonight or best moment.

### Activity ticker
- **Demo shows:** A scrolling ribbon of sample activity from `DEMO_ACTIVITY_FEED`.
- **Live shows today:** Nothing. The ticker renders in demo only.
- **Gap:** demo only, not built. No live activity feed is wired to it.

### Top three strip, venue list and map pins
- **Demo shows:** `DEMO_VENUES` (11 venues, Lagos and Abuja).
- **Live shows today:** `/venues?city=` from the venues collection. Venue cards add " · DEMO" when a score is demo-driven (`VenueCard.tsx` line 238). Map pins are faint when not real (`VibeMap.tsx`). The top three strip shows the score with no demo label.
- **Gap:** built, needs data/users. Note for live honesty: `TopThreeStrip` does not label demo-driven scores.

### City energy bar
- **Demo shows:** 82 Lit, 247 scouts, 1,143 readings, sparkline (`DEMO_CITY_PULSE`).
- **Live shows today:** `/city-energy/{city}`. Today: "CHILL · DEMO", 0 scouts.
- **Gap:** built, needs data/users.

### Heat map card (`HeatMapCard.tsx`)
- **Demo shows:** Five Lagos areas with top venues, from the card's own `DEMO_AREAS`.
- **Live shows today:** Nothing. The card reads `d.areas`. `/heat-map/{city}` returns `heat_points`. The list is never filled, so the card hides itself.
- **Gap:** partly built. The client and the API disagree on the field name. The API also does not filter demo readings (`backend/app/routes/heat_map.py` does not use `synthetic.py`).

### Venue battle (`VenueBattle.tsx`)
- **Demo shows:** DNA Nightclub vs Club Quilox, 14 minutes left, from the card's own `DEMO_BATTLE`.
- **Live shows today:** `/battles/active`. Today it returns `{"battle": null}`, so the card hides.
- **Gap:** partly built. Only an admin can start a battle (`POST /battles`, `require_admin` in `battles.py`). Nothing starts one on its own.

### Missed peaks (`MissedPeaksBanner.tsx`)
- **Demo shows:** Quilox 94 and Escape 81 "while you were away", from `DEMO_MISSED`.
- **Live shows today:** `/notifications/missed-peaks` for a signed-in user. Hidden when empty.
- **Gap:** built, needs data/users.

### Live push feed (`LivePushFeed.tsx`)
- **Demo shows:** Nothing. `fetchFollowingFeed` returns early in demo (`venueSlice.ts` line 400).
- **Live shows today:** `/venues/following/feed`: posts from venues the user follows. Hidden when empty.
- **Gap:** built, needs data/users. The demo does not preview this feature at all.

### Quick rate (`SwipeRate`) and the discover flow
- **Demo shows:** Swipe through `DEMO_VENUES`.
- **Live shows today:** Swipe through live venues. A score shows only if it came from scouts, or is a non-zero demo score marked "DEMO".
- **Gap:** built, needs data/users.

### Automatic pop-ups (streak, last call, After Hours, Scout of the Night)
- **Demo shows:** A queue of pop-ups after the demo tutorial. Streak at 4 seconds. Last call from 1am to 5am, After Hours from 6am to 10am, Scout of the Night from midnight to 3am, all by the phone's real clock.
- **Live shows today:** None of them. The queue is emptied whenever demo is off (line 136).
- **Gap:** partly built. Each pop-up works, but none is allowed to open for a real user. See also After Hours, Streak and Scout of the Night below.

---

## 2. Trending / Tonight (`app/(public)/trending.tsx`)

### Header
- **Demo shows:** "Trending", city, a LIVE dot.
- **Live shows today:** The same LIVE dot, always. It is not tied to any data (lines 304 to 307).
- **Gap:** partly built. The LIVE dot needs to follow `energy_source`, as the home header does. Today it says LIVE over demo-driven scores.

### Intel carousel and the venue market list (`VibeIntelCarousel`, `VibeMarket`)
- **Demo shows:** `DEMO_TRENDING`, built from `DEMO_VENUES`.
- **Live shows today:** `/trending/{city}`. Today it lists Sailors Lounge 49.7 and the rest, all demo-driven. The list drops `energy_source` when it maps venues (lines 251 to 265), so no DEMO label appears.
- **Gap:** built, needs data/users. Live honesty: the backend route (`leaderboard.py`) does not use `synthetic.py`, and the screen does not label demo scores.

### Sponsored
- **Demo shows:** Sponsored venues from `DEMO_TRENDING`.
- **Live shows today:** `trendingData.sponsored`. Hidden when no campaign runs. Today `/campaigns/active` is empty.
- **Gap:** built, needs data/users.

### Top Scouts Tonight
- **Demo shows:** VibeDemo first, AdaObi second (`DEMO_TOP_SCOUTS`).
- **Live shows today:** `/top-scouts/{city}`. Today it returns the ambient engine's accounts, such as `emeka_demo4` and `zara_demo3`, shown to real users as tonight's scouts.
- **Gap:** partly built. The route must drop `demo-scout-*` accounts, as `synthetic.py` requires.

---

## 3. Intel (`app/(public)/intel.tsx`)

### City zones
- **Demo shows:** Areas averaged from `DEMO_VENUES` for the chosen city.
- **Live shows today:** "Zone data loading…" forever. The screen expects an array. `/area-pulse/{city}` returns `{city, areas: [...]}`, so nothing is set (line 112).
- **Gap:** partly built. One-line client fix: read `d.areas`.

### Dark horse
- **Demo shows:** Three venues from `DEMO_DARK_HORSES`.
- **Live shows today:** Venues that are heating up and under 62, from the store. Empty state: "No dark horses right now".
- **Gap:** built, needs data/users.

### Scout leaderboard
- **Demo shows:** Tunde_V, VibeDemo, AdaObi, TundeWave, Kemi_Lux (inline in `intel.tsx`).
- **Live shows today:** "Loading scouts…" forever. It calls `/leaderboard/top-scouts/{city}`, which returns 404. The real route is `/top-scouts/{city}`.
- **Gap:** partly built. Wrong URL, plus the same demo-scout filtering as Trending.

### Scene mode
- **Demo shows / Live shows today:** The same Scout or Insider switch. No data.
- **Gap:** none.

---

## 4. Crew (`app/(public)/crew.tsx`)

### Crew, members and who is out
- **Demo shows:** "Lagos Night Owls", 4 members, 2 out (`DEMO_CREW`).
- **Live shows today:** `/crews/me` with check-in status per member from `checkins`. Without a crew: the create or join screen.
- **Gap:** built, needs data/users.

### Crew battle (`CrewBattle.tsx`)
- **Demo shows:** A running battle from the card's own `DEMO_BATTLE`.
- **Live shows today:** `/crew-battles/active`. A captain can challenge another crew.
- **Gap:** built, needs data/users.

### Rolling deep (`RollingDeepBanner.tsx`)
- **Demo shows:** A group move from `DEMO_SESSION`.
- **Live shows today:** `/crews/{id}/rolling-deep`. Hidden when no session.
- **Gap:** built, needs data/users.

### Tonight's plans (crew vote)
- **Demo shows:** No active vote (`DEMO_CREW.active_vote` is null).
- **Live shows today:** `/crews/{id}/vote` and `/vote/active`.
- **Gap:** built, needs data/users.

### Crew radar (`CrewRadarMap.tsx`)
- **Demo shows:** Members placed on the radar from `DEMO_CREW_LOCATIONS`.
- **Live shows today:** Nobody. The store calls `/crews/{id}/locations`. No such route exists in the backend.
- **Gap:** partly built. The locations endpoint is missing. Member venues already come back on `/crews/me`, so it could be built from that.

---

## 5. Profile (`app/(public)/profile.tsx`)

### Identity and stats
- **Demo shows:** VibeDemo, 4,250 clout, 187 ratings, 92% accuracy, elite (`DEMO_USER`).
- **Live shows today:** The user record from `/auth/me`.
- **Gap:** built, needs data/users.

### Scout heat card and streak days (`ScoutHeatCard.tsx`)
- **Demo shows:** Hot, 14 points, streak 4 days (`DEMO_HEAT`).
- **Live shows today:** `/me/heat`, which reads `streaks` for the day count. A streak celebration fires at 3, 7, 14 and 30.
- **Gap:** built, needs data/users.

### Tap history (`VibeTapCard.tsx`)
- **Demo shows:** 17 taps tonight across DNA Nightclub, Club Quilox and Escape Lagos (`DEMO_DATA` in the card).
- **Live shows today:** `/me/tap-history`.
- **Gap:** built, needs data/users.

### Badges
- **Demo shows:** `DEMO_BADGES`.
- **Live shows today:** Badges worked out on the phone from the user record (`computeBadges`).
- **Gap:** built, needs data/users.

### Night debrief
- **Demo shows:** "Electric VI Run", 3 spots, inline `DEMO_DEBRIEF`.
- **Live shows today:** Only with Viibe+ and the `night_debrief` flag, from `/users/{id}/night-debrief`, which calls Claude (`ai_features.py`). Without Viibe+, a locked card says "Your recap of the night" (line 631; the word AI was removed in f2bd748).
- **Gap:** partly built. Needs a paying Viibe+ user and the Anthropic key. The locked card still advertises an AI feature, which conflicts with today's removal of advertised AI features.

### Passport (`VibePassport.tsx`)
- **Demo shows:** `DEMO_PASSPORT`.
- **Live shows today:** Built from `/me/heat` and `/me/tap-history`.
- **Gap:** built, needs data/users.

### Fast Lane passes and scout perks
- **Demo shows:** "Scouts get Fast Lane passes for priority entry at venues." (line 769).
- **Live shows today:** The same sentence. It is not behind a demo check.
- **Gap:** demo only, not built. No Fast Lane code exists in the frontend or backend. In live mode this is a promise with nothing behind it.

---

## 6. Venue page (`app/venue/[id].tsx`)

### Hero score and freshness
- **Demo shows:** The demo venue's score, "Verified 4m ago" when there is no snapshot (line 680).
- **Live shows today:** `/venues/{id}`. Score source shown as scouts, demo or none (line 131). Freshness countdown, scout consensus and "scouts still here" appear only when real counts exist. Comparative framing from `/venues/{id}/comparative` (today `no_history`, hidden).
- **Gap:** built, needs data/users.

### Emoji pulse, momentum and the "heading there" bar
- **Demo shows:** Demo counts inside each component (`EmojiPulse` has `DEMO_COUNTS`).
- **Live shows today:** `/venues/{id}/emoji-pulse`, `/venues/{id}/momentum` (today flat, 0 check-ins), `/venues/{id}/heading-count` and `/follow-status`.
- **Gap:** built, needs data/users.

### Scout pressure chip (`ScoutPressureChip.tsx`)
- **Demo shows:** A heading count.
- **Live shows today:** Nothing. It calls `/venues/{id}/headings-count`, which returns 404. The real route is `/heading-count`.
- **Gap:** partly built. Wrong URL.

### Arrival intel (`ArrivalIntelCard.tsx`)
- **Demo shows:** Fixed arrival advice.
- **Live shows today:** `/venues/{id}/arrival-intel`. On 21 Nov it told Sailors Lounge users to "Arrive by 08:00 WAT", peak 09:00 WAT. `intelligence.py` does not use the demo filter, so this advice comes from ambient demo readings.
- **Gap:** partly built. The route must drop demo readings before it gives advice.

### Crowd composition, timeline and forecast
- **Demo shows:** Crowd mix from the component's demo data. Timeline from demo data. The forecast has no demo branch, so demo shows "Not enough history to forecast yet" (`VibeForecast.tsx`).
- **Live shows today:** `/venues/{id}/crowd-composition` ("No persona data from recent raters"), `/timeline/{id}` (empty, hidden), `/forecast/{id}` ("Not enough historical data").
- **Gap:** built, needs data/users. Demo contradiction: the forecast is empty in demo while everything around it is full.

### Stories
- **Demo shows:** `DEMO_STORIES` for that venue.
- **Live shows today:** `/stories/venue/{id}`.
- **Gap:** built, needs data/users.

### Reactor and insider panel (`VibeReactor`, `VenueInsiderPanel`)
- **Demo shows:** Always unlocked. Taps move a local charge bar (`DEMO_SURGE`, `DEMO_LEVELS`).
- **Live shows today:** Only inside the geofence, signed in, and regular status or above (or Viibe+). Charge from `/venues/{id}/surge` and socket `surge_update`. Insider data from `/me/venues/{id}/insider`.
- **Gap:** built, needs data/users.

### Top scouts tab (`TopScoutsCard.tsx`)
- **Demo shows:** `DEMO_VENUE_TOP_SCOUTS`.
- **Live shows today:** Nothing. `/venues/{id}/top-scouts` returns 404. No venue-level top scouts route exists.
- **Gap:** partly built. The endpoint is missing.

### Booking (`BookingModal.tsx`)
- **Demo shows:** A booking flow that does not charge.
- **Live shows today:** `/venues/{id}/bookings/initialize` then `/bookings/verify/{ref}` through Paystack (`bookings.py`).
- **Gap:** could not confirm whether a real payment completes end to end. Check `backend/app/routes/bookings.py` and the `PAYSTACK_SECRET_KEY` setting.

---

## 7. Rating
- **Demo shows:** The rate modal works from anywhere. A rating is stored only on the phone (`demoRatedVenues`) and pays 15 clout (`venueSlice.ts` line 162).
- **Live shows today:** `POST /ratings` to the `ratings` collection. Needs a real position and the geofence. Without location: "Turn on location to rate." Ratings made offline are queued and synced (`/ratings/sync`).
- **Gap:** built, needs data/users. Note: `app/rate/[id].tsx` is an older rating screen that nothing links to. It still uses the retired words Popping and Electric.

## 8. Check-in
- **Demo shows:** An instant check-in held on the phone for 4 hours (`scoutSlice.ts` line 124). A first-scout celebration every time.
- **Live shows today:** `POST /checkins` from inside the geofence, with battery level. Optional auto presence: the phone's own geofencing checks people in and out with the app closed, once they opt in (`services/autoPresence.ts`, Profile toggle).
- **Gap:** built, needs data/users.

## 9. After Hours (night recap, `AfterHours.tsx`)
- **Demo shows:** 2 check-ins, 3 ratings, 17 taps, DNA Nightclub and Club Quilox, 2 Viibes, streak 4, from `DEMO_RECAP`. It pops up on its own, but only between 6am and 10am by the real clock.
- **Live shows today:** `/me/night-recap` (night runs 17:00 to 17:00 UTC). It never pops up on its own. The only way in is the icon in the Profile header.
- **Gap:** partly built. The recap is real. The morning pop-up is blocked for live users.

## 10. Streak
- **Demo shows:** A 7-night streak with 150 bonus clout in a full-screen modal on home (`StreakFireModal`, `DEMO_STREAK`).
- **Live shows today:** The backend counts streaks on ratings, check-ins and stories (`services/streaks.py`). Profile shows the day count and celebrates milestones. The home streak modal never opens. `fetchStreak` (`/streaks/me`) is never called anywhere.
- **Gap:** partly built. The home modal is demo only. The "streak about to expire" push exists but is never sent (see Notifications).

## 11. Viibe moments (`VibeReactor`, `MomentOverlay`, `useMomentTrigger`)
- **Demo shows:** The personal moment overlay fires from the phone's own sensors, since demo treats you as inside. Could not confirm any simulated Moment Lock in demo. The lock only comes from the socket event `moment_locked` (`VibeReactor.tsx` lines 755 to 770).
- **Live shows today:** `POST /venues/{id}/moment`. Five or more scouts in the same venue within 8 seconds make a Moment Lock, sent to the room by socket and by push (`moments.py`). Tonight's Viibes appear in After Hours and on the Big Screen (`/venues/{id}/viibes`).
- **Gap:** built, needs data/users. It needs five people in one room at once.

## 12. Events
- **Demo shows:** Two event venues in the list, "Detty December Block Party" and "Burna Boy Live Concert" (`DEMO_VENUES`). The merchant floor shows three past and upcoming events (`DEMO_EVENTS`).
- **Live shows today:** Events appear only as venues of type concert or block party in the list. The app never calls `/events`. Today `/events?city=lagos` returns an empty list. "When to leave" (`/events/{id}/timing`) shows on the venue page only for ticketed events. The live data holds three "festival" venues, and the category filter has no Festival chip (`VenueCategoryFilter.tsx`).
- **Gap:** partly built. Backend events, organiser screen and timing exist. The app has no events list, and festivals cannot be filtered.

## 13. Merchant floor (`app/(merchant)/`)
- **Demo shows:** Quilox's dashboard: stats, sentiment, pulse status, active campaign, scout activity, events, blast attribution and bookings (`DEMO_VENUE_STATS`, `DEMO_SENTIMENT`, `DEMO_PULSE_STATUS`, `DEMO_ACTIVE_CAMPAIGN`, `DEMO_SCOUT_ACTIVITY`, `DEMO_EVENTS`, `DEMO_BLAST_ATTRIBUTION`, `DEMO_BOOKINGS`). Wallet, pulse and settings tabs have no demo branch.
- **Live shows today:** Only for a user with `merchant_venue_id`, which an admin sets by approving a claim (`claims.py`). Data from `/merchant/venue/{id}/stats`, `/sentiment`, `/pulse-status`, `/campaigns`, `/spotlight-status` and the other merchant routes. `merchant.py` drops demo readings. With no claimed venue, the dashboard loads empty.
- **Gap:** built, needs data/users.

## 14. Notifications
- **Demo shows:** No push notifications. Demo only has the in-app pop-ups above.
- **Live shows today:** The phone registers its Expo token after sign-in (`app/_layout.tsx` line 70, `/alerts/register`). Pushes that do fire: venue score alerts a user sets (`alerts.py`), campaign start (`campaigns.py`), surge (`surge.py`), a venue's live post to followers (`venue_live.py`), venue state changes to people outside (`services/transitions.py`), Moment Lock (`moments.py`) and the merchant vibe alert (`services/vibe.py`).
- **Gap:** partly built. Five push helpers in `services/notifications.py` are never called: crew member checked in, lobby venue getting hot, streak about to expire, achievement unlocked, and vibe spike.

## 15. Big Screen (`backend/static/screen.html`, served at `/screen/{venue_id}`)
- **Demo shows:** The merchant floor button opens `/screen/demo_venue_quilox`. That venue does not exist on the server (`/api/venues/demo_venue_quilox` returns 404), so the wall shows its "lost signal" panel.
- **Live shows today:** Venue name, charge level from `/venues/{id}/surge`, people present and watching from `/venues/{id}/orbit`, rank against every venue in the city, and Viibes. The rank uses raw `current_vibe_score`, including demo-driven scores, with no label. The leader line is written as "#1 IN LAGOS RIGHT NOW" even for an Abuja venue.
- **Gap:** partly built. It needs to rank on real readings only and name the venue's own city. Demo cannot preview it.

---

## Contradictions inside the demo

These are the only demo items to fix. Feature previews stay.

1. **Streak:** 7 nights on the home modal and in `DEMO_STREAK`. 4 days on the Profile heat card (`DEMO_HEAT`) and in the After Hours recap (`DEMO_RECAP`).
2. **Venues that are not in the demo:** DNA Nightclub, Club Quilox, Escape Lagos, DropShot Bar, Jazzhole and Terra Kulture appear in `HeatMapCard`, `VenueBattle`, `AfterHours` and `VibeTapCard`. The demo venue list calls them Quilox Nightclub and Escape Nightclub, and has no DNA.
3. **Escape's area:** Lekki on the heat map and tap card. Victoria Island in `DEMO_VENUES`.
4. **Quilox's score:** 87 Peak in the venue list. 65 Charged in the venue battle. 96 as the city's trending venue (`DEMO_CITY_PULSE`). "Hit 94% while you were away" in missed peaks, while the crew and hero say you are at Quilox.
5. **Energy words that do not match the score** (`energyStateFor` in `src/theme/energy.ts`): House 70 at 83 says Peak (should be Lit). Play Abuja at 81 says Peak (Lit). Shiro at 65 says Chill (Lit, and the lobby already says Lit). Cova at 58 says Chill (Warming, and the lobby already says Warming). **Fixed in f41e0d2.**
6. **Who tops the city:** VibeDemo is first on Trending. Tunde_V is first on Intel. Scout of the Night shows a different cast again (nightkingxx, vibequeen_). The venue top scouts tab uses a fourth set of names.
7. **Tonight's count:** the hero says 3 venues, the debrief says 3 spots, the recap and heat card say 2 check-ins, and the tap card lists 3 venues.
8. **Phases of the night:** the demo never reaches the hero's "recap" phase (`getNightPhase` in `src/store/types.ts` returns planning in demo). Last call, After Hours and Scout of the Night only open in their real-clock windows, so one demo session cannot show the whole night.
9. **Empty in demo:** the forecast, the live push feed and the Big Screen show nothing in demo while the cards around them are full.

---

## Summary

**Counts** (48 features rated; Intel's Scene mode has no gap and is left out):

- built, needs data/users: **27**
- partly built: **18**
- demo only, not built: **2** (home activity ticker, Fast Lane passes)
- could not confirm: **1** (whether a booking payment completes end to end)

**Top 5 gaps for launch**

1. **Live mode presents demo scores as live.** Production runs the ambient demo engine. 19 of 20 Lagos venues are demo-driven and there are 0 real readings. The Trending LIVE dot is always on. The Trending list, the top three strip and the Big Screen show demo scores with no label. Top Scouts lists `demo-scout-*` accounts. Arrival intel gives advice built on demo readings. Decide: switch `DEMO_AMBIENT` off at launch, or label and filter every one of these.
2. **Live screens that look broken because of wiring faults.** Intel zones and the Intel leaderboard hang on "loading". The heat map card never shows. The crew radar is always empty. The scout pressure chip and the venue top scouts tab call routes that do not exist. Each one is a field-name or URL fix, or one small endpoint.
3. **The night's big moments never reach real users.** After Hours, Scout of the Night, Last Call and the streak modal open only in demo. Scout of the Night also calls `/leaderboard/tonight`, which returns 404.
4. **Pushes that bring people back are not sent.** Crew checked in, streak about to expire, lobby getting hot, achievement and vibe spike exist as functions and are never called.
5. **The Tonight hero is empty for a returning user.** Taste match, vibe score, clout tonight, badge distance and best moment are demo only. The taste match is already computed from the DNA route and only needs to be passed in.
