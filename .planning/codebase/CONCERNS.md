# Codebase Concerns

**Analysis Date:** 2026-02-24

## Critical Sync Issues

### Entry Point Duplication (HIGH PRIORITY)
**Issue:** Two separate backend entry points must stay in sync but are not currently enforced
- **Files:** `backend/api/index.py` (Vercel, 1403 lines) vs `backend/server.py` (FastAPI) + modular routes
- **Impact:** Vercel entry point uses BaseHTTPRequestHandler pattern to avoid issubclass bug, while Railway uses FastAPI. Any new features added to Railway routes won't be reflected in Vercel deployments. Critical for production parity.
- **Current Status:** Vercel entry point implements many endpoints directly but railway backend has 24+ separate route files (`admin.py`, `merchant.py`, `venues.py`, etc.)
- **Risk:** Merchant and admin features may work on Railway but fail on Vercel, breaking production
- **Fix approach:**
  1. Generate Vercel handler from Railway routes automatically (code generation)
  2. Run parity tests on each build to verify both entry points support same endpoints
  3. Consider consolidating to single FastAPI deployment

---

## Fragile Coupling & Monolithic Components

### Zustand Store Over-Sizing (MEDIUM)
**Issue:** Core state store has grown to 1547 lines with 53+ references to `isDemoMode`
- **File:** `frontend/src/store/vibeStore.ts`
- **Problem:** Store contains mixed concerns: persistence, transient state, demo mode branching, socket.io management, network requests
- **Impact:** Hard to test, circular dependency risks with demoData imports, difficult to refactor
- **Fragility:** Changes to one feature require understanding entire store logic
- **Demo Mode Coupling:** `isDemoMode` is hardwired throughout vibeStore logic with conditional data paths
- **Fix approach:**
  1. Split into 3 stores: `useAuthStore`, `useVenueStore`, `useDemoStore`
  2. Extract demo mode into separate middleware/service
  3. Move network requests to API client layer

### Demo Data Deep Coupling (MEDIUM)
**Issue:** Demo data is deeply coupled to runtime behavior across 53 files
- **Files:** `frontend/src/data/demoData.ts` (986 lines) → imported in vibeStore and 52+ other files
- **Current:** demoData used directly in components and store logic with `require()` inside actions to avoid circular deps
- **Impact:** Cannot easily disable demo mode without breaking features. Adding features requires updating both real and demo code paths
- **Test Problem:** Cannot properly test non-demo paths because isDemoMode is scattered throughout codebase
- **Fix approach:**
  1. Extract demo logic into abstraction layer (factory pattern)
  2. Create mock adapters instead of conditional branches
  3. Use feature flags instead of isDemoMode boolean

### Component Size Issues (MEDIUM)
**Issue:** Multiple frontend components exceed healthy size boundaries
- **Files:**
  - `MockMap.tsx` (1066 lines) - handles markers, animations, tooltips, crew pins
  - `RateVibeModal.tsx` (881 lines) - rating submission + photo capture
  - `NightPlannerModal.tsx` (566 lines) - keyword scoring + Claude API + rule-based path
  - `DemoTutorial.tsx` (561 lines) - onboarding animations
- **Impact:** Hard to test, reuse, or modify without side effects. Single points of failure
- **Fix approach:**
  1. Extract MockMap into: MarkerLayer, TooltipLayer, SeismicRings, CrewPinLayer
  2. Split RateVibeModal: PhotoCapture → separate component, EnergySelector → reusable
  3. Extract NightPlanner AI/Rules logic into services

---

## Security Concerns

### Session Token Generation (MEDIUM)
**Issue:** Session tokens are simple UUIDs without additional entropy or signing
- **Files:** `backend/app/services/auth.py` (line 14), `backend/api/index.py` (line 163)
- **Current:** `session_token = str(uuid.uuid4())` — theoretically predictable if RNG is weak
- **Risk:** Token collision or prediction in high-traffic scenarios. No token signing/verification.
- **Impact:** Session hijacking possible if token database is ever compromised (tokens are plaintext in MongoDB)
- **Fix approach:**
  1. Use cryptographically secure token generation: `secrets.token_urlsafe(32)`
  2. Add JWT signing with secret key: `HS256(token, SECRET_KEY)`
  3. Store token hash in DB, not plaintext: `hash(token)` before DB insert

### No Rate Limiting on Vercel Entry Point (MEDIUM)
**Issue:** Vercel `backend/api/index.py` lacks rate limiting middleware
- **File:** `backend/api/index.py` (no rate limiting code)
- **Comparison:** Railway backend has `RateLimitMiddleware` in `server.py` (line 76)
- **Impact:** Vercel deployments vulnerable to brute force (auth), DoS (endpoints), rating spam
- **Current Risk:** Unprotected endpoints: `/api/users` (create user), `/api/auth/session`, `/api/ratings` (submit rating)
- **Fix approach:**
  1. Implement simple in-memory or Redis rate limiter in Vercel handler
  2. Key by IP address for anonymous, by user_id for authenticated
  3. Return 429 with `Retry-After` header

### Geofence Bypass in Demo Mode (LOW-MEDIUM)
**Issue:** Demo mode may bypass location verification for ratings
- **Files:** `backend/api/index.py` (line 398-405) geofence check happens even in demo
- **Current:** Code checks geofence distance but no clear demo mode override
- **Risk:** Demo user behavior not representative of real constraints. QA might pass tests that fail in prod
- **Testing Impact:** Can't verify geofence validation works if demo mode allows bypasses
- **Fix approach:**
  1. Document explicit demo mode behavior per endpoint
  2. Add logging when geofence is bypassed (if applicable)
  3. Create separate demo-aware test endpoints

---

## Performance & Scalability

### MongoDB Queries Without Aggregation Optimization (MEDIUM)
**Issue:** Night Planner endpoint scans 30 venues and filters in-memory
- **File:** `backend/api/index.py` line 723: `list(db.venues.find({"city": city}, {"_id": 0}).limit(30))`
- **Then:** Keywords matched in Python loops (line 763-775) instead of MongoDB query
- **Impact:** As venue count grows, this becomes O(n) in Python instead of MongoDB-optimized search
- **Risk:** With 1000+ venues per city, this endpoint will slow significantly
- **Fix approach:**
  1. Push keyword scoring to MongoDB aggregation pipeline: `$regex` text search
  2. Use MongoDB full-text indexes on venue fields
  3. Cache scored results in Redis for repeated queries

### Icon/Image Handling on MockMap (LOW)
**Issue:** Custom venue icons potentially not loading due to no fallback
- **File:** `frontend/src/components/MockMap.tsx` (line 341) checks `active_pulse_tier` but no image fallback
- **Risk:** If icon URLs 404, map markers break silently
- **Impact:** Visual degradation on slower networks
- **Fix approach:** Add image loading error boundary + fallback icon

### Socket.IO Connection Not Cleanly Managed (LOW-MEDIUM)
**Issue:** vibeStore Socket.IO connection lifecycle unclear
- **File:** `frontend/src/store/vibeStore.ts` - connectSocket/disconnectSocket methods exist but no cleanup on route changes
- **Risk:** Memory leaks if component mounts/unmounts frequently. Multiple socket connections may be created
- **Impact:** Realtime updates may stop working or become duplicated
- **Fix approach:**
  1. Add socket cleanup in store destruction
  2. Ensure socket connects once and reuses
  3. Add heartbeat/ping to detect stale connections

---

## Type Safety & Errors

### Pre-Existing TypeScript Errors (LOW)
**Issue:** Known type conflicts not resolved
- **Files:**
  - `frontend/app/(tabs)/index.tsx` - Venue type conflict (mentioned in memory)
  - `frontend/src/components/MockMap.tsx` line 361 - `@ts-ignore` for web events (onMouseEnter)
  - Merchant style types undefined
- **Impact:** TypeScript compilation succeeds with errors hidden. Makes future changes risky.
- **Fix approach:**
  1. Create proper React Native Web event types
  2. Define merchant-specific styling types
  3. Resolve Venue interface conflicts (likely multiple definitions)

### Missing Error Boundaries (HIGH)
**Issue:** No error boundaries detected in frontend codebase
- **Grep result:** No ErrorBoundary components found
- **Risk:** Single component crash crashes entire app (on both native & web)
- **Critical Paths:** These should have boundaries:
  - Map rendering (`MockMap.tsx`) - if data is malformed, whole app stops
  - Rating submission flow - if request fails, entire modal breaks
  - Night Planner AI integration - if Claude API fails, entire modal stuck
- **Fix approach:**
  1. Create `ErrorBoundary.tsx` wrapper component
  2. Wrap: MockMap, RateVibeModal, NightPlannerModal, ProfileScreens
  3. Add error logging to Sentry/error service

### Unhandled API Failure Cases (MEDIUM)
**Issue:** Many endpoints return graceful fallbacks but some don't
- **File:** `backend/api/index.py` line 572-573 - Oracle endpoint returns `{"insufficient_data": true}` on DB failure
- **File:** `backend/api/index.py` line 645 - DNA endpoint returns `{"insufficient_data": true}` gracefully
- **But:** Vercel handler missing try-catch in multiple places (lines 1357-1361 for GET, 1363-1372 for POST)
- **Risk:** Unhandled exceptions return 500 with internal error messages
- **Fix approach:**
  1. Wrap all route handlers in consistent error handling
  2. Log errors server-side, return generic user messages
  3. Add middleware for global error handling

---

## Missing Features & Gaps

### No User Analytics Endpoint (LOW)
**Issue:** Admin panel has placeholder for user analytics
- **File:** `frontend/app/(admin)/index.tsx` line 339 - TODO comment: `// User Analytics (mock for now - TODO: create endpoint)`
- **Current:** Falls back to mock data if endpoint missing
- **Impact:** Admin cannot see real user cohort data. Investor dashboards show fabricated numbers.
- **Fix approach:**
  1. Create `/api/admin/user-analytics` endpoint
  2. Aggregate by cohort: tier distribution, retention, churn
  3. Implement caching (updated hourly)

### Merchant Onboarding Incomplete (MEDIUM)
**Issue:** Manual venue assignment needed for new merchants
- **Memory note:** "Merchant venue onboarding (manually add venues for new merchants)"
- **Current:** Admin has UI but flow not automated
- **Impact:** Onboarding friction. New merchants stuck without venue access.
- **Fix approach:**
  1. Create merchant signup flow: phone auth → venue name input → admin approval
  2. Auto-assign venue_id on approval
  3. Send notification email on approval

### No Unit Tests for Core Business Logic (HIGH)
**Issue:** Core logic not covered by unit tests
- **Memory note:** "Unit tests for core business logic" marked as pending
- **Impact:** Regressions go undetected. Rating cooldown, clout calculation, vibe scoring could be broken
- **Risk Areas:**
  - `calculate_vibe_score()` - weighting formula could be wrong
  - Cooldown logic - edge cases with timezones
  - Clout multiplier during pulse drops - complex state
- **Fix approach:**
  1. Create `tests/test_vibe_scoring.py`
  2. Test: cooldown edge cases, clout math, energy level thresholds
  3. Mock MongoDB for isolation

---

## Technical Debt

### Vercel Handler Too Large (MEDIUM)
**Issue:** Single monolithic file with 1403 lines
- **File:** `backend/api/index.py`
- **Current:** All route logic, helper functions, handlers inline
- **Problem:** Difficult to navigate, test, or maintain. Changes risk regressions.
- **Fix approach:**
  1. Refactor into modular handler classes
  2. Keep handler thin: just request parsing + routing + response formatting
  3. Import handlers from separate modules matching Railway structure

### Duplicated Validation Logic (MEDIUM)
**Issue:** Same validation repeated across Vercel and Railway
- **Files:**
  - `backend/api/index.py` line 407-413 - energy validation
  - `backend/api/index.py` line 408 - "good_vibes" → "buzzing" legacy mapping
  - Likely repeated in railway routes
- **Risk:** Bug fix in one place doesn't propagate to other
- **Fix approach:**
  1. Extract validators to shared `app/validators.py`
  2. Import in both Vercel and Railway handlers
  3. Single source of truth

### Missing Integration Tests (MEDIUM)
**Issue:** No tests for full request → response flow
- **Test Files:** `backend_test.py`, `detailed_test.py`, etc. seem to be manual scripts, not automation
- **Risk:** Deployment breaks workflow chains (e.g., rating submission → leaderboard update)
- **Fix approach:**
  1. Create `tests/integration/` with realistic workflows
  2. Test: auth → rate venue → check cooldown → claim streak
  3. Run before deployment

---

## Scaling Limits

### Single MongoDB Instance (LOW-MEDIUM)
**Issue:** No sharding or replica set mentioned
- **Current:** `MONGO_URL` single connection string
- **Capacity:** Will hit limits with 100k+ users
- **Risk:** No failover if primary fails, no geographic distribution
- **Fix approach:**
  1. Set up MongoDB replica set (3 nodes minimum)
  2. Plan for sharding on user_id or city
  3. Add read replicas for analytics queries

### Real-Time Broadcasts to All Clients (LOW)
**Issue:** Socket.IO broadcasts may not scale efficiently
- **File:** `backend/app/services/realtime.py` (mentioned in server.py imports)
- **Risk:** With 10k+ concurrent users, broadcasting every venue update causes bottleneck
- **Fix approach:**
  1. Implement room-based subscriptions (per city/venue)
  2. Use Redis pub/sub instead of in-memory for horizontal scaling
  3. Batch updates instead of real-time per change

---

## Known Bugs & Workarounds

### Metro Cache Stale References (LOW)
**Issue:** `.metro-cache` may have stale references after code changes
- **Status:** Documented as "normal" in memory
- **Symptom:** Old imports still referenced despite deletion
- **Workaround:** Clear `.metro-cache` manually
- **Fix approach:** Add pre-build script to clear cache

### Pre-Commit Hook TypeScript Errors Ignored (LOW)
**Issue:** TS linting errors not blocking commits
- **Risk:** Known type errors accumulate
- **Fix approach:** Add strict pre-commit hook to fail on TS errors

### `react-native/no-raw-text` False Positives (LOW)
**Issue:** Linter fires on JS string literals in object maps
- **Status:** Documented as all false positives
- **Workaround:** Ignore rule currently
- **Fix approach:** Use component wrapper or upgrade eslint-plugin-react-native

---

## Recommendations by Priority

### Immediate (This Sprint)
1. **Entry Point Sync** - Add CI test to verify Vercel and Railway support same endpoints
2. **Rate Limiting** - Add basic rate limiter to Vercel handler (IP-based, Redis-backed)
3. **Error Boundaries** - Wrap critical UI components to prevent full app crashes
4. **Session Token** - Switch to cryptographically secure tokens + JWT signing

### Short Term (1-2 Sprints)
1. **Zustand Store Refactoring** - Split into 3 focused stores
2. **Component Splitting** - Break down 1000+ line components
3. **Demo Mode Abstraction** - Extract into middleware layer
4. **Unit Tests** - Add core business logic test suite

### Medium Term (1 Month)
1. **Merchant Onboarding** - Automate venue assignment flow
2. **User Analytics** - Implement missing admin endpoint
3. **MongoDB Aggregation** - Optimize Night Planner queries
4. **Integration Tests** - Build full workflow test suite

### Long Term (Planning)
1. **Entry Point Consolidation** - Consider single FastAPI deployment only
2. **MongoDB Sharding** - Plan for 100k+ users
3. **Real-Time Scaling** - Migrate to Redis pub/sub + room-based subscriptions
4. **Architecture Split** - Separate Public/Merchant/Admin into independent deployments

---

*Concerns audit: 2026-02-24*
