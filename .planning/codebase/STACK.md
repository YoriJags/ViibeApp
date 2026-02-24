# Technology Stack

**Analysis Date:** 2026-02-24

## Languages

**Primary:**
- TypeScript 5.8.3 - Frontend (React Native/Expo)
- Python 3.11 - Backend (FastAPI)

**Secondary:**
- JavaScript - Build configuration (metro.config.js, babel)

## Runtime

**Environment:**
- Node.js / Expo 54.0.33 - Frontend development and web deployment
- Python 3.11 - Backend (FastAPI via uvicorn)

**Package Manager:**
- yarn 1.22.22+sha512 - Frontend (specified in package.json)
- pip - Backend Python dependencies

## Frameworks

**Core:**
- Expo Router 5.1.4 - File-based routing (frontend)
- React 19.1.0 - UI framework
- React Native 0.81.5 - Cross-platform mobile
- FastAPI 0.115.5 - Backend HTTP framework
- Starlette 0.41.3 - ASGI web framework (FastAPI foundation)

**State Management:**
- Zustand 5.0.11 - Frontend state management with persist middleware
- AsyncStorage (via @react-native-async-storage/async-storage 2.2.0) - Persistent client-side storage

**Styling & UI:**
- expo-linear-gradient 15.0.8 - Gradient components
- expo-blur 14.1.5 - Blur effects
- @expo/vector-icons 14.1.0 - Icon library

**Navigation & Routing:**
- expo-router 5.1.4 - File-based routing for React Native
- @react-navigation/bottom-tabs 7.3.10 - Tab navigation
- @react-navigation/native 7.1.6 - Navigation framework
- @react-navigation/elements 2.3.8 - Navigation UI elements
- expo-linking 7.1.7 - Deep linking

**Real-time Communication:**
- socket.io-client 4.8.3 - WebSocket client (frontend)
- python-socketio 5.11.4 - Socket.IO server (backend)
- python-engineio 4.10.1 - Engine.IO transport layer (backend)

**HTTP Client:**
- axios 1.13.4 - Frontend HTTP requests
- httpx 0.28.1 - Python async HTTP client (backend)

**Data Handling:**
- Motor 3.6.0 - Async MongoDB driver (backend)
- pymongo 4.9.2 - Synchronous MongoDB driver (pinned for Vercel compatibility)
- dnspython 2.7.0 - DNS resolution for MongoDB Atlas

**Validation & Serialization:**
- Pydantic 2.10.3 - Data validation and serialization (backend)

**Testing:**
- expo lint - ESLint configuration (eslint 9.25.0)
- eslint-config-expo 9.2.0 - Expo ESLint rules

**Build & Dev:**
- @expo/webpack-config 19.0.1 - Webpack configuration for Expo web
- @expo/metro-runtime 6.1.2 - Metro bundler runtime
- @expo/ngrok 4.1.3 - Public tunneling for development
- Babel 7.25.2 - JavaScript transpiler
- TypeScript 5.8.3 - Type checking

**Native/Platform-Specific:**
- expo-location 19.0.8 - Geolocation
- expo-image-picker 17.0.10 - Image selection
- expo-haptics 14.1.4 - Haptic feedback
- expo-notifications 0.32.16 - Push notifications
- expo-image 2.4.0 - Image rendering
- expo-constants 17.1.7 - Device constants
- expo-font 13.3.2 - Font loading
- expo-system-ui 5.0.10 - System UI customization
- expo-splash-screen 0.30.10 - Splash screen
- expo-status-bar 2.2.3 - Status bar control
- react-native-safe-area-context 5.4.0 - Safe area handling
- react-native-screens 4.11.1 - Native screen components
- react-native-gesture-handler 2.24.0 - Gesture recognition
- react-native-reanimated 3.17.4 - Animations
- react-native-web 0.21.2 - React Native for web
- react-native-webview 13.13.5 - WebView component

**Utilities:**
- date-fns 4.1.0 - Date manipulation and formatting
- react-native-dotenv 3.4.11 - Environment variable loading

**AI Integration:**
- anthropic >=0.40.0 - Claude API client (backend, optional for Night Planner feature)

**Configuration:**
- python-dotenv 1.0.1 - Environment variable loading (backend)

## Configuration

**Environment:**
- `.env` file in frontend/ - Contains EXPO_PUBLIC_BACKEND_URL
- `.env` file in backend/ - Contains MONGO_URL, DB_NAME, PAYSTACK_SECRET_KEY, PAYSTACK_PUBLIC_KEY, ANTHROPIC_API_KEY (optional)
- No .nvmrc or .python-version files (relies on package.json packageManager field and runtime declarations)

**Build:**
- `frontend/metro.config.js` - Metro bundler config (uses on-disk FileStore cache, disables package exports for ESM compatibility)
- `backend/vercel.json` - Vercel serverless deployment config (Python 3.11, 15mb lambda limit)
- `frontend/vercel.json` - Frontend SPA deployment with rewrites to Railway backend
- `railway.toml` - Railway deployment config (uses NIXPACKS builder, uvicorn start command)
- `nixpacks.toml` - Nixpacks build definition (Python provider, pip install)
- `frontend/tsconfig.json` - TypeScript configuration
- `frontend/app.json` - Expo config (icon, splash, permissions, Google Maps API key placeholders)
- `eslint.config.js` - ESLint configuration for frontend

## Platform Requirements

**Development:**
- Windows 11 Pro (dev machine) with Windows Subsystem for Linux for shell compatibility
- Node.js (modern LTS, yarn 1.22.22)
- Python 3.11+
- Expo development tools

**Production:**
- Frontend: Vercel (static web hosting, SPA with rewrites to API)
- Backend: Railway (Python app via NIXPACKS with uvicorn)
- MongoDB: MongoDB Atlas cloud database (seeded with 10 Lagos venues)

## Key Deployment Targets

**Frontend:**
- `https://vibe-app-hc83.vercel.app` - Expo web build
- Built via `yarn build` → `expo export -p web`
- Output directory: `dist/`

**Backend:**
- `https://vibeapp-production.up.railway.app` - FastAPI via uvicorn
- Entry: `backend/api/index.py` (Vercel serverless OR `backend/server.py` (Railway async)
- Port: $PORT (Railway-provided)

---

*Stack analysis: 2026-02-24*
