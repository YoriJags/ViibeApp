# VIBEZ — Clout System Specification
## Gamification Engine · v1.0 · February 2026

> **What is Clout?**
> Clout is Vibez's in-app reputation currency. It represents a scout's contribution to the platform's data quality. The more accurate, timely, and active a scout is, the more clout they accumulate. Clout drives rank progression, leaderboard placement, and unlocks privileges. It is also the mechanism by which merchants incentivize scout activity — making it the economic bridge between the scout economy and the merchant revenue layer.

---

## 1. CLOUT SOURCES

All clout earned in a session is the product of a base value × stacked multipliers.

### 1.1 Base Clout — Rating Submission

| Condition | Clout Earned |
|-----------|-------------|
| Base rating (any venue) | `accuracy_delta / 10` *(see §6 Accuracy)* |
| Venue is hot (vibe score > 70) | +5 bonus added to base |

**Minimum earned per rating:** 1 clout point
**Maximum earned per rating (no multipliers):** ~15 clout points

### 1.2 Streak Milestone Bonuses (one-time per milestone)

Awarded once when the milestone is first crossed.

| Streak Length | One-Time Clout Bonus | Badge Unlocked |
|---------------|---------------------|----------------|
| 3 days | +5 | — |
| 7 days | +15 | 🔥 "On Fire" |
| 14 days | +30 | — |
| 30 days | +50 | 🏆 "Legend" |

### 1.3 Squad Bonus

Awarded when 3 or more crew members rate the **same venue** within a **1-hour window**.

| Trigger | Clout Bonus |
|---------|-------------|
| Squad convergence (≥3 crew at same venue within 1h) | +10 per member |

The bonus is applied to each qualifying member individually — not shared.

### 1.4 Campaign Bonus (Merchant-driven)

Venue owners can run **Energy Campaigns** with a custom clout multiplier (set via the Merchant dashboard). When a scout rates a campaign-active venue:

| Campaign Tier | Multiplier |
|---------------|-----------|
| Standard campaign | 2× |
| Premium campaign | 3× |

The multiplier applies to the **base clout** (before streak multiplier, after Pulse Drop multiplier).

---

## 2. MULTIPLIER STACK

Multiple multipliers can apply simultaneously and are **additive in sequence** (not combined into a single flat rate — order matters).

```
Final Clout = BASE × pulse_multiplier × campaign_multiplier × streak_multiplier
```

**Example:**
- Base: 8 clout
- Pulse Drop active (2×): 8 × 2 = 16
- Campaign active (2×): 16 × 2 = 32
- Streak 7 days (1.7×): 32 × 1.7 = 54 clout → rounded down → 54

| Multiplier | Source | When Active |
|-----------|--------|-------------|
| **2×** | Pulse Drop (any tier) | Venue has active Pulse Drop |
| **2× or 3×** | Energy Campaign | Merchant-launched campaign |
| **1.0× → 2.0×** | Streak (linear) | Consecutive daily activity |

**Max theoretical clout per rating:**
Hot venue base (15) × Pulse (2×) × Campaign (3×) × Streak 10d (2×) = **180 clout**
*(Engineered to be rare — requires simultaneous merchant investment + scout dedication)*

---

## 3. SCOUT RANK TIERS

Rank is determined by a combination of **total ratings** and **accuracy score**. Accuracy takes precedence at the top tiers — a high-volume but inaccurate scout cannot reach Elite.

### 3.1 Tier Table

| Tier | Label | Min Ratings | Min Accuracy | Badge Color |
|------|-------|-------------|--------------|-------------|
| 0 | **Newbie** | 0 | — | `#666666` Gray |
| 1 | **Regular** | 10 | — | `#00D4FF` Cyan |
| 2 | **Scout** | 25 | 70%+ | `#FFD700` Gold |
| 3 | **Elite** | 50 | 80%+ | `#FF3366` Pink |

### 3.2 Tier Benefits

| Benefit | Newbie | Regular | Scout | Elite |
|---------|--------|---------|-------|-------|
| Rate venues | ✅ | ✅ | ✅ | ✅ |
| Appear on leaderboard | ✅ | ✅ | ✅ | ✅ |
| Skip cooldown with clout | ❌ | ✅ | ✅ | ✅ |
| Profile public to others | ❌ | ✅ | ✅ | ✅ |
| Priority in Cartel Radar | ❌ | ❌ | ✅ | ✅ |
| Elite border ring on profile | ❌ | ❌ | ❌ | ✅ |
| *(Planned)* Early access to Pulse Drop bonuses | ❌ | ❌ | ❌ | ✅ |

### 3.3 Demotion Policy

Tiers are **not retroactively removed** — a scout who drops below the accuracy threshold keeps their tier until they reach the next tier's threshold. Accuracy decay only applies to future tier progression checks, not existing tier status. *(This encourages scouts to keep rating rather than fearing demotion.)*

---

## 4. STREAK SYSTEM

### 4.1 How Streaks Work

A streak is the number of **consecutive calendar days** a scout has been active (submitted at least one rating or check-in).

- Activity is measured by calendar day in **WAT (West Africa Time, UTC+1)**
- A streak extends if the scout is active the day **immediately following** the last active day
- Missing a day resets the streak to 1 (not 0 — the day they return counts as day 1)

### 4.2 Streak Clout Multiplier

Applied automatically to every rating while streak is active.

```
multiplier = 1.0 + min(streak_days × 0.1, 1.0)
```

| Streak Days | Multiplier | Example (10 base) |
|-------------|-----------|------------------|
| 1 | 1.1× | 11 clout |
| 3 | 1.3× | 13 clout |
| 5 | 1.5× | 15 clout |
| 7 | 1.7× | 17 clout |
| 10 | 2.0× | 20 clout |
| 10+ | **2.0× (cap)** | 20 clout |

The multiplier caps at **2.0× at 10 consecutive days**. There is no further increase beyond 10 days (milestone bonuses are separate one-time grants).

### 4.3 Streak Display

- **StreakBadge** component shows a flame icon with the streak count
- Flame color progresses: Gray (1-2) → Orange (3-6) → Red (7-13) → **Gold (14+)**
- Active multiplier is shown as a chip: `1.5×` beside the flame

### 4.4 Streak Freeze *(Planned — Month 6)*

Elite scouts will be able to freeze a streak once per 30-day period using 100 clout. This prevents a missed day from breaking a long streak. Details TBD.

---

## 5. RATING COOLDOWN & SKIP

### 5.1 Cooldown Rules

To prevent rating spam and maintain data integrity:

| Rule | Value |
|------|-------|
| Max ratings per venue per 24h | **2** |
| Applies per user–venue pair | Yes |
| Cooldown resets at | 24h after first rating of the day for that venue |

### 5.2 Skip Options

A scout who hits the 2-rating limit can bypass the cooldown via two methods:

| Method | Cost | Notes |
|--------|------|-------|
| **Clout Skip** | 50 clout points | Clout is deducted immediately |
| **Payment Skip** | ₦100 (~$0.07) | Micro-payment via Paystack |

Cooldown skips are rare by design — the limit exists primarily to ensure no single user can dominate a venue's vibe score with repetitive identical ratings.

---

## 6. ACCURACY SCORING

### 6.1 How Accuracy is Calculated

Each time a scout submits a rating, the system compares their rating against the **current venue average vibe score**. The closer to the consensus, the higher the accuracy:

```
rating_accuracy = 100 - |user_rating_score - venue_current_vibe_score|
```

A running average is maintained across all of a scout's ratings:

```
new_accuracy = ((prev_accuracy × prev_total_ratings) + rating_accuracy) / (prev_total_ratings + 1)
```

### 6.2 What Accuracy Affects

- **Clout base amount**: Base = `accuracy_delta / 10`
- **Scout tier eligibility**: Scout (70%+), Elite (80%+)
- **Leaderboard ranking weight**: Accuracy is a tiebreaker in Top Scouts leaderboard
- **Displayed on profile**: "92% accuracy — Elite Scout"

### 6.3 Accuracy Incentive Design

Accuracy rewards scouts who rate honestly and calibrate their ratings to the ground truth signal. A scout who consistently rates venues higher or lower than consensus builds a low accuracy score, reducing their clout earnings. This is the **data quality mechanism** — the app gets better data because scouts are incentivised to be accurate.

---

## 7. LEADERBOARDS

Three live leaderboards update continuously.

### 7.1 Top Scouts (Last 24h)

Sorted by: `check_in_count` (descending)
Shown: clout_points, accuracy_score, tier badge, ring color

Purpose: Daily competition loop — resets each day, giving every scout a shot.

### 7.2 Streak Leaderboard

Sorted by: `current_streak` (descending)
Shown: current streak, longest streak, active multiplier

Purpose: Long-term engagement — rewards consistency over volume.

### 7.3 Venue Trending (City)

Sorted by: `trending_score` (not clout — this is a venue leaderboard, not scout)

```
trending_score = (avg_energy_last_1h × 0.5)
              + (check_in_velocity × 0.3)
              + (weighted_scout_count × 0.2)
```

**Time-decay weights within the trending formula:**
- Ratings from last 15 min: 3× weight
- 15–30 min: 2× weight
- 30–60 min: 1× weight

**Pulse Drop overrides:** Supernova tier → forced #1 placement. Flare tier → forced top-3 placement. These placements are clearly labelled as "BOOSTED" to maintain trust.

---

## 8. PULSE DROP MECHANICS (Merchant side of Clout)

Pulse Drops are the merchant revenue tool that creates a **direct financial incentive loop** with scout clout earnings.

### 8.1 Pulse Drop Tiers

| Tier | Price (₦) | Radius | Duration | Chart Override | Clout Effect |
|------|-----------|--------|----------|----------------|--------------|
| Spark | ₦5,000 | 2km | 2 hours | None | 2× clout for scouts |
| Flare | ₦15,000 | 5km | 4 hours | Top 3 | 2× clout for scouts |
| Supernova | ₦50,000 | City-wide | 8 hours | #1 forced | 2× clout for scouts |

**All Pulse Drop tiers give scouts 2× clout** regardless of tier. The tier difference is about visibility radius and leaderboard placement — not the scout incentive.

### 8.2 Why This Loop Matters

- Merchant pays ₦15K for a Flare → scouts see 2× clout on that venue → scouts rush to rate it → venue's vibe score gets more data → venue gets social proof → foot traffic → merchant pays again
- This is the **flywheel**: merchant spend → scout activity → platform data → platform value → more merchants

---

## 9. PERSONA SYSTEM *(Current state: stub — not yet gameplay-impacting)*

Personas are personality archetypes that categorize scouts by their rating behavior and venue preferences.

### 9.1 Persona Types (Current)

| Persona | Description |
|---------|-------------|
| `turn_up` | High-energy clubs, late nights, peak hours |
| `grown_sexy` | Upscale venues, lounges, premium experiences |
| `culture` | Concerts, art events, community gatherings |
| `chill_set` | Low-key bars, rooftops, daytime venues |

### 9.2 Current Implementation

Personas are currently **user-selected** (stored in vibeStore as a preference field). They do not affect clout calculations, leaderboard placement, or any gameplay mechanic yet.

### 9.3 Planned: Rule-Based Persona Assignment *(Month 6)*

Personas will be auto-assigned from rating history — similar to how Vibe DNA works:

1. Aggregate scout's ratings by venue_type and rating time-of-day
2. Assign persona based on dominant pattern:
   - Most ratings at clubs after midnight → `turn_up`
   - Most ratings at lounges/fine dining → `grown_sexy`
   - Most ratings at concerts/community events → `culture`
   - Most ratings at bars/rooftops/daytime → `chill_set`
3. Persona displayed on scout profile + in Cartel Radar filter

### 9.4 Planned: Persona-Based Clout Bonuses *(Month 9)*

A scout rating their "native" venue type (matching their persona) gets a small bonus:

| Scenario | Bonus |
|----------|-------|
| Rating a venue type that matches your persona | +3 clout |
| Verified rating (check-in confirmed) matching persona | +5 clout |

---

## 10. ECONOMY DESIGN PRINCIPLES

### 10.1 Clout Sinks (Where Clout is Spent)

For the clout economy to avoid inflation, scouts must have reasons to spend:

| Sink | Cost | When |
|------|------|------|
| Cooldown skip | 50 clout | Live now |
| *(Planned)* Streak freeze | 100 clout | Month 6 |
| *(Planned)* Boost a crew mate's post | 25 clout | Month 9 |
| *(Planned)* Custom profile badge | 500 clout | Month 12 |
| *(Planned)* Early access to new features | 200 clout | Month 12 |

### 10.2 Anti-Inflation Guards

- Rating cooldown (2/venue/24h) limits supply
- Accuracy floor — low accuracy scouts earn far less per rating
- Streak reset — losing a streak dramatically reduces multiplier
- No clout-for-money conversion — clout stays on-platform (no cash-out mechanism planned — keeps focus on status, not income)

### 10.3 Data Quality as the Primary Design Goal

Every clout mechanic should serve data quality:
- Accuracy scoring → rewards honest ratings
- Streak system → rewards consistent presence (more data points over time)
- Squad bonus → rewards group verification of the same venue (corroborates data)
- Cooldown → prevents individual gaming of a venue's score

---

## 11. FEATURE STATUS AUDIT

| Feature | Backend | Frontend | Live | Notes |
|---------|---------|----------|------|-------|
| Base clout on rating | ✅ `vibe.py` | ✅ CloutReward toast | ✅ | |
| Hot venue +5 bonus | ✅ `vibe.py` | — | ✅ | |
| Pulse Drop 2× multiplier | ✅ `vibe.py` | ✅ leaderboard chip | ✅ | |
| Campaign multiplier | ✅ `ratings.py` | — | ✅ | Merchant-set |
| Streak multiplier | ✅ `streaks.py` | ✅ StreakBadge | ✅ | |
| Streak milestones | ✅ `streaks.py` | ✅ AchievementBadge | ✅ | |
| Squad bonus | ✅ `ratings.py` | — | ✅ | |
| Accuracy scoring | ✅ `vibe.py` | ✅ profile display | ✅ | |
| Scout rank tiers | ✅ `leaderboard.py` | ✅ tier badge | ✅ | |
| Top Scouts leaderboard | ✅ `leaderboard.py` | ✅ | ✅ | |
| Streak leaderboard | ✅ `streaks.py` | — | ✅ | Backend ready |
| Venue trending leaderboard | ✅ `leaderboard.py` | ✅ | ✅ | |
| Rating cooldown | ✅ `ratings.py` | ✅ | ✅ | 2/venue/24h |
| Cooldown skip (clout) | ✅ | ✅ vibeStore | ✅ | 50 clout |
| Cooldown skip (payment) | ✅ | ✅ Paystack | ✅ | ₦100 |
| Persona system | ❌ backend | ✅ vibeStore stub | ❌ | Planned Month 6 |
| Streak freeze | ❌ | ❌ | ❌ | Planned Month 6 |
| Persona clout bonuses | ❌ | ❌ | ❌ | Planned Month 9 |
| Custom profile badges | ❌ | ❌ | ❌ | Planned Month 12 |

---

*VIBEZ · Clout Spec v1.0 · February 2026*
*Next review: Month 3 post-launch (adjust based on scout behavior data)*
