# Domain Pitfalls

**Domain:** Subscription billing, App Store launch, push notifications, analytics, deep linking (Nigeria-first Expo app)
**Researched:** 2026-03-11

## Critical Pitfalls

Mistakes that cause rewrites, store rejections, or revenue loss.

### Pitfall 1: App Store Rejection for Incomplete Paywall
**What goes wrong:** Apple rejects apps that gate features behind a paywall without clearly explaining what the subscription includes, offering a free trial, or providing a restore purchases button.
**Why it happens:** Apple's App Store Review Guidelines (3.1.2) require subscription apps to clearly display pricing, duration, and a way to manage/restore subscriptions.
**Consequences:** Weeks of review ping-pong. Delayed launch.
**Prevention:**
- Include a clear subscription description screen (what you get, price, duration)
- Add "Restore Purchases" button (even though Paystack handles billing, not IAP -- Apple may still expect this UX pattern)
- Important: VIIBE uses Paystack (external payment), NOT Apple In-App Purchase. Apple allows this for "reader" apps and apps where the purchase is for physical goods/services consumed outside the app. Venue intelligence arguably falls under this since the "product" is real-world venue visits. However, Apple may disagree and demand IAP for digital content. Research Apple's external payment rules for your specific case before submission.
**Detection:** First App Store review submission. Test with TestFlight first.

### Pitfall 2: Paystack Webhook Signature Verification Skipped
**What goes wrong:** Attacker sends fake webhook events to your endpoint, granting free subscriptions.
**Why it happens:** Developer skips HMAC-SHA512 verification during development and forgets to add it for production.
**Consequences:** Revenue loss, fake premium accounts.
**Prevention:**
```python
import hmac, hashlib
expected = hmac.new(
    PAYSTACK_SECRET.encode('utf-8'),
    request_body,
    hashlib.sha512
).hexdigest()
actual = request.headers.get('x-paystack-signature')
if not hmac.compare_digest(expected, actual):
    return JSONResponse({"error": "invalid signature"}, status_code=400)
```
**Detection:** Subscriptions appearing without corresponding Paystack dashboard records.

### Pitfall 3: Kobo vs Naira Amount Confusion
**What goes wrong:** Creating a plan with amount=2000 (meaning 2000 kobo = 20 NGN) instead of 200000 (meaning 2000 NGN).
**Why it happens:** Paystack uses kobo (smallest currency unit), like Stripe uses cents. Easy to forget the x100 multiplier.
**Consequences:** Charging users 1/100th of intended price, or 100x the intended price.
**Prevention:** Define plan amounts as constants with clear naming: `VIBE_PLUS_MONTHLY_KOBO = 200_000  # 2,000 NGN`. Always suffix variable names with `_kobo`.
**Detection:** Test mode transactions before going live. Compare Paystack dashboard amounts to expected prices.

### Pitfall 4: Push Notifications Not Working After EAS Build
**What goes wrong:** Push notifications work in development but fail in production builds.
**Why it happens:** Missing `expo-notifications` in `app.json` plugins array, or missing `google-services.json` for Android FCM, or missing APNs configuration.
**Consequences:** Users never receive notifications. Merchant live blasts are silent.
**Prevention:**
1. Add `expo-notifications` to plugins in `app.json`
2. Add `google-services.json` to project root for Android
3. Use `credentialsSource: "remote"` in `eas.json` (EAS manages APNs keys)
4. Test push on a REAL DEVICE with a production build profile (not Expo Go, not simulator)
**Detection:** Build a `preview` profile, install on real device, send test push.

### Pitfall 5: Universal Links Not Verified
**What goes wrong:** Deep links open in the browser instead of the app.
**Why it happens:** Missing or misconfigured `apple-app-site-association` / `assetlinks.json` files on the web domain, or `associatedDomains` not set in `app.json`.
**Consequences:** Referral links don't open the app. Users bounce to a website instead of the app.
**Prevention:**
1. Host verification files at `/.well-known/` on your domain
2. Test with Apple's AASA validator and Android's digital asset links tool
3. Universal link verification happens at app INSTALL time on iOS -- users must reinstall after fixing
**Detection:** Test deep links on a fresh install on a real device. Use `npx uri-scheme` to test custom scheme links.

## Moderate Pitfalls

### Pitfall 6: Apple IAP vs External Payment Dispute
**What goes wrong:** Apple demands you use In-App Purchase instead of Paystack for Vibe+ subscription.
**Prevention:** Frame Vibe+ as a service for discovering real-world venues (not digital content consumption). If Apple insists on IAP, you will need `react-native-iap` as a fallback -- but this means Apple takes 15-30% of subscription revenue. Consider launching on Android (Play Store) first while navigating Apple review.

### Pitfall 7: Expo Push Token Expiration
**What goes wrong:** Stored push tokens become invalid, notifications silently fail.
**Prevention:** Re-register push token on every app launch (not just first launch). Handle `DeviceNotRegisteredError` from Expo Push API by deleting the stale token from your database.

### Pitfall 8: EAS Build Fails Due to Mapbox Token
**What goes wrong:** `@rnmapbox/maps` requires a download token at build time. If the token in `app.json` is invalid or expired, EAS Build fails.
**Prevention:** Verify the Mapbox download token (`sk.eyJ1...`) is still valid before triggering builds. Move it to EAS Secrets for better security (the current token is visible in app.json in the repo).

### Pitfall 9: Analytics Noise from Demo Mode
**What goes wrong:** PostHog collects events from demo mode usage, polluting real user metrics.
**Prevention:** Check `isDemoMode` before tracking events. Or use PostHog `opt_out_capturing()` when demo mode is active.

### Pitfall 10: Paystack Test vs Live Key Confusion
**What goes wrong:** Shipping production app with test Paystack keys, or testing with live keys.
**Prevention:** Use environment variables. Railway should have `PAYSTACK_SECRET_KEY` set to live key. Local dev uses `.env` with test key. Never hardcode keys.

## Minor Pitfalls

### Pitfall 11: Android Back Button Behavior with Deep Links
**What goes wrong:** User opens deep link, taps back, and app exits instead of going to home.
**Prevention:** In the deep link handler screen, detect if there is no navigation history and redirect to home first, then to the target screen.

### Pitfall 12: PostHog Event Volume Exceeding Free Tier
**What goes wrong:** Autocapture generates more events than expected, exceeding 1M/month.
**Prevention:** Disable autocapture initially. Track only explicit events you define. Enable autocapture only after understanding your event volume.

### Pitfall 13: EAS Build Queue Wait Times
**What goes wrong:** Free tier builds can take 30-60 minutes in queue during peak times.
**Prevention:** Plan builds ahead of deadlines. Use `--local` flag for urgent builds if you have a Mac available (iOS only). Consider Expo production plan ($99/month) closer to launch.

### Pitfall 14: Mapbox Token Exposed in Public Repo
**What goes wrong:** The `RNMapboxMapsDownloadToken` in `app.json` is a secret key committed to the repo.
**Prevention:** Move to EAS Secrets or environment variable. Use `app.config.js` (dynamic config) instead of `app.json` to read from env vars.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Paystack subscription setup | Kobo/Naira confusion, webhook forgery | Constants with _kobo suffix, HMAC verification on day 1 |
| EAS Build first attempt | Missing credentials, Mapbox token issues | Run `eas build --profile preview` early to surface issues |
| App Store submission | Apple IAP policy dispute, metadata rejection | Research Apple external payment policy; prepare IAP fallback |
| Push notifications | Silent failure on production builds | Test on real device with preview build before production |
| Deep linking | Universal links not opening app | Host AASA/assetlinks on domain, test on fresh install |
| Analytics | Demo mode pollution, event volume | Gate tracking on isDemoMode, disable autocapture |
| Merchant analytics | Expensive MongoDB queries on large datasets | Pre-compute daily aggregations, index venue_id + date |

## Sources

- Apple App Store Review Guidelines (subscriptions): https://developer.apple.com/app-store/review/guidelines/#subscriptions
- Paystack webhook security: https://paystack.com/docs/payments/subscriptions/
- Expo push troubleshooting: https://docs.expo.dev/push-notifications/push-notifications-setup/
- Apple AASA documentation: https://developer.apple.com/documentation/bundleresources/applinks
- EAS Build: https://docs.expo.dev/build/introduction/
