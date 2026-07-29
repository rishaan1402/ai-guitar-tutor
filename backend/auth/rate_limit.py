"""Sliding-window rate limiting for auth endpoints.

In-memory, so each Cloud Run instance counts separately. That still caps a
brute-force attempt at (instances x limit) per window, which is enough for
launch; move the counters to Postgres or Redis if we scale out further.
"""
from __future__ import annotations

import time
from collections import defaultdict, deque
from typing import Deque, Dict

from fastapi import HTTPException, Request


class RateLimiter:
    def __init__(self, max_hits: int, window_seconds: int) -> None:
        self.max_hits = max_hits
        self.window = window_seconds
        self._hits: Dict[str, Deque[float]] = defaultdict(deque)

    def _prune(self, key: str, now: float) -> Deque[float]:
        hits = self._hits[key]
        while hits and now - hits[0] > self.window:
            hits.popleft()
        return hits

    def check(self, key: str) -> None:
        """Raise 429 if `key` is already at its limit (does not record a hit)."""
        hits = self._prune(key, time.monotonic())
        if not hits:
            self._hits.pop(key, None)  # don't let idle keys accumulate
            return
        if len(hits) >= self.max_hits:
            retry_after = int(self.window - (time.monotonic() - hits[0])) + 1
            raise HTTPException(
                status_code=429,
                detail="Too many attempts. Please wait and try again.",
                headers={"Retry-After": str(retry_after)},
            )

    def hit(self, key: str) -> None:
        self._hits[key].append(time.monotonic())

    def reset(self, key: str) -> None:
        self._hits.pop(key, None)

    def clear(self) -> None:
        self._hits.clear()


def client_ip(request: Request) -> str:
    # Cloud Run puts the real client first in X-Forwarded-For
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# Failed logins per (ip, email): 5 per 15 minutes
login_limiter = RateLimiter(max_hits=5, window_seconds=15 * 60)
# Signups and reset requests per ip: 10 per hour
signup_limiter = RateLimiter(max_hits=10, window_seconds=60 * 60)
reset_limiter = RateLimiter(max_hits=5, window_seconds=60 * 60)
