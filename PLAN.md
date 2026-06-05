# VIIBE — Energy Layer Build Plan

**Mission:** Ship the GIS for live human energy. Decay-honest, scout-confirmed, B2B-credible.
**Doctrine:** Poco a poco. A-tier now, S-tier at scale gates. **Compress, don't expand.**
**Funding model:** Reachng generates runway. VIIBE runs lean until 10/10 milestone hits.
**Last updated:** 2026-05-09

---

## The 10/10 Milestone (north star)

Pre-investment target. The single falsifiable goal everything else serves:

> **4 consecutive weekends, 30+ scouts generating live data across 10+ Lekki/VI venues, 1000+ users checking the map, 5 venues asking for merchant access, 2 paid or committed to pay.**

Until this is hit, Phases 9 + 10 stay frozen. Anything that doesn't move the corridor toward this number waits.

**Public pitch:** *"VIIBE shows you where Lagos is alive right now."*
**Investor pitch:** *"Consumer app collects real-time crowd data. Merchant dashboard monetizes it. API becomes the intelligence layer."*

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

- [ ] L1: hook `vibe_pulse` socket event → Decay Engine
- [ ] **P10.0 schema readiness**: pulse event accepts optional `creator_id` + `set_window` (no logic, just plumbing)
- [ ] L2: hook dwell heartbeats (`useDwellTracker`) → presence ceiling
- [ ] L3a: surface mic dB samples (`useAmbientMeter`) to backend ingest endpoint
- [ ] L3b: BLE density (deferred unless explicitly approved — adds permissions plumbing)
- [ ] Geofence-exit detection → explicit decay event
- [ ] Per-scout contribution attribution (so departures can subtract correctly)
- [ ] Integration tests: full ingest → decay → query roundtrip

## Phase 3 — Cross-validation Gates (kills stale peaks)

The trust rules. Without these the GIS lies.

- [ ] Rule: `L1 high && L2 collapsing` → trust L2, discount L1 (kills home-tap fraud)
- [ ] Rule: `<2 distinct scouts in 60s` → confidence < 0.5, render translucent
- [ ] Rule: zero presence heartbeats in 90s → L2 collapses regardless of L1
- [ ] Confidence score `[0..1]` exposed per cell
- [ ] "Honest map" rule encoded: cell only renders saturated if all 3 gates pass
- [ ] Replay test: 100 simulated venues including adversarial cases

## Phase 4 — V-Pixel API (what the GIS reads)

The query surface. Cached, indexed, fast.

- [ ] `GET /api/grid/vpixels?bbox=&zoom=` — returns hex cells with `{energy, confidence, layer_breakdown, decay_state}`
- [ ] H3 hex indexing (Uber's H3 lib) for cell IDs — clean zoom hierarchy
- [ ] 5s response cache (Redis) keyed on bbox+zoom
- [ ] Compound index `(geo_hash, timestamp)` on `vibe_pulses`
- [ ] Tag scale-gate: `# TODO(scale-gate-A): swap to TimescaleDB + PostGIS at Series A`
- [ ] Load test: 1k req/s sustained, p95 <80ms

## Phase 5 — Frontend GIS Map (the visible layer)

The thing investors see. Mapbox-based, confidence-aware rendering.

- [ ] `npx expo install @rnmapbox/maps`
- [ ] New screen `app/grid.tsx`
- [ ] Hex tile renderer fed by `/api/grid/vpixels`
- [ ] Confidence-aware opacity (translucent when uncertain, saturated when trusted)
- [ ] Tap-cell drill-down → venue list inside that hex
- [ ] Live updates via socket (cell delta events, not full reload)
- [ ] "Breath" animation — cells gently pulse at their layer-blended BPM
- [ ] Demo-video-ready: looks honest *and* alive

## Phase 6 — Highest Energy Route (deferred, post-data)

Don't build until P5 has been live with real Lagos data ≥30 days. Routing on stale data is worse than no routing.

- [ ] Cost function: `f(walking_time, energy_along_path, decay_forecast)`
- [ ] Mapbox Directions API integration with custom waypoint ranking
- [ ] "Take the festival route" UX
- [ ] A/B test against fastest route for 2 weeks before defaulting on

## Phase 7 — B2B API surface (the moat monetises)

The dark intelligence layer. Don't build until P5 is live ≥30 days.

- [ ] `GET /v1/pulse/api/cells/{geo_hash}/history` — paywalled
- [ ] API keys, rate limits, usage billing
- [ ] First customer prospect: Lagos State tourism, EkoAtlantic developers, Heineken scene marketing
- [ ] Sample reports for sales: "Where the scene heated up this week"
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
