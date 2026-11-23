"""The AI client keeps going when a model or the whole provider fails."""
from __future__ import annotations

import asyncio
import json
import uuid
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

import feedback_engine.generator as gen
from llm_client import ResilientClient, _CompatClient, build_client
from tests.test_api import _CANNED_SONG_JSON, _CANNED_SUMMARY


def _resp(text: str):
    return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=text), finish_reason="stop")])


class FakeProvider:
    """Answers with ``reply(kwargs)``; models in ``down`` raise like an outage."""

    def __init__(self, down=(), reply=lambda kw: "ok"):
        self.down = set(down)
        self.reply = reply
        self.calls: list[dict] = []
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self._create))

    async def _create(self, **kw):
        self.calls.append(kw)
        if "*" in self.down or kw.get("model") in self.down:
            raise ConnectionError("provider down")
        return _resp(self.reply(kw))


def _run(coro):
    return asyncio.run(coro)


class TestFallbackOrder:
    def test_primary_answers(self):
        groq = FakeProvider()
        c = ResilientClient(groq=groq, groq_models=("big", "fast"))
        out = _run(c.chat.completions.create(model="big", messages=[], max_tokens=50))
        assert out.choices[0].message.content == "ok" and [k["model"] for k in groq.calls] == ["big"]

    def test_failing_model_falls_back_to_the_other_groq_model(self):
        groq = FakeProvider(down={"openai/gpt-oss-120b"})
        c = ResilientClient(groq=groq, groq_models=("openai/gpt-oss-120b", "llama-x"), headroom=512)
        _run(c.chat.completions.create(model="openai/gpt-oss-120b", messages=[], max_tokens=612,
                                       extra_body={"reasoning_effort": "low"}))
        first, second = groq.calls
        assert second["model"] == "llama-x"
        # a non-reasoning model gets no reasoning settings and no reasoning headroom
        assert "extra_body" not in second and second["max_tokens"] == 100

    def test_groq_down_uses_the_second_provider(self):
        groq = FakeProvider(down={"*"})
        backup = FakeProvider(reply=lambda kw: "from backup")
        backup.model = "backup-model"
        c = ResilientClient(groq=groq, groq_models=("a", "b"), compat=backup)
        out = _run(c.chat.completions.create(model="a", messages=[{"role": "user", "content": "hi"}], max_tokens=10))
        assert out.choices[0].message.content == "from backup"
        assert [k["model"] for k in groq.calls] == ["a", "b"]

    def test_a_hanging_provider_times_out_and_the_next_answers(self, monkeypatch):
        monkeypatch.setenv("LLM_ATTEMPT_TIMEOUT", "0.2")

        class Hangs(FakeProvider):
            async def _create(self, **kw):
                self.calls.append(kw)
                await asyncio.sleep(30)

        backup = FakeProvider(reply=lambda kw: "quick")
        backup.model = "m"
        c = ResilientClient(groq=Hangs(), groq_models=("a",), compat=backup)
        out = _run(asyncio.wait_for(c.chat.completions.create(model="a", messages=[]), 5))
        assert out.choices[0].message.content == "quick"

    def test_everything_down_raises_the_last_error(self):
        backup = FakeProvider(down={"*"})
        backup.model = "m"
        c = ResilientClient(groq=FakeProvider(down={"*"}), groq_models=("a",), compat=backup)
        with pytest.raises(ConnectionError):
            _run(c.chat.completions.create(model="a", messages=[]))


class TestCompatClient:
    def test_speaks_openai_chat_completions(self, monkeypatch):
        seen = {}

        class _Resp:
            status_code = 200
            def raise_for_status(self): ...
            def json(self): return {"choices": [{"message": {"content": "hello"}, "finish_reason": "stop"}]}

        class _Http:
            def __init__(self, *a, **k): ...
            async def __aenter__(self): return self
            async def __aexit__(self, *a): return False
            async def post(self, url, headers, json):
                seen.update(url=url, auth=headers["Authorization"], body=json)
                return _Resp()

        import llm_client
        monkeypatch.setattr(llm_client.httpx, "AsyncClient", _Http)
        c = _CompatClient("https://api.example.com/v1/", "sk-test", "backup-model")
        out = _run(c.chat.completions.create(model="ignored", messages=[{"role": "user", "content": "x"}],
                                             max_tokens=20, extra_body={"reasoning_effort": "low"}))
        assert out.choices[0].message.content == "hello"
        assert seen["url"] == "https://api.example.com/v1/chat/completions" and seen["auth"] == "Bearer sk-test"
        assert seen["body"] == {"messages": [{"role": "user", "content": "x"}], "max_tokens": 20, "model": "backup-model"}

    def test_build_client_from_environment(self, monkeypatch):
        monkeypatch.delenv("GROQ_API_KEY", raising=False)
        for k in ("FALLBACK_LLM_BASE_URL", "FALLBACK_LLM_API_KEY", "FALLBACK_LLM_MODEL"):
            monkeypatch.delenv(k, raising=False)
        assert build_client("a", "b", 512) is None
        monkeypatch.setenv("FALLBACK_LLM_BASE_URL", "https://api.example.com/v1")
        monkeypatch.setenv("FALLBACK_LLM_API_KEY", "k")
        monkeypatch.setenv("FALLBACK_LLM_MODEL", "m")
        c = build_client("a", "b", 512)
        assert c is not None and c.groq is None and c.compat.model == "m"


def test_song_lesson_completes_when_groq_is_down(monkeypatch):
    """End to end: Groq fails every call, the second provider writes the whole lesson."""
    title = f"Outage Song {uuid.uuid4().hex[:6]}"
    song = json.loads(_CANNED_SONG_JSON)
    song["song_title"] = title

    def reply(kw):
        text = json.dumps(kw.get("messages", []))
        return json.dumps(song) if "Output schema" in text else _CANNED_SUMMARY

    backup = FakeProvider(reply=reply)
    backup.model = "backup-model"
    groq = FakeProvider(down={"*"})
    monkeypatch.setattr(gen, "_groq_client", ResilientClient(groq=groq, groq_models=(gen.GROQ_MODEL, gen.GROQ_FAST_MODEL), compat=backup))
    from main import app
    with TestClient(app) as client:
        r = client.post("/api/council/generate", json={"song_query": title})
    monkeypatch.setattr(gen, "_groq_client", None)
    assert r.status_code == 200, r.text
    assert r.json()["song_title"] == title
    assert groq.calls and backup.calls  # Groq was tried first; the backup answered
