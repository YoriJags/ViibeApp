"""
Vibe App - AI Features Routes (Claude-powered)
1. Vibe Brief       — Daily city nightlife briefing
2. Roast & Toast    — AI venue personality review
3. DNA Narrative    — Scout personality narrative
4. AI Advisor       — Merchant actionable weekly advice
5. Night Debrief    — Scout's personalised night recap
All responses are cached in MongoDB to minimise Claude API spend.
"""
import os
import re
import json
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Request

from app.config import db, logger
from app.services.auth import get_current_user

router = APIRouter(tags=["ai-features"])

# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_api_key():
    return os.environ.get("ANTHROPIC_API_KEY")

def _claude(prompt: str, max_tokens: int = 400) -> str:
    """Call Claude Haiku and return raw text. Raises on failure."""
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

# ── 1. Vibe Brief ─────────────────────────────────────────────────────────────

@router.get("/city/{city}/vibe-brief")
async def get_vibe_brief(city: str):
    """Daily AI city briefing — cached 4 hours."""
    city = city.lower()
    cache_key = f"vibe_brief_{city}"
    cached = await _get_cache(cache_key, ttl_seconds=4 * 3600)
    if cached:
        return cached

    venues = await db.venues.find({"city": city}, {"_id": 0}).sort("current_vibe_score", -1).to_list(10)
    if not venues:
        raise HTTPException(status_code=404, detail="No venues found for city")

    now = datetime.now(timezone.utc)
    day = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"][now.weekday()]
    top3 = [f"{v['name']} (score {v['current_vibe_score']}, {v['energy_level']})" for v in venues[:3]]
    hot_area = venues[0].get("area", "VI") if venues else "Victoria Island"

    api_key = _get_api_key()
    if not api_key:
        result = {
            "headline": f"Tonight in {city.title()}: {venues[0]['name']} is leading the pack",
            "briefing": f"Top spots are heating up. Check the leaderboard for live scores.",
            "top_pick": venues[0]["name"] if venues else "",
            "hot_area": hot_area,
            "powered_by": "fallback",
        }
        return result

    try:
        prompt = (
            f"You are a nightlife journalist for {city.title()}, Nigeria. Tonight is {day}.\n"
            f"Top venues right now: {', '.join(top3)}\n"
            f"Write a punchy daily nightlife brief for the Vibe App. Nigerian-casual tone. Max 3 sentences.\n"
            f"Also pick ONE hot area for tonight.\n"
            f"Respond JSON only: {{\"headline\": \"...\", \"briefing\": \"...\", \"top_pick\": \"venue name\", \"hot_area\": \"area name\"}}"
        )
        parsed = json.loads(_claude(prompt, max_tokens=300))
        result = {**parsed, "powered_by": "claude", "city": city}
        await _set_cache(cache_key, result)
        return result
    except Exception as e:
        logger.warning(f"Vibe Brief Claude failed: {e}")
        result = {
            "headline": f"Tonight in {city.title()}: {venues[0]['name']} is leading",
            "briefing": "Check the live leaderboard for tonight's hottest spots.",
            "top_pick": venues[0]["name"],
            "hot_area": hot_area,
            "powered_by": "fallback",
            "city": city,
        }
        return result


# ── 2. Roast & Toast ──────────────────────────────────────────────────────────

@router.get("/venues/{venue_id}/roast-toast")
async def get_roast_toast(venue_id: str):
    """AI venue personality review — cached until vibe score shifts >5pts."""
    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    cache_key = f"roast_{venue_id}"
    cached = await _get_cache(cache_key, ttl_seconds=6 * 3600)
    if cached and abs(cached.get("score_at_generation", 0) - venue.get("current_vibe_score", 0)) < 5:
        return cached

    api_key = _get_api_key()
    if not api_key:
        return {"review": f"{venue['name']} — a {venue.get('venue_type','spot')} worth checking out.", "powered_by": "fallback"}

    try:
        prompt = (
            f"Write a punchy 2-sentence Roast & Toast for this Lagos venue.\n"
            f"Name: {venue['name']}\nType: {venue.get('venue_type')}\nArea: {venue.get('area')}\n"
            f"Vibe score: {venue.get('current_vibe_score')}/100\nEnergy: {venue.get('energy_level')}\n"
            f"Music: {venue.get('music_genre','Mixed')}\nEntry: {venue.get('entry_fee','Unknown')}\n\n"
            f"Rules: Nigerian-casual voice, honest, one positive line + one real-talk line. No emojis.\n"
            f"JSON only: {{\"review\": \"...\", \"vibe_word\": \"one word that captures the vibe\"}}"
        )
        parsed = json.loads(_claude(prompt, max_tokens=200))
        result = {
            **parsed,
            "powered_by": "claude",
            "score_at_generation": venue.get("current_vibe_score", 0),
        }
        await _set_cache(cache_key, result)
        return result
    except Exception as e:
        logger.warning(f"Roast & Toast Claude failed: {e}")
        return {"review": f"{venue['name']} is holding it down in {venue.get('area','Lagos')}.", "powered_by": "fallback"}


# ── 3. DNA Narrative ──────────────────────────────────────────────────────────

@router.get("/users/{user_id}/dna-narrative")
async def get_dna_narrative(user_id: str):
    """AI scout personality narrative — cached 24 hours."""
    cache_key = f"dna_narrative_{user_id}"
    cached = await _get_cache(cache_key, ttl_seconds=24 * 3600)
    if cached:
        return cached

    # Fetch DNA data
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Get rating history for affinity analysis
    ratings = await db.ratings.find({"user_id": user_id}).sort("timestamp", -1).to_list(50)
    if len(ratings) < 3:
        return {"narrative": "Rate more venues and we'll unlock your full Vibe personality.", "powered_by": "fallback"}

    type_counts: dict = {}
    for r in ratings:
        t = r.get("venue_type", "other")
        type_counts[t] = type_counts.get(t, 0) + 1

    top_types = sorted(type_counts.items(), key=lambda x: x[1], reverse=True)[:3]
    persona = user.get("persona", "explorer")
    clout = user.get("clout_points", 0)

    api_key = _get_api_key()
    if not api_key:
        dominant = top_types[0][0].replace("_", " ") if top_types else "venues"
        return {"narrative": f"A true {dominant} connoisseur with {clout} clout points.", "powered_by": "fallback"}

    try:
        top_str = ", ".join(f"{t} ({c}x)" for t, c in top_types)
        prompt = (
            f"Write a 2-sentence personality narrative for this Lagos nightlife scout.\n"
            f"Their top scenes: {top_str}\nPersona: {persona}\nClout: {clout} points\n"
            f"Total venues rated: {len(ratings)}\n\n"
            f"Rules: Second-person ('You are...'), Nigerian-casual, vivid and flattering. No emojis.\n"
            f"JSON only: {{\"narrative\": \"...\", \"vibe_archetype\": \"2-3 word title e.g. 'The Club Connoisseur'\"}}"
        )
        parsed = json.loads(_claude(prompt, max_tokens=200))
        result = {**parsed, "powered_by": "claude"}
        await _set_cache(cache_key, result)
        return result
    except Exception as e:
        logger.warning(f"DNA Narrative Claude failed: {e}")
        return {"narrative": f"A seasoned scout with {clout} clout and a sharp eye for the right vibe.", "powered_by": "fallback"}


# ── 4. Merchant AI Advisor ────────────────────────────────────────────────────

@router.get("/merchant/venue/{venue_id}/ai-advisor")
async def get_ai_advisor(venue_id: str, request: Request):
    """Claude weekly advice for merchants — cached 6 hours."""
    user = await get_current_user(request)
    if not user or user.get("merchant_venue_id") != venue_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    cache_key = f"ai_advisor_{venue_id}"
    cached = await _get_cache(cache_key, ttl_seconds=6 * 3600)
    if cached:
        return cached

    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    # Last 7 days rating stats
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    ratings = await db.ratings.find({"venue_id": venue_id, "timestamp": {"$gte": week_ago}}).to_list(200)
    total = len(ratings)
    avg_score = round(sum(r.get("vibe_score", 50) for r in ratings) / total, 1) if total > 0 else 0
    gate_issues = sum(1 for r in ratings if r.get("gate") == "blocked")
    capacity_issues = sum(1 for r in ratings if r.get("capacity") == "full")

    api_key = _get_api_key()
    if not api_key:
        return {"advice": "Keep your vibe score up by managing capacity and entry flow.", "actions": [], "powered_by": "fallback"}

    try:
        prompt = (
            f"You are a nightlife business advisor. Analyse this Lagos venue's week and give actionable advice.\n\n"
            f"Venue: {venue['name']} ({venue.get('venue_type')}, {venue.get('area')})\n"
            f"Current vibe score: {venue.get('current_vibe_score')}/100\n"
            f"Ratings this week: {total} | Avg score: {avg_score}/100\n"
            f"Gate blocked reports: {gate_issues}/{total if total else 1}\n"
            f"Over-capacity reports: {capacity_issues}/{total if total else 1}\n"
            f"Profile views: {venue.get('profile_views', 0)} | Direction clicks: {venue.get('direction_clicks', 0)}\n\n"
            f"Give 3 specific, actionable recommendations. Nigerian business context. Be direct.\n"
            f"JSON only: {{\"summary\": \"1 sentence overall assessment\", \"actions\": [\"tip 1\", \"tip 2\", \"tip 3\"], \"priority\": \"highest priority issue in 5 words\"}}"
        )
        parsed = json.loads(_claude(prompt, max_tokens=400))
        result = {**parsed, "powered_by": "claude", "ratings_analyzed": total}
        await _set_cache(cache_key, result)
        return result
    except Exception as e:
        logger.warning(f"AI Advisor Claude failed: {e}")
        return {
            "summary": "Your venue has room to grow this week.",
            "actions": ["Optimise your entry flow during peak hours", "Engage scouts with a midweek promo", "Respond to high gate-blocked reports"],
            "priority": "Reduce gate blocked reports",
            "powered_by": "fallback",
            "ratings_analyzed": total,
        }


# ── 5. Night Debrief ──────────────────────────────────────────────────────────

@router.get("/users/{user_id}/night-debrief")
async def get_night_debrief(user_id: str):
    """AI personalised night recap from last 12 hours — cached 2 hours."""
    cache_key = f"night_debrief_{user_id}"
    cached = await _get_cache(cache_key, ttl_seconds=2 * 3600)
    if cached:
        return cached

    since = datetime.now(timezone.utc) - timedelta(hours=12)
    checkins = await db.checkins.find({"user_id": user_id, "checked_in_at": {"$gte": since}}).to_list(10)
    ratings = await db.ratings.find({"user_id": user_id, "timestamp": {"$gte": since}}).to_list(10)

    if not checkins and not ratings:
        return {"debrief": None, "message": "No activity tonight yet — get out there!", "powered_by": "fallback"}

    # Enrich with venue names
    venue_ids = list({c["venue_id"] for c in checkins} | {r["venue_id"] for r in ratings})
    venues_list = await db.venues.find({"id": {"$in": venue_ids}}, {"_id": 0, "id": 1, "name": 1, "area": 1}).to_list(10)
    venue_map = {v["id"]: v for v in venues_list}

    spots = [venue_map[vid]["name"] for vid in venue_ids if vid in venue_map]
    avg_rating = round(sum(r.get("vibe_score", 50) for r in ratings) / len(ratings), 0) if ratings else 0

    api_key = _get_api_key()
    if not api_key:
        return {
            "debrief": f"You hit {len(spots)} spot{'s' if len(spots) != 1 else ''} tonight. Solid night.",
            "stats": {"spots_visited": len(spots), "ratings_dropped": len(ratings)},
            "powered_by": "fallback",
        }

    try:
        spots_str = ", ".join(spots) if spots else "no venues yet"
        prompt = (
            f"Write a fun 2-sentence personalised night recap for a Lagos nightlife scout.\n"
            f"They visited: {spots_str}\n"
            f"Ratings dropped: {len(ratings)} | Average vibe score given: {avg_rating}/100\n\n"
            f"Rules: Second-person, Nigerian-casual, celebratory tone. Make them feel like a legend.\n"
            f"JSON only: {{\"debrief\": \"...\", \"night_title\": \"3-word title for their night e.g. 'Electric VI Run'\"}}"
        )
        parsed = json.loads(_claude(prompt, max_tokens=200))
        result = {
            **parsed,
            "stats": {"spots_visited": len(spots), "ratings_dropped": len(ratings), "avg_vibe_given": avg_rating},
            "powered_by": "claude",
        }
        await _set_cache(cache_key, result)
        return result
    except Exception as e:
        logger.warning(f"Night Debrief Claude failed: {e}")
        return {
            "debrief": f"You hit {len(spots)} spot{'s' if len(spots) != 1 else ''} tonight — certified scout energy.",
            "night_title": "Solid Night Out",
            "stats": {"spots_visited": len(spots), "ratings_dropped": len(ratings)},
            "powered_by": "fallback",
        }
