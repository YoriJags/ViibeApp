# VIIBE

## What This Is

VIIBE is the real-time intelligence layer for city experiences — it crowdsources and measures the live energy of venues (clubs, bars, lounges, events) as they happen, then uses AI to get people to the right moment before it peaks. It is not a booking app. It is what Google Maps is to navigation: the authoritative signal layer for the experience economy, starting in Lagos and expanding Africa-first, then globally wherever the culture travels.

## Core Value

**The city's energy, visible in real-time** — so anyone knows where the night is peaking before they get there, and scouts who report it earn clout for being first.

## Requirements

### Validated

*(Features already built and live in production)*

- ✓ Phone OTP authentication + 3-role system (Scout / Merchant / Admin) — Phase 0
- ✓ Venue discovery feed with live vibe scores + real-time updates — Phase 0
- ✓ Scout check-in + vibe rating system (1-per-session, cooldown) — Phase 0
- ✓ Vibe Persona system (4 archetypes: Turn Up / Luxe / Culture / Chill) — Phase 1
- ✓ Vibe DNA card (affinity scores across 6 scene types) — Phase 1
- ✓ Vibe Oracle AI (peak window predictions per venue) — Phase 1
- ✓ Night Planner AI (Claude-powered concierge, rule-based fallback) — Phase 1
- ✓ Crew / Cartel social features (squad locations, cartel radar) — Phase 1
- ✓ Achievement badges + clout leaderboard — Phase 1
- ✓ Dual home mode: Scout (gamified) vs. Insider (clean intel) — Phase 2
- ✓ VibeReactor (collective charge ring + kinetic tap + combo multiplier) — Phase 2
- ✓ GlobalVibePill HUD (global geofence state + surge display) — Phase 2
- ✓ Merchant dashboard (basic venue management, live push blasts) — Phase 2
- ✓ Venue Live system (follow/unfollow, "I Dey Road" intent) — Phase 2
- ✓ Demo mode (cold-start bypass, seeded Lagos venue data) — Phase 2
- ✓ Deployed: Vercel (frontend) + Railway (backend) + MongoDB Atlas — Phase 2

### Active

*(Next milestone — seed-fundable product)*

- [ ] Vibe+ subscription (Paystack paywall, premium features gated)
- [ ] Merchant SaaS tier (paid dashboard, analytics, boost campaigns)
- [ ] Venue onboarding flow (Admin-led merchant signup + venue creation)
- [ ] Scout growth loops (referral system, invite crew, share vibe moment)
- [ ] Detty December "War Room" (high-density real-time event view, press-ready)
- [ ] Data intelligence exports (venue footfall reports, crowd heatmaps for merchants)
- [ ] Multi-city expansion framework (Abuja, Port Harcourt, Ibadan launch tooling)
- [ ] App Store / Play Store submission (TestFlight beta + public release)
- [ ] Press + investor demo kit (shareable link, curated demo flow)
- [ ] Admin analytics dashboard (platform health, scout activity, venue performance)

### Out of Scope

- Full table booking / VIP reservation engine — Discotech territory; VIIBE is intelligence, not transaction
- Desktop-first web experience — mobile is the primary surface; web is supplementary
- Non-Nigeria markets before Lagos is proven — Lagos first, Africa second, global third
- Real-time chat / DMs — high complexity, not core to vibe intelligence value
- Restaurant-only focus — nightlife venues are the anchor, restaurants are secondary

## Context

**Tech Stack (fixed):**
- Frontend: React Native (Expo 54), Expo Router v5, Zustand v5, Socket.IO client
- Backend: FastAPI (Python), Motor (async MongoDB), Socket.IO server
- Database: MongoDB Atlas (vibe_app DB, 10 seeded Lagos venues)
- Payments: Paystack (Nigerian processor)
- Deployment: Vercel (frontend web) + Railway (backend API)
- AI: Claude API (Anthropic) — Night Planner + Oracle intelligence
- Sensors: expo-sensors (accelerometer for VibeReactor kinetic tap)

**Market Position:**
- Nigeria is the #1 fastest-growing E&M market globally (PwC, 8.6% CAGR to 2028)
- Lagos nightlife economy: ~₦1.5 trillion (~$930M), ₦360M/day from clubs alone
- Lagos ranked #6 globally for nightlife (Time Out 2024), rising
- Zero direct competition in real-time venue intelligence — market is WhatsApp groups + Instagram
- Afrobeats going global creates Lagos → Africa → Diaspora expansion narrative

**Exit Strategy:**
- Primary targets: Google/Apple Maps (experience layer), Spotify/Apple Music (IRL music-to-venue bridge), Meta/TikTok (social graph + nightlife content), or independent IPO as Africa's first nightlife-intelligence unicorn
- Seed milestone: 300+ active scouts, 20+ live venues, 5 paying merchants, 3 months Lagos retention data

**Seed Funding Target:** $500K–$2M (Nigerian/African VC ecosystem; Detty December as proof-of-concept event)

## Constraints

- **Tech Stack**: React Native + FastAPI + MongoDB — no architecture rewrites; build on what works
- **Payments**: Paystack only (Nigeria-licensed processor); no Stripe until international expansion
- **Cold Start**: Demo mode + seeded data must carry until scout density is organic
- **Platform**: iOS + Android primary; Expo web secondary (deployed but not primary UX)
- **Geography**: Nigeria cities (Lagos, Abuja, Port Harcourt, Ibadan) for v1 seed milestone
- **Reanimated**: Pinned to ~3.17.4 — do NOT upgrade to v4.x (requires worklets + Babel config)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Scout-first model | Crowd intelligence is the moat; scouts generate the data that makes merchants pay | — Pending |
| Demo mode cold-start bypass | Can show investors and merchants a live product before real scout density | ✓ Good |
| Dual home mode (Scout / Insider) | Different user jobs: gamified clout vs. clean intelligence; both needed for TAM | — Pending |
| Afrobeats cultural narrative | Investor hook + international press angle + diaspora user acquisition | — Pending |
| Lagos VI/Lekki corridor first | Highest venue density + income + social media amplification in Nigeria | — Pending |
| All 3 revenue streams | Consumer Vibe+, Merchant SaaS, Data intelligence — builds toward platform exit valuation | — Pending |

---
*Last updated: 2026-03-11 after initialization*
