"""Song sheets: chord charts and tabs in ChordPro format.

Three sources share one viewer:
  * the built-in library (data/songs/*.cho, read-only, ids "lib-<slug>")
  * sheets a user writes (private)
  * sheets a teacher shares with their class (visibility "class")

The library is chord charts only. We don't store or generate copyrighted
lyrics; users may add their own text to their private sheets.
"""
from __future__ import annotations

import logging
import re
import uuid
from pathlib import Path
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_user, get_current_user_optional
from db.engine import get_db
from db.models import SongSheet, TeacherStudent, User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/songs", tags=["songs"])

LIBRARY_DIR = Path(__file__).resolve().parents[2] / "data" / "songs"
MAX_CONTENT_CHARS = 50_000
DIFFICULTIES = ("beginner", "intermediate", "advanced")

_DIRECTIVE = re.compile(r"^\s*\{\s*([a-zA-Z_]+)\s*(?::\s*(.*?))?\s*\}\s*$")
_ALIASES = {"t": "title", "st": "artist", "subtitle": "artist"}


def parse_meta(content: str) -> dict[str, str]:
    """Pull header directives ({title: ...}, {key: ...}) out of a ChordPro sheet."""
    meta: dict[str, str] = {}
    for line in content.splitlines():
        m = _DIRECTIVE.match(line)
        if not m or m.group(2) is None:
            continue
        name = _ALIASES.get(m.group(1).lower(), m.group(1).lower())
        if name in ("title", "artist", "key", "difficulty", "capo", "tempo", "time") and name not in meta:
            meta[name] = m.group(2).strip()
    return meta


# ---------------------------------------------------------------------------
# Library
# ---------------------------------------------------------------------------


def _load_library() -> dict[str, dict]:
    songs: dict[str, dict] = {}
    if not LIBRARY_DIR.exists():
        return songs
    for path in sorted(LIBRARY_DIR.glob("*.cho")):
        content = path.read_text(encoding="utf-8")
        meta = parse_meta(content)
        sheet_id = f"lib-{path.stem}"
        songs[sheet_id] = {
            "id": sheet_id,
            "title": meta.get("title", path.stem.replace("-", " ").title()),
            "artist": meta.get("artist"),
            "key": meta.get("key"),
            "difficulty": meta.get("difficulty"),
            "content": content,
        }
    logger.info("Loaded %d library song sheets", len(songs))
    return songs


_LIBRARY = _load_library()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


Source = Literal["library", "mine", "class"]


class SheetSummary(BaseModel):
    id: str
    title: str
    artist: Optional[str] = None
    key: Optional[str] = None
    difficulty: Optional[str] = None
    source: Source
    owner_name: Optional[str] = None
    visibility: Optional[str] = None


class SheetDetail(SheetSummary):
    content: str
    can_edit: bool = False


class SheetWrite(BaseModel):
    content: str
    visibility: Literal["private", "class"] = "private"

    @field_validator("content")
    @classmethod
    def content_ok(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Sheet is empty")
        if len(v) > MAX_CONTENT_CHARS:
            raise ValueError(f"Sheet is too long (max {MAX_CONTENT_CHARS:,} characters)")
        return v


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _matches(summary: dict, q: str | None, difficulty: str | None) -> bool:
    if difficulty and (summary.get("difficulty") or "").lower() != difficulty:
        return False
    if q:
        hay = f"{summary.get('title') or ''} {summary.get('artist') or ''}".lower()
        return all(word in hay for word in q.lower().split())
    return True


def _apply_meta(sheet: SongSheet, content: str) -> None:
    meta = parse_meta(content)
    title = meta.get("title", "").strip()
    if not title:
        raise HTTPException(status_code=422, detail="Add a title line, e.g. {title: My Song}")
    sheet.title = title[:200]
    artist, key = meta.get("artist"), meta.get("key")
    sheet.artist = artist[:200] if artist else None
    sheet.song_key = key[:20] if key else None
    diff = (meta.get("difficulty") or "").lower()
    sheet.difficulty = diff if diff in DIFFICULTIES else None
    sheet.content = content


async def _teacher_ids_of(db: AsyncSession, user: User) -> list[uuid.UUID]:
    rows = await db.execute(
        select(TeacherStudent.teacher_id).where(TeacherStudent.student_id == user.id)
    )
    return [r[0] for r in rows.all()]


def _summary(sheet: SongSheet, user: User | None, owner_name: str | None) -> dict:
    mine = user is not None and sheet.owner_id == user.id
    return {
        "id": str(sheet.id),
        "title": sheet.title,
        "artist": sheet.artist,
        "key": sheet.song_key,
        "difficulty": sheet.difficulty,
        "source": "mine" if mine else "class",
        "owner_name": owner_name,
        "visibility": sheet.visibility,
    }


async def _load_user_sheet(db: AsyncSession, sheet_id: str) -> SongSheet:
    try:
        sid = uuid.UUID(sheet_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Sheet not found")
    sheet = await db.get(SongSheet, sid)
    if sheet is None:
        raise HTTPException(status_code=404, detail="Sheet not found")
    return sheet


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("", response_model=list[SheetSummary])
async def list_sheets(
    q: str | None = None,
    difficulty: str | None = None,
    user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """Library sheets, plus (when signed in) your own and your teachers' shared sheets."""
    difficulty = difficulty.lower() if difficulty else None
    results: list[dict] = []

    if user is not None:
        teacher_ids = await _teacher_ids_of(db, user)
        visible = or_(
            SongSheet.owner_id == user.id,
            (SongSheet.owner_id.in_(teacher_ids)) & (SongSheet.visibility == "class"),
        ) if teacher_ids else (SongSheet.owner_id == user.id)
        rows = await db.execute(
            select(SongSheet, User.display_name)
            .join(User, User.id == SongSheet.owner_id)
            .where(visible)
            .order_by(SongSheet.updated_at.desc())
            .limit(200)
        )
        for sheet, owner_name in rows.all():
            s = _summary(sheet, user, owner_name)
            if _matches(s, q, difficulty):
                results.append(s)

    for song in _LIBRARY.values():
        s = {k: v for k, v in song.items() if k != "content"} | {"source": "library"}
        if _matches(s, q, difficulty):
            results.append(s)
    return results


@router.get("/{sheet_id}", response_model=SheetDetail)
async def get_sheet(
    sheet_id: str,
    user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    if sheet_id in _LIBRARY:
        return {**_LIBRARY[sheet_id], "source": "library", "can_edit": False}

    sheet = await _load_user_sheet(db, sheet_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Sheet not found")
    is_owner = sheet.owner_id == user.id
    if not is_owner:
        allowed = sheet.visibility == "class" and sheet.owner_id in await _teacher_ids_of(db, user)
        if not allowed:
            raise HTTPException(status_code=404, detail="Sheet not found")
    owner = await db.get(User, sheet.owner_id)
    return {
        **_summary(sheet, user, owner.display_name if owner else None),
        "content": sheet.content,
        "can_edit": is_owner,
    }


@router.post("", response_model=SheetDetail, status_code=status.HTTP_201_CREATED)
async def create_sheet(
    body: SheetWrite,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.visibility == "class" and user.role not in ("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Only teachers can share sheets with a class")
    count = await db.execute(select(SongSheet.id).where(SongSheet.owner_id == user.id))
    if len(count.all()) >= 500:
        raise HTTPException(status_code=400, detail="Sheet limit reached (500)")
    sheet = SongSheet(owner_id=user.id, visibility=body.visibility)
    _apply_meta(sheet, body.content)
    db.add(sheet)
    await db.commit()
    await db.refresh(sheet)
    return {**_summary(sheet, user, user.display_name), "content": sheet.content, "can_edit": True}


@router.put("/{sheet_id}", response_model=SheetDetail)
async def update_sheet(
    sheet_id: str,
    body: SheetWrite,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sheet = await _load_user_sheet(db, sheet_id)
    if sheet.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Sheet not found")
    if body.visibility == "class" and user.role not in ("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Only teachers can share sheets with a class")
    sheet.visibility = body.visibility
    _apply_meta(sheet, body.content)
    await db.commit()
    await db.refresh(sheet)
    return {**_summary(sheet, user, user.display_name), "content": sheet.content, "can_edit": True}


@router.delete("/{sheet_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sheet(
    sheet_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sheet = await _load_user_sheet(db, sheet_id)
    if sheet.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Sheet not found")
    await db.delete(sheet)
    await db.commit()
