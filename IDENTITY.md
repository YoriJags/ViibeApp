# VIIBE: what this is

**The canonical answer.** Every other doc, deck, page and pitch defers to this file.
If something contradicts this, this wins.

---

## The one line

> **Google Maps tells you how to get there. VIIBE tells you if it's worth going.**

Say it to anyone, in any room, in one breath. It lands because everybody already
understands Maps: live, crowdsourced from people actually on the road, useless
if it lies, and valuable enough that every other app licenses it.

That is exactly what VIIBE is, for crowds instead of cars.

**The casual version** (to your mother, to a friend):
> "You know how Maps shows red where there's traffic? We do that for concerts, festivals and raves, from the people inside."

**The compressed version** (bio, tagline, app store):
> "The live energy of Lagos, read by the people inside the room."

## Two promises, depending on the ticket

The punchline is one promise. The events VIIBE is positioned on actually ask
two different questions, and the product should know which one it is answering.

| | Concerts and festivals | Raves and door-entry nights |
|---|---|---|
| When people decide | When they buy the ticket, days before | On the night |
| The question on the night | When do I leave? How bad is the gate? How full is it inside? Has the energy picked up yet? | Is it worth going at all? |
| What VIIBE answers | Timing | Worth |

Someone holding a ₦50k festival ticket has already decided to go. Telling them
"it's worth going" is useless; telling them the gate is a mess and the crowd
hasn't arrived yet saves them two hours. Door-entry events are where the
punchline applies literally, because the decision is still open.

What a reading can back today: energy, how full it is, and how the door is
moving. It does not know set times or whether a headliner has started, so no
page or deck should promise that until it does.

**Where this lives in the product.** An event is a venue record with dates
(`kind: "event"`, a time window, a temporary geofence over the grounds, and
`entry: ticketed | door`), so readings, auto check-in, the score and the Big
Screen all work for it unchanged. Ticketed events show **When to leave**
(`services/leave_timing.py`); door events show the normal reading. Organisers
get a live gate and crowd screen at `/organiser/{event_id}` through a private
link.

Not to be confused with **venue events** (`venue_events`): a venue owner
tagging a night at their own venue, such as a Friday DJ set, to compare it
against their usual baseline. That is lift measurement, not a public event.

---

## The 30 second version

VIIBE is a live map of human energy. Scouts inside a venue confirm what the room
actually feels like right now, in three seconds. Those readings decay in minutes,
because energy does. The result is a city map where every gathering glows by how
alive it is: white hot for packed, grey for dead.

Consumers use it to stop guessing where to go. Venues pay for the truth about
their own rooms. And the same feed a person reads, a machine can query, which is
how VIIBE becomes the layer assistants answer "where's alive tonight" from.

**Concerts, festivals and raves in Lagos are market one, not the identity.** Big
crowds, energy that changes by the hour, promoters who already pay for reach, and
Detty December concentrating all of it into a few weeks.

---

**The word this all rests on is defined in [`docs/ENERGY.md`](./docs/ENERGY.md).**
If a claim about Energy contradicts that file, that file wins.

## The spine: three layers

Everything in this project belongs to exactly one layer. If you cannot place a
feature in a layer, it does not ship.

| Layer | Question it answers | What lives here |
|---|---|---|
| **1. SENSE** *(input)* | Is this real? | Geofenced vibe checks, credibility weights, decay engine, surge policy, presence verification |
| **2. READ** *(product)* | Where should I go? | The live map, venue detail, peak countdown, reading expiry, Big Screen |
| **3. SELL** *(revenue)* | What is it worth? | Merchant dashboard, watchers in orbit, Lift Report, agent API and MCP |

The layers are also the build order and the pitch order. Supply before product,
product before revenue, in that sequence, always.

---

## Who you are talking to

| Audience | Lead with | Never say |
|---|---|---|
| **A person** | "See what's popping right now, from people actually there." | "sensor network", "energy layer", "intel market" |
| **A venue** | "Did your ₦500k DJ actually lift the room? We can tell you." | "scouts", "clout", anything about the consumer game |
| **An investor** | "Traffic data made Maps indispensable. Nobody has that data for human energy. We are building it, Lagos first." | "nightlife app", which is a category graveyard |

Three languages, one product. Mixing them is why the story stopped landing.

---

## The promise that makes it defensible

> **We would rather show you nothing than lie to you.**

Readings expire. Remote taps are damped. Peak status needs corroboration and a
sustained hold. A quiet map is allowed to look quiet. This is not modesty, it is
the moat: the day the signal can be faked, the venue and agent business dies.

---

## The test

You have the pitch when a stranger can repeat it back to you after hearing it
once. Not "an app for nightlife with energy scores and a reactor", but:

> "It's traffic, but for parties."

If they say that, stop explaining and start selling.
