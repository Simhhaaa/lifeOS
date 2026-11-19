"""Tasks: the reference implementation of the write pattern used everywhere.

ownership → idempotency → validation → version check → write → stored response, in one transaction.
"""

import uuid
from datetime import UTC, date, datetime
from typing import Annotated

from fastapi import APIRouter, Header, Query, Request, Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.api.deps import CurrentUser, Session
from app.core.errors import ApiError
from app.core.idempotency import Idempotency, KeyHeader
from app.models import Task
from app.repositories.owned import apply, check_version, get_owned, parse_if_match
from app.schemas.daily import Task as TaskOut
from app.schemas.daily import TaskInput, TaskPatch

router = APIRouter(tags=["productivity"])
IfMatch = Annotated[str, Header(alias="If-Match", pattern=r"^[0-9]+$")]


@router.get("/tasks", operation_id="listTasks", response_model=list[TaskOut])
async def list_tasks(
    principal: CurrentUser,
    session: Session,
    from_: Annotated[date | None, Query(alias="from")] = None,
    to: date | None = None,
) -> list[Task]:
    stmt = select(Task).where(Task.user_id == principal.id, Task.deleted_at.is_(None))
    if from_:
        stmt = stmt.where(Task.planned_for >= from_)
    if to:
        stmt = stmt.where(Task.planned_for <= to)
    return list((await session.execute(stmt.order_by(Task.planned_for, Task.created_at))).scalars())


@router.post("/tasks", operation_id="createTask", status_code=201, response_model=TaskOut)
async def create_task(
    body: TaskInput, key: KeyHeader, request: Request, principal: CurrentUser, session: Session
) -> Response:
    idem = Idempotency(session, principal.id, key, request)
    if replay := await idem.begin(body):
        return replay
    values = body.model_dump(exclude_none=True)
    task = Task(user_id=principal.id, **values)
    session.add(task)
    try:
        async with session.begin_nested():
            await session.flush()
    except IntegrityError as exc:
        raise ApiError(409, "duplicate", "A record with this id already exists") from exc
    await session.refresh(task)
    return await idem.finish(201, TaskOut.model_validate(task))


@router.patch("/tasks/{id}", operation_id="updateTask", response_model=TaskOut)
async def update_task(
    id: uuid.UUID,  # noqa: A002
    body: TaskPatch,
    key: KeyHeader,
    if_match: IfMatch,
    request: Request,
    principal: CurrentUser,
    session: Session,
) -> Response:
    idem = Idempotency(session, principal.id, key, request)
    if replay := await idem.begin(
        {"id": str(id), "if_match": if_match, "body": body.model_dump(mode="json", exclude_unset=True)}
    ):
        return replay
    task = await get_owned(session, Task, principal.id, id, lock=True)
    check_version(task, parse_if_match(if_match) or 0, TaskOut)
    apply(task, body.model_dump(exclude_unset=True))
    await session.flush()
    await session.refresh(task)
    return await idem.finish(200, TaskOut.model_validate(task))


@router.delete("/tasks/{id}", operation_id="deleteTask", status_code=204)
async def delete_task(
    id: uuid.UUID,  # noqa: A002
    key: KeyHeader,
    if_match: IfMatch,
    request: Request,
    principal: CurrentUser,
    session: Session,
) -> Response:
    idem = Idempotency(session, principal.id, key, request)
    if replay := await idem.begin({"id": str(id), "if_match": if_match}):
        return replay
    task = await get_owned(session, Task, principal.id, id, lock=True)
    check_version(task, parse_if_match(if_match) or 0, TaskOut)
    apply(task, {"deleted_at": datetime.now(UTC)})  # tombstone (D4)
    return await idem.finish(204)
