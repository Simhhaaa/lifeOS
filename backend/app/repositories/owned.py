"""Ownership-safe access to synced records. Every query filters by user_id (security doc §3)."""

import uuid
from datetime import UTC, date, datetime
from typing import Any
from zoneinfo import ZoneInfo

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ApiError, gone, not_found, version_conflict
from app.models.base import StdMixin


async def get_owned[M: StdMixin](
    session: AsyncSession, model: type[M], user_id: uuid.UUID, record_id: uuid.UUID, *, lock: bool = False
) -> M:
    """The record if it belongs to the user. Foreign and missing both → 404. Tombstoned → 410."""
    stmt = select(model).where(model.id == record_id, model.user_id == user_id)
    if lock:
        stmt = stmt.with_for_update()
    obj = (await session.execute(stmt)).scalar_one_or_none()
    if obj is None:
        raise not_found()
    if obj.deleted_at is not None:
        raise gone()
    return obj


def parse_if_match(value: str | None, *, required: bool = True) -> int | None:
    if value is None:
        if required:
            raise ApiError(428, "precondition_required", "If-Match header with the record version is required")
        return None
    try:
        return int(value.strip('"W/ '))
    except ValueError as exc:
        raise ApiError(422, "validation_error", "If-Match must be the record's integer version") from exc


def check_version(obj: StdMixin, expected: int, out: type[BaseModel]) -> None:
    """No silent overwrite (D3): a stale version → 409 with the server copy."""
    if obj.version != expected:
        raise version_conflict(out.model_validate(obj).model_dump(mode="json"))


def apply(obj: Any, values: dict[str, Any]) -> None:
    for k, v in values.items():
        setattr(obj, k, v)
    obj.version = obj.version + 1


async def insert_owned[M: StdMixin](session: AsyncSession, obj: M) -> M:
    """Insert; a unique-constraint clash (client id, natural key) → 409 duplicate. Returns the refreshed row."""
    session.add(obj)
    try:
        async with session.begin_nested():
            await session.flush()
    except IntegrityError as exc:
        raise ApiError(409, "duplicate", "A matching record already exists") from exc
    await session.refresh(obj)
    return obj


async def require_ref(
    session: AsyncSession, model: type[StdMixin], user_id: uuid.UUID, ref_id: uuid.UUID | None, field: str
) -> None:
    """A referenced record (e.g. subject_id) must exist, be live and belong to the user; otherwise 422.

    The message is the same for foreign and missing ids, so nothing about other users leaks.
    """
    if ref_id is None:
        return
    found = (
        await session.execute(
            select(model.id).where(model.id == ref_id, model.user_id == user_id, model.deleted_at.is_(None))
        )
    ).scalar_one_or_none()
    if found is None:
        raise ApiError(
            422,
            "validation_error",
            "The request is not valid",
            errors=[{"field": field, "message": "not found"}],
        )


def local_date_for(ts: datetime, tz: str) -> date:
    """The owner-local calendar day of a timestamp (D5)."""
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=UTC)
    return ts.astimezone(ZoneInfo(tz)).date()


def today_for(tz: str) -> date:
    return datetime.now(ZoneInfo(tz)).date()
