"""
VIIBE - City Energy

Energy at city scale: the weighted aggregate of every room currently reporting,
with trend and a 30-minute sparkline.

This is the actual product. A venue reading is the sensor; the city index is
what the sensors are for. It was called "City Pulse", which collided with Pulse
Check (the refresh a scout performs). Pulse now means one thing: the act of
refreshing a reading. See docs/VOCABULARY.md.

The wire keeps the old field names alongside the new ones until shipped clients
age out. Removing them is a deliberate later step, not a cleanup.
"""
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter

from app.config import db

router = APIRouter(tags=["city_energy"])


def _energy_label(score: float) -> str:
    """Map the aggregate score onto the canonical energy ladder (docs/ENERGY.md).
    The city uses exactly the same words as a room, because it is the same
    quantity measured over a wider area."""
    if score >= 85: return "PEAK"
    if score >= 65: return "LIT"
    if score >= 45: return "WARMING"
    if score >= 20: return "CHILL"
    return "QUIET"


async def compute_city_energy(city: str) -> dict:
    """
    Compute live City Energy. Reusable by both the HTTP endpoint and the
    Socket.IO broadcast fired after each rating or reaction.
    """
    now = datetime.now(timezone.utc)
    hour_ago = now - timedelta(hours=1)
    thirty_min_ago = now - timedelta(minutes=30)
    midnight = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # Venues with a rating or reaction in the last hour
    recent_ratings = await db.ratings.distinct("venue_id", {
        "timestamp": {"$gte": hour_ago}
    })
    recent_reaction_venues = await db.reactions.distinct("venue_id", {
        "timestamp": {"$gte": hour_ago}
    })
    active_ids = set(recent_ratings) | set(recent_reaction_venues)

    active_venues = await db.venues.find(
        {"city": city, "id": {"$in": list(active_ids)}},
        {"_id": 0, "id": 1, "name": 1, "current_vibe_score": 1,
         "vibe_state": 1, "total_ratings_24h": 1, "vibe_signature": 1}
    ).to_list(200)

    # Weighted average: weight by total_ratings_24h (more active venues count more)
    if active_venues:
        total_weight = sum(max(v.get("total_ratings_24h", 1), 1) for v in active_venues)
        weighted_sum = sum(
            v.get("current_vibe_score", 0) * max(v.get("total_ratings_24h", 1), 1)
            for v in active_venues
        )
        energy_score = round(weighted_sum / total_weight, 1)
        top_venue = max(active_venues, key=lambda v: v.get("current_vibe_score", 0))
        trending = {"name": top_venue["name"], "score": int(top_venue["current_vibe_score"])}
        hot_venues = sum(1 for v in active_venues if v.get("current_vibe_score", 0) >= 65)

        # ── City Vibe DNA: majority vote across active venues ────────────────
        # Weighted by current_vibe_score so hotter venues drive the city signature
        sig_votes: dict[str, float] = {}
        for v in active_venues:
            sig = v.get("vibe_signature")
            if isinstance(sig, dict):  # legacy docs stored the full detail object
                sig = sig.get("signature")
            if sig:
                weight = v.get("current_vibe_score", 1)
                sig_votes[sig] = sig_votes.get(sig, 0) + weight
        city_vibe_signature = max(sig_votes, key=sig_votes.get) if sig_votes else None
    else:
        energy_score = 0
        trending = None
        hot_venues = 0
        city_vibe_signature = None

    # Active scouts: unique raters OR reactors in the last hour
    rating_scouts = set(await db.ratings.distinct("user_id", {"timestamp": {"$gte": hour_ago}}))
    reaction_scouts = set(await db.reactions.distinct("user_id", {"timestamp": {"$gte": hour_ago}}))
    active_scouts = len(rating_scouts | reaction_scouts)

    # Readings taken tonight (quick reads dropped today)
    readings_tonight = await db.quick_pulses.count_documents({
        "city": city,
        "timestamp": {"$gte": midnight}
    })

    # ── 30-minute sparkline: 6 data points × 5-min buckets ──
    snapshots = await db.vibe_snapshots.find({
        "timestamp": {"$gte": thirty_min_ago},
        "venue_id": {"$in": list(active_ids)} if active_ids else {"$exists": True}
    }).to_list(2000)

    # Group by 5-minute bucket (0 = most recent, 5 = oldest)
    buckets: dict[int, list] = {}
    for snap in snapshots:
        snap_time = snap.get("timestamp", now)
        if isinstance(snap_time, str):
            snap_time = datetime.fromisoformat(snap_time.replace("Z", "+00:00"))
        if snap_time.tzinfo is None:
            snap_time = snap_time.replace(tzinfo=timezone.utc)
        minutes_ago = (now - snap_time).total_seconds() / 60
        bucket = min(5, int(minutes_ago / 5))
        buckets.setdefault(bucket, []).append(snap.get("vibe_score", 0))

    # Build sparkline oldest→newest (index 5 → index 0)
    sparkline = []
    last_val = energy_score
    for i in range(5, -1, -1):
        if i in buckets and buckets[i]:
            val = round(sum(buckets[i]) / len(buckets[i]), 1)
            last_val = val
        else:
            val = last_val
        sparkline.append(val)

    # Trend: compare latest bucket vs oldest bucket
    if sparkline[0] > 0 and sparkline[-1] > sparkline[0] + 5:
        trend = "heating_up"
    elif sparkline[-1] < sparkline[0] - 5:
        trend = "cooling_down"
    else:
        trend = "stable"

    label = _energy_label(energy_score)

    return {
        "city":                city,
        "energy_score":        energy_score,
        "energy_label":        label,
        "trend":               trend,
        "active_scouts":       active_scouts,
        "live_venues":         len(active_venues),
        "hot_venues":          hot_venues,
        "readings_tonight":    readings_tonight,
        "trending_venue":      trending,
        "sparkline":           sparkline,   # 6 values, oldest to newest, 5-min buckets
        "city_vibe_signature": city_vibe_signature,  # HIGH_VELOCITY / STEADY_GROOVE / ATMOSPHERIC_CHILL
        "updated_at":          now.isoformat(),

        # Deprecated aliases for clients shipped before the rename. Remove once
        # the old APK is out of circulation.
        "pulse_score":         energy_score,
        "pulse_label":         label,
        "pulses_tonight":      readings_tonight,
    }


@router.get("/city-energy/{city}")
async def get_city_energy(city: str):
    """GET /api/city-energy/{city}: live City Energy with a 30-minute sparkline."""
    return await compute_city_energy(city)


@router.get("/city-pulse/{city}", include_in_schema=False)
async def get_city_pulse_deprecated(city: str):
    """Deprecated alias for shipped clients. Use /city-energy/{city}."""
    return await compute_city_energy(city)
