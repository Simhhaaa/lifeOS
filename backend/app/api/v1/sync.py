"""Delta pull for offline clients (docs/security-and-sync.md §6.3).

One cursor (`change_seq`) across every synced table; tombstones are included as op=delete.
"""

from typing import Annotated, Any

from fastapi import APIRouter, Query
from pydantic import BaseModel
from sqlalchemy import text

from app.api.deps import CurrentUser, Session
from app.core.errors import ApiError
from app.models import SYNCED_TABLES

router = APIRouter(tags=["sync"])

# Internal columns never sent to clients.
_HIDDEN = ("user_id", "change_seq")


def _entity(table: str) -> str:
    return table[:-1] if table.endswith("s") else table


_UNION = " UNION ALL ".join(
    # Table names come from the model registry (constants), never from input; values are bound parameters.
    f"SELECT '{_entity(t)}' AS entity, id, change_seq, version, deleted_at, to_jsonb(x) - 'user_id' - 'change_seq' AS data "  # noqa: S608
    f"FROM {t} x WHERE user_id = :uid AND change_seq > :since"
    for t in sorted(SYNCED_TABLES)
)
_SQL = text(f"SELECT * FROM ({_UNION}) c ORDER BY change_seq LIMIT :lim")  # noqa: S608 (table names are constants)


class Change(BaseModel):
    entity: str
    id: str
    op: str
    version: int
    data: dict[str, Any] | None


class ChangeSet(BaseModel):
    changes: list[Change]
    cursor: str
    has_more: bool


@router.get("/sync/changes", operation_id="pullChanges", response_model=ChangeSet)
async def pull_changes(
    principal: CurrentUser,
    session: Session,
    since: Annotated[str, Query(description="Opaque cursor; '0' for a full pull")],
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> ChangeSet:
    try:
        since_seq = int(since)
    except ValueError as exc:
        raise ApiError(422, "validation_error", "Invalid cursor") from exc
    rows = (await session.execute(_SQL, {"uid": principal.id, "since": since_seq, "lim": limit + 1})).mappings().all()
    page = rows[:limit]
    changes = [
        Change(
            entity=r["entity"],
            id=str(r["id"]),
            op="delete" if r["deleted_at"] is not None else "upsert",
            version=r["version"],
            data=None if r["deleted_at"] is not None else r["data"],
        )
        for r in page
    ]
    return ChangeSet(
        changes=changes, cursor=str(page[-1]["change_seq"] if page else since_seq), has_more=len(rows) > limit
    )
