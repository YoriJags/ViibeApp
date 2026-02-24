# Architecture

**Analysis Date:** 2025-02-24

## Pattern Overview

**Overall:** 3-Storey Multi-Floor Architecture with Shared Backend & Modular Frontend Routing

**Key Characteristics:**
- Three independent user floors (Public, Merchant, Admin) each with distinct visual identity and permissions
- Frontend: Expo Router v5 file-based routing with route groups (`(public)`, `(merchant)`, `(admin)`)
- Backend: FastAPI modular routes + Socket.IO real-time layer, with separate Vercel serverless entry point
- State: Zustand v5 persisted store (AsyncStorage) as single source of truth for frontend
- Real-time: Socket.IO rooms for venue updates, leaderboard broadcasts, check-in counts
- Two separate backend entry points kept in sync: `server.py` (local/Railway) and `api/index.py` (Vercel)

## Layers

**Frontend Application Layer:**
- Purpose: User-facing screens for each floor with authentication-based routing
- Location: `frontend/app/`
- Contains: Floor-specific layouts, screens, and modal routes
- Depends on: `vibeStore`, `floors.ts` theme system, `components/`
- Used by: Direct user interaction (touch, navigation)

**Frontend Business Logic Layer:**
- Purpose: State management, API calls, real-time subscriptions
- Location: `frontend/src/store/vibeStore.ts`
- Contains: Zustand store with persist middleware, Socket.IO client connection, API methods
- Depends on: `axios`-like fetch calls to `EXPO_PUBLIC_BACKEND_URL`, Socket.IO client
- Used by: All frontend screens and components

**Frontend Presentation Layer:**
- Purpose: Reusable UI components with accessibility and animations
- Location: `frontend/src/components/` (52+ components)
- Contains: GlassCard, VenueCard, AnimatedTabBar, RateVibeModal, VibeOracle, etc.
- Depends on: Theme system (`floors.ts`), animations, icons
- Used by: Application and Business Logic layers

**Backend API Layer:**
- Purpose: HTTP request handling and route registration
- Location: `backend/server.py` (FastAPI ASGI + Socket.IO)
- Contains: Middleware (CORS, rate limiting), route inclusion, startup hooks
- Depends on: FastAPI, all route modules, Socket.IO config
- Used by: Client HTTP requests and WebSocket connections

**Backend Routes Layer:**
- Purpose: Endpoint logic organized by feature domain
- Location: `backend/app/routes/` (22+ route modules: `auth.py`, `venues.py`, `ratings.py`, etc.)
- Contains: @router.get/@router.post endpoints with validation
- Depends on: Services layer, models, database config
- Used by: Frontend API calls via HTTP

**Backend Services Layer:**
- Purpose: Business logic extracted from routes (queries, calculations, integrations)
- Location: `backend/app/services/` (auth.py, payments.py, realtime.py, economy.py, etc.)
- Contains: Functions for auth validation, Paystack processing, Socket.IO broadcasts, vibe calculations
- Depends on: Database, external APIs (Paystack)
- Used by: Routes layer

**Backend Data Layer:**
- Purpose: Database connection and schema definitions
- Location: `backend/app/config.py` (Motor async client, indexes) + `backend/app/models.py` (Pydantic)
- Contains: MongoDB async client, collections setup, TTL indexes, Pydantic models
- Depends on: Motor (async MongoDB), environment variables
- Used by: Routes and Services layers

## Data Flow

**Public Floor Scout Rating Submission → Backend → Live Leaderboard Broadcast:**

1. Scout opens RateVibeModal in VenueCard (Public floor)
2. Selects energy (chill/popping/electric), capacity (sparse/vibrant/full), gate (clear/slow/blocked)
3. Submits POST `/api/ratings` with venue_id + venue_type + vibe_score calculation
4. Backend route `ratings.py` validates, stores to MongoDB `ratings` collection
5. Rating triggers vibe_score recalculation (50% energy + 30% capacity + 20% gate)
6. Backend broadcasts `venue_update` via Socket.IO room `venue_{venue_id}` to map subscribers
7. Backend broadcasts `leaderboard_update` to room `leaderboard_city_{city}` with top 50 venues
8. Frontend vibeStore receives real-time update and triggers component re-render
9. VenueCard shows live vibe_score change, CheckInCelebration confetti fires, Clout points awarded

**Merchant Floor Check-In Campaign Activation:**

1. Merchant logged in to `/merchant` floor (authenticated via `is_merchant` flag)
2. Views active campaigns at `/merchant/index` showing venue name, multiplier, expiry
3. Backend broadcasts active campaigns via Socket.IO on merchant login
4. vibeStore hydrates `activeCampaigns` array from `GET /api/campaigns/active?city=...`
5. Campaign multiplier applied when scouts rate that venue (50% base + multiplier boost)
6. Wallet balance updated via Paystack integration (`POST /api/webhooks/paystack`)

**Admin Floor Treasury Dashboard Data Fetch:**

1. Admin authenticated to `/admin` floor (via `is_super_admin` flag)
2. Navigates to `/admin/index` (Treasury tab)
3. Fetches `GET /api/admin/treasury` → MongoDB aggregation on `platform_revenue`, `wallet_transactions`
4. Backend returns city-level breakdowns, top merchants, revenue trend data
5. Dashboard renders charts + tables via admin theme (slate/royal blue)

## Key Abstractions

**Floor System (3-Storey Model):**
- Purpose: Isolate user types into separate navigation stacks with permission guards
- Examples: `frontend/app/(public)/`, `frontend/app/(merchant)/`, `frontend/app/(admin)/`
- Pattern: Expo Router route groups with nested Tabs layout, permission middleware in each layout component (checks `user.is_merchant`, `user.is_super_admin`)

**Venue Vibe Score (Real-time Scoring):**
- Purpose: Aggregate crowd energy into single numerical metric
- Examples: `backend/app/services/vibe.py`, frontend `vibeMaster.ts`
- Pattern: Weighted average of user ratings (energy 50%, capacity 30%, gate 20%) with 1-hour sliding window, superseded stale ratings

**Theme Token System (Per-Floor Branding):**
- Purpose: Enforce consistent colors/typography across each floor
- Examples: `frontend/src/theme/floors.ts` → `publicTheme`, `merchantTheme`, `adminTheme`
- Pattern: Export theme objects with nested colors/gradients/typography; components pull via `const { colors } = publicTheme`

**Socket.IO Rooms (Pub/Sub Architecture):**
- Purpose: Broadcast updates to specific subscriber groups
- Examples: `venue_{venue_id}`, `city_{city}`, `leaderboard_all`, `leaderboard_{city}`
- Pattern: Clients call `join_venue({venue_id})` to enter room; backend calls `sio.emit(event, data, room=room_name)`

**Zustand Persist Store (State Hydration):**
- Purpose: Persist auth state + UI state to AsyncStorage across app restarts
- Examples: `vibeStore.ts` with `persist` middleware, selectors `useVibeStore(state => state.user)`
- Pattern: Split interfaces `PersistedState` (user, token, city, ratings) vs transient state (venues, loading)

## Entry Points

**Frontend Web:**
- Location: `frontend/app/_layout.tsx` (RootLayout)
- Triggers: App.json Expo config + metro.config.js bundler
- Responsibilities: Error boundary wrapper, app initializer (splash → onboarding → floors), Socket.IO connect on app start

**Frontend Mobile (iOS/Android):**
- Location: `frontend/app/_layout.tsx` (same as web via Expo universal)
- Triggers: Expo Go app or native build
- Responsibilities: Same as web, plus Location permissions handler for geofence checks

**Backend Local/Railway:**
- Location: `backend/server.py`
- Triggers: `uvicorn app.server:socket_app --host 0.0.0.0 --port 8000`
- Responsibilities: Assemble FastAPI app with all routes + Socket.IO, run startup hooks (ensure_indexes), serve /api/* endpoints

**Backend Vercel Serverless:**
- Location: `backend/api/index.py`
- Triggers: Vercel deployment (routes POST /api/*)
- Responsibilities: BaseHTTPRequestHandler entry point (sync pymongo, no async) for short-lived function execution; MUST KEEP IN SYNC with server.py

**Merchant Portal Static Fallback:**
- Location: `backend/static/merchant.html`
- Triggers: `GET /merchant` (SPA fallback route in backend rewrites)
- Responsibilities: Serve merchant portal if frontend build unavailable

**Admin Portal Static Fallback:**
- Location: `backend/static/admin.html`
- Triggers: `GET /admin` (SPA fallback route in backend rewrites)
- Responsibilities: Serve admin portal if frontend build unavailable

## Error Handling

**Strategy:** Layered error handling with user-facing fallbacks and logging

**Patterns:**

- **API Errors (Frontend):** Catch in `useVibeStore` API methods, set error state, show toast/banner to user, retry-able
- **API Errors (Backend):** HTTPException with status code + detail dict; FastAPI auto-serializes to JSON 400/404/500
- **Database Errors:** Try-catch in services layer, log to console, return 500 to client
- **Real-time Errors:** Socket.IO disconnect/reconnect handled in `connectSocket()` with exponential backoff
- **Validation Errors:** Pydantic model validation (types, constraints) on route POST body; FastAPI returns 422 with field errors
- **Auth Errors:** Bearer token expired → 401, redirect to onboarding; missing token → 401, allow guest access to public floor
- **Component Errors:** ErrorBoundary in `frontend/app/_layout.tsx` catches unhandled render errors; displays error message + restart hint

## Cross-Cutting Concerns

**Logging:**
- Backend: Python logging to stdout (picked up by Railway logs)
- Frontend: console.log/error to debugger (Expo Dev Client, Metro logs)
- No centralized log aggregation (Sentry/Datadog not integrated)

**Validation:**
- Backend routes: Pydantic models on POST body validate types + constraints (e.g., rating must be 0-100)
- Frontend: Basic type checking via TypeScript, runtime validation on API responses
- Database: MongoDB schema validation on inserts via models.py Pydantic

**Authentication:**
- Phone-based local auth: `POST /api/users/signup` → session_token stored in AsyncStorage
- Session token: Sent as `Authorization: Bearer {token}` header on each API request
- Token expiry: 7 days (SESSION_EXPIRY_DAYS), TTL index auto-deletes expired sessions
- Floor routing: Role check in layout component (`useEffect` guards + redirect if permission missing)

**Rate Limiting:**
- Backend: `RateLimitMiddleware` in `app/middleware/rate_limit.py`
- Applied to all routes via middleware stack
- Tracks requests per IP address, returns 429 if exceeded

---

*Architecture analysis: 2025-02-24*
