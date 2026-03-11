# Architecture Patterns

**Domain:** Stack additions for subscription, push, analytics, deep linking, App Store
**Researched:** 2026-03-11

## Recommended Architecture (Additions to Existing System)

### New Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| Paystack Webhook Handler | Receives + verifies Paystack events, updates subscription state in MongoDB | MongoDB (subscriptions collection), Expo Push (payment notifications) |
| Subscription Middleware | Gates premium features (Oracle AI, Night Planner, etc.) based on user subscription status | MongoDB (subscriptions), existing route handlers |
| Push Notification Service | Manages push tokens, sends notifications via Expo Push API | MongoDB (push_tokens), Expo Push API (https://exp.host/--/api/v2/push/send) |
| Analytics Layer | PostHog client-side tracking + MongoDB server-side merchant analytics | PostHog Cloud, MongoDB (venue_analytics) |
| Deep Link Router | Handles incoming universal links, routes to correct screen | Expo Router (automatic), Backend (referral code validation) |

### Data Flow: Subscription Lifecycle

```
User taps "Subscribe to Vibe+"
  -> Frontend opens Paystack Checkout (WebView or redirect)
  -> Paystack processes card charge
  -> Paystack sends charge.success webhook to backend
  -> Backend verifies HMAC signature
  -> Backend creates/updates subscription record in MongoDB
  -> Backend sends Socket.IO event to frontend ("subscription_activated")
  -> Frontend updates Zustand store (user.subscription = active)
  -> Premium features unlocked
```

### Data Flow: Push Notification (Merchant Live Blast)

```
Merchant taps "Send Live Blast" in dashboard
  -> Backend validates merchant + rate limit (30 min cooldown, already exists)
  -> Backend queries push_tokens for users following this venue
  -> Backend chunks tokens (max 100 per Expo Push API request)
  -> Backend sends via exponent_server_sdk to Expo Push API
  -> Expo routes to APNs (iOS) / FCM (Android)
  -> User receives native push notification
  -> User taps notification -> deep links to venue detail screen
```

### Data Flow: Referral Deep Link

```
User A generates referral link: https://viibe.app/invite/ABC123
  -> User A shares on WhatsApp
  -> User B taps link
    -> If app installed: Expo Router opens /invite/ABC123 screen
    -> If not installed: Web page at viibe.app/invite/ABC123 shows App Store link
  -> /invite/ABC123 screen stores referral code in AsyncStorage
  -> On signup, backend records referral_code -> credits referrer
```

## New MongoDB Collections

```
subscriptions: {
  _id: ObjectId,
  user_id: ObjectId (indexed),
  paystack_subscription_code: String,
  paystack_customer_code: String,
  plan_code: String,  // "vibe_plus_monthly", "merchant_basic", etc.
  status: "active" | "cancelled" | "past_due" | "expired",
  current_period_start: ISODate,
  current_period_end: ISODate,
  cancel_at_period_end: Boolean,
  authorization_code: String,  // for card reference
  created_at: ISODate,
  updated_at: ISODate
}

push_tokens: {
  _id: ObjectId,
  user_id: ObjectId (indexed),
  token: String (unique, indexed),
  platform: "ios" | "android",
  created_at: ISODate,
  last_used: ISODate
}

referral_codes: {
  _id: ObjectId,
  code: String (unique, indexed),
  referrer_id: ObjectId (indexed),
  created_at: ISODate,
  uses: [{ user_id: ObjectId, used_at: ISODate }],
  max_uses: Number (default: 50)
}

venue_analytics: {
  _id: ObjectId,
  venue_id: ObjectId (indexed),
  date: ISODate (indexed),
  period: "daily" | "weekly",
  metrics: {
    checkins: Number,
    unique_visitors: Number,
    avg_vibe_score: Number,
    peak_hour: Number,
    heading_intents: { enroute: Number, maybe: Number, pass: Number },
    top_personas: [{ persona: String, count: Number }],
    follower_count: Number
  }
}
```

**Indexes:**
```
subscriptions: { user_id: 1 }, { paystack_subscription_code: 1 }
push_tokens: { user_id: 1 }, { token: 1 (unique) }
referral_codes: { code: 1 (unique) }, { referrer_id: 1 }
venue_analytics: { venue_id: 1, date: -1 }, { venue_id: 1, period: 1 }
```

## Patterns to Follow

### Pattern 1: Webhook Idempotency
**What:** Every Paystack webhook handler must be idempotent -- processing the same event twice should produce the same result.
**When:** Always, for all webhook events.
**Why:** Paystack retries failed webhook deliveries. Network issues can cause duplicate delivery.
**Implementation:** Store `event.id` from webhook payload. Check if already processed before acting.

### Pattern 2: Subscription Status as Middleware
**What:** Check subscription status at the route level, not inside business logic.
**When:** Any premium-gated endpoint.
**Implementation:**
```python
async def require_subscription(request):
    user_id = get_user_from_token(request)
    sub = await db.subscriptions.find_one({
        "user_id": user_id,
        "status": "active",
        "current_period_end": {"$gt": datetime.utcnow()}
    })
    if not sub:
        return JSONResponse({"error": "subscription_required"}, status_code=403)
```

### Pattern 3: Push Token Lifecycle
**What:** Register push token on app launch, deregister on DeviceNotRegistered error.
**When:** Every app cold start (frontend) and every push send failure (backend).
**Why:** Tokens become invalid when users uninstall, change devices, or revoke permissions.

### Pattern 4: Analytics Event Naming Convention
**What:** Use `object.action` format for PostHog events.
**When:** All tracked events.
**Examples:** `venue.viewed`, `vibe.rated`, `subscription.started`, `referral.shared`, `notification.tapped`

## Anti-Patterns to Avoid

### Anti-Pattern 1: Checking Subscription Client-Side Only
**What:** Trusting frontend Zustand store for subscription status.
**Why bad:** Users can manipulate local storage. Premium features leak.
**Instead:** Always verify subscription on the backend for premium API endpoints. Frontend status is for UI gating only (show/hide paywall), not security.

### Anti-Pattern 2: Polling Paystack for Subscription Status
**What:** Periodically calling Paystack API to check if subscription is still active.
**Why bad:** Unnecessary API calls, rate limiting risk, latency.
**Instead:** Use webhooks. Paystack pushes status changes to you. Your MongoDB is the source of truth after webhook processing.

### Anti-Pattern 3: Storing Push Tokens Without User Association
**What:** Saving push tokens without linking to user_id.
**Why bad:** Cannot target notifications to specific users (e.g., venue followers).
**Instead:** Always store (user_id, token) pair. Update on every app launch.

### Anti-Pattern 4: Sending All Pushes Synchronously
**What:** Blocking the API response while sending push notifications.
**Why bad:** Merchant live blast to 1000 followers takes seconds; request times out.
**Instead:** Queue push sends as background tasks. FastAPI `BackgroundTasks` or a simple asyncio task.

## Sources

- Paystack webhook verification: https://paystack.com/docs/payments/subscriptions/
- Expo Push API chunking: https://docs.expo.dev/push-notifications/sending-notifications/
- Expo Router deep linking: https://docs.expo.dev/linking/into-your-app/
