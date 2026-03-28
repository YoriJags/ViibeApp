"""
Migration: Backfill signal_token into existing behavioral collections.

Run once after deploying signal_identity.py.

Collections updated:
  - kinetic_readings: user_id -> signal_token (field replaced)
  - ratings: signal_token added alongside user_id
  - events: user_id -> signal_token (field replaced)

Usage:
    cd backend
    python -m scripts.migrate_signal_tokens
"""

import asyncio
import uuid
from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorClient
from app.config import MONGO_URL, DB_NAME


async def run():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    print("Building user_id -> signal_token map from existing users...")

    # Build token map for all known users
    token_map: dict[str, str] = {}
    async for doc in db.signal_tokens.find({}):
        token_map[doc["user_id"]] = doc["signal_token"]

    # Mint tokens for any user_id found in behavioral collections not yet mapped
    async def ensure_token(user_id: str) -> str:
        if user_id in token_map:
            return token_map[user_id]
        token = str(uuid.uuid4())
        await db.signal_tokens.update_one(
            {"user_id": user_id},
            {"$setOnInsert": {
                "user_id": user_id,
                "signal_token": token,
                "created_at": datetime.now(timezone.utc),
            }},
            upsert=True,
        )
        token_map[user_id] = token
        return token

    # ── kinetic_readings ──────────────────────────────────────────────────────
    print("Migrating kinetic_readings...")
    count = 0
    async for doc in db.kinetic_readings.find({"user_id": {"$exists": True}, "signal_token": {"$exists": False}}):
        token = await ensure_token(doc["user_id"])
        await db.kinetic_readings.update_one(
            {"_id": doc["_id"]},
            {
                "$set":   {"signal_token": token},
                "$unset": {"user_id": ""},
            },
        )
        count += 1
    print(f"  kinetic_readings: {count} docs migrated")

    # ── ratings ───────────────────────────────────────────────────────────────
    print("Migrating ratings (adding signal_token, keeping user_id for ops)...")
    count = 0
    async for doc in db.ratings.find({"user_id": {"$exists": True}, "signal_token": {"$exists": False}}):
        token = await ensure_token(doc["user_id"])
        await db.ratings.update_one(
            {"_id": doc["_id"]},
            {"$set": {"signal_token": token}},
        )
        count += 1
    print(f"  ratings: {count} docs updated")

    # ── events ────────────────────────────────────────────────────────────────
    print("Migrating events...")
    count = 0
    async for doc in db.events.find({"user_id": {"$exists": True}, "signal_token": {"$exists": False}}):
        token = await ensure_token(doc["user_id"])
        await db.events.update_one(
            {"_id": doc["_id"]},
            {
                "$set":   {"signal_token": token},
                "$unset": {"user_id": ""},
            },
        )
        count += 1
    print(f"  events: {count} docs updated")

    print("\nDone. signal_tokens collection now has", await db.signal_tokens.count_documents({}), "entries.")
    client.close()


if __name__ == "__main__":
    asyncio.run(run())
