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

def _int_env(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except ValueError:
        return default


# Connections per server instance. Cloud SQL db-f1-micro accepts about 25 in
# total, so (max instances) x (pool + overflow) must stay under that with room
# for migrations and admin: 5 instances x (2 + 2) = 20. Queries are short and
# no request holds a connection while it waits on the AI, so a few go far
# (load test: 50 concurrent graded takes on one instance, p95 about 2 s).
_POOL = (
    {
        "pool_pre_ping": True,
        "pool_size": _int_env("DB_POOL_SIZE", 2),
        "max_overflow": _int_env("DB_MAX_OVERFLOW", 2),
        "pool_timeout": _int_env("DB_POOL_TIMEOUT", 10),
        "pool_recycle": 1800,
    }
    if not DATABASE_URL.startswith("sqlite")  # SQLite doesn't pool
    else {}
)

engine = create_async_engine(DATABASE_URL, echo=False, **_POOL)

async_session = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        yield session
