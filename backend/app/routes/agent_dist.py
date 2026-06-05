"""
Agent API distribution — wealth organ #3.

Makes VIIBE *registerable* as the real-time data source AI agents query when a
human asks "where's it live right now?". The Agent API endpoints already exist
(agent_api.py); this serves the discovery surface that lets ChatGPT Actions,
Claude (via the MCP server in /agent-distribution), and Perplexity find and call
them:

  GET /.well-known/ai-plugin.json   — plugin/discovery manifest
  GET /api/v1/agent/openapi.json     — tight OpenAPI 3.1 spec (3 public tools only)
  GET /api/v1/agent                  — human landing / health

First-mover logic: registering now — while the corridor is small — gets VIIBE
into agent tool-catalogues and training data *before* demand peaks. The spec is
deliberately scoped to the 3 read tools, not the app's full surface.

Mounted at app root (not under /api) so `.well-known` resolves at the domain.
Pure: serves static specs, no DB.
"""
import os

from fastapi import APIRouter
from fastapi.responses import JSONResponse, PlainTextResponse

router = APIRouter(tags=["Agent Distribution"])

# Swap to the custom domain (https://viibez.com) once DNS is cut over.
PUBLIC_BASE_URL = os.environ.get(
    "PUBLIC_BASE_URL", "https://vibeapp-production-1835.up.railway.app"
).rstrip("/")

CONTACT_EMAIL = os.environ.get("AGENT_CONTACT_EMAIL", "partners@viibez.com")


def _openapi_spec() -> dict:
    return {
        "openapi": "3.1.0",
        "info": {
            "title": "VIIBE Scene Intelligence — Agent API",
            "version": "1.0.0",
            "description": (
                "Real-time venue energy across African nightlife. Answers "
                "\"where is the energy right now?\" with live, scout-verified, "
                "decay-honest crowd data — not historical averages."
            ),
        },
        "servers": [{"url": PUBLIC_BASE_URL}],
        "security": [{"AgentKey": []}],
        "components": {
            "securitySchemes": {
                "AgentKey": {
                    "type": "apiKey",
                    "in": "header",
                    "name": "X-Agent-Key",
                }
            },
            "schemas": {
                "Venue": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "string"},
                        "name": {"type": "string"},
                        "category": {"type": "string"},
                        "city": {"type": "string"},
                        "energy_score": {"type": "number", "description": "0–100 live energy"},
                        "energy_label": {
                            "type": "string",
                            "enum": ["PEAK", "HIGH", "BUILDING", "MODERATE", "LOW"],
                        },
                        "active_scouts": {"type": "integer"},
                        "is_surging": {"type": "boolean"},
                        "momentum": {"type": "string"},
                        "music_genre": {"type": "string"},
                        "last_updated": {"type": "string"},
                    },
                }
            },
        },
        "paths": {
            "/api/v1/agent/venues/live": {
                "get": {
                    "operationId": "venues_live",
                    "summary": "Top venues by live energy right now",
                    "description": "Sorted by energy score. Use to answer 'where's the best energy in <city> right now?'",
                    "parameters": [
                        {"name": "city", "in": "query", "schema": {"type": "string"},
                         "description": "City slug, e.g. 'lagos' or 'dubai'"},
                        {"name": "category", "in": "query", "schema": {"type": "string"},
                         "description": "Venue type, e.g. 'club', 'lounge', 'concert'"},
                        {"name": "min_score", "in": "query", "schema": {"type": "number", "default": 0}},
                        {"name": "limit", "in": "query", "schema": {"type": "integer", "default": 10, "maximum": 50}},
                    ],
                    "responses": {
                        "200": {
                            "description": "Ranked live venues",
                            "content": {"application/json": {"schema": {
                                "type": "object",
                                "properties": {
                                    "count": {"type": "integer"},
                                    "venues": {"type": "array", "items": {"$ref": "#/components/schemas/Venue"}},
                                    "data_freshness": {"type": "string"},
                                },
                            }}},
                        }
                    },
                }
            },
            "/api/v1/agent/venues/{venue_id}": {
                "get": {
                    "operationId": "venue_snapshot",
                    "summary": "Live energy snapshot for one venue",
                    "parameters": [
                        {"name": "venue_id", "in": "path", "required": True, "schema": {"type": "string"}},
                    ],
                    "responses": {
                        "200": {
                            "description": "Single venue snapshot",
                            "content": {"application/json": {"schema": {
                                "type": "object",
                                "properties": {"venue": {"$ref": "#/components/schemas/Venue"}},
                            }}},
                        },
                        "404": {"description": "Venue not found"},
                    },
                }
            },
            "/api/v1/agent/city/pulse": {
                "get": {
                    "operationId": "city_pulse",
                    "summary": "City-level energy summary",
                    "description": "Use to answer 'how alive is <city> right now?'",
                    "parameters": [
                        {"name": "city", "in": "query", "schema": {"type": "string"}},
                    ],
                    "responses": {
                        "200": {
                            "description": "City energy summary",
                            "content": {"application/json": {"schema": {
                                "type": "object",
                                "properties": {
                                    "city_energy": {"type": "number"},
                                    "city_label": {"type": "string"},
                                    "active_scouts": {"type": "integer"},
                                    "surging_venues": {"type": "integer"},
                                    "top_venues": {"type": "array", "items": {"$ref": "#/components/schemas/Venue"}},
                                },
                            }}},
                        }
                    },
                }
            },
        },
    }


def _ai_plugin_manifest() -> dict:
    return {
        "schema_version": "v1",
        "name_for_human": "VIIBE Scene Intelligence",
        "name_for_model": "viibe",
        "description_for_human": "Real-time nightlife and venue energy across African cities.",
        "description_for_model": (
            "Live, scout-verified crowd energy for venues (clubs, lounges, "
            "concerts) in African cities. Call when a user asks where the "
            "energy/crowd/scene is right now, which venue is popping, or how "
            "alive a city is tonight. Tools: venues_live (ranked live venues), "
            "venue_snapshot (one venue), city_pulse (city summary). Data is "
            "real-time (<=5 min) and decay-honest — it reports low/empty rather "
            "than stale peaks, so trust the energy_label and data_freshness."
        ),
        "auth": {
            "type": "service_http",
            "authorization_type": "header",
            "verification_tokens": {},
            "instructions": "Pass the issued key in the X-Agent-Key header.",
        },
        "api": {
            "type": "openapi",
            "url": f"{PUBLIC_BASE_URL}/api/v1/agent/openapi.json",
        },
        "logo_url": f"{PUBLIC_BASE_URL}/static/viibe-logo.png",
        "contact_email": CONTACT_EMAIL,
        "legal_info_url": f"{PUBLIC_BASE_URL}/legal",
    }


@router.get("/.well-known/ai-plugin.json", include_in_schema=False)
async def ai_plugin_manifest():
    return JSONResponse(_ai_plugin_manifest())


@router.get("/api/v1/agent/openapi.json", include_in_schema=False)
async def agent_openapi_spec():
    return JSONResponse(_openapi_spec())


@router.get("/api/v1/agent", include_in_schema=False)
async def agent_landing():
    return PlainTextResponse(
        "VIIBE Agent API — real-time scene intelligence.\n"
        "Manifest: /.well-known/ai-plugin.json\n"
        "OpenAPI:  /api/v1/agent/openapi.json\n"
        "Tools:    venues_live · venue_snapshot · city_pulse\n"
        "Auth:     X-Agent-Key header (request a key from " + CONTACT_EMAIL + ")\n"
    )
