from __future__ import annotations

import os
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

# Falls back to a local SQLite for local dev without docker
_DEFAULT_URL = "sqlite+aiosqlite:///./guitar_tutor.db"
_raw_url = os.environ.get("DATABASE_URL", _DEFAULT_URL)

# Render (and Heroku) provide postgres:// or postgresql:// URLs.
# asyncpg requires the postgresql+asyncpg:// scheme.
def _normalize_db_url(url: str) -> str:
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+asyncpg://", 1)
    if url.startswith("postgresql://") and "+asyncpg" not in url:
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url

DATABASE_URL = _normalize_db_url(_raw_url)

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    # SQLite doesn't support pool_size/max_overflow
    **(
        {"pool_pre_ping": True, "pool_size": 5, "max_overflow": 10}
        if not DATABASE_URL.startswith("sqlite")
        else {}
    ),
)

async_session = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        yield session
