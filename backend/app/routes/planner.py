"""
Vibe App - Night Planner Route
Claude AI concierge for nightlife recommendations.
Auto-activates Claude when ANTHROPIC_API_KEY is set; falls back to rule-based scoring.
"""
import os
import uuid
from fastapi import APIRouter
from pydantic import BaseModel

from app.config import db, logger

router = APIRouter(tags=["planner"])


class PlannerChatRequest(BaseModel):
    city: str = "lagos"
    message: str
    history: list = []
    conversation_id: str | None = None


@router.post("/planner/chat")
async def planner_chat(body: PlannerChatRequest):
    """Night Planner — Claude AI concierge with rule-based fallback."""
    city = body.city.lower()
    message = body.message.strip()
    if not message:
        return {"detail": "Message is required"}

    conversation_id = body.conversation_id or str(uuid.uuid4())
    venues = await db.venues.find({"city": city}, {"_id": 0}).to_list(30)

    # ── Claude path ──────────────────────────────────────────────────────
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if api_key and venues:
        try:
            import anthropic, json
            venue_ctx = json.dumps([{
                "id": v["id"], "name": v["name"], "area": v.get("area", ""),
                "venue_type": v.get("venue_type", ""), "current_vibe_score": v.get("current_vibe_score", 50),
                "energy_level": v.get("energy_level", "chill"), "capacity_level": v.get("capacity_level", "sparse"),
                "gate_level": v.get("gate_level", "clear"), "entry_fee": v.get("entry_fee", "Free"),
                "music_genre": v.get("music_genre", ""), "vibe_velocity": v.get("vibe_velocity", "stable"),
            } for v in venues], ensure_ascii=False)

            system = (
                "You are Vibe, a nightlife AI concierge for Nigeria. Tonight's live venue data:\n"
                f"{venue_ctx}\n\n"
                "Rules: Recommend 1-3 venues max from the data. Be warm, Nigerian-casual (use 'squad', 'vibe', 'mad'). "
                "Respond in JSON only: {\"reply\": \"...\", \"venue_ids\": [\"id1\",\"id2\"], \"follow_up_prompts\": [\"...\",\"...\"]}"
            )
            messages = list(body.history) + [{"role": "user", "content": message}]
            client = anthropic.Anthropic(api_key=api_key)
            resp = client.messages.create(
                model="claude-haiku-4-5-20251001", max_tokens=600,
                system=system, messages=messages
            )
            import re
            raw = resp.content[0].text.strip()
            # Strip markdown code fences if Claude wraps in ```json
            raw = re.sub(r'^```(?:json)?\s*|\s*```$', '', raw, flags=re.DOTALL).strip()
            parsed = json.loads(raw)
            rec_venues = [v for v in venues if v["id"] in parsed.get("venue_ids", [])]
            result_venues = [{
                "venue_id": v["id"], "name": v["name"], "area": v.get("area", ""),
                "current_vibe_score": v.get("current_vibe_score", 50),
                "energy_level": v.get("energy_level", "chill"),
                "entry_fee": v.get("entry_fee", "Free"),
                "music_genre": v.get("music_genre", ""),
                "match_reason": "Recommended by AI", "match_score": 90,
            } for v in rec_venues]
            return {
                "conversation_id": conversation_id,
                "reply": parsed.get("reply", ""),
                "venues": result_venues,
                "follow_up_prompts": parsed.get("follow_up_prompts", []),
                "powered_by": "claude",
            }
        except Exception as e:
            logger.warning(f"Claude planner failed, falling back to rules: {e}")

    # ── Rule-based fallback ───────────────────────────────────────────────
    msg = message.lower()
    AREAS = ["lekki", "vi", "victoria island", "ikeja", "ikoyi", "surulere", "yaba", "ajah", "gbagada", "maryland"]
    GENRES = ["afrobeats", "afrobeat", "amapiano", "house", "highlife", "hiphop", "hip hop", "r&b", "rnb"]
    BUDGET_KW = ["budget", "cheap", "free", "affordable", "low key", "lowkey"]
    CLUB_KW = ["club", "dance", "turn up", "turnup", "party", "rave"]
    LOUNGE_KW = ["lounge", "chill", "relax", "quiet", "sit down", "vibe", "grown"]
    GROUP_KW = ["squad", "crew", "group", "gang", "6", "7", "8", "9", "10", "large"]

    target_area = next((a for a in AREAS if a in msg), None)
    target_genre = next((g for g in GENRES if g in msg), None)
    want_budget = any(k in msg for k in BUDGET_KW)
    want_club = any(k in msg for k in CLUB_KW)
    want_lounge = any(k in msg for k in LOUNGE_KW)
    want_group = any(k in msg for k in GROUP_KW)

    scored = []
    for v in venues:
        s = v.get("current_vibe_score", 50)
        if target_area and target_area in v.get("area", "").lower():
            s += 20
        if target_genre and target_genre in v.get("music_genre", "").lower():
            s += 15
        if want_budget and v.get("entry_fee", "").lower().startswith("free"):
            s += 20
        if want_club and v.get("venue_type") == "club":
            s += 15
        if want_lounge and v.get("venue_type") == "lounge":
            s += 15
        if want_group and v.get("tables_available"):
            s += 10
        scored.append((s, v))

    scored.sort(key=lambda x: x[0], reverse=True)
    top = scored[:3]
    result_venues = [{
        "venue_id": v["id"], "name": v["name"], "area": v.get("area", ""),
        "current_vibe_score": v.get("current_vibe_score", 50),
        "energy_level": v.get("energy_level", "chill"),
        "entry_fee": v.get("entry_fee", "Free"),
        "music_genre": v.get("music_genre", ""),
        "match_reason": "Top match for your vibe", "match_score": min(s, 99),
    } for s, v in top]

    reply = "Here's what's popping tonight based on your vibe 🔥"
    if not result_venues:
        reply = "No venues matched right now — try a different area or vibe?"
    follow_up_prompts = ["What's free entry tonight?", "Any Amapiano spots?", "Best for a large squad?"]

    return {
        "conversation_id": conversation_id,
        "reply": reply,
        "venues": result_venues,
        "follow_up_prompts": follow_up_prompts,
        "powered_by": "rules",
    }
