# VIIBE — Energy Layer Build Plan

**Mission:** Ship the GIS for live human energy. Decay-honest, scout-confirmed, B2B-credible.
**Doctrine:** Poco a poco. A-tier now, S-tier at scale gates.
**Last updated:** 2026-04-28

---

## Phase 1 — Decay Engine (foundation)

The keystone. Pure math, fully unit-testable, no UI risk. Every other phase depends on this being right.

- [ ] Create `backend/app/services/energy_decay.py`
- [ ] Define 4-layer signal model (L1 active / L2 presence / L3 ambient / L4 inference)
- [ ] Implement exponential decay per layer (τ = 45s / 180s / 480s / 3600s)
- [ ] V-Pixel state container: per-cell timestamps, weights, confidence
- [ ] Pure-function `compute_energy(cell_state, now)` — no I/O
- [ ] Continuous server tick (5s cron) that decays all active cells
- [ ] Unit tests: stale peak collapses in <60s, no-op cells stay zero, layered blending math
- [ ] Bench: 10k active cells × 5s tick under 100ms

## Phase 2 — Layer Ingestion (real signals in)

Wire each layer into existing app events. No new client work — uses signals already being sent.

- [ ] L1: hook `vibe_pulse` socket event → Decay Engine
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

## Phase 8 — Scout retention engine (parallel track, business-critical)

The risk that kills everything if not solved. Runs alongside P1–P5.

- [ ] Scout Signature feature — weekly identity card showing variance/peak/favored venue types
- [ ] Merchant callback push — "your taps moved Tabu to ELECTRIC, 47 people came in 20min"
- [ ] Off-peak reconnaissance quests (cold-start fix)
- [ ] Crew resonance multiplier (3+ from same crew tapping same venue)
- [ ] Lindy dividend (retroactive clout for early signal)
- [ ] Target: 21-day scout retention proven before Series A

## Phase 9 — Agentic Transformation (the Schmidt bar)

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
6. **Agent before app.** P9 isn't a "v2 feature" — it's the north star. P1–P5 build the senses, P9 builds the brain that acts. Without P9, VIIBE is a tool. With P9, it's a teammate.
