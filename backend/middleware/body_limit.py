"""Reject oversized request bodies while they stream in.

Starlette's multipart parser spools an entire upload to a temp file before the
handler runs (on Cloud Run /tmp is RAM), so a size check inside the handler is
too late. This pure-ASGI middleware rejects on Content-Length up front and
counts bytes for chunked bodies, answering 413 as soon as the cap is passed.
"""
from __future__ import annotations

import json
from typing import Callable, Iterable, Tuple

Send = Callable
Receive = Callable


class _TooLarge(Exception):
    pass


class BodySizeLimitMiddleware:
    def __init__(self, app, default_limit: int, path_limits: Iterable[Tuple[str, int]] = ()) -> None:
        self.app = app
        self.default_limit = default_limit
        self.path_limits = list(path_limits)

    def _limit_for(self, path: str) -> int:
        for prefix, limit in self.path_limits:
            if path.startswith(prefix):
                return limit
        return self.default_limit

    async def __call__(self, scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope.get("method") in ("GET", "HEAD", "OPTIONS"):
            await self.app(scope, receive, send)
            return
        limit = self._limit_for(scope.get("path", ""))
        for name, value in scope.get("headers", []):
            if name == b"content-length":
                try:
                    if int(value) > limit:
                        await self._reject(send)
                        return
                except ValueError:
                    await self._reject(send, 400, "Invalid Content-Length.")
                    return

        received = 0
        too_large = False
        response_started = False

        async def counting_receive():
            nonlocal received, too_large
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > limit:
                    too_large = True
                    raise _TooLarge()
            return message

        async def tracking_send(message):
            nonlocal response_started
            if too_large:
                # The app (e.g. the multipart parser) caught our exception and is
                # answering with its own 400; replace that with a proper 413.
                if message["type"] == "http.response.start" and not response_started:
                    response_started = True
                    await self._reject(send)
                return
            if message["type"] == "http.response.start":
                response_started = True
            await send(message)

        try:
            await self.app(scope, counting_receive, tracking_send)
        except _TooLarge:
            if not response_started:
                await self._reject(send)

    @staticmethod
    async def _reject(send: Send, status: int = 413,
                      detail: str = "Request body is too large.") -> None:
        body = json.dumps({"detail": detail}).encode()
        await send({
            "type": "http.response.start",
            "status": status,
            "headers": [(b"content-type", b"application/json"),
                        (b"content-length", str(len(body)).encode())],
        })
        await send({"type": "http.response.body", "body": body})
