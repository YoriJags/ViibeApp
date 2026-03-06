"""
Viibe App — Venue Claim & Self-Serve Merchant Onboarding
Any venue owner can search for their venue, submit a claim, and get merchant access after admin approval.
This is how Viibe scales beyond manual admin assignment.

Routes:
  GET  /api/venues/search                  search venues by name (for claim flow)
  POST /api/claim/venue/{venue_id}         submit a venue claim
  GET  /api/claim/my-claim                 check authenticated user's claim status
  GET  /admin/claims                       admin: list all pending claims
  POST /admin/claims/{claim_id}/approve    admin: approve claim → grants merchant access
  POST /admin/claims/{claim_id}/reject     admin: reject claim with reason
"""
import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.config import db, logger
from app.services.auth import get_current_user

router = APIRouter(tags=["claims"])


class ClaimRequest(BaseModel):
    claimant_name: str
    business_phone: str
    business_email: str
    proof_note: Optional[str] = None   # "I'm the owner, I can verify via..."


class RejectRequest(BaseModel):
    reason: str


# ─── Public: venue search for claim flow ─────────────────────────────────────

@router.get("/venues/search")
async def search_venues(q: str = "", city: Optional[str] = None):
    """
    Search venues by name. Used in the claim-venue flow so owners can find their venue.
    Returns lightweight venue list (no sensitive data).
    """
    if len(q) < 2:
        return {"venues": []}

    query: dict = {"name": {"$regex": q, "$options": "i"}}
    if city:
        query["city"] = city

    venues = await db.venues.find(
        query,
        {"_id": 0, "id": 1, "name": 1, "address": 1, "area": 1, "city": 1,
         "venue_type": 1, "claim_status": 1, "is_verified": 1},
    ).limit(20).to_list(20)

    return {"venues": venues}


# ─── Submit claim ─────────────────────────────────────────────────────────────

@router.post("/claim/venue/{venue_id}")
async def submit_claim(venue_id: str, body: ClaimRequest, request: Request):
    """
    Submit a claim for a venue. Sets venue claim_status to 'pending'.
    Admin reviews and approves/rejects.
    """
    user = await get_current_user(request)

    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0, "name": 1, "claim_status": 1})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    if venue.get("claim_status") == "claimed":
        raise HTTPException(status_code=409, detail="This venue is already claimed")

    # One pending claim per user
    existing = await db.venue_claims.find_one({"user_id": user["id"], "status": "pending"})
    if existing:
        raise HTTPException(
            status_code=409,
            detail="You already have a pending claim. Wait for it to be reviewed.",
        )

    claim_doc = {
        "id": str(uuid.uuid4()),
        "venue_id": venue_id,
        "venue_name": venue.get("name", ""),
        "user_id": user["id"],
        "claimant_name": body.claimant_name,
        "business_phone": body.business_phone,
        "business_email": body.business_email,
        "proof_note": body.proof_note or "",
        "status": "pending",
        "submitted_at": datetime.now(timezone.utc),
        "reviewed_at": None,
        "reviewed_by": None,
        "reject_reason": None,
    }

    await db.venue_claims.insert_one(claim_doc)
    await db.venues.update_one({"id": venue_id}, {"$set": {"claim_status": "pending"}})

    claim_doc.pop("_id", None)
    claim_doc["submitted_at"] = claim_doc["submitted_at"].isoformat()

    logger.info(f"Venue claim submitted: {venue_id} by user {user['id']}")
    return {"success": True, "claim": claim_doc}


# ─── Check own claim ─────────────────────────────────────────────────────────

@router.get("/claim/my-claim")
async def get_my_claim(request: Request):
    """Check the authenticated user's current claim status."""
    user = await get_current_user(request)

    claim = await db.venue_claims.find_one(
        {"user_id": user["id"]},
        {"_id": 0},
        sort=[("submitted_at", -1)],
    )
    if not claim:
        return {"has_claim": False}

    for f in ("submitted_at", "reviewed_at"):
        if claim.get(f) and not isinstance(claim[f], str):
            claim[f] = claim[f].isoformat()

    return {"has_claim": True, "claim": claim}


# ─── Admin: list claims ───────────────────────────────────────────────────────

@router.get("/admin/claims")
async def list_claims(request: Request, status: Optional[str] = "pending"):
    """Admin: list venue claims filtered by status."""
    user = await get_current_user(request)
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin only")

    query = {}
    if status:
        query["status"] = status

    claims = await db.venue_claims.find(query, {"_id": 0}).sort("submitted_at", -1).limit(50).to_list(50)
    for c in claims:
        for f in ("submitted_at", "reviewed_at"):
            if c.get(f) and not isinstance(c[f], str):
                c[f] = c[f].isoformat()

    return {"claims": claims, "count": len(claims)}


# ─── Admin: approve claim ─────────────────────────────────────────────────────

@router.post("/admin/claims/{claim_id}/approve")
async def approve_claim(claim_id: str, request: Request):
    """
    Admin approves a venue claim:
    1. Sets claim status to 'approved'
    2. Sets venue claim_status to 'claimed'
    3. Sets user.is_merchant = True + user.merchant_venue_id = venue_id
    """
    admin = await get_current_user(request)
    if not admin.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin only")

    claim = await db.venue_claims.find_one({"id": claim_id})
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    if claim["status"] != "pending":
        raise HTTPException(status_code=409, detail=f"Claim is already {claim['status']}")

    now = datetime.now(timezone.utc)

    # Grant merchant access
    await db.users.update_one(
        {"id": claim["user_id"]},
        {"$set": {"is_merchant": True, "merchant_venue_id": claim["venue_id"]}},
    )
    # Mark venue as claimed
    await db.venues.update_one(
        {"id": claim["venue_id"]},
        {"$set": {"claim_status": "claimed", "owner_id": claim["user_id"]}},
    )
    # Update claim record
    await db.venue_claims.update_one(
        {"id": claim_id},
        {"$set": {"status": "approved", "reviewed_at": now, "reviewed_by": admin["id"]}},
    )

    logger.info(f"Claim {claim_id} approved by admin {admin['id']}")
    return {
        "success": True,
        "message": f"{claim['claimant_name']} now has merchant access to {claim['venue_name']}",
    }


# ─── Admin: reject claim ─────────────────────────────────────────────────────

@router.post("/admin/claims/{claim_id}/reject")
async def reject_claim(claim_id: str, body: RejectRequest, request: Request):
    """Admin rejects a claim with a reason. Resets venue claim_status to unclaimed."""
    admin = await get_current_user(request)
    if not admin.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin only")

    claim = await db.venue_claims.find_one({"id": claim_id})
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    if claim["status"] != "pending":
        raise HTTPException(status_code=409, detail=f"Claim is already {claim['status']}")

    now = datetime.now(timezone.utc)

    await db.venues.update_one(
        {"id": claim["venue_id"]},
        {"$set": {"claim_status": "unclaimed"}},
    )
    await db.venue_claims.update_one(
        {"id": claim_id},
        {"$set": {
            "status": "rejected",
            "reject_reason": body.reason,
            "reviewed_at": now,
            "reviewed_by": admin["id"],
        }},
    )

    logger.info(f"Claim {claim_id} rejected by admin {admin['id']}: {body.reason}")
    return {"success": True, "message": "Claim rejected"}
