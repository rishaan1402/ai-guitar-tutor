"""JWT creation/verification and password hashing."""
from __future__ import annotations

import os
import secrets
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext

_DEV_SECRET = "dev-secret-change-in-production-use-64-chars"


def _is_production() -> bool:
    # Cloud Run always sets K_SERVICE; APP_ENV lets other hosts opt in.
    return bool(os.environ.get("K_SERVICE")) or os.environ.get("APP_ENV") == "production"


SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "")
if not SECRET_KEY:
    if _is_production():
        # Fail closed: a guessable signing key would let anyone mint admin tokens.
        raise RuntimeError("JWT_SECRET_KEY must be set in production.")
    import warnings
    warnings.warn(
        "JWT_SECRET_KEY is not set; using an insecure dev value.",
        stacklevel=1,
    )
    SECRET_KEY = _DEV_SECRET
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ---------------------------------------------------------------------------
# Passwords
# ---------------------------------------------------------------------------


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ---------------------------------------------------------------------------
# JWT tokens
# ---------------------------------------------------------------------------


def _make_token(data: dict, expire_delta: timedelta) -> str:
    payload = data.copy()
    payload["exp"] = datetime.now(timezone.utc) + expire_delta
    # Unique per token: without it, two tokens for one user in the same second are
    # identical, so revoking one (logout, reset) could be undone by the next login.
    payload["jti"] = secrets.token_urlsafe(16)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def create_access_token(user_id: str, role: str, token_version: int = 0) -> str:
    return _make_token(
        {"sub": user_id, "role": role, "type": "access", "tv": token_version},
        timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )


def create_refresh_token(user_id: str) -> str:
    return _make_token(
        {"sub": user_id, "type": "refresh"},
        timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
    )


def decode_token(token: str) -> dict:
    """Decode and verify a JWT. Raises JWTError on invalid/expired tokens."""
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
