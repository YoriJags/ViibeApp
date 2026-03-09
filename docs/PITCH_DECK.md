# VIIBE — Investor Pitch Deck
*Seed Round | February 2026*

---

## SLIDE 1 — THE HOOK

**It's 11pm on a Friday in Lagos.**

You're deciding between 6 venues. You've checked 3 Instagram pages — all of them say "come through, it's mad tonight." You make a call. Wrong venue. Empty room. Night wasted.

**₦10,000 entry fee. 45 minutes of your life. Zero information.**

---

## SLIDE 2 — THE PROBLEM

### The ₦2.3 Trillion Information Gap

Nigeria's entertainment industry generates ₦2.3 trillion in annual spend. Lagos alone has 4,000+ active nightlife venues across VI, Lekki, Ikoyi, Ikeja, and Surulere.

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
| **PEAK** 🔥 | Score ≥ 85 | Maximum energy. Get there now. |
| **LIT** ⚡ | Score ≥ 65 | High energy. Night is in full swing. |
| **CHARGED** ⚡ | Score 45–64, crowd full/vibrant | Potential energy — packed, about to blow. |
| **WARMING** 🌡 | Score 45–64, sparse crowd | Building slowly. Check back later. |
| **CHILL** 😌 | Score 20–44 | Low key. Good for a quiet night. |
| **QUIET** 🌙 | Score < 20 | Nearly empty. Not tonight. |

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
Sub-Saharan Africa nightlife + entertainment economy:
- Estimated market: $42B USD annually
- Smartphone penetration growing 18% YoY
- Primary markets: Nigeria, Ghana, Kenya, South Africa, Egypt

**SAM — Serviceable Addressable Market**
Nigeria nightlife, events, and venue discovery:
- 220 million population, median age 18.4
- ₦2.3T ($1.5B) annual entertainment spend
- 4,000+ licensed venues across 6 major cities
- Lagos alone: 15–20 million people, highest discretionary spend in SSA

**SOM — Serviceable Obtainable Market (3-year target)**
Lagos-first, expanding to Abuja + Port Harcourt + Ibadan:
- 50,000 MAU by Month 24
- 500 active merchant venues by Month 24
- ₦250M ($167K) ARR by end of Year 2

**The Afrobeats angle:** Nigerian nightlife culture is globalising. VIIBE has a natural export story into the African diaspora markets in London, New York, and Toronto — cities where Afrobeats events are among the fastest-growing categories.

---

## SLIDE 8 — BUSINESS MODEL

### Four Revenue Streams, Two Compounding

**1. VIIBE+ Subscriptions — ₦1,500/month (~$1 USD)**
Consumer premium tier. Unlocks: bolt reactions, priority feed, exclusive persona badges, unlimited Night Planner conversations.
- Target: 5% of MAU on VIIBE+
- 50K MAU × 5% × ₦1,500 = **₦3.75M/month** at Year 2 scale

**2. Pulse Drops — ₦5,000 to ₦50,000 per activation**
Merchant paid visibility boost. Appears at top of trending feed. 2× clout multiplier for scouts during activation window incentivises real reports.

| Tier | Price | Duration | Radius | Score Boost |
|---|---|---|---|---|
| Spark | ₦5,000 | 2 hours | 2km | +20 |
| Flare | ₦15,000 | 4 hours | 5km | +40 |
| Supernova | ₦50,000 | 8 hours | City-wide | +100 |

- Target: 3 drops/month × 300 merchants × ₦15K avg = **₦13.5M/month** at Year 2 scale

**3. Sponsored Campaigns — ₦3,000–₦20,000 per campaign**
Clout multiplier campaigns (2× or 3×) tied to specific venues and time windows. Merchant buys real scout activity as a side effect of their spend.

**4. Data API — ₦50,000/month per enterprise subscriber**
Aggregated venue intelligence for event companies, taxi platforms, and F&B brands. Activates Month 18+ when data depth is B2B-sellable.

**Unit Economics:**
- VIIBE+ LTV: ₦27,000 | CAC: ₦800 → **LTV:CAC = 33.75:1**
- Merchant LTV: ₦297,000 | CAC: ₦6,000 → **LTV:CAC = 49.5:1**

---

## SLIDE 9 — TRACTION

### What We've Built (Pre-Seed, Self-Funded)

**Platform (Live):**
- Full-stack application deployed and running in production
- Frontend: Vercel (`vibe-app-hc83.vercel.app`)
- Backend: Railway (`vibeapp-production-1835.up.railway.app`)
- Database: MongoDB Atlas — 10 Lagos venues seeded with live data

**Scoring Intelligence (Live):**
- 6-state energy model with the CHARGED state differentiation
- Time-decay weighted aggregation (3× / 2× / 1× windows)
- Vibe Oracle: heuristic peak-time prediction per venue type + day of week
- Vibe DNA: personalised affinity fingerprints computed from rating history
- Night Planner: AI concierge powered by Claude Haiku (Anthropic)
- City Pulse: live city heartbeat with 30-minute sparkline

**Monetisation (Built, Pending GTM):**
- VIIBE+ subscription flow via Paystack — end-to-end functional
- Pulse Drop purchasing and activation — end-to-end functional
- Merchant wallet top-up + spend tracking — functional

**Anti-Cheat (Live):**
- GPS geofence enforcement on every rating
- 30-minute cooldown + 3 ratings/day hard cap
- Burst detection with provisional rating holds
- VIIBE Certified automatic badge logic

**Next milestone:** First 100 paying VIIBE+ scouts + 10 merchant partnerships in Lagos Island.

---

## SLIDE 10 — GO-TO-MARKET

### Island-First. Community-First. Network-First.

**Phase 1 — The Island (Months 1–3)**
Victoria Island, Lekki Phase 1, Ikoyi. Highest venue density, highest smartphone penetration, highest spend per capita.

Activation: 3 "scout ambassador" nights per week. Select 10–15 early users per night, each assigned 2–3 venues. Compensate with VIIBE+ subscriptions (₦1,500/month value). We need their data more than their money in month 1.

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
| AI | Claude Haiku 4.5 (Anthropic) | Night Planner + Vibe Intelligence. $0.25/M tokens. |
| Payments | Paystack | Only processor with full NG bank + USSD coverage |
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
| Active Merchants | 50 | 300 | 800 |
| Revenue (₦) | ₦8.3M | ₦89M | ₦352M |
| Revenue (USD) | $5.5K | $59K | $235K |
| Gross Margin | 78% | 88% | 92% |
| Break-Even | — | **Month 18 (Q3 2027)** | — |

Revenue mix at Year 3 scale: Pulse Drops 55% · VIIBE+ 20% · Campaigns 15% · Data API 10%

---

## SLIDE 15 — THE ASK

### Raising ₦112.5M ($75,000 USD) Seed Round

**18-month runway to break-even.**

| Use of Funds | % | Amount |
|---|---|---|
| Engineering (2 engineers × 12mo) | 35% | ₦39.4M |
| Scout Network & Community | 25% | ₦28.1M |
| Merchant Sales (1 AE + events) | 20% | ₦22.5M |
| Infrastructure & AI | 12% | ₦13.5M |
| Legal, compliance, admin | 8% | ₦9M |

**What this buys:**
- 10,000 MAU in Lagos by Month 12
- 150 active paying merchants by Month 12
- Phase 1 Abuja expansion launched
- Series A ready: live data moat established, paying cohorts proven, unit economics validated

**Terms:** ₦562.5M pre-money valuation (20% equity). SAFE with standard pro-rata rights.

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

*Contact: [founder@viibe.app]*
*Deck version: February 2026*
