"""
Vibe App - Oracle Routes
Predict peak times for venues.
Free tier: rule-based heuristics.
Premium tier: Claude AI-powered prediction with narrative insight.
"""
import os
import re
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Request

from app.config import db, logger
from app.services.auth import get_current_user
from app.routes.subscriptions import _check_vibe_plus

router = APIRouter(tags=["oracle"])

# ── Heuristic data ────────────────────────────────────────────────────────────
_PEAK_WINDOWS = {
    "club":        {"weekday": ("12:30am", "2:00am"),  "weekend": ("1:00am", "3:00am")},
    "lounge":      {"weekday": ("10:00pm", "12:00am"), "weekend": ("11:00pm", "1:00am")},
    "bar":         {"weekday": ("9:00pm",  "11:30pm"), "weekend": ("10:00pm", "1:00am")},
    "restaurant":  {"weekday": ("7:00pm",  "9:30pm"),  "weekend": ("8:00pm",  "10:00pm")},
    "concert":     {"weekday": ("8:00pm",  "10:30pm"), "weekend": ("8:00pm",  "11:00pm")},
    "rave":        {"weekday": ("11:00pm", "4:00am"),  "weekend": ("12:00am", "5:00am")},
    "block_party": {"weekday": ("5:00pm",  "10:00pm"), "weekend": ("4:00pm",  "11:00pm")},
    "event":       {"weekday": ("6:00pm",  "9:00pm"),  "weekend": ("5:00pm",  "10:00pm")},
    "church":      {"weekday": ("9:00am",  "11:30am"), "weekend": ("9:00am",  "12:00pm")},
}
_BASE_CONF = {"club": 82, "lounge": 78, "bar": 75, "restaurant": 80, "concert": 85, "rave": 70, "block_party": 88, "event": 80, "church": 90}
_ENERGY_LABELS = {"club": "electric", "lounge": "popping", "bar": "popping", "restaurant": "warm", "concert": "electric", "rave": "electric", "block_party": "electric", "event": "popping", "church": "uplifting"}


def _best_arrival(peak_start: str) -> str:
    m = re.match(r'(\d+):(\d+)(am|pm)', peak_start)
    if not m:
        return peak_start
    h, mi, period = int(m.group(1)), int(m.group(2)), m.group(3)
    total_min = (h % 12 + (12 if period == 'pm' else 0)) * 60 + mi - 45
    if total_min < 0:
        total_min += 24 * 60
    arr_h, arr_m = divmod(total_min, 60)
    arr_period = 'am' if arr_h < 12 else 'pm'
    arr_h = arr_h % 12 or 12
    return f"{arr_h}:{arr_m:02d}{arr_period}"


def _heuristic_oracle(venue: dict, bolt_15min: int = 0) -> dict:
    """Rule-based oracle. Free for all users."""
    venue_type = venue.get("venue_type", "club")
    now = datetime.now(timezone.utc)
    day_of_week = now.weekday()
    is_weekend = day_of_week >= 4
    day_key = "weekend" if is_weekend else "weekday"
    day_label = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][day_of_week]

    windows = _PEAK_WINDOWS.get(venue_type, _PEAK_WINDOWS["club"])
    peak_start, peak_end = windows[day_key]
    best_arrival = _best_arrival(peak_start)

    base_conf = _BASE_CONF.get(venue_type, 75)
    velocity = venue.get("vibe_velocity", "stable")
    velocity_delta = {"heating_up": 8, "stable": 0, "cooling_down": -10}.get(velocity, 0)
    activity = venue.get("total_ratings_24h", 0)
    activity_delta = 5 if activity > 30 else (-5 if activity < 10 else 0)
    # Bolt surge delta — real-time tap velocity boosts confidence
    bolt_delta = 12 if bolt_15min >= 20 else (6 if bolt_15min >= 10 else 0)
    confidence = max(50, min(95, base_conf + velocity_delta + activity_delta + bolt_delta))

    energy_label = _ENERGY_LABELS.get(venue_type, "popping")

    # Headline override when tap surge detected
    if bolt_15min >= 20:
        headline = f"Peak incoming at {venue.get('name', 'this venue')} — scouts are surging right now"
    elif bolt_15min >= 10:
        headline = f"{venue.get('name', 'This venue')} is heating up — bolt activity spiking"
    else:
        headline = f"{venue.get('name', 'This venue')} will be {energy_label} by {peak_start} tonight"

    signals = []
    signals.append({"icon": "🌙" if is_weekend else "📅", "label": f"{day_label} Night", "type": "day_of_week"})
    if velocity == "heating_up":
        signals.append({"icon": "🔥", "label": "Heating up fast", "type": "momentum"})
    elif velocity == "cooling_down":
        signals.append({"icon": "📉", "label": "Energy cooling", "type": "momentum"})
    if activity > 20:
        signals.append({"icon": "⚡", "label": "High scout activity", "type": "activity"})
    if bolt_15min >= 20:
        signals.append({"icon": "⚡", "label": f"{bolt_15min} bolts in 15 min — peak incoming", "type": "bolt_surge"})
    elif bolt_15min >= 10:
        signals.append({"icon": "⚡", "label": f"{bolt_15min} bolts in 15 min — heating up", "type": "bolt_surge"})

    return {
        "headline": headline,
        "peak_start": peak_start,
        "peak_end": peak_end,
        "best_arrival": best_arrival,
        "confidence": confidence,
        "signals": signals,
        "day_label": day_label,
        "energy_label": energy_label,
        "bolt_velocity_15min": bolt_15min,
        "powered_by": "heuristic",
        "insufficient_data": False,
    }


@router.get("/venues/{venue_id}/oracle")
async def get_oracle(venue_id: str):
    """Free heuristic oracle — peak time prediction for any venue."""
    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")
    fifteen_ago = datetime.now(timezone.utc) - timedelta(minutes=15)
    bolt_15min = await db.venue_bolts.count_documents({
        "venue_id": venue_id,
        "created_at": {"$gte": fifteen_ago},
    })
    return _heuristic_oracle(venue, bolt_15min=bolt_15min)


@router.get("/venues/{venue_id}/oracle/premium")
async def get_oracle_premium(venue_id: str, request: Request):
    """
    Premium Claude AI oracle — richer prediction with narrative insight.
    Requires: active Vibe+ subscription (401 if not logged in, 402 if not premium).
    """
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Login required for Oracle Premium")
    if not await _check_vibe_plus(user):
        raise HTTPException(
            status_code=402,
            detail="Vibe+ subscription required",
            headers={"X-Vibe-Plus-Required": "true"},
        )

    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        # Graceful degradation — return heuristic with upgrade hint
        result = _heuristic_oracle(venue)
        result["upgrade_message"] = "AI Oracle coming soon"
        return result

    # Bolt velocity for context
    fifteen_ago = datetime.now(timezone.utc) - timedelta(minutes=15)
    bolt_15min = await db.venue_bolts.count_documents({
        "venue_id": venue_id,
        "created_at": {"$gte": fifteen_ago},
    })

    # Build heuristic baseline to give Claude context
    baseline = _heuristic_oracle(venue, bolt_15min=bolt_15min)
    now = datetime.now(timezone.utc)
    day_label = baseline["day_label"]
    current_hour = now.hour

    try:
        import anthropic, json, re as _re

        prompt = (
            f"You are a nightlife prediction AI for Nigeria. Analyze this venue and predict tonight's peak.\n\n"
            f"Venue: {venue.get('name')} ({venue.get('venue_type')}, {venue.get('area')}, {venue.get('city')})\n"
            f"Music: {venue.get('music_genre', 'Mixed')}\n"
            f"Current vibe score: {venue.get('current_vibe_score', 50)}/100\n"
            f"Energy level: {venue.get('energy_level', 'chill')}\n"
            f"Momentum: {venue.get('vibe_velocity', 'stable')}\n"
            f"Entry fee: {venue.get('entry_fee', 'Unknown')}\n"
            f"Tonight: {day_label} (current time: {current_hour:02d}:00 WAT)\n"
            f"Heuristic peak window: {baseline['peak_start']} - {baseline['peak_end']}\n\n"
            "Give a JSON response with:\n"
            "- prediction: 2-3 sentence narrative (Nigerian-casual tone, use 'the crowd', 'energy', 'vibe')\n"
            "- peak_window: e.g. '1:00am - 3:00am'\n"
            "- best_arrival: e.g. '12:15am'\n"
            "- crowd_forecast: one short line e.g. 'Packed by midnight, full by 1am'\n"
            "- insider_tip: one actionable tip for getting the best experience\n"
            "- confidence: integer 50-95\n\n"
            "Respond in JSON only, no markdown."
        )

        client = anthropic.Anthropic(api_key=api_key)
        resp = client.messages.create(
            model="claude-haiku-4-5-20251001", max_tokens=500,
            messages=[{"role": "user", "content": prompt}]
        )
        raw = resp.content[0].text.strip()
        raw = _re.sub(r'^```(?:json)?\s*|\s*```$', '', raw, flags=_re.DOTALL).strip()
        parsed = json.loads(raw)

        return {
            "headline": parsed.get("prediction", baseline["headline"]),
            "peak_start": baseline["peak_start"],
            "peak_end": baseline["peak_end"],
            "best_arrival": parsed.get("best_arrival", baseline["best_arrival"]),
            "confidence": parsed.get("confidence", baseline["confidence"]),
            "signals": baseline["signals"],
            "day_label": day_label,
            "energy_label": baseline["energy_label"],
            "crowd_forecast": parsed.get("crowd_forecast", ""),
            "insider_tip": parsed.get("insider_tip", ""),
            "peak_window": parsed.get("peak_window", f"{baseline['peak_start']} – {baseline['peak_end']}"),
            "powered_by": "claude",
            "insufficient_data": False,
        }
    except Exception as e:
        logger.warning(f"Claude oracle failed, falling back to heuristic: {e}")
        return _heuristic_oracle(venue)
