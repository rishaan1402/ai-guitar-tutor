"""App config for the mobile build, and reports on AI-written content."""
from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    from main import app
    with TestClient(app) as c:
        yield c


def test_app_config_defaults_and_env(client, monkeypatch):
    cfg = client.get("/api/app/config").json()
    assert cfg["min_android_build"] == 1 and cfg["android_store_url"].startswith("https://play.google.com/")
    monkeypatch.setenv("APP_MIN_ANDROID_BUILD", "7")
    assert client.get("/api/app/config").json()["min_android_build"] == 7


def test_anonymous_report_is_stored_and_listed_for_admin(client):
    text = f"Your G chord {uuid.uuid4().hex} is perfect"
    r = client.post("/api/reports", json={"kind": "feedback", "reason": "wrong", "content": text, "context": "G_major"})
    assert r.status_code == 201

    import asyncio
    from sqlalchemy import select
    from db.engine import async_session
    from db.models import ContentReport

    async def fetch():
        async with async_session() as s:
            return (await s.execute(select(ContentReport).where(ContentReport.content == text))).scalar_one()
    row = asyncio.run(fetch())
    assert row.kind == "feedback" and row.user_id is None and row.context == "G_major"


def test_report_validation(client):
    assert client.post("/api/reports", json={"kind": "nope", "reason": "wrong", "content": "x"}).status_code == 422
    assert client.post("/api/reports", json={"kind": "tip", "reason": "wrong", "content": ""}).status_code == 422
    assert client.post("/api/reports", json={"kind": "tip", "reason": "wrong", "content": "x" * 8001}).status_code == 422


def test_admin_reports_need_admin(client):
    assert client.get("/api/admin/reports").status_code in (401, 403)


class TestSecurityHeaders:
    def test_every_response_is_locked_down(self, client):
        for path in ("/", "/chords", "/no-such-route"):
            h = client.get(path).headers
            assert h["x-content-type-options"] == "nosniff"
            assert h["x-frame-options"] == "DENY"
            assert h["referrer-policy"] == "no-referrer"
            assert "default-src 'none'" in h["content-security-policy"]
            assert "strict-transport-security" not in h  # local: plain HTTP

    def test_signed_in_responses_are_not_cached(self, client):
        import uuid
        r = client.post("/api/auth/signup", json={"email": f"h-{uuid.uuid4().hex[:8]}@example.com", "password": "guitar123", "display_name": "H"})
        h = client.get("/api/auth/me", headers={"Authorization": f"Bearer {r.json()['access_token']}"}).headers
        assert h["cache-control"] == "no-store"
        assert "cache-control" not in client.get("/chords").headers or client.get("/chords").headers["cache-control"] != "no-store"

    def test_cors_still_works_alongside(self, client):
        r = client.options("/api/auth/login", headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "POST"})
        assert r.status_code == 200
