"""
Account lifecycle: deletion, password reset, rate limiting, and the
production JWT secret guard (roadmap 1.4).
"""
from __future__ import annotations

import importlib
import logging
import re
import uuid

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    from main import app
    with TestClient(app) as c:
        yield c


def _signup(client, password="guitar123"):
    email = f"user-{uuid.uuid4().hex[:8]}@example.com"
    r = client.post(
        "/api/auth/signup",
        json={"email": email, "password": password, "display_name": "Test"},
    )
    assert r.status_code == 201, r.text
    return email, r.json()


def _auth(tokens):
    return {"Authorization": f"Bearer {tokens['access_token']}"}


def _login(client, email, password):
    return client.post("/api/auth/login", json={"email": email, "password": password})


class TestDeleteAccount:
    def test_wrong_password_refused(self, client):
        _, tokens = _signup(client)
        r = client.request("DELETE", "/api/auth/me", json={"password": "wrong"}, headers=_auth(tokens))
        assert r.status_code == 403
        assert client.get("/api/auth/me", headers=_auth(tokens)).status_code == 200

    def test_delete_removes_account_and_data(self, client):
        email, tokens = _signup(client)
        r = client.request("DELETE", "/api/auth/me", json={"password": "guitar123"}, headers=_auth(tokens))
        assert r.status_code == 204
        # Account is gone: can't log in, refresh token no longer works
        assert _login(client, email, "guitar123").status_code == 401
        r = client.post("/api/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
        assert r.status_code == 401

    def test_requires_auth(self, client):
        r = client.request("DELETE", "/api/auth/me", json={"password": "x"})
        assert r.status_code == 401


def _reset_token_from_log(caplog) -> str:
    for rec in caplog.records:
        m = re.search(r"reset-password\?token=([\w-]+)", rec.getMessage())
        if m:
            return m.group(1)
    raise AssertionError("no reset link logged")


class TestPasswordReset:
    def test_unknown_email_gets_same_response(self, client, caplog):
        caplog.set_level(logging.INFO)
        r = client.post("/api/auth/password-reset/request", json={"email": "nobody@example.com"})
        assert r.status_code == 202
        assert "reset-password?token=" not in caplog.text

    def test_full_reset_flow(self, client, caplog):
        caplog.set_level(logging.INFO)
        email, tokens = _signup(client)
        r = client.post("/api/auth/password-reset/request", json={"email": email})
        assert r.status_code == 202
        token = _reset_token_from_log(caplog)

        r = client.post(
            "/api/auth/password-reset/confirm",
            json={"token": token, "new_password": "newpass99"},
        )
        assert r.status_code == 204
        assert _login(client, email, "guitar123").status_code == 401
        assert _login(client, email, "newpass99").status_code == 200
        # Old sessions are signed out
        r = client.post("/api/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
        assert r.status_code == 401

    def test_token_is_single_use(self, client, caplog):
        caplog.set_level(logging.INFO)
        email, _ = _signup(client)
        client.post("/api/auth/password-reset/request", json={"email": email})
        token = _reset_token_from_log(caplog)
        body = {"token": token, "new_password": "newpass99"}
        assert client.post("/api/auth/password-reset/confirm", json=body).status_code == 204
        assert client.post("/api/auth/password-reset/confirm", json=body).status_code == 400

    def test_bogus_token(self, client):
        r = client.post(
            "/api/auth/password-reset/confirm",
            json={"token": "not-a-token", "new_password": "newpass99"},
        )
        assert r.status_code == 400


class TestRateLimits:
    def test_login_locks_after_five_failures(self, client):
        email, _ = _signup(client)
        for _ in range(5):
            assert _login(client, email, "wrong").status_code == 401
        r = _login(client, email, "guitar123")  # even the right password is throttled now
        assert r.status_code == 429
        assert "Retry-After" in r.headers

    def test_success_resets_failure_count(self, client):
        email, _ = _signup(client)
        for _ in range(4):
            _login(client, email, "wrong")
        assert _login(client, email, "guitar123").status_code == 200
        for _ in range(4):
            assert _login(client, email, "wrong").status_code == 401

    def test_other_accounts_unaffected(self, client):
        victim, _ = _signup(client)
        other, _ = _signup(client)
        for _ in range(5):
            _login(client, victim, "wrong")
        assert _login(client, other, "guitar123").status_code == 200


class TestTokenUniqueness:
    def test_tokens_issued_together_differ(self):
        from auth.security import create_refresh_token
        uid = str(uuid.uuid4())
        assert create_refresh_token(uid) != create_refresh_token(uid)

    def test_logout_then_login_keeps_old_token_revoked(self, client):
        email, tokens = _signup(client)
        headers = _auth(tokens)
        r = client.post("/api/auth/logout", json={"refresh_token": tokens["refresh_token"]}, headers=headers)
        assert r.status_code == 204
        assert _login(client, email, "guitar123").status_code == 200
        r = client.post("/api/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
        assert r.status_code == 401


class TestJwtSecretGuard:
    def test_refuses_to_start_on_cloud_run_without_secret(self, monkeypatch):
        import auth.security as security
        monkeypatch.delenv("JWT_SECRET_KEY", raising=False)
        monkeypatch.setenv("K_SERVICE", "guitar-tutor-backend")
        with pytest.raises(RuntimeError, match="JWT_SECRET_KEY"):
            importlib.reload(security)
        monkeypatch.delenv("K_SERVICE")
        importlib.reload(security)  # restore a usable module for later tests
