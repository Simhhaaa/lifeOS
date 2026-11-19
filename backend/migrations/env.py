"""Alembic environment (async). URL from LIFEOS_DATABASE_URL only."""

import asyncio
import os

from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine

from app.models import Base

target_metadata = Base.metadata


def _url() -> str:
    url = context.config.attributes.get("url") or os.environ.get("LIFEOS_DATABASE_URL")
    if not url:
        raise RuntimeError("Set LIFEOS_DATABASE_URL")
    return url


def run_offline() -> None:
    context.configure(url=_url(), target_metadata=target_metadata, literal_binds=True, compare_type=True)
    with context.begin_transaction():
        context.run_migrations()


def _sync(conn) -> None:  # type: ignore[no-untyped-def]
    context.configure(connection=conn, target_metadata=target_metadata, compare_type=True)
    with context.begin_transaction():
        context.run_migrations()


async def run_online() -> None:
    engine = create_async_engine(_url())
    async with engine.connect() as conn:
        await conn.run_sync(_sync)
    await engine.dispose()


if context.is_offline_mode():
    run_offline()
else:
    connection = context.config.attributes.get("connection")
    if connection is not None:
        _sync(connection)
    else:
        asyncio.run(run_online())
