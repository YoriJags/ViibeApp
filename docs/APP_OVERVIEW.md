# VIIBE — Complete App Overview
*Platform Reference Document | v2.0 | February 2026*

---

## 1. Executive Summary

VIIBE is a real-time nightlife intelligence platform for Nigeria. It solves a single, persistent problem: on any given Friday night in Lagos, you have no reliable way to know which venues are actually alive before you walk in — and by the time you find out you're at the wrong place, the night is half over.

VIIBE fixes this by placing a network of credentialed scouts — real people physically inside venues — who report live conditions every 30 minutes. Their reports feed a scoring algorithm that produces a 0-100 vibe score, an energy state label, and a time-series trend for every venue in real time. The data is surfaced to the public through a consumer app, monetised through a merchant dashboard, and governed through an admin layer.

**Current Status:** Live at `vibe-app-hc83.vercel.app` (frontend) + `vibeapp-production-1835.up.railway.app` (backend). MongoDB seeded with 10 Lagos venues. Three test accounts active.

---

## 2. The Problem

Nigeria has the highest concentration of nightlife spend per capita in Sub-Saharan Africa. Lagos alone generates an estimated ₦2.3 trillion in entertainment spend annually. Yet the discovery infrastructure is stuck in 2012:

- **No live venue data anywhere.** Instagram stories are delayed, staged, and curated.
- **No accountability.** Venue promoters always say "it's mad tonight." There is no way to verify.
- **Coordination is broken.** Planning a night out with a squad of 6 involves a WhatsApp thread, 3 phone calls, and at least one person ending up at the wrong place.
- **Merchants are flying blind.** Venue owners have no real-time demand signal. They spend on promotions without knowing if their venue is empty or full.

---

## 3. The Solution

VIIBE creates a **live, community-verified, manipulation-resistant** venue intelligence layer.

The core loop:
1. **Scouts** (public users) physically visit venues and submit 60-second ratings from inside the geofence.
2. The **scoring engine** aggregates these reports with time-decay weighting to produce a live vibe score.
3. The **map and feed** surface this data to anyone looking for a good night out.
4. **Merchants** see the same data on their dashboard and can amplify their presence with paid Pulse Drops.
5. The **data flywheel** grows: more scouts → more data → more accurate scores → more useful product → more users.

---

## 4. The Three-Storey Architecture

VIIBE is not one product — it is three linked products sharing one backend and one database.

### Floor 1 — The Public App (Scouts)
The consumer experience. Anyone can sign up, verify with a Nigerian phone number, and start rating venues. The public floor surfaces:
- Live venue map with energy state overlays
- Venue detail pages (score, timeline, oracle, top scouts)
- Personal profile (Vibe DNA, scout tier, clout balance, streak)
- Squad/crew features (live location, coordination)
- Night Planner AI concierge

**Access:** `/(public)` routes. URL: `vibe-app-hc83.vercel.app`

### Floor 2 — The Merchant Portal (Venue Owners)
Venue owners get a private dashboard showing their own venue's live performance:
- Real-time vibe score and energy state
- Rating volume, capacity breakdown, gate reports
- 24-hour historical timeline
- Aura Shield alerts (push notification when score drops)
- Pulse Drop purchasing (paid visibility boosts)
- Wallet management (Paystack-powered top-ups)

**Access:** `/(merchant)` routes. URL: `vibe-app-hc83.vercel.app/merchant`

### Floor 3 — The Admin Console (Platform Operators)
Super-admin control panel:
- Venue CRUD (create, update, delete)
- Merchant assignment (link a merchant account to a venue)
- Economy configuration (clout rates, cooldown timers, Pulse Drop pricing)
- Platform-wide monitoring

**Access:** `/(admin)` routes. URL: `vibe-app-hc83.vercel.app/admin`

---

## 5. The Vibe Scoring System

This is the core intellectual property of VIIBE. Every number shown to a user traces back to this model.

### 5.1 The Six Energy States

A scout physically observes the venue and selects one of six states. This is the **only input** that comes from human judgment:

| State | Numeric Value | Description |
|---|---|---|
| `quiet` | 0 | Nearly empty. No atmosphere. |
| `chill` | 25 | Small crowd, low energy, relaxed. |
| `warming` | 50 | Building momentum — people arriving, vibe stirring. |
| `lit` | 75 | High energy — crowd engaged, music hitting. |
| `peak` | 100 | Maximum energy. Packed, electric, best of the night. |

> **Note:** `charged` is NOT an input state. It is a derived display state only (see §5.4).

### 5.2 The Score Formula

A single rating produces a vibe score between 0 and 100:

```
base_score = (energy_value × 0.80) + (venue_specific_value × 0.20)
final_score = min(100, base_score × capacity_multiplier)
```

**Energy is 80% of the score.** This is intentional — the atmosphere in the room is the primary signal. No other factor can compensate for a dead crowd.

**Venue-specific (4th dimension):** An optional secondary dimension that captures context specific to the venue type. Scouts can optionally report this for a more nuanced reading.

| Venue Type | Low (0) | Medium (50) | High (100) |
|---|---|---|---|
| Club / Rave | `mellow` | `good_set` | `killing_it` |
| Bar | `quiet_atm` | `decent_atm` | `loud_alive` |
| Lounge | `slow_service` | `decent_service` | `on_point` |
| Concert / Event | `flat_crowd` | `building_crowd` | `going_off` |
| Block Party | `standing_around` | `mixed_movement` | `packed_dancing` |

**Capacity multiplier:** The crowd size *amplifies* real energy but cannot create energy from nothing:

| Crowd Level | Multiplier | Effect |
|---|---|---|
| `sparse` | × 0.92 | Slight drag — thin crowd dampens the room |
| `vibrant` | × 1.05 | Small boost — crowd is the right size |
| `full` | × 1.15 | Bigger boost — packed house amplifies everything |

**Gate is context only:** `clear` / `slow` / `blocked` is recorded and shown but does not affect the score. It answers a different question: "how hard is it to get in?" — not "what's it like inside?"

**Worked examples:**

| Energy | Venue-Specific | Capacity | Calculation | Score |
|---|---|---|---|---|
| `peak` | `killing_it` | `full` | (100×0.8 + 100×0.2) × 1.15 | **100** |
| `lit` | `good_set` | `vibrant` | (75×0.8 + 50×0.2) × 1.05 | **73** |
| `warming` | *(none)* | `full` | (50×0.8 + 50×0.2) × 1.15 | **57** |
| `chill` | `decent_atm` | `vibrant` | (25×0.8 + 50×0.2) × 1.05 | **31** |
| `quiet` | *(none)* | `full` | (0×0.8 + 50×0.2) × 1.15 | **11** |

A full venue cannot rescue a dead crowd. An empty venue cannot hide a lit crowd.

### 5.3 Time-Decay Weighted Aggregation

The **live score** displayed on the map is not a simple average of all ratings. It is a time-decay weighted mean over the past 60 minutes:

| Age of Rating | Weight |
|---|---|
| 0–15 minutes ago | **3×** |
| 15–30 minutes ago | **2×** |
| 30–60 minutes ago | **1×** |
| Older than 60 minutes | Excluded |

```
live_score = Σ(score_i × weight_i) / Σ(weight_i)
```

**Why:** A single fresh `peak` rating from someone inside right now should outweigh three `chill` ratings from 45 minutes ago. The venue could have exploded in that time.

**Glow Boost:** Active Pulse Drops (merchant purchases) add a `glow_boost` value (+20 / +40 / +100) to the aggregated score, capped at 100. This ensures a paying merchant gets genuine visibility uplift — but only on top of real scout activity.

### 5.4 The CHARGED State — Derived Display Labels

After aggregation, the raw score is converted to a **display state** that users see on the map and venue cards. This is a separate step from the energy input:

| Score Range | Condition | Display State | Meaning |
|---|---|---|---|
| ≥ 85 | — | `peak` 🔥 | Maximum energy. Get there now. |
| ≥ 65 | — | `lit` ⚡ | High energy. Night is in full swing. |
| 45–64 | Crowd is `full` or `vibrant` | `charged` ⚡ | Potential energy — packed but about to blow. |
| 45–64 | Crowd is `sparse` | `warming` 🌡 | Building slowly. Check back later. |
| 20–44 | — | `chill` 😌 | Low key. Good for a quieter night. |
| < 20 | — | `quiet` 🌙 | Barely alive. Not tonight. |

**CHARGED** is the key insight: a venue with score 52 and a full crowd is fundamentally different from a venue with score 52 and a sparse crowd. In the first case, 300 people are in the room and the DJ hasn't dropped yet — it's about to be peak. In the second, 30 people are spread across a big room and it feels empty. CHARGED surfaces that distinction in a single label.

### 5.5 Venue State Timeline (24-Hour History)

Every time a rating is submitted and the aggregate is recalculated, a **vibe snapshot** is saved to `db.vibe_snapshots`. The timeline endpoint aggregates these into hourly buckets.

To average energy labels across an hour (you can't average strings), labels are converted to a numeric scale for MongoDB aggregation:

```
quiet=0, chill=1, warming=2, charged=3, lit=4, peak=5
```

MongoDB computes `avg_energy` per hour. The number is converted back to a label:

```
< 0.5 → quiet | 0.5–1.5 → chill | 1.5–2.5 → warming
2.5–3.5 → charged | 3.5–4.5 → lit | ≥ 4.5 → peak
```

A 1-hour bucket with mixed `lit` (4) and `chill` (1) ratings would average to ~2.5 = `warming`. The label correctly reflects the distribution rather than arbitrarily picking one.

---

## 6. Scout Economy — Clout

Clout is the in-platform reputation and incentive currency. It is non-transferable and cannot be purchased directly.

### 6.1 Earning Clout

| Action | Clout Earned |
|---|---|
| Rating submitted (base) | +10 |
| Rating during active Pulse Drop | +20 (2× multiplier) |
| High accuracy bonus | Up to +10 extra based on proximity to venue average |
| Quick Pulse (check-in signal) | +3 |
| Streak milestones | +5 / +15 / +30 / +50 (3d/7d/14d/30d) |

### 6.2 Spending Clout

| Action | Clout Cost |
|---|---|
| Skip 30-minute rating cooldown | 50 clout |

### 6.3 Scout Tiers

Tiers unlock leaderboard status and social credibility within the app. They are computed from rating volume + accuracy:

| Tier | Requirement | Badge Color |
|---|---|---|
| `newbie` | < 10 ratings | — |
| `regular` | ≥ 10 ratings | Bronze |
| `scout` | ≥ 20 ratings + ≥ 70% accuracy | Silver |
| `elite` | ≥ 50 ratings + ≥ 80% accuracy | Gold |

**Accuracy** is computed per rating: `accuracy = 100 - |submitted_score - venue_avg|`. A scout who consistently reads venues accurately (within 10 points of consensus) achieves elite status faster than one who churns volume with wild estimates.

### 6.4 Rating Cooldowns & Anti-Gaming

- **30-minute cooldown** between ratings at the same venue (prevents flood from a single user).
- **3 ratings max per venue per 24 hours** (hard cap).
- **Cooldown skip:** 50 clout (creates a meaningful cost to gaming frequency).
- **Geofence enforcement:** Rating rejected if GPS coordinates are outside the venue radius (default 100m; events/festivals get 500m).

---

## 7. Anti-Manipulation Layer

### 7.1 Burst Detection (Provisional Ratings)

If an abnormal volume of ratings arrives at a single venue within a short window, they are flagged `provisional: true` and excluded from the aggregate until `provisional_until` passes. This kills coordinated rating floods from promoter teams. Provisional ratings are stored but silently downweighted.

### 7.2 Aura Shield

A merchant can configure an Aura Shield on their venue:
- Set a score threshold (e.g., 50).
- Set alert triggers: `score_drop`, `gate_blocked`, `capacity_full`.
- Receive a push notification the moment any trigger fires.

This gives merchants a direct signal when they need to respond — send a performer, open a second bar, address gate issues.

### 7.3 VIIBE Certified Badge

The highest trust signal on the platform. A venue earns **VIIBE Certified** status only when **both** of these are simultaneously true:
- `current_vibe_score ≥ 85`
- `total_ratings_24h ≥ 80`

You cannot buy this. You cannot fake it. It requires genuine peak activity AND a critical mass of real scouts reporting in. It expires as soon as either condition falls.

---

## 8. Feature Set — Public Floor

### 8.1 Venue Map
Interactive map showing all venues in the selected city. Venue pins render with colour-coded energy state overlays (quiet=grey, chill=blue, warming=yellow, charged=orange, lit=purple, peak=red). Tapping a pin opens a venue summary card. Long press opens the full venue detail page.

### 8.2 Venue Detail Page
Full profile for a single venue including:
- Live score + energy badge
- 24-hour timeline chart (hourly energy + score)
- Vibe Oracle (predicted peak time + confidence)
- AI Roast (humorous AI-generated venue commentary)
- Vibe Forecast (next 2-hour prediction)
- Top Scouts (top 5 raters at this venue)
- Check-in button
- Rate Vibe button (geofenced)

### 8.3 Vibe Oracle
Heuristic-based peak time prediction. Uses:
- **Base confidence** per venue type (e.g., club=82%, block_party=88%)
- **Velocity delta:** +8 if heating_up, -10 if cooling_down
- **Activity delta:** +5 if >30 ratings in 24h, -5 if <10
- **Peak windows** per venue type × day of week (weekday vs weekend)

Oracle outputs: headline, peak window (start + end), best arrival time (45 minutes before peak), trajectory, confidence score, and context signals (day of week, velocity, genre, certification).

When `ANTHROPIC_API_KEY` is set, the Night Planner (§8.5) upgrades to Claude. Oracle itself remains heuristic — deterministic and auditable.

### 8.4 Vibe DNA
Personalised affinity fingerprint computed from the user's full rating history:
- Groups all ratings by venue type the user rated
- Computes average vibe score per venue type
- Normalises to 0–100 scale relative to their highest-scoring type
- Outputs: ranked affinity bars (e.g., "Club 96 · Block Party 91 · Lounge 68")
- Night style: `early_bird` (arrives before 10pm), `night_owl` (peaks after midnight), `midnight_crew`
- Requires minimum 3 ratings to unlock

DNA is used to power personalised venue sort order in the feed — your top affinity types surface higher.

### 8.5 Night Planner
Conversational AI venue recommendation:
- **Rules path:** Keyword scoring on message text (area, genre, budget, venue type, group size keywords). Fast, always available.
- **Claude path:** Activates when `ANTHROPIC_API_KEY` is set. Sends full venue context (live scores, energy, capacity, gate, genre) to `claude-haiku-4-5` as a structured system prompt. Returns JSON: `{reply, venue_ids, follow_up_prompts}`.
- Follow-up chips allow multi-turn conversation without typing.

### 8.6 City Pulse
Live city heartbeat aggregated across all active venues:
- **Pulse score:** Weighted average of all active venue scores (weighted by `total_ratings_24h`)
- **Active scouts:** Unique users who rated or reacted in the last hour
- **Hot venues:** Count of venues with score ≥ 65
- **30-minute sparkline:** 6 data points in 5-minute buckets
- **Trend:** `heating_up` / `stable` / `cooling_down` based on sparkline direction
- **Pulse tiers:** QUIET → CHILL → WARMING → LIT → PEAK label on the overall city score

### 8.7 Bolt Reactions (VIIBE+ Only)
Live reaction mechanic exclusive to VIIBE+ subscribers:
- Tap the bolt icon on any venue detail page to send a live reaction signal.
- Rate cap: 60 taps per user per minute per venue (anti-spam).
- Response: `reactions_per_min` + `active_scouts` in the current 5-minute window.
- VIIBE+ gate: Tapping without a subscription presents the upgrade modal.

### 8.8 Crew / Squad Features
- Create a crew (named group) and invite friends via invite link.
- In live mode, crew members' active check-ins appear on the map with their avatar.
- Privacy toggle: location sharing is opt-in per session.
- `avatar_config` stored per user (emoji + background colour) persists to crew map markers.

### 8.9 Check-In System
- Scouts check in to venues they are physically at.
- Check-in creates a record with `status: active`, expires 4 hours after creation.
- Required for crew live mode to display your location.
- Feeds the crew coordination map.

### 8.10 VIIBE+ Subscription
Premium tier at ₦1,500/month (≈$1 USD):
- Bolt reactions
- Priority feed placement
- Exclusive persona badges
- Early access to new features

Powered by Paystack (Nigerian payment processor). Subscription state stored in MongoDB and verified at feature access points.

---

## 9. Feature Set — Merchant Floor

### 9.1 Live Dashboard
- Real-time vibe score + energy state for their assigned venue
- Rating volume trend (last hour vs previous hour)
- Capacity breakdown pie (what scouts are reporting)
- Gate status indicator
- Velocity label (heating_up / stable / cooling_down)

### 9.2 Vibe Intelligence Card
AI-generated weekly insights (powered by Claude when API key is set). Surfaces patterns like "Your venue peaks 45 minutes later on Saturdays" or "Gate reports are your biggest drag on score."

### 9.3 Pulse Drops (Paid Boosts)
Merchants purchase Pulse Drops to amplify their venue's presence:

| Tier | Price | Duration | Radius | Glow Boost |
|---|---|---|---|---|
| Spark | ₦5,000 | 2 hours | 2km | +20 to score |
| Flare | ₦15,000 | 4 hours | 5km | +40 to score |
| Supernova | ₦50,000 | 8 hours | 50km | +100 to score |

During a Pulse Drop, the venue appears at the top of the sponsored section in the trending feed, and scouts who rate the venue earn 2× clout (incentivising real reports during the paid window).

### 9.4 Aura Shield
Configurable early warning system (see §7.2).

### 9.5 Wallet
- Merchants maintain an in-app wallet funded via Paystack top-up.
- Minimum top-up: ₦1,000.
- Platform fee: 10% on all wallet spend.
- Wallet balance used for Pulse Drops and campaigns.

---

## 10. Technical Architecture

### 10.1 Frontend
- **Framework:** React Native via Expo SDK 54 (Expo Router v5, file-based routing)
- **Styling:** NativeWind + custom theme tokens
- **State management:** Zustand v5 with `persist` middleware → AsyncStorage
- **Real-time:** Socket.IO client for venue score updates and leaderboard broadcasts
- **Navigation:** Expo Router file-based: `/(public)`, `/(merchant)`, `/(admin)`, `/venue/[id]`

### 10.2 Backend (Railway — Primary)
- **Framework:** FastAPI (Python 3.11) with Motor (async MongoDB driver)
- **Database:** MongoDB Atlas (Motor 3.6.0 / pymongo 4.9.2)
- **Real-time:** Socket.IO (python-socketio) server running on the same process
- **Payments:** Paystack API (Nigerian processor)
- **Notifications:** Expo Push Notification API (non-blocking fire-and-forget)
- **AI:** `anthropic` Python SDK (Claude Haiku 4.5) for Night Planner + Vibe Intelligence
- **Deployment:** Railway with Dockerfile builder. Start command: `uvicorn server:socket_app --host 0.0.0.0 --port $PORT`

### 10.3 Backend (Vercel — Secondary Entry Point)
A separate `BaseHTTPRequestHandler` implementation (`backend/api/index.py`) that handles requests routed through Vercel's serverless Python runtime. It mirrors all Railway routes using synchronous pymongo. This exists because Vercel's Python runtime has issues with FastAPI's `issubclass` introspection — the handler pattern bypasses this.

**Critical:** Both entry points must be kept in sync. `server.py` routes ↔ `api/index.py` handlers. Any new endpoint must be added to both.

### 10.4 Routing Architecture
```
User → Vercel Frontend (vibe-app-hc83.vercel.app)
  └── /api/* rewrites → Railway backend (vibeapp-production-1835.up.railway.app)
  └── Vercel also hosts api/index.py as a serverless fallback
```

All `/api/*` traffic from the frontend goes to Railway via Vercel rewrites. The `api/index.py` serverless function is a resilience fallback.

### 10.5 Database Schema (MongoDB)

**Collections:**

| Collection | Purpose |
|---|---|
| `venues` | Venue profiles with live score fields |
| `users` | User accounts, clout, scout status, avatar config |
| `ratings` | Individual vibe ratings submitted by scouts |
| `vibe_snapshots` | Time-series score snapshots per venue (timeline source) |
| `user_sessions` | JWT session tokens with expiry |
| `checkins` | Active check-in records (4h TTL) |
| `crews` | Squad/crew groups and member arrays |
| `reactions` | Bolt reaction events (per user per venue per timestamp) |
| `quick_pulses` | Quick pulse check-ins (15-min cooldown source) |
| `cooldown_skips` | Clout-spend records for cooldown bypasses |
| `pulse_drops` | Active merchant boost purchases |
| `aura_shields` | Merchant alert configurations |
| `subscriptions` | VIIBE+ subscriber records |
| `stories` | Short-lived venue stories (24h TTL, media_url) |
| `platform_config` | Global platform settings (clout rates, cooldowns) |
| `config` | Economy config (Pulse Drop pricing, campaign pricing) |

### 10.6 Authentication
- Phone-number based OTP flow for public users (Nigerian phone validation)
- Session tokens (UUID) stored in `user_sessions`, 30-day expiry
- Bearer token passed in `Authorization` header on all authenticated requests
- `get_current_user()` helper validates token + expiry on every protected endpoint
- Admin/merchant roles stored as boolean flags on user document (`is_admin`, `is_super_admin`, `is_merchant`)

---

## 11. Measurement System — Complete Reference

### Input Vocabulary (What Scouts Submit)

| Dimension | Valid Values | Notes |
|---|---|---|
| Energy | `quiet`, `chill`, `warming`, `lit`, `peak` | Required. Primary signal (80% of score). |
| Capacity | `sparse`, `vibrant`, `full` | Required. Multiplier on score. |
| Gate | `clear`, `slow`, `blocked` | Required. Context only — not scored. |
| Venue-specific | See §5.2 | Optional. Secondary signal (20% of score). |

**Legacy mapping** (backward compatibility for older app versions):
```
electric → peak | popping → lit | dead → quiet | buzzing → lit | good_vibes → lit
```

### Output Vocabulary (What Users See)

| Field | Source | Values |
|---|---|---|
| `current_vibe_score` | Aggregation | 0–100 (float, rounded to 1dp) |
| `energy_level` | Max-count energy from last 60min | `quiet / chill / warming / lit / peak` |
| `vibe_state` | Derived: score + capacity → display label | `quiet / chill / warming / charged / lit / peak` |
| `vibe_velocity` | Recent vs older rating volume ratio | `heating_up / stable / cooling_down` |
| `capacity_level` | Max-count capacity from last 60min | `sparse / vibrant / full` |
| `gate_level` | Max-count gate from last 60min | `clear / slow / blocked` |
| `viibe_certified` | score ≥ 85 AND ratings_24h ≥ 80 | Boolean |

### Velocity Calculation

```python
recent_count = ratings in last 15 minutes
older_count = ratings in 15–60 minutes

if recent_count > older_count × 1.5: velocity = "heating_up"
elif recent_count < older_count × 0.5: velocity = "cooling_down"
else: velocity = "stable"
```

### Scoring Thresholds Summary

```
Score ≥ 85 + ratings_24h ≥ 80 → VIIBE Certified
Score ≥ 85                     → peak state
Score ≥ 65                     → lit state
Score 45–64, crowd full/vibrant → charged state
Score 45–64, crowd sparse       → warming state
Score 20–44                    → chill state
Score < 20                     → quiet state
```

---

## 12. Cities & Geographic Coverage

VIIBE is currently live in 4 Nigerian cities:

| City | Center Coordinates | Coverage Radius |
|---|---|---|
| Lagos | 6.5244°N, 3.3792°E | 50km |
| Abuja | 9.0579°N, 7.4951°E | 40km |
| Port Harcourt | 4.8156°N, 7.0498°E | 30km |
| Ibadan | 7.3775°N, 3.9470°E | 35km |

Launch strategy is Lagos-first, specifically the Island corridor (Victoria Island, Lekki, Ikoyi) where nightlife density and smartphone penetration are highest.

---

## 13. Venue Types

VIIBE supports 9 venue categories, each with type-specific scoring dimensions:

| Type | Venue-Specific Dimension |
|---|---|
| `club` | DJ set quality (mellow / good_set / killing_it) |
| `bar` | Atmosphere (quiet_atm / decent_atm / loud_alive) |
| `lounge` | Service vibe (slow_service / decent_service / on_point) |
| `restaurant` | Crowd energy (flat_crowd / building_crowd / going_off) |
| `concert` | Crowd response (flat_crowd / building_crowd / going_off) |
| `rave` | DJ set quality (same as club) |
| `block_party` | Movement (standing_around / mixed_movement / packed_dancing) |
| `event` | Crowd response (same as concert) |
| `church` | (Standard energy model applies) |

---

## 14. Test Accounts (Production)

| Role | Phone | Username | Access |
|---|---|---|---|
| Super Admin | +2340000000000 | admin | /admin |
| Merchant | +2341111111111 | merchant_demo | /merchant (Club Quilox) |
| Scout | +2341234567890 | vibe_tester | public floor |

---

## 15. Known Limitations & Pending Work

| Item | Priority | Description |
|---|---|---|
| Base64 story images | ARCH | Stories store raw base64 in MongoDB documents. No CDN. Will hit document size limits at scale. Needs Cloudinary/S3. |
| Crew avatar_config in DB | ARCH | Live crew members may show blank avatars if they authenticated before avatar_config field was added to user schema. |
| vibeStore.ts size | ARCH | Single 64KB Zustand store. Should be split by domain (auth, venues, crew, subscriptions, DNA). |
| Live data fallbacks | ARCH | Most public floor features (stories, oracle, DNA, city pulse, planner) fall back to demo constants when API returns empty. Live users see demo data until enough real data accumulates. |
| Merchant venue onboarding | MISSING | Merchants cannot self-register a venue. Admin must manually assign. Onboarding flow not built. |
| Unit tests | MISSING | No automated tests for scoring logic, aggregation pipeline, or anti-cheat rules. |

---

*Document maintained alongside the codebase. Authoritative source for scoring logic: `backend/app/services/vibe.py` (Railway) and `backend/api/index.py` (Vercel).*
