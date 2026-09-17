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
| Signal tiers | **Signal Density** | NONE, THIN, PARTIAL, FIRM, DENSE, SATURATED |

No word appears on any other ladder. A merchant reading "Signal Density: FIRM"
cannot mistake it for a claim about their crowd.

> **A fourth ladder was found during execution:** venue reputation
> (New, Building, **Solid**, Established, Elite), persisted on the venue
> document and shown on venue cards. The first draft of Signal Density used
> SOLID and collided with it immediately. Density now reads FIRM. Any future
> scale has to be checked against all four.

---

## Pulse: currently three things

| Used as | Where | Verdict |
|---|---|---|
| The one-tap refresh | Pulse Check | **Keep.** This is the good one, and now the only one. |
| The city aggregate score | `/api/city-pulse` | ~~Rename to City Energy.~~ **Done.** |
| A rating-count tier | `compute_pulse()` | ~~Rename to Signal Density.~~ **Done.** It never measured a pulse. |

**Pulse means exactly one thing from now on: the act of refreshing a reading.**

---

## Three currencies for the same tap

A scout rating a venue currently earns **clout** and **coins** for the single
action. **Aura** exists as a third, earned elsewhere. Streaks sit on top.

| Currency | Earned in | Verdict |
|---|---|---|
| **Clout** | ratings, quests | **Keep.** Reputation, and it already feeds credibility weighting, which is load bearing. |
| **Coins** | ratings, reward pools | **Keep only as the paid layer.** Venue and brand funded rewards. Never granted for the same action as clout. |
| ~~**Aura**~~ | nowhere | **Did not exist.** No stored field, no award, no spend. The name sat on three unrelated things. See execution note 4. |
| **Streaks** | ratings | **Keep.** It measures return behaviour, which is the metric that matters. |

The rule: **clout is earned, coins are funded.** One is reputation and cannot be
bought. The other is money someone put in. Keeping them distinct is the same
principle that keeps paid promotion out of the Energy score.

---

## Legacy ideas still in the building

| Thing | State | Verdict |
|---|---|---|
| **VIBEZ branding** | `CLOUT_SPEC.md`, old deck | Retire or rewrite. Wrong brand. |
| ~~**Cartel**~~ | renamed Crew in some places, not others | **Done. Crew.** |
| ~~**Three floors**~~ (Public / Merchant / Admin) | old deck, demo tutorial | **Done.** Now Scout / Venue / Admin, which are roles rather than storeys. |
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

1. ~~**`compute_pulse` to Signal Density.**~~ **Done.** Moved out of the venues
   route into `app/services/signal_density.py`, retiered to NONE / THIN /
   PARTIAL / FIRM / DENSE / SATURATED, and locked by
   `tests/test_signal_density.py`, which fails the build if a density tier ever
   borrows an energy word again. The API emits `signal_density` and keeps a
   deprecated `pulse` alias until shipped clients age out.
2. ~~**City Pulse to City Energy.**~~ **Done.** It reached further than "one
   endpoint": the route module, the Socket.IO event, the weighted aggregate, the
   agent API, the public API, both MCP servers, the Android home-screen widget,
   the Vercel serverless mirror, 19 frontend files, the landing site and the
   docs. The wire carries `energy_score` / `energy_label` / `readings_tonight`,
   with the old spellings kept as deprecated aliases and `/api/city-pulse/{city}`
   still answering, so a shipped APK does not go dark between deploys.

   It also matters more than the list suggests: **the city index is the product
   and the rooms are its sensors.** The name now says so.
3. ~~**Surge levels to Room Charge.**~~ **Done, with the name corrected.**
   "Room Charge" could not be used: **CHARGED is an energy state**, so the
   container would have collided with the ladder it was meant to stay clear of.
   The proposed levels were no better. **WARMING UP** shares its stem with
   energy's **WARMING**, and **BUILDING** is a venue reputation tier.

   The feature keeps the name **Surge**, which collides with nothing. Its levels
   are now **EMPTY, TRICKLE, RISING, SURGING, MAXED**, words that describe a
   meter filling rather than a room. The old ladder read as claims about the
   venue, so a genuinely LIT room with nobody tapping announced itself as
   DORMANT. Old level ids still resolve through `LEGACY_LEVEL_IDS`.
4. ~~**Retire Aura.**~~ **Done, and the audit was wrong about it.**

   **There is no Aura currency and there never was.** No stored field, no
   award, no spend, nothing to retire. The audit called it "a third score
   earned in after_party and oracle" on the strength of the filename. Three
   unrelated things were wearing the name:

   | Was | Actually is | Now |
   |---|---|---|
   | `routes/aura.py` | Tonight's Heat, a computed nightly score that already emitted `heat_*` keys | `routes/scout_heat.py`, `/api/me/heat` |
   | Aura Shield | A merchant alert threshold | **Score Alerts** |
   | `AURA_CONFIG` | The scout status ladder | `SCOUT_STATUS_CONFIG` |

   The heat mechanic was kept, because it is one of the better things in the
   codebase: `hot_nights` is a career count that can only be earned by being in
   rooms, so it cannot be bought or faked. Its second level was **Warming**,
   which collided with energy's WARMING, and is now **Moving**. `after_party.py`
   held a second copy of the ladder that had already drifted; it now imports it.
5. ~~**Cartel to Crew**, and drop the three-floor language.~~ **Done.**
   95 frontend references and 51 backend ones. `cartel_battles.py` is now
   `crew_battles.py`, with the old route paths kept as aliases and the Mongo
   collection keeping its old name, because renaming a collection is a
   migration rather than a rename.

   `CartelPulse` was carrying three retired ideas at once: the Cartel name, the
   overloaded Pulse, and a **"Vibez Cartel"** header still wearing the dead
   VIBEZ brand. It is now `CrewActivity`.

   The three-floor language is gone from the product. `FloorSwitcher` said
   "Switch Floor" and offered "Public Floor / Merchant Floor / Admin Floor",
   which is an org chart. It now says "Switch view" and names the three things a
   person can actually be here: **Scout, Venue, Admin**. The internal
   `theme/floors.ts` module keeps its filename, since the audit called for
   retiring the phrase rather than churning thirty imports.

   Note: "floor" survives in the pitch deck on purpose. There it means the
   literal dance floor, as in "an owner can see their own floor, they are
   standing on it", which is the best line in the deck.

Each is a rename with tests, not a redesign. None of them changes what the
product does. All of them change whether a stranger can understand it.

---

## Found during execution

Three more instances, all shipped in the APK, none of them in the original
audit. They are recorded because they show the failure was systemic rather than
one bad function.

| Where | What it did | Fixed |
|---|---|---|
| `NoDulling` nearby prompt | Rendered `YOU'RE NEARBY ● ELECTRIC` beside a venue name, driven entirely by the 24h rating count. The worst of the three: it was the merchant dashboard problem shown to consumers, at the exact moment they decide whether to walk in. | Now takes the venue's real `energy_level`. |
| `trending.tsx` | Derived density-ladder words *from* the energy percentage, the same confusion running backwards. | Tier dropped, keeps the honest count. |
| Map legend | A fourth ladder nobody had noticed: Chill / Moderate / Popping / Electric, matching neither energy nor density. | Now the canonical Chill / Warming / Lit / Peak. |

### The fifth ladder

The audit said there were three scales. There are five.

**Venue reputation** (`New, Building, Solid, Established, Elite`) is a 30 day
average persisted on the venue document and rendered on venue cards. It was
missed entirely, and the first draft of Signal Density collided with it inside a
day.

**Loose energy words in derived surfaces.** The engine itself is clean:
`vibe_state` and `energy_level` both use the canonical ladder. But several
downstream files invented their own vocabulary on top of it, using `electric`,
`popping`, `warm` and `uplifting` as energy values that appear nowhere in
`docs/ENERGY.md`:

| File | What it invents |
|---|---|
| `routes/seed.py` | **Fixed.** Seeded venues with `energy_level: "electric"` and `"popping"`, values the frontend type does not even accept, so they fell through to a default. |
| `routes/forecast.py`, `routes/intelligence.py` | Assign `"electric"` / `"popping"` as predicted energy |
| `routes/admin.py`, `routes/merchant.py`, `routes/vibe_intel.py` | Bucket venues into `chill / popping / electric` counts |
| `routes/oracle.py` | Maps venue type to `"electric"`, `"popping"`, `"warm"`, `"uplifting"` |
| `services/signal_extraction.py` | Keyword list, legitimate: these are words Lagos actually uses |

Only the seed was writing bad data, so only it was fixed here. The rest are
display and analytics surfaces that should be moved onto the canonical five
states, as their own pass. Recorded so it is not discovered again from scratch.

### Aura Shield was the dangerous one

It stored an alert threshold and never suppressed anything. But the merchant
screen called it a **Shield** and said **"Protecting your vibe"**, so a venue
owner could reasonably conclude they had bought protection from bad scores.

That is the one claim this product cannot make, and it was sitting in the
settings screen of the exact audience being sold the integrity story. It now
reads **Score Alerts**, "Alerts on", "Alert me when my score drops below".

### The onboarding was teaching deleted features

Found while tracing Aura: `AppTutorial` still ran six slides, and two of them
taught **Reactor Skins** ("8 ways to see the scene") and **Torch Ignite**, both
deleted on request. It also opened on the reactor, which has since been demoted
to opt-in, and pitched Viibe+ on slide five.

This is the first thing a new user ever sees, and it described a product that no
longer exists. Rewritten to four slides on what VIIBE actually is: Energy, the
map, adding a reading, and building a record that cannot be bought.

### Still open: Pulse Drop

`active_pulse_tier` (spark, flare, supernova) is **Pulse Drop**, the paid
promotion product. It collides with **Pulse Check**, the honest refresh.

Money and the integrity mechanic must not share a name. A venue that buys a
Pulse Drop, and a scout who performs a Pulse Check, are doing opposite things:
one is purchasing reach, the other is donating truth. Recommend renaming the
paid product to **Spotlight**, which describes what it actually buys (visibility,
not energy) and leaves Pulse meaning one thing.

This is a commercial name, so it is flagged rather than executed.
