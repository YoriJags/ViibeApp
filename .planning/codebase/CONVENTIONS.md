# Coding Conventions

**Analysis Date:** 2026-03-13

## Naming Patterns

**Files:**
- React components: PascalCase TSX files — `DailyPulseCard.tsx`, `VenueBattle.tsx`, `VibePassport.tsx`
- Utility modules: camelCase TS files — `vibeMaster.ts`, `sceneIntel.ts`, `hapticVibe.ts`
- Route files (backend): snake_case Python — `venue_live.py`, `ai_features.py`, `pulse_drops.py`
- Expo Router pages: camelCase TSX in route groups — `index.tsx`, `crew.tsx`, `trending.tsx`

**Functions (TypeScript):**
- Components: PascalCase — `export default function DailyPulseCard(...)`
- Hooks: camelCase with `use` prefix — `useVibeStore`, `useResponsive`
- Helpers/utilities: camelCase — `generateDailyPulse`, `getSceneIntel`, `calculateDistance`
- Store actions: camelCase verbs — `fetchVenues`, `createUser`, `loginUser`, `submitRating`

**Functions (Python):**
- Public route handlers: snake_case async functions — `create_rating`, `get_current_user`
- Private helpers: underscore-prefixed — `_update_venue_scores`, `_check_burst`, `_is_dark_spot`
- Service functions: snake_case — `calculate_vibe_score`, `compute_scout_credibility`

**Variables:**
- TypeScript: camelCase — `isDemoMode`, `pulseAnim`, `getAuthHeaders`
- Python: snake_case — `venue_id`, `session_token`, `rating_data`
- Constants: SCREAMING_SNAKE_CASE in both languages — `API_URL`, `DEMO_BATTLE`, `PULSE_DROP_TIERS`, `MAX_RATINGS_PER_VENUE_PER_DAY`

**Types/Interfaces:**
- TypeScript interfaces: PascalCase — `DailyPulseCardProps`, `BattleVenue`, `SceneInput`
- Props interface naming: either `interface Props` (simple) or `interface ComponentNameProps` (when exported)
- Python Pydantic models: PascalCase — `User`, `Venue`, `RatingCreate`, `AirdropRequest`
- Python type hints: stdlib `Literal`, `Optional` — `Literal["club", "lounge", "bar"]`

**React Native Record Maps:**
- Named with SCREAMING_SNAKE_CASE, typed as `Record<string, ...>` — `ENERGY_COLORS`, `PERSONA_COLORS`, `HEAT_COLORS`, `TIER_CONFIG`

## Code Style

**Formatting:**
- No Prettier config found — formatting enforced via ESLint (expo flat config at `frontend/eslint.config.js`)
- Expo ESLint preset: `eslint-config-expo/flat` via `defineConfig`
- Python: no formatter config detected; standard Python formatting conventions followed

**Linting:**
- Frontend: `expo lint` command (`frontend/package.json` scripts)
- Config: `frontend/eslint.config.js` — uses `expoConfig` with `dist/*` ignored
- Known suppressed false positives: `react-native/no-raw-text` fires on JS string literals in Record objects — ignore these
- TypeScript strict mode enabled in `frontend/tsconfig.json` (`"strict": true`)
- Pre-existing TS errors exist: Venue type conflict in `app/(public)/index.tsx`, merchant style types, `MockMap` cursor

**Backend:**
- No linter config detected in `backend/`; code follows PEP 8 conventions

## Import Organization

**TypeScript (observed pattern):**
1. React and React Native stdlib — `import React, { useEffect, useState } from 'react'` then RN primitives
2. Expo SDK packages — `expo-blur`, `expo-haptics`, `expo-linear-gradient`
3. Third-party libs — `@expo/vector-icons`, `socket.io-client`
4. Local store — `import { useVibeStore } from '../store/vibeStore'`
5. Local components — `import AvatarDisplay from './AvatarDisplay'`
6. Local utils/theme — `import { publicTheme, spacing } from '../theme/floors'`

**Python (observed pattern):**
1. stdlib — `from typing import Optional`, `from datetime import datetime`
2. FastAPI/third-party — `from fastapi import APIRouter, HTTPException`
3. Internal app modules — `from app.config import db`, `from app.models import Rating`
4. Internal services — `from app.services.vibe import calculate_vibe_score`

**Path Aliases:**
- `@/*` maps to `./` (repo root of `frontend/`) — defined in `frontend/tsconfig.json`
- In practice, components use **relative paths** (`../store/vibeStore`, `./AvatarDisplay`) not the `@/` alias
- Expo Router pages use relative paths to `src/` — `'../../src/store/vibeStore'`

## Error Handling

**Frontend (TypeScript):**
- API calls wrapped in `try { } catch { }` — catch blocks are often empty (`catch {}`) to silently swallow network errors
- Store actions (`vibeStore.ts`) use `try/catch` with `console.error('Error [action]:', error)` in the catch
- Fetch pattern: check `response.ok` before consuming JSON; on failure, set loading state or return `false`/`null`
- HTTP status-specific handling: `if (res.status === 429) { setTapped(side); }` for rate limit
- `ErrorBoundary` component exists at `frontend/src/components/ErrorBoundary.tsx` for render errors

**Backend (Python):**
- Route handlers raise `HTTPException` directly — no try/except at route level unless wrapping external calls
- Auth errors: `raise HTTPException(status_code=401, detail="Not authenticated")`
- Permission errors: `raise HTTPException(status_code=403, detail="Super admin access required")`
- Not found: `raise HTTPException(status_code=404, detail="Venue not found")`
- Validation errors: `raise HTTPException(status_code=400, detail="...")`
- Rate limiting: `raise HTTPException(status_code=429, detail="...", headers={"X-Cooldown-Remaining": str(remaining)})`
- AI/Claude calls wrapped in try/except with `logger.warning(f"Claude failed: {e}")` and fallback to rule-based response

## Logging

**Backend:**
- Logger: Python stdlib `logging` — `logger = logging.getLogger('vibe_app')` in `backend/app/config.py`
- Format: `%(asctime)s - %(name)s - %(levelname)s - %(message)s`
- Usage: `logger.info(...)`, `logger.warning(...)`, `logger.error(...)` — only in config, middleware, routes with AI/push calls
- Most route handlers do **not** log; only error paths and infra events are logged

**Frontend:**
- `console.error('Error [action]:', error)` in Zustand store catch blocks
- `console.warn(...)` for non-critical issues (e.g., network unavailable during city fetch)
- Components generally have no logging — errors are silent (`catch {}`)

## Comments

**When to Comment:**
- File-level JSDoc block at top of every component and utility — describes purpose and usage
- Section dividers using `// ==================== SECTION NAME ====================` in theme/config files
- Section dividers using `// ── Section name ──` (Unicode dashes) in utility files like `sceneIntel.ts`
- Inline comments for non-obvious logic — animation sequences, rate-limit logic, timezone conversions
- `# ===== Section =====` dividers in Python files

**JSDoc/TSDoc:**
- JSDoc-style blocks on utility functions in `src/utils/` — includes `@returns` annotation (`geo.ts`, `responsive.ts`, `sceneIntel.ts`)
- `/** Multi-line description */` blocks on components with brief purpose + behavior description
- Python: triple-quoted docstrings on all modules, classes, and service functions

## Function Design

**Size:** Functions generally short (< 50 lines). Longer components exist but are exceptions; `(public)/index.tsx` is 1,339 lines and should be split.

**Parameters:** Components receive typed `Props` interface. Utility functions use named positional args. Store actions use minimal params — `fetchVenue(id: string)`.

**Return Values:**
- Store async actions return `boolean` (success/fail) or `null`/typed object
- Utility functions return typed values — `string`, `number`, `ResponsiveInfo`
- Python route handlers return `dict` — FastAPI auto-serializes to JSON

## Module Design

**Exports:**
- React components: `export default function ComponentName(...)` — single default export per file
- Utilities: named exports — `export const calculateDistance`, `export function getSceneIntel`
- Some utility files also have a default export object aggregating named exports (e.g., `responsive.ts`)
- Store: `export { useVibeStore }` as named export; some interfaces exported too (`export interface ActiveCheckin`)

**Barrel Files:**
- Theme has `frontend/src/theme/index.ts` re-exporting from `floors.ts` and `styles.ts`
- No barrel files in `components/`, `utils/`, or `data/` — each module imported directly

## TypeScript Specifics

**`any` usage:**
- ~103 occurrences of `any` in components — primarily `as any` casts for Ionicons icon names (type safety gap in `@expo/vector-icons`)
- `AnimatedTabBar.tsx` uses `state: any; descriptors: any; navigation: any` for React Navigation internals
- Acceptable pattern: `as any` for Ionicons names, `as any` on Animated interpolated values passed to style props

**Animation pattern:**
- All animation values: `useRef(new Animated.Value(N)).current` at top of component
- Loops: `Animated.loop(Animated.sequence([...]))`.start() in `useEffect`
- `useNativeDriver: true` for transform/opacity; `useNativeDriver: false` for color/layout props

**Demo mode pattern:**
- Components accept `isDemoMode?: boolean` prop
- Pattern: `if (isDemoMode) { return DEMO_DATA; }` before API fetch
- Demo data objects colocated with component or imported from `frontend/src/data/demoData.ts`

---

*Convention analysis: 2026-03-13*
