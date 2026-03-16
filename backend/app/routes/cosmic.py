"""
Vibe App — Cosmic Vibe Reading
Generates a short AI-powered "Tonight's Reading" personalised by the scout's
zodiac sign and the current city energy. Cached 4 hours per sign+city combo.
No zodiac sign → falls back to a generic city pulse reading.
"""
import re
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException

from app.config import db, logger
from app.services.auth import require_auth

router = APIRouter(tags=["cosmic"])

# ── Helpers (copied pattern from ai_features.py) ──────────────────────────────

def _get_api_key():
    import os
    return os.environ.get("ANTHROPIC_API_KEY")

def _claude(prompt: str, max_tokens: int = 300) -> str:
    import anthropic
    api_key = _get_api_key()
    client = anthropic.Anthropic(api_key=api_key)
    resp = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = resp.content[0].text.strip()
    return re.sub(r'^```(?:json)?\s*|\s*```$', '', raw, flags=re.DOTALL).strip()

async def _get_cache(key: str, ttl_seconds: int):
    now = datetime.now(timezone.utc)
    cached = await db.ai_cache.find_one({"key": key})
    if cached:
        age = (now - cached["generated_at"].replace(tzinfo=timezone.utc)).total_seconds()
        if age < ttl_seconds:
            return cached["data"]
    return None

async def _set_cache(key: str, data: dict):
    now = datetime.now(timezone.utc)
    await db.ai_cache.update_one(
        {"key": key},
        {"$set": {"key": key, "data": data, "generated_at": now}},
        upsert=True,
    )

# Nightlife trait descriptions keyed by zodiac sign
ZODIAC_TRAITS = {
    "aries":       "first to arrive, hype generator, energy igniter, spontaneous",
    "taurus":      "knows the best spots, steady presence, good taste, loyal crew",
    "gemini":      "social butterfly, knows everyone, switches venues twice, storyteller",
    "cancer":      "vibe reader, holds crew together, intuitive energy, protective",
    "leo":         "commands the dance floor, natural spotlight, unforgettable entrance",
    "virgo":       "scouts the scene, reads vibe scores, curates the plan perfectly",
    "libra":       "picks the perfect venue, balanced energy, everyone wants in their crew",
    "scorpio":     "mysterious pull, feels the deeper current, transformative nights",
    "sagittarius": "adventure-driven, discovers new venues, infectious enthusiasm",
    "capricorn":   "VIP mindset, moves with purpose, status ascender, built different",
    "aquarius":    "ahead of the trend, finds underground gems, scene pioneer",
    "pisces":      "absorbs the vibe, in flow with the music, deep feeling presence",
}

# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.get("/cosmic-reading")
async def get_cosmic_reading(user: dict = Depends(require_auth)):
    """
    Returns a personalised 2-3 sentence Tonight's Vibe Reading for the
    authenticated scout. Cached 4 hours per (sign, city, date).
    Falls back gracefully when no zodiac sign is set or no API key.
    """
    sign      = user.get("zodiac_sign")
    city      = user.get("home_city", "lagos")
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    cache_key = f"cosmic_{sign or 'generic'}_{city}_{today_str}"

    cached = await _get_cache(cache_key, ttl_seconds=4 * 3600)
    if cached:
        return cached

    # Pull user DNA context for richer personalisation
    dna_context = ""
    try:
        from app.routes.dna import _compute_dna
        dna = await _compute_dna(user["id"])
        if not dna.get("insufficient_data"):
            dom = dna.get("dominant_type", "")
            night = dna.get("night_style_label", "")
            area  = dna["top_areas"][0]["area"] if dna.get("top_areas") else ""
            eng   = dna.get("energy_preference", {}).get("label", "")
            dna_context = f"Scout DNA: dominant scene = {dom}, {night}, favours {area} area, {eng}."
    except Exception:
        pass

    # Pull city pulse context
    venues = await db.venues.find(
        {"city": city},
        {"_id": 0, "name": 1, "energy_level": 1, "current_vibe_score": 1, "area": 1},
    ).sort("current_vibe_score", -1).to_list(5)

    hot_venue  = venues[0]["name"] if venues else city.title()
    hot_area   = venues[0].get("area", "the scene") if venues else "the scene"
    avg_energy = (
        sum({"quiet":1,"chill":2,"warming":3,"charged":4,"lit":5,"peak":6}.get(v.get("energy_level","quiet"),1)
            for v in venues) / len(venues)
    ) if venues else 3
    city_mood = (
        "electric and peaking" if avg_energy >= 5 else
        "heating up fast"      if avg_energy >= 4 else
        "warming nicely"       if avg_energy >= 3 else
        "still early but coming alive"
    )

    api_key = _get_api_key()
    if not api_key:
        result = _fallback_reading(sign, city, hot_venue)
        await _set_cache(cache_key, result)
        return result

    # Build prompt
    if sign and sign in ZODIAC_TRAITS:
        traits = ZODIAC_TRAITS[sign]
        sign_cap = sign.capitalize()
        prompt = (
            f"You write punchy, two-sentence nightlife vibe readings for a Lagos scene app. "
            f"Be vivid, confident, and street-smart. No fluff, no generic astrology clichés. "
            f"The scout is a {sign_cap} ({traits}). "
            f"{dna_context} "
            f"Tonight in {city.title()}, the city mood is '{city_mood}'. "
            f"The hottest spot right now is {hot_venue} in {hot_area}. "
            f"Write a 2-sentence 'Tonight's Reading' for this {sign_cap} scout. "
            f"Blend their DNA and personality with the live city energy. Keep it under 65 words. "
            f"No hashtags, no 'as a {sign_cap}', start with the vibe not the sign."
        )
    else:
        prompt = (
            f"You write punchy, two-sentence nightlife vibe readings for a Lagos scene app. "
            f"Be vivid, confident, street-smart. "
            f"{dna_context} "
            f"Tonight in {city.title()}, the city mood is '{city_mood}'. "
            f"The hottest spot is {hot_venue} in {hot_area}. "
            f"Write a 2-sentence 'Tonight's Reading' for this scout. "
            f"Under 55 words. No hashtags."
        )

    try:
        reading = _claude(prompt, max_tokens=120)
    except Exception as exc:
        logger.warning(f"Cosmic reading Claude call failed: {exc}")
        result = _fallback_reading(sign, city, hot_venue)
        await _set_cache(cache_key, result)
        return result

    result = {
        "reading": reading,
        "zodiac_sign": sign,
        "city": city,
        "hot_venue": hot_venue,
        "city_mood": city_mood,
        "powered_by": "claude",
        "generated_at": today_str,
    }
    await _set_cache(cache_key, result)
    return result


def _fallback_reading(sign: str | None, city: str, hot_venue: str) -> dict:
    if sign:
        text = f"The energy in {city.title()} is building toward something electric tonight. Your instincts are dialled in — trust the pull toward {hot_venue}."
    else:
        text = f"{city.title()} is alive tonight. The frequency is right — head toward {hot_venue} and let the vibe find you."
    return {
        "reading": text,
        "zodiac_sign": sign,
        "city": city,
        "hot_venue": hot_venue,
        "city_mood": "live",
        "powered_by": "fallback",
    }
