"""Security headers on every API response.

The API serves JSON, lesson audio/video and redirects to the lesson bucket;
none of it is a page, so it may run nothing, be framed by nothing, and be
sniffed as nothing. Responses to signed-in requests carry personal data and
must not be kept by shared caches. HSTS only on Cloud Run (HTTPS there;
local development is plain HTTP).
"""
from __future__ import annotations

import os

_BASE = [
    (b"x-content-type-options", b"nosniff"),
    (b"x-frame-options", b"DENY"),
    (b"referrer-policy", b"no-referrer"),
    (b"content-security-policy", b"default-src 'none'; frame-ancestors 'none'; base-uri 'none'"),
    (b"permissions-policy", b"camera=(), microphone=(), geolocation=()"),
]
_HSTS = (b"strict-transport-security", b"max-age=63072000; includeSubDomains")


class SecurityHeadersMiddleware:
    def __init__(self, app) -> None:
        self.app = app
        self.hsts = bool(os.environ.get("K_SERVICE"))

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        signed_in = any(k == b"authorization" for k, _ in scope.get("headers", []))

        async def send_with_headers(message):
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                present = {k.lower() for k, _ in headers}
                for k, v in _BASE + ([_HSTS] if self.hsts else []):
                    if k not in present:
                        headers.append((k, v))
                if signed_in and b"cache-control" not in present:
                    headers.append((b"cache-control", b"no-store"))
                message = {**message, "headers": headers}
            await send(message)

        await self.app(scope, receive, send_with_headers)
