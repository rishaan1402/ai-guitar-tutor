"""Admin-only endpoints."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.account import delete_user_and_data
from auth.dependencies import require_role
from db.engine import get_db
from council import library
from db.models import ChordAttempt, ContentReport, SongLesson, TransitionDrill, User

router = APIRouter(
    prefix="/api/admin",
    tags=["admin"],
    dependencies=[Depends(require_role("admin"))],
)


class RoleUpdate(BaseModel):
    role: str


class UserListItem(BaseModel):
    id: uuid.UUID
    email: str
    display_name: str
    role: str
    skill_level: str
    created_at: str


@router.get("/users", response_model=list[UserListItem])
async def list_users(
    page: int = Query(1, ge=1, le=10_000),
    per_page: int = Query(20, ge=1, le=100),
    role: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    offset = (page - 1) * per_page
    q = select(User)
    if role:
        q = q.where(User.role == role)
    q = q.offset(offset).limit(per_page).order_by(User.created_at.desc())

    result = await db.execute(q)
    users = result.scalars().all()
    return [
        UserListItem(
            id=u.id,
            email=u.email,
            display_name=u.display_name,
            role=u.role,
            skill_level=u.skill_level,
            created_at=u.created_at.isoformat(),
        )
        for u in users
    ]


@router.patch("/users/{user_id}")
async def update_user_role(
    user_id: uuid.UUID,
    body: RoleUpdate,
    db: AsyncSession = Depends(get_db),
):
    if body.role not in ("student", "teacher", "admin"):
        raise HTTPException(400, "Invalid role")
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(404, "User not found")
    if user.role == "admin" and body.role != "admin":
        admins = (await db.execute(select(func.count()).where(User.role == "admin"))).scalar()
        if admins <= 1:
            raise HTTPException(409, "Can't remove the last admin.")
    if user.role != body.role:
        user.token_version = (user.token_version or 0) + 1  # old role claims stop working
    user.role = body.role
    await db.commit()
    return {"id": str(user.id), "role": user.role}


@router.delete("/users/{user_id}", status_code=204)
async def delete_user(user_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(404, "User not found")
    await delete_user_and_data(db, user)


@router.get("/stats")
async def system_stats(db: AsyncSession = Depends(get_db)):
    total_users = await db.execute(select(func.count()).select_from(User))
    by_role = await db.execute(
        select(User.role, func.count()).group_by(User.role)
    )
    total_attempts = await db.execute(
        select(func.count()).select_from(ChordAttempt)
    )
    total_drills = await db.execute(
        select(func.count()).select_from(TransitionDrill)
    )

    return {
        "total_users": total_users.scalar(),
        "users_by_role": {r: c for r, c in by_role.all()},
        "total_chord_attempts": total_attempts.scalar(),
        "total_transition_drills": total_drills.scalar(),
    }


@router.get("/reports")
async def list_reports(
    include_resolved: bool = False,
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    """Reports on AI-written content, newest first."""
    q = select(ContentReport).order_by(ContentReport.created_at.desc()).limit(limit)
    if not include_resolved:
        q = q.where(ContentReport.resolved.is_(False))
    rows = (await db.execute(q)).scalars().all()
    return [
        {"id": str(r.id), "kind": r.kind, "reason": r.reason, "content": r.content, "context": r.context,
         "note": r.note, "resolved": r.resolved, "created_at": r.created_at.isoformat() if r.created_at else None}
        for r in rows
    ]


@router.post("/reports/{report_id}/resolve", status_code=204)
async def resolve_report(report_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    r = await db.get(ContentReport, report_id)
    if r is None:
        raise HTTPException(status_code=404, detail="Report not found")
    r.resolved = True
    await db.commit()


# ---------------------------------------------------------------------------
# Song lessons learners reported, and their suggested chord charts
# ---------------------------------------------------------------------------


@router.get("/songs/reported")
async def reported_songs(db: AsyncSession = Depends(get_db)):
    """Songs whose chords learners flagged, with any corrected charts they sent."""
    songs = (await db.execute(
        select(SongLesson).where(SongLesson.reports > 0).order_by(SongLesson.reports.desc()).limit(100)
    )).scalars().all()
    contexts = [f"song:{s.id}" for s in songs]
    suggestions: dict[str, list] = {}
    if contexts:
        rows = (await db.execute(
            select(ContentReport)
            .where(ContentReport.context.in_(contexts), ContentReport.resolved.is_(False))
            .order_by(ContentReport.created_at.desc())
        )).scalars().all()
        for r in rows:
            suggestions.setdefault(r.context, []).append(
                {"report_id": str(r.id), "chart": r.content, "note": r.note,
                 "created_at": r.created_at.isoformat() if r.created_at else None}
            )
    return [
        {
            "song_id": str(s.id), "title": s.song_title, "artist": s.artist, "reports": s.reports,
            "chart": (s.lesson_data or {}).get("chart", ""),
            "edited_at": s.edited_at.isoformat() if s.edited_at else None,
            "suggestions": suggestions.get(f"song:{s.id}", []),
        }
        for s in songs
    ]


class ChartUpdate(BaseModel):
    chart: str = Field(min_length=10, max_length=8000)
    report_id: uuid.UUID | None = None


async def _song_or_404(db: AsyncSession, song_id: uuid.UUID) -> SongLesson:
    song = await db.get(SongLesson, song_id)
    if song is None:
        raise HTTPException(status_code=404, detail="Song lesson not found")
    return song


async def _resolve_song_reports(db: AsyncSession, song_id: uuid.UUID) -> None:
    rows = (await db.execute(
        select(ContentReport).where(ContentReport.context == f"song:{song_id}", ContentReport.resolved.is_(False))
    )).scalars().all()
    for r in rows:
        r.resolved = True


@router.post("/songs/{song_id}/chart", status_code=204)
async def set_song_chart(song_id: uuid.UUID, body: ChartUpdate, db: AsyncSession = Depends(get_db)):
    """Publish a corrected chart: everyone who opens this song gets it from now on."""
    song = await _song_or_404(db, song_id)
    await _resolve_song_reports(db, song_id)
    await library.set_chart(db, song, body.chart)


@router.post("/songs/{song_id}/dismiss", status_code=204)
async def dismiss_song_reports(song_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """The chords are fine: clear the reports and close the suggestions."""
    song = await _song_or_404(db, song_id)
    song.reports = 0
    await _resolve_song_reports(db, song_id)
    await db.commit()
