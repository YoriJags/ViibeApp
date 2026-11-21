"""
Place routes: permanent grounds that host events (see services/places.py).

  GET  /places/search?q=&city=           VIIBE's approved places, then OpenStreetMap
  POST /places                           submit a new place (signed in; waits for review)
  GET  /admin/places                     places waiting for review (super admin)
  POST /admin/places/{id}/approve        approve, optionally correcting the pin or radius
  POST /admin/places/{id}/reject         reject, with the reason the submitter sees
"""
import re
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query

from app.config import db
from app.services.auth import require_admin, require_auth
from app.services.event_trust import submission_limit_problem
from app.services.places import (
    CITY_BOUNDS,
    STATUS_APPROVED,
    STATUS_PENDING,
    STATUS_REJECTED,
    new_place_document,
    public_place,
    search_openstreetmap,
    validate_place,
)

router = APIRouter(tags=["places"])


async def submissions_today_and_pending(user_id: str) -> tuple[int, int]:
    """Events and places together count towards one person's limits."""
    since = datetime.now(timezone.utc) - timedelta(days=1)
    pending = (await db.places.count_documents({"submitted_by": user_id, "status": STATUS_PENDING})
               + await db.event_submissions.count_documents({"submitted_by": user_id, "status": "pending"}))
    today = (await db.places.count_documents({"submitted_by": user_id, "created_at": {"$gte": since}})
             + await db.event_submissions.count_documents({"submitted_by": user_id,
                                                           "created_at": {"$gte": since}}))
    return pending, today


@router.get("/places/search")
async def search_places(q: str = Query(..., min_length=2, max_length=80), city: str = Query("lagos")):
    city = city.lower()
    if city not in CITY_BOUNDS:
        raise HTTPException(status_code=422, detail=f"City must be one of: {', '.join(CITY_BOUNDS)}.")
    pattern = re.escape(q.strip())
    ours = await db.places.find(
        {"city": city, "status": STATUS_APPROVED, "name": {"$regex": pattern, "$options": "i"}},
        {"_id": 0}).limit(8).to_list(8)
    results = [{**public_place(p), "source": "viibe"} for p in ours]
    if len(results) < 5:
        known = {r.get("osm_id") for r in ours if r.get("osm_id")}
        results += [r for r in await search_openstreetmap(q, city) if r["osm_id"] not in known]
    return {"results": results[:10]}


@router.post("/places")
async def submit_place(payload: dict, user: dict = Depends(require_auth)):
    problems = validate_place(payload)
    if problems:
        raise HTTPException(status_code=422, detail={"problems": problems})
    pending, today = await submissions_today_and_pending(user["id"])
    limit = submission_limit_problem(pending, today)
    if limit:
        raise HTTPException(status_code=429, detail=limit)
    doc = new_place_document(payload, submitted_by=user["id"])
    await db.places.insert_one(dict(doc))
    return {"place": public_place(doc)}


@router.get("/admin/places")
async def pending_places(admin: dict = Depends(require_admin)):
    rows = await db.places.find({"status": STATUS_PENDING}, {"_id": 0}).sort("created_at", 1).to_list(200)
    return {"places": [{**public_place(r), "submitted_by": r.get("submitted_by")} for r in rows]}


@router.post("/admin/places/{place_id}/approve")
async def approve_place(place_id: str, payload: dict | None = None, admin: dict = Depends(require_admin)):
    payload = payload or {}
    place = await db.places.find_one({"id": place_id})
    if not place:
        raise HTTPException(status_code=404, detail="Place not found")
    update = {"status": STATUS_APPROVED,
              "review": {"by": admin["id"], "at": datetime.now(timezone.utc)}}
    # The admin may correct the pin or the ground size while approving.
    if payload.get("coordinates") or payload.get("ground_radius_m"):
        check = {**place, **{k: payload[k] for k in ("coordinates", "ground_radius_m") if payload.get(k)},
                 "location_source": "pin"}
        problems = validate_place(check)
        if problems:
            raise HTTPException(status_code=422, detail={"problems": problems})
        if payload.get("coordinates"):
            update["coordinates"] = {"lat": float(payload["coordinates"]["lat"]),
                                     "lng": float(payload["coordinates"]["lng"])}
        if payload.get("ground_radius_m"):
            update["ground_radius_m"] = float(payload["ground_radius_m"])
    await db.places.update_one({"id": place_id}, {"$set": update})
    return {"approved": place_id}


@router.post("/admin/places/{place_id}/reject")
async def reject_place(place_id: str, payload: dict, admin: dict = Depends(require_admin)):
    reason = (payload.get("reason") or "").strip()
    if not reason or len(reason) > 500:
        raise HTTPException(status_code=422, detail="Give the reason the submitter will see (at most 500 characters).")
    result = await db.places.update_one(
        {"id": place_id, "status": STATUS_PENDING},
        {"$set": {"status": STATUS_REJECTED,
                  "review": {"by": admin["id"], "at": datetime.now(timezone.utc), "reason": reason}}})
    if not result.matched_count:
        raise HTTPException(status_code=404, detail="No pending place with that id")
    return {"rejected": place_id}
