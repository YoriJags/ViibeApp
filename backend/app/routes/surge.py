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
from app.services.expo_push import send_push_notifications

router = APIRouter(tags=["surge"])

LEVELS = [
    (0.00, 0.08, "dormant",  "DORMANT",   "#3A3A4E"),
    (0.08, 0.32, "stirring", "STIRRING",  "#5544FF"),
    (0.32, 0.58, "buzzing",  "BUZZING",   "#AA00FF"),
    (0.58, 0.84, "popping",  "POPPING",   "#FF7700"),
    (0.84, 1.01, "electric", "ELECTRIC",  "#FF0055"),
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

        # ── ELECTRIC reached: push notify recent tappers who aren't here right now ──
        if surge["level"] == "electric" and prev_level != "electric":
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
                        data={"venue_id": venue_id, "type": "electric_alert"},
                    )
            except Exception as e:
                logger.warning(f"ELECTRIC push failed: {e}")
    return {**surge, "squad_multiplier": multiplier, "is_squad_surge": is_squad_surge}
