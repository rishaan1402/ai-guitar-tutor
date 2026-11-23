"""Rate limits shared by every server instance.

Counts live in Postgres (``rate_counters``), so a limit means the same thing
whether one Cloud Run instance is up or several, and survives restarts and
deploys. Each limiter splits its window into 12 buckets and adds up the ones
inside the window: a sliding window accurate to about a twelfth of it, at the
cost of one small upsert per counted request.
"""
from __future__ import annotations

import random
import time

from fastapi import HTTPException, Request
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import RateCounter

_BUCKETS = 12
_KEEP_SECONDS = 2 * 24 * 3600  # longest window is a day; older buckets are swept


def _upsert(db: AsyncSession):
    if db.bind.dialect.name == "postgresql":
        from sqlalchemy.dialects.postgresql import insert
    else:
        from sqlalchemy.dialects.sqlite import insert
    return insert


class RateLimiter:
    def __init__(self, name: str, max_hits: int, window_seconds: int) -> None:
        self.name = name
        self.max_hits = max_hits
        self.window = window_seconds
        self.bucket = max(1, window_seconds // _BUCKETS)

    def _since(self, now: float) -> int:
        return int(now - self.window) // self.bucket * self.bucket + self.bucket

    async def used(self, db: AsyncSession, key: str) -> int:
        """Hits for ``key`` inside the current window."""
        now = time.time()
        result = await db.execute(
            select(func.coalesce(func.sum(RateCounter.count), 0)).where(
                RateCounter.name == self.name,
                RateCounter.key == key[:200],
                RateCounter.bucket >= self._since(now),
            )
        )
        return int(result.scalar_one())

    async def check(self, db: AsyncSession, key: str) -> None:
        """Raise 429 if ``key`` is already at its limit (does not record a hit)."""
        if await self.used(db, key) < self.max_hits:
            return
        now = time.time()
        oldest = (await db.execute(
            select(func.min(RateCounter.bucket)).where(
                RateCounter.name == self.name,
                RateCounter.key == key[:200],
                RateCounter.bucket >= self._since(now),
            )
        )).scalar_one()
        retry_after = max(1, int((oldest or now) + self.window - now) + 1)
        raise HTTPException(
            status_code=429,
            detail="Too many attempts. Please wait and try again.",
            headers={"Retry-After": str(retry_after)},
        )

    async def hit(self, db: AsyncSession, key: str, n: int = 1) -> None:
        now = time.time()
        bucket = int(now) // self.bucket * self.bucket
        insert = _upsert(db)
        stmt = insert(RateCounter).values(name=self.name, key=key[:200], bucket=bucket, count=n)
        stmt = stmt.on_conflict_do_update(
            index_elements=["name", "key", "bucket"],
            set_={"count": RateCounter.count + n},
        )
        await db.execute(stmt)
        if random.random() < 0.002:  # now and then, drop buckets nobody can count any more
            await db.execute(delete(RateCounter).where(RateCounter.bucket < int(now) - _KEEP_SECONDS))
        await db.commit()

    async def reset(self, db: AsyncSession, key: str) -> None:
        await db.execute(delete(RateCounter).where(RateCounter.name == self.name, RateCounter.key == key[:200]))
        await db.commit()


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
login_limiter = RateLimiter("login", max_hits=5, window_seconds=15 * 60)
# Successful signups per ip: 60/hour (a class on one school network); resets: 5/hour
signup_limiter = RateLimiter("signup", max_hits=60, window_seconds=60 * 60)
reset_limiter = RateLimiter("reset", max_hits=5, window_seconds=60 * 60)
