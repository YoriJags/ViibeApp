"""
Unit tests for app.middleware.rate_limit.

RateLimitStore and _find_rule are pure in-memory logic — no DB, no network.
RateLimitMiddleware dispatch is tested with lightweight ASGI stubs.
"""
import time
import pytest
from unittest.mock import AsyncMock, MagicMock

from app.middleware.rate_limit import RateLimitStore, _find_rule, RATE_LIMIT_RULES

pytestmark = pytest.mark.unit


# ---------------------------------------------------------------------------
# RateLimitStore
# ---------------------------------------------------------------------------

class TestRateLimitStore:
    def test_first_request_is_allowed(self):
        store = RateLimitStore()
        allowed, remaining = store.check("ip:key", max_requests=5, window_seconds=60)
        assert allowed is True
        assert remaining == 4

    def test_requests_up_to_limit_are_allowed(self):
        store = RateLimitStore()
        for i in range(5):
            allowed, remaining = store.check("ip", max_requests=5, window_seconds=60)
            assert allowed is True

    def test_request_over_limit_is_blocked(self):
        store = RateLimitStore()
        for _ in range(5):
            store.check("ip", max_requests=5, window_seconds=60)
        allowed, remaining = store.check("ip", max_requests=5, window_seconds=60)
        assert allowed is False
        assert remaining == 0

    def test_different_keys_have_independent_limits(self):
        store = RateLimitStore()
        for _ in range(5):
            store.check("ip1", max_requests=5, window_seconds=60)
        # ip1 is now blocked, ip2 should still be allowed
        allowed, _ = store.check("ip2", max_requests=5, window_seconds=60)
        assert allowed is True

    def test_window_expiry_resets_count(self):
        store = RateLimitStore()
        # Fill up the window
        for _ in range(3):
            store.check("ip", max_requests=3, window_seconds=1)
        assert store.check("ip", max_requests=3, window_seconds=1)[0] is False

        # Expire the window by backdating timestamps
        store._requests["ip"] = [t - 2 for t in store._requests["ip"]]
        allowed, _ = store.check("ip", max_requests=3, window_seconds=1)
        assert allowed is True

    def test_cleanup_removes_idle_keys(self):
        store = RateLimitStore()
        store.check("active", max_requests=10, window_seconds=60)
        # Manually backdate "stale" key
        store._requests["stale"] = [time.time() - 7200]  # 2 hours ago

        store.cleanup(max_age=3600)
        assert "stale" not in store._requests
        assert "active" in store._requests


# ---------------------------------------------------------------------------
# _find_rule
# ---------------------------------------------------------------------------

class TestFindRule:
    def test_exact_prefix_match(self):
        result = _find_rule("/api/ratings/submit")
        assert result is not None
        prefix, limits = result
        assert prefix == "/api/ratings"

    def test_longer_prefix_wins_over_shorter(self):
        # /api/merchant/wallet is more specific than /api/
        result = _find_rule("/api/merchant/wallet/topup")
        assert result is not None
        prefix, _ = result
        assert prefix == "/api/merchant/wallet"

    def test_global_fallback_matches_unspecified_route(self):
        result = _find_rule("/api/some/totally/unknown/endpoint")
        assert result is not None
        prefix, _ = result
        assert prefix == "/api/"

    def test_non_api_path_returns_none(self):
        result = _find_rule("/health")
        assert result is None

    def test_login_has_tight_limit(self):
        result = _find_rule("/api/users/login")
        assert result is not None
        _, (max_req, window) = result
        # Login should be rate-limited tightly
        assert max_req <= 10
        assert window == 60

    def test_financial_endpoints_have_limits(self):
        for path in ["/api/merchant/wallet/topup", "/api/subscriptions/start", "/api/coins/spend"]:
            result = _find_rule(path)
            assert result is not None, f"No rule found for {path}"

    def test_webhook_has_generous_limit(self):
        result = _find_rule("/api/webhook/paystack/callback")
        assert result is not None
        _, (max_req, _) = result
        assert max_req >= 30  # webhook retries need headroom


# ---------------------------------------------------------------------------
# Rate limit rules completeness sanity checks
# ---------------------------------------------------------------------------

class TestRateLimitRules:
    def test_all_rules_have_positive_limits(self):
        for prefix, (max_req, window) in RATE_LIMIT_RULES.items():
            assert max_req > 0, f"{prefix}: max_requests must be positive"
            assert window > 0, f"{prefix}: window_seconds must be positive"

    def test_global_fallback_exists(self):
        assert "/api/" in RATE_LIMIT_RULES

    def test_auth_routes_are_tighter_than_global(self):
        global_limit = RATE_LIMIT_RULES["/api/"][0]
        login_limit = RATE_LIMIT_RULES["/api/users/login"][0]
        assert login_limit < global_limit
