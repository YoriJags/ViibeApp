"""
The Call: a scout's conviction stake on a reading.

This is what replaces the tap.

The tap asked people to spend effort, and effort is cheap, infinitely
repeatable and therefore worthless as evidence. A Call asks a scout to spend
**credibility**, which is the only currency in this product that cannot be
bought. That is the entire idea.

How it works:

  A scout gets a small, fixed number of Calls per night. Attaching one to a
  reading says "I will stand behind this". The reading carries more weight
  immediately, and then the room is allowed to settle and the Call is graded
  against what actually happened: right moves the scout up, wrong moves them
  down, and the cost scales with how loud the call was.

Three rules keep it from becoming a way to buy influence:

  1. **Scarce.** Three per night, reset on the same 5PM to 7AM night window as
     Tonight's Heat. You cannot stake everything, so you must choose.

  2. **Symmetric.** The upside and the downside are the same size. A Call is a
     risk, not a boost. If it only ever helped, it would just be a louder tap.

  3. **Void when ungradeable.** A Call on a venue that nobody else reads stays
     unresolved and pays nothing either way. Never a flattering default, and it
     removes the obvious exploit of staking dead venues nobody will contradict.

The Call is also the forward-looking data the peak forecast has never had: a
population of people saying, on the record, where they think a room is going.
"""
from datetime import datetime, timedelta, timezone

# ── Budget ────────────────────────────────────────────────────────────────────
CALLS_PER_NIGHT = 3

# ── Weight effect ─────────────────────────────────────────────────────────────
# Bounded deliberately. A Call is conviction, not a megaphone: it is worth
# roughly a third more, never several times more.
STAKE_MULTIPLIER = 1.35

# ── Settlement ────────────────────────────────────────────────────────────────
# How long the room is given to prove the Call right or wrong.
SETTLE_AFTER_MINUTES = 30
SETTLE_WINDOW_MINUTES = 30

# A Call is correct when the room settles within this many points of it.
CORRECT_WITHIN = 15

# Clout at stake. Symmetric by design.
CLOUT_AT_STAKE = 25

# Minimum independent readings before a Call can be graded at all.
MIN_OUTCOME_READINGS = 2


def night_window_start(now: datetime | None = None) -> datetime:
    """
    Start of the current night: 5PM, running to 7AM the next day.

    Same window as Tonight's Heat, deliberately. A scout's calls and their heat
    reset together, so "tonight" means one thing across the whole product.
    """
    now = now or datetime.now(timezone.utc)
    if now.hour < 7:
        yesterday = now - timedelta(days=1)
        return yesterday.replace(hour=17, minute=0, second=0, microsecond=0)
    return now.replace(hour=17, minute=0, second=0, microsecond=0)


def calls_remaining(used_tonight: int) -> int:
    """Never negative, never more than the budget."""
    try:
        used = max(0, int(used_tonight or 0))
    except (TypeError, ValueError):
        used = 0
    return max(0, CALLS_PER_NIGHT - used)


def stake_multiplier(is_staked: bool) -> float:
    """The immediate weight effect of attaching a Call to a reading."""
    return STAKE_MULTIPLIER if is_staked else 1.0


def is_settled(reading_ts: datetime, now: datetime | None = None) -> bool:
    """A Call cannot be graded until the room has had time to prove it."""
    now = now or datetime.now(timezone.utc)
    if reading_ts.tzinfo is None:
        reading_ts = reading_ts.replace(tzinfo=timezone.utc)
    return (now - reading_ts) >= timedelta(minutes=SETTLE_AFTER_MINUTES)


def grade_call(reading_score: float,
               outcome_scores: list[float],
               consensus_at_time: float | None = None) -> dict:
    """
    Settle one Call against what the room actually did.

    Returns a verdict plus the clout movement. Being right while everyone
    disagreed pays the most, because that scout moved the map before anyone
    else could. Being loudly wrong costs the most, for the same reason.

    Verdicts:
        "void"    not enough independent readings to judge. Pays nothing.
        "right"   the room settled within CORRECT_WITHIN of the call.
        "wrong"   it did not.
    """
    scores = [float(s) for s in (outcome_scores or []) if s is not None]
    if len(scores) < MIN_OUTCOME_READINGS:
        return {
            "verdict": "void",
            "clout_delta": 0,
            "outcome": None,
            "error": None,
            "reason": "not enough independent readings to settle this call",
        }

    outcome = sum(scores) / len(scores)
    error = abs(float(reading_score) - outcome)
    correct = error <= CORRECT_WITHIN

    # How far out on a limb the call was, 0 to 1.
    if consensus_at_time is None:
        departure = 0.0
    else:
        departure = min(1.0, abs(float(reading_score) - float(consensus_at_time)) / 50.0)

    # Right: 1.0x at consensus, up to 2.0x alone. Wrong: mirrored.
    magnitude = 1.0 + departure

    if correct:
        clout_delta = round(CLOUT_AT_STAKE * magnitude)
    else:
        clout_delta = -round(CLOUT_AT_STAKE * magnitude)

    return {
        "verdict": "right" if correct else "wrong",
        "clout_delta": clout_delta,
        "outcome": round(outcome, 1),
        "error": round(error, 1),
        "reason": None,
    }


# ── Persistence ───────────────────────────────────────────────────────────────

async def calls_used_tonight(user_id: str) -> int:
    """How many Calls this scout has spent in the current night window."""
    from app.config import db
    return await db.ratings.count_documents({
        "user_id": user_id,
        "staked": True,
        "timestamp": {"$gte": night_window_start()},
    })


async def can_stake(user_id: str) -> dict:
    """Budget check, used before accepting a Call."""
    used = await calls_used_tonight(user_id)
    remaining = calls_remaining(used)
    return {
        "allowed": remaining > 0,
        "used": used,
        "remaining": remaining,
        "budget": CALLS_PER_NIGHT,
    }


async def settle_pending_calls(limit: int = 200) -> dict:
    """
    Grade every Call that is old enough to judge and has not been settled.

    Safe to run repeatedly: a Call is only settled once, and one that cannot be
    graded yet is left alone rather than voided early. A Call that is still
    ungradeable after the window has fully passed is voided, so nothing sits
    pending forever.
    """
    from app.config import db

    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(minutes=SETTLE_AFTER_MINUTES)

    pending = await db.ratings.find({
        "staked": True,
        "stake_verdict": {"$exists": False},
        "timestamp": {"$lte": cutoff},
    }).to_list(limit)

    settled = {"right": 0, "wrong": 0, "void": 0, "skipped": 0}

    for reading in pending:
        ts = reading.get("timestamp")
        if ts is None:
            continue
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)

        after = await db.ratings.find({
            "venue_id": reading.get("venue_id"),
            "user_id": {"$ne": reading.get("user_id")},
            "timestamp": {"$gte": ts + timedelta(minutes=SETTLE_AFTER_MINUTES),
                          "$lte": ts + timedelta(minutes=SETTLE_AFTER_MINUTES + SETTLE_WINDOW_MINUTES)},
            "vibe_score": {"$exists": True},
            "provisional": {"$ne": True},
        }, {"vibe_score": 1}).to_list(50)

        outcomes = [r["vibe_score"] for r in after if r.get("vibe_score") is not None]

        # Still inside the settlement window and not yet gradeable: leave it.
        window_closed = now >= ts + timedelta(
            minutes=SETTLE_AFTER_MINUTES + SETTLE_WINDOW_MINUTES
        )
        if len(outcomes) < MIN_OUTCOME_READINGS and not window_closed:
            settled["skipped"] += 1
            continue

        result = grade_call(
            reading.get("vibe_score", 50),
            outcomes,
            reading.get("consensus_at_time"),
        )

        await db.ratings.update_one(
            {"id": reading["id"]},
            {"$set": {
                "stake_verdict": result["verdict"],
                "stake_outcome": result["outcome"],
                "stake_error": result["error"],
                "stake_clout_delta": result["clout_delta"],
                "stake_settled_at": now,
            }},
        )

        if result["clout_delta"]:
            await db.users.update_one(
                {"id": reading["user_id"]},
                {"$inc": {"clout_points": result["clout_delta"]}},
            )

        settled[result["verdict"]] += 1

    return settled


SETTLE_INTERVAL_MINUTES = 10


async def settle_loop():
    """
    Grade Calls on a clock. A stake that is never settled is just a boost with
    no downside, which would defeat the whole mechanic.

    Never allowed to die: one bad night of data must not silently stop every
    future settlement.
    """
    import asyncio
    from app.config import logger

    while True:
        await asyncio.sleep(SETTLE_INTERVAL_MINUTES * 60)
        try:
            result = await settle_pending_calls()
            if any(result.get(k) for k in ("right", "wrong", "void")):
                logger.info(f"Calls settled: {result}")
        except Exception as e:
            logger.warning(f"Call settlement pass failed: {e}")
