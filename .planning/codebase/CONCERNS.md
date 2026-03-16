# Codebase Concerns

**Analysis Date:** 2026-03-13

## Tech Debt

**Dual Backend Entry Points (Synchronization Drift):**
- Issue: `backend/api/index.py` (Vercel entry, 3570 lines) and `backend/server.py` (Railway entry, FastAPI) are separate implementations that must be kept in sync manually. `index.py` contains a complete reimplementation of all routes as plain functions, duplicating business logic from `backend/app/routes/`, `backend/app/services/vibe.py`, etc.
- Files: `backend/api/index.py`, `backend/server.py`, `backend/app/routes/ratings.py`, `backend/app/services/vibe.py`
- Impact: Logic bugs fixed in one entry point silently stay broken in the other. The `calculate_vibe_score` in `index.py` (line 52) documents itself as "Mirror of server.py vibe.py" — this comment is the only sync mechanism. New features added to `server.py` routes are not automatically available on Vercel.
- Fix approach: Route all traffic through Railway (the FastAPI instance). Remove Vercel as an API host. The current Vercel `vercel.json` rewrites could point directly to Railway.

**Dead Legacy File:**
- Issue: `backend/server_legacy.py` (2699 lines) is a full copy of an earlier server. It is not imported or referenced anywhere.
- Files: `backend/server_legacy.py`
- Impact: Increases repo size, confuses new contributors, risks someone editing it thinking it is live.
- Fix approach: Delete the file.

**vibeStore.ts God Object:**
- Issue: `frontend/src/store/vibeStore.ts` is 1830 lines. It combines all app state (auth, venues, socket, crew, lobby, DNA, coins, live feeds) and all API-calling actions into a single Zustand store. The interface has 50+ action signatures.
- Files: `frontend/src/store/vibeStore.ts`
- Impact: Any modification risks side effects across unrelated features. The file is too large to hold in context when editing. Circular dependency risk is managed by using `require()` inside action bodies — a workaround symptom of the structural issue.
- Fix approach: Split into domain slices (`authStore`, `venueStore`, `crewStore`, `liveFeedStore`) and compose with Zustand's `combine` or separate `create` calls.

**`total_ratings_24h` Counter Never Resets:**
- Issue: The `total_ratings_24h` field on venues is incremented with `$inc` on every rating but there is no scheduled job, cron task, or TTL-based mechanism to reset it. The field grows indefinitely, making the "24h" label a misnomer after day one.
- Files: `backend/api/index.py` (line 469), `backend/app/services/vibe.py`
- Impact: Pulse tiers (`compute_pulse()` in `index.py` line 133) and city pulse weighting (`city_pulse.py`) are based on this stale counter, producing inflated "activity" scores.
- Fix approach: Add a MongoDB TTL collection that stores rating events and aggregates on-demand, or run a nightly reset job using Railway's scheduled tasks.

**API URL Duplicated Across 42+ Components:**
- Issue: 42 frontend components each define their own `const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || ''` at module scope. There is no shared API client utility.
- Files: `frontend/src/components/AfterHours.tsx`, `frontend/src/components/AIPulseComment.tsx`, `frontend/src/components/AIScoutBriefing.tsx`, `frontend/src/components/ArrivalIntelCard.tsx`, and ~38 others.
- Impact: Changing the env var name or adding a base path requires updating 42+ files. Components bypass `vibeStore`'s `getAuthHeaders()` inconsistently — some attach auth headers, some do not.
- Fix approach: Create `frontend/src/utils/apiClient.ts` with a typed fetch wrapper that reads `API_URL` and attaches auth headers from the store. Migrate all components to use it.

**Venue Type Interface Fragmentation:**
- Issue: The `Venue` interface is defined independently in at least 9 files: `vibeStore.ts`, `VenueCard.tsx`, `MockMap.tsx`, `SwipeRate.tsx`, `VenueDiscoverFlow.tsx`, `VenueSpotlight.tsx`, `VibeMap.tsx`, `VibeMarket.tsx` (as `VibeMarketVenue`). Each has slightly different fields.
- Files: `frontend/src/store/vibeStore.ts` (line 21), `frontend/src/components/VenueCard.tsx` (line 11), `frontend/src/components/MockMap.tsx` (line 167), `frontend/src/components/VenueDiscoverFlow.tsx` (line 33), `frontend/src/components/SwipeRate.tsx` (line 28)
- Impact: `any` casts are used at component boundaries to reconcile type mismatches (e.g., `public/index.tsx` line 103: `useState<any>(null)` for venue). Type-checking does not catch shape mismatches.
- Fix approach: Export one canonical `Venue` type from `frontend/src/types/venue.ts` and import it everywhere.

## Known Bugs

**`_id: None` Inserted into MongoDB on User Create:**
- Symptoms: `handle_create_user` in `index.py` inserts `{**user, "_id": None}` (line 216), which explicitly sets `_id` to `None` in MongoDB. Then `user.pop("_id", None)` cleans up the dict but the document in the database has `_id: null` rather than an auto-generated ObjectId.
- Files: `backend/api/index.py` (line 216)
- Trigger: Every new user registration via Vercel (`POST /api/users`).
- Workaround: The app works because all lookups use the `id` UUID field, not `_id`. But queries that rely on `_id`-based ordering or aggregation will behave unexpectedly.

**Payment Path Trusts Client for Paystack Skip:**
- Symptoms: `handle_skip_cooldown` in `index.py` includes a comment "Payment path — trust client for now (Paystack ref would be verified here)" (line 373). When `method == "payment"`, the Paystack reference is not verified — the skip is granted unconditionally.
- Files: `backend/api/index.py` (lines 366–381)
- Trigger: Any POST to `/api/ratings/skip-cooldown` with `{"method": "payment", "user_id": "...", "venue_id": "..."}`.
- Workaround: None — this is a live security gap allowing free cooldown skips without payment.

**Offline Sync Clears All Pending Ratings on Any Partial Failure:**
- Symptoms: `syncPendingRatings` in `vibeStore.ts` (line 920) calls `set({ pendingRatings: [] })` only if `response.ok`, but the backend sync route (`handle_ratings_sync`) does not return partial success — it bulk-inserts all ratings and returns `{"synced": N}`. If the request itself fails network-level, the ratings remain in `pendingRatings`. However, `handle_ratings_sync` in `index.py` (lines 1005–1019) does not validate geofence or cooldown for offline ratings — it bulk-inserts them all and marks `verified: True` unconditionally.
- Files: `frontend/src/store/vibeStore.ts` (lines 903–926), `backend/api/index.py` (lines 1005–1019)
- Impact: Offline ratings bypass cooldown, geofence, and max-per-day limits. A user could stockpile offline ratings and flood a venue.

## Security Considerations

**Admin Routes in Vercel Entry Have No Auth Check:**
- Risk: `handle_admin_create_venue`, `handle_admin_update_venue`, `handle_admin_delete_venue`, `handle_admin_update_config`, `handle_update_economy_config` in `index.py` perform no authentication or authorization check. Any unauthenticated request can create, edit, or delete venues and change platform economy settings.
- Files: `backend/api/index.py` (lines 1029–1116, route dispatch lines 2648–2661, 2689–2690)
- Current mitigation: None on the Vercel path. FastAPI's `server.py` admin routes do check `is_super_admin`.
- Recommendations: Add `user = get_current_user(headers)` and `if not user or not user.get("is_admin"): return 403, {...}` guards to all admin handlers in `index.py`, matching the protection in `backend/app/routes/admin.py`.

**`/api/seed` Endpoint is Publicly Accessible on Vercel:**
- Risk: `POST /api/seed` (line 2685 in `index.py`) can be called by anyone with no authentication. It checks `if db.venues.count_documents({}) > 0` but an attacker who has deleted all venues (via the unguarded admin delete endpoint above) can re-seed the DB with attacker-controlled admin credentials.
- Files: `backend/api/index.py` (lines 889–920, 2685–2686)
- Current mitigation: FastAPI's `server.py` guards seed behind `ENVIRONMENT != "production"`. `index.py` has no such guard.
- Recommendations: Require super-admin token or remove seed route from `index.py` entirely.

**CORS Wildcard on Both Deployments:**
- Risk: Both `index.py` (line 2997: `Access-Control-Allow-Origin: *`) and `server.py` (line 131: `allow_origins=["*"]`) allow any origin. Combined with `Access-Control-Allow-Credentials: true` in `index.py` (line 3000), this is an invalid combination per browser spec but signals loose security posture.
- Files: `backend/api/index.py` (lines 2997–3000), `backend/server.py` (lines 131–132)
- Recommendations: Restrict origins to `https://vibe-app-hc83.vercel.app` in production.

**Ratings Use Client-Supplied `user_id` Without Auth Token Verification:**
- Risk: `POST /api/ratings` in `index.py` (line 388) looks up `user_id` from the request body, not from the authenticated session. An attacker who knows another user's UUID can submit ratings credited to that user, earning them clout.
- Files: `backend/api/index.py` (lines 384–481)
- Current mitigation: FastAPI's `server.py` rating route uses `rating_data.user_id` from the Pydantic model — same pattern, same vulnerability.
- Recommendations: Extract `user_id` from the validated session token in `get_current_user(headers)` rather than trusting the request body.

**MongoDB `$regex` on User-Supplied City Parameter:**
- Risk: `city` query parameter is inserted directly into a `$regex` query (e.g., `index.py` line 157: `query["city"] = {"$regex": city, "$options": "i"}`). An attacker can supply a ReDoS-triggering regex pattern as the city value, causing exponential backtracking in MongoDB.
- Files: `backend/api/index.py` (lines 157, 494, 2356, 2407)
- Current mitigation: None — no input sanitization or regex escaping.
- Recommendations: Use an exact match `query["city"] = city.lower()` or escape special regex characters before interpolating.

**Anthropic API Key Not Rate-Limited Per User:**
- Risk: Multiple endpoints (`handle_planner_chat`, `handle_venue_ai_pulse`, `handle_crew_ai_intel`, `handle_scout_briefing`) call the Anthropic API. None have per-user rate limiting — only the 15–20 minute MongoDB cache per key. A single user can exhaust the cache key and trigger repeated LLM calls.
- Files: `backend/api/index.py` (lines 771–820, 3085–3141, 3144–3264, 3395–3470)
- Current mitigation: Cache reduces call frequency but does not limit per-user volume.
- Recommendations: Add per-user call limits (e.g., 5 planner requests per hour) tracked in MongoDB.

## Performance Bottlenecks

**Synchronous PyMongo on Vercel Serverless:**
- Problem: `index.py` uses synchronous `pymongo.MongoClient` inside a Vercel serverless function. Each invocation rebuilds the connection if `_db` is `None` (cold start). Vercel's execution model does not guarantee process persistence, so the `_db` global may not be reused between requests in high-concurrency scenarios.
- Files: `backend/api/index.py` (lines 22–40)
- Cause: Vercel's Python serverless handler uses `BaseHTTPRequestHandler` instead of FastAPI ASGI, preventing async Motor client usage.
- Improvement path: Route all API traffic through Railway (async Motor + connection pool). Use Vercel only to serve the frontend static build.

**Venue Aggregate Recalculated on Every Rating:**
- Problem: Every call to `handle_create_rating` in `index.py` (lines 460–470) fetches the 10 most recent ratings and recomputes the venue average synchronously before returning. Under burst load this creates a read-write hot path on the same document.
- Files: `backend/api/index.py` (lines 460–470), `backend/app/services/vibe.py` (`calculate_venue_aggregate`)
- Improvement path: Use MongoDB `$inc` + `$avg` aggregation pipeline or maintain a running average with update operators to avoid the read-then-write pattern.

**MockMap.tsx Renders All Venues Without Virtualization:**
- Problem: `MockMap.tsx` (1165 lines) renders all venues as `<Pressable>` markers simultaneously. There is no virtualization, clustering, or viewport culling.
- Files: `frontend/src/components/MockMap.tsx`
- Cause: Custom canvas/SVG map implementation rather than a native map SDK with built-in marker clustering.
- Improvement path: Add bounding-box filtering to only render venues within the visible viewport, or switch to a native map library with clustering support.

## Fragile Areas

**`server.py` ↔ `index.py` Route Drift:**
- Files: `backend/api/index.py`, `backend/server.py`
- Why fragile: New endpoints added to `server.py`'s FastAPI routers are not automatically available on the Vercel entry point. Features like `rolling_deep`, `quests`, `battles`, `resonance`, `heat_map`, `after_party`, `emoji_pulse` are registered in `server.py` (lines 97–122) but may be absent or diverged in `index.py`. The index.py file has grown to 3570 lines precisely because of this ongoing manual sync.
- Safe modification: After any change to `backend/app/routes/*.py`, check if `index.py` has a corresponding handler. Run the single test file (`backend/tests/test_admin_endpoints.py`) against the Vercel URL to confirm parity.
- Test coverage: Only one integration test file, no parity tests between the two entries.

**`vibeStore.ts` Persist Partializer:**
- Files: `frontend/src/store/vibeStore.ts` (lines 1779–1800)
- Why fragile: The `partialize` function manually lists every field to persist. When a new persisted field is added to `PersistedState`, it must also be added to `partialize` or it silently does not persist across app restarts. The `TransientState` has an `any[]` typed `followedVenues` field (line 276) that is treated as persisted in some code paths.
- Safe modification: When adding a field to `PersistedState`, immediately add it to the `partialize` return object. Strongly type `followedVenues` as `Venue[]`.

**Demo Mode Toggle Scattered Across 197 Reference Sites:**
- Files: `frontend/src/store/vibeStore.ts`, and ~50 component files across `frontend/src/components/`
- Why fragile: `isDemoMode` branches are threaded through 197 locations. Each component independently handles demo mode logic — there is no centralized demo data injection layer. Changes to demo behavior require coordinating edits across dozens of files.
- Safe modification: Do not add new `isDemoMode` branches inside components. Instead, extend the demo data in `frontend/src/data/demoData.ts` and let vibeStore actions return demo data uniformly.

**`/api/seed` Idempotency Guard Is Bypassable:**
- Files: `backend/api/index.py` (lines 889–894)
- Why fragile: The seed guard `if db.venues.count_documents({}) > 0: return` is not atomic. Concurrent seed requests can both pass the check before either inserts data.
- Safe modification: Use a MongoDB `findOneAndUpdate` with `upsert=True` on a `seed_lock` document rather than a count-then-insert pattern.

## Scaling Limits

**In-Memory Rate Limiter:**
- Current capacity: Works correctly for a single Railway dyno process.
- Limit: The `RateLimitStore` in `backend/app/middleware/rate_limit.py` stores all rate limit counters in process memory. With multiple Railway instances or if the process restarts, all counters reset — rate limits can be bypassed by simply hitting a different instance.
- Scaling path: Replace with a Redis-backed rate limiter (e.g., `fastapi-limiter` with `aioredis`).

**MongoDB `total_ratings_24h` As Write Bottleneck:**
- Current capacity: Works for current low-traffic load (~10 seeded venues).
- Limit: Every rating increments the venue document with `$inc`. Under concurrent ratings for a popular venue, this creates a write contention hot spot on a single document.
- Scaling path: Use MongoDB's atomic operators with a write concern of `w:0` for analytics fields, or move counters to Redis with periodic flush to MongoDB.

## Dependencies at Risk

**`react-native-reanimated` Pinned to `~3.17.4`:**
- Risk: Pinned to a specific minor due to v4.x requiring `react-native-worklets` and Babel config changes that do not exist in this project. Upgrading requires significant setup work.
- Impact: Cannot use newer Reanimated APIs or receive security patches in v4.x.
- Migration plan: Add `react-native-worklets` and configure the Babel preset before attempting upgrade. Test on both iOS and Android.

**`pymongo` Pinned to `4.9.2`:**
- Risk: Pinned due to Motor 3.6.0 constraint. Cannot easily upgrade independently.
- Impact: May miss bug fixes in newer pymongo versions.
- Migration plan: Upgrade Motor first; verify pymongo compatibility follows.

## Missing Critical Features

**No Paystack Webhook on Vercel Entry:**
- Problem: Paystack webhooks are handled at `POST /webhook/paystack` in `backend/app/routes/webhooks.py` with proper HMAC signature verification. This route is registered in `server.py` but not implemented in `index.py`. If Vercel is handling any payment callbacks, they will 404.
- Blocks: Wallet top-up confirmation and Vibe+ subscription activation for any user hitting the Vercel deployment.

**No `photo_base64` Size Validation in Ratings Route:**
- Problem: `RatingCreate` Pydantic model accepts `photo_base64: Optional[str]` with no length constraint. The model is used directly in `backend/app/routes/ratings.py` (line 112). Stories have a 500KB check (`backend/app/routes/stories.py` line 44) but ratings do not.
- Blocks: Large base64 payloads can bloat MongoDB documents and slow all venue queries that return rating data.

**Stories Route Not in `index.py`:**
- Problem: `POST /api/stories` and `GET /api/stories/venue/{id}` exist in `backend/app/routes/stories.py` and are registered in `server.py`. They are absent from `index.py`. Frontend's `fetchStories` (vibeStore line 1328) will get a 404 on Vercel users.
- Blocks: Story posting and viewing for the Vercel-hosted frontend.

## Test Coverage Gaps

**No Frontend Tests:**
- What's not tested: All React Native components, all Zustand store actions, all API integration logic, geofence calculations, demo mode data transformations.
- Files: Entire `frontend/src/` directory — no `.test.ts` or `.spec.tsx` files exist.
- Risk: Regressions in core flows (rating submission, auth, offline sync) are undetectable without manual testing.
- Priority: High

**Only One Backend Integration Test File:**
- What's not tested: Rating geofence enforcement, cooldown logic, vibe score calculation, streak computation, Paystack signature verification, Socket.IO event broadcasts, all endpoints in `index.py`.
- Files: `backend/tests/test_admin_endpoints.py` (only file, 393 lines, tests admin endpoints against live Railway URL)
- Risk: The test suite requires the production backend to be running and uses hardcoded test user UUIDs. Any refactor to business logic is untested.
- Priority: High

**No Parity Tests Between `index.py` and `server.py`:**
- What's not tested: Whether the two entry points return identical responses for the same request.
- Files: `backend/api/index.py`, `backend/server.py`
- Risk: Silent divergence between Vercel and Railway behavior for the same user action.
- Priority: Medium

---

*Concerns audit: 2026-03-13*
