"""
VIIBE MCP server — exposes the Agent API as Claude tools.

Run locally or on a host, then register in Claude Desktop (see README.md). It
proxies the three public VIIBE Agent endpoints as MCP tools so Claude can answer
"where's the energy in Lagos right now?" with live, decay-honest data.

Env:
  VIIBE_API_BASE   default https://vibeapp-production-1835.up.railway.app
  VIIBE_AGENT_KEY  the X-Agent-Key issued by VIIBE (POST /api/v1/agent/keys)

Deps:  pip install -r requirements.txt   (mcp, httpx)
"""
import os

import httpx
from mcp.server.fastmcp import FastMCP

API_BASE = os.environ.get("VIIBE_API_BASE", "https://vibeapp-production-1835.up.railway.app").rstrip("/")
AGENT_KEY = os.environ.get("VIIBE_AGENT_KEY", "")

mcp = FastMCP("viibe")


async def _get(path: str, params: dict) -> dict:
    headers = {"X-Agent-Key": AGENT_KEY} if AGENT_KEY else {}
    clean = {k: v for k, v in params.items() if v is not None}
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.get(f"{API_BASE}{path}", params=clean, headers=headers)
        r.raise_for_status()
        return r.json()


@mcp.tool()
async def venues_live(city: str | None = None, category: str | None = None,
                      min_score: float = 0, limit: int = 10) -> dict:
    """Top venues by live crowd energy right now, ranked high→low.

    Use for "where's the best energy/scene in <city> right now?". `category`
    filters venue type (club/lounge/concert). Results are real-time (<=5 min)
    and decay-honest: an empty/low result means the scene really is quiet.
    """
    return await _get("/api/v1/agent/venues/live",
                      {"city": city, "category": category, "min_score": min_score, "limit": limit})


@mcp.tool()
async def venue_snapshot(venue_id: str) -> dict:
    """Live energy snapshot for one specific venue by id."""
    return await _get(f"/api/v1/agent/venues/{venue_id}", {})


@mcp.tool()
async def city_pulse(city: str | None = None) -> dict:
    """City-level energy summary — how alive a city is right now, with top venues."""
    return await _get("/api/v1/agent/city/pulse", {"city": city})


if __name__ == "__main__":
    mcp.run()
