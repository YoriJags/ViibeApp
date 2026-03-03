"""
Vibe App - Payment Service
Paystack integration: webhook verification, wallet top-ups, transfers (coin cashout).
"""
import hmac
import hashlib
import httpx
from app.config import PAYSTACK_SECRET_KEY

PAYSTACK_BASE = "https://api.paystack.co"


def _paystack_headers() -> dict:
    return {
        "Authorization": f"Bearer {PAYSTACK_SECRET_KEY}",
        "Content-Type": "application/json",
    }


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


async def resolve_bank_account(account_number: str, bank_code: str) -> dict:
    """
    Verify a Nigerian bank account via Paystack.
    Returns { account_name, account_number, bank_id } on success.
    Raises ValueError if account not found.
    """
    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"{PAYSTACK_BASE}/bank/resolve",
            params={"account_number": account_number, "bank_code": bank_code},
            headers=_paystack_headers(),
            timeout=10,
        )
    data = res.json()
    if not data.get("status"):
        raise ValueError(data.get("message", "Could not resolve account"))
    return data["data"]


async def create_transfer_recipient(name: str, account_number: str, bank_code: str) -> str:
    """
    Create a Paystack transfer recipient for a scout.
    Returns the recipient_code (stored on user record for future transfers).
    """
    async with httpx.AsyncClient() as client:
        res = await client.post(
            f"{PAYSTACK_BASE}/transferrecipient",
            json={
                "type": "nuban",
                "name": name,
                "account_number": account_number,
                "bank_code": bank_code,
                "currency": "NGN",
            },
            headers=_paystack_headers(),
            timeout=10,
        )
    data = res.json()
    if not data.get("status"):
        raise ValueError(data.get("message", "Could not create transfer recipient"))
    return data["data"]["recipient_code"]


async def initiate_transfer(recipient_code: str, amount_kobo: int, reason: str) -> dict:
    """
    Initiate a Paystack transfer from platform balance to a scout's bank account.
    Returns { transfer_code, status } on success.
    Raises ValueError on failure.
    """
    async with httpx.AsyncClient() as client:
        res = await client.post(
            f"{PAYSTACK_BASE}/transfer",
            json={
                "source": "balance",
                "recipient": recipient_code,
                "amount": amount_kobo,
                "reason": reason,
            },
            headers=_paystack_headers(),
            timeout=15,
        )
    data = res.json()
    if not data.get("status"):
        raise ValueError(data.get("message", "Transfer failed"))
    return {
        "transfer_code": data["data"]["transfer_code"],
        "status": data["data"]["status"],
    }


async def get_banks() -> list:
    """Fetch list of Nigerian banks from Paystack (for bank picker UI)."""
    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"{PAYSTACK_BASE}/bank",
            params={"country": "nigeria", "per_page": 100},
            headers=_paystack_headers(),
            timeout=10,
        )
    data = res.json()
    if not data.get("status"):
        return []
    return [{"name": b["name"], "code": b["code"]} for b in data["data"]]
