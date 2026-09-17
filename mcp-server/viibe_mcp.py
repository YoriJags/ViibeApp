"""
VIIBE MCP Server — Claude queries live Lagos energy.

Exposes the production VIIBE Agent API as MCP tools so any MCP client
(Claude Desktop, Claude Code, etc.) can answer "where is alive right now?"
from the real signal.

Setup:
    pip install "mcp[cli]" httpx
    set VIIBE_AGENT_KEY=<key from backend/scripts/issue_agent_key.py>

Claude Desktop config (claude_desktop_config.json):
    {
      "mcpServers": {
        "viibe": {
          "command": "python",
          "args": ["<repo>/mcp-server/viibe_mcp.py"],
          "env": { "VIIBE_AGENT_KEY": "viibe_..." }
        }
      }
    }

Claude Code:  claude mcp add viibe -e VIIBE_AGENT_KEY=viibe_... -- python mcp-server/viibe_mcp.py
"""
import os

import httpx
from mcp.server.fastmcp import FastMCP

BASE = os.environ.get("VIIBE_API_BASE", "https://vibeapp-production-1835.up.railway.app")
KEY = os.environ.get("VIIBE_AGENT_KEY", "")

mcp = FastMCP(
    "viibe",
    instructions=(
        "VIIBE is a live human-energy intel layer for Lagos nightlife. "
        "Signals are scout-confirmed, geofence-verified, and decay in minutes — "
        "a quiet reading means the city is actually quiet right now, never guess past it."
    ),
)


def _get(path: str, params: dict | None = None) -> dict:
    if not KEY:
        return {"error": "VIIBE_AGENT_KEY not set. Issue one with backend/scripts/issue_agent_key.py"}
    r = httpx.get(
        f"{BASE}/api/v1/agent{path}",
        params=params or {},
        headers={"X-Agent-Key": KEY},
        timeout=20,
    )
    r.raise_for_status()
    return r.json()


@mcp.tool()
def city_energy(city: str = "lagos") -> dict:
    """Live city-wide energy reading: city_energy (0-100), city_label
    (LOW->PEAK), venue_tiers breakdown, top_venues, active_scouts. The headline
    'is the city alive right now' number."""
    return _get("/city/energy", {"city": city})


@mcp.tool()
def live_venues(city: str = "lagos", min_score: int = 0, limit: int = 10) -> dict:
    """Venues ranked by live energy. Each entry: name, energy_score (0-100),
    energy_label, active_scouts, is_surging, music_genre, consensus fields.
    Use min_score=60 for 'where is actually popping'."""
    return _get("/venues/live", {"city": city, "min_score": min_score, "limit": limit})


@mcp.tool()
def venue_detail(venue_id: str) -> dict:
    """Deep live read on one venue: score, energy/capacity/gate levels, velocity
    (heating_up/cooling_down), scout consensus, oracle 15-min forecast."""
    return _get(f"/venues/{venue_id}")


if __name__ == "__main__":
    mcp.run()
