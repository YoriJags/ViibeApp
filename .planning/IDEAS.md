# VIIBE — Ideas & Pending Tasks

Running list of everything in flight, deferred, or discussed but not yet built.
Updated as work happens. Check this before every session.

---

## 🔴 Seed Milestone (Blocking for Fundraise)

These must ship before investor conversations.

| ID | Task | Notes |
|----|------|-------|
| BILL-01 | Vibe+ subscription via RevenueCat (iOS IAP + Android + Paystack web) | ₦2,000/mo |
| BILL-02 | 7-day free trial for new Vibe+ subscribers | |
| BILL-03 | Merchant SaaS subscription via Paystack | ₦150,000/mo |
| BILL-04 | Pulse Drop boost purchases (Spark/Flare/Supernova) | Gated behind merchant SaaS |
| DIST-01 | EAS Build configured — dev build on iOS + Android physical devices | |
| DIST-02 | TestFlight beta live and distributable | |
| NOTF-01 | Push notification registration + Expo push token on user profile | |
| NOTF-02 | In-app notification centre (fallback for Nigerian Android) | |
| NOTF-03 | Merchant live blast → push to scouts within 2km | |
| NOTF-04 | Merchant push alert when venue score drops below 50 | |
| GROW-01 | Scout referral link → bonus clout for both parties | |
| GROW-02 | Deep link referrals (viibe.app/invite/:code) — WhatsApp/Instagram | |
| GROW-03 | Vibe Moment share card (venue + score + handle) → WhatsApp/IG Stories | |
| ANAL-01 | Merchant dashboard analytics: vibe score trend, rating volume, peak hours | |
| ANAL-02 | Admin dashboard: MAU, DAU, active venues, MRR | |
| ANAL-03 | Investor demo kit — curated in-app demo flow | |
| INVT-01 | Detty December War Room — full-screen live venue intelligence view | |
| INVT-02 | PITCH_DECK.md updated with Phase 1+2 features + market numbers | |
| INVT-03 | VIBEAPP_STRATEGY_BLUEPRINT.md updated | |
| INVT-04 | FINANCIAL_MODEL.md updated (RevenueCat/IAP, seed targets, DD milestone) | |

---

## 🔴 AI Intelligence Layer (Build Now — World-Class Product)

Research completed 2026-03-27. See `.planning/research/AI_INTELLIGENCE_LAYER.md` for full spec.

### Tier 1 — This Sprint

| ID | Feature | What it is | Priority |
|----|---------|-----------|----------|
| AI-01 | **Scout Integrity Score (SIS)** | Hidden reliability weight per scout (0–100). New scouts = 0.3× Pulse Score multiplier. Proven scouts (high consensus accuracy) = 1.5×. Score computed from: GPS verification, consensus accuracy, submission velocity, text/numeric contradiction rate. Never shown to scouts. Admin-only view. | CRITICAL |
| AI-02 | **Signal Extraction Layer** | Every scout text submission → async GPT-4o-mini call → structured JSON: dominant vibe dimension, intensity modifier, contradiction flag, named entities (DJs, event names). Enriches every Pulse Score. Run async post-submission — zero latency impact. Cost < $0.001/report. | CRITICAL |
| AI-03 | **Energy Decay Mechanic** | Pulse Score visually degrades after 45 mins without new scout reports. Score visually "cools" on venue card. Label: "last rated Xh ago." Score expires as live data after 90 mins. | ✅ BACKEND BUILT — `energy_decay.py` (P1) + `decay_ingest.py` (P2). Venue-card "cools" UI still to wire. |
| AI-04 | **Comparative Framing** | Show "Hotter than last Saturday at this time" / "Cooler than usual for a Friday" on venue cards and detail screen. MongoDB aggregation query, time-of-week bucketed per venue. | HIGH |

### Tier 2 — Next 90 Days

| ID | Feature | What it is | Priority |
|----|---------|-----------|----------|
| AI-05 | **Live Intelligence Feed** | Scrollable feed of AI-generated insight cards triggered by real statistical events. Triggers: energy spike >30pts in <15min, 3+ simultaneous reports, multi-peak window, city-level threshold. Template-based sentences — no LLM hallucination risk. Cards expire after 45 mins. | HIGH |
| AI-06 | **Scout Streak + Territory Leaderboard** | Streak counter on scout profile. Weekly-reset leaderboard by neighborhood (e.g. "Top Scout — Victoria Island"). Tier upgrade + streak notifications automated. | HIGH |
| AI-07 | **Scout Credibility % on Profile** | Show "Scout Reliability: 94%" publicly on scout profile, computed from SIS. Builds trust for users reading scout reports. | MEDIUM |

### Tier 3 — Scale Phase (Needs 30+ Days Data)

| ID | Feature | What it is | Priority |
|----|---------|-----------|----------|
| AI-08 | **Pulse Forecast** | 60-minute predictive energy curve per venue. "Trending toward peak in ~45 min." Needs historical venue data to build time-of-week curves. Cross-venue spillover detection. | HIGH (after data) |
| AI-09 | **Vibe Match** | User picks 3–5 energy descriptors → pgvector similarity search → ranked live venue matches. Free via Postgres pgvector extension. | MEDIUM |

---

## 🟡 Product Features (Confirmed, Not Started)

From the March 14 feature pipeline.

| # | Feature | What it is |
|---|---------|-----------|
| 7 | **User-Created Events** | Anyone can create an event (pop-up, party, rooftop, brand activation) on VIIBE. It becomes a temporary venue — geofenced location, live Vibe Score, scout ratings run in real time. Free for personal events. Paid merchant tier for commercial events. Needs: event creation flow, temporary venue model, expiry logic, event pin on map. **Not currently in codebase — needs full build.** |
| 1 | **Cartel Battle (cross-venue)** | Cartel members in different venues challenge each other. Extend VenueBattle.tsx to cartel-initiated cross-venue battles. |
| 2 | **Quest Timeline** | Scheduled collective venue boosts with visible countdown. Show in advance so people can anticipate and plan. |
| 3 | **Admin Control Tower Update** | Refresh the admin control tower. Specifics TBD. |
| 4 | **Switch Face (venue mode switching)** | App switches theme/language/features based on venue type (church, concert, sports, etc). venue_type field exists already. |
| 5 | **PostHog Analytics** | Event tracking for scout actions: tap, check-in, cartel join, battle, quest. |
| 6 | **Data Fast Mode** | Low-bandwidth toggle — reduce images, disable animations, minimise socket reconnects. |

---

## 🟢 Scene Intelligence (In Progress / Partially Built)

Built this session. Some parts need follow-up.

| # | Item | Status |
|---|------|--------|
| ✓ | Score transparency pill (active scouts, recency, confidence) | Done |
| ✓ | Dwell time tracking (useDwellTracker + /api/dwell/ping) | Done |
| ✓ | Scout consensus rate signal | Done |
| ✓ | Ambient audio opt-in (useAmbientMeter + AmbientOptInModal + /api/ambient/ping) | Done |
| ✓ | Multi-signal weighted blend formula | Done |
| — | **Reactor tap intensity as direct signal in blend** | Currently only a floor (kinetic momentum). Should be a positive signal in the blend too. |
| — | **Social velocity** | Posts/stories from a location in real time. Needs Instagram/TikTok API access. Deferred to pipeline. |
| — | **Ambient audio: add dB-to-energy label on venue screen** | Could show "🔊 Loud room" based on dB avg. Small UI touch. |

---

## 💰 Wealth Organs (Shipped 2026-06-05)

The money spine — see PLAN.md "Wealth Organs" for the doctrine. Built so VIIBE is
valuable at N=1 and earns before it scales.

| # | Organ | Where | Status |
|---|-------|-------|--------|
| 1 | **Attribution loop** — intent → verified arrivals → honest lift → naira | `attribution.py`, `GET /merchant/venues/{id}/attribution` | ✅ Shipped (+ per-user direction-tap matching wired in `venueSlice`) |
| 2 | **Weekly Lift Report** — shareable per-venue ROI card | `lift_report.py`, `?format=html` | ✅ Shipped |
| 3 | **Agent API distribution** — register as the data source agents query | `agent_dist.py`, `/agent-distribution/` (MCP + OpenAPI + ai-plugin) | ✅ Shipped |
| 4 | **Freeze doctrine** — no new consumer-delight until #1–#3 live + a paying merchant | PLAN.md | ⛔ Doctrine |

**Follow-ups:** profile-view intent isn't sent with auth yet (aggregate-only);
city-wide Scene Report thread (VIRAL-02); Monday cron to auto-send Lift Reports.

---

## 🚀 Growth & Viral Features (Backlog — High Impact)

| ID | Feature | What it is | Priority |
|----|---------|-----------|----------|
| VIRAL-01 | **"I Was There" Receipt Card** | After a scout is at a venue when it peaks, auto-generate a shareable card: venue name, score, timestamp, VIIBE logo. Instagram Story gold. Every share is a free ad. Single feature that could 10x organic acquisition. Backend: `/api/shares/receipt` endpoint generating OG image. Frontend: share sheet after check-out. | HIGH |
| VIRAL-02 | **Weekly Lagos Scene Report** | Every Monday auto-generate from prior week's data: top 3 venues, biggest rise/fall, peak hour across the city, "Scene of the Week" moment. Publish as Twitter thread + Instagram carousel. TechCabal bait. Backend: scheduled job, report endpoint. | 🟢 PARTIAL — per-venue **Weekly Lift Report** shipped (`lift_report.py`, `/merchant/venues/{id}/lift-report?format=html`, wealth organ #2). City-wide public thread + Monday cron still pending. |
| VIRAL-03 | **Daily "Lagos Is At X Energy" Tweet** | Automated daily post from Agent API: "Lagos is at 84 energy tonight. Escape: 91. Quilox: 87." Shareable, creates curiosity, drives inbound. Cron job + Twitter API. | MEDIUM |
| VIRAL-04 | **Waitlist Referral System** | "Invite 3 friends, skip the queue" mechanic. Unique referral links, position boost on referral completion. Drives viral waitlist growth. | MEDIUM |
| VIRAL-05 | **Open Graph Share Cards** | OG meta tags on landing page + venue pages so links shared on Twitter/LinkedIn/WhatsApp generate rich preview cards with live vibe score. | MEDIUM |
| VIRAL-06 | **Press Kit Page (`/press`)** | Brand assets, key stats, founder bio, downloadable media. Required for TechCabal/TechNext press pickup. | LOW |

---

## 🏗️ Infrastructure (Backlog — Engineering)

| ID | Feature | What it is |
|----|---------|-----------|
| INFRA-01 | **Backend modularization** | Split monolithic routes into bounded service modules. Improve testability and onboarding for new devs. |
| INFRA-02 | **MongoDB indexes audit** | Audit all collections against actual query patterns. Add missing compound indexes. Remove unused ones. |
| INFRA-03 | **Redis adapter for Socket.IO scaling** | Replace in-memory Socket.IO with Redis adapter for horizontal scaling across Railway replicas. Required before multi-region. |
| INFRA-04 | **Embeddable Live Venue Widget** | `<iframe>` or JS snippet venue owners drop on their Linktree/website showing live Vibe Score + current energy state. Drives ambient awareness and backlinks. Backend: `/api/widget/:venue_id` returning embeddable HTML. |

---

## 🔵 BetConstruct B2B (Active Opportunity)

Research completed 2026-03-27. See `.planning/research/BETCONSTRUCT_STRATEGY.md` for full intel.

| ID | Action | Notes |
|----|--------|-------|
| BC-01 | **Follow up AGE conference contact** | Warm lead — met them in person. Do not cold-email generic inbox. |
| BC-02 | **Build Tipster Marketplace MVP** | Demo-quality prototype against Swarm API (public GitHub SDK, MIT). Bettor profiles + verified records + copy-bet UI. 4–6 weeks. |
| BC-03 | **Atmosphere Intelligence API spec** | Define data schema: pre-match atmosphere index, in-play sentiment update, home advantage score. |
| BC-04 | **Target SiGMA Africa / ICE Barcelona** | BetConstruct exhibits at both. Walk in with working demo + one-pager. |

---

## 🔵 Ideas (Discussed, Not Committed)

Things that came up in conversation worth keeping.

| Idea | Context |
|------|---------|
| **"It's a live sensor network made of people"** | Core brand phrase — use in pitch deck, onboarding, marketing copy |
| **Social velocity signal** | Real-time posts/stories from location as corroborating signal. Need platform API access first. |
| **Dwell time → rating weight boost** | Long-dwell scouts (30+ min) could get their ratings weighted slightly higher. Not yet in formula. |
| **Transparency modal on score tap** | Tapping the score shows a breakdown: X scouts, signal weights, confidence. More depth than the pill. |
| **Stream rating (DITCHED)** | Do not revisit. Explicitly rejected. |

---

## 🎵 VIIBE Resonance (sibling product — FROZEN until 10/10)

Spec lives in memory: `project_viibe_resonance_brief.md`. Acquisition-demo for Spotify/UMG/Sony — emotional graph layer for music streaming. **Hard gate: do not start until VIIBE 10/10 milestone hits.**

| ID | Task | Notes |
|----|------|-------|
| RESN-01 | Listener-Mode demo: Spotify-style player + synced lyrics + Pulse Clef tap/hold | Acquisition demo, not consumer launch |
| RESN-02 | Rewind detection (simulated in own player; real version unlocks post-acquisition) | The strongest signal in the hierarchy |
| RESN-03 | Artist-Mode dashboard: top resonating lyric, most-replayed moment, hook candidate, emotion map | Translate raw signals into decisions |
| RESN-04 | Signal taxonomy: pulse_tap / pulse_hold / lyric_rewind / repeat_rewind / rewind_plus_pulse | Hierarchy + Resonance Score formula — patentable |
| RESN-05 | Validation step: prove resonance correlates with ≥2 existing platform metrics (saves, replays, completion) | Without this, dashboard is vanity |

---

## 🥷 Steal-from-Comps (from competitive landscape scan, 2026-05-09)

Sharp ideas borrowed from rival apps. None overlap with our core moat — they're UX/loop polish that compress time-to-trust.

| ID | Source | Idea | Notes |
|----|--------|------|-------|
| STEAL-01 | HYPE | **3-tier public-facing crowd labels** (CHILL / VIBING / PACKED) layered on top of our 5-tier internal model (DORMANT/STIRRING/BUZZING/POPPING/ELECTRIC) | ~30min UX work in P5. First-time user comprehension goes up; kinetic depth preserved underneath. |
| STEAL-02 | HYPE | **Vibe+ line-skipping at partner venues** | Bolt-on for existing Vibe+ tier. Test in P8.4 once 5+ venues signed. Direct revenue lift. |
| STEAL-03 | Barco | **Stories on venue pages** — short scout-uploaded clips/photos pinned to a venue | Cheap UGC moat, deepens venue profiles beyond the score. Phase 8 add. |
| STEAL-04 | BarGlance | **"8-second glance" framing** — borrow the language, not the webcams | Use in onboarding + landing copy: "take a glance before you go." |
| STEAL-05 | NOITE | **City-level pulse summary** — "Lagos is BUZZING tonight" headline above the map | ✅ Backend exists as `city_pulse` in the Agent API (`/api/v1/agent/city/pulse`). Map headline UI still to wire. |

### Explicit "DO NOT STEAL"

- ❌ **Webcams (BarGlance / BarSeen approach)** — privacy nightmare, kills venue partnerships, doesn't scale, gives venues a reason to refuse onboarding. We compete *against* this; never adopt it.
- ❌ **Single-signal check-ins as primary data source** — every comp is stuck here. Our kinetic Reactor is the differentiator; check-ins are secondary at most.

---

## 📋 Session Log

| Date | What was built |
|------|---------------|
| 2026-06-05 | P1 Decay Engine committed (was stranded uncommitted). P2 Layer Ingestion (`decay_ingest.py`, L1/L2/L3a hooks into vibe_pulse/dwell/ambient, 12 tests). **Wealth organs shipped:** #1 attribution loop, #2 weekly Lift Report (shareable HTML card), #3 Agent API distribution (ai-plugin.json + OpenAPI + MCP server), #4 PLAN.md wealth-spine + freeze doctrine. Per-user direction-click attribution wired. 52/52 tests green. Deleted two zero-byte junk files. |
| 2026-05-09 | P1 Decay Engine shipped (4-layer signal model, 3 trust gates, 17/17 tests passing in 0.15s, 10k cells <100ms). PLAN.md created with 10 phases + 10/10 milestone. Competitive landscape scan saved to memory (8 comps, all half-products). STEAL-01–05 captured. |
| 2026-03-20 | waitlist.py EmailStr fix (Railway crash resolved), landing page mobile nav, scroll animations, merchant analytics demo, Emergent gold palette merge (#C9A84C), "How It Works" section. Backlog captured: VIRAL-01–06, INFRA-01–04. |
| 2026-03-17 | Score transparency signals, dwell tracking, scout consensus, ambient audio opt-in, multi-signal weighted blend, reactor ring track upgrade (D), VIBE_SCORE_FORMULA.md |
| 2026-03-14 | UI redesign A–C, E–J. Reactor scale, backdrop, typography, public floor header, VenueCard gradient, category filter, stats bar animation. Feature pipeline captured. |

---

*Last updated: 2026-06-05*
