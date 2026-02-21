"""
Vibe App - SMS Notification Service (Twilio)

Required environment variables:
  TWILIO_ACCOUNT_SID   - Twilio account SID
  TWILIO_AUTH_TOKEN    - Twilio auth token
  TWILIO_FROM_NUMBER   - Twilio sender number (e.g. +12345678901)
"""
import os
import base64
import httpx
from app.config import logger

TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN", "")
TWILIO_FROM_NUMBER = os.environ.get("TWILIO_FROM_NUMBER", "")


def _normalise_ng_phone(phone: str) -> str:
    """Convert 080xxxxxxxx → +23480xxxxxxxx."""
    phone = phone.strip().replace(" ", "").replace("-", "")
    if phone.startswith("0") and len(phone) == 11:
        return "+234" + phone[1:]
    if phone.startswith("234") and not phone.startswith("+"):
        return "+" + phone
    return phone


async def send_sms(to_phone: str, message: str) -> bool:
    """Send an SMS via Twilio. Returns True on success."""
    if not all([TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER]):
        logger.warning("Twilio credentials not set — SMS not sent")
        return False

    to_phone = _normalise_ng_phone(to_phone)
    url = f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_ACCOUNT_SID}/Messages.json"
    credentials = base64.b64encode(
        f"{TWILIO_ACCOUNT_SID}:{TWILIO_AUTH_TOKEN}".encode()
    ).decode()

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(
                url,
                data={"From": TWILIO_FROM_NUMBER, "To": to_phone, "Body": message},
                headers={"Authorization": f"Basic {credentials}"},
            )
            success = response.status_code == 201
            if success:
                logger.info(f"SMS sent to {to_phone}")
            else:
                logger.warning(f"SMS failed to {to_phone}: {response.status_code}")
            return success
    except Exception as e:
        logger.error(f"SMS error to {to_phone}: {e}")
        return False


async def send_otp(phone: str, otp: str) -> bool:
    """Send a one-time password for phone verification."""
    return await send_sms(
        phone,
        f"Your Vibez OTP is: {otp}. Valid for 10 minutes. Do not share this code.",
    )


async def send_merchant_sms_alert(phone: str, venue_name: str, message: str) -> bool:
    """Send a critical operational alert to a merchant."""
    return await send_sms(phone, f"[Vibez] {venue_name}: {message}")


async def send_scout_achievement_sms(phone: str, badge_name: str) -> bool:
    """Notify a scout of a new badge via SMS."""
    return await send_sms(
        phone,
        f"Vibez: You just unlocked the '{badge_name}' badge! Check the app to see your new rank.",
    )


async def send_vibe_spike_sms(phone: str, venue_name: str, vibe_label: str) -> bool:
    """Alert a scout that a venue matching their DNA just spiked."""
    return await send_sms(
        phone,
        f"Vibez: {venue_name} just went {vibe_label}! Your kind of vibe is live right now.",
    )
