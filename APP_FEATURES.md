# VIIBE — App Features Reference

> Real-time scene intelligence terminal. A live sensor network made of people.

*Last updated: March 2026 · v4.0*

---

## What Is VIIBE?

VIIBE is a real-time venue intelligence and crowd energy platform. It maps the live energy of city experiences — clubs, bars, lounges, events, festivals, day parties — updated continuously by scouts physically present at those venues.

It is not a review app. It is live infrastructure for the entertainment economy.

The platform operates on three floors:
- **Scout Floor** — Users (scouts) rate venues, tap energy, earn rank, coordinate with their Cartel
- **Merchant Floor** — Venue owners see live analytics and run energy campaigns
- **Admin Floor** — Platform governance, economy management, integrity monitoring

---

## The Vibe Score

Every venue has a live Vibe Score (0–100) calculated from 15+ weighted algorithms:

| Signal Layer | Input | Status |
|---|---|---|
| Tap Frequency | BPM lock from VibeReactor taps | Live |
| Crowd Coherence | Variance across scouts in geofence | Live |
| Vibe Rating | Energy / Capacity / Gate axes | Live |
| Dwell Time | How long scouts stay inside geofence | Live |
| Ambient Decibel | Opt-in room noise floor (30s samples) | Live |
| Surge Events | Ignite mechanic, rapid rating spikes | Live |
| Kinetic Movement | Accelerometer-based crowd BPM detection | In Build |
| BLE Density | Bluetooth device count = crowd density | Pipeline |
| Biometric HR | Apple Watch / Galaxy Watch heart rate | Pipeline |

**Score color coding:**
- Blue (0–40): Chill
- Purple (40–60): Moderate
- Orange (60–80): Popping
- Pink/Red (80–100): Electric

---

## Scout Floor

### VibeReactor

The kinetic tap engine at the core of the platform. Every tap is a data point.

- Tap to build venue energy. Ring responds in real time.
- **BPM Lock** — when your last 4 readings are within ±8 BPM, the reactor locks and label upgrades to `⬡ LOCKED IN`
- **G-force weighting** — physical, body-led taps register stronger than idle screen taps
- **Crowd Sync Ring** — coherence ring appears when 40%+ of the crowd is in rhythm together
- **Personal rhythm decay** — ring returns to baseline 5 seconds after last tap
- Visual: Skia GPU canvas, Reanimated v4 derived values, sub-16ms frame budget

**Sync states:**
| syncPct | Label |
|---|---|
| 0–18% | Hidden |
| 18–40% | FINDING RHYTHM |
| 40–65% | IN THE ZONE |
| 65–100% | LOCKED IN / IN SYNC |

---

### Scout Signal Pack (Sensor Settings)

Scouts control which background sensors are active. Presented as a per-session or persistent settings toggle — battery management is explicit.

| Sensor | Battery Cost | Permission Required | Default |
|---|---|---|---|
| Tap Rhythm | None (event-driven) | None | Always on |
| Vibe Rating | None | None | Always on |
| Ambient Sound | Low (30s burst) | Microphone (opt-in ask) | Off |
| Kinetic Movement | Medium (60Hz while in geofence) | None | Off |
| BLE Crowd Density | Medium (30s scan) | Bluetooth | Off |
| Biometric HR | Low (passive HealthKit read) | Health (Apple/Google) | Off (pipeline) |

**UX pattern:**
- First entry into a venue geofence → one-time nudge: *"Power up your signal? More sensors = better crowd data."*
- Settings screen → **Scout Sensors** section with per-sensor toggles, each showing battery impact badge (None / Low / Medium)
- Sensors auto-pause when scout exits geofence. Resume on re-entry if toggle is on.
- No sensor runs in the background outside a venue.

---

### Vibe Rating

30-second geofence-verified rating across three axes:

| Axis | Options |
|---|---|
| Energy | Chill / Popping / Electric |
| Capacity | Sparse / Vibrant / Full |
| Gate | Clear / Slow / Blocked |

Rules:
- Must be within venue geofence (100m radius, server-validated)
- Max 3 ratings per venue per day
- Second rating in 24h counts as a correction (supersedes first)
- Earns 5–10 clout points (accuracy-adjusted)

---

### Scene Frequency (VibeOscillator)

Live waveform visualizer driven by real BPM and crowd energy data. VIBE+ exclusive.

- Oscillator shape driven by current venue BPM and energy level
- Updates in real time via socket
- Visible on the Scout Floor for VIBE+ subscribers

---

### Torch Ignite

Synchronized crowd flash mechanic.

- Manual: one-tap torch from inside geofence
- Collective: hold IGNITE SCENE when vibeScore ≥ 85
- Wave-pattern stagger — torches cascade outward from the triggering scout's position
- Earns clout + contributes surge event to vibe score

---

### Scout Identity

Personal profile layer — not just a username.

- **Call Name** — scout identity handle
- **Music preferences** — genres and scene types
- **Zodiac sign** — optional identity signal
- **Scout Rank** — Newcomer → Scout → City Elite (clout-based, with multipliers and streaks)
- **Clout Points** — reputation currency earned through all scout activity

**Rank tiers and clout:**
- Rating: +5–10 pts
- Check-in: +2 pts
- Torch Ignite (collective): +15 pts
- Streak milestones: +50 to +1,000 pts
- Streak multiplier: 1.0× base, +0.2× per consecutive day, caps at 2.0×

---

### Cartel / Crew

Squad coordination layer.

- Create or join a Cartel (up to 8 members)
- Live radar: see which members are checked in and where
- **Cartel Vote** — captain proposes 2–4 venues, members vote, winner surfaces on map
- **Cross-Venue Cartel Battle** — competing Cartels at different venues battle by vibe contribution. Winning Cartel earns rank bonus.
- CartelPulse card on home screen: who's out tonight

---

### Ghost Check-In

Stealth presence. Scouts check in without broadcasting publicly.

- Geofence-enforced
- 4-hour auto-expiry
- Visible to Cartel members on their radar
- Contributes to venue headcount signal
- Earns 2 clout points

---

### Ambient Sound Metering

Opt-in room noise level sampling. No audio is recorded or stored — only a numeric dB level is transmitted.

- 30-second sample interval while inside geofence
- User must explicitly grant microphone permission and enable toggle
- dB reading feeds ambient signal layer in vibe score
- Auto-stops on geofence exit

---

### Oracle AI

Predictive venue intelligence. Forecasts when a venue will peak based on historical pattern + current signal trajectory.

- "Quilox will be electric by 12:30am — 87% confidence"
- VIBE+ exclusive feature

---

### Lobby

Smart shortlist. Save up to 10 venues for comparison before deciding.

- Live vibe data auto-refreshes
- Smart Nudge: surface the hottest venue based on score + recent activity trend
- Pre-select venues when starting a Cartel Vote

---

### Pulse Drops

Location-based promotional alerts from venues. Three tiers: Spark / Flare / Supernova.

- Distance-based filtering (within 10km)
- Countdown timers
- Glow boost applied to venue on map

---

### Venue Certification

Venues maintaining vibeScore ≥ 70 for 90 consecutive days earn the **Vibe Certified** badge.

- Boosted visibility in trending and search
- Automatically revoked on score drop
- No manual application — evaluated nightly by algorithm

---

### Achievement Badges

Unlockable milestones: First Rating, Scout tier, Elite tier, Night Owl (late check-ins), Crew Leader, Trending Setter (rate a venue that hits #1).

---

## VIBE+ Premium Tier

Consumer subscription. Monthly and annual options. Paystack-powered.

**Unlocks:**
- Scene Frequency (VibeOscillator) waveform visualizer
- Oracle AI venue predictions
- Priority intel feeds
- Premium rank badges
- Early event intelligence

The free tier is genuinely useful — city map, VibeReactor, Vibe Rating, Scout identity, Cartel/Crew. VIBE+ is the layer on top, not a paywall on core functionality.

---

## Merchant Floor

### Live Dashboard

Real-time metrics updated every 30 seconds:
- Current energy score
- Active scout count
- Vibe sentiment breakdown (gate / capacity / energy %)
- Rating velocity (24h and 7d)
- Profile views

### Content Management

- Entry fee editor
- Music genre editor
- Table availability toggle
- Geofence radius adjustment (50–500m)

### Vibe Intelligence (Analytics)

- Hourly Energy Curve: 24h breakdown with peak hour identification
- Week-over-week comparison
- Vibe Killers: actionable alerts (gate blockage, energy drops, capacity issues)
- Scout Quality: visitor tier and rating history

### Pulse Drops (Merchant Promotions)

| Tier | Duration | Radius | Glow Boost |
|---|---|---|---|
| Spark | 2 hours | 2km | 20% |
| Flare | 4 hours | 5km | 40% |
| Supernova | 8 hours | 10km | 80% |

Supernova gets chart placement bonus.

### Energy Campaigns (Clout Multipliers)

Incentivize scouts to rate by multiplying their clout rewards. 2× and 3× options at 2h, 4h, 8h durations.

### Wallet

Paystack-powered. Top-up via bank transfer or card. Full transaction history. Atomic operations prevent double-charging.

### Aura Shield

Automated monitoring. Alerts merchant when venue vibeScore drops below configurable threshold (30–70 points).

---

## Admin Floor

### Treasury & Revenue

Global financial overview — revenue by city, pulse tier, per-transaction ledger, settlement tracking.

### Network Health

Live platform metrics: WebSocket connections, total/active venues and users, data freshness.

### Integrity Monitoring

Anomaly detection: sponsored vs organic venue comparison, unusual rating spikes, coordinated voting patterns.

### User Management

Search, profiles, tier distribution, ban/unban, clout airdrops with reason tracking.

### Venue Governance

Verification toggle, score override (manual with reason), suppress/unsuppress. Full audit trail on every action.

### Clout Economy Overview

Total clout in circulation, average per user, top 10 scout leaderboard, economy health monitoring.

---

## Agent API

Public REST endpoints for AI assistants, hotel concierge apps, and travel platforms.

- `GET /api/v1/agent/venues/live` — all live venues with energy labels
- `GET /api/v1/agent/venues/{id}` — single venue snapshot
- `GET /api/v1/agent/city/pulse` — city-level crowd pulse summary
- Auth: `X-Agent-Key` header or `?api_key=` query param
- API key management: issue, list, revoke (admin)

Energy labels: `PEAK` (≥85) / `HIGH` (≥70) / `BUILDING` (≥50) / `MODERATE` (≥30) / `LOW`

---

## Onboarding

Story-mode first experience. Scouts are walked through the platform via guided interactive screens before hitting the live map.

- `OnboardingFlow` — multi-step story sequence
- `AppTutorial` — in-app guided walkthrough with spotlight tooltips
- Triggered on first login, skippable after second screen

---

## Tech Stack

| Layer | Stack |
|---|---|
| Frontend | React Native + Expo SDK 54, TypeScript |
| Animations | react-native-reanimated v4 (worklets: react-native-worklets) |
| Canvas | @shopify/react-native-skia (GPU-accelerated) |
| State | Zustand + AsyncStorage |
| Real-time | Socket.IO client |
| Backend | FastAPI (Python) + MongoDB Atlas |
| Auth | Firebase Auth + JWT |
| Payments | Paystack (merchant/web), RevenueCat (iOS/Android IAP) |
| Sensors | expo-sensors (Accelerometer, tap) |
| Infra | Railway (backend), EAS (mobile builds) |

---

## Sensor Build Roadmap

| Phase | Sensor | Status |
|---|---|---|
| 1–2 | Tap rhythm + Vibe Rating | Live |
| 3 | Ambient decibel (opt-in) | Live |
| 4 | Kinetic / Accelerometer | In build |
| 5 | BLE proximity / crowd density | Pipeline |
| 6 | Biometric wearable (Apple Watch + Galaxy Watch HR) | Pipeline |

Each layer adds a proprietary signal no competitor can replicate without first building the user base. The sensor advantage is self-reinforcing.

---

*VIIBE — a live sensor network made of people.*
