# VIIBE — Ideas & Pending Tasks

Running list of everything in flight, deferred, or discussed but not yet built.
Updated as work happens. Check this before every session.

---

## 🔴 Seed Milestone (Blocking for Fundraise)

These must ship before investor conversations.

| ID | Task | Notes |
|----|------|-------|
| BILL-01 | Vibe+ subscription via RevenueCat (iOS IAP + Android + Paystack web) | ₦2,000/mo |
| BILL-02 | 7-day free trial for new Vibe+ subscribers | |
| BILL-03 | Merchant SaaS subscription via Paystack | ₦150,000/mo |
| BILL-04 | Pulse Drop boost purchases (Spark/Flare/Supernova) | Gated behind merchant SaaS |
| DIST-01 | EAS Build configured — dev build on iOS + Android physical devices | |
| DIST-02 | TestFlight beta live and distributable | |
| NOTF-01 | Push notification registration + Expo push token on user profile | |
| NOTF-02 | In-app notification centre (fallback for Nigerian Android) | |
| NOTF-03 | Merchant live blast → push to scouts within 2km | |
| NOTF-04 | Merchant push alert when venue score drops below 50 | |
| GROW-01 | Scout referral link → bonus clout for both parties | |
| GROW-02 | Deep link referrals (viibe.app/invite/:code) — WhatsApp/Instagram | |
| GROW-03 | Vibe Moment share card (venue + score + handle) → WhatsApp/IG Stories | |
| ANAL-01 | Merchant dashboard analytics: vibe score trend, rating volume, peak hours | |
| ANAL-02 | Admin dashboard: MAU, DAU, active venues, MRR | |
| ANAL-03 | Investor demo kit — curated in-app demo flow | |
| INVT-01 | Detty December War Room — full-screen live venue intelligence view | |
| INVT-02 | PITCH_DECK.md updated with Phase 1+2 features + market numbers | |
| INVT-03 | VIBEAPP_STRATEGY_BLUEPRINT.md updated | |
| INVT-04 | FINANCIAL_MODEL.md updated (RevenueCat/IAP, seed targets, DD milestone) | |

---

## 🟡 Product Features (Confirmed, Not Started)

From the March 14 feature pipeline.

| # | Feature | What it is |
|---|---------|-----------|
| 1 | **Cartel Battle (cross-venue)** | Cartel members in different venues challenge each other. Extend VenueBattle.tsx to cartel-initiated cross-venue battles. |
| 2 | **Quest Timeline** | Scheduled collective venue boosts with visible countdown. Show in advance so people can anticipate and plan. |
| 3 | **Admin Control Tower Update** | Refresh the admin control tower. Specifics TBD. |
| 4 | **Switch Face (venue mode switching)** | App switches theme/language/features based on venue type (church, concert, sports, etc). venue_type field exists already. |
| 5 | **PostHog Analytics** | Event tracking for scout actions: tap, check-in, cartel join, battle, quest. |
| 6 | **Data Fast Mode** | Low-bandwidth toggle — reduce images, disable animations, minimise socket reconnects. |

---

## 🟢 Scene Intelligence (In Progress / Partially Built)

Built this session. Some parts need follow-up.

| # | Item | Status |
|---|------|--------|
| ✓ | Score transparency pill (active scouts, recency, confidence) | Done |
| ✓ | Dwell time tracking (useDwellTracker + /api/dwell/ping) | Done |
| ✓ | Scout consensus rate signal | Done |
| ✓ | Ambient audio opt-in (useAmbientMeter + AmbientOptInModal + /api/ambient/ping) | Done |
| ✓ | Multi-signal weighted blend formula | Done |
| — | **Reactor tap intensity as direct signal in blend** | Currently only a floor (kinetic momentum). Should be a positive signal in the blend too. |
| — | **Social velocity** | Posts/stories from a location in real time. Needs Instagram/TikTok API access. Deferred to pipeline. |
| — | **Ambient audio: add dB-to-energy label on venue screen** | Could show "🔊 Loud room" based on dB avg. Small UI touch. |

---

## 🔵 Ideas (Discussed, Not Committed)

Things that came up in conversation worth keeping.

| Idea | Context |
|------|---------|
| **"It's a live sensor network made of people"** | Core brand phrase — use in pitch deck, onboarding, marketing copy |
| **Social velocity signal** | Real-time posts/stories from location as corroborating signal. Need platform API access first. |
| **Dwell time → rating weight boost** | Long-dwell scouts (30+ min) could get their ratings weighted slightly higher. Not yet in formula. |
| **Transparency modal on score tap** | Tapping the score shows a breakdown: X scouts, signal weights, confidence. More depth than the pill. |
| **Stream rating (DITCHED)** | Do not revisit. Explicitly rejected. |

---

## 📋 Session Log

| Date | What was built |
|------|---------------|
| 2026-03-17 | Score transparency signals, dwell tracking, scout consensus, ambient audio opt-in, multi-signal weighted blend, reactor ring track upgrade (D), VIBE_SCORE_FORMULA.md |
| 2026-03-14 | UI redesign A–C, E–J. Reactor scale, backdrop, typography, public floor header, VenueCard gradient, category filter, stats bar animation. Feature pipeline captured. |

---

*Last updated: 2026-03-17*
