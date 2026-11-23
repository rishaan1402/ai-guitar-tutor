"""Housekeeping: delete rows nobody can use any more.

- lesson practice sessions past their expiry (30 days after last use)
- password-reset tokens that expired or were used more than a day ago
- refresh tokens past their expiry
- rate-limit buckets older than the longest window
- the legacy tutor_sessions table (no longer written) after 30 days

``sweep`` is idempotent, so several instances running it at once is harmless.
On Cloud Run each instance runs it a few minutes after starting and then every
6 hours (``MAINTENANCE_INTERVAL_HOURS``; 0 turns it off).
"""
from __future__ import annotations

import asyncio
import logging
import os
import random
import time
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, or_

from db.models import LessonSessionDB, PasswordResetToken, RateCounter, RefreshToken, TutorSessionDB

logger = logging.getLogger(__name__)


async def sweep(db) -> dict[str, int]:
    now = datetime.now(timezone.utc)
    jobs = {
        "lesson_sessions": delete(LessonSessionDB).where(LessonSessionDB.expires_at < now),
        "password_reset_tokens": delete(PasswordResetToken).where(
            or_(PasswordResetToken.expires_at < now - timedelta(days=1), PasswordResetToken.used_at < now - timedelta(days=1))
        ),
        "refresh_tokens": delete(RefreshToken).where(RefreshToken.expires_at < now),
        "rate_counters": delete(RateCounter).where(RateCounter.bucket < int(time.time()) - 2 * 24 * 3600),
        "tutor_sessions": delete(TutorSessionDB).where(TutorSessionDB.last_access < now - timedelta(days=30)),
    }
    removed = {}
    for name, stmt in jobs.items():
        removed[name] = (await db.execute(stmt)).rowcount or 0
    await db.commit()
    return removed


def interval_hours() -> float:
    default = "6" if os.environ.get("K_SERVICE") else "0"
    try:
        return max(0.0, float(os.environ.get("MAINTENANCE_INTERVAL_HOURS", default)))
    except ValueError:
        return 0.0


async def run_forever() -> None:
    hours = interval_hours()
    if not hours:
        return
    from db.engine import async_session

    await asyncio.sleep(random.uniform(120, 600))  # not every instance at once, not during start-up
    while True:
        try:
            async with async_session() as db:
                removed = await sweep(db)
            if any(removed.values()):
                logger.info("Maintenance removed %s", removed)
        except Exception:
            logger.exception("Maintenance sweep failed; trying again next round")
        await asyncio.sleep(hours * 3600 * random.uniform(0.9, 1.1))
