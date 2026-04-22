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
DATABASE_URL = os.environ.get("DATABASE_URL", _DEFAULT_URL)

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
