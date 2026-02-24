# Codebase Structure

**Analysis Date:** 2025-02-24

## Directory Layout

```
VibeApp/
├── frontend/                          # React Native (Expo) web + mobile
│   ├── app/                           # Expo Router v5 file-based routing
│   │   ├── _layout.tsx               # Root layout (ErrorBoundary, AppInitializer, SafeAreaProvider)
│   │   ├── index.tsx                 # 3-floor redirect/auth gate
│   │   ├── (public)/                 # PUBLIC FLOOR - Social experience
│   │   │   ├── _layout.tsx          # Tab navigation (AnimatedTabBar)
│   │   │   ├── index.tsx            # Map screen with VenueCard list
│   │   │   ├── trending.tsx         # Top venues by vibe_score
│   │   │   ├── lobby.tsx            # Saved venues + wishlist
│   │   │   ├── profile.tsx          # Scout stats, streak, avatar
│   │   │   └── crew.tsx             # Squad/crew management
│   │   ├── (merchant)/              # MERCHANT FLOOR - Business experience
│   │   │   ├── _layout.tsx          # Tab navigation (admin theme)
│   │   │   ├── index.tsx            # Overview dashboard (revenue, campaigns)
│   │   │   ├── wallet.tsx           # Wallet balance, topup options
│   │   │   ├── pulse.tsx            # Pulse drop tier selector (spark/flare/supernova)
│   │   │   └── settings.tsx         # Venue settings, AuraShield toggle
│   │   ├── (admin)/                 # ADMIN FLOOR - Authority experience
│   │   │   ├── _layout.tsx          # Tab navigation (royal blue theme)
│   │   │   ├── index.tsx            # Treasury dashboard (revenue breakdown)
│   │   │   ├── venues.tsx           # Admin venue management + suppression
│   │   │   ├── users.tsx            # User admin panel + badge awards
│   │   │   ├── logs.tsx             # API call logs + activity
│   │   │   ├── economy.tsx          # Economy simulator + campaign controls
│   │   │   └── [rest]/              # Nested admin routes
│   │   ├── (tabs)/                  # LEGACY: tabs shared across floors (NOT USED - deprecated)
│   │   ├── venue/[id].tsx           # Venue detail modal (VibeOracle, VibeForecast, TopScoutsCard)
│   │   ├── rate/[id].tsx            # Rating form (RateVibeModal fullscreen)
│   │   ├── merchant/                # Merchant nested routes
│   │   │   ├── [venue_id].tsx      # Merchant venue detail
│   │   │   └── topup/[venue_id].tsx # Wallet topup flow (Paystack)
│   │   └── admin/                   # Admin nested routes
│   │       └── treasury.tsx         # Extended treasury view
│   ├── src/
│   │   ├── store/
│   │   │   └── vibeStore.ts        # Zustand store (user, venues, socket, real-time state)
│   │   ├── components/             # 52+ UI components
│   │   │   ├── GlassCard.tsx       # Glassmorphism base component
│   │   │   ├── AnimatedTabBar.tsx  # Custom neon glow tab bar (public floor)
│   │   │   ├── VenueCard.tsx       # Venue preview card (name, vibe_score, energy, gate)
│   │   │   ├── RateVibeModal.tsx   # Rating energy/capacity/gate picker
│   │   │   ├── VibeOracle.tsx      # Predicted peak windows for venue
│   │   │   ├── VibeDNACard.tsx     # Scout affinity breakdown (club 96%, block_party 91%)
│   │   │   ├── TopScoutsCard.tsx   # Venue top raters (tier + clout points)
│   │   │   ├── NightPlannerModal.tsx # Claude AI conversation for night itinerary
│   │   │   ├── CrewCard.tsx        # Squad display with member avatars
│   │   │   ├── RatePromptFAB.tsx   # Floating map pin to rate nearby venue
│   │   │   ├── CheckInCelebration.tsx # 30-particle confetti on rating
│   │   │   ├── AvatarBuilder.tsx   # Emoji + color picker
│   │   │   ├── DemoModeBanner.tsx  # Dev toggle banner
│   │   │   └── [50+ more...]
│   │   ├── theme/
│   │   │   ├── floors.ts           # 3-floor theme tokens (publicTheme, merchantTheme, adminTheme)
│   │   │   ├── index.ts            # Theme exports + neonGlow utility
│   │   │   └── styles.ts           # Shared stylesheet utilities
│   │   ├── utils/
│   │   │   ├── geo.ts              # calculateDistance, haversine formula
│   │   │   ├── vibeMaster.ts       # Vibe score calculations + night phase logic
│   │   │   └── responsive.ts       # Screen size breakpoints
│   │   ├── data/
│   │   │   └── demoData.ts         # Mock venues, users, ratings for demo mode
│   │   └── assets/
│   │       ├── fonts/              # SpaceMono-Regular.ttf
│   │       └── images/             # Icons, splash screens
│   ├── package.json                # React Native + Expo deps (zustand, socket.io-client, expo-router)
│   ├── app.json                    # Expo config (app name, icon, splash, plugins)
│   ├── metro.config.js             # Bundler config (unstable_enablePackageExports=false for ESM fix)
│   ├── tsconfig.json               # TypeScript strict mode
│   ├── eslint.config.js            # ESLint + prettier integration
│   └── vercel.json                 # Vercel deployment config (static routes fallback)
│
├── backend/
│   ├── server.py                   # FastAPI app entry (local/Railway): create app, include routes, Socket.IO
│   ├── app/
│   │   ├── __init__.py
│   │   ├── config.py               # Motor async client, indexes, PAYSTACK keys, CITIES config, Socket.IO sio
│   │   ├── models.py               # Pydantic models (User, Venue, Rating, Crew, Campaign, etc.)
│   │   ├── middleware/
│   │   │   ├── __init__.py
│   │   │   └── rate_limit.py       # Per-IP rate limiting middleware
│   │   ├── routes/                 # 22+ feature-specific route modules
│   │   │   ├── __init__.py
│   │   │   ├── auth.py             # /api/auth/* (login, logout, me)
│   │   │   ├── users.py            # /api/users/* (signup, get_user, update_user)
│   │   │   ├── venues.py           # /api/venues/* (list, detail, direction_click)
│   │   │   ├── ratings.py          # /api/ratings/* (submit, get_venue_ratings)
│   │   │   ├── leaderboard.py      # /api/leaderboard/* (top venues by score, city-filtered)
│   │   │   ├── merchant.py         # /api/merchant/* (dashboard, wallet, topup_status)
│   │   │   ├── pulse_drops.py      # /api/pulse_drops/* (tier pricing, purchase)
│   │   │   ├── admin.py            # /api/admin/* (treasury, users, venues, suppress)
│   │   │   ├── campaigns.py        # /api/campaigns/* (active, create, track)
│   │   │   ├── lobbies.py          # /api/lobbies/* (save, unsave venue)
│   │   │   ├── checkins.py         # /api/checkins/* (create ghost, list active)
│   │   │   ├── streaks.py          # /api/streaks/* (claim milestone, leaderboard)
│   │   │   ├── stories.py          # /api/stories/* (upload venue story, list)
│   │   │   ├── crews.py            # /api/crews/* (create, join, vote)
│   │   │   ├── alerts.py           # /api/alerts/* (preferences, register)
│   │   │   ├── vibe_intel.py       # /api/vibe/* (DNA affinity, match score)
│   │   │   ├── forecast.py         # /api/forecast/* (peak window predictions)
│   │   │   ├── timeline.py         # /api/timeline/* (hourly vibe snapshots)
│   │   │   ├── certifications.py   # /api/certifications/* (verified venue badges)
│   │   │   ├── webhooks.py         # /api/webhooks/* (Paystack, external integrations)
│   │   │   ├── seed.py             # /api/seed/* (dev-only: seed test data)
│   │   │   └── dashboard.py        # /api/dashboard/* (user home: activity feed, promotions)
│   │   └── services/               # Business logic extracted from routes
│   │       ├── __init__.py
│   │       ├── auth.py             # get_current_user (token validation)
│   │       ├── payments.py         # Paystack integration (verify, charge)
│   │       ├── realtime.py         # Socket.IO event handlers + broadcast functions
│   │       ├── economy.py          # Clout point calculations, multiplier logic
│   │       ├── forecast.py         # Peak window heuristics (PEAK_WINDOWS constant)
│   │       ├── notifications.py    # Push notification logic (SMS/email)
│   │       ├── streaks.py          # Streak milestone calculations
│   │       ├── vibe.py             # Vibe score aggregation + persona logic
│   │       ├── sms.py              # SMS provider integration (Termii/Twilio)
│   │       └── email.py            # Email templates + sending
│   ├── api/                        # SEPARATE Vercel serverless entry point (SYNC WITH server.py!)
│   │   ├── index.py               # BaseHTTPRequestHandler (sync pymongo, no async)
│   │   └── requirements.txt        # Vercel Python dependencies
│   ├── static/                     # HTML fallback for SPA
│   │   ├── merchant.html          # Merchant portal fallback
│   │   └── admin.html             # Admin portal fallback
│   ├── tests/
│   │   └── test_admin_endpoints.py # Admin route tests
│   ├── server_legacy.py            # Old entry point (deprecated)
│   ├── Procfile                    # Railway deployment config
│   ├── requirements.txt            # Python deps (fastapi, motor, socket.io, pymongo)
│   ├── vercel.json                 # Vercel function config (SEPARATE from frontend/vercel.json)
│   └── README.md
│
├── .planning/                      # GSD planning documents
│   └── codebase/                  # Architecture analysis (ARCHITECTURE.md, STRUCTURE.md, etc.)
├── .emergent/                     # Emergent OAuth config (removed Feb 24)
├── .env                           # Environment vars (MONGO_URL, PAYSTACK_SECRET_KEY, etc.)
├── .gitignore                     # Excludes node_modules, .env, build artifacts
├── README.md                      # Project overview
├── VIBEAPP_STRATEGY_BLUEPRINT.md  # Product roadmap + feature specs
└── [test files, exports, backups...]
```

## Directory Purposes

**`frontend/app/`:**
- Purpose: Expo Router routing tree (file system → routes)
- Contains: Nested directory structure where each .tsx file = one screen
- Route groups `(public)`, `(merchant)`, `(admin)` isolate floors with separate tab stacks
- Special files: `_layout.tsx` = nav container, `[id].tsx` = dynamic segments, `index.tsx` = default screen

**`frontend/src/`:**
- Purpose: Shared code modules outside routing tree
- Contains: Store, components, theme, utilities, demo data
- Imported by app screens and other components

**`frontend/src/store/`:**
- Purpose: Centralized state management (Zustand)
- Key file: `vibeStore.ts` - single store instance with persist middleware

**`frontend/src/components/`:**
- Purpose: Reusable UI building blocks
- Naming: PascalCase.tsx, one component per file
- Exports: Default component export
- Usage: Imported by screens and other components

**`frontend/src/theme/`:**
- Purpose: Design tokens organized by floor
- Files: `floors.ts` (3 theme objects), `index.ts` (exports), `styles.ts` (utilities)

**`backend/app/routes/`:**
- Purpose: HTTP endpoint implementations organized by feature domain
- Naming: kebab-case module names matching API prefix (e.g., `venues.py` → `/api/venues/*`)
- Pattern: Each module has `router = APIRouter(tags=[...])` + multiple `@router.get/post` handlers

**`backend/app/services/`:**
- Purpose: Business logic callable from multiple routes
- Naming: kebab-case module names by responsibility (e.g., `auth.py`, `payments.py`)
- Pattern: Pure async functions, no FastAPI dependencies, easy to test

**`backend/api/`:**
- Purpose: Separate Vercel serverless entry point
- CRITICAL: `index.py` uses sync pymongo (not async Motor), must replicate routes from `server.py`
- Kept in sync manually - changes to business logic go in both places

## Key File Locations

**Entry Points:**
- Frontend web: `frontend/app/_layout.tsx` → RootLayout component
- Frontend mobile: Same as web (Expo universal runtime)
- Backend local/Railway: `backend/server.py` → FastAPI app with Socket.IO
- Backend Vercel: `backend/api/index.py` → BaseHTTPRequestHandler sync handler

**Configuration:**
- Frontend env: `frontend/app.json` (Expo config), `metro.config.js` (bundler), `tsconfig.json` (TypeScript)
- Backend env: `backend/app/config.py` (Motor client, constants, indexes), `.env` file (secrets - NOT committed)
- Theme system: `frontend/src/theme/floors.ts` (3 theme definitions)

**Core Logic:**
- State management: `frontend/src/store/vibeStore.ts` (Zustand with persist)
- API client: Fetch calls inside `vibeStore.ts` action methods (no separate HTTP client)
- Real-time: `backend/app/services/realtime.py` (Socket.IO handlers), `frontend` connects in app initializer
- Vibe scoring: `backend/app/services/vibe.py` (aggregation), `frontend/src/utils/vibeMaster.ts` (display)

**Testing:**
- Test files: Root level `backend_test*.py`, `comprehensive_merchant_test.py` (NOT in `backend/tests/` yet)
- Test runner: Python pytest (run manually, no CI/CD)

## Naming Conventions

**Files:**
- Frontend screens: `PascalCase.tsx` (e.g., `profile.tsx` inside route group → `ProfileScreen` component)
- Frontend components: `PascalCase.tsx` one per file (e.g., `VenueCard.tsx`)
- Backend routes: `kebab_case.py` (e.g., `pulse_drops.py`)
- Backend services: `kebab_case.py` (e.g., `payments.py`)

**Directories:**
- Route groups (Expo Router): Parentheses `(public)`, `(merchant)`, `(admin)`
- Dynamic segments: Square brackets `[id]`, `[venue_id]`
- Feature domains (routes): Plural nouns (`venues`, `ratings`, `users`)
- Feature domains (services): Action/responsibility nouns (`auth`, `payments`, `realtime`)

**Components:**
- Uppercase first letter (PascalCase), descriptive name
- Examples: `VenueCard`, `RateVibeModal`, `AnimatedTabBar`, `CheckInCelebration`

**State (Zustand):**
- Action methods: camelCase verbs (e.g., `fetchVenues`, `submitRating`, `connectSocket`)
- Selectors: state property names (e.g., `venues`, `user`, `loading`)
- Getters: utility functions on store (e.g., `getNightPhase`, `calculateVibeMatch`)

**API Endpoints:**
- Format: `/api/{domain}/{resource}?{query}` or `/api/{domain}/{resource}/{id}` or `/api/{domain}/{action}`
- Examples: `GET /api/venues`, `POST /api/ratings`, `PUT /api/users/{id}`, `GET /api/admin/treasury`
- Versioning: Not implemented (v1 implied)

## Where to Add New Code

**New Feature (e.g., Stories system):**
- Backend:
  - Routes: Create `backend/app/routes/stories.py` with `@router.get/post` endpoints
  - Services: Extract logic to `backend/app/services/stories.py` (optional if simple)
  - Models: Add Pydantic models to `backend/app/models.py`
  - Register: Import router in `backend/server.py` and `backend/api/index.py` and call `api_router.include_router(stories_router)`
- Frontend:
  - Screens: Add screen file in appropriate floor `frontend/app/(public)/stories.tsx` or modal route
  - Components: Create reusable UI in `frontend/src/components/StoryCard.tsx`
  - State: Add actions/selectors to `frontend/src/store/vibeStore.ts`
  - Connect: Call store actions from screen, handle Socket.IO updates in realtime listener

**New Component (e.g., StoryBubble):**
- File: `frontend/src/components/StoryBubble.tsx`
- Pattern: React functional component, export default
- Dependencies: Import theme from `frontend/src/theme/floors.ts`, use destructured colors
- Usage: Import in screen or parent component

**Utility Function (e.g., geo helpers):**
- File: Add to `frontend/src/utils/geo.ts` or create new `frontend/src/utils/calculator.ts`
- Export: Named exports for tree-shaking
- Usage: Import in components that need it

**Backend Route (new endpoint):**
- Pattern:
  ```python
  # backend/app/routes/new_feature.py
  from fastapi import APIRouter
  from app.services.auth import get_current_user

  router = APIRouter(tags=["new_feature"])

  @router.get("/new-feature/{id}")
  async def get_item(id: str, request: Request):
      user = await get_current_user(request)
      if not user: raise HTTPException(status_code=401)
      # business logic
      return result
  ```
- Register in `backend/server.py`: `api_router.include_router(new_feature_router)`
- ALSO register in `backend/api/index.py` for Vercel

## Special Directories

**`frontend/node_modules/`:**
- Purpose: NPM dependencies (installed via `npm install`)
- Generated: Yes (runs `npm install` on setup)
- Committed: No (excluded by `.gitignore`)

**`backend/app/__pycache__/`:**
- Purpose: Compiled Python bytecode cache
- Generated: Yes (Python auto-generates on import)
- Committed: No (excluded by `.gitignore`)

**`.env` (root)**:
- Purpose: Environment variables (secrets, API keys, database URLs)
- Contains: MONGO_URL, PAYSTACK_SECRET_KEY, ANTHROPIC_API_KEY, EXPO_PUBLIC_BACKEND_URL
- Generated: No (created manually)
- Committed: No (critical - never commit secrets)
- Usage: Load in `backend/app/config.py`, read by Vercel/Railway from deployment settings

**`.planning/codebase/`:**
- Purpose: GSD analysis documents (ARCHITECTURE.md, STRUCTURE.md, etc.)
- Generated: Yes (by GSD map-codebase command)
- Committed: Yes (versioned for team reference)

---

*Structure analysis: 2025-02-24*
