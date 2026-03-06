"""
Vibe Surge — Collective venue charge mechanic.

Scouts drop bolt taps. Each tap contributes to the venue's Charge Bar.
Time-weighted + attendance-scaled: a packed venue needs more taps to hit ELECTRIC.

Levels: DORMANT -> STIRRING -> BUZZING -> POPPING -> ELECTRIC

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
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException

from app.config import db, sio, logger
from app.services.auth import require_auth

router = APIRouter(tags=["surge"])

LEVELS = [
    (0.00, 0.20, "dormant",  "DORMANT",   "#333344"),
    (0.20, 0.40, "stirring", "STIRRING",  "#3399FF"),
    (0.40, 0.60, "buzzing",  "BUZZING",   "#9933FF"),
    (0.60, 0.85, "popping",  "POPPING",   "#FF9933"),
    (0.85, 1.01, "electric", "ELECTRIC",  "#FF3366"),
]

NEXT_LEVEL = {
    "dormant": "STIRRING", "stirring": "BUZZING",
    "buzzing": "POPPING",  "popping":  "ELECTRIC", "electric": None,
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
    return "dormant", "DORMANT", "#333344"

async def _compute_surge(venue_id):
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=3)
    bolts = await db.venue_bolts.find({"venue_id": venue_id, "ts": {"$gte": cutoff}}).to_list(2000)
    weighted = sum(_time_weight((now - b["ts"]).total_seconds() / 60) * b.get("multiplier", 1.0) for b in bolts)
    checkin_count = await db.checkins.count_documents({"venue_id": venue_id, "checked_out_at": None})
    threshold = max(checkin_count * 2, 50)
    charge_pct = min(weighted / threshold, 1.0)
    level, label, color = _level_for(charge_pct)
    level_idx = next(i for i, row in enumerate(LEVELS) if row[2] == level)
    lo_pct, hi_pct = LEVELS[level_idx][0], LEVELS[level_idx][1]
    band = hi_pct - lo_pct
    level_progress = round((charge_pct - lo_pct) / band, 3) if band > 0 else 1.0
    taps_to_next = max(0, round(hi_pct * threshold - weighted)) if level != "electric" else 0
    meta = await db.venue_surge_meta.find_one({"venue_id": venue_id}) or {}
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
async def drop_bolt(venue_id: str, user: dict = Depends(require_auth)):
    now = datetime.now(timezone.utc)
    user_id = user["id"]
    venue = await db.venues.find_one({"id": venue_id})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")
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
    await db.venue_bolts.insert_one({"venue_id": venue_id, "user_id": user_id, "ts": now, "multiplier": multiplier})
    surge = await _compute_surge(venue_id)
    meta = await db.venue_surge_meta.find_one({"venue_id": venue_id}) or {}
    prev_level = meta.get("last_level", "dormant")
    if surge["level"] != prev_level:
        new_count = meta.get("surge_count", 0) + (1 if surge["level"] == "electric" else 0)
        await db.venue_surge_meta.update_one(
            {"venue_id": venue_id},
            {"$set": {"last_level": surge["level"], "updated_at": now, "surge_count": new_count}},
            upsert=True,
        )
        try:
            await sio.emit("surge_update", {
                "venue_id": venue_id, "new_level": surge["level"], "prev_level": prev_level,
                "charge_pct": surge["charge_pct"], "level_label": surge["level_label"],
                "level_color": surge["level_color"], "is_surge": surge["level"] == "electric",
                "taps_to_next": surge["taps_to_next"],
            })
        except Exception as e:
            logger.warning(f"surge_update emit failed: {e}")
    return {**surge, "squad_multiplier": multiplier, "is_squad_surge": is_squad_surge}
