"""
Access to the intelligence API (PLAN.md Phase 7): keys, rate limits, metering.

One gate for every licensed endpoint (the /v1 feed and the grid history):

  * Keys are shown once and stored only as a SHA-256 hash, as partner keys are.
  * Each key has a tier, which sets requests per minute and requests per day.
  * Every accepted request is counted per key per day, which is what a bill
    or a renewal conversation is built from.

Tiers carry limits only. What each tier costs is a commercial decision and
lives in the contract, not in code.

Older keys were stored in db.api_keys in plain text. The first time one is
used it is moved here as a hash and the plain copy is switched off.

# TODO(scale-gate-A): the per-minute window is in memory, so it is per
# replica. Move it to Redis when the API runs on more than one.
"""
from __future__ import annotations

import hashlib
import secrets
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Header, HTTPException
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.config import db

KEY_PREFIX = "vik_"

TIERS = {
    "starter":    {"per_minute": 60,   "per_day": 5_000},
    "growth":     {"per_minute": 300,  "per_day": 50_000},
    "enterprise": {"per_minute": 1200, "per_day": 500_000},
}
DEFAULT_TIER = "starter"

# key id -> (window start, count) for the current minute
_minute: dict[str, tuple[float, int]] = {}
_MINUTE_MAX_KEYS = 10_000


def hash_key(key: str) -> str:
    return hashlib.sha256(key.encode("utf-8")).hexdigest()


def _day(now: Optional[datetime] = None) -> str:
    return (now or datetime.now(timezone.utc)).strftime("%Y-%m-%d")


def _public(doc: dict) -> dict:
    return {k: doc.get(k) for k in ("id", "name", "tier", "active", "created_at", "created_by")}


async def issue_key(name: str, tier: str = DEFAULT_TIER, created_by: Optional[str] = None) -> dict:
    """Create a key. The key itself is returned once and never stored."""
    name = (name or "").strip()
    if not name or len(name) > 120 or any(c in "<>" for c in name):
        raise HTTPException(status_code=422, detail="The key needs a plain name of at most 120 characters")
    if tier not in TIERS:
        raise HTTPException(status_code=422, detail=f"tier must be one of {', '.join(TIERS)}")
    if await db.intel_keys.find_one({"name": name, "active": True}):
        raise HTTPException(status_code=409, detail=f"An active key called {name} already exists")
    key = KEY_PREFIX + secrets.token_urlsafe(32)
    doc = {
        "id": str(uuid.uuid4()),
        "name": name,
        "key_hash": hash_key(key),
        "tier": tier,
        "active": True,
        "created_by": created_by,
        "created_at": datetime.now(timezone.utc),
    }
    await db.intel_keys.insert_one(dict(doc))
    return {"key": _public(doc), "api_key": key}


async def revoke_key(key_id: str) -> dict:
    result = await db.intel_keys.update_one({"id": key_id}, {"$set": {"active": False}})
    if not result.matched_count:
        raise HTTPException(status_code=404, detail="Key not found")
    _minute.pop(key_id, None)
    return {"revoked": key_id}


async def _adopt_legacy(raw: str) -> Optional[dict]:
    """A plain-text key from db.api_keys: move it here as a hash, once."""
    legacy = await db.api_keys.find_one({"key": raw, "active": True})
    if not legacy:
        return None
    doc = {
        "id": str(uuid.uuid4()),
        "name": legacy.get("partner") or "legacy key",
        "key_hash": hash_key(raw),
        "tier": DEFAULT_TIER,
        "active": True,
        "created_by": "migrated from api_keys",
        "created_at": legacy.get("created_at") or datetime.now(timezone.utc),
    }
    try:
        await db.intel_keys.insert_one(dict(doc))
    except DuplicateKeyError:
        # Two first requests raced; the other one adopted it. Use that record.
        return await db.intel_keys.find_one({"key_hash": doc["key_hash"], "active": True}, {"_id": 0})
    # The plain-text copy is removed, not just switched off, so the database
    # no longer holds a usable key anywhere.
    await db.api_keys.update_one(
        {"_id": legacy["_id"]},
        {"$set": {"active": False, "migrated": True, "intel_key_id": doc["id"]}, "$unset": {"key": ""}},
    )
    return doc


def _check_minute(key_id: str, limit: int, now: Optional[float] = None) -> Optional[int]:
    """Count this request in the key's current minute. Returns seconds to wait if over."""
    now = time.monotonic() if now is None else now
    start, count = _minute.get(key_id, (now, 0))
    if now - start >= 60:
        start, count = now, 0
    if count >= limit:
        return max(1, int(60 - (now - start)) + 1)
    if len(_minute) >= _MINUTE_MAX_KEYS and key_id not in _minute:
        _minute.clear()
    _minute[key_id] = (start, count + 1)
    return None


async def check(raw: Optional[str]) -> dict:
    """
    Authenticate a key, apply its limits and count the request. Returns the
    key record. 401 without a key, 403 for an unknown one, 429 over a limit.
    """
    if not raw:
        raise HTTPException(status_code=401, detail="X-API-Key header required")
    doc = await db.intel_keys.find_one({"key_hash": hash_key(raw), "active": True}, {"_id": 0})
    if not doc:
        doc = await _adopt_legacy(raw)
    if not doc:
        raise HTTPException(status_code=403, detail="Invalid or inactive API key")

    limits = TIERS.get(doc.get("tier"), TIERS[DEFAULT_TIER])
    wait = _check_minute(doc["id"], limits["per_minute"])
    if wait is not None:
        raise HTTPException(status_code=429, detail="Rate limit reached for this minute",
                            headers={"Retry-After": str(wait)})

    # Count first, then check, in one atomic step: every request gets its own
    # number, so a burst of parallel requests cannot all slip under the limit.
    # A refused request is taken back off the count, so it is never billed.
    day = _day()
    used = await db.api_usage.find_one_and_update(
        {"key_id": doc["id"], "day": day}, {"$inc": {"count": 1}},
        upsert=True, return_document=ReturnDocument.AFTER,
    )
    if used and used.get("count", 0) > limits["per_day"]:
        await db.api_usage.update_one({"key_id": doc["id"], "day": day}, {"$inc": {"count": -1}})
        raise HTTPException(status_code=429, detail="Daily request limit reached for this key")
    return doc


async def require_api_key(x_api_key: str = Header(...)) -> dict:
    """FastAPI dependency for every licensed endpoint."""
    return await check(x_api_key)


async def usage(key_id: str, days: int = 30) -> dict:
    """Requests per day for one key, newest first, and the total."""
    days = max(1, min(days, 366))
    since = _day(datetime.now(timezone.utc) - timedelta(days=days - 1))
    rows = await db.api_usage.find(
        {"key_id": key_id, "day": {"$gte": since}}, {"_id": 0, "day": 1, "count": 1}
    ).sort("day", -1).to_list(400)
    return {"days": days, "total": sum(r.get("count", 0) for r in rows), "by_day": rows}


async def list_keys() -> list[dict]:
    today = _day()
    out = []
    for doc in await db.intel_keys.find({}, {"_id": 0, "key_hash": 0}).sort("created_at", -1).to_list(1000):
        used = await db.api_usage.find_one({"key_id": doc["id"], "day": today}, {"_id": 0, "count": 1})
        out.append({**_public(doc), "limits": TIERS.get(doc.get("tier"), TIERS[DEFAULT_TIER]),
                    "requests_today": (used or {}).get("count", 0)})
    return out
