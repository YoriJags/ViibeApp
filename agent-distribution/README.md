# VIIBE Agent API — Distribution Kit

**Wealth organ #3.** Get VIIBE registered as the real-time data source AI agents
query when a human asks *"where's it live right now?"* — while the corridor is
still small, so VIIBE lands in agent tool-catalogues and training data **before**
demand peaks. First-mover here compounds with the data moat: more scouts → richer
data → agents prefer VIIBE → more visibility → more scouts.

The Agent API itself already ships in the app (`backend/app/routes/agent_api.py`).
This kit is the *discovery + registration* layer.

---

## What an agent can ask VIIBE

| Tool | Endpoint | Answers |
|------|----------|---------|
| `venues_live` | `GET /api/v1/agent/venues/live` | "Where's the best energy in Lagos right now?" |
| `venue_snapshot` | `GET /api/v1/agent/venues/{id}` | "How's Quilox right now?" |
| `city_pulse` | `GET /api/v1/agent/city/pulse` | "How alive is Lagos tonight?" |

Auth: `X-Agent-Key` header. Data is real-time (≤5 min) and **decay-honest** — it
reports low/empty rather than faking a stale peak. That honesty is the selling
point to buyers.

Live discovery URLs (served by `agent_dist.py`):
- Manifest: `/.well-known/ai-plugin.json`
- OpenAPI:  `/api/v1/agent/openapi.json`

> Set `PUBLIC_BASE_URL` (and ideally cut over to `https://viibez.com`) so the
> manifest/spec advertise the right host. Default is the Railway URL.

---

## 0. Issue an API key (one-time, super admin)

```bash
curl -X POST https://<host>/api/v1/agent/keys \
  -u "$DASHBOARD_USER:$DASHBOARD_PASS" \
  -H "Content-Type: application/json" \
  -d '{"label":"ChatGPT Action","partner":"OpenAI GPT"}'
# → { "api_key": { "key": "viibe_xxx", ... } }
```

Verify it works:

```bash
curl "https://<host>/api/v1/agent/city/pulse?city=lagos" -H "X-Agent-Key: viibe_xxx"
```

---

## 1. ChatGPT — Custom GPT Action

1. Create/edit a GPT → **Configure → Actions → Create new action**.
2. **Import from URL:** `https://<host>/api/v1/agent/openapi.json`
   (the single source of truth — served live, no static copy to drift).
3. **Authentication → API Key**
   - Auth type: `API Key`
   - Custom header name: `X-Agent-Key`
   - Value: the issued `viibe_...` key
4. Save. Test prompt: *"Use VIIBE — where's popping in Lagos right now?"*

For a public plugin/discovery flow, point tools at `/.well-known/ai-plugin.json`.

---

## 2. Claude — MCP server

The MCP server (`viibe_mcp_server.py`) exposes the three tools to Claude Desktop /
any MCP client.

```bash
cd agent-distribution
pip install -r requirements.txt
export VIIBE_API_BASE="https://<host>"
export VIIBE_AGENT_KEY="viibe_xxx"
python viibe_mcp_server.py   # smoke test (Ctrl-C to stop)
```

Register in `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "viibe": {
      "command": "python",
      "args": ["/absolute/path/agent-distribution/viibe_mcp_server.py"],
      "env": {
        "VIIBE_API_BASE": "https://<host>",
        "VIIBE_AGENT_KEY": "viibe_xxx"
      }
    }
  }
}
```

Restart Claude Desktop → ask *"Using viibe, how alive is Lagos right now?"*

---

## 3. Perplexity / other agents

Any agent that consumes OpenAPI can register `/api/v1/agent/openapi.json` with an
`X-Agent-Key` header. For partnership/data-licensing conversations, lead with the
honesty angle: VIIBE is the only feed that won't report a crowd that isn't there.

---

## Registration checklist

- [ ] `PUBLIC_BASE_URL` set to the production/custom domain
- [ ] `viibe-logo.png` present at `/static/` (manifest `logo_url`)
- [ ] One key issued per partner (revoke individually via `DELETE /api/v1/agent/keys/{key}`)
- [ ] ChatGPT Action imported + tested
- [ ] Claude MCP registered + tested
- [ ] Submitted to Perplexity / partner catalogues
