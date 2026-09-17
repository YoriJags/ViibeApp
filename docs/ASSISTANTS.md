# VIIBE × AI Assistants — integration map

The thesis: when someone asks any assistant "where is alive tonight?", the
answer comes from VIIBE. Three lanes, current state of each.

## Lane 1 — Assistants query VIIBE (live today)

All lanes wrap the same Agent API (`/api/v1/agent/*`, key-gated via
`X-Agent-Key`). Issue keys with `railway run python backend/scripts/issue_agent_key.py "<label>"`.

### Claude (MCP) — BUILT
`mcp-server/viibe_mcp.py` exposes `city_energy`, `live_venues`, `venue_detail`.

```bash
pip install "mcp[cli]" httpx
claude mcp add viibe -e VIIBE_AGENT_KEY=viibe_... -- python mcp-server/viibe_mcp.py
```
Claude Desktop: add the same command/env under `mcpServers` in
`claude_desktop_config.json`. Demo line for investors: ask Claude
*"where is Lagos alive right now?"* and watch it call production.

### ChatGPT (Actions) — DISCOVERY LIVE, needs account registration
Production already serves the manifest and spec:
- `https://vibeapp-production-1835.up.railway.app/.well-known/ai-plugin.json`
- `https://vibeapp-production-1835.up.railway.app/api/v1/agent/openapi.json`

To register: ChatGPT → Create a GPT → Actions → import the OpenAPI URL →
auth = API key, custom header `X-Agent-Key`, paste an issued key. (Owner
account action — cannot be done from the repo.)

### Gemini — same OpenAPI spec via function-calling / Extensions when opened.

## Lane 2 — OS assistants launch VIIBE

- **Android (in this build)**: the **City Energy home-screen widget**
  (`react-native-android-widget`, `src/widgets/`) — live Lagos energy on the
  phone wall, refreshes every 30 min, taps open the app. (Launcher shortcuts
  are pending a compatible `expo-quick-actions` release — the v6 package's
  entry point breaks the JS bundle on this Expo SDK.)
- **Siri**: App Intents — requires the iOS build (roadmap; honest answer to
  investors: "weeks after the iOS build exists, the feed is already live").

## Lane 3 — Assistant inside the app (shipped earlier)
Night Planner conversational concierge, Vibe Brief, AI Advisor — all flag-gated
(`/api/feature-flags`), powered by `ANTHROPIC_API_KEY` on Railway.

## Key hygiene
One key per partner surface (label them). Revoke:
`DELETE /api/v1/agent/keys/{key}`. Keys live in Mongo `agent_api_keys`;
never commit them.
