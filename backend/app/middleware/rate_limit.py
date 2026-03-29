"""
Vibe App - Rate Limiting Middleware
In-memory sliding window rate limiter. No external dependencies needed.
Covers all API routes with per-category limits + a global fallback.
Returns standard X-RateLimit-* headers on every matched response.
"""
import time
from collections import defaultdict
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response, JSONResponse

from app.config import logger


class RateLimitStore:
    """Sliding window counter. Thread-safe enough for single-process async use."""

    def __init__(self):
        self._requests: dict[str, list[float]] = defaultdict(list)

    def check(self, key: str, max_requests: int, window_seconds: int) -> tuple[bool, int]:
        """Returns (allowed, remaining). Adds the request timestamp if allowed."""
        now = time.time()
        cutoff = now - window_seconds
        self._requests[key] = [t for t in self._requests[key] if t > cutoff]
        current = len(self._requests[key])
        if current >= max_requests:
            return False, 0
        self._requests[key].append(now)
        return True, max_requests - current - 1

    def cleanup(self, max_age: int = 3600):
        """Evict keys idle longer than max_age seconds. Call periodically."""
        now = time.time()
        stale = [k for k, ts in self._requests.items() if not ts or ts[-1] < now - max_age]
        for k in stale:
            del self._requests[k]


store = RateLimitStore()

# ── Rate limit rules ──────────────────────────────────────────────────────────
# Ordered from most-specific to least-specific (longest prefix wins).
# Format: path_prefix -> (max_requests, window_seconds)
RATE_LIMIT_RULES: dict[str, tuple[int, int]] = {

    # ── Auth / Identity ──────────────────────────────────────────────────────
    "/api/users/request-otp": (3, 300),  # OTP requests: 3 per 5 min (prevents SMS spam)
    "/api/users/login":       (10, 60),  # login attempts
    "/api/auth/session":      (10, 60),  # session refresh
    "/api/users":             (5,  60),  # signup / user creation

    # ── Admin (sensitive treasury / moderation actions) ───────────────────────
    "/api/admin":             (30, 60),  # admin dashboard endpoints

    # ── AI / LLM (expensive Claude calls) ───────────────────────────────────
    "/api/planner":          (5,  60),   # Night Planner (Claude)
    "/api/oracle":           (10, 60),   # Oracle predictions
    "/api/ai_features":      (10, 60),   # Generic AI features
    "/api/forecast":         (15, 60),   # Vibe forecast

    # ── Ratings & Vibe writes ────────────────────────────────────────────────
    "/api/ratings":          (20, 60),   # Global guard (per-venue limits enforced in route)
    "/api/checkins":         (10, 60),   # Ghost check-ins
    "/api/stories":          (10, 60),   # Venue stories
    "/api/reactions":        (30, 60),   # Reaction spam guard
    "/api/emoji_pulse":      (30, 60),   # Emoji reactions
    "/api/aura":             (20, 60),   # Presence / aura updates

    # ── Financial / Payments ────────────────────────────────────────────────
    "/api/merchant/wallet":  (10, 60),   # Wallet operations
    "/api/subscriptions":    (10, 60),   # Vibe+ subscription actions
    "/api/coins":            (15, 60),   # Coin spend / earn
    "/api/bookings":         (10, 60),   # Venue bookings
    "/api/claims":           (5,  60),   # Reward / promo claims
    "/api/reward_pools":     (10, 60),   # Reward pool ops

    # ── Notifications / Campaigns (high-cost broadcasts) ────────────────────
    "/api/pulse_drops":      (5,  60),   # Push notification drops
    "/api/campaigns":        (5,  60),   # Marketing campaigns
    "/api/alerts":           (15, 60),   # User alert writes

    # ── Social / Crew ────────────────────────────────────────────────────────
    "/api/crews":            (10, 60),   # Crew management
    "/api/battles":          (5,  60),   # Battle creation
    "/api/cartel_battles":   (5,  60),   # Cartel battle creation
    "/api/rolling_deep":     (10, 60),   # Crew session ops
    "/api/after_party":      (10, 60),   # After-party actions
    "/api/quests":           (15, 60),   # Quest interactions
    "/api/vibe_quest":       (15, 60),
    "/api/quest_timeline":   (15, 60),

    # ── Webhooks (third-party retries need headroom) ─────────────────────────
    "/api/webhook/paystack": (30, 60),

    # ── Global fallback (all other /api/ routes) ─────────────────────────────
    "/api/":                 (120, 60),  # 2 req/sec sustained, generous for reads
}


def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip
    return request.client.host if request.client else "unknown"


def _find_rule(path: str) -> tuple[str, tuple[int, int]] | None:
    """Return (matched_prefix, (max, window)) for the most specific matching rule."""
    best_prefix = None
    best_limits = None
    best_len = 0
    for prefix, limits in RATE_LIMIT_RULES.items():
        if path.startswith(prefix) and len(prefix) > best_len:
            best_prefix = prefix
            best_limits = limits
            best_len = len(prefix)
    if best_prefix is None:
        return None
    return best_prefix, best_limits  # type: ignore[return-value]


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        path = request.url.path
        match = _find_rule(path)

        if match is None:
            return await call_next(request)

        prefix, (max_requests, window_seconds) = match
        client_ip = _get_client_ip(request)
        # Key on IP + matched prefix (not full path) so sub-routes share the bucket
        key = f"{client_ip}:{prefix}"

        allowed, remaining = store.check(key, max_requests, window_seconds)

        if not allowed:
            logger.warning(f"Rate limit exceeded: {client_ip} → {path} (rule: {prefix})")
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please slow down and try again."},
                headers={
                    "Retry-After": str(window_seconds),
                    "X-RateLimit-Limit": str(max_requests),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Window": str(window_seconds),
                },
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(max_requests)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Window"] = str(window_seconds)
        return response
