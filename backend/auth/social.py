"""Sign in with Google or Facebook.

The client (web page or Android app) gets a token from the provider and sends it
here; we verify it with the provider ourselves and never trust anything else the
client says about who the user is.

- Google: an OpenID Connect ID token, checked against Google's published keys,
  issuer, expiry and our client IDs (GOOGLE_CLIENT_IDS, comma-separated: the web
  client ID, which the Android app also uses as its server client ID).
- Facebook: a user access token, checked with Graph API ``debug_token`` against
  our app (FACEBOOK_APP_ID / FACEBOOK_APP_SECRET), then ``/me`` for id/name/email.

A provider is enabled only when its settings are present.
"""
from __future__ import annotations

import logging
import os
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import httpx
import jwt
from jwt import PyJWKSet, PyJWTError

logger = logging.getLogger(__name__)

GOOGLE_CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs"
GOOGLE_ISSUERS = {"accounts.google.com", "https://accounts.google.com"}
GRAPH = "https://graph.facebook.com/v19.0"


class SocialAuthError(Exception):
    """The token was missing, invalid, expired or for another app."""


@dataclass
class SocialIdentity:
    provider: str          # "google" | "facebook"
    subject: str           # the provider's stable user id
    email: Optional[str]
    email_verified: bool
    name: Optional[str]


def google_client_ids() -> List[str]:
    return [c.strip() for c in os.environ.get("GOOGLE_CLIENT_IDS", "").split(",") if c.strip()]


def facebook_app() -> Optional[tuple[str, str]]:
    app_id = os.environ.get("FACEBOOK_APP_ID", "").strip()
    secret = os.environ.get("FACEBOOK_APP_SECRET", "").strip()
    return (app_id, secret) if app_id and secret else None


def enabled_providers() -> Dict[str, Any]:
    """Public config for the sign-in buttons (no secrets)."""
    out: Dict[str, Any] = {}
    ids = google_client_ids()
    if ids:
        out["google"] = {"client_id": ids[0]}
    fb = facebook_app()
    if fb:
        out["facebook"] = {"app_id": fb[0]}
        # public, needed by the Android Facebook SDK (not the app secret)
        token = os.environ.get("FACEBOOK_CLIENT_TOKEN", "").strip()
        if token:
            out["facebook"]["client_token"] = token
    return out


# ---------------------------------------------------------------- Google

_certs: Dict[str, Any] = {"keys": None, "expires": 0.0}


async def _google_keys(client: httpx.AsyncClient) -> Dict[str, Any]:
    if _certs["keys"] is None or time.time() >= _certs["expires"]:
        resp = await client.get(GOOGLE_CERTS_URL, timeout=10)
        resp.raise_for_status()
        max_age = 3600
        for part in resp.headers.get("cache-control", "").split(","):
            part = part.strip()
            if part.startswith("max-age="):
                try:
                    max_age = int(part.split("=", 1)[1])
                except ValueError:
                    pass
        _certs["keys"] = resp.json()
        _certs["expires"] = time.time() + max_age
    return _certs["keys"]


async def verify_google(id_token: str, client: Optional[httpx.AsyncClient] = None) -> SocialIdentity:
    audiences = google_client_ids()
    if not audiences:
        raise SocialAuthError("Google sign-in isn't set up")
    own = client is None
    client = client or httpx.AsyncClient()
    try:
        keys = await _google_keys(client)
    except httpx.HTTPError as e:
        logger.error("Could not fetch Google certs: %s", e)
        raise SocialAuthError("Couldn't reach Google, try again") from e
    finally:
        if own:
            await client.aclose()
    try:
        kid = jwt.get_unverified_header(id_token).get("kid")
        signing_key = next(k for k in PyJWKSet.from_dict(keys).keys if k.key_id == kid)
        # audience is checked below against every configured client ID
        claims = jwt.decode(id_token, signing_key.key, algorithms=["RS256"], options={"verify_aud": False})
    except (PyJWTError, StopIteration, ValueError, KeyError) as e:
        raise SocialAuthError("Google sign-in token is invalid or expired") from e
    if claims.get("iss") not in GOOGLE_ISSUERS:
        raise SocialAuthError("Token wasn't issued by Google")
    aud = claims.get("aud")
    if (aud if isinstance(aud, str) else None) not in audiences:
        raise SocialAuthError("Token is for a different app")
    sub = claims.get("sub")
    if not sub:
        raise SocialAuthError("Token has no user id")
    verified = claims.get("email_verified") in (True, "true")
    return SocialIdentity("google", str(sub), (claims.get("email") or None), verified, claims.get("name"))


# ---------------------------------------------------------------- Facebook

async def verify_facebook(access_token: str, client: Optional[httpx.AsyncClient] = None) -> SocialIdentity:
    app = facebook_app()
    if not app:
        raise SocialAuthError("Facebook sign-in isn't set up")
    app_id, secret = app
    own = client is None
    client = client or httpx.AsyncClient()
    try:
        dbg = await client.get(
            f"{GRAPH}/debug_token",
            params={"input_token": access_token, "access_token": f"{app_id}|{secret}"},
            timeout=10,
        )
        data = dbg.json().get("data", {}) if dbg.status_code == 200 else {}
        if not data.get("is_valid") or str(data.get("app_id")) != app_id or not data.get("user_id"):
            raise SocialAuthError("Facebook sign-in token is invalid or for a different app")
        me = await client.get(
            f"{GRAPH}/me", params={"fields": "id,name,email", "access_token": access_token}, timeout=10,
        )
        if me.status_code != 200:
            raise SocialAuthError("Couldn't read your Facebook profile")
        prof = me.json()
    except httpx.HTTPError as e:
        logger.error("Facebook verification failed: %s", e)
        raise SocialAuthError("Couldn't reach Facebook, try again") from e
    finally:
        if own:
            await client.aclose()
    if str(prof.get("id")) != str(data.get("user_id")):
        raise SocialAuthError("Facebook token doesn't match the profile")
    # Meta returns the account's primary email; it is not an OIDC-verified claim, so the
    # router uses it for new accounts only and never to link into an existing one.
    email = prof.get("email") or None
    return SocialIdentity("facebook", str(prof["id"]), email, email is not None, prof.get("name"))
