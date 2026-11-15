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
    SocialLoginRequest,
    TokenResponse,
    UpdateProfileRequest,
    UserResponse,
)
from auth.security import (
    REFRESH_TOKEN_EXPIRE_DAYS,
    create_access_token,
    create_refresh_token,
    decode_token,
    NO_PASSWORD,
    hash_password,
    verify_password,
)
from auth.social import SocialAuthError, SocialIdentity, enabled_providers, verify_facebook, verify_google
from db.engine import get_db
from db.models import PasswordResetToken, RefreshToken, User, UserIdentity

router = APIRouter(prefix="/api/auth", tags=["auth"])

RESET_TOKEN_MINUTES = 30


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


MAX_REFRESH_TOKENS_PER_USER = 10


async def _store_refresh_token(db: AsyncSession, user_id, token: str) -> None:
    now = datetime.now(timezone.utc)
    expires = now + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    # prune: expired tokens, and all but the newest few live ones (devices)
    await db.execute(delete(RefreshToken).where(
        RefreshToken.user_id == user_id, RefreshToken.expires_at <= now))
    keep = (
        select(RefreshToken.id).where(RefreshToken.user_id == user_id)
        .order_by(RefreshToken.expires_at.desc()).limit(MAX_REFRESH_TOKENS_PER_USER - 1)
    )
    await db.execute(delete(RefreshToken).where(
        RefreshToken.user_id == user_id, RefreshToken.id.not_in(keep.scalar_subquery())))
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

    access = create_access_token(str(user.id), user.role, user.token_version or 0)
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
        body.password, user.password_hash if user is not None and user.has_password else _DUMMY_HASH
    )
    if user is None or not user.has_password or not password_ok:
        login_limiter.hit(limit_key)
        raise HTTPException(status_code=401, detail="Invalid email or password")
    login_limiter.reset(limit_key)

    access = create_access_token(str(user.id), user.role, user.token_version or 0)
    refresh = create_refresh_token(str(user.id))
    await _store_refresh_token(db, user.id, refresh)
    return TokenResponse(access_token=access, refresh_token=refresh)


# ---------------------------------------------------------------------------
# Google / Facebook
# ---------------------------------------------------------------------------


@router.get("/providers")
async def social_providers():
    """Which social sign-in buttons to show, with their public client IDs."""
    return enabled_providers()


_VERIFIERS = {"google": verify_google, "facebook": verify_facebook}


async def _user_for_identity(db: AsyncSession, ident: SocialIdentity) -> User:
    """The user this provider account belongs to: linked before, same verified email, or new."""
    linked = (await db.execute(
        select(UserIdentity).where(UserIdentity.provider == ident.provider, UserIdentity.subject == ident.subject)
    )).scalar_one_or_none()
    if linked is not None:
        user = await db.get(User, linked.user_id)
        if user is not None:
            return user
    if not ident.email or not ident.email_verified:
        raise HTTPException(
            status_code=400,
            detail=f"Your {ident.provider.capitalize()} account didn't share a verified email. "
                   "Sign up with email instead, or allow email access and try again.",
        )
    user = await _find_user_by_email(db, ident.email)
    if user is not None and ident.provider != "google":
        # Only Google certifies email ownership (email_verified). Meta doesn't, so a Facebook
        # login never attaches itself to an existing account by email alone.
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists. Log in with your email and password "
                   "(or Google) instead.",
        )
    if user is None:
        name = (ident.name or ident.email.split("@")[0]).strip()[:100] or "Player"
        user = User(
            email=ident.email.strip().lower(),
            password_hash=NO_PASSWORD,
            display_name=name,
            role="student",
            skill_level="beginner",
        )
        db.add(user)
        await db.flush()
    # same verified email: link this provider to the existing account
    db.add(UserIdentity(user_id=user.id, provider=ident.provider, subject=ident.subject, email=ident.email))
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/oauth/{provider}", response_model=TokenResponse)
async def social_login(provider: str, body: SocialLoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """Sign in (or sign up) with a Google ID token or a Facebook access token."""
    verify = _VERIFIERS.get(provider)
    if verify is None:
        raise HTTPException(status_code=404, detail="Unknown sign-in provider")
    limit_key = f"{client_ip(request)}:oauth"
    login_limiter.check(limit_key)
    try:
        ident = await verify(body.token)
    except SocialAuthError as e:
        login_limiter.hit(limit_key)
        raise HTTPException(status_code=401, detail=str(e))
    user = await _user_for_identity(db, ident)
    access = create_access_token(str(user.id), user.role, user.token_version or 0)
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
    # Rotate atomically: only the request that actually deletes the row may mint
    # new tokens, so one stolen refresh token can't fork into several.
    result = await db.execute(
        delete(RefreshToken)
        .where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.expires_at > datetime.now(timezone.utc),
        )
        .returning(RefreshToken.user_id)
    )
    owner = result.scalar_one_or_none()
    await db.commit()
    if owner is None:
        raise HTTPException(status_code=401, detail="Refresh token not found or expired")

    user = await db.get(User, owner)
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")

    access = create_access_token(str(user.id), user.role, user.token_version or 0)
    new_refresh = create_refresh_token(str(user.id))
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
    # Revoke outstanding access tokens; other devices silently refresh.
    user.token_version = (user.token_version or 0) + 1
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
    if user.has_password:
        if not body.password or not await run_in_threadpool(verify_password, body.password, user.password_hash):
            raise HTTPException(status_code=403, detail="Password is incorrect")
    elif (body.confirm or "").strip().upper() != "DELETE":
        raise HTTPException(status_code=403, detail='Type DELETE to confirm')
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
    user.token_version = (user.token_version or 0) + 1
    await db.commit()
