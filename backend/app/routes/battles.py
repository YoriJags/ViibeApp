"""
Venue Battle — real-time tap-off between two venues.

Two venues face off. Scouts tap for their side. The venue with the most
taps after the window wins. Battles are 30 minutes long and reset nightly.

One tap per user per battle — no spam, every bolt counts.

Routes:
  GET  /battles/active         — current active battle (or null)
  POST /battles/{id}/tap/{side} — tap for venue_a or venue_b
  POST /battles                 — create a battle (admin / system only, no auth guard for now)
"""
import uuid
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from app.config import db
from app.services.auth import require_auth

router = APIRouter(tags=["battles"])

BATTLE_DURATION_MINUTES = 30


async def _enrich_battle(battle: dict) -> dict:
    """Add venue names + compute derived fields."""
    venue_a = await db.venues.find_one({"id": battle["venue_a_id"]}, {"name": 1, "area": 1, "energy_level": 1, "current_vibe_score": 1})
    venue_b = await db.venues.find_one({"id": battle["venue_b_id"]}, {"name": 1, "area": 1, "energy_level": 1, "current_vibe_score": 1})

    taps_a = battle.get("taps_a", 0)
    taps_b = battle.get("taps_b", 0)
    total  = taps_a + taps_b or 1
    ends_at = battle["created_at"] + timedelta(minutes=BATTLE_DURATION_MINUTES)
    now = datetime.now(timezone.utc)
    seconds_left = max(0, int((ends_at - now).total_seconds()))

    return {
        "id": battle["id"],
        "status": "active" if seconds_left > 0 else "ended",
        "seconds_left": seconds_left,
        "venue_a": {
            "id": battle["venue_a_id"],
            "name": venue_a["name"] if venue_a else "Unknown",
            "area": venue_a.get("area", "") if venue_a else "",
            "energy_level": venue_a.get("energy_level", "chill") if venue_a else "chill",
            "vibe_score": venue_a.get("current_vibe_score", 0) if venue_a else 0,
            "taps": taps_a,
            "share": round(taps_a / total * 100),
        },
        "venue_b": {
            "id": battle["venue_b_id"],
            "name": venue_b["name"] if venue_b else "Unknown",
            "area": venue_b.get("area", "") if venue_b else "",
            "energy_level": venue_b.get("energy_level", "chill") if venue_b else "chill",
            "vibe_score": venue_b.get("current_vibe_score", 0) if venue_b else 0,
            "taps": taps_b,
            "share": round(taps_b / total * 100),
        },
        "total_taps": taps_a + taps_b,
        "winner": (
            "a" if taps_a > taps_b else "b" if taps_b > taps_a else "tie"
        ) if seconds_left == 0 else None,
    }


@router.get("/battles/active")
async def get_active_battle():
    """Returns the current active battle, or null if none running."""
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=BATTLE_DURATION_MINUTES)
    battle = await db.battles.find_one(
        {"created_at": {"$gte": cutoff}},
        sort=[("created_at", -1)],
    )
    if not battle:
        return {"battle": None}
    return {"battle": await _enrich_battle(battle)}


@router.post("/battles/{battle_id}/tap/{side}")
async def tap_battle(battle_id: str, side: str, user: dict = Depends(require_auth)):
    """Tap for venue_a ('a') or venue_b ('b'). One tap per user per battle."""
    if side not in ("a", "b"):
        raise HTTPException(status_code=400, detail="Side must be 'a' or 'b'")

    battle = await db.battles.find_one({"id": battle_id})
    if not battle:
        raise HTTPException(status_code=404, detail="Battle not found")

    ends_at = battle["created_at"] + timedelta(minutes=BATTLE_DURATION_MINUTES)
    if datetime.now(timezone.utc) > ends_at:
        raise HTTPException(status_code=410, detail="Battle has ended")

    # One tap per user per battle
    already = await db.battle_taps.find_one({"battle_id": battle_id, "user_id": user["id"]})
    if already:
        raise HTTPException(status_code=429, detail="Already tapped in this battle")

    await db.battle_taps.insert_one({
        "battle_id": battle_id,
        "user_id": user["id"],
        "side": side,
        "created_at": datetime.now(timezone.utc),
    })

    inc_field = "taps_a" if side == "a" else "taps_b"
    await db.battles.update_one({"id": battle_id}, {"$inc": {inc_field: 1}})

    updated = await db.battles.find_one({"id": battle_id})
    return {"battle": await _enrich_battle(updated)}


@router.post("/battles")
async def create_battle(body: dict):
    """Create a new battle (admin / cron only — no auth guard for simplicity)."""
    venue_a_id = body.get("venue_a_id")
    venue_b_id = body.get("venue_b_id")
    if not venue_a_id or not venue_b_id:
        raise HTTPException(status_code=400, detail="venue_a_id and venue_b_id required")

    # Only one active battle at a time
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=BATTLE_DURATION_MINUTES)
    existing = await db.battles.find_one({"created_at": {"$gte": cutoff}})
    if existing:
        raise HTTPException(status_code=409, detail="A battle is already active")

    battle_id = str(uuid.uuid4())[:8]
    now = datetime.now(timezone.utc)
    await db.battles.insert_one({
        "id": battle_id,
        "venue_a_id": venue_a_id,
        "venue_b_id": venue_b_id,
        "taps_a": 0,
        "taps_b": 0,
        "created_at": now,
    })
    battle = await db.battles.find_one({"id": battle_id})
    return {"battle": await _enrich_battle(battle)}
