"""Song library: generated song lessons stored once and shared.

Generating a song lesson costs several LLM calls and 8–20 s. Most searches are
for songs someone already asked for, so every lesson is kept in
``song_lessons`` and found again two ways:

- by what was typed (``song_query_aliases``), before any LLM call;
- by the song the AI identified ("title|artist"), after the one ingestion
  call, so "let it be" and "Let It Be - Beatles" land on the same lesson.

Each learner still gets their own session (scores, quiz, revised plan); the
shared copy is only the starting point.
"""
from __future__ import annotations

import re
import unicodedata
import uuid
from typing import Optional

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from council.schemas import LessonDocument, SongObject
from db.models import SongLesson, SongQueryAlias

_PUNCT = re.compile(r"[^\w\s]")
_SPACE = re.compile(r"\s+")
_FILLER = re.compile(r"^(the|a)\s+")


def _norm(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    text = _PUNCT.sub(" ", text.lower())
    return _SPACE.sub(" ", text).strip()


def query_key(query: str) -> str:
    """What someone typed, normalised: case, accents, punctuation and spacing don't matter."""
    return _norm(query)[:160]


def song_key(title: str, artist: str) -> str:
    """The identified song: "let it be|beatles" (a leading "the"/"a" on the artist is dropped)."""
    return f"{_norm(title)}|{_FILLER.sub('', _norm(artist))}"[:240]


def parse_song_id(raw: str) -> Optional[uuid.UUID]:
    try:
        return uuid.UUID(raw)
    except (ValueError, TypeError, AttributeError):
        return None


async def get(db: AsyncSession, song_id: uuid.UUID) -> Optional[SongLesson]:
    return await db.get(SongLesson, song_id)


async def find_by_query(db: AsyncSession, query: str) -> Optional[SongLesson]:
    key = query_key(query)
    if not key:
        return None
    alias = await db.get(SongQueryAlias, key)
    return await db.get(SongLesson, alias.song_id) if alias else None


async def find_by_song(db: AsyncSession, title: str, artist: str) -> Optional[SongLesson]:
    result = await db.execute(select(SongLesson).where(SongLesson.song_key == song_key(title, artist)))
    return result.scalar_one_or_none()


async def store(db: AsyncSession, song: SongObject, lesson: LessonDocument) -> SongLesson:
    """Save a newly generated lesson. If someone saved the same song meanwhile, keep theirs."""
    row = SongLesson(
        song_key=song_key(song.song_title, song.artist),
        song_title=song.song_title[:200],
        artist=(song.artist or "")[:200],
        song_data=song.model_dump(mode="json"),
        lesson_data=lesson.model_copy(update={"lesson_id": "", "song_id": ""}).model_dump(mode="json"),
    )
    db.add(row)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        existing = await find_by_song(db, song.song_title, song.artist)
        if existing is None:
            raise
        return existing
    return row


async def remember_query(db: AsyncSession, query: str, song: SongLesson) -> None:
    key = query_key(query)
    if not key or await db.get(SongQueryAlias, key) is not None:
        return
    db.add(SongQueryAlias(query=key, song_id=song.id))
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()  # someone else recorded it first
        await db.refresh(song)  # the rollback expired it; callers still read it


async def count_hit(db: AsyncSession, song: SongLesson) -> None:
    await db.execute(update(SongLesson).where(SongLesson.id == song.id).values(hits=SongLesson.hits + 1))
    await db.commit()


def lesson_for_learner(song: SongLesson) -> tuple[SongObject, LessonDocument]:
    """The shared lesson as a fresh copy for one learner: a new session id, tagged with its song."""
    lesson = LessonDocument.model_validate(song.lesson_data).model_copy(
        update={"lesson_id": str(uuid.uuid4()), "song_id": str(song.id)}
    )
    return SongObject.model_validate(song.song_data), lesson
