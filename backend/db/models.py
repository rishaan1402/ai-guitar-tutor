"""SQLAlchemy 2.0 ORM models for AI Guitar Tutor."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from db.engine import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("role IN ('student','teacher','admin')", name="ck_users_role"),
        CheckConstraint(
            "skill_level IN ('beginner','intermediate','advanced')",
            name="ck_users_skill",
        ),
        Index("idx_users_email", "email"),
        Index("idx_users_role", "role"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=_uuid
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="student")
    skill_level: Mapped[str] = mapped_column(
        String(20), nullable=False, default="beginner"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now
    )

    # Relationships
    refresh_tokens: Mapped[list[RefreshToken]] = relationship(
        "RefreshToken", back_populates="user", cascade="all, delete-orphan"
    )
    chord_attempts: Mapped[list[ChordAttempt]] = relationship(
        "ChordAttempt", back_populates="user", cascade="all, delete-orphan"
    )
    transition_drills: Mapped[list[TransitionDrill]] = relationship(
        "TransitionDrill", back_populates="user", cascade="all, delete-orphan"
    )
    quiz_results: Mapped[list[QuizResult]] = relationship(
        "QuizResult", back_populates="user", cascade="all, delete-orphan"
    )


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    __table_args__ = (
        Index("idx_refresh_tokens_hash", "token_hash"),
        Index("idx_refresh_tokens_user", "user_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=_uuid
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    token_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now
    )

    user: Mapped[User] = relationship("User", back_populates="refresh_tokens")


# ---------------------------------------------------------------------------
# Practice data
# ---------------------------------------------------------------------------


class ChordAttempt(Base):
    """One recorded audio submission for a chord."""

    __tablename__ = "chord_attempts"
    __table_args__ = (
        Index("idx_chord_attempts_user", "user_id"),
        Index("idx_chord_attempts_user_chord", "user_id", "chord_name"),
        Index("idx_chord_attempts_created", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=_uuid
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    chord_name: Mapped[str] = mapped_column(String(50), nullable=False)
    score: Mapped[float] = mapped_column(Float, nullable=False)
    detected_notes: Mapped[list[Any]] = mapped_column(JSON, default=list)
    missing_notes: Mapped[list[Any]] = mapped_column(JSON, default=list)
    extra_notes: Mapped[list[Any]] = mapped_column(JSON, default=list)
    issue: Mapped[str | None] = mapped_column(String(50), nullable=True)
    feedback_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now
    )

    user: Mapped[User] = relationship("User", back_populates="chord_attempts")


class TransitionDrill(Base):
    """One completed 60-second transition training session."""

    __tablename__ = "transition_drills"
    __table_args__ = (
        Index("idx_transition_drills_user", "user_id"),
        Index("idx_transition_drills_pair", "user_id", "chord_a", "chord_b"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=_uuid
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    chord_a: Mapped[str] = mapped_column(String(50), nullable=False)
    chord_b: Mapped[str] = mapped_column(String(50), nullable=False)
    chord_a_symbol: Mapped[str] = mapped_column(String(20), nullable=False)
    chord_b_symbol: Mapped[str] = mapped_column(String(20), nullable=False)
    tpm: Mapped[int] = mapped_column(Integer, nullable=False)
    got_count: Mapped[int] = mapped_column(Integer, nullable=False)
    miss_count: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now
    )

    user: Mapped[User] = relationship("User", back_populates="transition_drills")


class QuizResult(Base):
    """A student's quiz attempt for a lesson."""

    __tablename__ = "quiz_results"
    __table_args__ = (Index("idx_quiz_results_user", "user_id"),)

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=_uuid
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    lesson_id: Mapped[str] = mapped_column(String(100), nullable=False)
    answers: Mapped[list[Any]] = mapped_column(JSON, nullable=False)
    score: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now
    )

    user: Mapped[User] = relationship("User", back_populates="quiz_results")


# ---------------------------------------------------------------------------
# Session stores (DB-backed replacements for in-memory dicts)
# ---------------------------------------------------------------------------


class LessonSessionDB(Base):
    """Persisted lesson session — replaces in-memory session_store._store."""

    __tablename__ = "lesson_sessions"
    __table_args__ = (
        Index("idx_lesson_sessions_lesson_id", "lesson_id"),
        Index("idx_lesson_sessions_user", "user_id"),
        Index("idx_lesson_sessions_expires", "expires_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=_uuid
    )
    lesson_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    song_data: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    lesson_data: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    chord_scores: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    cached_quiz: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )


class TutorSessionDB(Base):
    """Persisted tutor agent session — replaces in-memory main._sessions."""

    __tablename__ = "tutor_sessions"
    __table_args__ = (
        Index("idx_tutor_sessions_sid", "session_id"),
        Index("idx_tutor_sessions_last", "last_access"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=_uuid
    )
    session_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    agent_state: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    last_access: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now
    )


# ---------------------------------------------------------------------------
# Teacher features
# ---------------------------------------------------------------------------


class TeacherAssignment(Base):
    """A teacher assigning practice work to a student."""

    __tablename__ = "teacher_assignments"
    __table_args__ = (
        UniqueConstraint(
            "teacher_id", "student_id", "chord_name", name="uq_teacher_student_chord"
        ),
        Index("idx_assignments_teacher", "teacher_id"),
        Index("idx_assignments_student", "student_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=_uuid
    )
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    chord_name: Mapped[str | None] = mapped_column(String(50), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now
    )
