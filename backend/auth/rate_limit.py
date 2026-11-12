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
        self._since_sweep = 0

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
        now = time.monotonic()
        self._hits[key].append(now)
        self._since_sweep += 1
        if self._since_sweep >= 1000:
            self._sweep(now)

    def _sweep(self, now: float) -> None:
        """Drop keys whose newest hit is outside the window (bounds memory when
        many distinct keys, e.g. random emails, are tried once each)."""
        self._since_sweep = 0
        stale = [k for k, hits in self._hits.items() if not hits or now - hits[-1] > self.window]
        for k in stale:
            del self._hits[k]

    def reset(self, key: str) -> None:
        self._hits.pop(key, None)

    def clear(self) -> None:
        self._hits.clear()


def client_ip(request: Request) -> str:
    # Google's front end APPENDS the connecting client's address to any
    # X-Forwarded-For the client sent, so the LAST hop is the one we can trust;
    # the first hop is attacker-controlled and would let anyone dodge limits.
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        hops = [h.strip() for h in forwarded.split(",") if h.strip()]
        if hops:
            return hops[-1]
    return request.client.host if request.client else "unknown"


# Failed logins per (ip, email): 5 per 15 minutes
login_limiter = RateLimiter(max_hits=5, window_seconds=15 * 60)
# Successful signups per ip: 60/hour (a class on one school network); resets: 5/hour
signup_limiter = RateLimiter(max_hits=60, window_seconds=60 * 60)
reset_limiter = RateLimiter(max_hits=5, window_seconds=60 * 60)
