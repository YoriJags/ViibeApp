# VIIBE vocabulary: one word, one meaning

You cannot become a reflex if people have to ask what your words mean. An app
that wants to sit in someone's night has to be understood instantly, and right
now the same five words mean three different things depending on which screen
you are looking at.

This is the audit, the evidence, and the decision on each.

---

## The core problem: three ladders wearing each other's clothes

There are three separate scales in the product. They measure different things.
They share vocabulary.

| | **Energy states** | **Surge levels** | **Signal tiers** |
|---|---|---|---|
| Where | `vibe.py get_venue_state` | `surge.py LEVELS` | `venues.py compute_pulse` |
| Measures | how alive the room is | how charged the reactor is | how many ratings came in |
| Scale | 0 to 100 score | 0 to 100% charge | raw count, 0 to 100 |
| Names | quiet, chill, warming, **charged**, lit, peak | **dormant**, **stirring**, buzzing, popping, **electric** | **dormant**, **stirring**, **charged**, **electric**, max_pulse, source |

**The same venue can simultaneously read LIT, DORMANT and ELECTRIC**, and all
three are correct, because they answer different questions. Nobody outside this
codebase could be expected to know that.

The worst case is a merchant dashboard showing **ELECTRIC** when it only means
the venue received eighty ratings. The owner reads it as "my room is electric".
That is not a naming nitpick, it is a false claim about their business, made by
the product whose entire moat is not making false claims.

### The decision

**Energy keeps the words.** It is the product. Everything else renames.

| Scale | New name | New levels |
|---|---|---|
| Energy | **Energy** *(unchanged)* | QUIET, CHILL, WARMING, CHARGED, LIT, PEAK |
| Surge | **Room Charge** | EMPTY, WARMING UP, BUILDING, SURGING, MAXED |
| Signal tiers | **Signal Density** | NONE, THIN, PARTIAL, SOLID, DENSE, SATURATED |

No word appears on two ladders. A merchant reading "Signal Density: SOLID"
cannot mistake it for a claim about their crowd.

---

## Pulse: currently three things

| Used as | Where | Verdict |
|---|---|---|
| The one-tap refresh | Pulse Check | **Keep.** This is the good one. |
| The city aggregate score | `/api/city-pulse` | **Rename to City Energy.** It is Energy at city scale, nothing else. |
| A rating-count tier | `compute_pulse()` | **Rename to Signal Density.** It never measured a pulse. |

**Pulse means exactly one thing from now on: the act of refreshing a reading.**

---

## Three currencies for the same tap

A scout rating a venue currently earns **clout** and **coins** for the single
action. **Aura** exists as a third, earned elsewhere. Streaks sit on top.

| Currency | Earned in | Verdict |
|---|---|---|
| **Clout** | ratings, quests | **Keep.** Reputation, and it already feeds credibility weighting, which is load bearing. |
| **Coins** | ratings, reward pools | **Keep only as the paid layer.** Venue and brand funded rewards. Never granted for the same action as clout. |
| **Aura** | after_party, oracle | **Retire.** A third score nobody can explain, overlapping both. |
| **Streaks** | ratings | **Keep.** It measures return behaviour, which is the metric that matters. |

The rule: **clout is earned, coins are funded.** One is reputation and cannot be
bought. The other is money someone put in. Keeping them distinct is the same
principle that keeps paid promotion out of the Energy score.

---

## Legacy ideas still in the building

| Thing | State | Verdict |
|---|---|---|
| **VIBEZ branding** | `CLOUT_SPEC.md`, old deck | Retire or rewrite. Wrong brand. |
| **Cartel** | renamed Crew in some places, not others | Pick one. **Crew.** |
| **Three floors** (Public / Merchant / Admin) | old deck, demo tutorial | Retire the phrase. It describes an org chart, not a product. |
| **The reactor** | demoted to opt-in | Correct as is. Keep dark, do not delete. |
| **Vibe DNA, Persona, Cosmic, Zodiac** | built, flag-dark | Correct as is. Retention machinery for users who do not exist yet. |

---

## Why this matters more than it looks

The ambition is for VIIBE to become a reflex: the thing you open without
deciding to, the way you check traffic before leaving. Reflexes are built on
words that never need explaining.

"Where's lit?" is already how Lagos asks the question. The product should answer
in exactly that language and never in a second dialect invented for the
database. Every word that means two things is a moment where someone has to
stop and think, and a reflex cannot survive a moment of thought.

---

## Order of execution

1. **`compute_pulse` to Signal Density.** Smallest blast radius, worst
   consequence if left. It is the one that can mislead a paying merchant.
2. **City Pulse to City Energy.** One endpoint, one field, several call sites.
3. **Surge levels to Room Charge.** The reactor is already demoted, so this
   touches the Big Screen and little else.
4. **Retire Aura.** Dark it first, delete once nothing reads it.
5. **Cartel to Crew** everywhere, and drop the three-floor language.

Each is a rename with tests, not a redesign. None of them changes what the
product does. All of them change whether a stranger can understand it.
