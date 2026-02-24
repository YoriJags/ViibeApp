# External Integrations

**Analysis Date:** 2026-02-24

## APIs & External Services

**Payment Processing:**
- Paystack - Nigerian payment processor for wallet top-ups and Pulse Drop purchases
  - SDK/Client: Direct HTTPS calls (no official SDK, custom integration)
  - Auth: PAYSTACK_SECRET_KEY (webhook verification), PAYSTACK_PUBLIC_KEY (frontend)
  - Implementation: `backend/app/services/payments.py` - HMAC-SHA512 signature verification
  - Webhook endpoint: `POST /api/webhooks/paystack` in `backend/app/routes/webhooks.py`

**AI/LLM:**
- Claude API (Anthropic) - Night Planner feature for venue recommendations
  - SDK/Client: anthropic>=0.40.0 Python package
  - Auth: ANTHROPIC_API_KEY environment variable
  - Implementation: `backend/api/index.py` lines 713-759 (conditional activation)
  - Fallback: Rule-based keyword scoring if API key not set
  - Note: Import happens inside function body to avoid cold-start errors on Vercel

**Mapping & Location:**
- Google Maps - Direction links and native maps integration
  - SDK/Client: expo-location (native), deep links to Google Maps app
  - Auth: GOOGLE_MAPS_API_KEY_IOS, GOOGLE_MAPS_API_KEY_ANDROID (in app.json)
  - Frontend implementation: `frontend/app/venue/[id].tsx` - Google Maps direction URLs
  - Usage: Platform-specific: deep links on native, web fallback to google.com/maps URLs

## Data Storage

**Databases:**

*MongoDB Atlas:*
- Provider: MongoDB Atlas cloud
- Connection: MONGO_URL environment variable
- Client (Frontend/SSE): pymongo 4.9.2 (sync via BaseHTTPRequestHandler on Vercel)
- Client (Backend/Railway): Motor 3.6.0 (async via AsyncIOMotorClient)
- Database name: vibe_app (configurable via DB_NAME env var)
- Seeded data: 10 Lagos venues for demo
- Collections:
  - users, user_sessions - Authentication & user profiles
  - venues - Venue data with scores and metadata
  - ratings - Vibe check ratings (indexed for time-windowed queries)
  - checkins, streaks - User engagement tracking
  - crews, crew_votes - Squad/crew functionality
  - merchant_wallets, wallet_transactions, pending_topups - Payment tracking
  - pulse_drops - Marketing boost purchases and history
  - campaigns - Venue campaigns (active/expired with TTL)
  - stories - Venue stories (TTL 72h auto-expiry)
  - vibe_snapshots - Timeline data (TTL 72h)
  - certifications - Vibe-certified venue tracking
  - alert_preferences, aura_shields - User preferences
  - platform_revenue - Analytics ledger
  - config - App configuration

**File Storage:**
- Local filesystem only (no S3/cloud storage)
- Frontend: AsyncStorage for persistent client state
- Backend: No persistent file uploads (demo data only)

**Caching:**
- None configured - Direct MongoDB queries
- Future: Could add Redis for rate limiting or session caching

## Authentication & Identity

**Auth Provider:**
- Custom phone-based authentication (no OAuth providers currently)
- Implementation: `backend/app/routes/auth.py`
- Flow: Phone number → verification token → session token
- Session storage: user_sessions collection in MongoDB
- Frontend session management: Zustand store with AsyncStorage persistence
- Auth header: `Authorization: Bearer {session_token}`
- Session TTL: 7 days (SESSION_EXPIRY_DAYS in `backend/app/config.py`)

**Roles:**
- Scout (public user) - Regular venue raters
- Merchant - Venue owner, can purchase Pulse Drops, manage wallet
- Admin / Super Admin - Platform management, user moderation
- Status tiers: newbie, regular, scout, elite (based on clout_points)

## Monitoring & Observability

**Error Tracking:**
- None detected - No Sentry, Rollbar, or similar

**Logs:**
- Backend: Python logging (basicConfig in `backend/app/config.py`)
- Frontend: console logging
- Deployment: Railway logs (accessible via Railway dashboard)

## CI/CD & Deployment

**Hosting:**

*Frontend:*
- Platform: Vercel
- Build command: `yarn build` (runs `expo export -p web`)
- Output: `dist/` directory (static SPA)
- Configuration: `frontend/vercel.json`
- Live URL: https://vibe-app-hc83.vercel.app

*Backend:*
- Platform: Railway
- Builder: NIXPACKS (auto-detects Python)
- Start command: `cd backend && uvicorn server:socket_app --host 0.0.0.0 --port $PORT`
- Configuration: `railway.toml` + `nixpacks.toml`
- Live URL: https://vibeapp-production.up.railway.app

*Vercel Serverless Option:*
- Alternative entry: `backend/api/index.py` (BaseHTTPRequestHandler)
- Configuration: `backend/vercel.json`
- Note: SEPARATE from Railway deployment - kept in sync manually

**CI Pipeline:**
- None detected - Manual push to git triggers Railway/Vercel rebuilds

## Environment Configuration

**Frontend Environment Variables:**
- EXPO_PUBLIC_BACKEND_URL - API base URL (set in .env, accessible via process.env.EXPO_PUBLIC_BACKEND_URL)
- GOOGLE_MAPS_API_KEY_IOS / GOOGLE_MAPS_API_KEY_ANDROID - Placeholders in app.json

**Backend Environment Variables:**
- MONGO_URL - MongoDB Atlas connection string
- DB_NAME - Database name (default: vibe_app)
- PAYSTACK_SECRET_KEY - Webhook signature verification
- PAYSTACK_PUBLIC_KEY - Frontend payment initialization
- ANTHROPIC_API_KEY - Claude API access (optional, enables Night Planner)
- ENVIRONMENT - development/production flag
- PORT - Railway-provided port (default: 8000)

**Secrets location:**
- Frontend: `.env` file (not committed, listed in .gitignore)
- Backend: `.env` file in backend/ (not committed)
- Production: Vercel/Railway environment variable settings (web dashboard)

## Webhooks & Callbacks

**Incoming:**
- Paystack: `POST /api/webhooks/paystack` - Payment verification and wallet updates
  - Triggers: charge.success, charge.failed
  - Payload verification: HMAC-SHA512 signature check

**Outgoing:**
- None detected - App receives data only

## Real-time Communication

**Socket.IO:**
- Protocol: WebSocket with fallback transports
- Frontend client: socket.io-client 4.8.3
- Backend server: python-socketio 5.11.4 (async mode)
- Config: `backend/app/config.py` - AsyncServer with CORS allowed
- Event handlers: `backend/app/services/realtime.py`
- Purpose:
  - Venue live score updates
  - Leaderboard broadcasts
  - Pulse Drop notifications
  - Crew location sharing

## Rate Limiting

**Implementation:**
- Custom middleware: `backend/app/middleware/rate_limit.py`
- Integrated into FastAPI app in `backend/server.py`

## Database Indexing Strategy

**Key indices (from `backend/app/config.py` ensure_indexes):*
- ratings: (user_id, venue_id, timestamp) - Most queried
- venues: (city, current_vibe_score) - Leaderboard, (city, area) - Districts
- users: (id, phone, username) unique + (clout_points) for sorting
- user_sessions: (session_token) unique, (expires_at) TTL index
- pulse_drops: (venue_id, created_at), (created_at) for ledger
- campaigns: Unique active per venue (partial index), TTL on expires_at
- stories: TTL 72h on expires_at
- vibe_snapshots: TTL 72h on expires_at

---

*Integration audit: 2026-02-24*
