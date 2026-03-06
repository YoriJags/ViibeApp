"""
Viibe App — Venue Booking System (OpenTable model)
Users pay ₦500 reservation fee via Paystack. Merchant sees all bookings.

Routes:
  POST /api/venues/{venue_id}/bookings/initialize   create booking + Paystack payment
  POST /api/bookings/verify/{reference}             verify payment → confirm booking
  GET  /api/bookings/my-bookings                    user's own bookings
  GET  /api/merchant/venues/{venue_id}/bookings     merchant view: all bookings for venue
  DELETE /api/bookings/{booking_id}                 cancel booking
"""
import uuid
import httpx
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.config import db, logger, PAYSTACK_SECRET_KEY
from app.services.auth import get_current_user

router = APIRouter(tags=["bookings"])

BOOKING_FEE_NGN = 500   # ₦500 per reservation — the OpenTable model


class BookingInitRequest(BaseModel):
    user_name: str
    user_phone: str
    party_size: int
    booking_date: str    # "YYYY-MM-DD"
    booking_time: str    # "HH:MM"
    notes: Optional[str] = None
    email: str           # for Paystack


# ─── Initialize booking + payment ────────────────────────────────────────────

@router.post("/venues/{venue_id}/bookings/initialize")
async def initialize_booking(venue_id: str, body: BookingInitRequest, request: Request):
    """
    Create a pending booking and initialize Paystack payment.
    Returns authorization_url for user to complete ₦500 fee.
    """
    user = await get_current_user(request)

    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0, "name": 1, "area": 1})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    if body.party_size < 1 or body.party_size > 50:
        raise HTTPException(status_code=400, detail="Party size must be between 1 and 50")

    reference = f"VIIBE-BOOK-{venue_id[:8]}-{uuid.uuid4().hex[:8]}"

    booking_doc = {
        "id": str(uuid.uuid4()),
        "venue_id": venue_id,
        "venue_name": venue.get("name", ""),
        "venue_area": venue.get("area", ""),
        "user_id": user["id"],
        "user_name": body.user_name,
        "user_phone": body.user_phone,
        "party_size": body.party_size,
        "booking_date": body.booking_date,
        "booking_time": body.booking_time,
        "notes": body.notes or "",
        "status": "pending_payment",
        "payment_ref": reference,
        "amount_paid": 0,
        "created_at": datetime.now(timezone.utc),
        "confirmed_at": None,
    }

    await db.venue_bookings.insert_one(booking_doc)

    # Initialize Paystack payment
    if PAYSTACK_SECRET_KEY:
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                paystack_response = await client.post(
                    "https://api.paystack.co/transaction/initialize",
                    headers={
                        "Authorization": f"Bearer {PAYSTACK_SECRET_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "email": body.email,
                        "amount": int(BOOKING_FEE_NGN * 100),  # kobo
                        "reference": reference,
                        "metadata": {
                            "venue_id": venue_id,
                            "venue_name": venue.get("name"),
                            "booking_id": booking_doc["id"],
                            "type": "venue_booking",
                        },
                        "callback_url": f"viibe://booking/confirm/{reference}",
                    },
                )
                if paystack_response.status_code == 200:
                    data = paystack_response.json()
                    auth_url = data["data"]["authorization_url"]
                    await db.venue_bookings.update_one(
                        {"id": booking_doc["id"]},
                        {"$set": {"authorization_url": auth_url}},
                    )
                    return {
                        "booking_id": booking_doc["id"],
                        "reference": reference,
                        "authorization_url": auth_url,
                        "fee_ngn": BOOKING_FEE_NGN,
                    }
                else:
                    logger.error(f"Paystack booking init failed: {paystack_response.status_code}")
                    raise HTTPException(status_code=502, detail="Payment provider error. Please try again.")
        except httpx.TimeoutException:
            raise HTTPException(status_code=504, detail="Payment provider timeout. Please try again.")
        except httpx.RequestError as e:
            logger.error(f"Paystack connection error: {e}")
            raise HTTPException(status_code=502, detail="Could not reach payment provider.")

    # Dev/test mode — auto-confirm without Paystack
    return {
        "booking_id": booking_doc["id"],
        "reference": reference,
        "authorization_url": f"https://checkout.paystack.com/mock/{reference}",
        "fee_ngn": BOOKING_FEE_NGN,
        "mock": True,
    }


# ─── Verify payment → confirm booking ────────────────────────────────────────

@router.post("/bookings/verify/{reference}")
async def verify_booking(reference: str):
    """
    Verify Paystack payment and confirm booking.
    Idempotent — safe to call multiple times.
    """
    booking = await db.venue_bookings.find_one({"payment_ref": reference}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.get("status") == "confirmed":
        return {"success": True, "message": "Already confirmed", "booking": _serialize_booking(booking)}

    # Atomically claim reference to prevent double-confirm
    claim = await db.venue_bookings.update_one(
        {"payment_ref": reference, "status": "pending_payment"},
        {"$set": {"status": "verifying"}},
    )
    if claim.modified_count == 0:
        return {"success": True, "message": "Already being processed"}

    verified = False
    if PAYSTACK_SECRET_KEY:
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(
                    f"https://api.paystack.co/transaction/verify/{reference}",
                    headers={"Authorization": f"Bearer {PAYSTACK_SECRET_KEY}"},
                )
                if response.status_code == 200:
                    data = response.json().get("data", {})
                    if data.get("status") == "success":
                        paid_kobo = data.get("amount", 0)
                        expected_kobo = int(BOOKING_FEE_NGN * 100)
                        if paid_kobo >= expected_kobo:
                            verified = True
        except (httpx.TimeoutException, httpx.RequestError) as e:
            logger.error(f"Paystack verify error for booking {reference}: {e}")
            await db.venue_bookings.update_one(
                {"payment_ref": reference, "status": "verifying"},
                {"$set": {"status": "pending_payment"}},
            )
            raise HTTPException(status_code=502, detail="Could not verify payment. Please retry.")
    else:
        verified = True  # dev mode

    if verified:
        now = datetime.now(timezone.utc)
        await db.venue_bookings.update_one(
            {"payment_ref": reference},
            {"$set": {
                "status": "confirmed",
                "amount_paid": BOOKING_FEE_NGN,
                "confirmed_at": now,
            }},
        )
        # Record platform revenue from booking fee
        await db.platform_revenue.insert_one({
            "type": "booking_fee",
            "amount": BOOKING_FEE_NGN,
            "venue_id": booking["venue_id"],
            "reference": reference,
            "recorded_at": now,
        })
        confirmed_booking = await db.venue_bookings.find_one({"payment_ref": reference}, {"_id": 0})
        logger.info(f"Booking confirmed: {reference} for venue {booking['venue_id']}")
        return {"success": True, "booking": _serialize_booking(confirmed_booking)}

    # Payment failed
    await db.venue_bookings.update_one(
        {"payment_ref": reference},
        {"$set": {"status": "payment_failed"}},
    )
    raise HTTPException(status_code=402, detail="Payment not completed")


# ─── User: my bookings ────────────────────────────────────────────────────────

@router.get("/bookings/my-bookings")
async def get_my_bookings(request: Request):
    """List the current user's bookings, most recent first."""
    user = await get_current_user(request)
    bookings = await db.venue_bookings.find(
        {"user_id": user["id"]},
        {"_id": 0},
    ).sort("created_at", -1).limit(20).to_list(20)
    return {"bookings": [_serialize_booking(b) for b in bookings]}


# ─── Merchant: venue bookings ─────────────────────────────────────────────────

@router.get("/merchant/venues/{venue_id}/bookings")
async def get_venue_bookings(venue_id: str, request: Request):
    """
    Merchant view: all confirmed bookings for their venue, upcoming first.
    Shows today's + future bookings by default.
    """
    user = await get_current_user(request)
    if user.get("merchant_venue_id") != venue_id and not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Not your venue")

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    bookings = await db.venue_bookings.find(
        {"venue_id": venue_id, "status": "confirmed", "booking_date": {"$gte": today}},
        {"_id": 0},
    ).sort([("booking_date", 1), ("booking_time", 1)]).limit(50).to_list(50)

    today_count = sum(1 for b in bookings if b["booking_date"] == today)
    total_guests_today = sum(b["party_size"] for b in bookings if b["booking_date"] == today)

    return {
        "venue_id": venue_id,
        "bookings": [_serialize_booking(b) for b in bookings],
        "summary": {
            "today_count": today_count,
            "total_guests_today": total_guests_today,
            "upcoming_count": len(bookings),
        },
    }


# ─── Cancel booking ───────────────────────────────────────────────────────────

@router.delete("/bookings/{booking_id}")
async def cancel_booking(booking_id: str, request: Request):
    """
    Cancel a booking. User can cancel their own; admin can cancel any.
    Note: refund logic is handled manually for now (Paystack refund API in Phase 2).
    """
    user = await get_current_user(request)
    booking = await db.venue_bookings.find_one({"id": booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking["user_id"] != user["id"] and not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Not your booking")
    if booking["status"] not in ("confirmed", "pending_payment"):
        raise HTTPException(status_code=409, detail=f"Cannot cancel a {booking['status']} booking")

    await db.venue_bookings.update_one(
        {"id": booking_id},
        {"$set": {"status": "cancelled", "cancelled_at": datetime.now(timezone.utc)}},
    )
    return {"success": True, "message": "Booking cancelled"}


# ─── Helper ───────────────────────────────────────────────────────────────────

def _serialize_booking(b: dict) -> dict:
    for field in ("created_at", "confirmed_at", "cancelled_at"):
        if b.get(field) and not isinstance(b[field], str):
            b[field] = b[field].isoformat()
    b.pop("_id", None)
    return b
