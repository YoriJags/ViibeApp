# External Integrations

**Analysis Date:** 2026-03-13

## APIs & External Services

**Payment Processing:**
- Paystack - Nigerian payment processor for merchant wallet top-ups and Vibe+ subscriptions
  - SDK/Client: `httpx` (direct REST calls to `https://api.paystack.co`)
  - Auth: `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`
  - Implemented in: `backend/app/services/payments.py`, `backend/app/routes/merchant.py`, `backend/app/routes/subscriptions.py`
  - Operations: initialize transaction, verify webhook signature (HMAC-SHA512), resolve bank account, create transfer recipient, initiate transfer (coin cashout), fetch Nigerian bank list

**AI / LLM:**
- Anthropic Claude (claude-haiku-4-5-20251001) - Night Planner concierge
  - SDK/Client: `anthropic` Python package (version >=0.40.0)
  - Auth: `ANTHROPIC_API_KEY`
  - Implemented in: `backend/app/routes/planner.py` (lazy import inside function body)
  - Behaviour: auto-activates when `ANTHROPIC_API_KEY` is set; falls back to rule-based keyword scoring when absent or on error

**Maps:**
- Mapbox (via `@rnmapbox/maps` 10.2.10) - venue map display
  - Auth: `RNMapboxMapsDownloadToken` in `frontend/app.json` (plugin config)
  - Google Maps API also configured in `app.json` for iOS (`GOOGLE_MAPS_API_KEY_IOS`) and Android (`GOOGLE_MAPS_API_KEY_ANDROID`) as fallback / native map config

**Push Notifications:**
- Expo Push API - mobile push notifications to scouts and merchants
  - SDK/Client: `httpx` (direct POST to `https://exp.host/--/api/v2/push/send`)
  - Auth: No API key required; uses Expo push tokens registered via `expo-notifications`
  - Implemented in: `backend/app/services/notifications.py`
  - Triggers: lobby venue goes hot, streak expiring, crew check-in, aura shield alert, achievement unlocked, vibe spike, campaign active

**SMS:**
- Twilio - OTP delivery and scout/merchant alerts
  - SDK/Client: `httpx` (direct REST calls to `https://api.twilio.com/2010-04-01/...`, Basic Auth)
  - Auth: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`
  - Implemented in: `backend/app/services/sms.py`
  - Phone normalisation: Nigerian format `080xxxxxxxx` → `+23480xxxxxxxx`
  - Triggers: OTP, scout achievement, vibe spike alerts, merchant operational alerts

**Email:**
- SendGrid - transactional email for achievements and weekly digests
  - SDK/Client: `httpx` (direct POST to `https://api.sendgrid.com/v3/mail/send`)
  - Auth: `SENDGRID_API_KEY`
  - Implemented in: `backend/app/services/email.py`
  - Emails: achievement badge unlocked, weekly scout digest, merchant weekly intelligence report

## Data Storage

**Databases:**
- MongoDB Atlas (primary database)
  - Connection: `MONGO_URL` env var (SRV connection string)
  - Database name: `DB_NAME` (default: `vibe_app`)
  - Client: Motor 3.6.0 (`AsyncIOMotorClient`) — async driver
  - Config/init: `backend/app/config.py`
  - Index management: `ensure_indexes()` called on FastAPI startup
  - Key collections: `venues`, `users`, `ratings`, `user_sessions`, `merchant_wallets`, `wallet_transactions`, `pulse_drops`, `platform_revenue`, `pending_topups`, `pending_subscriptions`, `lobby`, `checkins`, `streaks`, `stories`, `vibe_snapshots`, `crews`, `crew_votes`, `alert_preferences`, `aura_shields`, `campaigns`, `venue_follows`, `venue_headings`, `venue_live_pushes`, `vibe_pulses`, `venue_emoji_pulses`, `rolling_deep_sessions`, `config`
  - TTL indexes on: `user_sessions` (7 days), `checkins`, `stories`, `vibe_snapshots` (72h), `campaigns`, `rolling_deep_sessions`, `venue_emoji_pulses`

**File Storage:**
- Local filesystem only (no cloud file storage detected; `expo-image-picker` is available for avatar images but no upload backend endpoint detected)

**Caching:**
- None external (in-memory only)
  - Rate limiter uses in-memory sliding window: `backend/app/middleware/rate_limit.py` (`RateLimitStore`)
  - Socket.IO kinetic quest state and vibe pulse state are in-memory dicts in `backend/app/services/realtime.py` (resets on server restart)

## Authentication & Identity

**Auth Provider:**
- Custom phone-based auth (no third-party identity provider)
  - Implementation: Phone number + username signup; session tokens stored in `user_sessions` MongoDB collection
  - Session: Bearer token passed as `Authorization: Bearer <token>` header or `session_token` cookie
  - Session TTL: 7 days (TTL index on `user_sessions.expires_at`)
  - Auth service: `backend/app/services/auth.py` (`get_current_user` used as dependency)
  - User model includes `auth_provider: 'local' | 'google' | 'apple'` field — Google and Apple login defined in schema but not yet implemented in backend routes

## Real-time Communication

**Socket.IO:**
- Server: `python-socketio` 5.11.4 AsyncServer (ASGI mode), wrapped around FastAPI app in `backend/server.py` as `socket_app`
- Client: `socket.io-client` 4.8.3 in `frontend/src/store/vibeStore.ts`
- Events emitted by server: `venue_update`, `leaderboard_update`, `venue_checkin_update`, `crew_vote_update`, `crew_checkin`, `campaign_update`, `reaction_pulse`, `city_pulse_update`, `kinetics_update`, `quest_succeeded`, `global_surge`, `global_charge_depletion`, `energy_critical`, `connection_status`
- Events received from client: `connect`, `disconnect`, `join_venue`, `join_city`, `subscribe_leaderboard`, `join_crew_room`, `tap_velocity`, `vibe_pulse`
- Rooms: `venue_{id}`, `city_{city}`, `leaderboard_{city}`, `crew_{id}`
- All rooms implemented in: `backend/app/services/realtime.py`

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry or similar detected)

**Logs:**
- Python standard `logging` module; `backend/app/config.py` configures INFO level with timestamp format
- Logger instance: `logger = logging.getLogger('vibe_app')` used throughout backend

## CI/CD & Deployment

**Hosting — Frontend:**
- Vercel (static web export)
  - Config: `frontend/vercel.json`
  - Build: `npm install && npm run build` (expo export -p web)
  - Output: `frontend/dist/`
  - Rewrites: all `/api/*` requests proxied to Railway backend

**Hosting — Backend:**
- Railway (Docker container)
  - Config: `railway.toml` (builder=DOCKERFILE, restart on failure, max 3 retries)
  - Container: `Dockerfile` at repo root (python:3.11-slim base)
  - Start command: `uvicorn server:socket_app --host 0.0.0.0 --port $PORT`

**CI Pipeline:**
- None configured (no GitHub Actions, no CI yaml files detected)
- Every git push to main triggers Railway auto-deploy

## Environment Configuration

**Required env vars — Backend:**
- `MONGO_URL` - MongoDB Atlas SRV connection string
- `DB_NAME` - MongoDB database (default: `vibe_app`)
- `PAYSTACK_SECRET_KEY` - Paystack secret key
- `PAYSTACK_PUBLIC_KEY` - Paystack public key
- `ANTHROPIC_API_KEY` - Claude AI (optional; activates AI planner when set)
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` - SMS (optional; SMS silently skipped if absent)
- `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL` - Email (optional; email silently skipped if absent)
- `ENVIRONMENT` - Set to `production` to disable seed routes

**Required env vars — Frontend:**
- `EXPO_PUBLIC_BACKEND_URL` - Backend base URL (used in `vibeStore.ts` for API calls and Socket.IO connection)

**Secrets location:**
- `.env` file at `backend/` root (loaded via `python-dotenv` in `backend/app/config.py`)
- Vercel project environment variables (frontend build + runtime)
- Railway project environment variables (backend runtime)

## Webhooks & Callbacks

**Incoming:**
- `POST /api/webhook/paystack` — Paystack `charge.success` event
  - Handler: `backend/app/routes/webhooks.py`
  - Verification: HMAC-SHA512 signature check via `x-paystack-signature` header
  - Routes: `VIBE-TOPUP-*` references → wallet top-up, `VIBE-PLUS-*` references → Vibe+ subscription activation
  - Rate limited: 30 requests/min per IP

**Outgoing:**
- Paystack API calls (initialize transaction, transfer, bank resolve) — from `backend/app/services/payments.py` and `backend/app/routes/merchant.py`
- Expo Push API — from `backend/app/services/notifications.py`
- Twilio Messages API — from `backend/app/services/sms.py`
- SendGrid Mail API — from `backend/app/services/email.py`
- Anthropic Messages API — from `backend/app/routes/planner.py`

---

*Integration audit: 2026-03-13*
