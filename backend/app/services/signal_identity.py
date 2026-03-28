"""
Signal Identity Service — Privacy-by-Design Anonymization

Decouples Scout identities from behavioral signals at the point of ingestion.
Behavioral collections (kinetic_readings, events) store signal_token only.
The user_id ↔ signal_token mapping lives exclusively in this service and the
`signal_tokens` collection, which is never exposed via any public API route.

This makes VIIBE GDPR/NDPR compliant: you can license behavioral datasets to
brands without ever exposing Scout identities. The join table stays on your servers.
"""

import uuid
from datetime import datetime, timezone

from app.config import db


async def get_or_create_signal_token(user_id: str) -> str:
    """
    Returns the stable signal token for a given user_id.
    Creates one if it doesn't exist yet.

    The token is a UUID that permanently represents this Scout in all
    behavioral collections. It cannot be reverse-engineered to a user_id
    without access to the signal_tokens collection.
    """
    existing = await db.signal_tokens.find_one({"user_id": user_id})
    if existing:
        return existing["signal_token"]

    token = str(uuid.uuid4())
    await db.signal_tokens.insert_one({
        "user_id": user_id,
        "signal_token": token,
        "created_at": datetime.now(timezone.utc),
    })
    return token


async def resolve_signal_token(signal_token: str) -> str | None:
    """
    Resolves a signal token back to a user_id.
    Only used internally — never exposed via API.
    Returns None if the token is not found.
    """
    doc = await db.signal_tokens.find_one({"signal_token": signal_token})
    return doc["user_id"] if doc else None


async def rotate_signal_token(user_id: str) -> str:
    """
    Issues a new signal token for a user (e.g. on account deletion request).
    Historical records keyed to the old token become permanently unresolvable.
    """
    new_token = str(uuid.uuid4())
    await db.signal_tokens.update_one(
        {"user_id": user_id},
        {"$set": {
            "signal_token": new_token,
            "rotated_at": datetime.now(timezone.utc),
        }},
        upsert=True,
    )
    return new_token
