# VIIBE Score Formula — How It Works

## The Core Question

Every venue gets a live score from 0–100. This number answers one question:
**How alive is this place right now?**

The score is not an opinion. It's a weighted synthesis of every signal we
can collect — human judgment, physical motion, sound, and behaviour.

---

## Signal Architecture

The formula has two layers:

1. **Base score** — computed from scout ratings
2. **Signal blend** — base score adjusted by corroborating evidence

Scouts are always the primary voice. New signals can move the score by
at most ±10 points, and only when enough data backs them.

---

## Layer 1: Base Score (from Scout Ratings)

```
base_score = (energy_score × 0.80) + (venue_specific_score × 0.20)
final_base = base_score × capacity_multiplier
```

### Energy (80% of base)

| Label   | Score |
|---------|-------|
| quiet   | 0     |
| chill   | 25    |
| warming | 50    |
| lit     | 75    |
| peak    | 100   |

### Venue-specific dimension (20% of base)

Each venue type has its own secondary dimension:

| Venue Type    | Dimension         | Low → High                             |
|---------------|-------------------|----------------------------------------|
| Club / Rave   | DJ quality        | mellow → good_set → killing_it         |
| Bar           | Atmosphere        | quiet_atm → decent_atm → loud_alive    |
| Lounge        | Service vibe      | slow_service → decent_service → on_point |
| Concert       | Crowd response    | flat_crowd → building_crowd → going_off |
| Block Party   | Movement          | standing_around → mixed → packed_dancing |

### Capacity multiplier

| Capacity | Multiplier | Logic                                      |
|----------|------------|--------------------------------------------|
| sparse   | 0.92×      | Empty room limits the ceiling              |
| vibrant  | 1.05×      | Good crowd amplifies real energy           |
| full     | 1.15×      | Packed = potential multiplied              |

> Multiplier amplifies real energy but cannot create energy where none exists.
> A chill sparse room stays chill. A lit packed room gets boosted.

### Scout credibility weight

Not all ratings are equal. Newer scouts carry less weight until they
prove accuracy:

```
credibility = min(1.0, max(0.15, total_ratings / 30))
```

| Ratings | Weight |
|---------|--------|
| 0       | 0.15   |
| 10      | ~0.48  |
| 30+     | 1.0    |

### Time decay

Recent ratings matter more:

| Age        | Time weight |
|------------|-------------|
| ≤ 15 min   | 3×          |
| ≤ 30 min   | 2×          |
| > 30 min   | 1×          |

Final rating weight = `time_weight × credibility_weight`

---

## Layer 2: Multi-Signal Weighted Blend

Once the base score is computed, three corroborating signals can adjust it.

```
final_score = (
    base_score      × scout_weight
  + ambient_score   × ambient_weight
  + consensus_score × consensus_weight
  + dwell_score     × dwell_weight
) / total_weight
```

Where:
```
scout_weight = max(0.67, 1.0 − ambient_weight − consensus_weight − dwell_weight)
```

**Scouts always hold at least 67% of the vote.**

---

### Signal 1: Ambient Audio (max 15% influence)

**What it measures:** How loud the room actually is, sampled every 30 seconds
by scouts who have opted in to sound sensing. A dB reading from the phone mic.

**How the score is computed:**
```
ambient_score = clamp((db_level + 80) / 0.80, 0, 100)
```

This maps the expo-av metering scale (where 0 dB = full volume,
~−80 dB = near silence in a real room) onto a 0–100 energy score.

**Weight scales with data quality:**
```
ambient_weight = 0.15 × min(1.0, ambient_scout_count / 3)
```

1 contributing scout → max 5% influence
3+ contributing scouts → full 15% influence

**Why this matters:** Scouts can mis-tap or game a rating. The room's
actual sound level cannot lie. A venue claiming PEAK that sounds like
a library will see its score tempered.

---

### Signal 2: Scout Consensus (max 10% influence)

**What it measures:** Do independent scouts agree on the energy level within
the last 10 minutes? Strong agreement = high-quality signal.

**How the score is computed:**
```
consensus_score = ENERGY_SCORES[top_energy_label]  # e.g. "lit" = 75
consensus_rate  = top_vote_count / total_scouts_in_window
```

If the top label gets < 60% of votes → labelled "mixed" → signal is neutral.

**Weight scales with agreement strength and sample depth:**
```
consensus_weight = 0.10 × consensus_rate × min(1.0, consensus_count / 5)
```

2 scouts, 100% agreement → ~4% influence
5+ scouts, 80% agreement → ~8% influence
Mixed reads → 0% influence

**Why this matters:** One scout hitting PEAK means little. Eight scouts
independently hitting PEAK in 10 minutes is a strong, fraud-resistant signal.

---

### Signal 3: Dwell Time (max 8% influence)

**What it measures:** How long scouts stay inside the venue. Tracked via
5-minute heartbeat pings while the scout is inside the geofence.

**How the score is computed:**
```
dwell_score = min(100, base_score + (long_dwell_count × 2))
```

Dwell doesn't generate its own energy reading — it amplifies the base.
If scouts are staying, the current score probably understates reality.

**Weight scales with long-stay scout count:**
```
dwell_weight = 0.08 × min(1.0, long_dwell_count / 5)
```

`long_dwell_count` = scouts who have been inside for 30+ minutes.

**Why this matters:** People vote with their feet. A scout who rates a
venue 4/5 and leaves immediately is a weaker signal than one who stays
for 2 hours. Dwell time is the behavioural proof of enjoyment.

---

## Fraud Protection

Several layers protect the score from manipulation:

| Mechanism               | How it works                                                      |
|-------------------------|-------------------------------------------------------------------|
| Geofence gate           | Cannot rate from outside the venue (100m radius)                 |
| Stationary phone guard  | PEAK rating from a phone with avg G-force < 1.2g → excluded      |
| Burst detection         | 4+ identical ratings in 10 min → 15-min provisional hold         |
| Credibility weighting   | New scouts carry 0.15× weight — gaming requires months of history |
| Kinetic momentum floor  | G-force from crowd prevents false "dying" reads during DJ breaks  |
| Decay buffer            | Score can only drop 5% per cycle when kinetics are active        |

---

## Kinetic Systems (Passive Signals)

Two passive signals protect score stability — neither requires scout action:

### Kinetic Momentum
Accelerometer data from phones in the crowd. When the room is physically
moving (dancing), this floors the score to prevent false drops during
quiet moments in a set.

```
if kinetic_momentum > avg_score:
    avg_score = avg_score × 0.7 + kinetic_momentum × 0.3
```

### Vibe DNA
Classifies the crowd's tap pattern signature:
- `HIGH_VELOCITY` — explosive, reactive crowd
- `STEADY_GROOVE` — consistent, locked-in energy
- `ATMOSPHERIC_CHILL` — low movement, ambient scene

---

## Summary: What the Score Actually Means

A score of 87 means:
- Scouts on the ground rated the energy as lit/peak (primary driver)
- Their phones confirm the room is physically moving
- Independent scouts agree (no mixed reads)
- The sound level matches the claimed energy
- Scouts are staying — nobody is leaving early
- Fraud guards have cleared all ratings as legitimate

A score of 87 from 1 scout with no ambient data, no consensus, and zero
dwell time means far less than 87 from 12 scouts with full corroboration.
This is why `score_confidence` and `signal_weights` are exposed in the API —
the number alone is not the full picture.

---

*Last updated: 2026-03-17*
