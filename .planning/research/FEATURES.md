# Feature Landscape

**Domain:** Subscription billing, App Store launch, push notifications, analytics, deep linking for Nigeria-first venue intelligence app
**Researched:** 2026-03-11

## Table Stakes

Features users/merchants expect. Missing = product feels incomplete or unprofessional.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Subscription paywall (Vibe+) | Monetization is required for seed funding narrative | Medium | Paystack handles billing; you handle gating |
| iOS + Android native app | Web-only is not credible for a mobile-first product in Nigeria | Medium | EAS Build; most config already exists in app.json |
| Push notifications for venue updates | Users expect real-time alerts from a real-time app | Medium | expo-notifications already installed; need backend sending |
| Payment receipt / subscription status screen | Users must see what they're paying for and manage it | Low | Paystack provides manage_link per subscription |
| App Store listing (screenshots, description) | First impression for 90% of users | Low (design) | Not a code task but blocks submission |
| Deep link sharing (venue links) | WhatsApp is the primary sharing channel in Nigeria; links must work | Low | Expo Router handles this natively |

## Differentiators

Features that set VIIBE apart from a generic nightlife app adding subscriptions.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Merchant analytics dashboard (footfall, peak hours, persona breakdown) | Merchants pay for intelligence, not just listing | Medium | MongoDB aggregation from existing check-in data |
| Vibe surge push alerts ("Club X is peaking NOW") | No competitor does real-time crowd alerts in Nigeria | Medium | Combine Socket.IO surge detection with push notifications |
| Referral system with crew invites | Viral loop: scouts recruit scouts; critical for cold-start | Medium | Deep link + referral code tracking + reward logic |
| Feature flags for phased rollout | Ship Vibe+ to 10% of users first, iterate, then 100% | Low | PostHog feature flags (built-in with analytics) |
| Subscription-gated Oracle/Planner AI | Premium AI features drive conversion; free users get basic scores | Low | Gate existing features behind subscription check |
| Merchant live push blasts to followers | Merchants can push "Happy hour NOW" to opted-in users | Medium | Already built in backend; needs push notification delivery |

## Anti-Features

Features to explicitly NOT build at this stage.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| In-app payment form (custom card input) | PCI compliance nightmare; Paystack Checkout handles this | Use Paystack's hosted checkout page (redirect or WebView) |
| Self-hosted analytics (PostHog self-host) | Requires 4 vCPU / 16GB RAM server; maintenance burden | Use PostHog Cloud free tier |
| Firebase Dynamic Links | Deprecated by Google (Sept 2025) | Use Expo Router native deep linking + universal links |
| Stripe integration | Not licensed in Nigeria; Paystack is the correct processor | Paystack only until international expansion |
| Custom push notification service (skip Expo Push API) | Adds complexity managing FCM/APNs directly | Use Expo Push API which abstracts both platforms |
| Real-time merchant dashboard (WebSocket analytics) | Overkill; merchants check analytics daily not per-second | Pre-computed daily/weekly MongoDB aggregations |
| Complex referral tiers (multi-level) | MLM complexity; regulatory risk in Nigeria | Simple single-tier: invite friend, both get reward |

## Feature Dependencies

```
Apple Developer Account -> EAS Build iOS -> App Store Submission
Google Play Account -> EAS Build Android -> Play Store Submission
Firebase Project -> google-services.json -> Android Push Notifications
Paystack Plans Created -> Subscription Initialization -> Webhook Handler -> Subscription Status
Push Token Collection -> Push Notification Sending -> Merchant Live Blasts via Push
Custom Domain -> Universal Links -> Referral Deep Links
PostHog Account -> Analytics SDK Init -> Feature Flags -> Phased Vibe+ Rollout
```

## MVP Recommendation

Prioritize (in order):
1. **Paystack subscription billing** -- required for revenue narrative (seed funding)
2. **EAS Build + App Store submission** -- required for credibility and distribution
3. **Push notifications backend** -- required for real-time value proposition
4. **Deep linking for shares** -- required for organic growth (WhatsApp sharing)
5. **Analytics (PostHog)** -- required for investor metrics and phased rollout

Defer:
- Merchant analytics dashboard: Build after 5+ paying merchants (use MongoDB queries manually until then)
- Complex referral reward system: Start with simple tracking, add rewards after proving the loop works
- Session replay: PostHog supports it but enable only after App Store launch

## Sources

- Paystack subscription flow: https://paystack.com/docs/payments/subscriptions/
- EAS Build pricing: https://docs.expo.dev/build/introduction/
- Firebase Dynamic Links deprecation: confirmed deprecated September 2025
- PostHog feature flags: https://posthog.com/docs/libraries/react-native
