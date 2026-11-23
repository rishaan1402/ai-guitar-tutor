"""A daily cap on AI calls, across every server instance.

Every AI call goes through ``feedback_engine.generator._get_groq_client``,
which asks ``allow_call()`` first. For requests to the AI-using parts of the
API, a middleware reads today's count once, before the request; if the day's
budget is spent, the client comes back as ``None`` and each feature takes the
path it already has for "no AI available" (template feedback and tips, or a
503 for song generation). After the request, the calls it made are added to
the shared count (``rate_counters``, name "llm-day").

Set ``LLM_DAILY_BUDGET`` (calls per UTC day); 0 or unset-and-not-production
means no cap.
"""
from __future__ import annotations

import logging
import os
from contextvars import ContextVar
from typing import Optional

from starlette.types import ASGIApp, Receive, Scope, Send

logger = logging.getLogger(__name__)

_DEFAULT_PROD_BUDGET = 3000
# Paths whose handlers may call the AI
_AI_PREFIXES = ("/api/council", "/submit_audio", "/api/coach", "/api/grooves", "/api/chords/tips", "/api/teacher")


def daily_budget() -> int:
    raw = os.environ.get("LLM_DAILY_BUDGET")
    if raw is not None:
        try:
            return max(0, int(raw))
        except ValueError:
            pass
    return _DEFAULT_PROD_BUDGET if os.environ.get("K_SERVICE") else 0


class _RequestBudget:
    __slots__ = ("blocked", "calls")

    def __init__(self, blocked: bool) -> None:
        self.blocked = blocked
        self.calls = 0


_current: ContextVar[Optional[_RequestBudget]] = ContextVar("llm_budget", default=None)
_warned_day: list[str] = []


def allow_call() -> bool:
    """May this request make one more AI call? Counts it if so."""
    state = _current.get()
    if state is None:
        return True  # outside a budgeted request (startup, scripts, tests calling helpers)
    if state.blocked:
        return False
    state.calls += 1
    return True


def _limiter():
    from auth.rate_limit import RateLimiter

    return RateLimiter("llm-day", max_hits=daily_budget() or 1, window_seconds=24 * 3600)


class LLMBudgetMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        budget = daily_budget()
        if scope["type"] != "http" or not budget or not scope["path"].startswith(_AI_PREFIXES):
            await self.app(scope, receive, send)
            return
        from db.engine import async_session

        limiter = _limiter()
        try:
            async with async_session() as db:
                used = await limiter.used(db, "all")
        except Exception:  # the budget must never take the API down
            logger.exception("LLM budget check failed; allowing the request")
            used = 0
        state = _RequestBudget(blocked=used >= budget)
        if state.blocked:
            import datetime

            today = datetime.date.today().isoformat()
            if today not in _warned_day:
                _warned_day[:] = [today]
                logger.error("Daily AI budget of %d calls is used up; AI features fall back until it frees up", budget)
        token = _current.set(state)
        try:
            await self.app(scope, receive, send)
        finally:
            _current.reset(token)
            if state.calls:
                try:
                    async with async_session() as db:
                        await limiter.hit(db, "all", state.calls)
                except Exception:
                    logger.exception("Couldn't record %d AI calls against the daily budget", state.calls)
