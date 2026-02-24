# Testing Patterns

**Analysis Date:** 2026-02-24

## Test Framework

**Current State:**
- **No automated test suite detected** in codebase
- Test files exist at repo root (`backend_test.py`, `backend_test_v3.py`, `comprehensive_merchant_test.py`, etc.) but these are standalone manual test scripts, not integrated test runners
- Frontend: No Jest, Vitest, or other framework configured
- Backend: No pytest, unittest, or FastAPI TestClient setup found

**Runner:**
- Not configured - no `jest.config.js`, `vitest.config.ts`, `pytest.ini`, or `pyproject.toml` [tool.pytest] section
- Manual test scripts use direct HTTP requests or Python imports

**Assertion Library:**
- Not configured - no testing library installed

**Run Commands:**
- No npm/yarn test scripts defined in `frontend/package.json`
- Backend tests are manual scripts: `python backend_test.py`, etc.

## Manual Test Scripts (Reference Only)

These are standalone test files used for manual verification, not automated CI/CD tests:

**Backend:**
- `backend_test.py` - Basic API endpoint testing
- `backend_test_v3.py` - Extended merchant/admin testing
- `comprehensive_merchant_test.py` - Merchant dashboard workflows
- `detailed_test.py` - Specific feature tests
- `final_merchant_test.py` - Final merchant verification
- `focused_v3_test.py` - Focused regression testing
- `merchant_dashboard_test.py` - Dashboard UI flow testing

**Location:** Repository root (not in `tests/` directory)

**Pattern (example from `backend_test.py`):**
```python
import requests
import json

BASE_URL = "http://localhost:8000"

# Manual test - direct HTTP requests
def test_login():
    response = requests.post(
        f"{BASE_URL}/api/users/login",
        json={"phone": "+2341234567890"}
    )
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")

if __name__ == "__main__":
    test_login()
```

## Test File Organization

**Gaps:**
- Frontend: No `.spec.ts`, `.test.tsx`, or `__tests__` directories
- Backend: No `tests/` directory with pytest-style tests
- No integration tests for API routes
- No unit tests for service functions
- No snapshot tests for components

**Recommended Structure (when tests are added):**
```
backend/
├── tests/
│   ├── conftest.py                    # Shared pytest fixtures
│   ├── test_auth.py                   # Auth service tests
│   ├── test_ratings.py                # Rating submission tests
│   ├── test_vibe_score.py             # Vibe calculation tests
│   └── integration/
│       ├── test_rating_workflow.py    # End-to-end rating flow
│       └── test_geofence.py           # Geofence validation

frontend/
├── __tests__/
│   ├── store.test.ts                  # Zustand store tests
│   ├── components.test.tsx            # Component rendering
│   └── integration/
│       ├── rating_flow.test.tsx       # RateVibeModal + submission
│       └── offline.test.ts            # Offline sync tests
```

## Test Structure (When Implemented)

**Backend Test Pattern (pytest style):**

```python
# tests/test_ratings.py
import pytest
from datetime import datetime, timezone, timedelta
from app.models import Rating, RatingCreate, Coordinates
from app.services.vibe import calculate_vibe_score, is_within_geofence
from app.config import db

@pytest.fixture
async def test_user():
    """Create test user."""
    user = await db.users.insert_one({
        "id": "test_user_123",
        "username": "testuser",
        "phone": "+2341234567890",
        "clout_points": 0,
        "total_ratings": 0,
    })
    yield user
    await db.users.delete_one({"id": "test_user_123"})

@pytest.fixture
async def test_venue():
    """Create test venue."""
    venue = await db.venues.insert_one({
        "id": "test_venue_456",
        "name": "Test Club",
        "coordinates": {"lat": 6.4316, "lng": 3.4223},
        "geofence_radius_m": 100,
    })
    yield venue
    await db.venues.delete_one({"id": "test_venue_456"})

@pytest.mark.asyncio
async def test_calculate_vibe_score():
    """Test vibe score calculation."""
    score = calculate_vibe_score("electric", "vibrant", "clear")
    assert score == 100

    score = calculate_vibe_score("chill", "sparse", "blocked")
    assert score <= 30

@pytest.mark.asyncio
async def test_rating_submission_within_geofence(test_user, test_venue):
    """Test rating submission with geofence validation."""
    user_coords = Coordinates(lat=6.4316, lng=3.4223)
    venue_coords = Coordinates(lat=6.4316, lng=3.4223)

    is_valid = is_within_geofence(user_coords, venue_coords, radius_m=100)
    assert is_valid is True

@pytest.mark.asyncio
async def test_rating_cooldown():
    """Test that user cannot rate same venue twice within cooldown."""
    # Submit first rating
    # Verify cooldown_remaining_seconds > 0
    # Attempt second rating
    # Verify 429 status or cooldown error
    pass
```

**Frontend Test Pattern (Vitest/React Testing Library style):**

```typescript
// __tests__/store.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useVibeStore } from '@/store/vibeStore';
import { DEMO_USER, DEMO_VENUES } from '@/data/demoData';

describe('vibeStore', () => {
  beforeEach(() => {
    // Reset store before each test
    const store = useVibeStore.getState();
    store.setUser(null);
    store.setVenues([]);
  });

  it('should toggle demo mode', () => {
    const store = useVibeStore.getState();
    expect(store.isDemoMode).toBe(false);

    store.toggleDemoMode();
    expect(store.isDemoMode).toBe(true);
    expect(store.user).toEqual(DEMO_USER);
    expect(store.venues).toEqual(DEMO_VENUES);

    store.toggleDemoMode();
    expect(store.isDemoMode).toBe(false);
    expect(store.user).toBeNull();
  });

  it('should submit rating and update clout', async () => {
    const store = useVibeStore.getState();
    store.setUser({ ...DEMO_USER });

    const result = await store.submitRating(
      'venue_123',
      'electric',
      'vibrant',
      'clear',
      { lat: 6.4316, lng: 3.4223 }
    );

    expect(result.success).toBe(true);
    expect(result.clout_earned).toBe(15);
    expect(store.user?.clout_points).toBeGreaterThan(DEMO_USER.clout_points);
  });

  it('should queue pending rating when offline', async () => {
    const store = useVibeStore.getState();
    store.setUser({ ...DEMO_USER });
    store.setIsOnline(false);

    const result = await store.submitRating(
      'venue_123',
      'electric',
      'vibrant',
      'clear',
      { lat: 6.4316, lng: 3.4223 }
    );

    expect(result.offline).toBe(true);
    expect(store.pendingRatings.length).toBeGreaterThan(0);
  });
});

// __tests__/components.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { describe, it, expect, vi } from 'vitest';
import RateVibeModal from '@/components/RateVibeModal';

describe('RateVibeModal', () => {
  it('should render when visible prop is true', () => {
    const mockOnClose = vi.fn();
    const mockOnSubmit = vi.fn();

    render(
      <RateVibeModal
        visible={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        venueName="Test Club"
        isGpsVerified={true}
      />
    );

    expect(screen.getByText('Rate the Vibe')).toBeTruthy();
    expect(screen.getByText('Test Club')).toBeTruthy();
  });

  it('should submit rating with all dimensions selected', async () => {
    const mockOnSubmit = vi.fn().mockResolvedValue(undefined);
    const mockOnClose = vi.fn();

    const { getByText } = render(
      <RateVibeModal
        visible={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        venueName="Test Club"
        isGpsVerified={true}
      />
    );

    // Select energy: ELECTRIC
    fireEvent.press(getByText('ELECTRIC'));
    // Select capacity: VIBRANT
    fireEvent.press(getByText('VIBRANT'));
    // Select gate: FREE IN
    fireEvent.press(getByText('FREE IN'));
    // Submit
    fireEvent.press(getByText('Drop the Vibe'));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          energy: 'electric',
          capacity: 'vibrant',
          gate: 'clear',
        })
      );
      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});
```

## Mocking

**Framework:** Not configured - would use Jest `jest.mock()` or Vitest `vi.mock()`

**Patterns (when implemented):**

**Mock API responses:**
```typescript
// __tests__/mocks/api.ts
export const mockFetch = (response: any, status = 200) => {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => response,
  });
};

// Usage in tests
global.fetch = mockFetch({ venues: [...], status: 200 });
```

**Mock Zustand store:**
```typescript
// __tests__/mocks/store.ts
export const createMockStore = (overrides = {}) => {
  return {
    user: { id: 'test_123', username: 'testuser', clout_points: 1000 },
    venues: [],
    setUser: vi.fn(),
    fetchVenues: vi.fn(),
    ...overrides,
  };
};
```

**What to Mock:**
- API calls (fetch requests to backend)
- Zustand store (for component tests)
- React Navigation (navigation.navigate, route.params)
- External services (Paystack, Socket.IO)
- AsyncStorage (for persistence tests)

**What NOT to Mock:**
- Business logic functions (vibe score calculation, geofence validation)
- Component rendering logic
- Data transformation functions
- Redux/Zustand reducer logic (test real store behavior)

## Fixtures and Factories

**Test Data Location (when tests are added):**
- `tests/fixtures/` — Raw test data JSON/objects
- `tests/factories/` — Factory functions to generate test data

**Pattern:**
```python
# tests/factories.py
import uuid
from datetime import datetime, timezone
from app.models import User, Venue, Rating

def create_test_user(
    user_id=None,
    username="testuser",
    phone="+2341234567890",
    clout_points=100
):
    """Factory function for test User objects."""
    return User(
        id=user_id or str(uuid.uuid4()),
        username=username,
        phone=phone,
        clout_points=clout_points,
    )

def create_test_venue(
    venue_id=None,
    name="Test Venue",
    coordinates=None,
    geofence_radius_m=100
):
    """Factory function for test Venue objects."""
    return Venue(
        id=venue_id or str(uuid.uuid4()),
        name=name,
        coordinates=coordinates or {"lat": 6.4316, "lng": 3.4223},
        geofence_radius_m=geofence_radius_m,
    )

def create_test_rating(
    user_id,
    venue_id,
    energy="electric",
    capacity="vibrant",
    gate="clear"
):
    """Factory function for test Rating objects."""
    return Rating(
        user_id=user_id,
        venue_id=venue_id,
        energy=energy,
        capacity=capacity,
        gate=gate,
        vibe_score=calculate_vibe_score(energy, capacity, gate),
    )
```

## Coverage

**Current State:** Not tracked - no coverage tools configured

**Targets (when implemented):**
- Backend: 70% line coverage minimum for core services (`vibe.py`, `auth.py`, `streaks.py`)
- Frontend: 50% coverage for critical store actions (auth, ratings, sync)
- Priority: Business logic > UI components

**View Coverage (when tools are added):**
```bash
# Backend - pytest with coverage
pytest --cov=app --cov-report=html

# Frontend - Vitest with coverage
vitest --coverage

# Open coverage report
open htmlcov/index.html
```

## Test Types

**Unit Tests:**
- **Scope:** Individual functions (vibe score calculation, geofence validation, auth token creation)
- **Approach:** Pure function testing with mocked dependencies
- **Example:** `calculate_vibe_score("electric", "vibrant", "clear") → 100`
- **Location:** `tests/test_services.py`, `__tests__/utils.test.ts`

**Integration Tests:**
- **Scope:** API endpoint → database → response
- **Approach:** Full request/response cycle with test database
- **Example:** POST `/api/ratings` with valid data → venue updated → clout increased
- **Location:** `tests/integration/test_rating_flow.py`

**E2E Tests:**
- **Framework:** Not configured - would use Detox (React Native) or Cypress
- **Scope:** Full user workflows (login → browse venues → rate → see clout update)
- **Not implemented** at this time

## Common Patterns

**Async Testing (Backend - pytest):**
```python
# Wrap test function with @pytest.mark.asyncio
@pytest.mark.asyncio
async def test_fetch_venues():
    """Test async venue fetching."""
    venues = await db.venues.find({}).to_list(100)
    assert len(venues) > 0
    assert venues[0]["name"] is not None
```

**Async Testing (Frontend - Vitest):**
```typescript
// Wrap with async/await, use waitFor for async operations
it('should fetch venues', async () => {
  const store = useVibeStore.getState();

  await store.fetchVenues('lagos');

  await waitFor(() => {
    expect(store.venues.length).toBeGreaterThan(0);
  });
});
```

**Error Testing (Backend):**
```python
@pytest.mark.asyncio
async def test_rating_outside_geofence():
    """Test that ratings outside geofence are rejected."""
    user_coords = Coordinates(lat=6.4316, lng=3.4223)
    venue_coords = Coordinates(lat=6.0, lng=3.0)  # ~50km away

    is_valid = is_within_geofence(user_coords, venue_coords, radius_m=100)
    assert is_valid is False
```

**Error Testing (Frontend):**
```typescript
it('should handle network errors', async () => {
  global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

  const store = useVibeStore.getState();

  try {
    await store.fetchVenues();
  } catch (e) {
    expect(e.message).toBe('Network error');
  }

  expect(store.error).toContain('Network error');
});
```

## Testing Gaps & Priorities

**Critical gaps:**
1. **No unit tests for vibe score calculation** - High priority, impacts all venue rankings
   - Files: `backend/app/services/vibe.py:calculate_vibe_score()`
   - Risk: Silent scoring bugs affecting user experience

2. **No integration tests for rating submission flow** - High priority, core feature
   - Files: `backend/app/routes/ratings.py`, `frontend/src/store/vibeStore.ts`
   - Risk: Rating cooldown, geofence, clout updates could break without notice

3. **No offline sync tests** - Medium priority, queue handling critical
   - Files: `frontend/src/store/vibeStore.ts:syncPendingRatings()`
   - Risk: Ratings lost if sync fails

4. **No demo mode tests** - Medium priority, investor presentations rely on it
   - Files: `frontend/src/store/vibeStore.ts:toggleDemoMode()`
   - Risk: Demo flow could break, blocking demos

5. **No Socket.IO tests** - Medium priority, real-time features
   - Files: `backend/app/services/realtime.py`
   - Risk: Live updates could silently fail

**Coverage targets when implementing:**
- Vibe scoring: 100% (critical business logic)
- Geofence validation: 100% (security-relevant)
- Auth flows: 90% (security critical)
- Rating submission: 85% (main feature)
- Offline sync: 80% (important reliability)
- Store actions: 60% (UI layer, lower priority)

---

*Testing analysis: 2026-02-24*
