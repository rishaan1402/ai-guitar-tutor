"""Pydantic models for auth request/response."""
from __future__ import annotations

import uuid
from datetime import datetime

from typing import Annotated

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
        v = v.strip()
        if not v:
            raise ValueError("Display name cannot be empty")
        return v


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

    model_config = {"from_attributes": True}


class UpdateProfileRequest(BaseModel):
    display_name: str | None = None
    skill_level: str | None = None

    @field_validator("skill_level")
    @classmethod
    def valid_skill(cls, v: str | None) -> str | None:
        if v is not None and v not in ("beginner", "intermediate", "advanced"):
            raise ValueError("skill_level must be beginner, intermediate, or advanced")
        return v


class DeleteAccountRequest(BaseModel):
    password: Password


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: Password

    @field_validator("new_password")
    @classmethod
    def password_length(cls, v: str) -> str:
        return _check_password(v)
