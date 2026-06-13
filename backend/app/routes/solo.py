"""
Solo Reactor — solo signature + early-mover (Lindy) dividend surface.

GET /api/venues/{venue_id}/solo/{scout_id}
  Reads tonight's pulses to build the scout's personal Reactor signature and
  their live early-mover multiplier (how much their early charging is amplified
  now that the venue has grown). Drives the Reactor's solo mode — so tapping an
  empty venue shows a meaningful personal fingerprint + a rising dividend, never
  a dead ring.
"""
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter

from app.config import db
from app.services.solo_reactor import solo_signature, early_multiplier, retro_clout

router = APIRouter(tags=["solo"])


def _night_start(now: datetime) -> datetime:
    noon = now.replace(hour=12, minute=0, second=0, microsecond=0)
    return noon if now >= noon else noon - timedelta(days=1)


@router.get("/venues/{venue_id}/solo/{scout_id}")
async def get_solo_status(venue_id: str, scout_id: str):
    now = datetime.now(timezone.utc)
    night = _night_start(now)

    pulses = await db.vibe_pulses.find(
        {"venue_id": venue_id, "timestamp": {"$gte": night}},
        {"_id": 0, "user_id": 1, "timestamp": 1, "avg_g_force": 1,
         "max_bpm": 1, "tap_count": 1},
    ).to_list(10000)

    mine = [p for p in pulses if p.get("user_id") == scout_id]
    taps = sum(p.get("tap_count", 1) for p in mine)
    peak_g = max((p.get("avg_g_force", 1.0) for p in mine), default=0.0)
    avg_bpm = (sum(p.get("max_bpm", 0) for p in mine) / len(mine)) if mine else 0.0
    sig = solo_signature(taps, peak_g, avg_bpm)

    peak_scouts = len({p.get("user_id") for p in pulses if p.get("user_id")})
    if mine:
        first_ts = min(p["timestamp"] for p in mine if p.get("timestamp"))
        scouts_when_active = len({
            p.get("user_id") for p in pulses
            if p.get("user_id") and p.get("timestamp") and p["timestamp"] <= first_ts
        })
    else:
        scouts_when_active = 0

    mult = early_multiplier(scouts_when_active, peak_scouts)

    return {
        "venue_id":  venue_id,
        "scout_id":  scout_id,
        "signature": {
            "taps":    sig.taps,
            "peak_g":  sig.peak_g,
            "avg_bpm": sig.avg_bpm,
            "label":   sig.label,
        },
        "scouts_when_active": scouts_when_active,
        "peak_scouts":        peak_scouts,
        "early_multiplier":   mult,
        "dividend_potential": retro_clout(taps, scouts_when_active, peak_scouts),
        "alone":              peak_scouts <= 1,
    }
