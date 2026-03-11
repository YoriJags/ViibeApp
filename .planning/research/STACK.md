# Stack Research: VIIBE — Seed Milestone Additions

**Synthesized from:** Architecture research findings + known project constraints
**Date:** 2026-03-11
**Scope:** What to ADD to the existing fixed stack for the seed milestone

---

## Existing Stack (Fixed)

| Layer | Technology | Status |
|-------|-----------|--------|
| Frontend | React Native (Expo 54), Expo Router v5 | Live |
| State | Zustand v5 + AsyncStorage persist | Live |
| Backend | FastAPI (Python), Motor async MongoDB | Live |
| Realtime | Socket.IO (client + server) | Live |
| Payments | Paystack (Nigerian processor) | Live |
| AI | Claude API (Anthropic) — Night Planner + Oracle | Live |
| Sensors | expo-sensors (accelerometer) | Live |
| Deployment | Vercel (frontend) + Railway (backend) + MongoDB Atlas | Live |
| Reanimated | ~3.17.4 — PINNED, do NOT upgrade to v4.x | Live |

---

## Required Additions — Seed Milestone

### 1. Subscription Billing (Consumer — Vibe+)

**Recommendation: RevenueCat + expo-iap**

- **Why RevenueCat**: Manages entitlements across iOS (Apple IAP) and Android (Google Play Billing) from a single SDK. Free up to $2,500 MRR, then 1% of revenue.
- **Why NOT Paystack for iOS**: Apple App Store Guideline 3.1.1 — all in-app purchases of digital content/subscriptions MUST go through Apple IAP. Rejection is guaranteed. Nigerian developer accounts have been rejected for this explicitly.
- **Paystack remains**: For merchant SaaS (B2B/web) and web-based consumer subscriptions.
- **Version**: `react-native-purchases` 7.x (Expo 54 compatible)

### 2. EAS Build (App Store / Play Store)

**Blockers in current codebase**:
- `app.json` has placeholder `projectId` — run `eas init`
- No `eas.json` exists — must be created
- Must switch to EAS Development Build before billing work — Expo Go cannot run native payment modules

**Accounts needed**: Apple Developer ($99/year), Google Play ($25 one-time)

**Timeline**: 6-week lead time for first App Store submission. Submit by mid-October 2026 for Detty December.

### 3. Push Notifications

**Status: 80% built.** Missing:
1. Frontend `registerForPushNotificationsAsync()` on app launch
2. Backend `/api/users/push-token` endpoint
3. Real `projectId` in `app.json`

**Nigerian caveat**: Transsion/Tecno/Infinix (70%+ of Nigerian Android) aggressively kill background processes. Must build in-app notification center as FCM fallback.

### 4. Deep Linking + Referral

- Use `expo-linking` (built-in, no new packages)
- Self-built attribution: referral code → `/api/referrals/claim` → clout award
- Universal links via `app.json` `associatedDomains`

### 5. Merchant Analytics

- No new packages — use MongoDB `$merge` aggregation stage
- Pre-compute nightly via cron job → `venue_daily_stats` collection
- Never run live aggregation on dashboard load

---

## Monthly Cost Baseline (USD)

| Service | Cost |
|---------|------|
| Railway | $20 |
| Vercel | $20 |
| MongoDB Atlas M10 | $57 |
| Claude API | ~$15 |
| RevenueCat | $0 (free <$2,500 MRR) |
| Expo Push | $0 |
| Apple Developer | ~$8 (amortized) |
| **Total** | **~$120/mo** |

---

## Do NOT Add

| Technology | Reason |
|-----------|--------|
| Reanimated v4 | Requires worklets + Babel — breaks existing setup |
| Stripe | Not Nigeria-licensed |
| Firebase / Sentry / Segment | Overkill at seed stage |
| react-native-maps | High complexity; MockMap + Expo Location is sufficient |

---
*Written: 2026-03-11*
