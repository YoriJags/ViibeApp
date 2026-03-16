# Testing Patterns

**Analysis Date:** 2026-03-13

## Test Framework

**Runner:**
- Backend: `pytest` (implied by `pytest.main([__file__, "-v", "--tb=short"])` in test file)
- Frontend: No test framework configured — no `jest.config.*`, no `vitest.config.*` found
- No frontend test files exist in the codebase

**Assertion Library (Backend):**
- Python stdlib `assert` statements
- `requests` library for HTTP calls

**Run Commands:**
```bash
# Backend — run from project root
python backend/tests/test_admin_endpoints.py   # Direct execution
pytest backend/tests/ -v --tb=short            # Via pytest

# Frontend — no test runner configured
# (no jest/vitest setup exists)
```

## Test File Organization

**Location:**
- Backend tests: `backend/tests/` directory — one file found: `backend/tests/test_admin_endpoints.py`
- Frontend tests: None — no test files exist in `frontend/src/` or `frontend/app/`

**Naming:**
- Backend: `test_<domain>_endpoints.py` — e.g., `test_admin_endpoints.py`

**Structure:**
```
backend/
└── tests/
    └── test_admin_endpoints.py   # Integration tests hitting live API
```

## Test Structure

**Suite Organization:**
Tests are grouped by resource/feature into classes:

```python
class TestHealthAndBasics:
    """Test basic endpoints to ensure backend is working"""

    def test_health_check(self):
        """Test health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        data = response.json()
        assert data.get("status") == "healthy"
        print(f"✓ Health check passed: {data}")


class TestAdminAuthorization:
    """Test admin authorization - should reject non-admin users"""

    def test_treasury_requires_admin(self):
        """Treasury endpoint should reject non-admin users"""
        response = requests.get(f"{BASE_URL}/api/admin/treasury")
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
```

**Patterns:**
- Each test class covers one endpoint group (authorization, treasury, user analytics, etc.)
- Each test method covers one behavior or scenario
- Assertion messages include actual response text: `assert condition, f"Expected X, got {response.status_code}: {response.text}"`
- `print(f"✓ ...")` after each assertion for human-readable console output during test run

## Mocking

**Framework:** None — tests hit a real live backend URL, no mocking framework used.

**Auth pattern (instead of mocking):**
- Tests use hardcoded user IDs sent as `X-User-Id` header:
  ```python
  ADMIN_USER_ID = "b4903974-2ed8-4c15-8273-cc7f2a2dab4f"
  TEST_USER_ID  = "01752f93-e11a-4753-8a26-8a9b03efdb77"

  headers = {"X-User-Id": ADMIN_USER_ID}
  response = requests.get(f"{BASE_URL}/api/admin/treasury", headers=headers)
  ```
- No mocking of database, external services, or Socket.IO

**What is NOT mocked:**
- MongoDB — tests hit live Atlas instance
- Paystack — not tested
- Claude/Anthropic API — not tested
- Socket.IO broadcasts — not tested

## Fixtures and Factories

**Test Data:**
- No pytest fixtures or factory pattern — tests use module-level constants:
  ```python
  BASE_URL  = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://vibe-scout.preview.emergentagent.com')
  ADMIN_USER_ID = "b4903974-2ed8-4c15-8273-cc7f2a2dab4f"
  TEST_USER_ID  = "01752f93-e11a-4753-8a26-8a9b03efdb77"
  ```
- No setup/teardown (`setUp`, `tearDown`, pytest fixtures) — tests are stateless reads except `test_airdrop_success` which writes data

**Location:**
- All test data is inline in `backend/tests/test_admin_endpoints.py`

## Coverage

**Requirements:** None enforced — no coverage config or CI enforcement detected.

**View Coverage:**
```bash
# No coverage tooling configured
# Manually run:
pytest backend/tests/ --cov=backend/app --cov-report=term-missing
```

## Test Types

**Unit Tests:**
- None — no unit tests exist for business logic in `backend/app/services/vibe.py`, auth service, or any frontend utilities

**Integration Tests:**
- `backend/tests/test_admin_endpoints.py` — live API integration tests
- Tests admin authorization, treasury analytics, user analytics, integrity monitor, clout economy, pulse ledger, clout airdrop, airdrop history, admin venue listing
- All tests hit the deployed Railway backend URL (configurable via `EXPO_PUBLIC_BACKEND_URL` env var)

**E2E Tests:**
- Not configured — no Detox, Playwright, or Cypress setup found

## Common Patterns

**Response structure assertion pattern:**
```python
def test_treasury_with_admin_auth(self):
    headers = {"X-User-Id": ADMIN_USER_ID}
    response = requests.get(f"{BASE_URL}/api/admin/treasury", headers=headers)
    assert response.status_code == 200, f"Treasury failed: {response.status_code} - {response.text}"

    data = response.json()
    # Verify top-level keys
    assert "global" in data, "Missing 'global' field in treasury response"
    assert "revenue_by_city" in data, "Missing 'revenue_by_city' field"

    # Verify nested structure
    assert "total_revenue" in data["global"]

    # Verify data types
    assert isinstance(data["total_users"], int)
    assert isinstance(data["ghost_percentage"], (int, float))
```

**Authorization rejection pattern:**
```python
def test_treasury_requires_admin(self):
    # Unauthenticated
    response = requests.get(f"{BASE_URL}/api/admin/treasury")
    assert response.status_code == 403

    # Non-admin user
    headers = {"X-User-Id": TEST_USER_ID}
    response = requests.get(f"{BASE_URL}/api/admin/treasury", headers=headers)
    assert response.status_code == 403
```

**Conditional structure test (non-empty list):**
```python
if data["top_scouts"]:
    scout = data["top_scouts"][0]
    assert "rank" in scout, "Missing 'rank' in scout"
    assert "username" in scout, "Missing 'username' in scout"
```

**Validation rejection pattern:**
```python
def test_airdrop_validation_rejects_invalid_amount(self):
    headers = {"X-User-Id": ADMIN_USER_ID}
    payload = {"user_ids": [TEST_USER_ID], "amount": 0, "reason": "Test"}
    response = requests.post(f"{BASE_URL}/api/admin/clout-airdrop", json=payload, headers=headers)
    assert response.status_code == 400, f"Expected 400, got {response.status_code}"
```

## Coverage Gaps

**Untested areas:**
- All core business logic in `backend/app/services/vibe.py` — `calculate_vibe_score`, `calculate_venue_aggregate`, `is_within_geofence`, `compute_scout_credibility`
- Rating submission flow (`POST /api/ratings`) — the most critical user action
- Authentication routes (`POST /api/users`, `POST /api/users/login`)
- Geofence enforcement logic
- Streak calculation (`backend/app/services/streaks.py`)
- Frontend state management (`frontend/src/store/vibeStore.ts`)
- All frontend utility functions in `frontend/src/utils/` — `calculateDistance`, `getSceneIntel`, `generateDailyPulse`
- Socket.IO realtime broadcasts
- Paystack webhook handling (`backend/app/routes/webhooks.py`)
- Merchant routes (`backend/app/routes/merchant.py` — 1,080 lines)

**Risk level:**
- `backend/app/services/vibe.py` — HIGH: all vibe scoring and geofence logic untested; a bug here silently corrupts all venue scores
- `frontend/src/store/vibeStore.ts` — HIGH: 1,830 lines, zero test coverage, manages all app state
- Rating submission — HIGH: primary data collection path, no regression safety net

---

*Testing analysis: 2026-03-13*
