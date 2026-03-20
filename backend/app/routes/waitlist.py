from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime, timezone
from app.config import db

router = APIRouter(prefix="/waitlist", tags=["waitlist"])


class WaitlistEntry(BaseModel):
    email: EmailStr
    role: str = "scout"
    city: str = "lagos"


@router.post("")
async def join_waitlist(entry: WaitlistEntry):
    existing = await db.waitlist.find_one({"email": entry.email})
    if existing:
        raise HTTPException(status_code=409, detail="Already on waitlist")

    count = await db.waitlist.count_documents({})
    position = count + 1

    await db.waitlist.insert_one({
        "email": entry.email,
        "role": entry.role,
        "city": entry.city,
        "position": position,
        "joined_at": datetime.now(timezone.utc),
    })

    return {"ok": True, "position": position}
