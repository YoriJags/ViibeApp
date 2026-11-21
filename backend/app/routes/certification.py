"""
VIIBE Certified: organisers and vendors prove who they are before we vouch for them.

Not the automatic "Vibe Certified" energy badge (routes/certifications.py),
which a venue earns by holding a high score. This one means a person at VIIBE
checked the proofs.

  POST /certification/apply                   organiser or vendor applies with proofs
  GET  /certification/me                      the applicant's own status
  GET  /admin/certification                   the review queue (super admin)
  POST /admin/certification/{id}/certify      certify, recording how it was checked
  POST /admin/certification/{id}/reject       reject, with the reason the applicant sees

The proof is a ticketing page or website link. A link alone only proves the
event or business exists: anyone can paste Dave's real ticket page. So the
admin confirms through the contact that page itself lists (its email, phone
or official account) before certifying, and records that method.
"""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.config import db
from app.services.auth import require_admin, require_auth
from app.services.event_trust import CERTIFICATION_LENGTH, is_certified

router = APIRouter(tags=["certification"])

KINDS = ("organiser", "vendor")
METHODS = ("link_and_contact_confirmed", "ticketing_partner", "in_person")
MAX_LINKS = 5


def _bad_text(value) -> bool:
    return any(c in "<>" or (ord(c) < 32 and c not in "\t") or ord(c) == 127 for c in str(value))


def validate_application(payload: dict, user: dict) -> list[str]:
    problems = []
    if payload.get("kind") not in KINDS:
        problems.append("Kind must be 'organiser' or 'vendor'.")
    name = payload.get("name")
    if not isinstance(name, str) or not name.strip() or len(name) > 120 or _bad_text(name):
        problems.append("The name to certify must be text of 1 to 120 characters, without < or >.")
    links = payload.get("links")
    if not isinstance(links, list) or not (1 <= len(links) <= MAX_LINKS):
        problems.append(f"Give 1 to {MAX_LINKS} links: your ticketing page or website.")
    else:
        for link in links:
            if (not isinstance(link, str) or not link.startswith("https://")
                    or len(link) > 500 or _bad_text(link)):
                problems.append("Every link must be an https:// address of at most 500 characters.")
                break
    contact = payload.get("contact")
    if not isinstance(contact, str) or not contact.strip() or len(contact) > 200 or _bad_text(contact):
        problems.append("Give a business contact (email or phone) of at most 200 characters.")
    note = payload.get("note")
    if note is not None and (not isinstance(note, str) or len(note) > 1000 or _bad_text(note)):
        problems.append("The note can be at most 1000 characters, without < or >.")
    if payload.get("kind") == "vendor":
        # A vendor can only certify the venue they already run on VIIBE.
        if not payload.get("venue_id") or payload.get("venue_id") != user.get("merchant_venue_id"):
            problems.append("A vendor certifies the venue they manage on VIIBE. Claim your venue first.")
    return problems


def _public(doc: dict) -> dict:
    out = {k: v for k, v in doc.items() if k not in ("_id", "user_id")}
    for k in ("created_at", "certified_at", "expires_at"):
        if isinstance(out.get(k), datetime):
            v = out[k]
            out[k] = (v if v.tzinfo else v.replace(tzinfo=timezone.utc)).isoformat()
    review = out.get("review")
    if isinstance(review, dict):
        # The applicant sees the outcome and the reason, not which admin decided.
        out["review"] = {k: v for k, v in review.items() if k in ("reason", "method")}
    return out


async def certified_record(user_id: str, kind: str) -> dict | None:
    """The person's current, unexpired certification of this kind, if any."""
    rec = await db.business_certifications.find_one(
        {"user_id": user_id, "kind": kind, "status": "certified"}, sort=[("certified_at", -1)])
    return rec if is_certified(rec) else None


@router.post("/certification/apply")
async def apply(payload: dict, user: dict = Depends(require_auth)):
    problems = validate_application(payload, user)
    if problems:
        raise HTTPException(status_code=422, detail={"problems": problems})
    waiting = await db.business_certifications.find_one(
        {"user_id": user["id"], "kind": payload["kind"], "status": "pending"})
    if waiting:
        raise HTTPException(status_code=409, detail="You already have an application waiting for review.")
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "kind": payload["kind"],
        "name": payload["name"].strip(),
        "links": payload["links"],
        "contact": payload["contact"].strip(),
        "note": (payload.get("note") or "").strip() or None,
        "venue_id": payload.get("venue_id") if payload["kind"] == "vendor" else None,
        "status": "pending",
        "created_at": datetime.now(timezone.utc),
    }
    await db.business_certifications.insert_one(dict(doc))
    return {"application": _public(doc)}


@router.get("/certification/me")
async def my_certification(user: dict = Depends(require_auth)):
    rows = await db.business_certifications.find(
        {"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(20)
    now = datetime.now(timezone.utc)
    for r in rows:
        if r.get("status") == "certified" and not is_certified(r, now):
            r["status"] = "lapsed"
    return {"applications": [_public(r) for r in rows]}


@router.get("/admin/certification")
async def review_queue(status: str = "pending", admin: dict = Depends(require_admin)):
    rows = await db.business_certifications.find(
        {"status": status}, {"_id": 0}).sort("created_at", 1).to_list(200)
    for r in rows:
        if isinstance(r.get("created_at"), datetime):
            r["created_at"] = r["created_at"].isoformat()
    return {"applications": rows}


@router.post("/admin/certification/{app_id}/certify")
async def certify(app_id: str, payload: dict, admin: dict = Depends(require_admin)):
    method = payload.get("method")
    if method not in METHODS:
        raise HTTPException(status_code=422, detail=f"Method must be one of: {', '.join(METHODS)}.")
    doc = await db.business_certifications.find_one({"id": app_id, "status": "pending"})
    if not doc:
        raise HTTPException(status_code=404, detail="No pending application with that id")
    now = datetime.now(timezone.utc)
    expires = now + CERTIFICATION_LENGTH
    await db.business_certifications.update_one({"id": app_id}, {"$set": {
        "status": "certified", "certified_at": now, "expires_at": expires,
        "review": {"by": admin["id"], "at": now, "method": method,
                   "note": (payload.get("note") or "")[:1000]},
    }})
    if doc["kind"] == "vendor" and doc.get("venue_id"):
        await db.venues.update_one({"id": doc["venue_id"]}, {"$set": {
            "business_certified": True, "business_certified_name": doc["name"],
            "business_certified_until": expires,
        }})
    return {"certified": app_id, "expires_at": expires.isoformat()}


@router.post("/admin/certification/{app_id}/reject")
async def reject(app_id: str, payload: dict, admin: dict = Depends(require_admin)):
    reason = (payload.get("reason") or "").strip()
    if not reason or len(reason) > 500:
        raise HTTPException(status_code=422, detail="Give the reason the applicant will see (at most 500 characters).")
    result = await db.business_certifications.update_one(
        {"id": app_id, "status": "pending"},
        {"$set": {"status": "rejected",
                  "review": {"by": admin["id"], "at": datetime.now(timezone.utc), "reason": reason}}})
    if not result.matched_count:
        raise HTTPException(status_code=404, detail="No pending application with that id")
    return {"rejected": app_id}
