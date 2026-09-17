"""
Vibe Surge: the collective bolt-tap meter.

Scouts drop bolt taps. Each tap fills the venue's meter. Time-weighted and
attendance-scaled, so a packed venue needs more taps to reach MAXED.

Levels: EMPTY -> TRICKLE -> RISING -> SURGING -> MAXED

These words describe a METER FILLING, never the room itself. The old ladder
(DORMANT, STIRRING, BUZZING, POPPING, ELECTRIC) read as statements about a
venue, so a LIT room with nobody tapping announced itself as DORMANT. Worse,
the words were shared with two other scales. See docs/VOCABULARY.md.

Checked against every other ladder in the product before being chosen:
  energy      QUIET CHILL WARMING CHARGED LIT PEAK      (docs/ENERGY.md)
  density     NONE THIN PARTIAL FIRM DENSE SATURATED    (signal_density.py)
  reputation  New Building Solid Established Elite      (routes/venues.py)
No word appears on more than one.

Charge math:
  weighted_taps = sum(tap.multiplier x time_weight(age_minutes))
  threshold     = max(checkin_count x 2, 50)
  charge_pct    = weighted_taps / threshold

Time decay:
  < 30 min  -> 1.00x  (hot, in the room right now)
  30-60 min -> 0.70x
  60-90 min -> 0.40x
  90-180min -> 0.15x
  > 180 min -> ignored

Squad Surge:
  If a crewmate tapped this venue in the last 10 min -> 1.5x multiplier.

Socket.IO: broadcasts surge_update when level changes.
"""
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException

from app.config import db, sio, logger
from app.models import Coordinates
from app.services.auth import require_auth
from app.services.expo_push import send_push_notifications
from app.services.vibe import is_within_geofence
from app.services import surge_policy

router = APIRouter(tags=["surge"])

# Honest-scarcity rules (presence damping, ELECTRIC gate, sustain window).
# Set SURGE_STRICT=0 to relax for a demo night; default is strict.
SURGE_STRICT = os.environ.get("SURGE_STRICT", "1") != "0"


def _utc(ts: datetime) -> datetime:
    """Mongo returns naive UTC datetimes; normalize before arithmetic."""
    return ts.replace(tzinfo=timezone.utc) if ts.tzinfo is None else ts

LEVELS = [
    (0.00, 0.08, "empty",   "EMPTY",   "#3A3A4E"),
    (0.08, 0.32, "trickle", "TRICKLE", "#5544FF"),
    (0.32, 0.58, "rising",  "RISING",  "#AA00FF"),
    (0.58, 0.84, "surging", "SURGING", "#FF7700"),
    (0.84, 1.01, "maxed",   "MAXED",   "#FF0055"),
]

NEXT_LEVEL = {
    "empty": "TRICKLE", "trickle": "RISING",
    "rising": "SURGING", "surging": "MAXED", "maxed": None,
}

# The old level ids, kept so a document written before the rename still reads.
LEGACY_LEVEL_IDS = {
    "dormant": "empty", "stirring": "trickle", "buzzing": "rising",
    "popping": "surging", "electric": "maxed",
}

def _time_weight(age_minutes):
    if age_minutes < 30:  return 1.00
    if age_minutes < 60:  return 0.70
    if age_minutes < 90:  return 0.40
    if age_minutes < 180: return 0.15
    return 0.0

def _level_for(pct):
    for lo, hi, name, label, color in LEVELS:
        if lo <= pct < hi:
            return name, label, color
    return "empty", "EMPTY", "#333344"

async def _compute_surge(venue_id):
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=3)
    bolts = await db.venue_bolts.find({"venue_id": venue_id, "ts": {"$gte": cutoff}}).to_list(2000)

    def _bolt_weight(b):
        w = _time_weight((now - _utc(b["ts"])).total_seconds() / 60) * b.get("multiplier", 1.0)
        if SURGE_STRICT:
            # Legacy bolts (no "present" field) predate presence tracking; count them fully.
            w *= surge_policy.presence_weight(b.get("present", True))
        return w

    weighted = sum(_bolt_weight(b) for b in bolts)
    checkin_count = await db.checkins.count_documents({"venue_id": venue_id, "checked_out_at": None})
    # Diversity-scaled threshold: solo is harder, crowd gets easier as unique tappers grow
    unique_tappers = len(set(b["user_id"] for b in bolts))
    base = max(checkin_count * 4, 120)
    if unique_tappers <= 1:
        diversity_factor = 1.5   # solo — hardest
    elif unique_tappers <= 3:
        diversity_factor = 1.0   # small crew — normal
    else:
        diversity_factor = max(0.4, 1.0 - (unique_tappers - 3) * 0.06)  # crowd — easier
    threshold = round(base * diversity_factor)
    charge_pct = min(weighted / threshold, 1.0)
    meta = await db.venue_surge_meta.find_one({"venue_id": venue_id}) or {}

    gate_open = True
    if SURGE_STRICT:
        # ── ELECTRIC corroboration gate + sustain window ──────────────────────
        recent = now - timedelta(minutes=30)
        present_tappers = len({
            b["user_id"] for b in bolts
            if b.get("present", True) and _utc(b["ts"]) >= recent
        })
        hot_ratings = await db.ratings.count_documents({
            "venue_id": venue_id,
            "timestamp": {"$gte": recent},
            "energy": {"$in": ["lit", "peak"]},
        })
        gate_open = surge_policy.max_gate_open(present_tappers, hot_ratings)
        charge_pct = surge_policy.apply_max_gate(charge_pct, gate_open)

        prev_candidate = meta.get("max_candidate_since", meta.get("electric_candidate_since"))
        prev_candidate = _utc(prev_candidate) if prev_candidate else None
        charge_pct, candidate_since = surge_policy.sustain_state(charge_pct, prev_candidate, now)
        if candidate_since != prev_candidate:
            await db.venue_surge_meta.update_one(
                {"venue_id": venue_id},
                {"$set": {"max_candidate_since": candidate_since}},
                upsert=True,
            )

    level, label, color = _level_for(charge_pct)
    level_idx = next(i for i, row in enumerate(LEVELS) if row[2] == level)
    lo_pct, hi_pct = LEVELS[level_idx][0], LEVELS[level_idx][1]
    band = hi_pct - lo_pct
    level_progress = round((charge_pct - lo_pct) / band, 3) if band > 0 else 1.0
    taps_to_next = max(0, round(hi_pct * threshold - weighted)) if level != "maxed" else 0
    return {
        "charge_pct": round(charge_pct, 3),
        "level": level, "level_label": label, "level_color": color,
        "level_progress": min(level_progress, 1.0),
        "taps_to_next": taps_to_next, "next_level": NEXT_LEVEL.get(level),
        "threshold": threshold, "checkin_count": checkin_count,
        "tap_count": len(bolts), "total_surges": meta.get("surge_count", 0),
    }

@router.get("/venues/{venue_id}/surge")
async def get_venue_surge(venue_id: str):
    venue = await db.venues.find_one({"id": venue_id})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")
    return await _compute_surge(venue_id)

@router.post("/venues/{venue_id}/bolt")
async def drop_bolt(
    venue_id: str,
    coordinates: Optional[Coordinates] = Body(default=None, embed=True),
    user: dict = Depends(require_auth),
):
    now = datetime.now(timezone.utc)
    user_id = user["id"]
    venue = await db.venues.find_one({"id": venue_id})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    # Verified presence: coordinates inside the venue geofence. Taps without
    # verified presence still land but are damped in strict mode (surge_policy).
    is_present = False
    if coordinates is not None and venue.get("coordinates"):
        is_present = is_within_geofence(
            coordinates,
            Coordinates(**venue["coordinates"]),
            radius_m=venue.get("geofence_radius_m", 100),
        )
    # Rate limit: 1 bolt per 10 seconds
    if await db.venue_bolts.find_one({"venue_id": venue_id, "user_id": user_id, "ts": {"$gte": now - timedelta(seconds=10)}}):
        raise HTTPException(status_code=429, detail="Too fast - hold on a moment")
    # Squad surge multiplier
    multiplier = 1.0
    is_squad_surge = False
    crew = await db.crews.find_one({"member_ids": user_id})
    if crew:
        members = set(crew.get("member_ids", []))
        crew_taps = await db.venue_bolts.count_documents({
            "venue_id": venue_id, "user_id": {"$in": list(members - {user_id})},
            "ts": {"$gte": now - timedelta(minutes=10)},
        })
        if crew_taps >= 1:
            multiplier, is_squad_surge = 1.5, True
    await db.venue_bolts.insert_one({
        "venue_id": venue_id, "user_id": user_id, "ts": now,
        "multiplier": multiplier, "present": is_present,
    })
    surge = await _compute_surge(venue_id)
    meta = await db.venue_surge_meta.find_one({"venue_id": venue_id}) or {}
    prev_level = LEGACY_LEVEL_IDS.get(meta.get("last_level", "empty"), meta.get("last_level", "empty"))
    if surge["level"] != prev_level:
        new_count = meta.get("surge_count", 0) + (1 if surge["level"] == "maxed" else 0)
        await db.venue_surge_meta.update_one(
            {"venue_id": venue_id},
            {"$set": {"last_level": surge["level"], "updated_at": now, "surge_count": new_count}},
            upsert=True,
        )
        try:
            await sio.emit("surge_update", {
                "venue_id": venue_id, "new_level": surge["level"], "prev_level": prev_level,
                "charge_pct": surge["charge_pct"], "level_label": surge["level_label"],
                "level_color": surge["level_color"], "is_surge": surge["level"] == "maxed",
                "taps_to_next": surge["taps_to_next"],
            })
        except Exception as e:
            logger.warning(f"surge_update emit failed: {e}")

        # ── ELECTRIC reached: push notify recent tappers who aren't here right now ──
        if surge["level"] == "maxed" and prev_level != "maxed":
            try:
                venue_name = venue.get("name", "A venue near you")
                # All users who tapped this venue in the last 3 hours, excluding trigger user
                recent_tapper_ids = await db.venue_bolts.distinct(
                    "user_id",
                    {"venue_id": venue_id, "ts": {"$gte": now - timedelta(hours=3)}, "user_id": {"$ne": user_id}},
                )
                if recent_tapper_ids:
                    tappers = await db.users.find(
                        {"id": {"$in": recent_tapper_ids}, "push_token": {"$ne": None}},
                        {"push_token": 1},
                    ).to_list(500)
                    tokens = [u["push_token"] for u in tappers if u.get("push_token")]
                    await send_push_notifications(
                        tokens,
                        title=f"⚡ {venue_name} just hit ELECTRIC",
                        body="Peak energy — the room is alive. Get in now.",
                        data={"venue_id": venue_id, "type": "max_alert"},
                    )
            except Exception as e:
                logger.warning(f"ELECTRIC push failed: {e}")
    return {**surge, "squad_multiplier": multiplier, "is_squad_surge": is_squad_surge, "is_present": is_present}
