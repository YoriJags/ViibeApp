# VIIBE — AI Intelligence Layer Research
*Researched: 2026-03-27 | Status: Approved for build*

---

## What World-Class Real-Time Platforms Use (Cross-Platform Patterns)

Every top platform (Bloomberg, Uber, Waze, Snapchat) treats the human report as a **noisy sensor** and runs a signal processing layer on top. Raw input never surfaces directly. VIIBE must do the same.

Key cross-platform insight: **data moats are only defensible when the data is real-time, human-verified, and longitudinal.** Scraped or synthetic data can be replicated. VIIBE's scout reports cannot.

---

## 8 AI Features — Priority Ranked

### TIER 1 — Build Now (Low Cost, High Impact)

#### 1. Scout Integrity Score (SIS)
- Hidden reliability weight per scout: 0–100 score
- New scouts start at 0.3× weight multiplier. Proven scouts reach 1.5×
- Weight determines how much a report moves the Pulse Score
- Score is NEVER shown to scouts (prevents gaming) — admin-only view
- Built from: GPS verification pass/fail, consensus accuracy, submission velocity, text/numeric contradiction rate
- **Why it matters:** The entire data product is worthless if reports can be gamed. This is your answer to every investor who asks "how do you prevent fakes?"

#### 2. Signal Extraction Layer (NLP on Scout Text)
- Every scout text submission → async GPT-4o-mini call → structured JSON output
- Extract: dominant vibe dimension, intensity modifier, contradiction flag, named entities (DJs, event names)
- Contradiction flag: text says "dead" + numeric = 9/10 → flag for SIS downweight
- Cost: < $0.001 per report at current GPT-4o-mini pricing
- Zero latency impact — run async post-submission
- **Why it matters:** Text data becomes machine-readable and AI-investable. Multi-modal signal fusion is the moat.

#### 3. Energy Decay Mechanic
- Pulse Score visually degrades after 45 mins without new ratings
- Visual: score fades/cools on venue card. Label shows "last rated Xh ago"
- Score does not persist as live data after 90 mins of no new reports
- **Why it matters:** Dead scores pretending to be live destroys trust faster than any other bug. This is both a trust feature AND a scout retention driver — scouts must rate frequently because scores expire.

#### 4. Comparative Framing
- Show: "Hotter than last Saturday at this time" or "Cooler than usual for a Friday"
- One query against historical data per venue, time-of-week bucketed
- Surfaces on venue card and venue detail screen
- **Why it matters:** A raw number (Pulse: 74) is meaningless without context. Context drives decisions.

### TIER 2 — Build in 90 Days

#### 5. Live Intelligence Feed
- Scrollable feed of AI-generated insight cards triggered by real statistical events
- Triggers: energy spike >30pts in <15min, 3+ simultaneous scout reports, venue approaching historical peak, multi-venue peak window, city-level energy threshold
- Card structure: template-generated sentence + statistical fact + 45-min expiry
- Example cards:
  - *"Pulse at Quilox just jumped 38 points — 4 scouts reporting simultaneously. Energy: PEAK."*
  - *"3 venues in Victoria Island are in peak state right now. Rare multi-peak window."*
  - *"Lagos Friday pattern: energy shifts from Island to Mainland after 2am. Currently 1:47am."*
- No LLM hallucination risk — templates fill in verified statistical data only
- **Why it matters:** This is the Bloomberg headline ticker for live scene intelligence. Investors will immediately understand it.

#### 6. Scout Streak + Territory Leaderboard
- Streak: consecutive days/weeks with at least 1 verified scout rating
- Territory Leaderboard: Top scouts by neighborhood, weekly reset (prevents permanent hierarchy)
- Title worth defending: "Top Scout — Victoria Island" displayed on scout profile
- **Why it matters:** Primary supply-side retention mechanic. Scouts who have a streak and a title defend them. Weekly reset means new scouts can always compete.

### TIER 3 — Build at Scale (Needs Data Volume)

#### 7. Pulse Forecast (60-Minute Prediction)
- "Energy at Quilox is trending toward peak in ~45 min based on current trajectory + Friday historical pattern"
- Needs 30 days of data per venue to build reliable curves
- Cross-venue spillover detection: when major venue hits capacity, nearby venues spike 20–40 mins later
- **Why it matters:** Real-time alone is a feature. Real-time + predictive is a product. This is the single biggest differentiator vs. Google Maps Popular Times.

#### 8. Vibe Match (Vector Recommendations)
- User selects 3–5 energy descriptors → vector similarity search against live venue states → ranked matches
- Infrastructure: pgvector (free Postgres extension, zero additional cost on Supabase/Railway)
- Venue embeddings built from historical Pulse Scores + crowd type tags + peak time patterns + scout text corpus
- User preference embeddings built from check-in history + time-of-night patterns
- **Why it matters:** Consumer face of your vector database. "Find me a venue matching my energy right now."

---

## AI Infrastructure Costs at MVP Scale

| Capability | Monthly Cost (VIIBE MVP) |
|---|---|
| LLM inference (Signal Extraction) | < $20/month at 50K reports |
| Vector database (pgvector) | Free — lives in existing Postgres |
| Anomaly detection | AWS Lookout or rule-based — < $10/month |
| Comparative framing queries | Zero — MongoDB aggregation |
| Total AI infra | < $50/month |

This was a $5,000+/month infrastructure problem 24 months ago. The AI boom made this affordable for a solo founder.

---

## Data Moat Strength Analysis

| Signal | Defensibility | Why |
|---|---|---|
| Tap rhythm | Medium | Proprietary but replicable mechanic |
| Scout text (NLP-enriched) | High | Human judgment + AI extraction = unique |
| Geospatial + temporal | Very High | Time-series data creates switching costs |
| Ambient decibel | High | No consumer product captures this |
| Biometric (future) | Extreme | Verified emotional response data — irreplaceable |

**The lock-in:** Once a buyer (brand, betting operator, city government) has 18 months of VIIBE longitudinal data, they cannot switch. No new entrant can give them the historical time series.

---

## Competitive Landscape

| Competitor | What They Have | What They're Missing |
|---|---|---|
| Google Popular Times | Passive foot traffic (phone pings) | Human judgment, energy dimensions, qualitative signal |
| Foursquare/Placer.ai | Location intelligence B2B | Real-time consumer product, scout layer |
| PredictHQ | Event impact on demand | Crowd energy layer, no scouts |
| Skiddle / Fever | Event discovery | Real-time energy, no scouts |
| **Nobody** | **Real-time human energy ratings** | **VIIBE owns this** |

**The competitive moat sentence:** "We know what's happening now AND what will happen in 45 minutes — powered by human scouts whose accuracy is verified by AI."

---

## Investor-Attracting Framing (2026)

1. **Data flywheel narrative** — every scout report makes AI smarter, which improves recommendations, which attracts more users
2. **Predictive + real-time combination** — not just live but forecasting
3. **Proprietary training data** — labeled, human-generated, real-time event data that no model trained on internet text has
4. **"Bloomberg Terminal for live scenes"** — investors who understand Bloomberg understand the data business, subscription moat, and professional user segment
5. **Multi-modal signal fusion** — numeric + text + geolocation + temporal + ambient = defensible product, not a feature

---

*Source: Research synthesized 2026-03-27 from Waze, Snapchat, Bloomberg, Sportradar, Placer.ai, Foursquare, PredictHQ, YC batch analysis, and AI infrastructure cost benchmarks.*
