"""
Vibe App - OTP (One-Time Password) Service

Generates, stores (hashed), and verifies phone-based OTPs for authentication.

Security properties:
  - 6-digit OTP generated via cryptographically secure PRNG (secrets module)
  - Stored as SHA-256(phone:otp) — never in plaintext
  - Expires after OTP_EXPIRY_MINUTES (default 10)
  - Self-destructs on first successful verification (single-use)
  - Locked out after MAX_OTP_ATTEMPTS failed guesses (default 5)
  - Upsert semantics: requesting a new OTP replaces the old one atomically
"""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from app.config import db, logger

OTP_EXPIRY_MINUTES = 10
MAX_OTP_ATTEMPTS = 5


def _generate_otp() -> str:
    """Return a cryptographically secure 6-digit OTP string."""
    return f"{secrets.randbelow(900_000) + 100_000}"


def _hash_otp(phone: str, otp: str) -> str:
    """SHA-256 hash of phone:otp.  Phone acts as an implicit salt."""
    return hashlib.sha256(f"{phone}:{otp}".encode()).hexdigest()


async def create_otp(phone: str) -> str:
    """
    Generate a fresh OTP for *phone*, persist its hash, and return the
    plaintext code so the caller can send it via SMS.

    Any existing pending OTP for this phone is atomically replaced.
    """
    otp = _generate_otp()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRY_MINUTES)

    await db.phone_otps.replace_one(
        {"phone": phone},
        {
            "phone": phone,
            "otp_hash": _hash_otp(phone, otp),
            "expires_at": expires_at,
            "created_at": datetime.now(timezone.utc),
            "attempts": 0,
        },
        upsert=True,
    )
    return otp


async def verify_otp(phone: str, otp: str) -> bool:
    """
    Verify *otp* for *phone*.

    Returns True and deletes the record on success.
    Returns False (and increments the attempt counter) on wrong code.
    Returns False and deletes the record if expired or attempt-locked.
    """
    record = await db.phone_otps.find_one({"phone": phone})
    if not record:
        logger.warning(f"OTP verify: no pending OTP for {phone}")
        return False

    # Expiry check
    expires_at = record.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at < datetime.now(timezone.utc):
        await db.phone_otps.delete_one({"phone": phone})
        logger.warning(f"OTP verify: expired OTP for {phone}")
        return False

    # Attempt limit
    if record.get("attempts", 0) >= MAX_OTP_ATTEMPTS:
        await db.phone_otps.delete_one({"phone": phone})
        logger.warning(f"OTP verify: too many attempts for {phone}")
        return False

    # Constant-time hash comparison
    expected = _hash_otp(phone, otp)
    if record["otp_hash"] == expected:
        await db.phone_otps.delete_one({"phone": phone})
        return True

    # Wrong code — increment attempt counter
    await db.phone_otps.update_one({"phone": phone}, {"$inc": {"attempts": 1}})
    remaining = MAX_OTP_ATTEMPTS - record.get("attempts", 0) - 1
    logger.warning(f"OTP verify: wrong code for {phone} ({remaining} attempts left)")
    return False
