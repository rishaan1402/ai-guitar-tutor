"""FastAPI dependency functions for authentication and authorisation."""
from __future__ import annotations

import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.security import decode_token
from db.engine import get_db
from db.models import User

_bearer = HTTPBearer(auto_error=False)


async def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """Return the authenticated User, or None when no credentials were sent.

    A token that IS sent but is invalid, expired or revoked raises 401 rather
    than silently downgrading to anonymous: otherwise a signed-in learner's
    takes would quietly stop being saved, and the client would never know to
    refresh its token.
    """
    if credentials is None:
        return None
    try:
        payload = decode_token(credentials.credentials)
        if payload.get("type") != "access":
            raise ValueError("not an access token")
        user_id = uuid.UUID(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise _unauthorized()

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    # A missing "tv" means version 0, so pre-versioning tokens stop working
    # as soon as the user's version is bumped (logout, reset, role change).
    if user is None or payload.get("tv", 0) != (user.token_version or 0):
        raise _unauthorized()
    return user


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Session expired. Please sign in again.",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_current_user(
    user: User | None = Depends(get_current_user_optional),
) -> User:
    """Require authentication. Raises 401 if no valid token."""
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def require_role(*roles: str):
    """Return a dependency that enforces the user has one of the given roles."""

    async def _check(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return user

    return _check
