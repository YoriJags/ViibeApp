"""
Issue an API key to a ticketing partner, such as Hippie.

The key is shown once and only its hash is stored, so this script writes the
key to a file you choose instead of printing it. Send the file's contents to
the partner over a private channel, together with docs/PARTNER_API.md, then
delete the file.

Usage (from backend/):
    railway run python scripts/issue_partner_key.py "Hippie" <path-to-write-key>
    railway run python scripts/issue_partner_key.py --list
    railway run python scripts/issue_partner_key.py --revoke <partner_id>

Every event a partner sends waits for approval before it goes on the map.
To see and approve them, use GET /api/admin/partner-events and
POST /api/admin/partner-events/{id}/approve with {"review_version": n}.
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from fastapi import HTTPException  # noqa: E402

from app.config import db  # noqa: E402
from app.routes.partners import issue_partner, revoke_partner  # noqa: E402


async def main(argv: list[str]) -> None:
    if argv[:1] == ["--list"]:
        rows = await db.partners.find({}, {"_id": 0, "key_hash": 0}).to_list(500)
        for p in rows:
            events = await db.venues.count_documents({"partner_id": p["id"]})
            print(f"{p['id']}  {p['name']}  active={p['active']}  events={events}")
        return
    if argv[:1] == ["--revoke"] and len(argv) == 2:
        print(await revoke_partner(argv[1], user={"id": "script:issue_partner_key"}))
        return
    if len(argv) != 2:
        raise SystemExit(__doc__)

    name, out_path = argv
    if os.path.exists(out_path):
        raise SystemExit(f"{out_path} already exists; choose a new file so no key is overwritten")
    try:
        issued = await issue_partner(name, created_by="script:issue_partner_key")
    except HTTPException as e:
        raise SystemExit(e.detail)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(f"VIIBE partner: {issued['partner']['name']}\n")
        f.write(f"Partner id: {issued['partner']['id']}\n")
        f.write("Header: X-Viibe-Key\n")
        f.write(f"Key: {issued['api_key']}\n")
    print(f"Issued to {issued['partner']['name']} ({issued['partner']['id']}). Key written to {out_path}")


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1:]))
