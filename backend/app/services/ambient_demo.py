"""
Ambient Demo Engine — keeps the map alive during cold-start, honestly.

Runs inside the backend (asyncio loop, no external cron) when DEMO_AMBIENT=1.
Every AMBIENT_INTERVAL_MINUTES it refreshes demo-scout ratings so venues never
look dead — with one hard rule that protects the brand:

    ORGANIC WINS. Any venue with a real (non-demo) rating in the last
    ORGANIC_DEFER_MINUTES is skipped entirely. Ambient energy fills
    silence; it never overwrites truth.

Time-of-day aware: Lagos venues warm up in the evening, peak late, cool by
morning. A Tuesday 3pm map reads mostly quiet — believable, not dead.

Kill switch: unset DEMO_AMBIENT (or set 0) on Railway and redeploy/restart.
All ambient ratings come from flagged demo-scout-* users, so
scripts/demo_energy.py --wipe still removes every trace.
"""
import asyncio
import os
import random
import uuid
from datetime import datetime, timedelta, timezone

from app.config import db, logger
from app.services.vibe import calculate_vibe_score, calculate_venue_aggregate

DEMO_PREFIX = "demo-scout-"
AMBIENT_INTERVAL_MINUTES = 30
ORGANIC_DEFER_MINUTES = 60
MAX_RATINGS_PER_VENUE_PER_RUN = 4

SCOUT_NAMES = ["Tobi", "Amara", "Seun", "Zara", "Emeka", "Dami", "Kemi", "Femi", "Nneka", "Tunde"]

# (energy choices, capacity choices, ratings range) per heat tier
PROFILES = {
    "peak":  (["peak", "peak", "lit"], ["full", "full", "vibrant"], (2, 4)),
    "hot":   (["lit", "lit", "peak"],  ["vibrant", "full"],         (2, 3)),
    "warm":  (["warming", "lit"],      ["vibrant", "sparse"],       (1, 2)),
    "chill": (["chill", "warming"],    ["sparse", "vibrant"],       (1, 2)),
    "quiet": (["quiet", "chill"],      ["sparse"],                  (0, 1)),
}


def _lagos_hour(now: datetime) -> int:
    return (now.hour + 1) % 24  # UTC+1


def _heat_budget(now: datetime) -> float:
    """0..1 scale of how alive the city should plausibly read right now."""
    # Demo override: hold the city at peak-night energy regardless of the clock,
    # so the map is presentable whenever it is being shown. Off by default;
    # unset DEMO_PEAK to return to honest time-of-day behaviour.
    if os.environ.get("DEMO_PEAK", "0") == "1":
        return 1.0
    h = _lagos_hour(now)
    is_weekend = now.weekday() >= 4  # Fri/Sat/Sun
    if 22 <= h or h < 3:
        base = 1.0
    elif 19 <= h < 22:
        base = 0.65
    elif 16 <= h < 19:
        base = 0.35
    elif 3 <= h < 7:
        base = 0.25
    else:
        base = 0.12
    return min(1.0, base * (1.25 if is_weekend else 0.85))


def _tier_for(rank_pct: float, budget: float) -> str:
    """Assign a heat tier from a venue's rank percentile and the city budget."""
    heat = (1.0 - rank_pct) * budget
    if heat >= 0.72:
        return "peak"
    if heat >= 0.5:
        return "hot"
    if heat >= 0.3:
        return "warm"
    if heat >= 0.12:
        return "chill"
    return "quiet"


async def _ensure_demo_users():
    for i, name in enumerate(SCOUT_NAMES):
        uid = f"{DEMO_PREFIX}{i}"
        await db.users.update_one(
            {"id": uid},
            {"$setOnInsert": {
                "id": uid, "name": name,
                "username": f"{name.lower()}_demo{i}",
                "email": f"{uid}@demo.viibe.app",
                "phone": f"+23480000000{i:02d}",
                "is_demo": True,
                "clout_points": random.randint(120, 900),
                "total_ratings": random.randint(8, 60),
                "rating_accuracy_score": round(random.uniform(0.7, 0.95), 2),
                "created_at": datetime.now(timezone.utc) - timedelta(days=random.randint(10, 90)),
            }},
            upsert=True,
        )


async def ambient_tick() -> dict:
    """One refresh pass. Returns a small summary for logging."""
    now = datetime.now(timezone.utc)
    budget = _heat_budget(now)
    organic_cutoff = now - timedelta(minutes=ORGANIC_DEFER_MINUTES)

    await _ensure_demo_users()

    # Expire old demo ratings so charge/aggregates decay naturally between runs
    await db.ratings.delete_many({
        "user_id": {"$regex": f"^{DEMO_PREFIX}"},
        "timestamp": {"$lt": now - timedelta(hours=2)},
    })

    venues = await db.venues.find(
        {"is_demo": {"$ne": True}}, {"_id": 0, "id": 1, "name": 1}
    ).to_list(200)
    random.shuffle(venues)  # rank order varies run to run — leaders rotate

    seeded = deferred = 0
    for rank, venue in enumerate(venues):
        organic = await db.ratings.count_documents({
            "venue_id": venue["id"],
            "timestamp": {"$gte": organic_cutoff},
            "user_id": {"$not": {"$regex": f"^{DEMO_PREFIX}"}},
        })
        if organic > 0:
            deferred += 1
            continue  # ORGANIC WINS — never touch a venue with real signal

        tier = _tier_for(rank / max(len(venues) - 1, 1), budget)
        energies, capacities, (lo, hi) = PROFILES[tier]
        n = min(random.randint(lo, hi) if hi else 0, MAX_RATINGS_PER_VENUE_PER_RUN)
        if n == 0:
            continue

        for scout_idx in random.sample(range(len(SCOUT_NAMES)), n):
            energy = random.choice(energies)
            capacity = random.choice(capacities)
            gate = random.choices(["clear", "slow", "blocked"], weights=[6, 3, 1])[0]
            await db.ratings.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": f"{DEMO_PREFIX}{scout_idx}",
                "venue_id": venue["id"],
                "energy": energy, "capacity": capacity, "gate": gate,
                "venue_specific": None, "photo_base64": None,
                "timestamp": now - timedelta(minutes=random.uniform(1, 25)),
                "is_correction": False,
                "vibe_score": calculate_vibe_score(energy, capacity, gate),
                "synced": True, "taxonomy_id": None, "vibe_note": None,
                "provisional": False, "provisional_until": None,
                "credibility_weight": round(random.uniform(0.75, 1.0), 2),
                "signal_token": f"demo-{uuid.uuid4().hex[:12]}",
            })

        aggregate = await calculate_venue_aggregate(venue["id"])
        if aggregate:
            await db.venues.update_one({"id": venue["id"]}, {"$set": aggregate})
        seeded += 1

    return {"budget": round(budget, 2), "seeded": seeded, "deferred_to_organic": deferred}


async def ambient_loop():
    """Started from server startup when DEMO_AMBIENT=1."""
    logger.info("Ambient demo engine ON (interval=%dmin, organic-defer=%dmin)",
                AMBIENT_INTERVAL_MINUTES, ORGANIC_DEFER_MINUTES)
    while True:
        try:
            summary = await ambient_tick()
            logger.info("ambient_demo tick: %s", summary)
        except Exception as e:
            logger.warning("ambient_demo tick failed: %s", e)
        await asyncio.sleep(AMBIENT_INTERVAL_MINUTES * 60)


def ambient_enabled() -> bool:
    return os.environ.get("DEMO_AMBIENT", "0") == "1"
