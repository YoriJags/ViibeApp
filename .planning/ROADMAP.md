# Roadmap: VIIBE — Seed Milestone

## Overview

VIIBE's core product is live in production. The seed milestone layers monetization, distribution, and growth infrastructure onto a working platform to make it investor-fundable and App Store ready before Detty December 2026. Six phases execute in strict dependency order: billing architecture first (Apple policy must be resolved before any build), then native builds (required for push + deep links), then push notifications (the real-time value prop becomes real), then growth loops (referral system drives the 300-scout KPI), then analytics and merchant SaaS (instruments the platform and adds B2B revenue), and finally investor deliverables (War Room, pitch deck, financial model — the funding package).

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Billing Foundation** - Vibe+ and Merchant SaaS payment infrastructure with RevenueCat + Paystack, subscription gating on premium features
- [ ] **Phase 2: EAS Build + Distribution** - Native iOS and Android builds via EAS, TestFlight beta live, App Store listing ready
- [ ] **Phase 3: Push Notifications** - End-to-end push delivery: token registration, surge alerts, merchant live blasts, in-app notification center
- [ ] **Phase 4: Growth Loops** - Referral system with clout rewards, deep links via WhatsApp, Vibe Moment card sharing
- [ ] **Phase 5: Analytics + Merchant SaaS** - PostHog instrumentation, merchant analytics dashboard, merchant onboarding flow, admin platform health view
- [ ] **Phase 6: Investor Deliverables** - Detty December War Room, updated pitch deck, strategy blueprint, and financial model

## Phase Details

### Phase 1: Billing Foundation
**Goal**: VIIBE has working subscription revenue — scouts pay for Vibe+, merchants pay for SaaS, and premium features are gated server-side so payment bypassing is impossible
**Depends on**: Nothing (first phase)
**Requirements**: BILL-01, BILL-02, BILL-03, BILL-04
**Success Criteria** (what must be TRUE):
  1. Scout can subscribe to Vibe+ for ₦2,000/month via RevenueCat (Apple IAP on iOS, Google Play Billing on Android, Paystack on web) and the Oracle AI + Night Planner immediately become accessible
  2. New Vibe+ subscriber sees a 7-day free trial before any charge; the subscription status screen shows the trial end date, feature list, and a cancel link
  3. Merchant can subscribe to the SaaS dashboard tier via Paystack at ₦150,000/month with auto-renewing billing; the subscription survives a browser refresh and backend restart
  4. Merchant can purchase Pulse Drop boosts (Spark / Flare / Supernova) only after their SaaS subscription is active; attempting to buy a boost without a subscription is blocked with a clear upsell prompt
  5. Paystack webhook handler verifies HMAC-SHA512 signature on every event; a fake `charge.success` POST with wrong signature returns 401 and grants no subscription access
**Plans**: 3 plans

Plans:
- [ ] 01-01-PLAN.md — Document existing billing implementation (file inventory, constants, routes, gates)
- [ ] 01-02-PLAN.md — Audit implementation against BILL-01 through BILL-04 (gap analysis with verdicts)
- [ ] 01-03-PLAN.md — Apply minor resilience fixes: timeouts, try/except on provider calls, webhook failure logging

### Phase 2: EAS Build + Distribution
**Goal**: VIIBE runs as a real native app on physical iOS and Android devices, distributed via TestFlight, with App Store listing ready for review submission
**Depends on**: Phase 1
**Requirements**: DIST-01, DIST-02
**Success Criteria** (what must be TRUE):
  1. `eas.json` exists with development, preview, and production profiles; `eas build` completes without error on both iOS and Android
  2. A tester with a TestFlight invite can install VIIBE on a physical iPhone, log in with OTP, and reach the home feed — no Expo Go required
  3. The Mapbox `RNMapboxMapsDownloadToken` is not present in `app.json` or any committed file; it is stored in EAS Secrets and injected at build time via `app.config.js`
  4. App Store listing exists with metadata, screenshots, privacy policy URL, and build uploaded — ready for review submission at mid-October deadline
**Plans**: 2 plans

Plans:
- [ ] 02-01-PLAN.md — EAS build config: complete eas.json profiles, app.config.js with Mapbox token from EAS Secrets, token removed from app.json
- [ ] 02-02-PLAN.md — iOS production build, TestFlight distribution, App Store Connect listing metadata

### Phase 3: Push Notifications
**Goal**: VIIBE delivers real-time push alerts to scouts and merchants, making the "city's energy visible in real-time" value proposition tangible on a locked phone screen
**Depends on**: Phase 2
**Requirements**: NOTF-01, NOTF-02, NOTF-03, NOTF-04
**Success Criteria** (what must be TRUE):
  1. On first app launch after install, the OS push permission prompt appears; after granting permission, the user's Expo push token is stored on their server profile and survives app restart
  2. A merchant who sends a live blast from their dashboard triggers a push notification delivered to scouts within 2km of the venue within 30 seconds
  3. When a venue's vibe score drops below 50, the venue's merchant receives a push notification on their device
  4. A scout on a Transsion/Tecno/Infinix device (where FCM may be killed) can open the in-app notification center and see the last 20 notifications fetched from the server
**Plans**: 3 plans

Plans:
- [ ] 03-01-PLAN.md — Consolidate push token registration to single canonical path (POST /api/alerts/register)
- [ ] 03-02-PLAN.md — Geo-targeted live blast (2km radius) + automatic vibe-score-below-50 merchant alert
- [ ] 03-03-PLAN.md — Server-side notification inbox: db.notifications persistence, API, and NotificationsScreen

### Phase 4: Growth Loops
**Goal**: Scouts can spread VIIBE virally through WhatsApp and Instagram, and every new user who signs up via referral strengthens the scout network that drives the 300-active-scouts seed KPI
**Depends on**: Phase 2
**Requirements**: GROW-01, GROW-02, GROW-03
**Success Criteria** (what must be TRUE):
  1. A scout can tap "Invite" on their profile, generate a personal referral link, share it to WhatsApp in two taps, and both the referrer and new signup receive bonus clout points automatically when the new user completes signup
  2. Tapping a `viibe.app/invite/:code` link on a device with VIIBE installed opens the app directly (not the browser); on a device without the app installed, it opens the App Store / Play Store and preserves the referral code through install attribution
  3. A scout can share a Vibe Moment card (venue name + live score + scout handle) as an image directly to WhatsApp or Instagram Stories from the venue detail screen
**Plans**: TBD

Plans:
- [ ] 04-01: TBD

### Phase 5: Analytics + Merchant SaaS
**Goal**: Merchants have data-backed reasons to pay for the SaaS tier, the platform has a health dashboard for investor demos, and PostHog instruments real user behavior without polluting data with demo mode noise
**Depends on**: Phase 3, Phase 4
**Requirements**: ANAL-01, ANAL-02, ANAL-03
**Success Criteria** (what must be TRUE):
  1. A merchant on the paid SaaS tier can view their analytics dashboard showing: 7-day and 30-day avg vibe score trend, rating volume by hour of day, peak day of week, and unique scout count — all pre-computed, loading in under 2 seconds
  2. An admin can view the platform health dashboard showing: total MAU (30-day), DAU, active venues, active merchants, total ratings submitted, and estimated MRR
  3. The investor demo kit launches a curated in-app demo flow that showcases live venue intelligence, AI Oracle, Night Planner, VibeReactor, and merchant dashboard in sequence — functional at any time of day using demo mode data
**Plans**: TBD

Plans:
- [ ] 05-01: TBD

### Phase 6: Investor Deliverables
**Goal**: VIIBE is fundable — every artifact an investor or journalist needs exists, is accurate, and tells a coherent story from Lagos scene intelligence to global experience layer
**Depends on**: Phase 5
**Requirements**: INVT-01, INVT-02, INVT-03, INVT-04
**Success Criteria** (what must be TRUE):
  1. The Detty December War Room opens as a full-screen view showing all active Lagos venues sorted by live score, with real-time score animations, a scout activity feed, and a city-wide collective charge bar — screenshot quality at any time using demo data
  2. PITCH_DECK.md contains all Phase 1+2 features (VibeReactor, GlobalVibePill, Dual Home Mode, AI Oracle, Night Planner, Vibe DNA), current market research numbers (₦1.5T Lagos nightlife, PwC 8.6% CAGR), and a traction narrative matching actual seed milestone progress
  3. VIBEAPP_STRATEGY_BLUEPRINT.md reflects current feature inventory, the Detty December anchor strategy, the revised go-to-market timeline with App Store submission by mid-October 2026, and the exit path narrative
  4. docs/FINANCIAL_MODEL.md covers dual revenue streams (consumer Vibe+ at ₦2,000/month + merchant SaaS at ₦150,000/month), RevenueCat/Apple IAP billing architecture with Apple 15–30% cut caveat, and the seed milestone targets (300+ scouts, 5 paying merchants, 3 months retention data)
**Plans**: 3 plans

Plans:
- [ ] 06-01-PLAN.md — Detty December War Room screen with demo data (INVT-01)
- [ ] 06-02-PLAN.md — Update PITCH_DECK.md + VIBEAPP_STRATEGY_BLUEPRINT.md (INVT-02, INVT-03)
- [ ] 06-03-PLAN.md — Update docs/FINANCIAL_MODEL.md with dual revenue model and seed targets (INVT-04)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Billing Foundation | 0/3 | In progress | - |
| 2. EAS Build + Distribution | 0/2 | Not started | - |
| 3. Push Notifications | 0/3 | Not started | - |
| 4. Growth Loops | 0/TBD | Not started | - |
| 5. Analytics + Merchant SaaS | 0/TBD | Not started | - |
| 6. Investor Deliverables | 0/3 | Not started | - |
