# VIIBE — Energy Layer Build Plan

**Mission:** Ship the GIS for live human energy. Wherever people gather, there is energy; VIIBE measures it. Decay-honest, scout-confirmed, B2B-credible.
**Category:** Not a nightlife app — a live-energy intel layer. Nightlife is the beachhead scene, not the identity.
**Doctrine:** Poco a poco. A-tier now, S-tier at scale gates. **Compress, don't expand.**
**Funding model:** Reachng generates runway. VIIBE runs lean until 10/10 milestone hits.
**Last updated:** 2026-11-21

---

## NOW (21 Nov 2026): screen fixes, then places and events

**No APK until the founder says planning and building are settled.** Verify with
tsc, the backend tests and screenshots from the connected phone.

### D. Screen fixes (done, committed, not pushed)
- [x] D1 Tab bar, venue footer, AfterHours button above the phone's navigation bar
- [x] D2 Live or Demo choice at launch; greeting pop-ups only in the demo, one at a time
- [x] D3 Demo tells one story (city 82 Lit everywhere, crew, Intel, leaderboard, energy words, empty home list)
- [x] D4 Removed AI features no longer sold (Oracle, Night Planner)
- [x] D5 Readable text colours across 60 files; floating floor switcher off home
- [x] D6 Church and worship removed (app, demo, backend); a stored "church" loads as "other"
- [x] D7 Morning night recap was empty after 8am; fixed
- [x] D8 Design agent: docs/DEMO_VS_LIVE.md, 3 font options (founder picks), in-place polish
- [x] D9 Font: Space Grotesk (titles, numbers) + Inter (text), app and landing
- [x] D10 DEMO_AMBIENT=0 on production (21 Nov); old sample scores still stored, wipe pending founder OK
- [x] D11 Landing: organisers at any ground, block parties, VIIBE Certified, nobody borrows a name

### E. Places and events at borrowed grounds
The problem: raves, block parties and concerts happen at places that are not
their own (Dave at the National Theatre, a rave on a beach). They need to be
registered and located correctly without a permanent venue.

The model: a **place** is a permanent location (National Theatre, Tafawa Balewa
Square, a beach). It is not on the map by itself. An **event** is dated and sits
at a place, or at a dropped pin. The next event at the same place reuses the
place's checked location.

Decisions (founder, 21 Nov): any signed-in user can submit an event or a place;
every submission waits for admin approval. No Google for now: search uses VIIBE's
own places plus OpenStreetMap (free, no billing); Google slots in later.

**E0. Fraud rules (founder, 21 Nov: "someone can claim to be Dave")**
Every submission is a claim until proven. The risks and the rule for each:
- [x] Impersonation. A submitter is never shown as the organiser or the artist.
      Submitted events are "Community listing": the organiser name and ticket link are
      hidden until an admin verifies the organiser. Only verified events read "Official"
- [x] Organiser verification is an admin act with a recorded method: an official social
      post carrying a VIIBE code, a ticketing partner, a known promoter, or in person
- [x] Scam tickets. A ticket link is shown only on an Official event
- [x] Tracking people. Nothing is on the map and no phone watches the ground until
      approved. Every pin move is logged (who, from where, to where, why)
- [x] Pin moves. A community organiser's on-site fix may move the centre at most 300 m from
      the approved spot, a verified organiser 1 km; anything further waits for an admin.
      Moving to where the crowd is gathering needs an admin or a verified organiser
- [x] Spam. At most 3 pending submissions per person and 5 a day
- [x] Duplicates. A second event at the same ground with overlapping times is refused and
      pointed at the existing one; the admin queue shows near duplicates
- [x] Reports. Anyone signed in can report an event; 3 different reports take a community
      listing off the map until an admin looks. An Official event is flagged, not hidden
- [x] The submitter's id never appears in any public response

**E0b. VIIBE Certified (founder, 21 Nov)**
Organisers and vendors (venue owners) prove who they are before we certify them.
"VIIBE Certified" means we checked the proofs. The existing automatic "Vibe Certified"
energy badge (score held high for 90 days) keeps its name; they are separate things.
- [x] Proof is a ticketing page or website link (no ID photos). A link only proves the event
      or business exists, so the admin confirms through the contact that page lists
      (email, phone, official account) before certifying. Method recorded
- [x] `POST /certification/apply`: organiser or vendor, the name to certify, 1 to 5 https
      links, a business contact, a note; a vendor names the venue they own
- [x] `GET /certification/me`; admin queue, certify (method, note) or reject (reason)
- [x] Certification lasts 12 months, then lapses until renewed
- [x] A certified organiser's events show as Official with the certified name and ticket
      link (still placed and approved like any event); pin moves up to 1 km on site
- [x] A certified vendor's venue carries the VIIBE Certified badge
- [x] Freeform organiser names are never shown; only a certified name is

**E1. Backend: places**
- [x] `places` collection: name, area, city, coordinates, ground radius, place type
      (theatre, arena, stadium, park, beach, field, street, hall, other), status
      (pending, approved), how the location was set (pin, OpenStreetMap, organiser GPS,
      crowd), who submitted it
- [x] `GET /places/search?q=`: approved VIIBE places first, then OpenStreetMap results
      bounded to the city (generic client name, results cached, light use only)
- [x] `POST /places` (signed in): submit a new place, pending
- [x] Default ground radius by place type (theatre 120 m, stadium 300 m, beach 400 m ...),
      inside the existing 60 to 1500 m bounds

**E2. Backend: event submission and approval**
- [x] `block_party` joins concert, festival, rave as an event type
- [x] `POST /events/submit` (signed in): at a place (place_id) or a pin; pending, never
      on the map or watched by phones until approved (same rule partner events already follow)
- [x] The submitter gets the organiser link once approved; `GET /me/submissions` shows status
- [x] Admin: list pending events and places; approve, reject with a reason, or correct the
      pin and radius before approving
- [x] An event at an approved place copies its coordinates and radius; an approved event
      at a pin can create the place for next time

**E3. Backend: confirming the location**
- [x] Organiser on-site: `POST /organiser/events/{id}/here?key=` with the phone's position
      and accuracy; accepted only when accuracy is 50 m or better; sets the centre and marks
      it "set on site". If the place had no on-site fix yet, the place takes it too
- [x] Crowd confirmation: the event is "location confirmed" once 5 different verified
      arrivals land inside its ground during the event
- [x] Drift check: refused arrivals and check-ins near a live event log a rounded position
      (events only, about 10 m precision). If 5 or more different people gather outside
      the ground, the admin and organiser see "people are gathering N m away, move the pin?"
      One tap moves it; it never moves by itself
- [x] Tests for every rule above

**E4. App**
- [x] Raves and Festivals filter chips on home (Events renamed Block parties; demo rave + festival added)
- [x] "Add an event" screen (from Profile): what, where (VIIBE + OpenStreetMap search, or
      "use where I am standing"), when (Lagos-time chips), details. No map pin-drop yet:
      no map library in the app; admin fixes the pin at review. Entry from Tonight still open
- [x] "Add a place" (linked from the Where step)
- [x] "My submissions": pending, live, or rejected with the reason; organiser link when live
- [x] VIIBE Certified application screen (app/submit/certify.tsx)
- [x] Organiser page (backend/static/organiser.html): "I'm here, use my location" button
- [x] Admin review screen (app/(admin)/review.tsx): events, places, certification; approve,
      reject, move the pin, resize. No in-app map: spots open in Google Maps
- [x] Make it yours: cover, description, lineup, genres, dress code, price, age, host name
      (shown not verified); ticket link and verified mark stay certified-only
- [x] VIIBE Certified emblem (option B) in app, landing and docs/brand
- [x] Demo mode shows the full flow (sample places incl. National Theatre; Kemi Ade Live listed)

**E5. Before any build**
- [ ] Backend tests green, tsc 0, phone screenshots of every new screen
- [ ] Founder confirms, then one APK

### F. MVP (founder, 22 Nov: "launch an MVP"; closed beta of scouts in Lekki/VI)
- [x] F0 Home restyle pass 1 (Editorial Night structure) and pass 2 (venue cards,
      Battle, City heat). Peak gold; stock photos until real ones
- [x] F1 Live faults: Intel zones/leaderboard, Scout of the Night, scout pressure chip on
      real routes; area pulse, heat map, top scouts count real scout readings only
- [x] F1b Pushes: the app's token was never where senders looked (only surge worked);
      one lookup now, five pushes wired once-a-night
- [ ] F2 Live end-to-end on the real server: submit an event and a place, approve,
      certify, "I'm here", a crew check-in push. Needs the new APK (the phone has none
      of these screens)
- [ ] F3 One APK to a closed beta (founder says when)
- [ ] F4 Phone number verification (SMS provider) before opening to everyone

---

## The 10/10 Milestone (north star)

Pre-investment target. The single falsifiable goal everything else serves:

> **4 consecutive weekends, 30+ scouts generating live data across 10+ Lekki/VI venues, 1000+ users checking the map, 5 venues asking for merchant access, 2 paid or committed to pay.**

Until this is hit, Phases 9 + 10 stay frozen. Anything that doesn't move the corridor toward this number waits.

**Public pitch:** *"VIIBE shows you where Lagos is alive right now."*
**Investor pitch:** *"A decentralized sensor network for live human energy — scouts stake reputation on signals, venues pay for the truth, agents buy the feed. Nightlife is market one."*

---

## Positioning — the three languages (never mix them)

VIIBE is a **live-energy intel market**: wherever people gather there is energy,
and VIIBE measures it. But vision is not product. Every horizontal platform won
a vertical first (Facebook = colleges, Amazon = books, Uber = one city's black
cars). Nightlife is the beachhead because its energy signal decays fastest
(minutes, not hours), a paying buyer exists tonight (venues with zero promo
attribution), and it's where the scout habit forms. The architecture is already
scene-agnostic — `taxonomy_id` on ratings, venue-specific rating dimensions for
concerts/festivals/block parties, a decay engine that doesn't know what a
nightclub is. Expansion is config, not a rebuild.

| Audience | Language | Never say |
|----------|----------|-----------|
| **Consumer** (app store, friends) | "See where Lagos is alive right now." | "intel market", "energy layer" — nobody downloads an abstraction |
| **Investor / acquirer** | Decentralized intel market for live human energy: staked predictions (Prediction Market), credibility-weighted signals, tokenized contributions (`signal_token`), accuracy-scored scouts, honest-scarcity gates (surge policy), agent API selling the aggregate. Nightlife proves the signal moves money. | "nightlife app" — that's a feature-graveyard category |
| **Roadmap** | Expand by **event shape**, not ambition: concerts + Detty December events first (same scouts, same promoter-buyers), then owambe / match-viewing / conferences after the corridor proves out. | city lists, TAM slides |

The market mechanics already exist in code. The positioning job is to *name*
them, not build them.

**The 10/10 milestone does not move because the vision grew.** A bigger thesis
makes the narrow proof more important, not less.

### Venue gravity surfaces (demand-side proof, merchant-side desire)

Two mechanics that make venues *want* the intel market on their walls:

- **Big Screen (projection mode)** — `/screen/{venue_id}`: a venue projects its
  live reactor on the wall; the crowd sees their taps push the room up the
  city's energy strata toward ELECTRIC. The loop runs in everyone's favor:
  screen → crowd taps → verified signal → screen gets hotter. Distribution
  disguised as decoration.
- **Watchers in orbit** — people who want to be there but can't, actively
  monitoring the venue's energy from outside the geofence. Surfaced to the
  merchant ("43 watching you right now") as live demand pressure — the number
  that converts a pilot into a paying account.

---

## Rollout — The Friday Corridor (the path to an acquirer)

**Goal: an investor buys this. Investors buy evidence, not apps.** The four
weekends below ARE the pitch — every checkbox produces a number that goes on
the investor page. Code freeze outside these items.

### R0 — Compress (before first Friday)
- [ ] Launch surface = five things ONLY: map, vibe check, reactor, Big Screen, merchant lift report
- [ ] Everything else dark-flagged (not deleted — dark): crews, battles, cosmic, zodiac, coins, bookings, quests, DNA
- [ ] Launch window declared publicly: **Fridays 9pm–3am, Lekki/VI only**

### R1 — Bodies (week 1)
- [ ] Recruit 30 founding scouts (pay ₦5k/night — sensors are cheap, data is not)
- [ ] Founding-scout WhatsApp group live; founder is concierge
- [ ] 1 promoter partner signed (distribution + venue doors; candidate co-founder)

### R2 — Walls (weeks 1–2)
- [ ] Big Screen glowing in 1 anchor venue on a Friday
- [ ] 5 venue managers shown their own live screen + watcher count, in person
- [ ] 2 pilot merchants active (free), receiving Monday Lift Reports

### R3 — Evidence (weeks 2–4)
- [ ] **Repeat scout rate** tracked weekly — THE metric; on the founder's wall
- [ ] 4 consecutive Fridays of live corridor data banked
- [ ] 1 merchant converts pilot → paid (any amount; the receipt is the proof)
- [ ] Investor page updated weekly with real corridor numbers

### R4 — The ask (after weekend 4)
- [ ] Investor one-pager sent with live links: landing, instrument, Big Screen, lift report sample
- [ ] The pitch: *"Four weekends. X scouts returned weekly. Y venues asked to pay. This is the live-energy layer at N=1 corridor — priced before we scale it."*

---

## Wealth Organs (the spine) — what actually makes money

The product doctrine that makes VIIBE the *best* version of itself, not just a
prettier map. The map is a liability at low density (empty looks dead). These
organs make VIIBE **valuable at N=1, more valuable at N, never look dead, and
earn money before it earns scale.** Wealth exits through revenue×multiple or
strategic/data acquisition — both route through one chokepoint: *proof the live
signal is real and moves money.* Build for that proof, in this order.

| # | Organ | Why it makes money | Status |
|---|-------|--------------------|--------|
| 1 | **Attribution loop** (`attribution.py`, `/merchant/venues/{id}/attribution`) | "Did VIIBE bring me people?" — intent→verified arrivals→lift→naira. Converts free pilots to paying merchants AND is the dataset acquirers want. | ✅ Shipped |
| 2 | **Weekly Lift Report** (`lift_report.py`, `?format=html` card) | One screenshot-able artifact = sales pitch + retention hook + virality engine. | ✅ Shipped |
| 3 | **Agent API distribution** (`agent_dist.py`, `/agent-distribution/`) | Be the data source agents query before competitors exist. The acquirer story, made concrete. | ✅ Shipped |
| 4 | **Freeze wealth-neutral polish** | Kinetic/torch/oscillator are density generators, not wealth organs. Past "fun enough," more polish is procrastination. | ⛔ Doctrine below |

### Product doctrine (carry into every session)

1. **Valuable at N=1.** Lead with the *answer* ("go to Rhapsody's, it's the live one"), not the map. The map is the proof layer, never the front door.
2. **Money before scale.** The merchant terminal delivers value with a handful of scouts — "did my ₦500k DJ lift the room?" needs sensors, not a crowd. Revenue must not wait on liquidity.
3. **Honest-scarcity is the brand.** "We'd rather show you nothing than lie to you." Every wealth organ refuses to fabricate (no lift without a baseline; low confidence on thin samples). This is the trust wedge buyers remember — make it the public tagline, not a buried doctrine.

### Freeze doctrine (extends the P9–P11 freeze)

> **No new consumer-delight feature ships until wealth organs #1–#3 are live in
> production AND at least one merchant is paying off the back of a Lift Report.**
> The kinetic/torch/oscillator surfaces are good enough. The next line of code
> serves attribution, the corridor (P8), or a paying contract — or it waits.

---

## Phase 1 — Decay Engine (foundation)

The keystone. Pure math, fully unit-testable, no UI risk. Every other phase depends on this being right.

- [x] Create `backend/app/services/energy_decay.py`
- [x] Define 4-layer signal model (L1 active / L2 presence / L3 ambient / L4 inference)
- [x] Implement exponential decay per layer (τ = 45s / 180s / 480s / 3600s)
- [x] V-Pixel state container: per-cell timestamps, weights, confidence
- [x] Pure-function `compute(state, now)` — no I/O
- [ ] Continuous server tick (5s cron) that decays all active cells *(deferred to P2 — decay is on-read, no tick needed for correctness)*
- [x] Unit tests: stale peak collapses in <60s, no-op cells stay zero, layered blending math
- [x] Bench: 10k active cells under 100ms (achieved: ~0.15s test suite total)

## Phase 2 — Layer Ingestion (real signals in)

Wire each layer into existing app events. No new client work — uses signals already being sent.

- [x] L1: hook `vibe_pulse` socket event → Decay Engine (`decay_ingest.ingest_pulse`)
- [ ] **P10.0 schema readiness**: pulse event accepts optional `creator_id` + `set_window` (no logic, just plumbing)
- [x] L2: hook dwell heartbeats (`dwell_ping`) → presence ceiling (`ingest_dwell`)
- [x] L3a: surface mic dB samples (`ambient_ping`/`audio_ping`) → ingest endpoint (`ingest_ambient`)
- [ ] L3b: BLE density (deferred unless explicitly approved — adds permissions plumbing)
- [ ] Geofence-exit detection → explicit decay event *(adapter `ingest_exit` built + tested; no frontend exit event emits it yet)*
- [x] Per-scout contribution attribution (so departures can subtract correctly — `apply_departure`, tested)
- [x] Integration tests: full ingest → decay → query roundtrip (`test_decay_ingest.py`, 12 tests)

## Phase 3 — Cross-validation Gates (kills stale peaks)

The trust rules. Without these the GIS lies.

- [x] Rule: `L1 high && L2 collapsing` → trust L2, discount L1 (kills home-tap fraud)
- [x] Rule: `<2 distinct scouts in 60s` → confidence < 0.5, render translucent
- [x] Rule: zero presence heartbeats in 90s → L2 collapses regardless of L1
- [x] Confidence score `[0..1]` exposed per cell
- [x] "Honest map" rule encoded: cell only renders saturated if all 3 gates pass
- [x] Replay test: 100 simulated venues including adversarial cases

*Shipped 14 Nov 2026: `services/reading_confidence.py` turns the stored evidence plus the clock into a 0 to 1 score on every venue payload and both partner feeds; the map draws a reading faded below 0.5. The cell is the venue until the hex grid (Phase 4).*

## Phase 4 — V-Pixel API (what the GIS reads)

The query surface. Cached, indexed, fast.

- [x] `GET /api/grid/vpixels?bbox=&zoom=` — returns hex cells with `{energy, confidence, layer_breakdown, decay_state}`
- [x] H3 hex indexing (Uber's H3 lib) for cell IDs — clean zoom hierarchy
- [x] 5s response cache keyed on bbox+zoom *(in memory; Redis when there is more than one replica)*
- [ ] Compound index `(geo_hash, timestamp)` on `vibe_pulses` *(not needed yet: the grid folds venues, read by a `coordinates` index; this returns when raw pulses carry a cell id for history)*
- [x] Tag scale-gate: `# TODO(scale-gate-A): swap to TimescaleDB + PostGIS at Series A`
- [ ] Load test: 1k req/s sustained, p95 <80ms

*Shipped 14 Nov 2026: `services/grid.py` + `routes/grid.py`. Cells are confidence-weighted, never blend real with demo, and report "none" rather than quiet when unread. 1,000 venues fold in under half a second in tests; the 1k req/s load test is still to run.*

## Phase 5 — Frontend GIS Map (the visible layer)

The thing investors see. Mapbox-based, confidence-aware rendering.

- [ ] `npx expo install @rnmapbox/maps`
- [ ] New screen `app/grid.tsx`
- [x] Hex tile renderer fed by `/api/grid/vpixels`
- [x] Confidence-aware opacity (translucent when uncertain, saturated when trusted)
- [ ] Tap-cell drill-down → venue list inside that hex
- [ ] Live updates via socket (cell delta events, not full reload)
- [ ] "Breath" animation — cells gently pulse at their layer-blended BPM
- [ ] Demo-video-ready: looks honest *and* alive

*Shipped 14 Nov 2026 on the existing map (`VibeMap.tsx`, Mapbox GL in a WebView), not a new `@rnmapbox` screen: hex cells sit under the pins, switch resolution with zoom, and refresh every minute without reloading the page (`useCityGrid`). Tapping a cell shows the area reading and its trust; the venue-list drill-down, socket deltas and the breath animation are still to do. Demo mode folds the sample venues into cells on the device.*

## Phase 6 — Highest Energy Route (deferred, post-data)

Don't build until P5 has been live with real Lagos data ≥30 days. Routing on stale data is worse than no routing.

- [ ] Cost function: `f(walking_time, energy_along_path, decay_forecast)`
- [ ] Mapbox Directions API integration with custom waypoint ranking
- [ ] "Take the festival route" UX
- [ ] A/B test against fastest route for 2 weeks before defaulting on

## Phase 7 — B2B API surface (the moat monetises)

The dark intelligence layer. Don't build until P5 is live ≥30 days.

- [x] Cell history behind an API key *(shipped 14 Nov 2026 as `GET /api/grid/history?cell=`, with `GET /api/grid/night` for how a night built and `GET /api/grid/forecast` for a cell's usual night; `services/grid_history.py` records the grid every ten minutes, real readings only, and a forecast stays silent until three past nights back an hour)*
- [x] API keys, rate limits, usage metering *(shipped 14 Nov 2026: `services/api_access.py`; hashed keys, three tiers of per-minute and per-day limits, requests counted per key per day; admin routes and `scripts/issue_api_key.py`; invoicing from the counts is still manual)*
- [ ] First customer prospect: Lagos State tourism, EkoAtlantic developers, Heineken scene marketing
- [x] Sample reports for sales: "Where the scene heated up this week" *(`GET /api/v1/reports/weekly`; empty until real readings exist; buyer docs in `docs/INTELLIGENCE_API.md`)*
- [ ] Pricing model: $5k / $25k / $50k tiers

## Phase 8 — The Lekki Corridor (parallel track, non-code, business-critical)

The 10/10 milestone is a sales + recruiting problem, not a code problem. Runs in parallel with P1–P5. **This is the phase that actually fundraises.**

### 8.1 — Venue acquisition (the 10/10 supply side)
- [ ] Pick the corridor: VI/Lekki only, ~3km radius
- [ ] Hit-list of 25 target venues (clubs, lounges, rooftops, popular bars)
- [ ] Sales pitch: "Free for 60 days. Live crowd intelligence + profile views + direction taps + Pulse Drops. Pay after if it brings traffic."
- [ ] Sign 5 anchor venues with LOIs before public launch
- [ ] Hit 10+ active venue partners by 10/10 milestone
- [ ] Track: 2+ paid or committed to pay ₦50k–₦200k/month

### 8.2 — Founding Scouts (the 10/10 demand side)
- [ ] Recruit 30 founding scouts from VI/Lekki nightlife regulars
- [ ] "Founding Scout" badge — invite-only, permanent status
- [ ] Free entry / drink perks at partner venues (covered by venue partner deal)
- [ ] Weekly top-scout leaderboard, IG-shareable recap card
- [ ] Anti-churn levers (Codex's #5):
  - [ ] Scout Signature — weekly identity card (variance/peak/favored venues)
  - [ ] Crew resonance multiplier (3+ from same crew tapping same venue)
  - [ ] Lindy dividend — retroactive clout for early signal
  - [ ] Merchant callback push — "your taps brought 47 people to Tabu"
  - [ ] Off-peak reconnaissance quests (cold-start fix)

### 8.3 — Trust UX (Codex's #4 — the actual moat)
- [ ] Freshness label per cell: "updated 7 mins ago"
- [ ] Confidence indicator visible to user: "verified by 8 scouts tonight"
- [ ] Anti-spam shadow-drop UI (silent, never tells the abuser)
- [ ] Geofenced ratings already enforced — surface that fact in UI

### 8.4 — Merchant ROI Dashboard (Codex's #6 — answer "did VIIBE bring me people?")
- [ ] Profile views (already tracked)
- [ ] Direction taps (already tracked)
- [ ] Check-ins / arrivals
- [ ] Pulse Drop performance (₦ spent → ₦ traffic delivered)
- [ ] Before/after vibe lift on partner nights
- [ ] Returning scouts %
- [ ] Competitor comparison (anonymised) within the corridor

### 8.5 — Beta launch weekend
- [ ] TestFlight + Play Store internal test
- [ ] One Friday/Saturday launch in the corridor
- [ ] Collect testimonials, screenshots, retention metrics
- [ ] Repeat 4 consecutive weekends to hit the 10/10 milestone

## Phase 9 — Agentic Transformation (the Schmidt bar) — **FROZEN until 10/10 milestone**

> **Hard gate:** Do NOT start P9 work until the 10/10 milestone is hit. The agentic layer is a category-defining moat, but building it pre-product-market-fit is the textbook "feature sprawl" trap. Codex's critique on this is correct.

VIIBE today = scene-discovery app with AI features. **VIIBE as agent product** = does things for the user without being asked. This is the difference between a B+ outcome and a category-defining one. Builds on top of P1–P5 (decay engine + GIS) — agents need trustworthy signal to act on.

### 9.1 — Ambient Sensing (passive rating, no taps)
- [ ] Mic-based crowd energy classifier — dB envelope + 200–4kHz spectral features → energy score (no recording, on-device only)
- [ ] Motion-based dance detection — accelerometer pattern → "is this person actually moving with the music"
- [ ] BLE density passive count → presence-without-permission proxy
- [ ] Fuse passive signals with active taps — when scout pockets phone, the system keeps rating
- [ ] Privacy doctrine: every signal opt-in, on-device processing, only aggregates leave the phone

### 9.2 — Auto-Curate Engine (pre-emptive recommendations)
- [ ] User context graph: location, time, social graph, vibe persona, scene mood, history
- [ ] Recommendation agent: small LLM (Haiku 4.5) gets context every 15min, decides if a notification is warranted
- [ ] "It's 11:47, your crew is at Tabu, energy at Quilox just hit ELECTRIC, 8min walk — go now" — push fires unprompted
- [ ] Suppression rules: max 1 unprompted nudge per 90min, never during dwell at >0.6 confidence venue
- [ ] A/B harness: agent recommendations vs feed, measure cross-venue movement rate

### 9.3 — Night Director (the agent that runs your evening)
- [ ] Opt-in mode: user grants the agent permission to plan their night
- [ ] Agent stitches: crew location → energy forecast (Lindy) → routing → social fit → budget
- [ ] Outputs a 3-stop itinerary at 8pm, then *adapts* live as conditions shift
- [ ] User confirms or vetoes — agent learns from vetoes (RLHF-lite via thumbs)
- [ ] Memory: per-user preference vector that evolves session over session

### 9.4 — Scene Whisperer (proactive merchant agent)
- [ ] Merchant-side agent: watches their venue's curve and competitors
- [ ] Suggests Pulse Drops automatically: "Energy plateau at 65, drop ₦500 happy hour now → 31% lift forecast"
- [ ] Auto-fires drops in agent-permission mode (with cap)
- [ ] Closes the merchant→scout→merchant feedback loop without human-in-loop on either side

### 9.5 — Trust Surface
- [ ] Every agent action logged with reasoning trace
- [ ] User-facing "why did you suggest this?" view → tap any nudge to see the signal stack
- [ ] Kill switch per agent module — not all-or-nothing
- [ ] Aligns with cross-project north star: agent-product, not AI-feature SaaS

### Phase 9 dependency map
- Requires P1–P5 (the agents are useless without trustworthy energy signal)
- Parallelizable with P8 (retention). 9.2 *helps* retention — pre-emptive nudges = higher session frequency
- 9.4 directly feeds Series A revenue narrative ("merchants pay for the agent that grows their venue")

## Phase 10 — Creator Layer (the H3 Bloomberg play) — **FROZEN until 10/10 milestone**

> **Hard gate:** Do NOT build P10.1+ features until both (a) the 10/10 milestone is hit AND (b) P5 has ≥3 months of real Lagos pulse data. Building creator analytics on lying energy data poisons the most valuable user segment forever. **Only P10.0 (schema readiness, ~30min during P2) ships pre-10/10.**

VIIBE for DJs, artists, performers — but **as a tier inside VIIBE, not a separate app**. The data layer that nobody else on the planet has: live energy telemetry tied to specific performers + their actual fan-to-attendance conversion. This is the asset that pulls the H3 outcome (Bloomberg-for-scene) ~12 months earlier.

### 10.0 — Schema readiness (ships during P2, ~30min)
- [ ] Add optional `creator_id` + `set_window` fields to pulse event schema
- [ ] Add `creators` collection skeleton (id, name, verified_at, social_handles)
- [ ] Add `performances` collection (creator_id, venue_id, start_ts, end_ts)
- [ ] No UI, no logic — schema-only so we don't have to migrate later

### 10.1 — Verification (post-P5, design-partner phase)
- [ ] Venue-attestation flow: venue manager confirms "yes, X performed here Saturday 11pm–3am"
- [ ] Three-source verification: venue + 2+ matching scout pulses inside the set window
- [ ] Verified badge → unlocks creator dashboard
- [ ] Anti-gaming: rate-limit claim attempts, log everything

### 10.2 — Social Graph Linker (privacy-first)
- [ ] Creator OAuth: Instagram + Twitter/X + TikTok (one platform at a time, IG first)
- [ ] Fan-side opt-in: scout chooses which creators they follow can see them in aggregates
- [ ] **Aggregates only leave the phone — never identities.** Creator sees `"23% of your IG followers attended"`, not `"@user was there"`
- [ ] Revocable at any time, full deletion on revoke
- [ ] NDPR + GDPR compliance review **before launch** — non-negotiable

### 10.3 — Performance Analytics Dashboard
- [ ] Energy curve for each set (G-force × time, peak moments highlighted)
- [ ] Resonance Score: peak G-force during their set vs venue's rolling average
- [ ] Crowd composition: persona breakdown, repeat-attendance %, geographic spread
- [ ] Fan attribution: % of attendance that's verified followers vs walk-ins
- [ ] "Set Tape" auto-share card — 30s vertical video with energy waveform overlay (viral asset)

### 10.4 — Creator Monetization (Series A revenue line)
- [ ] **Creator Pro** ($20/mo) — Spotify-for-DJs analytics dashboard
- [ ] **Booking Index** ($200/booking marketplace fee) — venues query "which creators reliably push rooms to ELECTRIC at this hour"
- [ ] **Brand Match** (post-Series A) — sponsors discover creators by measurable scene impact, not Instagram followers
- [ ] Creator-tier pricing must work for the long tail or it's a 50-customer business

### 10.5 — Anchor design partners (parallel to P5)
- [ ] Recruit 3 Lagos-tier DJs as design partners pre-launch (free Pro tier in exchange for feedback)
- [ ] Target list: established names with measurable touring, not megastars
- [ ] Their data = first proof of category for Series A pitch

### Phase 10 risks (acknowledged, mitigations above)
- **Verification is gameable** → triple-source (venue + scouts + temporal pulse signature)
- **Tier conflict** (creators want data, scouts want privacy) → aggregate-only doctrine, opt-in linking
- **Star economics** (top 1% get all value) → Pro pricing must serve mid-tier, not just headliners
- **Privacy law** → NDPR/GDPR review pre-launch, design partners signed under data-handling agreements
- **App store policy** → Apple/Google scrutinise social-graph + location features hard. Plan a 2-week review window.

## Phase 11 — VIIBE Resonance (sibling product) — **FROZEN until 10/10 milestone**

> **Hard gate:** Do NOT build pre-10/10. Codex's strategic brief lives at `memory/project_viibe_resonance_brief.md`. Full spec + Claude's pressure-test gaps inside.

VIIBE Resonance = the emotional graph layer inside music. Pulse Clef capture surface inside Spotify/Apple-style player. Acquisition-demo strategy: prove the data primitive, sell to Spotify/UMG/Sony/TikTok. Reuses ~60% of VIIBE's engineering core (Reactor kinetic tap, decay aggregation, signal taxonomy).

**Brand portfolio doctrine:** VIIBE = scene, VIIBE Resonance = music, VIIBE X = future. Same primitive across surfaces. Brand-as-platform play.

Tasks tracked in IDEAS.md as RESN-01 through RESN-05.

## Scale gates (when to upgrade A-tier → S-tier)

- [ ] **Series A trigger**: migrate `vibe_pulses` → TimescaleDB + PostGIS (single highest-leverage upgrade)
- [ ] **Series B trigger**: migrate Socket.IO → NATS or Phoenix Channels (multi-city scale)
- [ ] **Growth trigger**: add deck.gl-based web GIS console for enterprise B2B buyers

## Pre-investment artifacts (parallel to P1–P5)

- [ ] Demo video — 10-second Reactor clip, then 30-second GIS map breathing
- [ ] First 5 anchor venue LOIs in Lagos
- [ ] Concrete plan for first 100 scouts

---

## Working principles

1. **Decay aggressive. Trust the buyer over the user.** A map that shows fewer peaks but never a stale peak is the one that earns trust.
2. **Ship A-tier now. Migrate piece-by-piece at scale gates.** Don't over-engineer pre-PMF.
3. **Phase order is canonical.** Don't start P5 before P3 ships — pretty maps lying about energy is worse than no map.
4. **Mark scale seams in code.** Every place a future migration will touch gets a `# TODO(scale-gate-X)` comment.
5. **Tests are non-negotiable for P1–P3.** Decay math wrong = whole platform wrong.
6. **Compress, don't expand.** Every new feature must serve the 10/10 milestone or it waits. P9 + P10 are frozen until the corridor proves the loop. Vision after traction, not before.
7. **Sell before you scale.** P8 (Lekki Corridor) runs in parallel with code work. The first 5 venue LOIs matter more than the next 1000 lines of code.
8. **Reachng funds VIIBE.** VIIBE runs lean — no burn-the-runway moves until 10/10 hits. Reachng generates the present, VIIBE compounds the future.
