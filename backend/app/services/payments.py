"""
Vibe App - Payment Service
Paystack integration for wallet top-ups and webhook verification.
"""
import hmac
import hashlib
from app.config import PAYSTACK_SECRET_KEY


def verify_paystack_signature(payload: str, signature: str) -> bool:
    """Verify Paystack webhook signature using HMAC-SHA512."""
    if not PAYSTACK_SECRET_KEY:
        return True  # Skip verification if no key configured
    hash_object = hmac.new(
        PAYSTACK_SECRET_KEY.encode(),
        payload.encode(),
        hashlib.sha512,
    )
    computed_signature = hash_object.hexdigest()
    return hmac.compare_digest(computed_signature, signature)
