"""
Vibe App - Webhook Routes
Paystack webhook handler for payment verification.
"""
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.config import logger
from app.services.payments import verify_paystack_signature
from app.routes.merchant import verify_wallet_topup
from app.routes.subscriptions import verify_subscription_by_reference

router = APIRouter(tags=["webhooks"])


@router.post("/webhook/paystack")
async def paystack_webhook(request: Request):
    """Handle Paystack webhook for payment verification."""
    signature = request.headers.get("x-paystack-signature", "")
    body = await request.body()

    if not verify_paystack_signature(body.decode(), signature):
        import json as _json
        try:
            _event_type = _json.loads(body).get("event", "unknown")
        except Exception:
            _event_type = "unparseable"
        client_ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "unknown")
        logger.warning(
            "Webhook signature verification failed — possible replay attack or misconfigured secret",
            extra={
                "received_sig_prefix": signature[:8] if signature else "missing",
                "event_type": _event_type,
                "client_ip": client_ip,
            }
        )
        return JSONResponse(status_code=401, content={"status": "unauthorized"})

    payload = await request.json()

    if payload.get("event") == "charge.success":
        data = payload.get("data", {})
        reference = data.get("reference", "")

        if reference.startswith("VIBE-TOPUP-"):
            await verify_wallet_topup(reference)

        elif reference.startswith("VIIBE-PLUS-"):
            await verify_subscription_by_reference(reference)

    return JSONResponse(status_code=200, content={"status": "ok"})
