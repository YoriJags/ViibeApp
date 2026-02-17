"""
Vibe App - Rate Limiting Middleware
In-memory sliding window rate limiter. No external dependencies needed.
Protects auth endpoints, ratings, and payment routes from abuse.
"""
import time
from collections import defaultdict
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response, JSONResponse

from app.config import logger


class RateLimitStore:
    """Simple in-memory sliding window counter."""

    def __init__(self):
        self._requests: dict[str, list[float]] = defaultdict(list)

    def is_allowed(self, key: str, max_requests: int, window_seconds: int) -> bool:
        now = time.time()
        cutoff = now - window_seconds

        # Prune old entries
        self._requests[key] = [t for t in self._requests[key] if t > cutoff]

        if len(self._requests[key]) >= max_requests:
            return False

        self._requests[key].append(now)
        return True

    def cleanup(self, max_age: int = 3600):
        """Remove keys with no recent requests (call periodically)."""
        now = time.time()
        stale_keys = [
            k for k, timestamps in self._requests.items()
            if not timestamps or timestamps[-1] < now - max_age
        ]
        for k in stale_keys:
            del self._requests[k]


# Global store instance
store = RateLimitStore()

# Rate limit rules: path_prefix -> (max_requests, window_seconds)
RATE_LIMIT_RULES: dict[str, tuple[int, int]] = {
    # Auth: 10 requests per minute (login/signup abuse)
    "/api/users/login": (10, 60),
    "/api/users": (5, 60),
    "/api/auth/session": (10, 60),
    # Ratings: 20 per minute (already has per-venue limits, this is global)
    "/api/ratings": (20, 60),
    # Payments: 5 per minute (expensive operations)
    "/api/merchant/wallet": (10, 60),
    # Webhooks: more generous (Paystack retries)
    "/api/webhook/paystack": (30, 60),
}


def _get_client_ip(request: Request) -> str:
    """Extract client IP, respecting common proxy headers."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip
    return request.client.host if request.client else "unknown"


def _find_rule(path: str) -> tuple[int, int] | None:
    """Find the most specific rate limit rule for a path."""
    best_match = None
    best_len = 0
    for prefix, limits in RATE_LIMIT_RULES.items():
        if path.startswith(prefix) and len(prefix) > best_len:
            best_match = limits
            best_len = len(prefix)
    return best_match


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        path = request.url.path
        rule = _find_rule(path)

        if rule is None:
            return await call_next(request)

        max_requests, window_seconds = rule
        client_ip = _get_client_ip(request)
        key = f"{client_ip}:{path}"

        if not store.is_allowed(key, max_requests, window_seconds):
            logger.warning(f"Rate limit hit: {client_ip} on {path}")
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please try again shortly."},
                headers={"Retry-After": str(window_seconds)},
            )

        return await call_next(request)
