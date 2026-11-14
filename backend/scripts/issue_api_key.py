"""
Issue an intelligence API key to a buyer (a venue group, a brand, the state).

The key is shown once and only its hash is stored, so this script writes the
key to a file you choose instead of printing it. Send the file's contents to
the buyer over a private channel, together with docs/INTELLIGENCE_API.md, then
delete the file.

Usage (from backend/):
    railway run python scripts/issue_api_key.py "Buyer name" starter <path-to-write-key>
    railway run python scripts/issue_api_key.py --list
    railway run python scripts/issue_api_key.py --usage <key_id>
    railway run python scripts/issue_api_key.py --revoke <key_id>

Tiers: starter, growth, enterprise. They set request limits only; the price is
whatever the contract says.
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from fastapi import HTTPException  # noqa: E402

from app.services import api_access  # noqa: E402


async def main(argv: list[str]) -> None:
    if argv[:1] == ["--list"]:
        for k in await api_access.list_keys():
            print(f"{k['id']}  {k['name']}  tier={k['tier']}  active={k['active']}  today={k['requests_today']}")
        return
    if argv[:1] == ["--usage"] and len(argv) == 2:
        u = await api_access.usage(argv[1], 30)
        print(f"total over {u['days']} days: {u['total']}")
        for row in u["by_day"]:
            print(f"  {row['day']}  {row['count']}")
        return
    if argv[:1] == ["--revoke"] and len(argv) == 2:
        try:
            print(await api_access.revoke_key(argv[1]))
        except HTTPException as e:
            raise SystemExit(e.detail)
        return
    if len(argv) != 3:
        raise SystemExit(__doc__)

    name, tier, out_path = argv
    if os.path.exists(out_path):
        raise SystemExit(f"{out_path} already exists; choose a new file so no key is overwritten")
    try:
        issued = await api_access.issue_key(name, tier, created_by="script:issue_api_key")
    except HTTPException as e:
        raise SystemExit(e.detail)
    limits = api_access.TIERS[tier]
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(f"VIIBE intelligence API: {issued['key']['name']}\n")
        f.write(f"Key id: {issued['key']['id']}\n")
        f.write(f"Tier: {tier} ({limits['per_minute']} requests a minute, {limits['per_day']} a day)\n")
        f.write("Header: X-API-Key\n")
        f.write(f"Key: {issued['api_key']}\n")
    print(f"Issued to {issued['key']['name']} ({issued['key']['id']}). Key written to {out_path}")


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1:]))
