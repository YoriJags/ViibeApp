"""
Admin: issue, list and revoke intelligence API keys, and read their usage.

  POST   /admin/api-keys            {"name": "...", "tier": "starter"}  -> the key, once
  GET    /admin/api-keys            every key with its limits and today's requests
  GET    /admin/api-keys/{id}/usage requests per day
  DELETE /admin/api-keys/{id}       revoke

See services/api_access.py.
"""
from fastapi import APIRouter, Depends, Query

from app.services import api_access
from app.services.auth import require_admin

router = APIRouter(tags=["api-keys-admin"])


@router.post("/admin/api-keys")
async def create_api_key(payload: dict, user: dict = Depends(require_admin)):
    return await api_access.issue_key(
        payload.get("name"), payload.get("tier") or api_access.DEFAULT_TIER, user.get("id")
    )


@router.get("/admin/api-keys")
async def list_api_keys(user: dict = Depends(require_admin)):
    return {"tiers": api_access.TIERS, "keys": await api_access.list_keys()}


@router.get("/admin/api-keys/{key_id}/usage")
async def api_key_usage(key_id: str, days: int = Query(30, ge=1, le=366),
                        user: dict = Depends(require_admin)):
    return {"key_id": key_id, **(await api_access.usage(key_id, days))}


@router.delete("/admin/api-keys/{key_id}")
async def revoke_api_key(key_id: str, user: dict = Depends(require_admin)):
    return await api_access.revoke_key(key_id)
