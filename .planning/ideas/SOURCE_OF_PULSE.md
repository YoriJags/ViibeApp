# Feature Spec: Source of Pulse

**Status:** Idea — not yet built
**Date:** February 2026
**Proposed by:** Yori Ajagun

---

## The Concept

Every venue has a **Source of Pulse** — a collective accumulation meter (0→100) that tracks how many scouts have contributed readings tonight. It unlocks progressive energy tiers and is fully visible to users, building trust and transparency in the data.

**Key distinction from Vibe Score:**
| | Vibe Score | Source of Pulse |
|---|---|---|
| **What it measures** | QUALITY — how good is the energy right now | VOLUME/CONFIDENCE — how many scouts are validating it |
| **How it's calculated** | Weighted avg of energy/capacity/gate ratings | Accumulates with each scout contribution tonight |
| **Resets** | Time-decays continuously | Resets each night/session |
| **Visual** | Number (0–100) + color glow | Progress bar + energy tier badge |

A venue with Vibe Score 90 from 2 scouts is unreliable.
That same 90 with **Source of Pulse: 87 🔥** means the whole city is vouching for it.

---

## Energy Tiers

| Pulse Range | Status | Icon | Label |
|---|---|---|---|
| 0–20 | Dormant | 😴 | No signal yet tonight |
| 21–40 | Stirring | 👀 | A few scouts checking in |
| 41–60 | Charged | ⚡ | Reliable reading forming |
| 61–80 | Electric | 🔥 | High scout density, it's real |
| 81–99 | Max Pulse | 💜 | Fully validated |
| **100** | **Source** | **👑** | **The ultimate — rare, celebrated** |

---

## UI Design: Tap-to-Reveal

### Venue Card (Home Feed) — Collapsed View
The card shows a compact pulse strip beneath the vibe score. Minimal — just enough to signal activity:

```
┌─────────────────────────────────────┐
│  Club Quilox              ● 88      │
│  Victoria Island · Club             │
│                                     │
│  [●━━━━━━━━━━━━━━━━━░░░░] 73/100   │
│  🔥 ELECTRIC  ·  tap to see pulse  │
└─────────────────────────────────────┘
```

- The bar fills with a purple→gold gradient as pulse increases
- The tier icon + label shows current status
- "tap to see pulse" hint appears subtly

### Bottom Sheet (On Tap) — Expanded View

```
╭────────────────────────────────────╮
│         SOURCE OF PULSE            │
│                                    │
│  Club Quilox · Tonight             │
│                                    │
│         ● 73 / 100                 │
│  ████████████████░░░░░░░           │
│                                    │
│  😴    ⚡    🔥    💜    👑        │
│  20    40    60    80   100        │
│                                    │
│  Status: 🔥 ELECTRIC               │
│  Next:   💜 Max Pulse in 27 more   │
│                                    │
│  ──────────────────────────────── │
│                                    │
│  👥 73 scouts contributed tonight  │
│  🏆 Top contributor:               │
│     @TundeElite · 5 ratings        │
│                                    │
│  ──────────────────────────────── │
│                                    │
│  💡 Be one of 27 to push this      │
│     venue to MAX PULSE tonight     │
│                                    │
│       [ ⭐ RATE THIS VENUE ]       │
╰────────────────────────────────────╯
```

### When Pulse Hits 100 — Celebration Moment
- The bottom sheet shows a special crown animation
- Confetti burst (similar to CheckInCelebration)
- The venue card glows gold on the home feed
- Push notification to scouts who contributed: "You helped push Quilox to SOURCE tonight 👑"
- Venue gets a "SOURCE TONIGHT" badge visible on its card for the rest of the night

---

## How Pulse Accumulates

**Option A — Count-based (simplest):**
- Each unique scout rating = +1 to pulse
- 100 unique scout ratings = Full Pulse
- Resets at 6am each day

**Option B — Weighted contribution (recommended):**
- Each rating contributes based on scout accuracy tier:
  - Newbie scout: +0.5
  - Regular: +0.7
  - Scout: +1.0
  - Elite: +1.5
- Makes Elite scouts feel more powerful
- Encourages rank progression
- 100 "weighted points" = Full Pulse

**Option C — Intensity × quantity:**
- Contribution = (vibe_score / 100) × scout_weight
- High energy ratings from credible scouts fill the bar faster
- A 95-energy reading from an Elite scout = more pulse than a 40-energy from a Newbie

**Recommendation:** Start with Option A (count-based) for MVP simplicity, upgrade to B or C once scout tiers have real data.

---

## Backend Changes Needed

### New field on venue document:
```python
{
  "pulse_tonight": {
    "count": 73,           # raw rating count today
    "weighted_score": 67,  # weighted by scout tier
    "tier": "electric",    # dormant/stirring/charged/electric/max_pulse/source
    "top_contributor": {
      "user_id": "...",
      "username": "TundeElite",
      "rating_count": 5
    },
    "reset_at": "2026-02-25T06:00:00Z"  # next reset time
  }
}
```

### New API endpoint:
```
GET /api/venues/:id/pulse
```
Returns pulse_tonight data for the bottom sheet.

### Update existing rating endpoint:
`POST /api/venues/:id/rate` should increment `pulse_tonight.count` on each successful rating.

---

## Frontend Components Needed

- `PulseStrip.tsx` — compact bar on venue card (collapsed state)
- `PulseBottomSheet.tsx` — full breakdown bottom sheet (expanded on tap)
- `PulseCelebration.tsx` — 100 unlock animation (reuse CheckInCelebration particles)
- Update `VenueCard.tsx` — add PulseStrip beneath vibe score
- Update `[id].tsx` (venue detail) — wire up tap handler → PulseBottomSheet

---

## Gamification Angles

1. **Collective mission** — "27 more scouts to push Quilox to MAX PULSE" creates shared urgency
2. **FOMO** — "Escape just hit SOURCE 👑" push notification pulls people off the couch
3. **Scout motivation** — Your rating visibly moves the bar. You can see your contribution.
4. **Merchant insight** — Merchants see pulse history in their dashboard: "You hit Source status 3 Saturdays in a row"
5. **Weekly recap** — "Last weekend, 4 Lagos venues hit Source status. Quilox hit it twice."

---

## What Makes This Different from Just "Rating Count"

It's not just a count. It's a **civic signal** — this venue has been independently verified by N real people tonight. The transparency is the product. Users trust a venue with Pulse 87 🔥 more than one with no pulse data, even if the vibe score is identical. That trust is what makes the platform sticky.

---

## The Contribution Moment (Critical UX)

When a scout submits a rating, they must **feel** what they just did. This is the most important UX moment in the feature.

### After Rating — Success State (replaces or extends current RateVibeModal close)

```
┌─────────────────────────────────────┐
│  ✅ Vibe rated!                     │
│                                     │
│  You pushed Quilox to:              │
│                                     │
│  [●━━━━━━━━━━━━━━━━━━░░░] 74/100   │
│                  ↑ you              │
│                                     │
│  🔥 ELECTRIC · 26 away from         │
│     MAX PULSE tonight               │
└─────────────────────────────────────┘
```

**What happens:**
1. The pulse bar **animates live** — scout watches it tick from 73 → 74 (animated fill, ~0.8s ease-out)
2. A small **"↑ you"** marker or their avatar emoji appears at their contribution point on the bar
3. The current tier + next milestone shows: "26 scouts away from MAX PULSE"
4. Subtle haptic feedback (Expo Haptics.impactAsync) at the moment of increment

### Tier Unlock Moment (When Your Rating Crosses a Threshold)
If the scout's rating pushes the venue from 59 → 60 (crossing from Charged to Electric):
- The tier badge **flashes in** with a scale animation (like levelling up)
- The bar glows briefly with the new tier's color
- Toast/banner: *"⚡ Quilox just hit ELECTRIC!"*
- Everyone currently viewing the venue sees this in real-time via Socket.IO

### The 100 Moment — You Unlocked SOURCE
If your rating is the one that tips the venue to 100:
- Full confetti burst (reuse CheckInCelebration particles, gold/purple theme)
- Crown animation on the bar
- Push notification sent to all scouts who contributed tonight:
  *"👑 @TundeElite just pushed Quilox to SOURCE tonight. You helped."*
- Venue card on home feed glows gold for the rest of the night
- Scout earns a special "SOURCE Maker" badge for their profile

### Why This Matters
Every rating must feel like **a brick you laid**, not just a form you submitted.
Scouts become builders of the pulse — not reporters. That's the emotional hook
that drives repeat engagement: *"I want to be the one who pushes Quilox to 100."*

---

*Capture date: February 2026 · Priority: Medium-High · Effort: 2–3 days frontend + 1 day backend*
