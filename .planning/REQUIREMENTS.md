# Requirements: VIIBE — Seed Milestone

**Defined:** 2026-03-11
**Core Value:** The city's energy, visible in real-time — so anyone knows where the night is peaking before they get there, and scouts who report it earn clout for being first.

---

## v1 Requirements

### Billing

- [ ] **BILL-01**: Scout can subscribe to Vibe+ via RevenueCat (Apple IAP on iOS, Google Play Billing on Android, Paystack on web) for ₦2,000/month
- [ ] **BILL-02**: New Vibe+ subscriber gets 7-day free trial before first charge
- [ ] **BILL-03**: Merchant can subscribe to SaaS dashboard tier via Paystack at ₦150,000/month with auto-renewing billing
- [ ] **BILL-04**: Merchant can purchase Pulse Drop boosts (Spark / Flare / Supernova) via Paystack wallet; purchase is gated behind merchant SaaS subscription

### Distribution

- [ ] **DIST-01**: EAS Build is configured (eas.json created, real EAS project ID in app.json, development build workflow working on iOS + Android physical devices)
- [ ] **DIST-02**: TestFlight beta build is live and distributable to internal testers on iOS

### Notifications

- [ ] **NOTF-01**: App registers for push notifications on launch, stores Expo push token on user profile; Expo Push API delivers notifications to device
- [ ] **NOTF-02**: In-app notification center displays unread notifications fetched from server (fallback for Nigerian Android devices where FCM is killed)
- [ ] **NOTF-03**: Merchant can send a live blast from dashboard that delivers as a push notification to scouts within 2km of their venue
- [ ] **NOTF-04**: Merchant receives push notification when their venue's vibe score drops below 50

### Growth

- [ ] **GROW-01**: Scout can generate a personal referral link from their profile; when a new user signs up via that link, both parties receive bonus clout points
- [ ] **GROW-02**: Referral links work as deep links (viibe.app/invite/:code) — open directly in the app from WhatsApp, Instagram, or browser; handle install attribution for new users
- [ ] **GROW-03**: Scout can share a Vibe Moment card (venue name + live score + scout handle) as an image shareable directly to WhatsApp or Instagram Stories

### Analytics

- [ ] **ANAL-01**: Merchant dashboard shows pre-computed analytics: avg vibe score trend (7-day + 30-day), rating volume by hour of day, peak day of week, unique scout count
- [ ] **ANAL-02**: Admin dashboard shows platform health: total MAU (30-day), DAU, active venues, active merchants, total ratings submitted, estimated MRR
- [ ] **ANAL-03**: Investor demo kit is a curated in-app demo flow that showcases live venue intelligence, AI Oracle, Night Planner, VibeReactor, and merchant dashboard — works in demo mode at any time of day

### Investor Deliverables

- [ ] **INVT-01**: Detty December War Room — a dedicated full-screen view showing all active Lagos venues sorted by live score, with real-time score animations, scout activity feed, and a city-wide collective charge bar; press-ready screenshot quality
- [ ] **INVT-02**: PITCH_DECK.md is updated to include all Phase 1+2 features (VibeReactor, GlobalVibePill, Dual Home Mode, AI Oracle, Night Planner, Vibe DNA), market research numbers (₦1.5T Lagos nightlife, PwC #1 fastest-growing E&M market), and a refreshed traction narrative
- [ ] **INVT-03**: VIBEAPP_STRATEGY_BLUEPRINT.md is updated with current feature inventory, revised go-to-market timeline, Detty December anchor strategy, and exit path narrative
- [ ] **INVT-04**: docs/FINANCIAL_MODEL.md is updated to match FM_VIIBE_v2 structure: dual revenue streams (consumer Vibe+ + merchant SaaS), RevenueCat/IAP billing architecture, Apple IAP caveat, seed milestone targets, Detty December milestone marker

---

## v2 Requirements

*(Deferred — after seed round closes or Lagos proven)*

### Distribution
- **DIST-03**: Play Store public submission (Android) — deferred; TestFlight sufficient for seed demo
- **DIST-04**: App Store public submission (iOS) — deferred until after seed round closes

### Growth
- **GROW-04**: Scout ambassador program — tiered incentives for top raters per city (Lagos, Abuja, PH, Ibadan)

### Social
- **SOCL-01**: City-wide scout leaderboard — top scouts ranked by clout per city per week

### Platform
- **PLAT-01**: Multi-city expansion framework — Abuja, Port Harcourt, Ibadan launch tooling
- **PLAT-02**: Data intelligence export — venue footfall reports, crowd heatmaps for enterprise clients

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Table booking / VIP reservation engine | Discotech territory; VIIBE is intelligence, not transaction |
| Real-time in-app chat / DMs | High complexity, not core to vibe intelligence value |
| Non-Nigeria markets | Lagos must be proven first; expansion before proof wastes seed capital |
| Stripe payments | Not Nigeria-licensed; Paystack handles all ₦ transactions |
| Sentry / Amplitude / Segment | Analytics overkill at seed stage; defer to Series A |
| React Native Maps (native) | High complexity; MockMap + Expo Location sufficient at seed |
| Reanimated v4 upgrade | Requires worklets + Babel config that breaks existing setup |
| Event ticketing engine | Separate product category; deferred to v3+ |

---

## Traceability

*(Populated by roadmapper — 2026-03-11)*

| Requirement | Phase | Status |
|-------------|-------|--------|
| BILL-01 | Phase 1: Billing Foundation | Pending |
| BILL-02 | Phase 1: Billing Foundation | Pending |
| BILL-03 | Phase 1: Billing Foundation | Pending |
| BILL-04 | Phase 1: Billing Foundation | Pending |
| DIST-01 | Phase 2: EAS Build + Distribution | Pending |
| DIST-02 | Phase 2: EAS Build + Distribution | Pending |
| NOTF-01 | Phase 3: Push Notifications | Pending |
| NOTF-02 | Phase 3: Push Notifications | Pending |
| NOTF-03 | Phase 3: Push Notifications | Pending |
| NOTF-04 | Phase 3: Push Notifications | Pending |
| GROW-01 | Phase 4: Growth Loops | Pending |
| GROW-02 | Phase 4: Growth Loops | Pending |
| GROW-03 | Phase 4: Growth Loops | Pending |
| ANAL-01 | Phase 5: Analytics + Merchant SaaS | Pending |
| ANAL-02 | Phase 5: Analytics + Merchant SaaS | Pending |
| ANAL-03 | Phase 5: Analytics + Merchant SaaS | Pending |
| INVT-01 | Phase 6: Investor Deliverables | Pending |
| INVT-02 | Phase 6: Investor Deliverables | Pending |
| INVT-03 | Phase 6: Investor Deliverables | Pending |
| INVT-04 | Phase 6: Investor Deliverables | Pending |

**Coverage:**
- v1 requirements: 20 total
- Mapped to phases: 20
- Unmapped: 0

---
*Requirements defined: 2026-03-11*
*Last updated: 2026-03-11 — traceability populated after roadmap creation*
