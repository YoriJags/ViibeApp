# VIIBE — Strategy Blueprint

*Last updated: 2026-03-20 — Full purge and rewrite to reflect current build state*

---

## What This Is

VIIBE is a **live social intelligence terminal for city experiences**. Not a discovery app. Not a review platform. Infrastructure — the real-time data layer underneath the experience economy.

The consumer app is the acquisition engine. Every person who opens VIIBE to find where the scene is tonight becomes a node in a distributed sensor network. Their taps, ratings, motion, dwell time, and ambient signals feed a live data terminal that answers one question nobody else can: **where is the energy right now?**

The long-term play is the terminal, not the app. The app is how we get to 100 million data contributors.

**The one-liner:** *A live sensor network made of people — built in Lagos, scaling wherever the culture travels.*

---

## The Problem

Going out is a gamble. You don't know where the energy is until you're already there — or until someone texts you at midnight saying "you should've come here." By then it's too late.

Word of mouth is delayed. Social media is curated, not live. Google Maps is months old. There's no real-time, ground-truth signal for where the scene is tonight. People solve it through group chats and gut feel — fragmented, unreliable, always late.

**VIIBE gives you that signal.** A live map of the city's energy, verified by people physically in the room.

---

## Build State — What's Live ✓

### Core Intelligence Layer
- [x] Phone OTP authentication + 3-role system (Scout / Merchant / Admin)
- [x] Venue discovery feed with live Vibe Scores + real-time socket updates
- [x] Scout check-in + vibe rating system (geofenced, 1-per-session, cooldown)
- [x] 15+ scoring algorithms generating live Vibe Scores per venue
- [x] Vibe Oracle AI — peak window predictions per venue
- [x] Night Planner AI — Claude-powered concierge with rule-based fallback
- [x] GlobalVibePill HUD — geofence state + surge display
- [x] Venue Live system — follow/unfollow, "I Dey Road" intent
- [x] Demo mode — cold-start bypass with seeded Lagos venue data

### Scout Experience
- [x] VibeReactor — collective charge ring, kinetic tap, BPM lock, combo multiplier
- [x] VibeOscillator (Scene Frequency) — live BPM + energy waveform, VIBE+ exclusive
- [x] TorchButton — manual torch toggle + IGNITE SCENE hold mechanic (vibeScore ≥ 85)
- [x] Torch Ignite — synchronized crowd flash with wave-pattern stagger via socket
- [x] Scout Identity — call name, music preferences, zodiac, avatar
- [x] Vibe Persona — 4 archetypes (Turn Up / Luxe / Culture / Chill)
- [x] Vibe DNA card — affinity scores across 6 scene types
- [x] Scout Ranks — Newcomer → Scout → City Elite, clout points, streaks, multipliers
- [x] Dual home mode — Scout (gamified) vs. Insider (clean intel)
- [x] Crew / Cartel social features — squad locations, cartel radar, group voting
- [x] Achievement badges + clout leaderboard

### Sensor Stack
- [x] **Tap rhythm** — BPM lock, weighted CV scoring, crowd sync rate
- [x] **Vibe Rating** — 3-axis structured rating (energy / crowd / door wait)
- [x] **Ambient decibel** (opt-in) — dB sampling every 30s inside geofence, no recording
- [x] **Dwell time** — heartbeat tracker, time-weighted vibe contribution
- [x] **Surge events** — socket-driven energy spikes, reactor surge distortions

### Merchant & Admin
- [x] Merchant dashboard — live analytics, hourly energy curves, scout intel feed
- [x] Pulse Drops — targeted energy boost campaigns
- [x] VIBE+ subscription — Paystack paywall, VibeOscillator gating
- [x] Admin command centre — treasury, venue certification, platform oversight
- [x] Merchant SaaS tier architecture — complete

### UI & Infrastructure
- [x] UI rebrand — VibeReactor canvas 220→300px, atmospheric backdrop, typography overhaul
- [x] VenueCard atmospheric gradient overlay
- [x] VenueCategoryFilter — emoji prefix, solid accent fill, taller pills
- [x] CityPulseBar — stats pulse animation on socket venue_update events
- [x] OnboardingFlow — 2-slide intro + mode pick + call name (< 90 seconds to first tap)
- [x] AppTutorial — 6-slide Instagram-story how-to (Reactor, Rate, Torch, Frequency, Ranks)
- [x] Socket infrastructure — real-time venue updates, surge events, crowd sync, flash ignite

### Agent API (B2B / AI Agents)
- [x] `GET /api/v1/agent/venues/live` — top venues by live energy, filterable by city/category
- [x] `GET /api/v1/agent/venues/{id}` — single venue real-time snapshot
- [x] `GET /api/v1/agent/city/pulse` — city-level energy summary
- [x] Admin endpoints — issue / list / revoke API keys
- [x] API key auth — X-Agent-Key header or ?api_key= param

### Deployment
- [x] Frontend — React Native (Expo 54), deployed via EAS
- [x] Backend — FastAPI + MongoDB Atlas + Socket.IO, deployed on Railway
- [x] Web — Vercel
- [x] Payments — Paystack (Nigeria), payment abstraction layer for Gulf swap

---

## In Active Build 🔨

- [ ] **Kinetic accelerometer sensor** — expo-sensors, dancing BPM detection, zero permissions required
- [ ] **PostHog analytics** — event tracking across all key scout actions

---

## Pipeline 🗓️

### Sensor Stack (in order)
- [ ] **Kinetic / Accelerometer** — crowd BPM match from phone motion (no permissions)
- [ ] **BLE Proximity / Thermal Crowding** — crowd density map by zone (needs scale first)
- [ ] **Biometric wearable (HR)** — Apple Watch (HealthKit) + Galaxy Watch (Health Connect)
  - Heart rate + geofence presence = verified emotional engagement
  - Highest-value data point for B2B data licensing
  - Investor angle: verified emotional response data brands pay $50K+ per study to approximate
  - Build when: EAS/dev client confirmed, user base > 5,000 active scouts

### Product Features
- [ ] **Cartel Battle (cross-venue)** — cartel-initiated battles between venues, cross-venue tap tracking
- [ ] **Quest Timeline** — scheduled collective boosts with advance countdown, category ranking boost
- [ ] **Switch Face (Venue Mode)** — app switches theme/language/features by venue_type (church, concert, sports)
- [ ] **Data Fast Mode** — low-bandwidth toggle: no images, no animations, minimal socket reconnects
- [ ] **Admin Control Tower** — full overhaul (specifics TBD)
- [ ] **AfterHours share card** — recap card showing scout's night stats

### B2B / Agentic AI
- [ ] **ChatGPT Actions registration** — register VIIBE as a GPT Action for travel/nightlife GPTs
- [ ] **Claude MCP server** — register VIIBE Agent API as a Claude tool
- [ ] **Perplexity partner program** — register as real-time data source
- [ ] **Hotel/travel app B2B deal** — first paying API customer (Marriott, Rotana, or similar)

### Gulf Expansion
- [ ] Payment provider swap — Paystack → STCPay / Telr / Tap Payments
- [ ] Single `config.ts` — brand, city, currency, country code abstraction
- [ ] Strip Lagos-specific copy from all user-facing text
- [ ] Gulf city venue data seeding (Dubai, Riyadh, Doha demo data)
- [ ] PDPL (Saudi) + UAE PDPF compliance review

---

## Business Model — 4 Revenue Streams

| Stream | Description | Scale |
|--------|-------------|-------|
| **VIBE+ Subscription** | Consumer premium tier — VibeOscillator, priority intel, premium badges | Scales with user base |
| **Merchant SaaS** | Venue dashboard, Pulse Drops, analytics, energy campaigns | Scales with venue count |
| **White-Label Licensing** | Enterprise/government license — branded deployment per city/district | High ACV, long contract |
| **Agent API Licensing** | Hotels, travel apps, AI assistants pay for real-time crowd intelligence feed | Scales with Gulf expansion |

**Gross margin: 90%+** (software/data — no physical inventory)
**Unit economics target: LTV/CAC 10–25×**

---

## The Data Moat

Each sensor layer adds a proprietary data point that cannot be bought, scraped, or replicated without first building the user base.

| Phase | Signal | Status |
|-------|--------|--------|
| 1–2 | Tap rhythm + Vibe Rating | ✓ Live |
| 3 | Ambient decibel (opt-in) | ✓ Live |
| 4 | Kinetic / Accelerometer | 🔨 In build |
| 5 | BLE Proximity / Crowd density | 🗓️ Pipeline |
| 6 | Biometric wearable (HR) | 🗓️ Pipeline |

The moat compounds every night the platform operates. A competitor cannot replicate the dataset — they would need to rebuild the user base from zero.

---

## Market Position

**Nigeria (Primary):**
- Lagos scene economy: ~₦1.5 trillion (~$930M), ₦360M/day from clubs alone
- Lagos ranked #6 globally for nightlife (Time Out 2024), rising
- Nigeria #1 fastest-growing E&M market globally (PwC, 8.6% CAGR to 2028)
- Zero direct competition in real-time venue intelligence

**Gulf (Expansion Target):**
- Saudi Vision 2030: entertainment sector target 6% GDP contribution
- SEVEN building 21 entertainment destinations across Saudi Arabia
- Dubai: 17.15M international visitors 2023, targeting 25M by 2025
- Gulf hospitality & entertainment spend: projected $50B+ by 2030
- No real-time venue intelligence product at scale in either market

**Agentic AI (Future Position):**
- By 2026, AI assistants become the primary discovery interface
- VIIBE is the only verified real-time crowd intelligence source AI agents can query
- First-mover position in this category is self-reinforcing: more users → better data → agents prefer VIIBE → more users

---

## Seed Milestone (Fundraise Gate)

These metrics unlock the seed round conversation ($500K–$2M):

- [ ] 20+ venues live and rated
- [ ] 500+ active scouts
- [ ] 5+ paying merchants
- [ ] First ₦ recurring revenue
- [ ] D30 retention data

---

## Fundraise Strategy

**Pre-seed:** $50K–$200K — Lagos ops, product polish, first merchant revenue
**Seed:** $500K–$2M — Gulf market entry, local team, merchant network development
**Series A:** $5M–$15M — multi-city Gulf, data licensing B2B, sensor stack completion

**Pre-seed ask framing:** "We have a working product battle-tested in Lagos. We're raising to get to 500 scouts and 5 paying merchants — the data needed to prove the model before a Gulf deal."

**Gulf deal framing:** "We have the product. You have the market. 90 days from signature to live."

---

## Exit Targets

Primary acquisition targets (in priority order):
1. **Google / Apple Maps** — experience intelligence layer for their mapping products
2. **Spotify / Apple Music** — IRL music-to-venue bridge, live scene data
3. **Meta / TikTok** — proprietary real-time social behavior dataset in Africa
4. **Uber / Bolt** — destination intelligence, demand prediction
5. **Gulf sovereign fund (Mubadala, PIF)** — infrastructure play within Vision 2030

**The acquisition thesis:** Whoever buys VIIBE is buying the only real-time human social behavior dataset in the entertainment sector — a proprietary data feed that compounds every night we operate, attached to sensor infrastructure no competitor can rebuild from scratch.

**Realistic valuation path:**
- Now (code + IP): $250K–$450K outright
- With Gulf traction (500K users, $2M ARR): $15M–$30M
- At scale (multi-city, proven data licensing): $50M+

---

## Tech Stack

| Layer | Stack |
|-------|-------|
| Frontend | React Native + Expo 54, TypeScript, Reanimated v4, Skia |
| Backend | FastAPI, Python, MongoDB Atlas, Socket.IO |
| Auth | Firebase Auth |
| Payments | Paystack (Nigeria) — abstracted for Gulf swap |
| Infra | Railway (backend), Vercel (web), EAS (mobile builds) |
| Analytics | PostHog (in pipeline) |
| AI | Claude API (Anthropic) — Night Planner + Oracle |
| Sensors | expo-sensors (tap + kinetic), expo-av (ambient dB), expo-camera (torch) |

**Reanimated note:** Peer dep for react-native-reanimated v4.1.x (Expo SDK 54) is `react-native-worklets`, NOT `react-native-worklets-core`.

---

## Constraints

- **Tech Stack**: React Native + FastAPI + MongoDB — no architecture rewrites
- **Payments**: Paystack for Nigeria; Gulf deployment requires provider swap (budgeted into deployment timeline)
- **Cold Start**: Demo mode + seeded data carries until scout density is organic
- **Platform**: iOS + Android primary; Expo web secondary
- **Geography**: Lagos first, Gulf second, global third
- **Out of scope**: Table booking, desktop-first web, real-time chat/DMs, restaurants as primary focus, sports spectator events

---

*Last updated: 2026-03-20*
