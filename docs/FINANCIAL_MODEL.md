# VIIBE — Financial Model
*Seed Round | 5-Year Projections (2026–2030)*
*All figures in Nigerian Naira (₦) unless stated. Conversion rate: ₦1,500 = $1 USD*

---

## SECTION 1 — KEY ASSUMPTIONS

### Exchange Rate & Market
- ₦1,500 = $1 USD (conservative, based on parallel market average Q1 2026)
- Nigeria population: 220M | Lagos: 15–20M | Urban smartphone users Lagos: ~8M
- Annual entertainment spend (Nigeria): ₦2.3T ($1.53B USD)
- Licensed nightlife venues in Lagos: ~4,000 (clubs, bars, lounges, restaurants with nightlife component)
- Target venue market penetration by Year 3: 20% = 800 active merchant venues

### Product Pricing (Fixed for projection period)
| Product | Price | Notes |
|---|---|---|
| VIIBE+ Monthly | ₦1,500 | ~$1 USD. Deliberately low to maximise penetration |
| Pulse Drop — Spark | ₦5,000 | 2h, 2km radius, +20 score boost |
| Pulse Drop — Flare | ₦15,000 | 4h, 5km radius, +40 score boost |
| Pulse Drop — Supernova | ₦50,000 | 8h, city-wide, +100 score boost |
| Pulse Drop — Average | ₦15,000 | Weighted average (40% Spark, 40% Flare, 20% Supernova) |
| Campaign — Average | ₦8,000 | Mid-point across 2×/3× duration tiers |
| Data API | ₦50,000/month | Per enterprise subscriber. Activated Year 2 (Month 18+) |

### User & Merchant Growth Assumptions
- MAU growth: grassroots scout ambassador program + word of mouth + creator partnerships
- Merchant growth: direct sales (1 AE from Month 6) + product-led (merchants see their own data)
- VIIBE+ conversion: 5% of MAU (consumer apps globally 2–8%; 5% is conservative for a habit-forming utility)
- Merchant activity: avg 3 Pulse Drops/month + 1 campaign/quarter per active merchant
- Platform fee on wallet spend: 10% (taken from Paystack top-ups before spend)
- Churn (VIIBE+): 6% monthly | Churn (Merchant): 4% monthly

### Cost Assumptions
- Paystack processing fee: 1.5% + ₦100 per transaction
- MongoDB Atlas: $57/month (M10 shared cluster, scales to M30 at $200/mo by Year 2)
- Railway (backend): $20/month base, scales to $80/mo by Year 2
- Vercel (frontend): $20/month (Pro plan)
- Claude API (Haiku 4.5): $0.25/M input tokens, $1.25/M output tokens — estimated ₦3,000/month Year 1, ₦15,000/month Year 2
- Expo push notifications: Free tier covers first 10K/month; negligible cost thereafter
- Infrastructure TOTAL: ₦130K/month Year 1 → ₦300K/month Year 2

---

## SECTION 2 — REVENUE MODEL

### Stream 1: VIIBE+ Subscriptions

*Monthly recurring revenue from consumer premium tier.*

| Period | MAU | Conversion % | Subscribers | MRR (₦) | ARR (₦) |
|---|---|---|---|---|---|
| Month 6 | 1,000 | 5% | 50 | 75,000 | 900,000 |
| Month 12 | 5,000 | 5% | 250 | 375,000 | 4,500,000 |
| Month 18 | 12,000 | 5% | 600 | 900,000 | 10,800,000 |
| Month 24 | 25,000 | 5% | 1,250 | 1,875,000 | 22,500,000 |
| Month 36 | 80,000 | 5% | 4,000 | 6,000,000 | 72,000,000 |
| Month 48 | 200,000 | 5% | 10,000 | 15,000,000 | 180,000,000 |
| Month 60 | 500,000 | 5% | 25,000 | 37,500,000 | 450,000,000 |

### Stream 2: Pulse Drops (Merchant Paid Boosts)

*Transaction revenue from merchant visibility purchases.*

| Period | Active Merchants | Drops/Month/Merchant | Avg Price (₦) | MRR (₦) | ARR (₦) |
|---|---|---|---|---|---|
| Month 6 | 15 | 2 | 10,000 | 300,000 | 3,600,000 |
| Month 12 | 50 | 2.5 | 12,000 | 1,500,000 | 18,000,000 |
| Month 18 | 150 | 3 | 15,000 | 6,750,000 | 81,000,000 |
| Month 24 | 300 | 3 | 15,000 | 13,500,000 | 162,000,000 |
| Month 36 | 800 | 3.5 | 16,000 | 44,800,000 | 537,600,000 |
| Month 48 | 1,500 | 4 | 17,000 | 102,000,000 | 1,224,000,000 |
| Month 60 | 2,500 | 4 | 17,000 | 170,000,000 | 2,040,000,000 |

### Stream 3: Sponsored Campaigns

*Merchant campaign purchases (2× / 3× clout multipliers for defined windows).*

Assumed as 25% of Pulse Drop revenue (campaigns are recurring but less frequent than drops):

| Period | Campaign Revenue MRR (₦) |
|---|---|
| Month 12 | 375,000 |
| Month 24 | 3,375,000 |
| Month 36 | 11,200,000 |
| Month 60 | 42,500,000 |

### Stream 4: Data API (Enterprise)

*Monthly subscriptions for aggregated venue intelligence. Activates Month 18.*

| Period | Enterprise Subscribers | MRR (₦) |
|---|---|---|
| Month 18 | 2 | 100,000 |
| Month 24 | 5 | 250,000 |
| Month 36 | 15 | 750,000 |
| Month 60 | 50 | 2,500,000 |

---

## SECTION 3 — CONSOLIDATED REVENUE

| Year | VIIBE+ (₦) | Pulse Drops (₦) | Campaigns (₦) | Data API (₦) | TOTAL (₦) | TOTAL (USD) |
|---|---|---|---|---|---|---|
| **2026 (Y1)** | 1,687,500 | 4,500,000 | 1,125,000 | 0 | **8,312,500** | **$5,542** |
| **2027 (Y2)** | 11,250,000 | 60,750,000 | 15,187,500 | 1,500,000 | **88,687,500** | **$59,125** |
| **2028 (Y3)** | 45,000,000 | 245,000,000 | 61,250,000 | 6,000,000 | **357,250,000** | **$238,167** |
| **2029 (Y4)** | 112,500,000 | 735,000,000 | 183,750,000 | 18,000,000 | **1,049,250,000** | **$699,500** |
| **2030 (Y5)** | 337,500,000 | 1,530,000,000 | 382,500,000 | 30,000,000 | **2,280,000,000** | **$1,520,000** |

*Y1 = Jan–Dec 2026 (partial ramp). Revenue is back-half weighted as scout network builds.*

---

## SECTION 4 — COST STRUCTURE

### 4.1 Cost of Revenue (COGS)

| Item | Year 1 | Year 2 | Year 3 |
|---|---|---|---|
| Paystack fees (1.5% of GMV) | ₦124,688 | ₦1,330,313 | ₦5,358,750 |
| Infrastructure (hosting, DB, AI) | ₦1,560,000 | ₦3,600,000 | ₦6,000,000 |
| Push notifications (Expo) | ₦50,000 | ₦200,000 | ₦500,000 |
| **Total COGS** | **₦1,734,688** | **₦5,130,313** | **₦11,858,750** |
| **Gross Profit** | **₦6,577,813** | **₦83,557,188** | **₦345,391,250** |
| **Gross Margin** | **79%** | **94%** | **97%** |

### 4.2 Operating Expenses

| Category | Year 1 (₦) | Year 2 (₦) | Year 3 (₦) |
|---|---|---|---|
| **Personnel** | | | |
| Founder (deferred) | 0 | 3,600,000 | 7,200,000 |
| Engineers (0→2) | 14,400,000 | 28,800,000 | 43,200,000 |
| Community Manager | 4,800,000 | 7,200,000 | 9,600,000 |
| Account Executive (from M6) | 3,000,000 | 6,000,000 | 7,200,000 |
| **Personnel Total** | **22,200,000** | **45,600,000** | **67,200,000** |
| **Sales & Marketing** | | | |
| Scout ambassador program | 3,375,000 | 6,750,000 | 9,000,000 |
| Creator partnerships | 1,500,000 | 3,000,000 | 6,000,000 |
| Events / activations | 1,125,000 | 2,250,000 | 4,500,000 |
| **S&M Total** | **6,000,000** | **12,000,000** | **19,500,000** |
| **General & Admin** | | | |
| Legal & incorporation | 1,500,000 | 600,000 | 600,000 |
| Accounting / audit | 600,000 | 900,000 | 1,200,000 |
| Office / co-working | 600,000 | 1,200,000 | 1,800,000 |
| Miscellaneous | 300,000 | 600,000 | 900,000 |
| **G&A Total** | **3,000,000** | **3,300,000** | **4,500,000** |
| **Total OpEx** | **31,200,000** | **60,900,000** | **91,200,000** |

### 4.3 Total Expenses

| | Year 1 (₦) | Year 2 (₦) | Year 3 (₦) |
|---|---|---|---|
| COGS | 1,734,688 | 5,130,313 | 11,858,750 |
| OpEx | 31,200,000 | 60,900,000 | 91,200,000 |
| **Total** | **32,934,688** | **66,030,313** | **103,058,750** |

---

## SECTION 5 — P&L SUMMARY

| | Year 1 (₦) | Year 2 (₦) | Year 3 (₦) | Year 4 (₦) | Year 5 (₦) |
|---|---|---|---|---|---|
| Revenue | 8,312,500 | 88,687,500 | 357,250,000 | 1,049,250,000 | 2,280,000,000 |
| COGS | (1,734,688) | (5,130,313) | (11,858,750) | (25,000,000) | (45,000,000) |
| **Gross Profit** | **6,577,813** | **83,557,188** | **345,391,250** | **1,024,250,000** | **2,235,000,000** |
| **Gross Margin** | **79%** | **94%** | **97%** | **98%** | **98%** |
| Personnel | (22,200,000) | (45,600,000) | (67,200,000) | (90,000,000) | (120,000,000) |
| Sales & Marketing | (6,000,000) | (12,000,000) | (19,500,000) | (30,000,000) | (45,000,000) |
| G&A | (3,000,000) | (3,300,000) | (4,500,000) | (6,000,000) | (7,500,000) |
| **Total OpEx** | **(31,200,000)** | **(60,900,000)** | **(91,200,000)** | **(126,000,000)** | **(172,500,000)** |
| **EBITDA** | **(24,622,188)** | **22,657,188** | **254,191,250** | **898,250,000** | **2,062,500,000** |
| **EBITDA Margin** | **-296%** | **26%** | **71%** | **86%** | **90%** |
| **EBITDA (USD)** | **-$16,415** | **$15,105** | **$169,461** | **$598,833** | **$1,375,000** |

**Break-even: Month 18 (Q3 2027)**

---

## SECTION 6 — CASH FLOW PROJECTION

### Seed Raise: ₦112.5M ($75,000 USD) at Month 0

| Quarter | Opening Balance (₦) | Revenue (₦) | Expenses (₦) | Net Cash Flow (₦) | Closing Balance (₦) |
|---|---|---|---|---|---|
| Q1 2026 | 112,500,000 | 750,000 | 8,000,000 | (7,250,000) | 105,250,000 |
| Q2 2026 | 105,250,000 | 1,500,000 | 8,000,000 | (6,500,000) | 98,750,000 |
| Q3 2026 | 98,750,000 | 2,500,000 | 8,500,000 | (6,000,000) | 92,750,000 |
| Q4 2026 | 92,750,000 | 3,562,500 | 8,434,688 | (4,872,188) | 87,877,813 |
| Q1 2027 | 87,877,813 | 10,000,000 | 15,000,000 | (5,000,000) | 82,877,813 |
| Q2 2027 | 82,877,813 | 18,000,000 | 16,000,000 | 2,000,000 | 84,877,813 |
| Q3 2027 | 84,877,813 | 27,000,000 | 16,000,000 | **11,000,000** | **95,877,813** |
| Q4 2027 | 95,877,813 | 33,687,500 | 17,530,313 | 16,157,188 | 112,035,000 |

**Cash never drops below ₦82.9M.** Seed round provides >18 months of coverage with no additional raise required to reach break-even.

At break-even (Q3 2027), cumulative cash consumption from seed: ~₦29.6M out of ₦112.5M raised.

---

## SECTION 7 — UNIT ECONOMICS

### 7.1 VIIBE+ (Consumer Subscription)

| Metric | Value |
|---|---|
| Monthly Price | ₦1,500 |
| Average Tenure | 18 months |
| LTV | ₦27,000 ($18) |
| CAC (ambassador + organic) | ₦800 ($0.53) |
| **LTV:CAC Ratio** | **33.75:1** |
| Payback Period | < 1 month |
| Gross Margin (subscription) | 95% (Paystack fee only) |

### 7.2 Merchant (Pulse Drops + Campaigns)

| Metric | Value |
|---|---|
| Monthly Revenue per Merchant | ₦16,500 avg (3 drops + 1 campaign/quarter) |
| Average Tenure | 18 months |
| LTV | ₦297,000 ($198) |
| CAC (AE time + events + trials) | ₦6,000 ($4) |
| **LTV:CAC Ratio** | **49.5:1** |
| Payback Period | < 1 month |
| Gross Margin (Pulse Drops) | 97% (Paystack fee only) |

### 7.3 Blended Platform Economics (Year 2)

| Metric | Value |
|---|---|
| ARPU (MAU) | ₦3,547/year |
| Revenue per active merchant/month | ₦16,500 |
| Platform gross margin | 94% |
| CAC blended (all users) | ₦1,200 |
| LTV blended | ₦18,000 |
| **Blended LTV:CAC** | **15:1** |

---

## SECTION 8 — SENSITIVITY ANALYSIS

### Revenue Sensitivity — Year 2 (₦88.7M base case)

| Scenario | MAU | Merchant | VIIBE+ Conv% | Year 2 Revenue |
|---|---|---|---|---|
| **Bear Case** | 12,000 | 120 | 3% | ₦28.5M ($19K) |
| **Base Case** | 25,000 | 300 | 5% | ₦88.7M ($59K) |
| **Bull Case** | 45,000 | 500 | 7% | ₦198M ($132K) |

**Bear case break-even:** Month 24 (Q4 2027). Still within seed runway.
**Bull case break-even:** Month 14 (Q2 2027). Triggers earlier Series A.

### Key Sensitivities

| Variable | -20% impact | +20% impact |
|---|---|---|
| Merchant Pulse Drop frequency | -₦11M Y2 revenue | +₦11M Y2 revenue |
| VIIBE+ conversion rate | -₦2.25M Y2 revenue | +₦2.25M Y2 revenue |
| MAU growth (delayed by 2mo) | -₦8M Y2 revenue | — |
| FX deterioration (₦1,700=$1) | -12% USD yield | — |

**Pulse Drop frequency is the dominant lever.** Merchant engagement is the most controllable variable and has the highest revenue impact per percentage point.

---

## SECTION 9 — VALUATION FRAMEWORK

### Seed Round (February 2026)

| Method | Value |
|---|---|
| Pre-money valuation | ₦562.5M ($375K) |
| Raise amount | ₦112.5M ($75K) |
| Post-money valuation | ₦675M ($450K) |
| Equity offered | 20% |
| Implied revenue multiple (on Y2 projection) | 7.6× ARR |

**Comparable transactions:**
- African consumer tech seed rounds (2023–2025): $50K–$200K at $300K–$1M post-money
- SaaS marketplace businesses at seed: 8–15× ARR is standard
- At 7.6× projected Year 2 ARR, this is conservative for a marketplace with compounding data moat

### Series A Target (Month 18–24)

| Metric | Target |
|---|---|
| MAU | 25,000 |
| ARR | ₦88.7M ($59K) |
| Merchants | 300 |
| Series A Raise | ₦1.5B–₦2.25B ($1M–$1.5M) |
| Target valuation | 15–20× ARR = ₦1.33B–₦1.77B ($888K–$1.18M) |
| Use of A round | City expansion (Abuja, PH, Ibadan), team build-out, Data API productisation |

---

## SECTION 10 — KEY PERFORMANCE METRICS

### North Star: Weekly Active Scouts

The number of unique users who submit at least 1 rating per week. This drives everything — data quality, score accuracy, product utility, merchant value, and subscription conversion.

| Metric | Month 6 | Month 12 | Month 24 |
|---|---|---|---|
| MAU | 1,000 | 5,000 | 25,000 |
| Weekly Active Scouts | 200 | 1,000 | 5,000 |
| Ratings/week | 600 | 3,000 | 15,000 |
| Venues with live data | 30 | 80 | 200 |
| Average ratings/venue/day | 3 | 5 | 11 |

*A venue needs ~5 ratings/day to produce reliable, real-time scores. 11 ratings/day is the threshold where time-decay weighting has enough data to produce smooth, accurate curves.*

### Dashboard KPIs

| KPI | Target (Month 12) | Target (Month 24) |
|---|---|---|
| MAU | 5,000 | 25,000 |
| D7 Retention | 25% | 35% |
| D30 Retention | 15% | 22% |
| VIIBE+ Subscribers | 250 | 1,250 |
| Active Merchant Venues | 50 | 300 |
| Avg Ratings/Active Venue/Day | 5 | 11 |
| VIIBE Certified Venues | 2 | 15 |
| Monthly Gross Revenue (₦) | 693K | 7.4M |
| Platform MRR Growth MoM | 20%+ | 15%+ |

---

## SECTION 11 — RISK REGISTER

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Cold start problem (not enough scouts) | High | High | Scout ambassador program with VIIBE+ incentives from Day 1 |
| FX deterioration (Naira weakening) | Medium | Medium | Revenue is Naira-denominated; cost base is largely local; USD exposure is hosting only |
| Promoter backlash (venues blocking scouts) | Medium | Medium | Scouts are anonymous. Venue check-in is not required to rate. |
| Competitor entry (well-funded) | Low | High | Data moat + local trust + Paystack integration = 12–18 month head start minimum |
| Paystack outage / regulation change | Low | Medium | All payments are single-processor; diversify to Flutterwave as backup in Year 2 |
| Scout gaming / fake ratings | Medium | High | 5-layer anti-cheat system (geofence + cooldown + burst detection + accuracy tracking + VIIBE Certified) |
| Merchant churn before data value clicks | High (early) | Medium | Free 30-day trial removes the initial barrier; weekly performance emails demonstrate value |
| AI API cost blowout | Low | Low | Claude Haiku is $0.25/M tokens. Estimated $2/month Year 1. Even at 100× growth it's negligible. |

---

## APPENDIX — MONTHLY MODEL DETAIL (Year 1)

| Month | MAU | Merchants | VIIBE+ Sub | Pulse Drops Rev (₦) | VIIBE+ Rev (₦) | Total Rev (₦) | Total Expenses (₦) | Net (₦) |
|---|---|---|---|---|---|---|---|---|
| Jan 2026 | 100 | 3 | 5 | 45,000 | 7,500 | 52,500 | 2,450,000 | (2,397,500) |
| Feb 2026 | 200 | 5 | 10 | 75,000 | 15,000 | 90,000 | 2,500,000 | (2,410,000) |
| Mar 2026 | 400 | 8 | 20 | 120,000 | 30,000 | 150,000 | 2,600,000 | (2,450,000) |
| Apr 2026 | 700 | 12 | 35 | 180,000 | 52,500 | 232,500 | 2,700,000 | (2,467,500) |
| May 2026 | 1,100 | 18 | 55 | 270,000 | 82,500 | 352,500 | 2,750,000 | (2,397,500) |
| Jun 2026 | 1,600 | 25 | 80 | 375,000 | 120,000 | 495,000 | 2,750,000 | (2,255,000) |
| Jul 2026 | 2,200 | 30 | 110 | 450,000 | 165,000 | 615,000 | 2,800,000 | (2,185,000) |
| Aug 2026 | 2,800 | 35 | 140 | 525,000 | 210,000 | 735,000 | 2,750,000 | (2,015,000) |
| Sep 2026 | 3,400 | 40 | 170 | 600,000 | 255,000 | 855,000 | 2,750,000 | (1,895,000) |
| Oct 2026 | 4,000 | 44 | 200 | 660,000 | 300,000 | 960,000 | 2,750,000 | (1,790,000) |
| Nov 2026 | 4,600 | 47 | 230 | 705,000 | 345,000 | 1,050,000 | 2,784,688 | (1,734,688) |
| Dec 2026 | 5,000 | 50 | 250 | 750,000 | 375,000 | 1,125,000 | 2,800,000 | (1,675,000) |
| **Y1 Total** | | | | **5,355,000** | **1,957,500** | **8,312,500** | **32,934,688** | **(24,622,188)** |

*December 2026 run rate: ₦1.125M/month = ₦13.5M ARR. Break-even at ₦5.1M/month (Month 18 trajectory confirmed).*

---

*Model built February 2026. Assumptions reviewed quarterly against actuals.*
*All projections are forward-looking estimates based on comparable African consumer-tech benchmarks.*
