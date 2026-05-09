from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime, timezone
import smtplib
import os
from email.mime.text import MIMEText
from app.config import db

router = APIRouter(prefix="/waitlist", tags=["waitlist"])


class WaitlistEntry(BaseModel):
    email: str
    role: str = "scout"
    city: str = "lagos"


@router.post("")
async def join_waitlist(entry: WaitlistEntry):
    if len(entry.email) > 254 or "@" not in entry.email:
        raise HTTPException(status_code=400, detail="Invalid email address")
    if len(entry.role) > 50 or len(entry.city) > 100:
        raise HTTPException(status_code=400, detail="Invalid input")
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

    # Send notification email
    try:
        smtp_user = os.environ.get("SMTP_USER", "")
        smtp_pass = os.environ.get("SMTP_PASS", "")
        notify_email = os.environ.get("NOTIFY_EMAIL", "Yoriajagun08@gmail.com")
        if smtp_user and smtp_pass:
            msg = MIMEText(
                f"New waitlist signup!\n\nEmail: {entry.email}\nRole: {entry.role}\nCity: {entry.city}\nPosition: #{position}"
            )
            msg["Subject"] = f"VIIBE Waitlist #{position} — {entry.role}"
            msg["From"] = smtp_user
            msg["To"] = notify_email
            with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
                server.login(smtp_user, smtp_pass)
                server.sendmail(smtp_user, notify_email, msg.as_string())
    except Exception:
        pass  # Never block signup due to email failure

    return {"ok": True, "position": position}
