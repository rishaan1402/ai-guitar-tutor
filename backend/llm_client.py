"""One AI client that keeps going when a model or provider fails.

Every AI call in the app is ``client.chat.completions.create(**kwargs)`` and
reads ``response.choices[0].message.content``. This client keeps that shape
and tries, in order, until one answers:

1. Groq, with the model the caller asked for;
2. Groq, with the other configured model (``GROQ_MODEL`` / ``GROQ_FAST_MODEL``,
   or ``GROQ_FALLBACK_MODEL``): Groq rate-limits and retires models one at a
   time, so the second model is often fine when the first isn't;
3. a second provider, when configured: any OpenAI-compatible chat API
   (``FALLBACK_LLM_BASE_URL``, e.g. https://api.openai.com/v1 or an
   OpenRouter/Together endpoint, plus ``FALLBACK_LLM_API_KEY`` and
   ``FALLBACK_LLM_MODEL``). This is what keeps song lessons working when
   Groq itself is down.

A failure is anything the attempt raises: connection errors, 429s, 5xx,
timeouts. An attempt that has another option after it gets at most
``LLM_ATTEMPT_TIMEOUT`` seconds (default 12), so a hanging provider can't use
up the caller's whole time limit. The caller sees an error only when every
option failed.
"""
from __future__ import annotations

import asyncio
import logging
import os
from types import SimpleNamespace
from typing import Any, Optional

import httpx

logger = logging.getLogger(__name__)

_REASONING_PREFIXES = ("openai/gpt-oss", "qwen/")
_COMPAT_KEYS = ("messages", "max_tokens", "temperature", "top_p", "stop", "seed", "response_format")


def _is_reasoning(model: str) -> bool:
    return model.startswith(_REASONING_PREFIXES)


def _args_for(kwargs: dict, model: str, headroom: int) -> dict:
    """The same request for another Groq model: reasoning settings follow the model."""
    args = dict(kwargs, model=model)
    asked = kwargs.get("model", "")
    if _is_reasoning(model) and not _is_reasoning(asked):
        args["extra_body"] = {"reasoning_effort": "low"}
        if "max_tokens" in args:
            args["max_tokens"] += headroom
    elif not _is_reasoning(model) and _is_reasoning(asked):
        args.pop("extra_body", None)
        if "max_tokens" in args:
            args["max_tokens"] = max(64, args["max_tokens"] - headroom)
    return args


class _CompatClient:
    """Minimal OpenAI-compatible chat client (POST {base}/chat/completions)."""

    def __init__(self, base_url: str, api_key: str, model: str, timeout: float = 30.0) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.model = model
        self.timeout = timeout
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self._create))

    async def _create(self, **kwargs: Any) -> SimpleNamespace:
        body = {k: kwargs[k] for k in _COMPAT_KEYS if k in kwargs}
        body["model"] = self.model
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(
                f"{self.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json=body,
            )
        resp.raise_for_status()
        data = resp.json()
        choices = [
            SimpleNamespace(
                message=SimpleNamespace(content=(c.get("message") or {}).get("content") or ""),
                finish_reason=c.get("finish_reason"),
            )
            for c in data.get("choices", [])
        ]
        if not choices:
            raise RuntimeError("fallback provider returned no choices")
        return SimpleNamespace(choices=choices)


class ResilientClient:
    def __init__(
        self,
        groq: Any = None,
        groq_models: tuple[str, ...] = (),
        compat: Optional[_CompatClient] = None,
        headroom: int = 512,
    ) -> None:
        self.groq = groq
        self.groq_models = groq_models
        self.compat = compat
        self.headroom = headroom
        try:
            self.attempt_timeout = float(os.environ.get("LLM_ATTEMPT_TIMEOUT", "12"))
        except ValueError:
            self.attempt_timeout = 12.0
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self._create))

    def _attempts(self, kwargs: dict) -> list[tuple[str, Any, dict]]:
        out: list[tuple[str, Any, dict]] = []
        if self.groq is not None:
            asked = kwargs.get("model") or (self.groq_models[0] if self.groq_models else "")
            out.append((f"groq:{asked}", self.groq, dict(kwargs, model=asked)))
            for m in self.groq_models:
                if m and m != asked:
                    out.append((f"groq:{m}", self.groq, _args_for(kwargs, m, self.headroom)))
        if self.compat is not None:
            out.append((f"fallback:{self.compat.model}", self.compat, kwargs))
        return out

    async def _create(self, **kwargs: Any) -> Any:
        last: Optional[BaseException] = None
        attempts = self._attempts(kwargs)
        for i, (label, client, args) in enumerate(attempts):
            more = i + 1 < len(attempts)
            try:
                call = client.chat.completions.create(**args)
                return await (asyncio.wait_for(call, self.attempt_timeout) if more else call)
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # any failure: try the next option
                last = exc
                logger.warning("AI call via %s failed (%s)%s", label, type(exc).__name__, "; trying the next option" if more else "")
        if last is None:
            raise RuntimeError("no AI provider configured")
        raise last


def build_client(primary_model: str, fast_model: str, headroom: int) -> Optional[ResilientClient]:
    """The app's AI client from the environment, or None when no provider is configured."""
    groq = None
    if os.environ.get("GROQ_API_KEY"):
        try:
            from groq import AsyncGroq

            groq = AsyncGroq(api_key=os.environ["GROQ_API_KEY"])
        except Exception as e:  # pragma: no cover - import/config problems
            logger.warning("Failed to initialise Groq: %s", e)
    compat = None
    base, key, model = (os.environ.get(k, "").strip() for k in ("FALLBACK_LLM_BASE_URL", "FALLBACK_LLM_API_KEY", "FALLBACK_LLM_MODEL"))
    if base and key and model:
        compat = _CompatClient(base, key, model)
    if groq is None and compat is None:
        return None
    extra = os.environ.get("GROQ_FALLBACK_MODEL", "").strip()
    models = tuple(dict.fromkeys(m for m in (primary_model, fast_model, extra) if m))
    logger.info("AI client: groq=%s models=%s fallback=%s", groq is not None, models, compat.model if compat else None)
    return ResilientClient(groq=groq, groq_models=models, compat=compat, headroom=headroom)
