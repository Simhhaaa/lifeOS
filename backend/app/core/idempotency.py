"""Exactly-once mutations (D2, docs/api-contracts.md §1).

The idempotency row is written in the SAME transaction as the change it protects:
- first request:  insert key → do the work → store the response → commit (all or nothing)
- replay:         same key + same body → stored response, nothing re-executed
- misuse:         same key + different body → 422 idempotency_mismatch
- concurrent:     the second insert waits on the unique key until the first commits, then replays
If the work fails, the transaction (and the key) roll back, so the client may retry.
"""

import hashlib
import json
import uuid
from typing import Annotated, Any

from fastapi import Header, Request
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ApiError
from app.models import IdempotencyKey

KeyHeader = Annotated[
    str,
    Header(
        alias="Idempotency-Key",
        min_length=16,
        max_length=128,
        description="Client-generated, unique per logical action",
    ),
]


def _canonical(body: Any) -> bytes:
    if isinstance(body, BaseModel):
        body = body.model_dump(mode="json", exclude_unset=True)
    return json.dumps(body, sort_keys=True, separators=(",", ":"), default=str).encode()


class Idempotency:
    def __init__(self, session: AsyncSession, user_id: uuid.UUID, key: str, request: Request) -> None:
        self.session, self.user_id, self.key = session, user_id, key
        self.method, self.path = request.method, request.url.path

    async def begin(self, body: Any = None) -> Response | None:
        """Returns the stored response for a replay, or None if this request should run."""
        digest = hashlib.sha256(self.method.encode() + b" " + self.path.encode() + b"\n" + _canonical(body)).digest()
        inserted = await self.session.execute(
            pg_insert(IdempotencyKey)
            .values(user_id=self.user_id, key=self.key, method=self.method, path=self.path, request_hash=digest)
            .on_conflict_do_nothing(index_elements=["user_id", "key"])
            .returning(IdempotencyKey.key)
        )
        if inserted.scalar_one_or_none() is not None:
            return None
        row = (
            await self.session.execute(
                select(IdempotencyKey).where(IdempotencyKey.user_id == self.user_id, IdempotencyKey.key == self.key)
            )
        ).scalar_one()
        if row.request_hash != digest:
            raise ApiError(
                422,
                "idempotency_mismatch",
                "Idempotency-Key was already used for a different request",
                "Generate a new key for a new action; reuse a key only to retry the exact same request.",
            )
        if row.status_code is None:  # pragma: no cover - only reachable if a row was left without a response
            raise ApiError(409, "request_in_progress", "The original request is still being processed")
        if row.status_code == 204:
            return Response(status_code=204, headers={"Idempotent-Replayed": "true"})
        return JSONResponse(row.response_body, status_code=row.status_code, headers={"Idempotent-Replayed": "true"})

    async def finish(self, status_code: int, payload: Any = None) -> Response:
        content = payload.model_dump(mode="json") if isinstance(payload, BaseModel) else payload
        await self.session.execute(
            update(IdempotencyKey)
            .where(IdempotencyKey.user_id == self.user_id, IdempotencyKey.key == self.key)
            .values(status_code=status_code, response_body=content)
        )
        if status_code == 204:
            return Response(status_code=204)
        return JSONResponse(content, status_code=status_code)
