"""
Expo Push Notification Service.
Sends notifications via Expo's HTTP push API.
Tokens must be in ExponentPushToken[...] format — all others are silently skipped.
"""
import httpx
from app.config import logger

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


def _is_valid_token(token: str) -> bool:
    return isinstance(token, str) and token.startswith("ExponentPushToken")


async def send_push_notifications(
    tokens: list[str],
    title: str,
    body: str,
    data: dict | None = None,
) -> None:
    """
    Send push notifications to a list of Expo push tokens.
    Silently no-ops on empty/invalid token lists. Never raises.
    """
    valid = [t for t in tokens if _is_valid_token(t)]
    if not valid:
        return

    messages = [
        {
            "to":       token,
            "title":    title,
            "body":     body,
            "data":     data or {},
            "sound":    "default",
            "priority": "high",
        }
        for token in valid
    ]

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(EXPO_PUSH_URL, json=messages)
            if res.status_code != 200:
                logger.warning(f"Expo push returned {res.status_code}: {res.text[:200]}")
    except Exception as e:
        logger.warning(f"Expo push failed: {e}")
