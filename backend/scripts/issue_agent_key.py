#!/usr/bin/env python
"""
Bootstrap: issue a VIIBE Agent API key directly in MongoDB.

The POST /api/v1/agent/keys endpoint requires a super-admin user token, which
is a chicken-and-egg problem for the very first key. This script is the
bootstrap path: run it once with the backend's MONGO_URL in the environment to
mint a key — e.g. for registering VIIBE as a ChatGPT Action or Claude MCP tool.

It writes the same record shape as the API endpoint (collection: agent_api_keys),
so keys issued here are indistinguishable from keys issued via the dashboard.

Usage (from the repo root, with the backend env available):

    # Production (recommended) — injects Railway env vars, incl. MONGO_URL:
    railway run python backend/scripts/issue_agent_key.py "ChatGPT Actions"

    # Or set MONGO_URL yourself:
    MONGO_URL="<atlas-uri>" python backend/scripts/issue_agent_key.py "Claude MCP" --partner Anthropic --rate-limit 120

Reads MONGO_URL (or MONGODB_URI) and DB_NAME from the environment; also loads
backend/.env if present. Prints the key and a ready-to-paste curl test.
"""
import os
import sys
import argparse
import secrets
from datetime import datetime, timezone
from pathlib import Path

# Load backend/.env if present (mirrors app/config.py).
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except Exception:
    pass

from pymongo import MongoClient

COLLECTION = "agent_api_keys"
LIVE_BASE = "https://vibeapp-production-1835.up.railway.app"


def main() -> None:
    ap = argparse.ArgumentParser(description="Issue a VIIBE Agent API key.")
    ap.add_argument("label", help='Human label, e.g. "ChatGPT Actions"')
    ap.add_argument("--partner", default=None, help="Company / org name")
    ap.add_argument("--rate-limit", type=int, default=60, help="Requests per minute (default 60)")
    ap.add_argument("--notes", default=None)
    args = ap.parse_args()

    mongo_url = os.environ.get("MONGO_URL") or os.environ.get("MONGODB_URI")
    if not mongo_url:
        sys.exit(
            "MONGO_URL is not set.\n"
            "Run with the backend environment, e.g.:\n"
            "  railway run python backend/scripts/issue_agent_key.py \"ChatGPT Actions\""
        )
    db_name = os.environ.get("DB_NAME", "vibe_app")

    key = "viibe_" + secrets.token_urlsafe(32)
    record = {
        "key":           key,
        "label":         args.label,
        "partner":       args.partner,
        "rate_limit":    args.rate_limit,
        "notes":         args.notes,
        "active":        True,
        "request_count": 0,
        "created_at":    datetime.now(timezone.utc).isoformat(),
        "last_used_at":  None,
    }

    client = MongoClient(mongo_url, serverSelectionTimeoutMS=10_000)
    client[db_name][COLLECTION].insert_one(dict(record))

    print("\n  Agent API key issued\n")
    print(f"    {key}\n")
    print(f"    label: {args.label}   partner: {args.partner}   rate_limit: {args.rate_limit}/min")
    print("\n  Test it:\n")
    print(f'    curl -H "X-Agent-Key: {key}" "{LIVE_BASE}/api/v1/agent/city/pulse?city=lagos"\n')
    print("  Keep it secret. Revoke from the dashboard or with DELETE /api/v1/agent/keys/{key}.\n")


if __name__ == "__main__":
    main()
