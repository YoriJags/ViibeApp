# Architecture

**Analysis Date:** 2026-03-13

## Pattern Overview

**Overall:** Decoupled monolith (frontend) + modular monolith (backend) deployed as separate services

**Key Characteristics:**
- 3-Storey access model: Public (scouts), Merchant (venue owners), Admin (super admins) — enforced at both routing and auth layers
- FastAPI modular backend with 50+ domain route files, each owning a slice of business logic
- Single Zustand store for all frontend state — persisted to AsyncStorage, hydrated at boot
- Real-time layer via Socket.IO running as an ASGI app wrapping the FastAPI app
- Vercel rewrites proxy all `/api/*` requests from the frontend to Railway (backend)

## Layers

**Frontend Screens (Expo Router):**
- Purpose: File-based routing maps directly to user-facing screens
- Location: `frontend/app/`
- Contains: Page components organized by access storey (`(public)`, `(merchant)`, `(admin)`) plus shared route screens (`venue/[id]`, `rate/[id]`, `claim.tsx`)
- Depends on: `vibeStore`, `src/components/`, `src/theme/`
- Used by: End users navigating the app

**Frontend Components:**
- Purpose: Reusable UI building blocks, many self-fetching their own data via `vibeStore`
- Location: `frontend/src/components/`
- Contains: 100+ components ranging from atomic (`AvatarDisplay.tsx`, `SkeletonLoader.tsx`) to complex features (`VibeOracle.tsx`, `RateVibeModal.tsx`, `SurgeFullScreen.tsx`)
- Depends on: `vibeStore`, `src/theme/`, `src/utils/`
- Used by: Screen files in `frontend/app/`

**Frontend Store (Zustand):**
- Purpose: Global state + API communication layer — the only place where fetch calls are made
- Location: `frontend/src/store/vibeStore.ts`
- Contains: All app state (auth, venues, crews, streaks, socket connection), actions that call the backend, persist configuration
- Depends on: `API_URL` from `process.env.EXPO_PUBLIC_BACKEND_URL`, `src/data/demoData.ts`
- Used by: All components and screens via `useVibeStore()`

**Backend Routes:**
- Purpose: HTTP request handlers — validate input, call services, return JSON
- Location: `backend/app/routes/`
- Contains: 50+ domain modules (e.g., `ratings.py`, `venues.py`, `merchant.py`, `intelligence.py`, `oracle.py`)
- Depends on: `app.services.*`, `app.config.db`, `app.models`
- Used by: FastAPI router registered in `backend/server.py`

**Backend Services:**
- Purpose: Reusable business logic and integrations shared across route modules
- Location: `backend/app/services/`
- Contains: `vibe.py` (score calculation, geofencing, clout), `auth.py` (sessions, FastAPI dependencies), `realtime.py` (Socket.IO event handlers), `payments.py` (Paystack), `notifications.py`, `streaks.py`, `forecast.py`, `economy.py`, `email.py`, `sms.py`
- Depends on: `app.config.db`, `app.models`, external APIs (Paystack, Anthropic)
- Used by: Route handlers via direct import

**Backend Config & Models:**
- Purpose: Centralized database connection, environment variables, Pydantic models, constants
- Location: `backend/app/config.py`, `backend/app/models.py`
- Contains: MongoDB Motor client, Socket.IO server instance, index creation, city definitions, Pydantic request/response models
- Depends on: Environment variables (`MONGO_URL`, `DB_NAME`, `PAYSTACK_SECRET_KEY`, etc.)
- Used by: All route and service modules

**Middleware:**
- Purpose: Cross-cutting request concerns applied before routes execute
- Location: `backend/app/middleware/rate_limit.py`
- Contains: In-memory sliding-window rate limiter keyed by `IP:path`
- Depends on: `app.config.logger`
- Used by: FastAPI app in `backend/server.py`

## Data Flow

**Scout Rating a Venue:**

1. User at venue opens `RateVibeModal.tsx`, selects energy/capacity/gate/venue_specific
2. `vibeStore.submitRating()` calls `POST /api/ratings` with geolocation coordinates
3. Backend `ratings.py` checks geofence (`services/vibe.is_within_geofence`), cooldown, daily limit
4. On pass: saves `Rating` doc to MongoDB, calls `services/vibe.calculate_vibe_score()`, updates venue aggregate
5. `services/realtime.broadcast_venue_update()` emits `venue_update` Socket.IO event
6. `services/streaks.update_streak()` increments user streak
7. Clout awarded via `services/vibe.update_user_clout()`; coins via `routes/coins.award_coins()`
8. Frontend receives Socket.IO `venue_update` event → `vibeStore` updates venue in local state → all subscribed components re-render

**App Boot / Initialization:**

1. `frontend/app/_layout.tsx` renders `AppInitializer`
2. Zustand `persist` middleware rehydrates state from AsyncStorage (`hasHydrated = true`)
3. `fetchCities()` and `fetchFeatureFlags()` called in parallel
4. `connectSocket()` opens Socket.IO connection to Railway backend
5. Native splash hidden → custom `SplashAnimation` plays → OnboardingFlow shown if first launch
6. `index.tsx` redirects to `/(public)` → PublicLayout renders with `AnimatedTabBar`

**Vibe Score Calculation:**

1. Raw inputs: energy (quiet/chill/warming/lit/peak) = 80% weight; venue_specific context = 20%
2. Capacity acts as multiplier: sparse=0.92x, vibrant=1.05x, full=1.15x
3. Final score: 0–100 float, clamped at 100
4. Venue aggregate = time-windowed rolling average of recent ratings stored in `vibe_snapshots`
5. `vibe_tier` (Elite/Established/Solid/Building/New) derived from 30-day average, cached on venue doc

**Demo Mode:**

1. `vibeStore.isDemoMode` toggled from `DemoModeBanner`
2. When true, store actions return data from `frontend/src/data/demoData.ts` instead of calling the backend
3. Geofence enforcement bypassed; rating cooldown bypassed
4. `require()` is used inside Zustand action bodies for demoData imports to avoid circular dependency issues

**State Management:**

Zustand store split into `PersistedState` (survives app restart via AsyncStorage) and transient state (lives only in memory). Persisted fields include: `user`, `sessionToken`, `selectedCity`, `hasSeenOnboarding`, `isDemoMode`, `avatarConfig`, `vibePersona`, `userMode`, `pendingRatings`.

## Key Abstractions

**Vibe Score:**
- Purpose: 0-100 numeric representation of a venue's current energy
- Examples: `backend/app/services/vibe.py` (`calculate_vibe_score()`), `frontend/src/components/VibeMeter.tsx`
- Pattern: Computed from scout inputs; aggregated as rolling average; displayed as energy_level label + color

**The Three Storeys:**
- Purpose: Role-based access zones, each with their own visual theme, navigation, and API scope
- Examples: `frontend/app/(public)/`, `frontend/app/(merchant)/`, `frontend/app/(admin)/`, `frontend/src/theme/floors.ts`
- Pattern: Expo Router route groups with `_layout.tsx` acting as auth guard; merchant/admin layouts redirect unauthorized users to `/(public)` via `useEffect`

**Scout Persona:**
- Purpose: User archetype affecting venue feed sort order and display copy
- Examples: `vibeStore.vibePersona`, `frontend/app/(public)/index.tsx` persona sort, `backend/app/routes/intelligence.py` crowd composition
- Pattern: 4 values: `turn_up`, `grown_sexy` (The Luxe), `culture`, `chill_set`; set during onboarding; persisted in Zustand

**Pulse Drops:**
- Purpose: Merchant-paid promotion tiers that boost a venue's visibility, glow, and chart position
- Examples: `backend/app/config.py` (`PULSE_DROP_TIERS`), `backend/app/routes/pulse_drops.py`, `frontend/src/components/VibeSurgeBar.tsx`
- Pattern: 3 tiers (spark/flare/supernova), time-limited, expire via MongoDB TTL + `pulse_expires_at`

**Kinetic Tap / Vibe Reactor:**
- Purpose: Real-time crowd tap mechanic — aggregate BPM triggers resonance quests and surge events
- Examples: `frontend/src/components/VibeReactor.tsx`, `backend/app/services/realtime.py` (`_venue_kinetics`), `backend/app/routes/resonance.py`
- Pattern: In-memory state on backend keyed by `venue_id`; Socket.IO events; resets on server restart

## Entry Points

**Backend (Railway/Production):**
- Location: `backend/server.py`
- Triggers: `uvicorn server:socket_app --host 0.0.0.0 --port $PORT` via Docker CMD
- Responsibilities: Assembles FastAPI app, registers all 50+ route modules, attaches middleware, wraps in Socket.IO ASGI app, creates MongoDB indexes on startup

**Backend (Vercel Serverless):**
- Location: `backend/api/index.py`
- Triggers: Vercel serverless invocation on `/api/*` requests to the frontend domain
- Responsibilities: Standalone BaseHTTPRequestHandler (no FastAPI) — reimplements core routes (ratings, venues, auth) using synchronous pymongo. Must be kept in sync with `server.py` manually.

**Frontend:**
- Location: `frontend/app/_layout.tsx`
- Triggers: Expo app launch (web, iOS, Android)
- Responsibilities: SafeAreaProvider, ErrorBoundary, AppInitializer (Zustand hydration → fetchCities → connectSocket), splash animation, onboarding gate, root Stack navigator, GlobalVibePill overlay

**Frontend Default Route:**
- Location: `frontend/app/index.tsx`
- Triggers: Navigation to `/`
- Responsibilities: Immediate redirect to `/(public)`

## Error Handling

**Strategy:** Lightweight — FastAPI HTTP exceptions at the route layer; no central error service

**Patterns:**
- Route handlers raise `HTTPException(status_code=..., detail=...)` for expected errors (400, 401, 403, 404, 429)
- `ErrorBoundary` component (`frontend/src/components/ErrorBoundary.tsx`) wraps key component trees; `variant="screen"` shows full-screen fallback, default shows inline
- `vibeStore` actions use try/catch; initialization failures call `setIsReady(true)` anyway to avoid hang
- Rating route returns `X-Cooldown-Remaining` header alongside 429 for UI countdown

## Cross-Cutting Concerns

**Logging:** Python `logging` module, `logger = logging.getLogger('vibe_app')` in `backend/app/config.py`; structured as `INFO` level; no external log aggregator

**Validation:** Pydantic models (`backend/app/models.py`) enforce request body types; in-memory `RateLimitStore` in `backend/app/middleware/rate_limit.py` enforces per-endpoint rate limits

**Authentication:** Session token pattern — UUID stored in `user_sessions` MongoDB collection with TTL index; extracted from `Authorization: Bearer <token>` header or `session_token` cookie; FastAPI dependencies `require_auth`, `require_admin`, `require_merchant`, `require_venue_owner` in `backend/app/services/auth.py`; frontend stores `sessionToken` in Zustand persist (AsyncStorage)

**Real-time:** Socket.IO server (`sio`) defined in `backend/app/config.py`, event handlers registered in `backend/app/services/realtime.py` via side-effect import; broadcasts on `venue_update`, `leaderboard_update`, `city_pulse`, `global_vibe_charge`, `kinetic_tap` events

---

*Architecture analysis: 2026-03-13*
