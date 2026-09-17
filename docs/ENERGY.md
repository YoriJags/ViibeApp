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

Every reading carries a **Scout Weight**, and the question it answers is not
"how much has this person done" but **how much does this reading tell us that we
did not already know, and how sure are we they were really in the room.**

The old standard was track record: rate thirty times and you carried full
weight. That measured attendance, not accuracy. Worse, it scored a scout on
agreeing with their peers, so the person who correctly called a room turning
before anyone else was penalised as an outlier while an echo scored perfectly.
A live signal that rewards herding is a slow signal, and slow is the one thing
this cannot be.

Five factors, each bounded, multiplied and clamped so none of them can dominate
or silence a reading.

| Factor | What it asks | Range |
|---|---|---|
| **Marginal information** | How much uncertainty does this remove? The first reading of the night is worth roughly twice the fiftieth. | 0.55 to 1.60 |
| **Presence quality** | Dwell in the room and distance from its centre. Ninety minutes in beats three minutes in the door. | 0.50 to 1.25 |
| **Integrity** | Track record and fraud signals. | 0.10 to 1.50 |
| **Calibration** | Were they right, judged by what the room actually did next, not by what peers said at the time. | 0.60 to 1.40 |
| **Discrimination** | A scout whose readings never vary is a constant, and a constant carries no information. | 0.60 to 1.15 |

A reading is never worth nothing and never worth more than about two ordinary
readings: **the floor is 0.15 and the ceiling is 2.0.**

**Marginal information is also the incentive.** Because weight rises as Signal
Density falls, the most valuable place a scout can be is a venue nobody has read
tonight. That points people at the empty corners of the map, which is exactly
where the product is blind.

**Calibration and discrimination need history**, so they stay neutral at 1.0
until `SCOUT_WEIGHT_CALIBRATION` is on. On an empty database they would be
confident noise, and confident noise is the thing we are against.

Every weight is stored with its factor breakdown on the reading itself. A
weighting nobody can audit is indistinguishable from one that is rigged, and
"the number cannot be bought" only means something if we can show the working.

---

## The Call

A scout gets three Calls a night. Attaching one to a reading says "I will stand
behind this", and the reading carries about a third more weight immediately.
Then the room is given half an hour, and the Call is settled against what
actually happened.

This is what replaced the tap. The tap asked for effort, and effort is cheap,
repeatable and therefore worthless as evidence. A Call asks a scout to spend
**credibility**, which is the only currency here that cannot be bought.

Three rules stop it becoming a way to buy influence:

- **Scarce.** Three a night, on the same 5PM to 7AM window as Tonight's Heat.
- **Symmetric.** Right and wrong move the same distance. A Call is a risk, not
  a boost. Being right while the crowd disagreed pays double; being loudly
  wrong costs double.
- **Void when ungradeable.** A Call on a venue nobody else reads pays nothing
  either way, which closes the obvious exploit of staking dead rooms.

## Transitions: carrying both audiences

When a venue crosses a state boundary, two different people need to hear it.
Inside the room, people can already feel it, so they get confirmation and a
reason to refresh. Outside, the people who put the venue on their list cannot
feel it, and that is the whole reason they added it.

**Cooling is announced too.** Every competitor only ever tells you a place is
popping, because that is the message venues want sent. Telling someone the room
they were about to cross Lagos for is dying saves them an hour and ten thousand
naira. A product that only reports good news is an advertising channel.

Announcements are guarded three ways: enough readings must stand behind the
claim (more for a PEAK, which reaches the most people), one announcement per
venue per 25 minutes so a room on a boundary cannot flap, and WARMING to
CHARGED is never announced as a rise, because a fuller room is not a hotter one.

## Cadence: the app asks, so nobody has to remember

Staleness was never people refusing to refresh. It is that nobody remembers.
Once the geofence confirms a scout is inside, VIIBE asks on a rhythm they chose
once: often, normal, rarely, or off.

Guards: only while checked in, never inside the settle window after a reading,
never more than six times a night, and **off means off.** An app that nags gets
its notifications turned off, and then it can reach nobody at all.

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

## Pulse, and City Energy

**Pulse means exactly one thing: the act of refreshing a reading.** It used to
mean three, which is why the words below are now fixed in place.

**Pulse (the refresh).** The one-tap action a present scout takes when their
reading is about to expire: *same, hotter, cooling*. It restates the reading
against what the room currently shows and costs about two seconds. This is how
Energy stays true across a night instead of being accurate once on arrival.

**City Energy (the aggregate).** One number for a whole city, weighted so more
active venues count more. It is Energy at city scale and it uses exactly the
same five words as a room, because it is the same quantity measured over a
wider area. It answers "is Lagos out tonight".

> This is the number the whole system exists to produce. A venue reading is a
> sensor; the city index is what the sensors are for.

**Signal Density (not energy at all).** A separate, deliberately cold scale
saying how much evidence sits behind a reading: NONE, THIN, PARTIAL, FIRM,
DENSE, SATURATED. It shares no word and no colour with the energy ladder, and
`tests/test_signal_density.py` fails the build if it ever does again. A room can
read quiet on saturated signal, and that is a confident quiet.

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
