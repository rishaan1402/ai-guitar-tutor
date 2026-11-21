"""SQLAlchemy 2.0 ORM models for Open Strings."""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import (
    text,
    Boolean,
    CheckConstraint,
    Date,
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
        # logins look users up by lower(email)
        Index("ix_users_email_lower", text("lower(email)")),
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
    # Bumped on password reset, logout and role change; access tokens carry it
    # as "tv" so older tokens stop working immediately.
    token_version: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
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
    password_reset_tokens: Mapped[list[PasswordResetToken]] = relationship(
        "PasswordResetToken", back_populates="user", cascade="all, delete-orphan"
    )
    identities: Mapped[list[UserIdentity]] = relationship(
        "UserIdentity", back_populates="user", cascade="all, delete-orphan"
    )

    @property
    def has_password(self) -> bool:
        """False for accounts made with Google/Facebook that never set a password."""
        return bool(self.password_hash) and not self.password_hash.startswith("!")


class GrooveRun(Base):
    """One play-through of a Groove (a chord loop on the highway) and how each change went."""

    __tablename__ = "groove_runs"
    __table_args__ = (Index("idx_groove_runs_user_time", "user_id", "created_at"),)

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(80), nullable=False)
    # where it came from: "preset", "ai", "daily", "path", "song", "fix", "lead"
    source: Mapped[str] = mapped_column(String(20), nullable=False, default="preset")
    mode: Mapped[str] = mapped_column(String(10), nullable=False)
    bpm: Mapped[int] = mapped_column(Integer, nullable=False)
    stars: Mapped[int] = mapped_column(Integer, nullable=False)
    groove: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    # [{"from": "G", "to": "C", "status": "on_time", "offset": 0.12}, ...]
    changes: Mapped[list[Any]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class PathProgress(Base):
    """Best result for one session of the learning path."""

    __tablename__ = "path_progress"
    __table_args__ = (UniqueConstraint("user_id", "session_id", name="uq_path_user_session"),)

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    session_id: Mapped[str] = mapped_column(String(40), nullable=False)
    stars: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class UserGoal(Base):
    """A goal the learner set with the coach ("play Wonderwall in 3 weeks")."""

    __tablename__ = "user_goals"
    __table_args__ = (Index("idx_user_goals_user", "user_id"),)

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    chords: Mapped[list[Any]] = mapped_column(JSON, default=list)
    target_date: Mapped[date] = mapped_column(Date, nullable=False)
    plan: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="1")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class CoachReport(Base):
    """The coach's weekly report, generated once per user per week."""

    __tablename__ = "coach_reports"
    __table_args__ = (UniqueConstraint("user_id", "week_start", name="uq_report_user_week"),)

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    week_start: Mapped[date] = mapped_column(Date, nullable=False)
    stats: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class ContentReport(Base):
    """A learner flagging AI-written text (feedback, a song chart or lesson) as wrong or inappropriate."""

    __tablename__ = "content_reports"
    __table_args__ = (
        CheckConstraint(
            "kind IN ('feedback','song_chart','song_lesson','tip','other')", name="ck_report_kind"
        ),
        Index("idx_reports_created", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=_uuid)
    # kept when the reporter deletes their account: the report is about our content, not them
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    kind: Mapped[str] = mapped_column(String(20), nullable=False)
    reason: Mapped[str] = mapped_column(String(40), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    context: Mapped[str | None] = mapped_column(String(200), nullable=True)
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    resolved: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class UserIdentity(Base):
    """A Google / Facebook account linked to a user (sign in with either)."""

    __tablename__ = "user_identities"
    __table_args__ = (
        UniqueConstraint("provider", "subject", name="uq_identity_provider_subject"),
        CheckConstraint("provider IN ('google','facebook')", name="ck_identity_provider"),
        Index("idx_identities_user", "user_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    provider: Mapped[str] = mapped_column(String(20), nullable=False)
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    user: Mapped[User] = relationship("User", back_populates="identities")


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


class PasswordResetToken(Base):
    """Single-use token emailed to a user who forgot their password."""

    __tablename__ = "password_reset_tokens"
    __table_args__ = (Index("idx_password_reset_user", "user_id"),)

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=_uuid
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now
    )

    user: Mapped[User] = relationship("User", back_populates="password_reset_tokens")


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


# ---------------------------------------------------------------------------
# Classes (teacher <-> student links)
# ---------------------------------------------------------------------------


class TeacherInviteCode(Base):
    """The code a teacher shares so students can join their class."""

    __tablename__ = "teacher_invite_codes"

    teacher_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    code: Mapped[str] = mapped_column(String(16), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now
    )


class TeacherStudent(Base):
    """A student who joined a teacher's class. Teachers only see linked students."""

    __tablename__ = "teacher_students"
    __table_args__ = (
        UniqueConstraint("teacher_id", "student_id", name="uq_teacher_student"),
        Index("idx_teacher_students_teacher", "teacher_id"),
        Index("idx_teacher_students_student", "student_id"),
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
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now
    )


# ---------------------------------------------------------------------------
# Song sheets (ChordPro chord charts and tabs)
# ---------------------------------------------------------------------------


class SongSheet(Base):
    """A user- or teacher-written chord sheet. The built-in library lives in data/songs/."""

    __tablename__ = "song_sheets"
    __table_args__ = (
        CheckConstraint("visibility IN ('private','class')", name="ck_song_sheets_visibility"),
        Index("idx_song_sheets_owner", "owner_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=_uuid
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    # title/artist/key/difficulty are copied out of the ChordPro directives on save
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    artist: Mapped[str | None] = mapped_column(String(200), nullable=True)
    song_key: Mapped[str | None] = mapped_column(String(20), nullable=True)
    difficulty: Mapped[str | None] = mapped_column(String(20), nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    visibility: Mapped[str] = mapped_column(String(20), nullable=False, default="private")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now
    )


class ChordTip(Base):
    """Coaching tips for one chord shape, written once and shared by everyone."""

    __tablename__ = "chord_tips"
    __table_args__ = (UniqueConstraint("symbol", "frets", name="uq_chord_tip_shape"),)

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=_uuid)
    symbol: Mapped[str] = mapped_column(String(24), nullable=False)
    # the shape, strings 6..1, e.g. "x,3,2,0,3,3"
    frets: Mapped[str] = mapped_column(String(40), nullable=False)
    tips: Mapped[list[str]] = mapped_column(JSON, default=list)
    source: Mapped[str] = mapped_column(String(12), nullable=False, default="template")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
