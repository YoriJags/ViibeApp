"""
Vibe DNA — Scout taste fingerprint from rating + tap history.

Rating affinities: which venue types you rate highest (how much you enjoy them).
Tap affinities: which venue types you electrify most (where you drop bolts).
Time patterns: when they go out, which days, how their taste evolves.
Area patterns: which neighbourhoods they frequent.

All signals compound over time — the more they rate, the sharper the DNA.

Routes:
  GET /users/{user_id}/dna   — full taste fingerprint + intelligence signals
"""
from collections import Counter
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from app.config import db

router = APIRouter(tags=["dna"])


def _label(score: int) -> str:
    if score >= 80: return "Electric"
    if score >= 60: return "Popping"
    if score >= 40: return "Chill"
    return "Low Key"


async def _compute_dna(user_id: str) -> dict:
    # ── Rating affinities ────────────────────────────────────────────────────
    ratings = await db.ratings.find(
        {"user_id": user_id},
        {"venue_id": 1, "vibe_score": 1, "timestamp": 1},
    ).sort("timestamp", -1).to_list(200)

    if len(ratings) < 3:
        return {
            "insufficient_data": True,
            "min_ratings": 3,
            "current_ratings": len(ratings),
        }

    venue_cache: dict = {}
    type_scores: dict = {}
    type_hours: list = []

    for r in ratings:
        vid = r.get("venue_id")
        if vid not in venue_cache:
            v = await db.venues.find_one({"id": vid}, {"venue_type": 1})
            venue_cache[vid] = v.get("venue_type", "other") if v else "other"
        vtype = venue_cache[vid]
        type_scores.setdefault(vtype, []).append(r.get("vibe_score", 50))
        ts = r.get("timestamp")
        if ts and isinstance(ts, datetime):
            type_hours.append(ts.hour)

    avgs = {vt: sum(sc) / len(sc) for vt, sc in type_scores.items()}
    max_avg = max(avgs.values()) or 1
    normalized = {vt: round((avg / max_avg) * 100) for vt, avg in avgs.items()}

    affinities = sorted([
        {
            "venue_type": vt,
            "score": normalized[vt],
            "rating_count": len(type_scores[vt]),
            "label": _label(normalized[vt]),
        }
        for vt in normalized
    ], key=lambda x: x["score"], reverse=True)

    dominant_type = max(type_scores, key=lambda vt: len(type_scores[vt]))

    avg_hour = sum(type_hours) / len(type_hours) if type_hours else 22
    if 6 <= avg_hour < 22:
        night_style = "early_bird"
        night_style_label = "Early Bird — you like to get there first"
    elif 0 <= avg_hour < 4:
        night_style = "night_owl"
        night_style_label = "Night Owl — you peak after midnight"
    else:
        night_style = "midnight_crew"
        night_style_label = "Midnight Crew — you hit your stride at midnight"

    # ── Tap affinities ───────────────────────────────────────────────────────
    # Which venue types does this scout electrify most? Group bolt taps by venue type.
    bolt_pipeline = [
        {"$match": {"user_id": user_id}},
        {"$group": {"_id": "$venue_id", "tap_count": {"$sum": 1}}},
        {"$sort": {"tap_count": -1}},
        {"$limit": 50},
    ]
    bolt_docs = await db.venue_bolts.aggregate(bolt_pipeline).to_list(50)

    tap_type_counts: dict = {}
    for doc in bolt_docs:
        vid = doc["_id"]
        if vid not in venue_cache:
            v = await db.venues.find_one({"id": vid}, {"venue_type": 1})
            venue_cache[vid] = v.get("venue_type", "other") if v else "other"
        vtype = venue_cache[vid]
        tap_type_counts[vtype] = tap_type_counts.get(vtype, 0) + doc["tap_count"]

    tap_total = sum(tap_type_counts.values()) or 1
    tap_affinities = sorted([
        {
            "venue_type": vt,
            "tap_count": cnt,
            "share": round(cnt / tap_total * 100),
        }
        for vt, cnt in tap_type_counts.items()
    ], key=lambda x: x["tap_count"], reverse=True)

    top_tap_type = tap_affinities[0]["venue_type"] if tap_affinities else None

    # ── Day-of-week patterns ─────────────────────────────────────────────────
    day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    day_counts: Counter = Counter()
    for r in ratings:
        ts = r.get("timestamp")
        if ts and isinstance(ts, datetime):
            day_counts[ts.weekday()] += 1

    day_pattern = [
        {"day": day_names[i], "count": day_counts.get(i, 0)}
        for i in range(7)
    ]
    peak_day_idx = day_counts.most_common(1)[0][0] if day_counts else 5  # default Saturday
    peak_day = day_names[peak_day_idx]

    # ── Neighbourhood preferences ────────────────────────────────────────────
    area_counts: Counter = Counter()
    for r in ratings:
        vid = r.get("venue_id")
        if vid in venue_cache:
            vt = venue_cache[vid]
        else:
            v = await db.venues.find_one({"id": vid}, {"area": 1})
            area_counts[v.get("area", "unknown") if v else "unknown"] += 1
            continue
        v = await db.venues.find_one({"id": vid}, {"area": 1})
        if v:
            area_counts[v.get("area", "unknown")] += 1

    top_areas = [
        {"area": area, "count": cnt}
        for area, cnt in area_counts.most_common(5)
        if area != "unknown"
    ]

    # ── Taste evolution: recent (last 30) vs older ───────────────────────────
    recent_ratings  = ratings[:30]
    older_ratings   = ratings[30:]
    recent_types: Counter = Counter()
    older_types: Counter  = Counter()
    for r in recent_ratings:
        vt = venue_cache.get(r.get("venue_id", ""), "other")
        recent_types[vt] += 1
    for r in older_ratings:
        vt = venue_cache.get(r.get("venue_id", ""), "other")
        older_types[vt] += 1

    # Did their most-rated type shift?
    taste_shifting = (
        recent_types.most_common(1)[0][0] != older_types.most_common(1)[0][0]
        if recent_types and older_types
        else False
    )

    # ── Energy preference ────────────────────────────────────────────────────
    energy_map = {"quiet": 1, "chill": 2, "warming": 3, "charged": 4, "lit": 5, "peak": 6}
    energy_scores = []
    for r in ratings:
        e = r.get("energy", "chill")
        energy_scores.append(energy_map.get(e, 2))
    avg_energy_pref = round(sum(energy_scores) / len(energy_scores), 1) if energy_scores else 3.0
    energy_label = (
        "Peak Seeker"   if avg_energy_pref >= 5 else
        "High Energy"   if avg_energy_pref >= 4 else
        "Mid Vibration" if avg_energy_pref >= 3 else
        "Low Key"
    )

    return {
        "user_id": user_id,
        "affinities": affinities,
        "dominant_type": dominant_type,
        "night_style": night_style,
        "night_style_label": night_style_label,
        "total_ratings_analyzed": len(ratings),
        "tap_affinities": tap_affinities,
        "top_tap_type": top_tap_type,
        "total_bolts_analyzed": sum(tap_type_counts.values()),
        # ── Intelligence expansion ──
        "day_pattern": day_pattern,
        "peak_day": peak_day,
        "top_areas": top_areas,
        "energy_preference": {
            "avg_score": avg_energy_pref,
            "label": energy_label,
        },
        "taste_shifting": taste_shifting,
        "computed_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/users/{user_id}/dna")
async def get_user_dna(user_id: str):
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "id": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return await _compute_dna(user_id)
