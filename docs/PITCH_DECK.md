# VIIBE — Investor Pitch Deck
*Seed Round | March 2026*

---

## SLIDE 1 — THE HOOK

**It's 11pm on a Friday in Lagos.**

You're deciding between 6 venues. You've checked 3 Instagram pages — all of them say "come through, it's mad tonight." You make a call. Wrong venue. Empty room. Night wasted.

**₦10,000 entry fee. 45 minutes of your life. Zero information.**

---

## SLIDE 2 — THE PROBLEM

### The ₦1.5 Trillion Information Gap

Lagos's nightlife economy generates approximately ₦1.5 trillion (~$930M) in annual spend. Lagos alone has 4,000+ active nightlife venues across VI, Lekki, Ikoyi, Ikeja, and Surulere.

**But the information layer is broken:**

- No live venue data exists anywhere — social media is staged, delayed, and curated by promoters.
- Promoters always say "it's mad." There is no independent verification.
- A squad of 6 planning a night out needs a WhatsApp thread, phone calls, and someone willing to go first and report back.
- Venue owners have no real-time demand signal. They spend on influencer campaigns without knowing if their floor is empty or full.

**The market has money. The market has venues. The market is missing intelligence.**

---

## SLIDE 3 — THE SOLUTION

### VIIBE: Real-Time Nightlife Intelligence for Nigeria

VIIBE is a community-verified, live venue intelligence platform.

**The core loop:**
1. **Scouts** (users) physically visit venues and submit 60-second vibe ratings from inside the geofence.
2. Our **scoring engine** aggregates their reports into a live 0–100 Vibe Score per venue.
3. **Anyone** can see which venues are actually alive, right now, before they leave the house.
4. **Merchants** see the same data on their private dashboard and can amplify their signal with paid boosts.
5. **More users → more data → more accuracy → more useful → more users.** Flywheel.

No staging. No curation. Verified by real people, physically on location, with GPS enforcement.

---

## SLIDE 4 — THE PRODUCT

### Three Linked Products, One Platform

**The Public App — For Everyone**
The consumer experience. Find what's live tonight on a real-time map. See which venues are `peak`, `lit`, `charged`, `warming`, `chill`, or `quiet` — all from scouts actually inside right now.

**The Merchant Portal — For Venue Owners**
A private dashboard showing your venue's live performance. Rating volume, energy trend, crowd level, gate reports, historical timeline. Push-notification alerts when your score drops. Paid visibility tools when you need to pull a crowd.

**The Admin Console — For Platform Operators**
Full control over venue listings, merchant accounts, platform economics, and anti-cheat monitoring.

All three share one backend and one MongoDB database. One coherent platform, role-based access.

---

## SLIDE 5 — HOW IT WORKS (THE SCORING SYSTEM)

### The Most Defensible Piece of Our IP

A scout walks into Quilox at 11:30pm and submits a rating in under 60 seconds. They observe:
- **Energy:** What is the room feeling right now? (`quiet` / `chill` / `warming` / `lit` / `peak`)
- **Capacity:** How full is the venue? (`sparse` / `vibrant` / `full`)
- **Gate:** How is entry flowing? (`clear` / `slow` / `blocked`)
- **Vibe-specific:** Optional depth read — e.g., "DJ is killing it" vs "DJ is mellow"

Our scoring engine calculates:
```
Vibe Score = min(100, (Energy × 80% + Context × 20%) × Crowd Multiplier)
```

Energy dominates at 80%. A full venue cannot rescue a dead crowd. A packed house amplifies real energy.

Every score updates with time-decay weighting — a rating from 5 minutes ago counts 3× more than one from 45 minutes ago. When you look at a venue's score, you're seeing the freshest possible picture of the room.

This produces 6 display states:

| State | Trigger | Meaning |
|---|---|---|
| **PEAK** | Score ≥ 85 | Maximum energy. Get there now. |
| **LIT** | Score ≥ 65 | High energy. Night is in full swing. |
| **CHARGED** | Score 45–64, crowd full/vibrant | Potential energy — packed, about to blow. |
| **WARMING** | Score 45–64, sparse crowd | Building slowly. Check back later. |
| **CHILL** | Score 20–44 | Low key. Good for a quiet night. |
| **QUIET** | Score < 20 | Nearly empty. Not tonight. |

**CHARGED is our unique insight.** A packed venue at score 52 is fundamentally different from an empty venue at score 52. CHARGED tells you: 300 people are in the room, the DJ hasn't hit the first drop yet — get there before it blows.

---

## SLIDE 6 — THE DATA MOAT

### Why This Gets Harder to Replicate Over Time

**Network effects are the only moat that compounds.**

| Layer | What accumulates |
|---|---|
| Scout network | More scouts → more coverage → more accurate scores → more useful → more users |
| Historical snapshots | 90 days of nightly data enables Oracle predictions and pattern detection requiring no additional input |
| Scout accuracy graph | Consistently accurate scouts become `elite` tier — their reports carry implicit trust |
| Vibe DNA profiles | Every rating enriches each user's personalised nightlife fingerprint |

**VIIBE Certified** is the trust pinnacle: automatically awarded when a venue hits score ≥ 85 AND 80+ ratings in 24 hours simultaneously. Cannot be bought. Cannot be gamed. Certifies peak human activity with mathematical certainty.

A competitor launching today inherits zero of this. No scout network, no historical baseline, no trust graph, no DNA profiles. They start from scratch on every dimension.

---

## SLIDE 7 — MARKET SIZE

### Nigeria Is the Playbook. Africa Is the Prize.

**TAM — Total Addressable Market**
Sub-Saharan Africa entertainment and media economy:
- Nigeria is the #1 fastest-growing E&M market globally (PwC, 8.6% CAGR to 2028)
- Nigeria E&M industry: ~$14.8–15B (2025 forecast)
- Sub-Saharan Africa recorded music crossed $100M (2024); Afrobeats global streams +34% in 2024
- Primary nightlife markets: Nigeria, Ghana, Kenya, South Africa, Egypt

**SAM — Serviceable Addressable Market**
Nigeria nightlife, events, and venue discovery:
- 220 million population, median age 18.4
- Nigeria internet users: 107M (45.4% penetration); smartphones: 140M by end of 2025
- Lagos nightlife economy: ~₦1.5 trillion (~$930M) annually
- Lagos ranked #6 globally for nightlife (Time Out 2024), rising into top 15 in 2025
- 4,000+ licensed venues across 6 major cities
- Lagos top clubs average ₦360M in daily revenue; Detty December 2024 alone generated ₦4.32B across 12 days from clubs, with a total Lagos economic injection of $71.6M

**SOM — Serviceable Obtainable Market (3-year target)**
Lagos-first, expanding to Abuja + Port Harcourt + Ibadan:
- 50,000 MAU by Month 24
- 500 active merchant venues by Month 24
- ₦250M ($167K) ARR by end of Year 2

**The Afrobeats angle:** Nigerian nightlife culture is globalising. VIIBE has a natural export story into African diaspora markets in London, New York, and Toronto — cities where Afrobeats events are among the fastest-growing live entertainment categories.

---

## SLIDE 8 — BUSINESS MODEL

### Four Revenue Streams, Two Compounding

**1. VIIBE+ Subscriptions — ₦2,000/month (~$1.30 USD)**
Consumer premium tier. Unlocks: bolt reactions, priority feed, exclusive persona badges, unlimited Night Planner conversations.
- Target: 5% of MAU on VIIBE+
- 50K MAU × 5% × ₦2,000 = **₦5M/month** at Year 2 scale
- Platform note: iOS subscriptions use RevenueCat + Apple In-App Purchase (App Store Guideline 3.1.1 prohibits third-party processors like Paystack for iOS consumer subscriptions; Apple takes 15–30% platform fee). Paystack is used for web payments and all merchant B2B billing.

**2. Merchant SaaS — ₦150,000/venue/month**
Dedicated merchant dashboard tier: live performance analytics, crowd trend data, gate reports, historical timeline, and push-notification alerts. First 30 days free. No card required to trial.
- Target: 300 active merchants by Month 24 → **₦45M/month** at Year 2 scale

**3. Pulse Drops — ₦5,000 to ₦50,000 per activation**
Merchant paid visibility boost. Appears at top of trending feed. 2× clout multiplier for scouts during activation window incentivises real reports.

| Tier | Price | Duration | Radius | Score Boost |
|---|---|---|---|---|
| Spark | ₦5,000 | 2 hours | 2km | +20 |
| Flare | ₦15,000 | 4 hours | 5km | +40 |
| Supernova | ₦50,000 | 8 hours | City-wide | +100 |

- Target: 3 drops/month × 300 merchants × ₦15K avg = **₦13.5M/month** at Year 2 scale

**4. Data API — ₦50,000/month per enterprise subscriber**
Aggregated venue intelligence for event companies, taxi platforms, and F&B brands. Activates Month 18+ when data depth is B2B-sellable.

**Unit Economics:**
- VIIBE+ LTV: ₦36,000 | CAC: ₦800 → **LTV:CAC = 45:1**
- Merchant LTV: ₦1,800,000 | CAC: ₦6,000 → **LTV:CAC = 300:1**

---

## SLIDE 9 — TRACTION

### What We've Built (Pre-Seed, Self-Funded)

**Platform (Live):**
- Full-stack application deployed and running in production
- Frontend: Vercel (`vibe-app-hc83.vercel.app`)
- Backend: Railway (`vibeapp-production-1835.up.railway.app`)
- Database: MongoDB Atlas — 10 Lagos venues seeded with live data
- Demo Mode: investor-ready, full production quality at any time of day without requiring real scout density

**Phase 1 Intelligence Features (Built):**
- 6-state energy model with the CHARGED state differentiation
- Time-decay weighted aggregation (3× / 2× / 1× windows)
- **Vibe Oracle** — heuristic peak-time prediction per venue type + day of week, with confidence scores; demo-ready for 12 venues
- **Vibe DNA** — behavioural affinity fingerprint computed from rating history (6 scene types: block party, club, concert, lounge, bar, restaurant; dominant scene + night style profile)
- **Night Planner** — AI concierge powered by Claude (Anthropic); confirmed firing in production (ANTHROPIC_API_KEY active on Railway); falls back to rule-based scoring if API unavailable
- **Vibe Persona** — 4 archetypes (Turn Up / The Luxe / Culture Vulture / Chill Set) that reorder the venue feed to match user temperament
- **Top Scouts per venue** — ranked leaderboard of most active raters per location, driving social competition
- **Cartel Radar** — find nearby scouts by persona in real-time
- **Achievement badges + clout leaderboard** — 8 badge types with progress tracking

**Phase 2 Engagement Features (Built):**
- **VibeReactor** — circular charge ring + kinetic tap (accelerometer-based, reads G-force intensity); combo multiplier badge driven by BPM tap velocity; collective quest system; danger glow + quest burst animations. This is VIIBE's most distinctive UX mechanic — nothing like it exists in any venue discovery app globally. See Appendix E.
- **GlobalVibePill HUD** — persistent city-wide charge display, global geofence state, surge counter; the city becomes a collective organism
- **Dual Home Mode** — Scout mode (gamified clout + rating feed) vs. Insider mode (clean AI-generated intel sentences, no clout prompts); toggle pill in header; preference persisted across sessions. Two distinct user psychographics served from one product.
- **Venue Live System** — follow/unfollow venues, "I Dey Road" intent signal (enroute / maybe / pass, 3h TTL), merchant live push blasts (rate-limited to 30 minutes); real-time demand signalling between users and venues

**Monetisation (Built, Pending GTM):**
- VIIBE+ subscription flow — end-to-end functional (web via Paystack; iOS path via RevenueCat + Apple IAP)
- Pulse Drop purchasing and activation — end-to-end functional
- Merchant wallet top-up + spend tracking — functional

**Anti-Cheat (Live):**
- GPS geofence enforcement on every rating
- 30-minute cooldown + 3 ratings/day hard cap
- Burst detection with provisional rating holds
- VIIBE Certified automatic badge logic

**Seed milestone:** 5,000 MAU, 20 venues with consistent data, 5 paying merchants, 3 months demonstrable retention — all targeted within 18 months of funding.

---

## SLIDE 10 — GO-TO-MARKET

### Island-First. Community-First. Network-First.

**Phase 1 — The Island (Months 1–3)**
Victoria Island, Lekki Phase 1, Ikoyi. Highest venue density, highest smartphone penetration, highest spend per capita.

Activation: 3 "scout ambassador" nights per week. Select 10–15 early users per night, each assigned 2–3 venues. Compensate with VIIBE+ subscriptions (₦2,000/month value). We need their data more than their money in month 1.

**Phase 2 — The Merchants (Months 3–6)**
Once 20 venues have 30+ days of live data, the merchant sales conversation is immediate: show them their own dashboard. Live score, crowd trend, timeline. "This is your venue tonight. In real time." Free 30-day trial. No credit card required.

**Phase 3 — The Flywheel (Months 6–18)**
Product drives itself. Accelerate with: nightlife content creator partnerships (they embed VIIBE scores in their content), university ambassador programs (Unilag, Covenant, LASU feeder networks into VI), WhatsApp community seeding in existing nightlife groups.

**Phase 4 — City 2 (Month 12)**
Abuja. Smaller geography, tight social scene, predictable patterns for Oracle predictions, higher average spend per outing.

---

## SLIDE 11 — COMPETITION

| Competitor | What They Do | Why We Win |
|---|---|---|
| Yelp / Google Reviews | Static, delayed reviews | We are real-time. Reviews are after the fact. |
| Instagram / TikTok | Curated content by promoters | We are verified, anonymous, anti-bias |
| Table reservation apps | Booking, not discovery | We solve "where tonight?" not "book my table" |
| No tool (status quo) | WhatsApp, word of mouth | We are creating a new behaviour, not displacing one |

**Honest competitive risk:** A well-funded international player (Google Maps with live data) could attempt this. But:
- Building a scout network in Lagos requires local trust, local knowledge, and local payment rails — not a cheque.
- Our data moat starts compounding from Day 1. A competitor starting in 12 months inherits nothing.
- We will be the cultural reference for Nigerian nightlife intelligence before they finish due diligence.

---

## SLIDE 12 — TECHNOLOGY

| Layer | Tech | Why |
|---|---|---|
| Frontend | React Native (Expo 54) | iOS + Android + Web from one codebase |
| State | Zustand v5 | Offline-first, zero boilerplate |
| Backend | FastAPI (Python 3.11) | Async, fast, production-grade |
| Database | MongoDB Atlas | Flexible schema + native aggregation for scoring |
| Real-time | Socket.IO | Live score broadcasts, leaderboard updates |
| AI | Claude (Anthropic) | Night Planner + Vibe Intelligence. Degrades gracefully to rules if API unavailable. |
| Payments | Paystack (web/B2B) + RevenueCat/Apple IAP (iOS) | Full NG bank + USSD coverage; App Store compliant |
| Hosting | Vercel + Railway | Zero DevOps overhead. Scale to zero when idle. |

**AI is a feature, not a dependency.** The platform runs without Claude. If the API is unavailable, Night Planner falls back to keyword-based rules. We never put a third-party API on the critical path.

---

## SLIDE 13 — TEAM

*(Insert actual team bios here)*

**Founder / CEO:** [Name]
Lagos-native. Built [X]. Nightlife obsessive. Prior experience in [relevant domain].

**Technical Lead:** [Name]
Full-stack. Previously [X]. Responsible for all production architecture.

**What we're hiring with this round:**
- Community Manager — Lagos-based, runs scout ambassador program
- Backend Engineer — handles roadmap velocity
- Account Executive — merchant sales and onboarding

---

## SLIDE 14 — FINANCIALS SUMMARY

*(Full 5-year model in docs/FINANCIAL_MODEL.md)*

| Metric | Year 1 (2026) | Year 2 (2027) | Year 3 (2028) |
|---|---|---|---|
| MAU | 5,000 | 25,000 | 80,000 |
| VIIBE+ Subscribers | 250 | 1,250 | 4,000 |
| Active Merchants | 20 | 150 | 500 |
| Revenue (₦) | ₦8.3M | ₦89M | ₦352M |
| Revenue (USD) | $5.5K | $59K | $235K |
| Gross Margin | 72% | 83% | 89% |
| Break-Even | — | **Month 18 (Q3 2027)** | — |

Revenue mix at Year 3 scale: Merchant SaaS 45% · Pulse Drops 30% · VIIBE+ 15% · Data API 10%

Notes:
- Year 1 MAU target of 5,000 is the seed milestone, not post-seed scale.
- Gross margin reflects Apple IAP platform fee (15–30% on iOS consumer subscriptions) at Year 1; improves as web and Android mix grows.

---

## SLIDE 15 — THE ASK

### Raising $500K–$2M Seed Round

**18-month runway to seed milestone.**

Pre-money valuation: **$5M–$8M**

| Use of Funds | % | Notes |
|---|---|---|
| Engineering (2 engineers × 12mo) | 35% | Roadmap velocity + iOS App Store submission |
| Scout Network & Community | 25% | Ambassador program, Lagos Island activation |
| Merchant Sales (1 AE + events) | 20% | Onboarding pipeline, free trial conversions |
| Infrastructure & AI | 12% | Hosting, Claude API, RevenueCat, monitoring |
| Legal, compliance, admin | 8% | Entity, IP, data privacy |

**What this buys — Seed Milestone (18 months):**
- 5,000 MAU in Lagos (proving scout network is self-sustaining)
- 20 venues with 90+ days of continuous live data (proving data moat)
- 5 paying merchant accounts (proving B2B willingness-to-pay)
- 3 months demonstrable retention (proving the product creates habit)
- Series A ready: unit economics validated, cohort data in hand, Abuja expansion scoped

**Structure:** SAFE with standard pro-rata rights. MFN clause. No board seat at seed.

---

*VIIBE — Know before you go.*

---

## APPENDIX A — THE CHARGED STATE (DEEP DIVE FOR TECHNICAL INVESTORS)

Investors sometimes ask why 6 states and not a simple 1–5 scale.

**CHARGED** is the business case for the 6th state.

A venue with score 52 and 300 people inside is fundamentally different from a venue with score 52 and 30 people inside. In the first case: the crowd is assembled, the DJ is about to hit the first peak set — the night is about to explode. In the second: the room is sparse and going nowhere.

Both score 52 on a pure energy calculation. But the correct user action is completely opposite:
- 300-person venue: **"Leave now, you'll miss the peak window."**
- 30-person venue: **"Skip this one."**

CHARGED surfaces this distinction in a single label that users act on in under a second. This is the kind of insight that no static review platform can produce — it requires live data from inside the room combined with crowd context that only a geofenced rating system captures.

---

## APPENDIX B — ANTI-CHEAT SYSTEM (FOR TRUST-FOCUSED INVESTORS)

Five independent layers prevent rating manipulation:

1. **GPS geofence:** Rating rejected if coordinates are outside venue radius (100m default). You cannot rate a venue you are not physically at.

2. **Cooldown system:** 30-minute cooldown between ratings at the same venue. Hard cap of 3 ratings per venue per 24 hours.

3. **Burst detection:** Abnormal rating floods are flagged `provisional` and excluded from live aggregates. Coordinated promoter activity cannot move the score.

4. **Scout accuracy tracking:** Each scout's ratings are evaluated against venue consensus after-the-fact. Consistently accurate scouts reach `elite` tier. Low-accuracy raters drift toward `newbie`, de-incentivising volume gaming.

5. **VIIBE Certified:** Score ≥ 85 AND 80+ ratings simultaneously. Both must be true. Impossible to manufacture without genuine peak activity.

---

## APPENDIX C — VIBE DNA AS RETENTION FLYWHEEL

Vibe DNA creates a personalised affinity fingerprint per user from their full rating history. As users rate more venues, DNA becomes richer. The feed sorts venues by DNA match — high-club-affinity users see clubs higher.

The product gets more personalised the more you use it. After 50 ratings, VIIBE knows your nightlife preferences better than you do. After 100 ratings, you stop searching and start trusting the feed.

This is the personalisation compounding loop that consumer apps dream about — a recommendation layer that improves purely as a function of usage, requiring no additional ML infrastructure.

---

## APPENDIX D — NIGHT PLANNER AS FUTURE REVENUE LINE

Currently free (rules-based) with Claude-powered premium path. Natural evolution:

1. **VIIBE+ gating:** Multi-turn conversations unlimited for subscribers. Direct subscription driver.
2. **Venue referral model:** Planner recommendations that lead to check-ins earn the merchant a performance credit.
3. **Branded Planner experiences:** "Guinness Night Planner" — F&B brand-sponsored concierge powered by VIIBE data. B2B brand revenue.

Night Planner is currently a feature. It is building toward a dedicated revenue line.

---

## APPENDIX E — VIBEREACTOR & KINETIC INTELLIGENCE

### VIIBE's Most Distinctive UX Differentiator

Nothing like VibeReactor exists in any venue app globally. It transforms passive rating into a full-body, real-time participation mechanic.

**What it is:**
VibeReactor is a collective energy mechanism built directly into the scout rating flow. A circular charge ring fills as scouts tap — but the intensity of each tap is measured physically, not just counted.

**G-force tap intensity tiers:**
| Tier | G-Force | Response |
|---|---|---|
| Chill | < 1.5g | Standard charge contribution |
| Lit | 1.5g – 2.5g | Enhanced charge, haptic pulse |
| Peak | > 2.5g | Maximum charge burst, full haptic feedback |

The phone's accelerometer reads the velocity of the tap in real-time. A light tap from someone lukewarm about the room contributes less than a hard slam from someone who is genuinely in the moment. Physical intensity becomes a proxy for authentic energy — something no text-based rating system can capture.

**Collective mechanics:**
- Every scout in a geofenced venue contributes to a shared charge bar
- When the collective bar reaches critical mass, a city-wide surge event triggers
- The GlobalVibePill HUD displays the city's aggregate charge state in real-time — the entire city of Lagos becomes a single organism pulsing with collective energy
- Combo multipliers reward sustained engagement (BPM-driven velocity chains)
- Quest bursts unlock animated reward states

**Why this matters for investors:**
VibeReactor solves the cold-start engagement problem. New users in low-density markets have an intrinsic reason to tap — they are contributing to something larger than their individual rating. The mechanic creates emotional investment in the city's collective charge state. Retention is tied not just to "did I get useful information?" but "did I contribute to tonight's surge?"

This is VIIBE's most defensible product moment. It cannot be replicated by a feature addition to an existing app — it requires the entire scout network, geofence infrastructure, collective state management, and real-time aggregation pipeline to exist first. Incumbents cannot bolt this on.

---

*Contact: [founder@viibe.app]*
*Deck version: March 2026*
