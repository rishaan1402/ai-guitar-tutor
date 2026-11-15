"""Google / Facebook sign-in: token verification and account linking."""
from __future__ import annotations

import asyncio
import time
import uuid

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient
from jose import jwk, jwt

import auth.router as auth_router
import auth.social as social
from auth.social import SocialAuthError, SocialIdentity

CLIENT_ID = "web-client.apps.googleusercontent.com"


@pytest.fixture
def client():
    from main import app
    with TestClient(app) as c:
        yield c


def _fake_verifier(ident: SocialIdentity):
    async def verify(token: str):
        if token == "bad-token-xxxx":
            raise SocialAuthError("invalid")
        return ident
    return verify


def _ident(provider="google", sub=None, email=None, verified=True, name="Sam Strummer"):
    return SocialIdentity(provider, sub or uuid.uuid4().hex, email or f"{uuid.uuid4().hex[:8]}@example.com", verified, name)


def _oauth(client, provider, monkeypatch, ident, token="good-token-xxxx"):
    monkeypatch.setitem(auth_router._VERIFIERS, provider, _fake_verifier(ident))
    return client.post(f"/api/auth/oauth/{provider}", json={"token": token})


def _me(client, tokens):
    return client.get("/api/auth/me", headers={"Authorization": f"Bearer {tokens['access_token']}"}).json()


class TestSocialLogin:
    def test_new_google_user_is_created_without_password(self, client, monkeypatch):
        ident = _ident()
        r = _oauth(client, "google", monkeypatch, ident)
        assert r.status_code == 200
        me = _me(client, r.json())
        assert me["email"] == ident.email and me["display_name"] == "Sam Strummer"
        assert me["has_password"] is False
        # no password works for this account
        assert client.post("/api/auth/login", json={"email": ident.email, "password": "anything1"}).status_code == 401

    def test_same_provider_account_signs_into_same_user(self, client, monkeypatch):
        ident = _ident()
        a = _me(client, _oauth(client, "google", monkeypatch, ident).json())
        b = _me(client, _oauth(client, "google", monkeypatch, ident).json())
        assert a["id"] == b["id"]

    def test_links_to_existing_password_account_by_verified_email(self, client, monkeypatch):
        email = f"{uuid.uuid4().hex[:8]}@example.com"
        r = client.post("/api/auth/signup", json={"email": email, "password": "guitar123", "display_name": "Pat"})
        user_id = _me(client, r.json())["id"]
        me = _me(client, _oauth(client, "facebook", monkeypatch, _ident("facebook", email=email)).json())
        assert me["id"] == user_id and me["has_password"] is True
        # password still works after linking
        assert client.post("/api/auth/login", json={"email": email, "password": "guitar123"}).status_code == 200

    def test_unverified_email_is_refused(self, client, monkeypatch):
        r = _oauth(client, "google", monkeypatch, _ident(verified=False))
        assert r.status_code == 400 and "verified email" in r.json()["detail"]

    def test_invalid_token_and_unknown_provider(self, client, monkeypatch):
        assert _oauth(client, "google", monkeypatch, _ident(), token="bad-token-xxxx").status_code == 401
        assert client.post("/api/auth/oauth/myspace", json={"token": "good-token-xxxx"}).status_code == 404

    def test_social_only_account_deletes_with_typed_confirmation(self, client, monkeypatch):
        tokens = _oauth(client, "google", monkeypatch, _ident()).json()
        h = {"Authorization": f"Bearer {tokens['access_token']}"}
        assert client.request("DELETE", "/api/auth/me", json={}, headers=h).status_code == 403
        assert client.request("DELETE", "/api/auth/me", json={"confirm": "delete"}, headers=h).status_code == 204

    def test_providers_lists_only_configured(self, client, monkeypatch):
        monkeypatch.delenv("GOOGLE_CLIENT_IDS", raising=False)
        monkeypatch.delenv("FACEBOOK_APP_ID", raising=False)
        assert client.get("/api/auth/providers").json() == {}
        monkeypatch.setenv("GOOGLE_CLIENT_IDS", CLIENT_ID)
        assert client.get("/api/auth/providers").json() == {"google": {"client_id": CLIENT_ID}}


class TestGoogleTokenVerification:
    """Real signature checks against a locally generated key standing in for Google's."""

    @pytest.fixture
    def signer(self, monkeypatch):
        key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        pem = key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                                serialization.NoEncryption())
        pub = jwk.construct(key.public_key().public_bytes(
            serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo), "RS256").to_dict()
        pub.update(kid="k1", use="sig", alg="RS256")
        pub = {k: (v.decode() if isinstance(v, bytes) else v) for k, v in pub.items()}
        monkeypatch.setitem(social._certs, "keys", {"keys": [pub]})
        monkeypatch.setitem(social._certs, "expires", time.time() + 3600)
        monkeypatch.setenv("GOOGLE_CLIENT_IDS", CLIENT_ID)

        def sign(**over):
            claims = {"iss": "https://accounts.google.com", "aud": CLIENT_ID, "sub": "1234",
                      "email": "a@example.com", "email_verified": True, "name": "A",
                      "iat": int(time.time()), "exp": int(time.time()) + 600}
            claims.update(over)
            return jwt.encode(claims, pem.decode(), algorithm="RS256", headers={"kid": "k1"})
        return sign

    def _verify(self, token):
        return asyncio.run(social.verify_google(token))

    def test_valid_token(self, signer):
        ident = self._verify(signer())
        assert (ident.subject, ident.email, ident.email_verified) == ("1234", "a@example.com", True)

    @pytest.mark.parametrize("over", [
        {"aud": "someone-else.apps.googleusercontent.com"},
        {"iss": "https://evil.example.com"},
        {"exp": int(time.time()) - 10},
    ])
    def test_rejects_wrong_audience_issuer_or_expired(self, signer, over):
        with pytest.raises(SocialAuthError):
            self._verify(signer(**over))

    def test_rejects_tampered_token(self, signer):
        head, body, sig = signer().split(".")
        with pytest.raises(SocialAuthError):
            self._verify(f"{head}.{body}.{sig[::-1]}")
