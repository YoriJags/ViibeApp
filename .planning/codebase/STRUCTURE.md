# Codebase Structure

**Analysis Date:** 2026-03-13

## Directory Layout

```
VibeApp/                         # Monorepo root
├── backend/                     # FastAPI + Socket.IO API server
│   ├── api/
│   │   └── index.py             # Vercel serverless entry (BaseHTTPRequestHandler, sync pymongo)
│   ├── app/
│   │   ├── config.py            # DB connection, Socket.IO, constants, index creation
│   │   ├── models.py            # All Pydantic request/response models
│   │   ├── __init__.py
│   │   ├── middleware/
│   │   │   └── rate_limit.py    # Sliding-window rate limiter middleware
│   │   ├── routes/              # 50+ domain route modules (one per feature area)
│   │   └── services/            # Shared business logic (vibe, auth, realtime, payments, etc.)
│   ├── server.py                # Railway entry — assembles FastAPI + Socket.IO ASGI app
│   ├── server_legacy.py         # Legacy monolith (reference only, not deployed)
│   ├── requirements.txt         # Python dependencies
│   ├── vercel.json              # Vercel config for backend/api/ serverless function
│   └── tests/                   # Backend test files
├── frontend/                    # React Native (Expo 54) app
│   ├── app/                     # Expo Router file-based routes
│   │   ├── _layout.tsx          # Root layout — AppInitializer, Stack navigator, ErrorBoundary
│   │   ├── index.tsx            # Default redirect → /(public)
│   │   ├── (public)/            # PUBLIC storey: scout experience (neon/midnight theme)
│   │   │   ├── _layout.tsx      # Tabs layout + AnimatedTabBar with neon glow
│   │   │   ├── index.tsx        # Explore tab — venue feed, hero, map, filters
│   │   │   ├── trending.tsx     # Trending tab — leaderboard, battles, top scouts
│   │   │   ├── crew.tsx         # Crew tab — squad locations, votes, rolling deep
│   │   │   ├── intel.tsx        # Intel tab — AI briefing, area pulse, insider feed
│   │   │   ├── profile.tsx      # Profile tab — DNA, stats, streaks, avatar, vibe+
│   │   │   └── lobby.tsx        # Shortlist screen (push nav, not a tab)
│   │   ├── (merchant)/          # MERCHANT storey: venue owner dashboard (gold theme)
│   │   │   ├── _layout.tsx      # Tabs layout + auth guard (redirects non-merchants)
│   │   │   ├── index.tsx        # Overview tab — analytics, real-time dashboard
│   │   │   ├── wallet.tsx       # Wallet tab — balance, top-up, transactions
│   │   │   ├── pulse.tsx        # Pulse tab — buy pulse drops, campaigns, surge
│   │   │   └── settings.tsx     # Settings tab — venue config, hours, geofence
│   │   ├── (admin)/             # ADMIN storey: super admin panel (slate/blue theme)
│   │   │   ├── _layout.tsx      # Tabs layout + super-admin guard
│   │   │   ├── index.tsx        # Main admin dashboard — platform overview
│   │   │   ├── venues.tsx       # Venue management — override, verify, suppress
│   │   │   ├── users.tsx        # User management
│   │   │   ├── economy.tsx      # Revenue analytics
│   │   │   └── logs.tsx         # Activity logs
│   │   ├── (tabs)/              # Legacy tab group (index.tsx redirects, kept for reference)
│   │   │   └── index.tsx
│   │   ├── venue/
│   │   │   └── [id].tsx         # Venue detail — vibe score, oracle, DNA, top scouts, map
│   │   ├── rate/
│   │   │   └── [id].tsx         # Rating screen — geofenced submission flow
│   │   ├── admin/               # Supplementary admin pages (flat, not grouped)
│   │   ├── merchant/            # Supplementary merchant pages (flat, not grouped)
│   │   └── claim.tsx            # Venue claim flow
│   ├── src/
│   │   ├── components/          # 100+ UI components (PascalCase .tsx)
│   │   ├── store/
│   │   │   └── vibeStore.ts     # Single Zustand store — all state + all API calls
│   │   ├── data/
│   │   │   └── demoData.ts      # Demo mode fixtures — venues, users, oracle, DNA, planner
│   │   ├── theme/
│   │   │   ├── floors.ts        # Per-storey theme objects + shared spacing/typography
│   │   │   ├── index.ts         # Theme barrel file
│   │   │   └── styles.ts        # Shared StyleSheet utilities
│   │   ├── types/
│   │   │   └── venue.ts         # Canonical Venue TypeScript interface (single source of truth)
│   │   └── utils/
│   │       ├── vibeMaster.ts    # Lagos-flavored dynamic copy engine (template library)
│   │       ├── sceneIntel.ts    # Converts venue data to "Intel" scene sentences (Insider Mode)
│   │       ├── geo.ts           # Haversine distance + geofence helpers
│   │       ├── hapticVibe.ts    # Haptic feedback patterns per vibe event
│   │       └── responsive.ts   # Screen dimension helpers
│   ├── assets/                  # Images, icons, fonts
│   ├── public/                  # Web-only static files
│   ├── scripts/                 # Build/utility scripts
│   ├── app.json                 # Expo config
│   ├── metro.config.js          # Metro bundler config (unstable_enablePackageExports=false)
│   ├── vercel.json              # Frontend deployment + /api/* rewrite to Railway
│   ├── .npmrc                   # legacy-peer-deps=true (required for @expo/webpack-config)
│   └── tsconfig.json            # TypeScript config
├── .planning/                   # GSD planning documents
├── docs/                        # Product documentation
├── tests/                       # Integration / E2E test scripts (Python)
├── Dockerfile                   # Backend container for Railway
├── railway.toml                 # Railway build config (DOCKERFILE builder)
└── nixpacks.toml                # Nixpacks fallback config
```

## Directory Purposes

**`backend/app/routes/`:**
- Purpose: One Python file per domain feature. Each exports a single `router = APIRouter(...)`. No shared state between route modules.
- Contains: `ratings.py`, `venues.py`, `users.py`, `merchant.py`, `admin.py`, `intelligence.py`, `oracle.py`, `planner.py`, `ai_features.py`, `leaderboard.py`, `crews.py`, `coins.py`, `surge.py`, `battles.py`, `dna.py`, `momentum.py`, and 35+ more
- Key files: `backend/app/routes/ratings.py` (core business flow), `backend/app/routes/merchant.py` (largest at 43KB), `backend/app/routes/intelligence.py` (scene intelligence, 34KB)

**`backend/app/services/`:**
- Purpose: Shared logic used by multiple route modules. Imported directly (not via FastAPI DI except auth dependencies).
- Key files: `backend/app/services/vibe.py` (score calc, geofence, clout, aggregation), `backend/app/services/auth.py` (session, `require_auth`/`require_admin`/`require_merchant` FastAPI dependencies), `backend/app/services/realtime.py` (Socket.IO handlers + broadcast functions), `backend/app/services/payments.py` (Paystack), `backend/app/services/streaks.py`

**`frontend/src/components/`:**
- Purpose: All reusable UI. Components vary widely in scope — from simple chips to full-screen modals with their own API calls via `useVibeStore`.
- Key files: `VenueCard.tsx` (18KB, main venue list item), `RateVibeModal.tsx` (34KB, full rating UX), `MockMap.tsx` (35KB, map simulation), `VibeOracle.tsx` (21KB), `VibeDNACard.tsx` (17KB), `OnboardingFlow.tsx` (19KB), `SurgeFullScreen.tsx` (30KB), `VibeReactor.tsx` (30KB)
- Barrel file: `frontend/src/components/index.ts` (partial re-exports only)

**`frontend/src/store/vibeStore.ts`:**
- Purpose: The single file that owns all state and API communication. At 62KB it is the largest frontend file.
- Contains: TypeScript interfaces for all domain entities, `PersistedState` vs transient state split, Zustand `create` with `persist` middleware targeting `AsyncStorage`, all `fetch()` calls to the backend

**`frontend/src/data/demoData.ts`:**
- Purpose: Static fixtures for demo mode — bypasses all network calls when `isDemoMode = true`
- Key exports: `DEMO_VENUES`, `DEMO_USER`, `DEMO_ORACLE_PREDICTIONS`, `DEMO_VIBE_DNA`, `DEMO_PLANNER_CONVERSATION`, `DEMO_VENUE_TOP_SCOUTS`, `DEMO_ACTIVITY_FEED`, `DEMO_BADGES`

## Key File Locations

**Entry Points:**
- `backend/server.py`: Railway production entry — FastAPI + Socket.IO assembly
- `backend/api/index.py`: Vercel serverless entry — standalone BaseHTTPRequestHandler
- `frontend/app/_layout.tsx`: App boot, Zustand hydration, splash, onboarding gate
- `frontend/app/index.tsx`: Default route redirect to `/(public)`

**Configuration:**
- `backend/app/config.py`: MongoDB Motor client, Socket.IO server, all env vars, business constants
- `backend/app/models.py`: All Pydantic models (User, Venue, Rating, MerchantWallet, etc.)
- `frontend/src/theme/floors.ts`: Per-storey color themes + shared spacing/typography tokens
- `frontend/app.json`: Expo app config (name, slug, icons, plugins)
- `frontend/metro.config.js`: Metro bundler (`unstable_enablePackageExports=false` — fixes web ESM crash)

**Core Logic:**
- `backend/app/services/vibe.py`: `calculate_vibe_score()`, `calculate_venue_aggregate()`, `is_within_geofence()`, `update_user_clout()`
- `backend/app/services/auth.py`: `require_auth`, `require_admin`, `require_merchant`, `require_venue_owner` FastAPI dependencies
- `backend/app/services/realtime.py`: Socket.IO event handlers, `broadcast_venue_update()`, Kinetic Quest state
- `frontend/src/store/vibeStore.ts`: All frontend state + every API call
- `frontend/src/types/venue.ts`: Canonical `Venue` TypeScript interface — import from here, never re-declare

**Testing:**
- `backend/tests/`: Backend test files
- `tests/`: Root-level integration test scripts (`backend_test.py`, `backend_test_v3.py`, `comprehensive_merchant_test.py`, etc.)

## Naming Conventions

**Files:**
- Backend route/service modules: `snake_case.py` (e.g., `venue_live.py`, `rolling_deep.py`)
- Frontend components: `PascalCase.tsx` (e.g., `VenueCard.tsx`, `VibeOracle.tsx`)
- Frontend screens: `lowercase.tsx` within route groups (e.g., `index.tsx`, `trending.tsx`, `profile.tsx`)
- Frontend dynamic routes: `[param].tsx` (e.g., `venue/[id].tsx`, `rate/[id].tsx`)
- Frontend utilities: `camelCase.ts` (e.g., `vibeMaster.ts`, `sceneIntel.ts`)

**Directories:**
- Backend domain grouping: flat under `routes/` and `services/` — no sub-grouping
- Frontend route groups: parenthesized `(groupName)` per Expo Router convention
- Theme per storey: named `publicTheme`, `merchantTheme`, `adminTheme` in `floors.ts`

## Where to Add New Code

**New backend API endpoint:**
- Create: `backend/app/routes/<feature_name>.py` with `router = APIRouter(tags=["<tag>"])`
- Register: Add `from app.routes.<feature_name> import router as <feature>_router` and `api_router.include_router(<feature>_router)` in `backend/server.py`
- Mirror: If the endpoint must work on Vercel (web build), add equivalent handler in `backend/api/index.py`

**New backend business logic shared by multiple routes:**
- Create: `backend/app/services/<service_name>.py`
- Import directly in route files: `from app.services.<service_name> import <function>`

**New frontend screen:**
- Public tab screen: `frontend/app/(public)/<tab_name>.tsx` + register in `frontend/app/(public)/_layout.tsx`
- Merchant tab screen: `frontend/app/(merchant)/<tab_name>.tsx` + register in `frontend/app/(merchant)/_layout.tsx`
- Push/modal screen (not a tab): `frontend/app/<route_name>.tsx` or `frontend/app/<route_name>/[id].tsx` + add `Stack.Screen` in `frontend/app/_layout.tsx`

**New frontend component:**
- Implementation: `frontend/src/components/<ComponentName>.tsx`
- If widely used: add re-export to `frontend/src/components/index.ts`

**New frontend state / API action:**
- Add to `frontend/src/store/vibeStore.ts` — extend `PersistedState` for fields that survive restart, or add directly to the Zustand state for transient data

**New type definition:**
- Venue-related: extend `frontend/src/types/venue.ts`
- Store-scoped types: define as interfaces inside `frontend/src/store/vibeStore.ts`
- Backend input/output: add Pydantic model to `backend/app/models.py`

**New theme token:**
- Add to appropriate theme object in `frontend/src/theme/floors.ts` (or `frontend/src/theme/index.ts` for global tokens)

**New demo fixture:**
- Add to `frontend/src/data/demoData.ts` as a named export prefixed with `DEMO_`

**New utility:**
- Frontend: `frontend/src/utils/<utilName>.ts`

## Special Directories

**`backend/api/`:**
- Purpose: Vercel serverless function. Contains a single `index.py` that reimplements core routes using synchronous `pymongo` and Python's `BaseHTTPRequestHandler`.
- Generated: No
- Committed: Yes
- Critical note: Must be manually kept in sync with `backend/server.py` — it is a completely separate implementation, not a shared module.

**`frontend/.expo/`:**
- Purpose: Expo build cache and generated type files
- Generated: Yes
- Committed: Partially (generated types committed, cache not)

**`frontend/dist/`:**
- Purpose: Expo web build output
- Generated: Yes
- Committed: No (Vercel rebuilds from source)

**`frontend/android/`:**
- Purpose: Android native project (generated by Expo prebuild)
- Generated: Partially
- Committed: Yes (for direct Android builds)

**`.planning/`:**
- Purpose: GSD project planning documents — phases, roadmap, requirements, codebase analysis
- Generated: No
- Committed: Yes

**`exports/`:**
- Purpose: Temporary export files (likely pitch deck / document exports)
- Generated: Yes
- Committed: No (untracked)

---

*Structure analysis: 2026-03-13*
