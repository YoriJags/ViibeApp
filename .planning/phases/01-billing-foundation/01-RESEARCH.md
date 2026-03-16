# Phase 1: Billing Foundation - Research

**Researched:** 2026-03-11
**Domain:** Subscription billing — Paystack subscriptions, RevenueCat IAP, FastAPI webhook handling, MongoDB subscription state, React Native paywall UX
**Confidence:** HIGH (backend billing infrastructure is 70% built; gaps are well-defined)

---

## Summary

The VIIBE billing foundation splits into two distinct billing paths: (1) consumer Vibe+ subscriptions for scouts (₦2,000/month), and (2) merchant SaaS subscriptions plus Pulse Drop boosts (₦150,000/month + à-la-carte boost purchases). These two paths share the Paystack webhook handler and MongoDB subscription state but differ significantly in their payment mechanism.

Critically, the codebase audit reveals that the Paystack consumer Vibe+ flow is substantially built — `subscriptions.py`, `webhooks.py`, `payments.py`, and `VibePlusModal.tsx` all exist and work for the web/Android Paystack path. The current price is hardcoded as ₦1,500 in both the UI and the DB constant `DEFAULT_PRICE_KOBO = 150000` — this must be updated to ₦2,000 (200,000 kobo) to match BILL-01. The Oracle Premium route is already gated behind `_check_vibe_plus()`. The Night Planner route is NOT yet gated. RevenueCat (iOS/Android native) integration is zero percent built. The merchant SaaS subscription (₦150,000/month auto-renewing Paystack plan) is entirely absent — the current merchant route only handles wallet top-ups and Pulse Drop spends, not a recurring SaaS subscription. Pulse Drop purchases currently lack any check for an active SaaS subscription (BILL-04 gap).

**Primary recommendation:** Build in this order — (1) fix Vibe+ price, gate Night Planner, add free trial state; (2) create Paystack Plan for merchant SaaS and implement merchant subscription routes + webhook handling; (3) add SaaS subscription gate on Pulse Drop purchases; (4) add RevenueCat as the iOS native layer over the existing Paystack web flow (RevenueCat can be deferred to Phase 2 EAS build but the architecture must be planned now).

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BILL-01 | Scout can subscribe to Vibe+ via RevenueCat (Apple IAP iOS, Google Play Billing Android, Paystack web) for ₦2,000/month; Oracle AI + Night Planner unlock immediately | Paystack web path exists; price needs update to 200,000 kobo; Night Planner gate missing; RevenueCat layer needs adding for iOS/Android |
| BILL-02 | New Vibe+ subscriber sees 7-day free trial before first charge; subscription status screen shows trial end date, feature list, cancel link | Paystack supports trial periods via plan `invoice_limit` + delayed start; current UI has no trial state; need `trial_ends_at` field + status screen |
| BILL-03 | Merchant SaaS subscription via Paystack at ₦150,000/month with auto-renewing billing; survives browser refresh + backend restart | Paystack Plan API with monthly interval handles auto-renewal; need new `merchant_subscriptions` collection + routes; webhook must handle `subscription.create` + `invoice.payment_failed` |
| BILL-04 | Merchant can buy Pulse Drop boosts only after active SaaS subscription; blocked with upsell prompt if no subscription | `purchase_pulse_drop` in `pulse_drops.py` has no SaaS gate; need `require_merchant_saas()` check before wallet deduction |
</phase_requirements>

---

## Standard Stack

### Core (all already in project)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `httpx` | 0.28.1 | Paystack API calls (async) | Already used throughout; supports async/await |
| `motor` | 3.6.0 | MongoDB async driver | Project standard; subscription docs stored in Atlas |
| `fastapi` | 0.115.5 | Route handlers + middleware | Project standard |
| `hmac` / `hashlib` | stdlib | Paystack HMAC-SHA512 signature verification | Already implemented in `payments.py` |

### New Additions for This Phase

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `react-native-purchases` | latest (^8.x) | RevenueCat SDK — Apple IAP + Google Play entitlements | iOS + Android native builds only (Phase 2 EAS builds) |
| `react-native-purchases-ui` | latest (^8.x) | RevenueCat pre-built paywall UI | Pairs with react-native-purchases; optional but accelerates iOS paywall |
| `expo-web-browser` | already installed | Paystack checkout on web + Android fallback | Already used in VibePlusModal.tsx |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Paystack Plan API (auto-renew) | Manual charge + cron renewal | Paystack Plan API is correct: Paystack handles retry logic, sends webhooks on renewal, manages billing dates. Manual cron = fragile, no card retry. |
| RevenueCat (iOS) | Stripe / custom IAP | Apple 3.1.1 mandates IAP for digital subscriptions on iOS. RevenueCat wraps StoreKit 2 and handles receipt validation. No alternative. |
| Paystack subscription for merchant | Stripe | Stripe is not Nigeria-licensed. Paystack is the only option. |

**Installation (RevenueCat — defer to Phase 2 EAS build):**
```bash
npx expo install react-native-purchases react-native-purchases-ui
```

---

## What Already Exists (Critical Codebase Facts)

This section prevents re-building what is already done.

### Backend — Fully Built
- `backend/app/services/payments.py` — `verify_paystack_signature()` using HMAC-SHA512 (stdlib `hmac`). Already handles the `if not PAYSTACK_SECRET_KEY: return True` dev-mode bypass.
- `backend/app/routes/webhooks.py` — `POST /api/webhook/paystack`: verifies signature, routes `charge.success` by reference prefix (`VIBE-TOPUP-` → wallet, `VIBE-PLUS-` → subscription). This is the single webhook endpoint.
- `backend/app/routes/subscriptions.py` — Full Vibe+ consumer flow: `POST /api/subscription/initialize`, `POST /api/subscription/verify/{reference}`, `GET /api/subscription/status`. Includes `_check_vibe_plus()` helper and `_apply_subscription()`. Uses `pending_subscriptions` collection with atomic claim pattern.
- `backend/app/routes/oracle.py` — `GET /venues/{venue_id}/oracle/premium` is gated behind `_check_vibe_plus()`.
- `backend/app/config.py` — `PULSE_DROP_TIERS` constants: Spark ₦5,000, Flare ₦15,000, Supernova ₦50,000. Indexes defined for `pending_subscriptions`.

### Backend — Missing / Incomplete
- **Price mismatch**: `DEFAULT_PRICE_KOBO = 150000` (₦1,500) in `subscriptions.py` — must be 200,000 (₦2,000) per BILL-01.
- **Night Planner not gated**: `POST /api/planner/chat` has no `_check_vibe_plus()` check. BILL-01 requires this.
- **Free trial**: No `trial_ends_at` field, no 7-day trial period. BILL-02 requires this.
- **Merchant SaaS subscription**: Entirely absent. No `merchant_subscriptions` collection, no plan creation, no auto-renewal webhooks. BILL-03 requires all of this.
- **Pulse Drop SaaS gate**: `purchase_pulse_drop` in `pulse_drops.py` debits the wallet without checking if the merchant has an active SaaS subscription. BILL-04 requires this gate.
- **Webhook: merchant SaaS events**: `webhooks.py` only handles `charge.success`. Must also handle `subscription.create`, `invoice.payment_failed`, `subscription.disable` for merchant SaaS renewals.
- **Vercel entry point**: `backend/api/index.py` must be kept in sync with any new routes added to `server.py`.

### Frontend — Fully Built
- `VibePlusModal.tsx` — Complete paywall UI: paywall → processing → awaiting_verify → success → error states. Opens Paystack via `expo-web-browser`. Shows ₦1,500 (needs update to ₦2,000).
- `vibeStore.ts` — `isVibePlus()`, `initializeVibePlus()`, `verifyVibePlus()`, `refreshSubscriptionStatus()` all wired to backend endpoints.

### Frontend — Missing / Incomplete
- **Price display**: `VibePlusModal.tsx` hardcodes "₦1,500" in text and button labels. Update to ₦2,000.
- **Trial state**: No UI for 7-day trial countdown or trial end date display. BILL-02 requires this.
- **Subscription status screen**: No standalone screen showing: trial end date, feature list, cancel link. BILL-02 requires this.
- **Night Planner gate**: `NightPlannerModal.tsx` has no `isVibePlus()` check — any user can access it. BILL-01 requires the gate.
- **Merchant SaaS UI**: No subscription screen for merchants. BILL-03 requires a subscription flow in the merchant tab.
- **Pulse Drop upsell**: `PulseDropSelector.tsx` does not check merchant SaaS status; no upsell prompt exists. BILL-04 requires this.
- **RevenueCat**: Zero integration. This is the iOS/Android native layer for Vibe+ — required before EAS build in Phase 2.

---

## Architecture Patterns

### Pattern 1: Paystack Plan-Based Subscription (Merchant SaaS)

The current Vibe+ consumer flow uses a one-time transaction that activates a manually-tracked 30-day period. Merchant SaaS must use Paystack's native subscription/plan system, which handles auto-renewal automatically.

**Flow for merchant SaaS subscription creation:**
```
Merchant clicks "Subscribe to SaaS" on merchant dashboard
  -> Backend: POST /api/merchant/saas/subscribe
     - Creates Paystack Plan (if not already exists): POST /api/plan
       { name: "VIIBE Merchant SaaS", amount: 15000000, interval: "monthly" }
     - Creates Paystack Transaction with plan: POST /api/transaction/initialize
       { email, amount, plan: plan_code }
     - Stores pending_merchant_subscription doc in MongoDB
     - Returns authorization_url
  -> Frontend opens Paystack checkout (expo-web-browser)
  -> User pays card — Paystack auto-creates subscription
  -> Paystack fires: charge.success (first payment)
  -> Paystack fires: subscription.create (confirms recurring is active)
  -> Backend webhook handler:
     - charge.success with prefix "VIIBE-MSAAS-" → activate merchant subscription
     - subscription.create → store subscription_code + email_token
  -> MongoDB merchant_subscriptions doc: status=active, subscription_code, next_payment_date
  -> Merchant dashboard unlocked; Pulse Drop purchases enabled
```

**Plan amount note:** ₦150,000/month = 15,000,000 kobo. Define as `MERCHANT_SAAS_MONTHLY_KOBO = 15_000_000`.

**Key Paystack subscription fields returned:**
- `subscription_code` — required to cancel: `DELETE /api/subscription/disable`
- `email_token` — required alongside subscription_code to cancel
- `next_payment_date` — show in merchant dashboard

**Webhook events to handle for merchant SaaS:**
- `charge.success` — first payment + renewals (reference prefixed `VIIBE-MSAAS-`)
- `subscription.create` — store subscription_code + email_token
- `invoice.payment_failed` — mark subscription as `past_due`, notify merchant
- `subscription.disable` — cancellation confirmed → set status to `cancelled`

### Pattern 2: Paystack Trial Period (Vibe+ BILL-02)

Paystack does not natively support "7-day free trial then charge." The approach is:

**Option A (recommended): Delay the charge by 7 days**
- Use Paystack's `start_date` parameter when creating a subscription: `"start_date": (now + 7 days).isoformat()`
- Merchant sees subscription as active but first charge fires in 7 days
- Store `trial_ends_at = now + 7 days` in `pending_subscriptions` / user record
- UI shows trial countdown

**Option B: Manual grant + scheduled charge**
- Grant Vibe+ immediately with `trial_ends_at` in DB
- At `trial_ends_at`, initiate first charge (requires stored card authorization)
- More complex, requires card tokenization upfront

Option A is simpler. Paystack transaction initialize supports `start_date` in ISO8601 format.

**For the web Paystack flow**, this means: when initializing the subscription transaction, include `"start_date"` in the payload. Store `trial_ends_at` on the user record when the subscription is initialized (not when verified).

### Pattern 3: Subscription Status as Middleware

```python
# backend/app/routes/subscriptions.py — extend existing _check_vibe_plus()
# Same pattern for merchant SaaS gate

async def require_merchant_saas(venue_id: str) -> bool:
    sub = await db.merchant_subscriptions.find_one({
        "venue_id": venue_id,
        "status": "active",
        "current_period_end": {"$gt": datetime.now(timezone.utc)},
    })
    return sub is not None
```

Apply in `pulse_drops.py` `purchase_pulse_drop` before the wallet deduction:
```python
has_saas = await require_merchant_saas(drop_data.venue_id)
if not has_saas:
    raise HTTPException(
        status_code=403,
        detail="SaaS subscription required to purchase Pulse Drops",
        headers={"X-Merchant-SaaS-Required": "true"},
    )
```

### Pattern 4: Idempotent Webhook Processing (already established)

The existing pattern in `subscriptions.py` uses atomic MongoDB `update_one` with `status: "pending"` precondition to prevent double-processing. Extend this to merchant SaaS webhooks. Store `paystack_event_id` from the webhook payload and check for it before processing:

```python
# Idempotency guard
existing = await db.processed_webhook_events.find_one({"event_id": event_id})
if existing:
    return  # already processed

await db.processed_webhook_events.insert_one({"event_id": event_id, "processed_at": now})
```

### Pattern 5: RevenueCat Entitlement Architecture (iOS/Android — Phase 2 prerequisite)

RevenueCat acts as an entitlement manager on top of Apple IAP and Google Play Billing. The architecture:

```
iOS/Android user taps "Subscribe"
  -> react-native-purchases SDK opens native StoreKit 2 (iOS) or Play Billing (Android) sheet
  -> User subscribes inside app store payment sheet
  -> RevenueCat receives receipt from Apple/Google
  -> RevenueCat verifies with Apple/Google servers
  -> RevenueCat fires webhook to backend: POST /api/webhook/revenuecat
     { event: "INITIAL_PURCHASE", app_user_id: user_id, entitlement_id: "vibe_plus" }
  -> Backend activates Vibe+ for user (same _apply_subscription logic)
  -> Frontend: Purchases.getCustomerInfo() → check entitlements["vibe_plus"].isActive
  -> Zustand store updated: is_vibe_plus = true
```

**RevenueCat setup requirements (needed before Phase 2 EAS build):**
1. Create RevenueCat project at app.revenuecat.com
2. Create "Vibe+" product in App Store Connect (₦2,000/month) and Google Play Console
3. Link product to RevenueCat entitlement named `"vibe_plus"`
4. Set RevenueCat iOS API key + Android API key in app (via Expo config)
5. Add `POST /api/webhook/revenuecat` endpoint to backend (separate from Paystack webhook)
6. Verify RevenueCat webhook signature (X-RevenueCat-Signature header, HMAC-SHA256)

**Critical:** RevenueCat requires a development build (not Expo Go). This is why Phase 2 (EAS Build) must follow Phase 1. For Phase 1, wire the architecture but do not attempt to test RevenueCat on real IAP until the EAS build exists.

### Recommended Project Structure (new files only)

```
backend/app/routes/
  merchant_subscriptions.py    # NEW — merchant SaaS subscribe/status/cancel routes

backend/app/routes/
  webhooks.py                  # EXTEND — add subscription.create, invoice.payment_failed, subscription.disable handlers; add RevenueCat webhook handler
  subscriptions.py             # EXTEND — update price constant, add trial support, gate Night Planner
  pulse_drops.py               # EXTEND — add require_merchant_saas() gate

frontend/src/components/
  MerchantSaasModal.tsx        # NEW — merchant SaaS paywall (subscribe, status, cancel link)
  SubscriptionStatusScreen.tsx # NEW — Vibe+ status: trial countdown, features, cancel link
  VibePlusModal.tsx            # EXTEND — update price to ₦2,000, add trial state display

frontend/app/merchant/
  subscription.tsx             # NEW — merchant subscription management screen
```

### Anti-Patterns to Avoid

- **Client-side-only subscription gating**: Zustand `isVibePlus()` is for UI only. Night Planner and Oracle Premium must verify on the backend (`_check_vibe_plus()`). Never gate AI endpoints purely by frontend state.
- **Polling Paystack for renewal status**: Use webhooks. MongoDB is the source of truth. Only call Paystack API for the initial verify.
- **Processing webhooks without idempotency**: Paystack retries on failure. A `charge.success` event can fire twice. Always guard with atomic claim.
- **Synchronous push during webhook**: If sending confirmation notifications after webhook processing, use FastAPI `BackgroundTasks` — don't block the 200 response.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Apple IAP receipt validation | Custom StoreKit receipt parser | RevenueCat | Apple receipt validation requires server-side verification with Apple's servers; RevenueCat handles cross-platform, expiry, trial, restore |
| Auto-renewal billing cycle management | Cron job + stored card charge | Paystack Plan API | Paystack handles retry logic, failed charge notifications, billing date calculation for months with different day counts |
| Subscription cancel + reactivate logic | Custom cancel endpoint + grace period | Paystack `subscription.disable` API + webhook `subscription.disable` event | Paystack manages the cancel lifecycle; webhook fires on confirmation |
| HMAC-SHA512 verification | Custom hash implementation | stdlib `hmac.compare_digest` | Already implemented in `payments.py` — just extend to new webhook events |

**Key insight:** The existing `payments.py` `verify_paystack_signature()` function is production-ready. Do not duplicate it. Import it everywhere webhook verification is needed.

---

## Common Pitfalls

### Pitfall 1: Kobo Arithmetic Errors
**What goes wrong:** ₦2,000 monthly = 200,000 kobo. ₦150,000 monthly = 15,000,000 kobo. Getting this backwards charges 1/100th or 100x the price.
**Why it happens:** Easy mental confusion between Naira display and kobo API values.
**How to avoid:** Define named constants in `config.py`:
```python
VIBE_PLUS_MONTHLY_KOBO = 200_000      # ₦2,000
MERCHANT_SAAS_MONTHLY_KOBO = 15_000_000  # ₦150,000
```
Always suffix variable names with `_kobo`. Current code has `DEFAULT_PRICE_KOBO = 150000` (₦1,500) — this is WRONG for BILL-01 and must be corrected.
**Warning signs:** Test transaction amount on Paystack dashboard shows unexpected value.

### Pitfall 2: Webhook Signature Bypass in Dev Mode
**What goes wrong:** `verify_paystack_signature()` returns `True` when `PAYSTACK_SECRET_KEY` is empty (dev mode bypass). If Railway is ever deployed without the key set, all webhook events are accepted without verification.
**Why it happens:** Intentional dev convenience that becomes a production security hole.
**How to avoid:** The webhook route should log a WARNING when bypassing signature verification, not silently accept. Add: `logger.warning("PAYSTACK_SECRET_KEY not set — skipping webhook signature verification (unsafe in production)")`.
**Detection:** BILL-04 success criterion explicitly tests this: fake `charge.success` with wrong signature must return 401.

### Pitfall 3: Oracle Already Gated, Night Planner Not
**What goes wrong:** Building the Night Planner gate incorrectly, or forgetting it entirely.
**Root cause:** `oracle.py` uses `get_current_user()` then `_check_vibe_plus()`. `planner.py` uses no auth at all — `async def planner_chat(body: PlannerChatRequest)` has no `request: Request` parameter.
**How to avoid:** Add `request: Request` parameter to `planner_chat`, call `get_current_user(request)`, then `_check_vibe_plus(user)`. Return 402 with `X-Vibe-Plus-Required: true` header if not subscribed. Frontend `NightPlannerModal.tsx` checks this header and shows `VibePlusModal` if received.

### Pitfall 4: Merchant SaaS Subscription vs Wallet Top-Up Confusion
**What goes wrong:** The merchant currently has a wallet system (top-up via Paystack, spend on Pulse Drops). The new merchant SaaS subscription is a separate recurring charge — not a wallet top-up. Mixing these up results in incorrect accounting.
**Why it happens:** Both use Paystack; the reference prefix distinguishes them in the webhook.
**How to avoid:** Use reference prefix `VIIBE-MSAAS-{venue_id[:8]}-{timestamp}` for merchant SaaS. Store in `merchant_subscriptions` collection (NOT `merchant_wallets`). Webhook routes by prefix: existing `VIBE-TOPUP-` → wallet, `VIBE-PLUS-` → consumer sub, new `VIIBE-MSAAS-` → merchant SaaS.

### Pitfall 5: Paystack Subscription vs Transaction
**What goes wrong:** Creating a one-time transaction for merchant SaaS instead of a recurring subscription. The merchant pays once but auto-renewal never fires.
**Why it happens:** Using `POST /transaction/initialize` without the `plan` parameter creates a one-off charge.
**How to avoid:** When initializing merchant SaaS payment, include `"plan": plan_code` in the Paystack transaction initialize body. This tells Paystack to create a subscription after the first charge.

### Pitfall 6: Vercel Entry Point Sync
**What goes wrong:** New routes registered in `server.py` but not in `backend/api/index.py`. Vercel-deployed web app cannot reach new endpoints.
**Why it happens:** Two entry points exist; both must be kept in sync.
**How to avoid:** Every new route file added to `server.py` imports must also be added to `backend/api/index.py`. Include this as a verification step in every plan task that adds new routes.

### Pitfall 7: Free Trial — Paystack `start_date` Timezone
**What goes wrong:** `start_date` sent to Paystack in local timezone instead of UTC ISO8601. Paystack interprets it incorrectly, leading to trial starting at wrong time.
**How to avoid:** Always use `datetime.now(timezone.utc) + timedelta(days=7)`. Format as `expires_at.strftime('%Y-%m-%dT%H:%M:%S+0000')` or `.isoformat()` with UTC tzinfo.

---

## Code Examples

Verified patterns from existing codebase and Paystack documentation:

### HMAC-SHA512 Signature Verification (already exists — DO NOT re-implement)
```python
# Source: backend/app/services/payments.py
def verify_paystack_signature(payload: str, signature: str) -> bool:
    if not PAYSTACK_SECRET_KEY:
        return True  # dev bypass — log WARNING in production
    hash_object = hmac.new(
        PAYSTACK_SECRET_KEY.encode(),
        payload.encode(),
        hashlib.sha512,
    )
    computed_signature = hash_object.hexdigest()
    return hmac.compare_digest(computed_signature, signature)
```

### Paystack Plan Creation (new — merchant SaaS)
```python
# One-time setup: create the plan if it doesn't exist
async def get_or_create_merchant_saas_plan() -> str:
    """Returns plan_code. Creates plan if not yet created."""
    config = await db.config.find_one({"key": "merchant_saas_plan_code"})
    if config:
        return config["value"]

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://api.paystack.co/plan",
            headers={"Authorization": f"Bearer {PAYSTACK_SECRET_KEY}"},
            json={
                "name": "VIIBE Merchant SaaS",
                "amount": MERCHANT_SAAS_MONTHLY_KOBO,  # 15_000_000
                "interval": "monthly",
                "currency": "NGN",
            },
        )
    plan_code = resp.json()["data"]["plan_code"]
    await db.config.update_one(
        {"key": "merchant_saas_plan_code"},
        {"$set": {"value": plan_code}},
        upsert=True,
    )
    return plan_code
```

### Paystack Transaction Initialize with Plan (merchant SaaS — enables auto-renewal)
```python
# In merchant_subscriptions.py
resp = await client.post(
    "https://api.paystack.co/transaction/initialize",
    headers={"Authorization": f"Bearer {PAYSTACK_SECRET_KEY}"},
    json={
        "email": merchant_email,
        "amount": MERCHANT_SAAS_MONTHLY_KOBO,
        "reference": reference,  # prefix: VIIBE-MSAAS-
        "plan": plan_code,       # THIS creates the subscription
        "currency": "NGN",
        "metadata": {
            "type": "merchant_saas",
            "venue_id": venue_id,
        },
    },
)
```

### Paystack Transaction Initialize with Trial (Vibe+ BILL-02)
```python
from datetime import datetime, timezone, timedelta

trial_end = datetime.now(timezone.utc) + timedelta(days=7)

resp = await client.post(
    "https://api.paystack.co/transaction/initialize",
    json={
        "email": email,
        "amount": VIBE_PLUS_MONTHLY_KOBO,  # 200_000
        "reference": reference,
        "plan": vibe_plus_plan_code,
        "start_date": trial_end.strftime("%Y-%m-%dT%H:%M:%S+0000"),
        "currency": "NGN",
    },
    headers={"Authorization": f"Bearer {PAYSTACK_SECRET_KEY}"},
)
```

### Vibe+ Night Planner Gate (extend existing pattern from oracle.py)
```python
# backend/app/routes/planner.py — extend planner_chat
from fastapi import Request
from app.services.auth import get_current_user
from app.routes.subscriptions import _check_vibe_plus

@router.post("/planner/chat")
async def planner_chat(body: PlannerChatRequest, request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Login required for Night Planner")
    if not await _check_vibe_plus(user):
        raise HTTPException(
            status_code=402,
            detail="Vibe+ subscription required",
            headers={"X-Vibe-Plus-Required": "true"},
        )
    # ... existing planner logic
```

### Merchant SaaS Gate on Pulse Drops
```python
# backend/app/routes/pulse_drops.py — add to purchase_pulse_drop
from app.routes.merchant_subscriptions import require_merchant_saas

@router.post("/pulse-drops/purchase")
async def purchase_pulse_drop(drop_data: PulseDropCreate):
    venue = await db.venues.find_one({"id": drop_data.venue_id})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    # BILL-04: SaaS subscription gate
    if not await require_merchant_saas(drop_data.venue_id):
        raise HTTPException(
            status_code=403,
            detail="Active SaaS subscription required to purchase Pulse Drops",
            headers={"X-Merchant-SaaS-Required": "true"},
        )

    # ... existing wallet deduction logic
```

### New Webhook Events (extend webhooks.py)
```python
# Add to paystack_webhook handler after existing charge.success routing
elif payload.get("event") == "subscription.create":
    data = payload.get("data", {})
    # Store subscription_code + email_token for future cancellation
    await handle_subscription_create(data)

elif payload.get("event") == "invoice.payment_failed":
    data = payload.get("data", {})
    await handle_invoice_payment_failed(data)

elif payload.get("event") == "subscription.disable":
    data = payload.get("data", {})
    await handle_subscription_disable(data)
```

### MongoDB merchant_subscriptions Collection Schema
```python
{
    "venue_id": str,           # indexed
    "merchant_id": str,        # indexed
    "paystack_subscription_code": str,   # from subscription.create event
    "paystack_email_token": str,         # from subscription.create event; needed to cancel
    "paystack_plan_code": str,
    "status": "active" | "past_due" | "cancelled" | "expired",
    "current_period_start": datetime,
    "current_period_end": datetime,      # = next_payment_date from Paystack
    "cancel_at_period_end": bool,
    "reference": str,          # initial transaction reference
    "created_at": datetime,
    "updated_at": datetime,
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom IAP implementation | RevenueCat SDK wraps StoreKit 2 + Play Billing 6 | 2023-2024 | StoreKit 2 is Swift-only without RevenueCat; RevenueCat provides React Native bridge |
| Paystack webhook polling | Paystack event-driven webhooks with HMAC | Standard | Polling is rate-limited and unreliable; webhooks are standard |
| Single payment processor | Split: Paystack (web/merchant) + RevenueCat/Apple IAP (iOS) | Apple policy | Apple 3.1.1 forced this split for digital subscriptions |

**Deprecated/outdated:**
- Using `POST /api/subscription/initialize` without a Paystack `plan` parameter for recurring subscriptions: this creates one-time charges only; Paystack does not auto-renew. Current consumer Vibe+ flow does this — it works for a one-time 30-day grant but does NOT auto-renew. This is acceptable for the current MVP scope (users re-subscribe each month) but note it means manual re-subscription. BILL-01 does not explicitly require auto-renew for consumer; BILL-03 does for merchant.

---

## Open Questions

1. **RevenueCat iOS — Apple 3.1.1 Risk**
   - What we know: Apple Guideline 3.1.1 requires all digital subscriptions on iOS to use Apple IAP. VIIBE is a venue intelligence service — arguably a service for discovering real-world venues, not "digital content."
   - What's unclear: Apple has inconsistently applied this rule. Some apps have used external payment links under the "reader app" exception. Apple's External Purchase Link entitlement (US only, post-2024 ruling) may apply.
   - Recommendation: Plan for RevenueCat + Apple IAP as the primary path. Do not attempt to submit iOS with Paystack-only payment and assume it will pass. Launch Android first.

2. **Vibe+ Auto-Renewal for Consumer**
   - What we know: Current implementation is a one-time 30-day grant (not auto-renewing on web/Android Paystack). BILL-01 says "₦2,000/month" without explicitly requiring auto-renewal.
   - What's unclear: Whether seed investors/testers will expect auto-renewal or manual re-subscribe.
   - Recommendation: Use Paystack Plan for consumer Vibe+ too (same as merchant SaaS, different amount). This enables true auto-renewal and trial `start_date`. Simple change.

3. **Merchant SaaS Paystack Plan — Pre-creation Timing**
   - What we know: The Paystack plan must be created before any merchant can subscribe. The `get_or_create_merchant_saas_plan()` pattern handles this idempotently.
   - What's unclear: Whether to create the plan at app startup or lazily on first subscribe request.
   - Recommendation: Create lazily on first request, cache plan_code in `db.config`. This avoids needing Paystack credentials at startup.

---

## Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json` — this section is required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest (already used in `backend/tests/test_admin_endpoints.py`) |
| Config file | None — no `pytest.ini` exists; run from `backend/` directory |
| Quick run command | `cd backend && python -m pytest tests/test_billing.py -x -q` |
| Full suite command | `cd backend && python -m pytest tests/ -q` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BILL-01 | Vibe+ subscribe initializes Paystack with ₦2,000 | unit (mock httpx) | `pytest tests/test_billing.py::test_vibe_plus_price_is_200000_kobo -x` | ❌ Wave 0 |
| BILL-01 | Oracle Premium returns 402 without Vibe+ | integration | `pytest tests/test_billing.py::test_oracle_requires_vibe_plus -x` | ❌ Wave 0 |
| BILL-01 | Night Planner returns 402 without Vibe+ | integration | `pytest tests/test_billing.py::test_planner_requires_vibe_plus -x` | ❌ Wave 0 |
| BILL-02 | Trial: `trial_ends_at` stored on subscription initialize | unit | `pytest tests/test_billing.py::test_trial_end_date_stored -x` | ❌ Wave 0 |
| BILL-02 | Subscription status returns trial end date | integration | `pytest tests/test_billing.py::test_subscription_status_shows_trial -x` | ❌ Wave 0 |
| BILL-03 | Merchant SaaS initialize includes plan_code | unit (mock httpx) | `pytest tests/test_billing.py::test_merchant_saas_uses_plan -x` | ❌ Wave 0 |
| BILL-03 | Merchant SaaS survives restart (DB persisted) | integration | `pytest tests/test_billing.py::test_merchant_saas_persists -x` | ❌ Wave 0 |
| BILL-04 | Pulse Drop purchase blocked without SaaS subscription | integration | `pytest tests/test_billing.py::test_pulse_drop_requires_saas -x` | ❌ Wave 0 |
| BILL-04 | Pulse Drop purchase succeeds with active SaaS | integration | `pytest tests/test_billing.py::test_pulse_drop_allowed_with_saas -x` | ❌ Wave 0 |
| SC-5 | Fake webhook with wrong signature returns 401 | unit | `pytest tests/test_billing.py::test_webhook_rejects_invalid_signature -x` | ❌ Wave 0 |
| SC-5 | Fake webhook does not grant subscription access | unit | `pytest tests/test_billing.py::test_webhook_invalid_sig_no_subscription -x` | ❌ Wave 0 |

**Manual-only tests (cannot be automated without live Paystack test keys):**
- End-to-end Paystack checkout flow on web browser (requires real test card)
- RevenueCat sandbox purchase on physical iOS device (requires EAS build + TestFlight)
- Merchant SaaS auto-renewal (requires waiting for next billing cycle — use Paystack test mode)

### Sampling Rate
- **Per task commit:** `cd backend && python -m pytest tests/test_billing.py -x -q`
- **Per wave merge:** `cd backend && python -m pytest tests/ -q`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `backend/tests/test_billing.py` — covers all BILL-01 through BILL-04 + webhook signature tests
- [ ] `backend/tests/conftest.py` — shared fixtures: mock MongoDB client, mock Paystack secret key, mock user with/without Vibe+, mock venue with/without SaaS subscription
- [ ] Framework already present (`pytest` in test_admin_endpoints.py), but `requirements-dev.txt` or test dependencies may need `pytest-asyncio` for async test functions

**Install if missing:**
```bash
cd backend && pip install pytest pytest-asyncio httpx[test]
```

---

## Sources

### Primary (HIGH confidence)
- Codebase audit: `backend/app/routes/subscriptions.py`, `backend/app/routes/webhooks.py`, `backend/app/services/payments.py`, `backend/app/routes/oracle.py`, `backend/app/routes/pulse_drops.py`, `backend/app/routes/planner.py`, `backend/app/config.py` — direct code read
- Codebase audit: `frontend/src/components/VibePlusModal.tsx`, `frontend/src/store/vibeStore.ts` — direct code read
- `.planning/research/STACK.md`, `.planning/research/PITFALLS.md`, `.planning/research/ARCHITECTURE.md` — project research documents

### Secondary (MEDIUM confidence)
- [Paystack Subscriptions Docs](https://paystack.com/docs/payments/subscriptions/) — webhook event names (`subscription.create`, `invoice.payment_failed`, `subscription.disable`), `start_date` for trial, `subscription_code` + `email_token` for cancellation
- [Paystack Webhooks Docs](https://paystack.com/docs/payments/webhooks/) — HMAC-SHA512 verification, `x-paystack-signature` header, retry behavior
- [RevenueCat Expo Installation](https://www.revenuecat.com/docs/getting-started/installation/expo) — `npx expo install react-native-purchases react-native-purchases-ui`, dev build required, Expo Go mock mode
- [NestJS Paystack Subscription Tutorial](https://dev.to/idrisakintobi/setting-up-paystack-for-subscription-based-billing-in-nestjs-520i) — plan_code vs subscription_code distinction, cancel via subscription_code + email_token

### Tertiary (LOW confidence — use with caution)
- RevenueCat Expo 54 compatibility: no official documentation explicitly tested against Expo 54. Install via `npx expo install` (uses compatible version resolution). Verify after install.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in project; Paystack and RevenueCat are well-documented
- Architecture: HIGH — existing patterns in codebase are solid; gaps are clearly identified
- Pitfalls: HIGH — all pitfalls verified against actual code (kobo error is a live issue in `subscriptions.py`)
- RevenueCat iOS integration: MEDIUM — not yet tested against Expo 54; no EAS build exists yet

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (Paystack API stable; RevenueCat SDK may release minor updates but install pattern is stable)
