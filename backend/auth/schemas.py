"""Pydantic models for auth request/response."""
from __future__ import annotations

import uuid
from datetime import datetime

from typing import Annotated, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


MIN_PASSWORD_LENGTH = 8
# bcrypt only uses the first 72 bytes; longer passwords would silently be
# truncated, so new passwords are capped there. MAX_PASSWORD_CHARS bounds the
# work done on any password field (login included) before hashing.
MAX_PASSWORD_BYTES = 72
MAX_PASSWORD_CHARS = 128


def _check_password(v: str) -> str:
    # Matches the signup form; existing shorter passwords still log in
    if len(v) < MIN_PASSWORD_LENGTH:
        raise ValueError(f"Password must be at least {MIN_PASSWORD_LENGTH} characters")
    if len(v.encode("utf-8")) > MAX_PASSWORD_BYTES:
        raise ValueError(f"Password must be at most {MAX_PASSWORD_BYTES} bytes")
    return v


MAX_DISPLAY_NAME = 60


def _check_display_name(v: str) -> str:
    v = v.strip()
    if not v:
        raise ValueError("Display name cannot be empty")
    if len(v) > MAX_DISPLAY_NAME:
        raise ValueError(f"Display name must be at most {MAX_DISPLAY_NAME} characters")
    return v


Password = Annotated[str, Field(max_length=MAX_PASSWORD_CHARS)]


class SignupRequest(BaseModel):
    email: EmailStr
    password: Password
    display_name: str

    @field_validator("password")
    @classmethod
    def password_length(cls, v: str) -> str:
        return _check_password(v)

    @field_validator("display_name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        return _check_display_name(v)


class LoginRequest(BaseModel):
    email: EmailStr
    password: Password


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    display_name: str
    role: str
    skill_level: str
    created_at: datetime
    # False for Google/Facebook accounts with no password (account deletion asks for a typed confirmation instead)
    has_password: bool = True

    model_config = {"from_attributes": True}


class UpdateProfileRequest(BaseModel):
    display_name: str | None = None
    skill_level: str | None = None

    @field_validator("display_name")
    @classmethod
    def name_ok(cls, v: str | None) -> str | None:
        return None if v is None else _check_display_name(v)

    @field_validator("skill_level")
    @classmethod
    def valid_skill(cls, v: str | None) -> str | None:
        if v is not None and v not in ("beginner", "intermediate", "advanced"):
            raise ValueError("skill_level must be beginner, intermediate, or advanced")
        return v


class DeleteAccountRequest(BaseModel):
    # Accounts with a password confirm with it; Google/Facebook-only accounts type DELETE
    password: Optional[Password] = None
    confirm: Optional[str] = Field(default=None, max_length=16)


class SocialLoginRequest(BaseModel):
    """A Google ID token or a Facebook access token, straight from the provider's SDK."""
    token: str = Field(min_length=10, max_length=8192)


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: Password

    @field_validator("new_password")
    @classmethod
    def password_length(cls, v: str) -> str:
        return _check_password(v)
