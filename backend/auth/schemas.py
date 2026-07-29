"""Pydantic models for auth request/response."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, field_validator


MIN_PASSWORD_LENGTH = 8


def _check_password(v: str) -> str:
    # Matches the signup form; existing shorter passwords still log in
    if len(v) < MIN_PASSWORD_LENGTH:
        raise ValueError(f"Password must be at least {MIN_PASSWORD_LENGTH} characters")
    return v


class SignupRequest(BaseModel):
    email: EmailStr
    password: str
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
    password: str


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
    password: str


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_length(cls, v: str) -> str:
        return _check_password(v)
