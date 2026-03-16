# Technology Stack

**Analysis Date:** 2026-03-13

## Languages

**Primary:**
- TypeScript 5.8.3 - Frontend (all React Native / Expo source in `frontend/src/` and `frontend/app/`)
- Python 3.11 - Backend (all FastAPI source in `backend/`)

**Secondary:**
- JavaScript - Metro config (`frontend/metro.config.js`), ESLint config (`frontend/eslint.config.js`), build scripts (`frontend/scripts/`)

## Runtime

**Frontend Environment:**
- Node.js (via Expo CLI) - local dev bundling and web export
- React Native 0.81.5 - iOS / Android native runtime
- Web: Metro bundler with static export (`expo export -p web`), output to `frontend/dist/`

**Backend Environment:**
- Python 3.11 (pinned in `Dockerfile`: `FROM python:3.11-slim`)
- Uvicorn ASGI server with `python-socketio` ASGI app wrapper

**Package Manager:**
- Frontend: yarn 1.22.22 (packageManager field in `frontend/package.json`); `npm install` used in Vercel CI build (see `frontend/vercel.json`)
- Backend: pip (no lockfile; `backend/requirements.txt` pins exact versions)
- Lockfile: `frontend/package-lock.json` present (npm lockfile exists alongside yarn)

## Frameworks

**Core — Frontend:**
- Expo 54.0.33 - React Native app framework, SDK and build tooling
- Expo Router 6.0.23 - File-based routing in `frontend/app/`; typed routes enabled
- React 19.1.0 / React DOM 19.1.0 - UI rendering
- React Native 0.81.5 - Native mobile layer

**Core — Backend:**
- FastAPI 0.115.5 - REST API framework, `backend/server.py` entry point
- Starlette 0.41.3 - ASGI base (used directly for CORS middleware)
- Pydantic 2.10.3 - Request/response validation and models
- python-socketio 5.11.4 + python-engineio 4.10.1 - WebSocket/Socket.IO server

**State Management — Frontend:**
- Zustand 5.0.11 with `persist` middleware - global client state in `frontend/src/store/vibeStore.ts`
- `@react-native-async-storage/async-storage` 2.2.0 - Zustand persistence storage

**Navigation — Frontend:**
- `@react-navigation/native` 7.1.6
- `@react-navigation/bottom-tabs` 7.3.10
- `@react-navigation/elements` 2.3.8

**Animation — Frontend:**
- `react-native-reanimated` 3.17.4 (pinned; do NOT upgrade to v4.x — requires worklets + Babel config absent in this project)
- `react-native-gesture-handler` 2.28.0
- `expo-blur` 15.0.8
- `expo-linear-gradient` 15.0.8

**Testing — Frontend:**
- None configured (no jest.config, no vitest.config, no test files detected)

**Testing — Backend:**
- No pytest config detected; manual test scripts exist at root (`backend_test.py`, `comprehensive_merchant_test.py`, etc.)

**Build/Dev — Frontend:**
- Metro bundler (via Expo) - `frontend/metro.config.js`
  - `unstable_enablePackageExports = false` — prevents ESM `import.meta` crash on web
  - `maxWorkers = 2` — resource constraint
  - On-disk FileStore cache at `.metro-cache/`
- EAS Build for native (`expo build:native`)

**Build/Dev — Backend:**
- Docker (`Dockerfile` at repo root) — copies `backend/` into image, runs uvicorn
- Railway builder: `DOCKERFILE` (see `railway.toml`)

## Key Dependencies

**Critical — Frontend:**
- `socket.io-client` 4.8.3 - Real-time venue updates; connected in `vibeStore.ts` via `io(API_URL)`
- `axios` 1.13.4 - HTTP client for all API calls
- `@rnmapbox/maps` 10.2.10 - Mapbox maps (requires `RNMapboxMapsDownloadToken` in `app.json`)
- `expo-location` 19.0.8 - Geolocation for vibe check geofencing
- `expo-notifications` 0.32.16 - Push notification token registration
- `expo-haptics` 15.0.8 - Haptic feedback on tap events
- `expo-sensors` 14.0.2 - Accelerometer for tap velocity / BPM detection
- `date-fns` 4.1.0 - Date formatting
- `react-native-web` 0.21.2 - Web compatibility layer
- `react-native-webview` 13.15.0 - Embedded web content

**Critical — Backend:**
- `motor` 3.6.0 - Async MongoDB driver (`backend/app/config.py` initialises `AsyncIOMotorClient`)
- `pymongo` 4.9.2 - Pinned (motor 3.6.0 constraint; do NOT upgrade)
- `httpx` 0.28.1 - Async HTTP client used for Paystack API calls, Twilio, SendGrid
- `anthropic` >=0.40.0 - Claude AI SDK (lazy import inside route handlers to avoid cold-start errors)
- `python-dotenv` 1.0.1 - `.env` loading in `backend/app/config.py`
- `dnspython` 2.7.0 - MongoDB Atlas SRV DNS resolution

## Configuration

**Frontend Environment:**
- `EXPO_PUBLIC_BACKEND_URL` - Backend API base URL (injected at build time via Expo public env vars)
- Vercel rewrites `/api/*` → `https://vibeapp-production-1835.up.railway.app/api/*` (see `frontend/vercel.json`)
- `.npmrc` at `frontend/`: `legacy-peer-deps=true` (required for `@expo/webpack-config` peer conflict with expo 54)

**Backend Environment:**
- `MONGO_URL` - MongoDB Atlas connection string
- `DB_NAME` - MongoDB database name (default: `vibe_app`)
- `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`
- `ANTHROPIC_API_KEY` - Activates Claude in Night Planner (`backend/app/routes/planner.py`)
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`
- `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`
- `ENVIRONMENT` - `production` disables seed routes

**Build Config Files:**
- `frontend/app.json` - Expo app config (bundle IDs, permissions, plugins, Mapbox token)
- `frontend/tsconfig.json` - TypeScript strict mode; path alias `@/*` → `./*`
- `frontend/metro.config.js` - Metro bundler settings
- `frontend/vercel.json` - Vercel deployment + API rewrites + security headers
- `Dockerfile` - Backend container definition
- `railway.toml` - Railway deploy config (DOCKERFILE builder, restart on failure)
- `nixpacks.toml` - Alternative Railway provider config (Python)

## Platform Requirements

**Development:**
- Node.js (LTS) + yarn 1.22.22 for frontend
- Python 3.11 + pip for backend
- Expo CLI (`expo start`)
- MongoDB Atlas cluster (or local mongod with replica set for Motor async)

**Production:**
- Frontend: Vercel (static web export from `frontend/dist/`)
  - Live URL: `https://vibe-app-hc83.vercel.app`
- Backend: Railway (Docker container)
  - Live URL: `https://vibeapp-production-1835.up.railway.app`
  - Start command: `uvicorn server:socket_app --host 0.0.0.0 --port $PORT`
- Database: MongoDB Atlas (`atlas-copper-cable.pmfjoj0.mongodb.net`, DB: `vibe_app`)
- Mobile: Expo EAS Build for iOS/Android native binaries (`eas.projectId` in `app.json` is placeholder)

---

*Stack analysis: 2026-03-13*
