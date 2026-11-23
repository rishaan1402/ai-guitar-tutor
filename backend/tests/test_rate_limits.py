"""Shared rate limits (every server instance counts together) and the daily AI budget."""
from __future__ import annotations

import asyncio
import time
import uuid

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from auth.rate_limit import RateLimiter
from db.engine import async_session
from db.models import RateCounter
from contextlib import contextmanager
from unittest.mock import patch

from llm_budget import allow_call
from tests.test_api import _CANNED_SUMMARY, _groq
from tests.test_song_library import _generate, _llm, _song_json


@contextmanager
def _budgeted_llm(song_json: str):
    """Fake AI that, like the real client factory, asks the daily budget before each call."""
    def factory(content):
        return lambda: _groq(content) if allow_call() else None
    with patch("council.ingestion._get_groq_client", side_effect=factory(song_json)), \
         patch("council.agents._get_groq_client", side_effect=factory(_CANNED_SUMMARY)), \
         patch("council.chairman._get_groq_client", side_effect=factory(_CANNED_SUMMARY)), \
         patch("council.advisor._get_groq_client", side_effect=factory("A real AI tip.")), \
         patch("feedback_engine.generator._get_groq_client", side_effect=factory(_CANNED_SUMMARY)):
        yield


@pytest.fixture
def client():
    from main import app
    with TestClient(app) as c:
        yield c


def _run(coro):
    return asyncio.run(coro)


async def _with_db(fn):
    async with async_session() as db:
        return await fn(db)


class TestSharedLimiter:
    def test_two_instances_share_one_count(self, client):
        # two server instances each build their own limiter object: the count is shared
        a, b = RateLimiter("t-shared", 3, 60), RateLimiter("t-shared", 3, 60)
        key = uuid.uuid4().hex

        async def go(db):
            await a.hit(db, key)
            await b.hit(db, key)
            await a.hit(db, key)
            with pytest.raises(HTTPException) as e:
                await b.check(db, key)
            return e.value

        err = _run(_with_db(go))
        assert err.status_code == 429 and int(err.headers["Retry-After"]) >= 1

    def test_old_hits_fall_out_of_the_window(self, client):
        lim = RateLimiter("t-window", 2, 60)
        key = uuid.uuid4().hex

        async def go(db):
            old = int(time.time()) - 600
            db.add(RateCounter(name="t-window", key=key, bucket=old, count=5))
            await db.commit()
            await lim.check(db, key)  # five hits ten minutes ago don't count
            await lim.hit(db, key)
            return await lim.used(db, key)

        assert _run(_with_db(go)) == 1

    def test_reset_clears_a_key(self, client):
        lim = RateLimiter("t-reset", 1, 60)
        key = uuid.uuid4().hex

        async def go(db):
            await lim.hit(db, key)
            await lim.reset(db, key)
            await lim.check(db, key)
            return await lim.used(db, key)

        assert _run(_with_db(go)) == 0


class TestDailyAIBudget:
    def test_spent_budget_stops_new_ai_calls_but_not_the_app(self, client, monkeypatch):
        monkeypatch.setenv("LLM_DAILY_BUDGET", "4")
        first = f"Budget Song {uuid.uuid4().hex[:6]}"
        with _budgeted_llm(_song_json(first)):
            lesson = _generate(client, first)
        assert lesson.status_code == 200, lesson.text  # one new song: ingestion + council calls

        async def used(db):
            return await RateLimiter("llm-day", 1, 24 * 3600).used(db, "all")

        assert _run(_with_db(used)) >= 4

        # budget spent: a new song can't be written...
        second = f"Budget Song {uuid.uuid4().hex[:6]}"
        with _budgeted_llm(_song_json(second)):
            r = _generate(client, second)
        assert r.status_code == 503
        # ...but a stored song still opens (no AI call) and practice tips fall back to templates
        with _llm(None, council=False):
            again = _generate(client, first)
        assert again.status_code == 200
        doc = again.json()
        with _budgeted_llm(_song_json("x")):
            tip = client.post("/api/council/practice/tip", json={
                "lesson_id": doc["lesson_id"], "chord_key": doc["practice_chords"][0]["chord_key"],
                "chord_symbol": "G", "score": 0.6, "detected_notes": [], "missing_notes": [], "extra_notes": [],
                "attempt": 1})
        assert tip.status_code == 200, tip.text
        assert tip.json()["tip"] and tip.json()["tip"] != "A real AI tip."  # the template, not the AI

    def test_real_client_factory_honours_a_spent_budget(self, monkeypatch):
        import llm_budget
        from feedback_engine.generator import _get_groq_client
        monkeypatch.setenv("GROQ_API_KEY", "test-key")
        token = llm_budget._current.set(llm_budget._RequestBudget(blocked=True))
        try:
            assert _get_groq_client() is None
        finally:
            llm_budget._current.reset(token)

    def test_no_budget_means_no_cap(self, client, monkeypatch):
        monkeypatch.setenv("LLM_DAILY_BUDGET", "0")
        title = f"Uncapped Song {uuid.uuid4().hex[:6]}"
        with _llm(_song_json(title)):
            assert _generate(client, title).status_code == 200
