"""
Vibe App - Platform Settings
Admin-editable numeric/string settings (prices, limits) stored in MongoDB.
Complements feature_flags.py (which handles boolean toggles).
"""
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Dict, Any

from app.config import db, logger

router = APIRouter(tags=["platform_settings"])

# ── Setting definitions ──────────────────────────────────────────────────────
# key → { label, desc, category, type, default }
SETTINGS_META: Dict[str, dict] = {
    # Subscriptions
    "vibe_plus_price_kobo": {
        "label": "Vibe+ Monthly Price",
        "desc": "Monthly subscription price in kobo (100 kobo = ₦1)",
        "category": "Subscriptions",
        "type": "number",
        "default": 150000,          # ₦1,500
    },
    # Pulse Drops
    "pulse_drop_spark_kobo": {
        "label": "Spark Drop Price",
        "desc": "Tier 1 pulse drop price in kobo",
        "category": "Pulse Drops",
        "type": "number",
        "default": 500000,          # ₦5,000
    },
    "pulse_drop_flare_kobo": {
        "label": "Flare Drop Price",
        "desc": "Tier 2 pulse drop price in kobo",
        "category": "Pulse Drops",
        "type": "number",
        "default": 1500000,         # ₦15,000
    },
    "pulse_drop_supernova_kobo": {
        "label": "Supernova Drop Price",
        "desc": "Tier 3 pulse drop price in kobo",
        "category": "Pulse Drops",
        "type": "number",
        "default": 5000000,         # ₦50,000
    },
    # Spotlight
    "spotlight_24h_kobo": {
        "label": "Spotlight 24h Price",
        "desc": "24-hour venue spotlight price in kobo",
        "category": "Spotlight",
        "type": "number",
        "default": 500000,          # ₦5,000
    },
    "spotlight_48h_kobo": {
        "label": "Spotlight 48h Price",
        "desc": "48-hour venue spotlight price in kobo",
        "category": "Spotlight",
        "type": "number",
        "default": 1000000,         # ₦10,000
    },
}

DEFAULT_SETTINGS: Dict[str, Any] = {key: meta["default"] for key, meta in SETTINGS_META.items()}


async def _get_settings_doc() -> Dict[str, Any]:
    doc = await db.settings.find_one({"key": "platform_settings"})
    if not doc:
        return DEFAULT_SETTINGS.copy()
    stored = doc.get("settings", {})
    return {k: stored.get(k, meta["default"]) for k, meta in SETTINGS_META.items()}


async def get_platform_setting(key: str) -> Any:
    """Helper for other routes to read a single setting value."""
    settings = await _get_settings_doc()
    return settings.get(key, SETTINGS_META[key]["default"])


@router.get("/platform-settings")
async def get_platform_settings():
    """Public endpoint — returns current platform settings. Used by frontend and other routes."""
    settings = await _get_settings_doc()
    return {"settings": settings, "meta": SETTINGS_META}


class SettingsUpdate(BaseModel):
    settings: Dict[str, Any]


@router.put("/admin/platform-settings")
async def update_platform_settings(body: SettingsUpdate, request: Request):
    """Admin-only — update one or more platform settings."""
    unknown = [k for k in body.settings if k not in SETTINGS_META]
    if unknown:
        raise HTTPException(status_code=400, detail=f"Unknown settings keys: {unknown}")

    # Type validation — numeric fields must be positive integers
    for key, value in body.settings.items():
        meta = SETTINGS_META[key]
        if meta["type"] == "number":
            if not isinstance(value, (int, float)) or value <= 0:
                raise HTTPException(status_code=400, detail=f"Setting '{key}' must be a positive number")

    current = await _get_settings_doc()
    current.update(body.settings)

    await db.settings.update_one(
        {"key": "platform_settings"},
        {"$set": {
            "key": "platform_settings",
            "settings": current,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    logger.info(f"Platform settings updated: {list(body.settings.keys())}")
    return {"settings": current, "updated": list(body.settings.keys())}
