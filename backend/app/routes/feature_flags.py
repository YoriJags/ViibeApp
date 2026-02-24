"""
Vibe App - Feature Flags
Central control tower for toggling platform features on/off.
Admin can enable/disable any feature without a code deployment.
"""
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Dict

from app.config import db, logger

router = APIRouter(tags=["feature_flags"])

# ── Default flag definitions ────────────────────────────────────────────────
# key → { label, description, category, requires_ai_key }
FLAG_META: Dict[str, dict] = {
    # AI Features (require ANTHROPIC_API_KEY)
    "vibe_brief":       {"label": "Vibe Brief",       "desc": "Daily AI city briefing on home screen",         "category": "AI Features",    "ai": True},
    "roast_toast":      {"label": "Roast & Toast",     "desc": "Punchy AI venue review on venue detail",        "category": "AI Features",    "ai": True},
    "dna_narrative":    {"label": "DNA Narrative",     "desc": "AI personality narrative in Vibe DNA card",     "category": "AI Features",    "ai": True},
    "ai_advisor":       {"label": "AI Advisor",        "desc": "Smart action items in merchant dashboard",      "category": "AI Features",    "ai": True},
    "night_debrief":    {"label": "Night Debrief",     "desc": "Post-night AI recap on profile page",           "category": "AI Features",    "ai": True},
    "night_planner":    {"label": "Night Planner",     "desc": "Conversational AI venue planning chat",         "category": "AI Features",    "ai": True},
    "oracle_premium":   {"label": "Oracle Premium",    "desc": "Claude AI peak-time prediction (premium tier)", "category": "AI Features",    "ai": True},
    # Core Features (rule-based)
    "vibe_oracle":      {"label": "Vibe Oracle",       "desc": "Heuristic peak-time forecast on venue detail",  "category": "Core Features",  "ai": False},
    "vibe_dna":         {"label": "Vibe DNA",          "desc": "Affinity bars + taste fingerprint on profile",  "category": "Core Features",  "ai": False},
    "vibe_match":       {"label": "Vibe Match",        "desc": "Dynamic vibe match score on venue cards",       "category": "Core Features",  "ai": False},
    "top_scouts":       {"label": "Top Scouts",        "desc": "Top scout leaderboard on venue detail",         "category": "Core Features",  "ai": False},
    "cartel_radar":     {"label": "Cartel Radar",      "desc": "Find nearby scouts by persona",                 "category": "Core Features",  "ai": False},
    # Engagement Features
    "night_planner_btn": {"label": "Planner Button",  "desc": "Sparkle button in home header",                 "category": "Engagement",     "ai": False},
    "venue_spotlight":  {"label": "Venue Spotlight",   "desc": "Trending venue spotlight card on home",         "category": "Engagement",     "ai": False},
    "share_cards":      {"label": "Share Cards",       "desc": "Share venue vibe cards",                        "category": "Engagement",     "ai": False},
    "demo_mode":        {"label": "Demo Mode",         "desc": "Demo mode toggle visible on profile",           "category": "Engagement",     "ai": False},
}

DEFAULT_FLAGS: Dict[str, bool] = {key: True for key in FLAG_META}


async def _get_flags_doc() -> dict:
    doc = await db.settings.find_one({"key": "feature_flags"})
    if not doc:
        return DEFAULT_FLAGS.copy()
    return {k: doc.get("flags", {}).get(k, DEFAULT_FLAGS.get(k, True)) for k in FLAG_META}


@router.get("/feature-flags")
async def get_feature_flags():
    """Public endpoint — returns current flag states. Called by app on startup."""
    flags = await _get_flags_doc()
    return {"flags": flags, "meta": FLAG_META}


class FlagUpdate(BaseModel):
    flags: Dict[str, bool]


@router.put("/admin/feature-flags")
async def update_feature_flags(body: FlagUpdate, request: Request):
    """Admin-only — update one or more feature flags."""
    # Validate keys
    unknown = [k for k in body.flags if k not in FLAG_META]
    if unknown:
        raise HTTPException(status_code=400, detail=f"Unknown flags: {unknown}")

    current = await _get_flags_doc()
    current.update(body.flags)

    await db.settings.update_one(
        {"key": "feature_flags"},
        {"$set": {"key": "feature_flags", "flags": current, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    logger.info(f"Feature flags updated: {body.flags}")
    return {"flags": current, "updated": list(body.flags.keys())}
