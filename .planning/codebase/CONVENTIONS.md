# Coding Conventions

**Analysis Date:** 2026-02-24

## Naming Patterns

**Files:**
- React components: PascalCase, one component per file (e.g., `RateVibeModal.tsx`, `VenueCard.tsx`, `GlassCard.tsx`)
- Utilities/hooks: camelCase (e.g., `demoData.ts`, `vibeStore.ts`)
- Backend routes: snake_case module names (e.g., `users.py`, `ratings.py`, `pulse_drops.py`)
- Backend services: snake_case modules (e.g., `vibe.py`, `auth.py`, `streaks.py`)
- Backend models: `models.py` — all Pydantic model classes defined centrally

**Functions:**
- TypeScript: camelCase (e.g., `fetchVenues`, `submitRating`, `handleSelect`, `calculateDistance`)
- Python: snake_case (e.g., `calculate_vibe_score`, `is_within_geofence`, `ensure_indexes`)
- Zustand actions: camelCase (e.g., `setUser`, `updateVenue`, `fetchLobby`, `toggleDemoMode`)
- Event handlers: prefix with `handle` or `on` (e.g., `handleSubmit`, `onPress`, `handleSelect`, `onClose`)

**Variables:**
- TypeScript state: camelCase (e.g., `energy`, `capacity`, `gate`, `venueSpec`)
- React hooks state: camelCase (e.g., `const [loading, setLoading] = useState(false)`)
- Python constants: UPPER_SNAKE_CASE (e.g., `MAX_RATINGS_PER_VENUE_PER_DAY`, `GEOFENCE_RADIUS_METERS`, `SESSION_EXPIRY_DAYS`)
- Type/Interface names: PascalCase (e.g., `RateVibeModalProps`, `EmojiOption`, `VibeStore`)

**Types:**
- Pydantic models: PascalCase (e.g., `User`, `Venue`, `Rating`, `Coordinates`)
- Literal unions use snake_case values (e.g., `Literal["chill", "popping", "electric"]`, `Literal["spark", "flare", "supernova"]`)
- TypeScript interfaces: PascalCase, suffix `Props` for component props (e.g., `RateVibeModalProps`, `VenueCardProps`)

## Code Style

**Formatting:**
- Frontend: TypeScript 5.8.3, React Native with Expo 54
- No explicit prettier config — uses ESLint flat config for linting
- Line length: Implicit convention ~80-100 characters
- Indentation: 2 spaces (TypeScript), 4 spaces (Python)

**Linting:**
- Frontend: `eslint-config-expo` v9.2.0 with ESLint 9.25.0
- Config file: `frontend/eslint.config.js` (flat config format)
- Rule: `react-native/no-raw-text` triggers false positives on JS string literals in object maps — these are safe to ignore
- Pre-existing TS errors in `tsc_errors.txt`: Venue type conflicts in `index.tsx`, merchant style types, MockMap cursor — acknowledged but not blocking

**Backend:**
- Python 3.x, FastAPI with async/await
- Pydantic v2 for model validation
- No explicit formatter — follows Python conventions (PEP 8 style)

## Import Organization

**TypeScript/React:**
Order:
1. External React/Expo imports (React, React Native, Expo modules)
2. Third-party libraries (zustand, socket.io-client, date-fns, axios)
3. Local absolute imports using `@/` alias (components, store, data, theme)
4. Local relative imports (sibling files, styles)

**Path Aliases:**
- `@/*` maps to `frontend/` root (configured in `tsconfig.json`)
- Used throughout components: `import { useVibeStore } from '@/store/vibeStore'`

**Python:**
Order:
1. Standard library (os, logging, asyncio, datetime, etc.)
2. Third-party (fastapi, motor, pydantic, socketio, pymongo)
3. Local app imports (from app.config, from app.models, from app.services)

## Error Handling

**Frontend:**
- Try/catch blocks wrap async operations (fetch, store actions)
- Errors logged to console with `console.error('Operation name:', error)`
- User-facing errors returned in store state (e.g., `setError()`)
- HTTP errors caught with `response.ok` checks before parsing JSON
- Fallback messages for network errors: `'Connection error'`, `'Failed to fetch venues'`

**Backend:**
- `HTTPException` raised for client errors with appropriate status codes
  - 404: Resource not found
  - 403: Permission denied (geofence violations)
  - 429: Rate limited
  - 400: Bad request (validation)
- Error details passed in `detail` field: `HTTPException(status_code=403, detail="...")`
- Server errors logged via `logger.error()` but not exposed to client
- Route handlers catch exceptions and re-raise with user-friendly messages

**Example (Frontend - `vibeStore.ts`):**
```typescript
try {
  const response = await fetch(`${API_URL}/api/ratings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ratingData),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || 'Failed to submit rating');
  }

  return data;
} catch (error) {
  console.error('Error submitting rating:', error);
  throw error;
}
```

**Example (Backend - `ratings.py`):**
```python
venue = await db.venues.find_one({"id": rating_data.venue_id})
if not venue:
    raise HTTPException(status_code=404, detail="Venue not found")

if not is_within_geofence(rating_data.coordinates, venue_coords, radius_m=venue_radius):
    raise HTTPException(
        status_code=403,
        detail=f"You must be within {int(venue_radius)}m of the venue to rate.",
    )
```

## Logging

**Framework:**
- Frontend: `console.log()`, `console.error()` for client-side logging
- Backend: Python `logging` module with centralized config in `app/config.py`

**Patterns:**
- Backend logs initialized with `logger = logging.getLogger('vibe_app')`
- Socket.IO events logged at key connection points: `console.log('Socket connected')`
- Error logs always include operation context: `logger.error('Operation name:', error)`
- Demo mode transitions logged: `console.log('Entering demo mode')`

## Comments

**When to Comment:**
- Complex business logic (e.g., time-decay vibe score calculation, geofence validation)
- Non-obvious algorithm choices (e.g., Haversine formula for distance)
- Workarounds or known limitations (e.g., ".metro-cache stale refs after code changes — normal")
- Sections marked with heading dividers for clarity

**JSDoc/TSDoc:**
- Component props documented with inline interface comments (implicit)
- Function parameters described via TypeScript types (types as documentation)
- No dedicated JSDoc blocks in use — rely on type hints

**Example (Backend - `vibe.py`):**
```python
def calculate_vibe_score(energy: str, capacity: str, gate: str) -> float:
    """Calculate a 0-100 vibe score from the three rating dimensions.
    Energy: chill(1) < buzzing(1.5) < popping(2) < electric(3)
    Capacity: sparse(1) < vibrant(2) < full(3)
    Gate: blocked(1) < slow(2) < clear(3)
    """
    # Scoring weights...
```

**Example (Frontend - Component header):**
```typescript
/**
 * RateVibeModal — World-Class Rating Experience
 *
 * Emoji-first option cards, venue-type-specific 4th dimension,
 * 2×2 energy grid, haptic feedback, neon glow, drag-to-dismiss.
 */
```

## Function Design

**Size:**
- Target: 20–50 lines for most functions
- Store actions (`vibeStore.ts`): Often 15–40 lines, some async operations span 30–50 lines
- Complex flows (e.g., `submitRating`, `fetchLobby`): 40–80 lines including error handling
- One responsibility per function

**Parameters:**
- Use TypeScript/Pydantic types to enforce structure
- Zustand actions use destructuring from `state` and `get()`: `(set, get) => ({ ... })`
- React components receive props as single typed object: `React.FC<RateVibeModalProps>`
- Avoid deeply nested parameters — spread objects or create intermediate types

**Return Values:**
- Async functions return typed data or throw errors
- Zustand actions return `void` for setters, `Promise<void>` for async operations
- Query functions return typed objects or null: `Promise<Venue | null>`
- Success responses include data + metadata: `{ success: boolean; error?: string; clout_earned?: number }`

**Example (Zustand Action):**
```typescript
submitRating: async (venueId, energy, capacity, gate, coordinates, photoBase64) => {
  const { user, isOnline, isDemoMode } = get();
  if (!user) {
    throw new Error('User not logged in');
  }

  // Demo mode: simulate successful rating
  if (isDemoMode) {
    set((state) => ({
      demoRatedVenues: { ...state.demoRatedVenues, [venueId]: Date.now() },
    }));
    return { success: true, clout_earned: 15, ... };
  }

  // Online submission
  const response = await fetch(`${API_URL}/api/ratings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: user.id, venue_id: venueId, ... }),
  });
  // ... handle response
}
```

## Module Design

**Exports:**
- Frontend components export as default: `export default RateVibeModal;`
- Utilities/stores export named exports: `export const useVibeStore = create(...)`
- Demo data exports multiple named constants: `export const DEMO_USER = ...`, `export const DEMO_VENUES = ...`
- Backend routes export single router: `router = APIRouter(...)`

**Barrel Files:**
- `frontend/src/store/vibeStore.ts` is primary store export
- No barrel index files used in frontend — explicit path imports preferred
- Backend routes imported individually in `server.py` and included via `api_router.include_router()`

**Example (Frontend store export):**
```typescript
export const useVibeStore = create<VibeStore>()(
  persist(
    (set, get) => ({ /* actions */ }),
    { name: 'vibe-store', storage: createJSONStorage(...) }
  )
);
```

**Example (Backend route export):**
```python
router = APIRouter(tags=["users"])

@router.post("/users/login")
async def login_user(login_data: UserLogin):
  ...
```

## Zustand Pattern

**Store Structure:**
- Split persisted vs transient state via interfaces `PersistedState` and `TransientState`
- Persisted fields: user, session token, selected city, auth flag, pending ratings, onboarding flags, demo flags, avatar, privacy settings, vibe persona
- Transient (memory-only): venues, cities, loading, error, socket, pulse drops, online status, geofence status, lobby data, crew data, etc.
- Hydration tracked with `hasHydrated` flag, set in `onRehydrateStorage` callback

**Action Patterns:**
- Setters follow naming: `set<Field>` (e.g., `setUser`, `setVenues`, `setLoading`)
- Queries follow naming: `fetch<Resource>` (e.g., `fetchVenues`, `fetchUser`, `fetchStreak`)
- Update operations: `update<Field>` (e.g., `updateVenue`, `updateUserClout`, `updateAvatar`)
- Toggles: `toggle<Field>` (e.g., `toggleDemoMode`, `toggleGhostMode`, `toggleLocationSharing`)

**Demo Mode Integration:**
- `isDemoMode` flag toggles mock data injection across all actions
- Actions check `if (get().isDemoMode)` and return demo data without API calls
- Demo data imported on-demand inside action bodies to avoid circular dependencies: `const { DEMO_LOBBY } = require('../data/demoData')`

**Example (Zustand action pattern):**
```typescript
fetchVenues: async (city?: string) => {
  set({ loading: true });
  try {
    const cityParam = city || get().selectedCity;
    const response = await fetch(`${API_URL}/api/venues?city=${cityParam}`);
    if (response.ok) {
      const venues = await response.json();
      set({ venues, loading: false });
    } else {
      set({ loading: false, error: 'Failed to fetch venues' });
    }
  } catch (error) {
    console.error('Error fetching venues:', error);
    set({ loading: false, error: 'Network error' });
  }
}
```

## FastAPI Route Pattern

**File Organization:**
- Each domain gets one route file in `backend/app/routes/` (e.g., `users.py`, `ratings.py`, `crews.py`)
- Each route file imports: FastAPI APIRouter, database config, models, services
- Route handlers are async by default

**Endpoint Structure:**
```python
@router.post("/endpoint-name")
async def handler_name(request_data: ModelClass):
    """Docstring describing endpoint."""
    # Validate: check resource exists, check permissions
    resource = await db.collection.find_one({"id": resource_id})
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")

    # Authorize: geofence, ownership, rate limits
    if not is_authorized(user, resource):
        raise HTTPException(status_code=403, detail="Not authorized")

    # Execute: call service, update database
    result = await db.collection.insert_one(data.dict())

    # Broadcast: emit socket updates if needed
    await broadcast_venue_update(venue)

    # Return: typed response
    return {"success": True, "data": result}
```

**Service Integration:**
- Complex calculations delegated to `backend/app/services/` (e.g., vibe score, auth tokens, streaks)
- Services imported at top of route file: `from app.services.vibe import calculate_vibe_score`
- Services are pure functions or async functions with single responsibility

**Example (ratings.py endpoint):**
```python
@router.post("/ratings")
async def create_rating(rating_data: RatingCreate):
    """Submit a vibe rating for a venue. Geofence-enforced."""
    # Validate venue exists
    venue = await db.venues.find_one({"id": rating_data.venue_id})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    # Validate geofence
    venue_coords = Coordinates(**venue["coordinates"])
    venue_radius = venue.get("geofence_radius_m", 100)
    if not is_within_geofence(rating_data.coordinates, venue_coords, radius_m=venue_radius):
        raise HTTPException(status_code=403, detail=f"You must be within {int(venue_radius)}m...")

    # Calculate score
    vibe_score = calculate_vibe_score(rating_data.energy, rating_data.capacity, rating_data.gate)

    # Insert & update
    rating = Rating(**rating_data.dict(), vibe_score=vibe_score)
    await db.ratings.insert_one(rating.dict())

    # Broadcast update
    aggregate = await calculate_venue_aggregate(rating_data.venue_id)
    await broadcast_venue_update(venue)

    return {"success": True, "clout_earned": 15}
```

## Component Design Pattern

**React Native Component Template:**
- Import statement block with React + Native at top
- Type definitions/interfaces before component
- Component receives `React.FC<PropsInterface>`
- Animated values and refs initialized in useRef
- useEffect hooks for side effects
- Event handlers with typed callbacks
- StyleSheet at bottom with all styles

**Example (RateVibeModal.tsx structure):**
```typescript
// 1. Imports
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, ... } from 'react-native';

// 2. Type definitions
type EnergyLevel = 'chill' | 'buzzing' | 'popping' | 'electric';
interface RateVibeModalProps {
  visible: boolean;
  onClose: () => void;
  ...
}

// 3. Constants
const ENERGY_OPTIONS: EmojiOption[] = [...]

// 4. Component
const RateVibeModal: React.FC<RateVibeModalProps> = ({ visible, onClose, ... }) => {
  // State
  const [energy, setEnergy] = useState<EnergyLevel | null>(null);

  // Animated values
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;

  // Effects
  useEffect(() => { /* animation logic */ }, [visible]);

  // Handlers
  const handleSubmit = async () => { /* logic */ };

  // Render
  return <Modal>...</Modal>;
};

// 5. Styles
const styles = StyleSheet.create({ /* all styles */ });

export default RateVibeModal;
```

---

*Convention analysis: 2026-02-24*
