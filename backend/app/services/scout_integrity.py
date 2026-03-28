"""
Scout Integrity Score (SIS) — AI-01

Hidden per-scout reliability weight (0.1 – 1.5 multiplier).
Determines how much a scout's rating moves the Pulse Score.

Never exposed to scouts — admin-only. Prevents gaming.

Factors (weighted blend):
  1. Track record (50%)   — total verified ratings, capped at 100
  2. Consensus accuracy (30%) — how often this scout's rating agrees
                                 with the eventual venue consensus
  3. Fraud signals (20%)  — stationary_peak_abuse flags, burst holds,
                             text/numeric contradiction flags

Score range:
  Raw 0–100 → mapped to weight 0.1×–1.5×
  New scout (0 ratings) → 0.3× (not zero — every voice counts a little)
  Proven scout (score 80+) → 1.2×–1.5×
"""
import asyncio
from datetime import datetime, timedelta, timezone
from app.config import db


# ── Weight mapping ─────────────────────────────────────────────────────────────

def _sis_to_weight(sis_score: float) -> float:
    """Map raw SIS score (0–100) to credibility weight multiplier (0.1–1.5)."""
    # New scout default floor
    if sis_score <= 0:
        return 0.3
    # Linear mapping: 0→0.3, 50→0.9, 80→1.2, 100→1.5
    if sis_score <= 50:
        return 0.3 + (sis_score / 50) * 0.6
    else:
        return 0.9 + ((sis_score - 50) / 50) * 0.6


# ── Factor 1: Track record ─────────────────────────────────────────────────────

async def _track_record_score(user_id: str) -> float:
    """
    0–100 score based on total verified (non-flagged) ratings.
    30 ratings = 50 points. 100 ratings = 100 points (cap).
    """
    total = await db.ratings.count_documents({
        "user_id": user_id,
        "provisional": {"$ne": True},
        "low_confidence": {"$ne": True},
    })
    if total == 0:
        return 0.0
    if total >= 100:
        return 100.0
    return min(100.0, (total / 100) * 100)


# ── Factor 2: Consensus accuracy ───────────────────────────────────────────────

async def _consensus_accuracy_score(user_id: str) -> float:
    """
    Compare this scout's historical ratings against the venue's
    eventual consensus score at that time.

    A scout who consistently rates in line with other scouts (±15 pts)
    gets a high accuracy score. Outliers get penalised.

    Looks at last 50 ratings only (recent behaviour matters more).
    Returns 0–100.
    """
    recent_ratings = await db.ratings.find(
        {
            "user_id": user_id,
            "vibe_score": {"$exists": True},
            "provisional": {"$ne": True},
        },
        {"venue_id": 1, "vibe_score": 1, "timestamp": 1},
    ).sort("timestamp", -1).to_list(50)

    if not recent_ratings:
        return 50.0  # neutral default — no data yet

    within_range_count = 0
    compared_count = 0

    for rating in recent_ratings:
        venue_id = rating.get("venue_id")
        scout_score = rating.get("vibe_score", 50)
        ts = rating.get("timestamp")
        if not venue_id or ts is None:
            continue
        if isinstance(ts, str):
            ts = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)

        # Get other scouts' ratings at this venue within 30 min of this rating
        window_start = ts - timedelta(minutes=30)
        window_end = ts + timedelta(minutes=30)
        peer_ratings = await db.ratings.find(
            {
                "venue_id": venue_id,
                "user_id": {"$ne": user_id},
                "timestamp": {"$gte": window_start, "$lte": window_end},
                "vibe_score": {"$exists": True},
                "provisional": {"$ne": True},
            },
            {"vibe_score": 1},
        ).to_list(20)

        if not peer_ratings:
            continue  # no peers to compare against

        peer_scores = [r["vibe_score"] for r in peer_ratings if r.get("vibe_score") is not None]
        if not peer_scores:
            continue

        peer_avg = sum(peer_scores) / len(peer_scores)
        deviation = abs(scout_score - peer_avg)
        compared_count += 1
        if deviation <= 15:
            within_range_count += 1

    if compared_count == 0:
        return 50.0  # no peers — neutral

    accuracy_rate = within_range_count / compared_count
    return round(accuracy_rate * 100, 1)


# ── Factor 3: Fraud signal penalty ────────────────────────────────────────────

async def _fraud_penalty_score(user_id: str) -> float:
    """
    Start at 100. Deduct points for each fraud signal:
      - stationary_peak_abuse: -20 each (max 3 = -60)
      - text_contradiction:    -10 each (max 3 = -30)
      - burst_provisional:     -5  each (max 4 = -20)

    Floor at 0.
    """
    recent_cutoff = datetime.now(timezone.utc) - timedelta(days=30)

    abuse_count = await db.ratings.count_documents({
        "user_id": user_id,
        "stationary_peak_abuse": True,
        "timestamp": {"$gte": recent_cutoff},
    })
    contradiction_count = await db.ratings.count_documents({
        "user_id": user_id,
        "text_contradiction": True,
        "timestamp": {"$gte": recent_cutoff},
    })
    provisional_count = await db.ratings.count_documents({
        "user_id": user_id,
        "provisional": True,
        "timestamp": {"$gte": recent_cutoff},
    })

    penalty = 0.0
    penalty += min(3, abuse_count) * 20
    penalty += min(3, contradiction_count) * 10
    penalty += min(4, provisional_count) * 5

    return max(0.0, 100.0 - penalty)


# ── Public interface ───────────────────────────────────────────────────────────

async def compute_sis(user_id: str) -> dict:
    """
    Compute full Scout Integrity Score for a user.
    Returns: { sis_score, weight, breakdown }

    Runs the 3 factor computations in parallel.
    """
    track, consensus, fraud = await asyncio.gather(
        _track_record_score(user_id),
        _consensus_accuracy_score(user_id),
        _fraud_penalty_score(user_id),
    )

    # Weighted blend: track 50%, consensus 30%, fraud 20%
    sis_score = round(track * 0.50 + consensus * 0.30 + fraud * 0.20, 1)
    weight = round(_sis_to_weight(sis_score), 3)

    return {
        "sis_score": sis_score,
        "weight": weight,
        "breakdown": {
            "track_record": round(track, 1),
            "consensus_accuracy": round(consensus, 1),
            "fraud_penalty_base": round(fraud, 1),
        },
    }


async def get_sis_weight(user_id: str) -> float:
    """
    Fast path — returns just the credibility weight multiplier.
    Used at rating submission time to stamp credibility_weight on the doc.

    Checks cache (db.scout_sis) first. Cache TTL: 1 hour.
    """
    cached = await db.scout_sis.find_one({"user_id": user_id})
    now = datetime.now(timezone.utc)

    if cached:
        cached_at = cached.get("computed_at")
        if isinstance(cached_at, str):
            cached_at = datetime.fromisoformat(cached_at.replace("Z", "+00:00"))
        if cached_at and cached_at.tzinfo is None:
            cached_at = cached_at.replace(tzinfo=timezone.utc)
        if cached_at and (now - cached_at).total_seconds() < 3600:
            return cached.get("weight", 0.3)

    # Recompute
    result = await compute_sis(user_id)
    await db.scout_sis.update_one(
        {"user_id": user_id},
        {"$set": {
            "user_id": user_id,
            "sis_score": result["sis_score"],
            "weight": result["weight"],
            "breakdown": result["breakdown"],
            "computed_at": now,
        }},
        upsert=True,
    )
    return result["weight"]
