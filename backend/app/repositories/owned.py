"""Ownership-safe access to synced records. Every query filters by user_id (security doc §3)."""

import uuid
from typing import Any

from pydantic import BaseModel
from sqlalchemy import select
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
