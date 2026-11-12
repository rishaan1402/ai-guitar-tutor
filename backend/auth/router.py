"""Auth endpoints: signup, login, refresh, me, logout, account deletion, password reset."""
from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from jose import JWTError
from sqlalchemy import case, delete, func, select
from starlette.concurrency import run_in_threadpool
from sqlalchemy.ext.asyncio import AsyncSession

from auth.account import delete_user_and_data
from auth.dependencies import get_current_user
from auth.mailer import send_password_reset
from auth.rate_limit import client_ip, login_limiter, reset_limiter, signup_limiter
from auth.schemas import (
    DeleteAccountRequest,
    LoginRequest,
    PasswordResetConfirm,
    PasswordResetRequest,
    RefreshRequest,
    SignupRequest,
    TokenResponse,
    UpdateProfileRequest,
    UserResponse,
)
from auth.security import (
    REFRESH_TOKEN_EXPIRE_DAYS,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from db.engine import get_db
from db.models import PasswordResetToken, RefreshToken, User

router = APIRouter(prefix="/api/auth", tags=["auth"])

RESET_TOKEN_MINUTES = 30


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


async def _store_refresh_token(db: AsyncSession, user_id, token: str) -> None:
    expires = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    db.add(
        RefreshToken(
            user_id=user_id,
            token_hash=_hash_token(token),
            expires_at=expires,
        )
    )
    await db.commit()


_DUMMY_HASH = hash_password("timing-equaliser-not-a-real-password")


async def _find_user_by_email(db: AsyncSession, email: str) -> User | None:
    """Case-insensitive lookup. Accounts created before emails were normalised
    may differ only by case; prefer the exact spelling, then the oldest row,
    instead of failing with MultipleResultsFound."""
    raw = email.strip()
    result = await db.execute(
        select(User)
        .where(func.lower(User.email) == raw.lower())
        .order_by(case((User.email == raw, 0), else_=1), User.created_at)
        .limit(1)
    )
    return result.scalars().first()


# ---------------------------------------------------------------------------
# Signup
# ---------------------------------------------------------------------------


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def signup(body: SignupRequest, request: Request, db: AsyncSession = Depends(get_db)):
    ip_key = client_ip(request)
    # Only successful signups count, so typos and validation errors from a
    # classroom sharing one school IP don't use up the allowance.
    signup_limiter.check(ip_key)
    # Check email uniqueness
    if await _find_user_by_email(db, body.email) is not None:
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        email=body.email.strip().lower(),
        password_hash=await run_in_threadpool(hash_password, body.password),
        display_name=body.display_name.strip(),
        role="student",
        skill_level="beginner",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    signup_limiter.hit(ip_key)

    access = create_access_token(str(user.id), user.role)
    refresh = create_refresh_token(str(user.id))
    await _store_refresh_token(db, user.id, refresh)
    return TokenResponse(access_token=access, refresh_token=refresh)


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    # Only failures count, keyed per ip+email so one attacker can't lock out everyone
    limit_key = f"{client_ip(request)}:{body.email.lower()}"
    login_limiter.check(limit_key)
    user = await _find_user_by_email(db, body.email)
    # Always run one bcrypt check so response time doesn't reveal whether the
    # email is registered.
    password_ok = await run_in_threadpool(
        verify_password,
        body.password, user.password_hash if user is not None else _DUMMY_HASH
    )
    if user is None or not password_ok:
        login_limiter.hit(limit_key)
        raise HTTPException(status_code=401, detail="Invalid email or password")
    login_limiter.reset(limit_key)

    access = create_access_token(str(user.id), user.role)
    refresh = create_refresh_token(str(user.id))
    await _store_refresh_token(db, user.id, refresh)
    return TokenResponse(access_token=access, refresh_token=refresh)


# ---------------------------------------------------------------------------
# Refresh
# ---------------------------------------------------------------------------


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    try:
        payload = decode_token(body.refresh_token)
        if payload.get("type") != "refresh":
            raise ValueError("wrong type")
        user_id = payload["sub"]
    except (JWTError, KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    token_hash = _hash_token(body.refresh_token)
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.expires_at > datetime.now(timezone.utc),
        )
    )
    stored = result.scalar_one_or_none()
    if stored is None:
        raise HTTPException(status_code=401, detail="Refresh token not found or expired")

    user = await db.get(User, stored.user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")

    access = create_access_token(str(user.id), user.role)
    # Issue a new refresh token and invalidate the old one
    new_refresh = create_refresh_token(str(user.id))
    await db.delete(stored)
    await db.commit()
    await _store_refresh_token(db, user.id, new_refresh)
    return TokenResponse(access_token=access, refresh_token=new_refresh)


# ---------------------------------------------------------------------------
# Me
# ---------------------------------------------------------------------------


@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)):
    return user


@router.patch("/me", response_model=UserResponse)
async def update_me(
    body: UpdateProfileRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.display_name is not None:
        user.display_name = body.display_name.strip()
    if body.skill_level is not None:
        user.skill_level = body.skill_level
    await db.commit()
    await db.refresh(user)
    return user


# ---------------------------------------------------------------------------
# Logout
# ---------------------------------------------------------------------------


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    body: RefreshRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    token_hash = _hash_token(body.refresh_token)
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.user_id == user.id,
        )
    )
    stored = result.scalar_one_or_none()
    if stored:
        await db.delete(stored)
        await db.commit()


# ---------------------------------------------------------------------------
# Account deletion (required by both app stores)
# ---------------------------------------------------------------------------


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_me(
    body: DeleteAccountRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Permanently delete the signed-in account and all of its practice data."""
    if not await run_in_threadpool(verify_password, body.password, user.password_hash):
        raise HTTPException(status_code=403, detail="Password is incorrect")
    await delete_user_and_data(db, user)


# ---------------------------------------------------------------------------
# Password reset
# ---------------------------------------------------------------------------


@router.post("/password-reset/request", status_code=status.HTTP_202_ACCEPTED)
async def request_password_reset(
    body: PasswordResetRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Email a reset link. Always 202, so the response never reveals whether an email is registered."""
    ip_key = client_ip(request)
    reset_limiter.check(ip_key)
    reset_limiter.hit(ip_key)

    user = await _find_user_by_email(db, body.email)
    if user is not None:
        # One live token per user: drop older ones
        await db.execute(delete(PasswordResetToken).where(PasswordResetToken.user_id == user.id))
        token = secrets.token_urlsafe(32)
        db.add(PasswordResetToken(
            user_id=user.id,
            token_hash=_hash_token(token),
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_MINUTES),
        ))
        await db.commit()
        await send_password_reset(user.email, token, RESET_TOKEN_MINUTES)
    return {"status": "ok", "message": "If that email is registered, a reset link is on its way."}


@router.post("/password-reset/confirm", status_code=status.HTTP_204_NO_CONTENT)
async def confirm_password_reset(body: PasswordResetConfirm, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(PasswordResetToken).where(
            PasswordResetToken.token_hash == _hash_token(body.token),
            PasswordResetToken.used_at.is_(None),
            PasswordResetToken.expires_at > datetime.now(timezone.utc),
        )
    )
    stored = result.scalar_one_or_none()
    if stored is None:
        raise HTTPException(status_code=400, detail="Reset link is invalid or has expired")

    user = await db.get(User, stored.user_id)
    if user is None:
        raise HTTPException(status_code=400, detail="Reset link is invalid or has expired")

    user.password_hash = await run_in_threadpool(hash_password, body.new_password)
    stored.used_at = datetime.now(timezone.utc)
    # Sign out every device: whoever had the old password loses their sessions
    await db.execute(delete(RefreshToken).where(RefreshToken.user_id == user.id))
    await db.commit()
