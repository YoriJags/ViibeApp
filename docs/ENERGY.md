# What VIIBE means by Energy

## Lagos already runs on this

Nobody in Lagos needs to be told that a room has energy. It is the whole basis
on which the city goes out.

You know the difference between a place that is full and a place that is
*going*. You have stood in a venue at eleven where the music is right and the
floor has not decided yet, and been in the same room at one when it has. You
have walked into somewhere with forty people and known, immediately and without
counting anything, that it was over. You have also felt the opposite: a half
empty bar in Ikoyi where the energy is somehow higher than the packed place you
just left.

That is the signal. It is not abstract and it is not new. It is the most
discussed subject in Lagos on a Friday night, and every person moving through
this city on a weekend is already acting on it.

**They are just acting on a broken version of it.**

Right now the signal travels by rumour. A promoter posts that it is mad
tonight, which he posts every night. Someone's story shows the one corner of
the room that looked full, filmed an hour ago. A friend who went first sends
a verdict to the group chat that arrives too late to use. And because Lagos
traffic makes every wrong decision expensive, acting on that rumour costs you
an hour of your life and ten thousand naira at a door you should not have paid.

So the energy is real, the demand for it is total, and the transmission is
garbage.

**VIIBE does not invent this signal. It instruments one the city already runs on.**

## What we mean when we say we measure it

There is a version of this that would be dishonest, and it is the obvious one:
count heads. Occupancy is easy to measure and it is not what anyone means by
energy. A packed room can be dead. Twenty people can be electric.

So we measure the thing itself, from the only place it can honestly be read:
inside the room, by someone standing in it, right now. A scout answers what the
room feels like in about three seconds. The phone confirms they are there. The
room's own sound and tempo corroborate. How long people stay corroborates
again. And the whole reading expires in minutes, because the feeling does.

## How we show it back

Energy is a temperature, so it is rendered as one. The city map runs cool
where nothing is happening and climbs through ember and amber to white hot
where a room is at peak. A venue is not a dot on a list; it is a heat source,
and the field around it glows by how alive it actually is.

That is the whole product in one image: **open the map, and the city looks the
way it feels.**

> **Yori's note.** This section is the part that should carry your voice rather
> than mine, because you have stood in these rooms and I have not. Rewrite it
> in your own words when you get a minute. The spec below is mine; the feeling
> above should be yours.

---

# The specification

Everything above is what Energy is. Everything below is how it is computed.

This half is canonical. Every score, chart, dashboard, API response and pitch
slide rests on this word, so it is defined here once and everything else defers
to it. The numbers are read from the engine, not from an idea of it.

## The definition

> **Energy is how alive a gathering is at this moment, measured from inside it.**

Three words in that sentence are doing work.

**Alive**, not busy. A full restaurant at 8pm is busy and not alive. A half
empty room where everyone is dancing is alive and not busy. Energy is what the
room feels like, which is why crowd size alone can never produce it.

**At this moment**, not tonight. Energy is a reading, not a rating. It expires.
A venue does not "have" an energy score the way it has an address.

**From inside it**, not about it. A reading only counts if the person was
physically in the room. Everything else is opinion about a place, and opinion
is what already exists everywhere and is worth nothing.

### What Energy is not

- **Not popularity.** A famous venue with a dead Tuesday reads dead.
- **Not a review.** Reviews describe a venue in general. Energy describes a room right now.
- **Not occupancy.** Capacity amplifies energy; it cannot create it.
- **Not purchasable.** Paid promotion buys reach, position and a badge. It never touches the number.

---

## The scale

One number, 0 to 100, with five named states.

| State | Score | What it means |
|---|---|---|
| **QUIET** | below 20 | Nothing happening. Say so. |
| **CHILL** | 20 to 44 | Occupied, low intensity. |
| **WARMING** | 45 to 64 | Building. Becomes **CHARGED** at the same score when the room is already full, because a full room at medium energy is potential about to convert. |
| **LIT** | 65 to 84 | The room is going. |
| **PEAK** | 85 and above | As alive as it gets. |

The CHARGED distinction matters and is deliberate: the same number means
something different in an empty room than a packed one.

---

## How a single reading is scored

A scout answers three things in about three seconds: **energy**, **how full**,
and **the door**.

```
energy      quiet 0 · chill 25 · warming 50 · lit 75 · peak 100   → 80% of the reading
venue note  the type-specific question (DJ set, crowd, movement)  → 20% of the reading
capacity    sparse ×0.92 · vibrant ×1.05 · full ×1.15             → multiplier
gate        recorded for context, never scored
```

**Capacity multiplies, it does not add.** A packed room reading quiet energy
still scores near zero. Crowd cannot manufacture aliveness, it can only amplify
what is already there. This is the single most important line in the formula.

---

## How a venue's Energy is assembled

The venue score is not an average of ratings. It is a weighted blend of four
signals, and the people in the room always dominate.

| Signal | Max weight | Qualifies when |
|---|---|---|
| **Scouts in the room** | never below **67%** | Geofenced, credibility weighted |
| **Sound and tempo** | up to **15%** | 3+ scouts contributing loudness and BPM |
| **Scout consensus** | up to **10%** | 5+ independent scouts agreeing |
| **Dwell time** | up to **8%** | 5+ people actually staying |

Each signal's influence scales with its sample size, so thin data means low
influence rather than a confident wrong answer.

**The 67% floor is a design commitment, not a tuning constant.** Sensors can be
fooled and rooms can be loud for the wrong reasons. A machine never outvotes
the people standing in the room.

### Who gets to be heard

Every reading carries its scout's credibility weight, earned only by track
record: **0.15 at zero ratings, about 0.48 at ten, capped at 1.0 at thirty.**
New voices count a little, never nothing, and never fully until they have
earned it.

---

## Decay: why Energy expires

Energy is the only number here that falls on its own.

| Reading age | Weight |
|---|---|
| under 30 min | 1.00 |
| 30 to 60 min | 0.70 |
| 60 to 90 min | 0.40 |
| 90 to 180 min | 0.15 |
| over 3 hours | 0 |

A stock price holds its last trade until the next one. Energy does not, because
aliveness is not a stored quantity. A venue with no recent readings fades
toward nothing rather than holding a flattering old number.

**This is why silence is information.** A flat line at zero is a true statement,
not a missing one.

Two guards sit under the decay so it degrades rather than whipsaws: a **decay
buffer** caps how fast a score can fall in one cycle, and a **kinetic momentum
floor** holds the score up while the crowd is demonstrably still moving, so a
DJ transition does not read as a dead room.

---

## Pulse

The word is used two different ways, and both are legitimate. Keep them apart.

**Pulse (the refresh).** The one-tap action a present scout takes when their
reading is about to expire: *same, hotter, cooling*. It restates the reading
against what the room currently shows and costs about two seconds. This is how
Energy stays true across a night instead of being accurate once on arrival.

**City Pulse (the aggregate).** One number for a whole city, weighted so more
active venues count more. It is Energy at city scale, and the answer to "is
Lagos out tonight".

> **Naming debt:** a third usage exists in the code. `compute_pulse()` on a
> venue returns a tier from raw rating *count* (dormant, stirring, charged,
> electric, max_pulse, source). That measures **how much signal a venue is
> receiving**, not its energy, and it reuses state names that mean something
> else on the energy ladder. It should be renamed to something like
> `signal_volume` before it confuses a merchant or an investor.

---

## What makes the number trustworthy

Four rules, all enforced in code rather than promised in copy.

**Presence verified.** Readings and charges are geofence checked. Contributions
from outside the room carry a fifth of the weight and can never drive a peak.

**Corroboration gated.** The top state fires city-wide alerts, so it requires
five present scouts, a hot reading, and a ten minute sustained hold. A group
chat cannot manufacture it.

**Implausibility filtered.** A claimed peak from a phone that never moved is
dropped before it reaches the score.

**Unbuyable.** Paid promotion is rendered as sponsored and never enters the
maths. A regression test fails the build if anyone re-adds it.

---

## The honest limits

Stated here so they are never discovered later by someone else.

- **Thin rooms produce uncertain numbers.** Confidence is reported alongside the
  score (low, medium, high) and it is frequently low. That is accurate, not a defect.
- **Sound is new and unproven.** It carries up to 15%, and until recently the
  microphone permission was missing entirely, so it contributed nothing.
- **Tempo is not genre.** BPM gives a tempo band. It does not identify a track.
- **Energy is a human judgment first.** Three quarters of the number comes from
  people saying what a room feels like. The sensors corroborate; they do not decide.

> **The creed, which follows from all of the above:**
> we would rather show you nothing than lie to you.
