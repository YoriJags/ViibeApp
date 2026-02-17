# Vibez - The Vibe-ID Protocol for African Nightlife

> Real-time venue intelligence. Social proof you can feel. The operating system for nights out.

---

## What Is Vibez?

Vibez is a real-time venue intelligence and social reputation platform built for African nightlife. It answers the question every person going out asks: **"Where should I go tonight, and is it worth it?"**

Instead of relying on outdated reviews or Instagram stories from last weekend, Vibez uses live scout reports from people actually at venues right now. Every rating is geofence-verified -- you can only rate a venue if you're physically there. This creates a trust layer that doesn't exist anywhere else.

The app operates on three "floors":
- **Public Floor** -- Scouts (regular users) rate venues, check in, build clout, and coordinate with their Vibez Cartel
- **Merchant Floor** -- Venue owners see live analytics, run promotions, and protect their reputation
- **Admin Floor** -- Platform governance with treasury oversight, integrity monitoring, and economy management

---

## Core Concept: The Vibe Score

Every venue has a live Vibe Score (0-100) calculated from three axes:

| Axis | Options | What It Measures |
|------|---------|-----------------|
| **Energy** | Chill / Popping / Electric | How alive is the crowd? |
| **Capacity** | Sparse / Vibrant / Full | How packed is it? |
| **Gate** | Clear / Slow / Blocked | Can you actually get in? |

The score updates in real-time as scouts submit ratings. A venue's score at 9PM is different from its score at midnight -- and that's the point. Vibez shows you what's happening *right now*.

**Color coding:**
- Blue (0-40): Chill
- Purple (40-60): Moderate
- Orange (60-80): Popping
- Pink/Red (80-100): Electric

---

## Public Floor Features

### 1. Tonight's Journey (Adaptive Home Screen)

The home screen isn't a static dashboard -- it's a narrative that adapts to where you are in your night.

**Phase 1: The Warm-Up** (evening, no check-in)
- Shows the city's energy level ("Lagos is ELECTRIC tonight")
- VibeMatch recommendation: your top venue match with compatibility percentage
- Cartel activity teaser: how many of your people are already out
- Call-to-action: "See Tonight's Picks"

**Phase 2: Locked In** (active check-in at a venue)
- Shows your current venue name and live vibe score
- Real-time clout counter (points earned tonight)
- Badge proximity: "2 more check-ins for Night Owl badge"
- Call-to-action: "Rate the Vibe"

**Phase 3: The Recap** (morning after)
- Summary: venues visited, total clout earned, badges unlocked
- Best moment highlight
- Call-to-action: "Share Your Night"

### 2. Live Venue Map

Interactive map showing all venues in your city with real-time data:
- Venue pins color-coded by energy level
- Category filtering: Clubs, Lounges, Restaurants, Bars, Churches, Concerts, Raves, Festivals, Events
- City selector: Lagos, Abuja, Port Harcourt, Ibadan
- Tap any venue for live stats, ratings history, and stories
- "Rate Venue" floating button when you're near a spot
- Swipe between map and list view

### 3. Vibe Rating System

The core mechanic. Tap a venue, rate it across three axes, optionally snap a photo.

**Rules:**
- Must be within the venue's geofence (GPS-verified, typically 100m radius)
- Maximum 3 ratings per venue per day
- Second rating in 24 hours counts as a "correction" (supersedes the first)
- Photo upload optional (500KB max)
- Works offline -- ratings queue and sync when connection returns

**Rewards:**
- 5-10 clout points per rating (varies by accuracy)
- Streak multiplier: up to 2x for consecutive daily activity
- Campaign multiplier: 2-3x during merchant promotions

### 4. Ghost Check-Ins

Stealth presence system. Check in to a venue to show you're there without broadcasting it to everyone.

- Geofence-enforced (must be physically present)
- 4-hour auto-expiry
- Shows on your Cartel's radar so your people know where you are
- Contributes to venue headcount ("X scouts here now")
- Earns 2 clout points per check-in
- Check-in celebration animation on success

### 5. Clout Economy

Clout is the universal reputation currency. Everything you do earns clout, and clout determines your scout tier.

**Scout Tiers:**
| Tier | Requirement | Badge Color |
|------|------------|-------------|
| Newbie | 0-9 ratings | Grey |
| Regular | 10-24 ratings | Cyan |
| Scout | 25-49 ratings | Gold |
| Elite | 50+ ratings | Pink |

**Clout Sources:**
- Rating: +5-10 points
- Check-in: +2 points
- Story post: +5 points
- Story goes viral (20+ views): +10 bonus
- Cartel vote participation: +3 points
- Streak milestones: +50 to +1000 points

**Rating Accuracy Score:** Your ratings are compared against other scouts at the same venue/time. Higher agreement = higher accuracy percentage = higher clout rewards.

### 6. Vibe Streaks

Consecutive daily activity tracking with escalating rewards.

- Any daily action counts (rating, check-in, story)
- Multiplier: 1.0x + 0.2x per consecutive day (caps at 2.0x)
- 24 hours of inactivity breaks the streak

**Milestone Rewards:**
| Day | Clout Bonus |
|-----|------------|
| 7 | +50 |
| 14 | +100 |
| 30 | +300 |
| 60 | +500 |
| 90 | +1,000 |

### 7. Vibez Cartel (Squad Coordination)

Your crew. Your people. The Vibez Cartel is how you coordinate nights out.

- **Create a Cartel**: Name it (2-20 characters), get an invite code
- **Join a Cartel**: Enter a 6-character code, max 8 members
- **Live Radar**: See which Cartel members are checked in and where
- **Cartel Vote**: Captain starts a venue vote (2-4 options), members vote, winner gets highlighted on the map
- **CartelPulse Card**: Compact card on home screen showing who's out tonight

### 8. Lobby (Smart Shortlist)

Save up to 10 venues for side-by-side comparison before deciding where to go.

- Live vibe data auto-refreshes
- Smart Nudge algorithm picks the hottest venue based on score + recent activity
- Pre-select venues from your Lobby when starting a Cartel Vote
- One-tap remove

### 9. VibeMatch

Personalized venue recommendation engine. Shows your top match with a compatibility percentage based on your rating history, preferences, and what your Cartel is doing.

- "94% match -- Escape Nightclub"
- Shows area, current vibe score, and why it matched
- Integrated into the TonightHero card on the home screen

### 10. Connective Prompts (VibePrompts)

Small contextual cards that chain features together so every action leads to the next:

- "Day 7 streak! 1.5x clout multiplier active" (streak)
- "2 more midnight check-ins for Night Owl badge" (badge proximity)
- "AdaObi just checked in at Escape Nightclub" (cartel activity)
- "Quilox moved to #2 in Clubs tonight" (leaderboard impact)
- "750 more clout to Diamond tier" (clout milestone)

Each prompt type has its own accent color. Dismissable with slide-out animation.

### 11. Stories (Photo Proof)

Geofence-verified photos from inside venues. No faking it.

- Photo-only, geofence-enforced
- Caption up to 100 characters
- 3-hour auto-expiry (ephemeral)
- Max 2 stories per day
- View counter with viral bonus at 20+ views
- Story bubbles visible on the venue map

### 12. Trending & Leaderboards

**Venue Rankings:**
- Top venues by live vibe score per city
- Premium podium display (gold/silver/bronze for top 3)
- Energy meters and vibe velocity indicators (heating up / cooling down / stable)
- Filter by area (Victoria Island, Ikoyi, Surulere, etc.)

**Scout Rankings:**
- Top scouts by clout points
- Mini-profile modal with activity heatmap
- Tier display and total ratings

### 13. Pulse Drops (Nearby Promotions)

Location-based promotional alerts from venues:
- Three tiers: Spark / Flare / Supernova
- Countdown timers showing time remaining
- Distance-based filtering (within 10km radius)
- Venue details embedded in each drop

### 14. Venue Certification

Venues that maintain a vibe score of 70+ for 90 consecutive days earn the "Vibe Certified" badge:
- Visible on all venue pages
- Boosted visibility in trending and search
- Automatically evaluated and revoked if score drops

### 15. Achievement Badges

Unlockable badges for milestones:
- First Rating, Scout tier, Elite tier
- Night Owl (late-night check-ins)
- Community Champion (100+ ratings)
- Crew Leader (create a Cartel)
- Trending Setter (rate a venue that hits #1)

---

## Merchant Floor Features

Venue owners get their own dashboard with tools to understand, promote, and protect their venue's reputation.

### 1. Live Dashboard

Real-time metrics updated every 30 seconds:
- Current energy score
- Active scout count (people checked in right now)
- Vibe sentiment breakdown: gate / capacity / energy percentages
- Rating velocity (24h and 7d counts)
- Profile views and direction clicks

### 2. Content Management

Control what scouts see about your venue:
- Entry fee editor (e.g., "5,000 NGN")
- Music genre editor (e.g., "Afrobeats / Amapiano")
- Table availability toggle
- Geofence radius adjustment (50-500m)

### 3. Vibe Intelligence (Deep Analytics)

Detailed analytics to understand your venue's performance:
- **Hourly Energy Curve**: 24-hour breakdown of vibe scores with peak hour identification
- **Week-over-Week Comparison**: Total ratings, energy distribution, unique scouts
- **Vibe Killers**: Actionable alerts -- high gate blockage, over-capacity incidents, energy drops
- **Scout Quality**: Who's visiting and their tier/rating history

### 4. Pulse Drops (Promotions)

Push promotional blasts to nearby users:

| Tier | Price (NGN) | Duration | Radius | Glow Boost |
|------|------------|----------|--------|------------|
| Spark | 2,500 | 2 hours | 2 km | 20% |
| Flare | 5,000 | 4 hours | 5 km | 40% |
| Supernova | 10,000 | 8 hours | 10 km | 80% |

- Custom promotional message
- Live countdown timer
- Glow boost applied to vibe score
- Supernova tier gets chart placement bonus

### 5. Energy Campaigns (Clout Multipliers)

Incentivize scouts to rate your venue by multiplying their clout rewards:

| Multiplier | 2 Hours | 4 Hours | 8 Hours |
|-----------|---------|---------|---------|
| 2x | NGN 3,000 | NGN 5,000 | NGN 8,000 |
| 3x | NGN 7,000 | NGN 12,000 | NGN 20,000 |

- Drives foot traffic and rating activity
- Notifications sent to scouts with your venue in their Lobby
- Campaign badge visible on venue card

### 6. Wallet (Fintech Integration)

Paystack-powered wallet for all merchant transactions:
- Top-up via bank transfer or card (Paystack checkout)
- Transaction history with full audit trail
- Balance tracking: deposits, pulse spend, campaign spend
- Atomic operations prevent double-charging

### 7. Aura Shield (Loss Prevention)

Automated monitoring system that alerts you when your venue's vibe drops:
- Configurable threshold (30-70 points)
- Alert types: score drop, gate blocked, capacity full
- Push notification when threshold is breached
- Toggle on/off from settings

---

## Admin Floor Features

Platform governance tools for super administrators.

### 1. Treasury & Revenue

Global financial overview:
- Total revenue (all-time and today)
- Revenue breakdown by city and pulse tier
- Per-transaction ledger with scout activity metrics
- Payment settlement tracking

### 2. Network Health

Real-time platform metrics:
- Active WebSocket connections
- Total venues / verified venues
- Total users / active users (24h)
- Data freshness percentage

### 3. Integrity Monitoring

Anomaly detection and platform health:
- Sponsored vs organic venue comparison (are pulse-boosted venues skewing results?)
- Anomalous rating patterns (sudden spikes, coordinated voting)
- Health status: green / yellow / red

### 4. User Analytics & Management

- User search and detailed profiles
- Scout tier distribution
- Ban/unban controls
- Clout airdrops (bulk distribution with reason tracking)

### 5. Venue Governance

- Verification toggle (grant/revoke "Verified" badge)
- Score override (manually set vibe score with reason)
- Suppress/unsuppress (remove from rankings)
- Full audit trail: every override logged with admin ID, reason, and timestamp

### 6. Clout Economy Overview

- Total clout in circulation
- Average clout per user
- Top 10 scouts leaderboard
- Economy health monitoring

---

## Technical Architecture

### Frontend
- **Framework**: React Native + Expo (Expo Router for navigation)
- **State Management**: Zustand with AsyncStorage persistence
- **Real-time**: Socket.IO client
- **Animations**: React Native Animated API (all useNativeDriver for 60fps)

### Backend
- **Framework**: FastAPI (Python)
- **Database**: MongoDB
- **Real-time**: python-socketio with room-based broadcasting
- **Payments**: Paystack API
- **Auth**: JWT sessions + Google OAuth

### Real-time Systems
Socket.IO rooms for targeted broadcasts:
- `city_{code}` -- all users in a city
- `venue_{id}` -- users viewing a specific venue
- `merchant_{id}` -- merchant dashboard viewers
- `admin_global` -- admin dashboard

Events: venue score updates, check-in counts, crew votes, campaign status, pulse drops, new stories.

### Offline Support
- Ratings queue locally and sync when online
- Venue data cached for 5 minutes
- User session persisted in AsyncStorage
- Map remains functional without live data

### Security
- Geofence validation server-side (Haversine formula, can't be spoofed from client)
- All API inputs validated with Pydantic models
- Rate limiting (100 req/min per IP, tighter on auth endpoints)
- Wallet operations use atomic MongoDB updates (prevents race conditions)
- Admin audit trail on all governance actions
- JWT expiry (7 days)

---

## Demo Mode

A full-fidelity demo mode for investor walkthroughs and team testing:
- Toggle from profile screen
- Pre-populated data: elite user with 4,250 clout, 12 venues, 4-member Cartel, active campaigns, streaks, badges
- All three floors functional with demo data
- Admin floor includes guided walkthrough with spotlight tooltips
- No API calls in demo mode -- everything runs from local demo data

---

## City Support

Currently supported cities:
- Lagos (Victoria Island, Ikoyi, Lekki, Surulere, Lagos Mainland)
- Abuja
- Port Harcourt
- Ibadan

Architecture supports adding new cities with area-level granularity.

---

## The Vibez Difference

1. **Geofence truth**: You can only rate or check in if you're physically there. No fake reviews.
2. **Real-time, not historical**: The vibe at 9PM is different from midnight. Vibez shows what's happening now.
3. **Reputation economy**: Clout, streaks, and scout tiers create a social layer that rewards consistent participation.
4. **Squad coordination**: Vibez Cartel turns "where should we go?" from a 50-message group chat into a 30-second vote.
5. **Merchant intelligence**: Venue owners see exactly what scouts think in real-time -- and can act on it with promotions and campaigns.
6. **Three-floor architecture**: Public, Merchant, and Admin floors each serve their audience without cluttering the others.

---

*Vibez -- Know Before You Go.*
