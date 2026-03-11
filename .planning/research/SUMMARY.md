# Project Research Summary

**Project:** VIIBE — Seed Milestone (Vibe+, App Store, Push, Analytics, Growth Loops)
**Domain:** Consumer subscription app with B2B SaaS tier, Nigeria-first mobile-first
**Researched:** 2026-03-11
**Confidence:** HIGH

## Executive Summary

VIIBE's core product is live and deployed. The seed milestone is not about building a new product — it is about layering monetization, distribution, and growth infrastructure onto a working real-time venue intelligence platform. The approach is to add Paystack subscription billing for consumer (Vibe+) and merchant (SaaS) tiers, ship native iOS and Android apps via EAS Build, connect push notifications end-to-end, and instrument PostHog analytics with feature flags for phased rollout. The entire milestone is additive; no existing architecture needs to change, and the dependency chain from FEATURES.md is concrete and ordered.

The most critical unresolved decision is the payment architecture for iOS: Paystack handles all billing on Android and web without issue, but Apple's App Store policy (Guideline 3.1.1) may require In-App Purchase for the Vibe+ consumer subscription. This is genuinely ambiguous for venue intelligence apps and cannot be fully resolved without submitting to App Review. The execution strategy is to build the Paystack flow first (works on Android and web immediately), launch Android to Play Store first, and keep RevenueCat + `react-native-purchases` 7.x ready as an iOS fallback. If Apple demands IAP, the cost is 15–30% of iOS subscription revenue, not a rewrite.

The top three execution risks are: (1) App Store rejection for Paystack paywall — potential 4–6 week review cycle delay; (2) Paystack webhook handler shipped without HMAC-SHA512 signature verification, enabling attackers to grant free subscriptions; (3) push notifications silently failing in EAS production builds due to missing `google-services.json` or `expo-notifications` plugin configuration. All three have deterministic prevention strategies that must be in place before any feature ships to production users.

---

## Key Findings

### Recommended Stack

The existing fixed stack (Expo 54 / FastAPI / MongoDB Atlas / Paystack / Claude API / Socket.IO) requires only targeted additions — no dependency rewrites. RevenueCat with `react-native-purchases` 7.x is the iOS IAP fallback; it is not needed if Apple approves external Paystack payments. PostHog Cloud free tier covers analytics and feature flags without infrastructure overhead. `exponent_server_sdk` (Python) enables the backend to send push notifications via Expo Push API without managing APNs/FCM directly. EAS Build (`eas.json` config) is a configuration task, not a new dependency. The `expo-notifications` package is already installed on the frontend.

**Core additions:**
- `react-native-purchases` (RevenueCat 7.x): iOS IAP fallback if Apple rejects Paystack — free under $2,500 MRR, no new infrastructure
- PostHog React Native SDK: event tracking + feature flags — required for phased Vibe+ rollout and investor-facing metrics
- EAS Build (`eas.json` config): required to run native payment modules and push notifications; Expo Go cannot execute either
- `exponent-server-sdk` (Python): backend push sending, handles APNs/FCM abstraction, chunking, and receipt checking
- MongoDB collections: `subscriptions`, `push_tokens`, `referral_codes`, `venue_analytics` — schemas fully defined in ARCHITECTURE.md

**Do NOT add:** Reanimated v4 (breaks existing Babel setup), Stripe (not Nigeria-licensed), Firebase Dynamic Links (deprecated September 2025), self-hosted PostHog (4 vCPU / 16GB RAM requirement), react-native-maps (MockMap + Expo Location is sufficient at seed stage).

Monthly cost baseline remains ~$120/month (Railway $20 + Vercel $20 + MongoDB Atlas M10 $57 + Claude API $15 + RevenueCat free + Expo Push free + Apple Developer ~$8 amortized). See `.planning/research/STACK.md` for full breakdown.

### Expected Features

The seed milestone requires a clean separation between what must ship for the funding narrative and what can wait. Revenue capability and organic growth loops are the two proof points for seed investors.

**Must have (table stakes):**
- Vibe+ subscription paywall — Oracle AI + Night Planner gating is the conversion hook; this is the revenue narrative
- iOS + Android native app — web-only is not credible for a mobile-first product in Nigeria; App Store presence signals legitimacy
- Subscription status screen (price, features, restore button) — Apple requires this UX; also builds user trust before charging
- Push notifications for venue updates — without push delivery, the real-time value proposition is theoretical only
- Deep link sharing (venue cards via WhatsApp) — WhatsApp is the primary sharing channel in Nigeria; links must open in-app
- Paystack subscription management (manage_link for cancellation/renewal) — required; no custom card input UI (PCI scope)

**Should have (differentiators for seed milestone):**
- Vibe surge push alerts ("Club X is peaking NOW") — no competitor does real-time crowd alerts in Nigeria; highest retention impact
- Referral system with clout rewards — scout growth is the seed KPI (300 active scouts); viral loop is the mechanism
- PostHog feature flags for phased Vibe+ rollout — ship to 10% first to iterate before 100% rollout
- Merchant live blast via push (backend already built) — connects existing backend rate-limited blast to push delivery pipeline
- Merchant analytics dashboard (footfall, peak hours, persona breakdown) — converts merchants from free to paid SaaS tier

**Defer to v2+:**
- Merchant analytics dashboard: build after 5+ paying merchants; manual MongoDB queries suffice until then
- Complex referral reward tiers: simple single-tier (invite friend, both get clout) is sufficient and avoids MLM regulatory risk
- Session replay in PostHog: enable only after App Store launch when real user volume is established
- Detty December War Room UI: plan architecture for it now, build the dedicated screen in October 2026

See `.planning/research/FEATURES.md` for full feature dependency graph.

### Architecture Approach

Five new components slot into the existing system without disrupting live infrastructure. The Paystack Webhook Handler is the most critical: it is the source of truth for subscription state and must be idempotent from day one because Paystack retries failed webhook deliveries and duplicate processing is guaranteed. The Subscription Middleware gates premium API routes at the FastAPI layer — subscription status is never trusted from the client Zustand store (UI gating only, not security). Push sends must be queued as FastAPI `BackgroundTasks` to avoid blocking API responses when a merchant blasts 1,000+ followers.

**Major new components:**
1. Paystack Webhook Handler — receives charge events, verifies HMAC-SHA512 signature, stores `event.id` for idempotency, writes to `subscriptions` collection
2. Subscription Middleware — `require_subscription()` FastAPI dependency on premium routes; checks `subscriptions` collection against current UTC time
3. Push Notification Service — registers tokens on every app cold start, sends via Expo Push API in chunks of 100, prunes stale tokens on `DeviceNotRegisteredError`
4. Analytics Layer — PostHog client-side with `isDemoMode` guard; MongoDB `$merge` aggregation for merchant analytics (nightly cron, not live query on dashboard load)
5. Deep Link Router — Expo Router handles scheme routing natively; backend validates referral codes at `/api/referrals/claim`; `apple-app-site-association` + `assetlinks.json` hosted at `/.well-known/` on domain

See `.planning/research/ARCHITECTURE.md` for full data flow diagrams, MongoDB collection schemas with indexes, and anti-patterns to avoid.

### Critical Pitfalls

1. **App Store rejection for Paystack paywall** — Apple may require In-App Purchase under Guideline 3.1.1. Prevention: Frame Vibe+ as a real-world venue service. Prepare RevenueCat IAP fallback before submission. Launch Android first while Apple review resolves. Apple cannot be pre-answered definitively — submit and respond.

2. **Paystack webhook signature verification skipped** — Attackers send fake `charge.success` events, granting free Vibe+ accounts. Prevention: HMAC-SHA512 verification against `x-paystack-signature` header must be the first line of every webhook handler, wired in before any real traffic.

3. **Kobo/Naira amount confusion** — `amount=2000` creates a plan charging 20 NGN, not 2,000 NGN. Prevention: All plan amounts defined as named constants with `_kobo` suffix (`VIBE_PLUS_MONTHLY_KOBO = 200_000`). Verify in Paystack test dashboard before going live.

4. **Push notifications silently fail in EAS production builds** — Works in Expo Go dev, breaks in production due to missing `expo-notifications` plugin in `app.json`, missing `google-services.json` for Android, or wrong `credentialsSource`. Prevention: Build `preview` profile and test on a real physical device before production release.

5. **Universal links open browser instead of app** — Missing or misconfigured `apple-app-site-association` / `assetlinks.json` breaks referral links. Prevention: Host both files at `/.well-known/` on the domain, validate with Apple AASA tool, test on a fresh install (iOS verifies at install time, not at tap time — users must reinstall after fixing).

**Bonus — act immediately:** Mapbox `RNMapboxMapsDownloadToken` is currently committed to the public repo in `app.json`. Move to EAS Secrets via `app.config.js` before the first EAS Build.

See `.planning/research/PITFALLS.md` for the full catalogue of 14 pitfalls with phase-specific warnings.

---

## Implications for Roadmap

Based on the dependency graph in FEATURES.md and component patterns in ARCHITECTURE.md, the seed milestone decomposes into five phases ordered strictly by dependency and risk surface area.

### Phase 1: Billing Foundation
**Rationale:** The Apple IAP question must be researched and the webhook handler must be secure before any other phase can safely ship premium features. Revenue infrastructure is also the primary seed funding proof point — it should exist before other milestone features are demonstrated to investors.
**Delivers:** Paystack plans created (`VIBE_PLUS_MONTHLY_KOBO` constant, plan codes in env vars), webhook handler with HMAC verification and idempotency, `subscriptions` MongoDB collection + indexes, `require_subscription()` FastAPI middleware, subscription status screen in-app (price, features, cancel link via `manage_link`), Oracle AI + Night Planner gated behind subscription check, preliminary Apple external payment policy research.
**Addresses:** Vibe+ paywall, subscription status screen, payment receipt (FEATURES.md table stakes).
**Avoids:** Pitfalls 2 (webhook forgery), 3 (Kobo/Naira), 10 (test vs live key confusion).
**Research flag:** NEEDS research — Apple external payment policy for venue intelligence is ambiguous. Review Guideline 3.1.1 exemptions; consider contacting App Review via Resolution Center before submission.

### Phase 2: EAS Build + Store Submission
**Rationale:** Native builds are required before push notifications can be tested on real devices. Building early also surfaces credential and Mapbox token issues with enough lead time to fix them. The 6-week App Store review cycle means submission must happen by mid-October 2026 at the latest for Detty December. This phase has a hard calendar deadline, not just a dependency deadline.
**Delivers:** `eas.json` with development/preview/production profiles, Apple Developer and Google Play accounts configured, Mapbox token moved to EAS Secrets, `app.json` `projectId` populated via `eas init`, TestFlight beta live, App Store listing (metadata, screenshots, description, privacy policy URL), Google Play internal test track live.
**Addresses:** iOS + Android native app, App Store listing (FEATURES.md table stakes).
**Avoids:** Pitfalls 1 (App Store rejection — prepare IAP fallback), 4 (push failure in EAS — configure credentials correctly), 8 (Mapbox token invalid at build time), 13 (queue wait times — build early), 14 (token exposed in repo).
**Research flag:** SKIP research-phase — EAS Build is well-documented with established patterns.

### Phase 3: Push Notifications End-to-End
**Rationale:** Depends on EAS Build completing (Expo Go cannot run native push modules). Once builds are confirmed working, this is a contained backend task: token collection, push service, and surge trigger integration. Unlocks merchant live blasts via push and vibe surge alerts — both of which are differentiator features for the seed pitch.
**Delivers:** `push_tokens` collection + indexes, `/api/users/push-token` registration endpoint called on every app cold start, push notification service with `BackgroundTasks` queue and 100-token chunking, `DeviceNotRegisteredError` handling pruning stale tokens, vibe surge push alerts wired to existing surge detection, merchant live blasts connected to push delivery pipeline, in-app notification center (fallback for Transsion/Tecno/Infinix devices).
**Addresses:** Push notifications for venue updates, vibe surge alerts, merchant live blasts (FEATURES.md table stakes + differentiators).
**Avoids:** Pitfalls 4 (silent push failure in EAS), 7 (token expiration), anti-pattern 3 (tokens stored without user_id), anti-pattern 4 (synchronous push sends blocking API responses).
**Research flag:** SKIP research-phase — Expo Push API + FastAPI BackgroundTasks is a well-documented pattern.

### Phase 4: Growth Loops (Referral + Deep Links)
**Rationale:** Scout growth (300 active scouts) is the primary seed milestone KPI. Referral system depends on deep linking, which depends on EAS Build and a verified custom domain. Sequenced after builds are confirmed to avoid debugging universal link configuration without real installed builds to test against.
**Delivers:** `referral_codes` collection + indexes, referral code generation for each user, `/api/referrals/claim` endpoint crediting clout to referrer, frontend referral share flow (WhatsApp-optimized), `viibe.app/invite/[code]` web landing page with App Store link, `apple-app-site-association` + `assetlinks.json` hosted at `/.well-known/` on domain, `associatedDomains` in `app.json`, universal link verification tested on fresh install of real device.
**Addresses:** Referral system with crew invites, deep link sharing (FEATURES.md differentiators).
**Avoids:** Pitfall 5 (universal links opening browser), Pitfall 11 (Android back button behavior on deep link entry), anti-feature (multi-level MLM referral complexity).
**Research flag:** SKIP research-phase — Expo Router deep linking documentation is complete and authoritative.

### Phase 5: Analytics + Merchant SaaS Tier
**Rationale:** Analytics are additive — PostHog instrumentation is meaningless before real users exist. Placed last so the first real data captured is from production launch, not from development noise. Merchant SaaS paywall requires analytics to measure merchant conversion, and merchant analytics dashboard gives merchants a reason to pay.
**Delivers:** PostHog SDK initialized with `isDemoMode` guard (no tracking in demo mode), core event taxonomy instrumented (`venue.viewed`, `vibe.rated`, `subscription.started`, `referral.shared`, `notification.tapped`), PostHog feature flags for phased Vibe+ rollout (10% cohort first), `venue_analytics` collection with nightly `$merge` aggregation cron job, merchant analytics dashboard screen (footfall, peak hours, persona breakdown, follower count, heading intents), Merchant SaaS Paystack plan + paywall, merchant onboarding flow (Admin-led venue creation).
**Addresses:** Merchant analytics dashboard, feature flags for phased rollout, Merchant SaaS tier, admin analytics (FEATURES.md).
**Avoids:** Pitfall 9 (demo mode analytics pollution), Pitfall 12 (PostHog autocapture volume — disable autocapture, track explicit events only), anti-pattern (real-time WebSocket merchant analytics).
**Research flag:** SKIP research-phase for PostHog SDK. NEEDS research for Merchant SaaS pricing strategy — no data exists on price sensitivity for Nigerian venue owners. Conduct 3–5 merchant interviews before locking Phase 5 execution.

### Phase Ordering Rationale

- Billing before builds: Apple's stance on Paystack payments determines whether one build path (Paystack everywhere) or two (Paystack on Android, IAP on iOS) are needed. Getting this wrong mid-submission forces a payment flow rewrite under time pressure.
- Builds before push: Hard technical dependency — Expo Go cannot run native push modules. No workaround.
- Push before growth loops: Referral value compounds when the referrer gets a push notification when their crew member signs up. Also, growth loops require a working app to install.
- Analytics last: No real users, no meaningful data. Instrumentation before launch collects development noise and inflates PostHog quotas.

### Research Flags

Phases needing deeper research during planning:
- **Phase 1 (Billing Foundation):** Apple external payment policy for venue intelligence apps is ambiguous. Research Guideline 3.1.1 exemptions — specifically whether real-world venue discovery qualifies as a service-consumption app. Contact App Review via Resolution Center before iOS submission. If Apple demands IAP, have RevenueCat integration scoped and ready to build.
- **Phase 5 (Merchant SaaS):** Merchant pricing — what features and price points convert Nigerian venue owners to paid tiers. No research data exists. Recommend 3–5 merchant interviews before locking Phase 5 scope.

Phases with standard patterns (skip research-phase):
- **Phase 2 (EAS Build):** Expo documentation is authoritative and complete for this stack.
- **Phase 3 (Push Notifications):** Expo Push API + FastAPI BackgroundTasks is a well-worn pattern with no ambiguity.
- **Phase 4 (Deep Links):** Expo Router universal links documentation covers the full configuration process.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Existing stack is live in production; additions are targeted and version-verified. RevenueCat 7.x confirmed Expo 54 compatible. |
| Features | HIGH | Table stakes validated against App Store requirements and Nigerian market context. Dependency graph is concrete and executable. |
| Architecture | HIGH | Data flow patterns (webhook idempotency, subscription middleware, push chunking, nightly analytics aggregation) are standard patterns with clear FastAPI implementation paths. MongoDB schemas are production-ready with indexes specified. |
| Pitfalls | MEDIUM | Apple IAP policy dispute (Pitfalls 1 and 6) is genuinely uncertain — outcome depends on Apple's reviewer interpretation. All other pitfalls have deterministic prevention strategies. |

**Overall confidence: HIGH**

### Gaps to Address

- **Apple external payment eligibility:** The single largest open question in the milestone. Cannot be fully resolved without an App Review submission or direct contact with App Review. Mitigation: prepare RevenueCat IAP fallback in parallel with Paystack flow; launch Android first; use App Review Contact form before iOS submission.
- **Merchant SaaS pricing:** No research data on price sensitivity for Nigerian venue owners. Must be validated through merchant interviews before Phase 5 execution — not during or after.
- **Transsion/Tecno/Infinix push reliability:** These devices represent 70%+ of Nigerian Android market and aggressively kill background processes. Push delivery rates will likely be lower than global benchmarks. Mitigation: build in-app notification center as FCM fallback during Phase 3; track push delivery receipts via Expo Push API receipt endpoint; instrument delivery rate as a PostHog metric.
- **Detty December calendar constraint:** 6-week App Store review lead time means Phase 2 submission must occur by mid-October 2026. This is a hard calendar deadline. Phase 1 and Phase 2 must complete by early October.
- **Custom domain:** `viibe.app` or `viibe.ng` is not yet purchased. Required for universal links in Phase 4. Purchase and DNS setup should happen during Phase 2 to avoid blocking Phase 4.
- **EAS project ID placeholder:** `app.json` currently has `"projectId": "your-eas-project-id"`. Run `eas init` at the start of Phase 2 to populate this.

---

## Sources

### Primary (HIGH confidence)
- Paystack subscription API: https://paystack.com/docs/payments/subscriptions/
- Paystack webhook security: https://paystack.com/docs/payments/webhooks/
- Expo Push Notifications setup: https://docs.expo.dev/push-notifications/push-notifications-setup/
- Expo Push API sending: https://docs.expo.dev/push-notifications/sending-notifications/
- EAS Build introduction: https://docs.expo.dev/build/introduction/
- Expo Router deep linking: https://docs.expo.dev/linking/into-your-app/
- Apple AASA documentation: https://developer.apple.com/documentation/bundleresources/applinks
- Apple App Store Review Guidelines (subscriptions): https://developer.apple.com/app-store/review/guidelines/#subscriptions
- Firebase Dynamic Links deprecation: confirmed deprecated September 2025

### Secondary (MEDIUM confidence)
- PostHog React Native SDK: https://posthog.com/docs/libraries/react-native — feature flags and autocapture configuration confirmed
- RevenueCat Expo 54 compatibility: `react-native-purchases` 7.x confirmed compatible with Expo 54 / React Native 0.76
- EAS Build pricing: free tier confirmed at $0 for limited builds per month; production plan at $99/month for priority queue

### Tertiary (LOW confidence)
- Apple IAP exemption for venue intelligence apps: no confirmed precedent found; based on inference from "reader app" and "real-world service consumption" exemption categories — must be validated with App Review before iOS submission
- Nigerian merchant SaaS pricing benchmarks: no direct research data; requires primary research (merchant interviews) before Phase 5 execution
- Transsion/Tecno/Infinix push delivery rates: 70%+ Nigerian Android market share figure is from device market share data; actual push delivery rates on these devices require empirical measurement post-launch

---
*Research completed: 2026-03-11*
*Ready for roadmap: yes*
