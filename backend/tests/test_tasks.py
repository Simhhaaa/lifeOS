"""The write pattern: idempotency, validation, optimistic concurrency, tombstones, ownership."""

import asyncio
import uuid

import httpx
from sqlalchemy import func, select

from app.core.db import sessionmaker
from app.models import IdempotencyKey, Task
from tests.conftest import bearer, key


async def _count_tasks() -> int:
    async with sessionmaker()() as s:
        return (await s.execute(select(func.count()).select_from(Task))).scalar_one()


async def test_create_with_client_id_and_replay(client: httpx.AsyncClient, auth) -> None:
    tid, k = str(uuid.uuid4()), key()
    body = {"id": tid, "title": "Revise DBMS normalization", "priority": "high", "planned_for": "2026-11-19"}
    first = await client.post("/tasks", json=body, headers={**auth, "Idempotency-Key": k})
    assert first.status_code == 201
    assert first.json()["id"] == tid and first.json()["version"] == 1

    replay = await client.post("/tasks", json=body, headers={**auth, "Idempotency-Key": k})
    assert replay.status_code == 201
    assert replay.json() == first.json()
    assert replay.headers.get("idempotent-replayed") == "true"
    assert await _count_tasks() == 1


async def test_same_key_different_body_is_rejected(client: httpx.AsyncClient, auth) -> None:
    k = key()
    assert (await client.post("/tasks", json={"title": "A"}, headers={**auth, "Idempotency-Key": k})).status_code == 201
    r = await client.post("/tasks", json={"title": "B"}, headers={**auth, "Idempotency-Key": k})
    assert r.status_code == 422 and r.json()["code"] == "idempotency_mismatch"
    assert await _count_tasks() == 1


async def test_concurrent_duplicates_write_once(client: httpx.AsyncClient, auth) -> None:
    k, body = key(), {"title": "Offline replay"}
    results = await asyncio.gather(*[client.post("/tasks", json=body, headers={**auth, "Idempotency-Key": k}) for _ in range(5)])
    assert {r.status_code for r in results} == {201}
    assert len({r.json()["id"] for r in results}) == 1
    assert await _count_tasks() == 1


async def test_failed_request_does_not_burn_the_key(client: httpx.AsyncClient, auth) -> None:
    k = key()
    r = await client.post("/tasks", json={"title": ""}, headers={**auth, "Idempotency-Key": k})
    assert r.status_code == 422
    async with sessionmaker()() as s:
        assert (await s.execute(select(func.count()).select_from(IdempotencyKey))).scalar_one() == 0


async def test_validation_and_unknown_fields(client: httpx.AsyncClient, auth) -> None:
    h = {**auth, "Idempotency-Key": key()}
    bad = await client.post("/tasks", json={"title": "x" * 201}, headers=h)
    assert bad.status_code == 422 and bad.json()["code"] == "validation_error"
    assert bad.headers["content-type"].startswith("application/problem+json")
    # Clients can never send derived values such as XP.
    sneaky = await client.post("/tasks", json={"title": "x", "xp": 500}, headers={**auth, "Idempotency-Key": key()})
    assert sneaky.status_code == 422
    assert any(e["field"] == "xp" for e in sneaky.json()["errors"])
    missing_key = await client.post("/tasks", json={"title": "x"}, headers=auth)
    assert missing_key.status_code == 422


async def test_optimistic_concurrency(client: httpx.AsyncClient, auth) -> None:
    t = (await client.post("/tasks", json={"title": "Read"}, headers={**auth, "Idempotency-Key": key()})).json()
    ok = await client.patch(
        f"/tasks/{t['id']}", json={"title": "Read 20 pages"}, headers={**auth, "Idempotency-Key": key(), "If-Match": "1"}
    )
    assert ok.status_code == 200 and ok.json()["version"] == 2

    stale = await client.patch(
        f"/tasks/{t['id']}", json={"title": "Other device"}, headers={**auth, "Idempotency-Key": key(), "If-Match": "1"}
    )
    assert stale.status_code == 409
    assert stale.json()["code"] == "version_conflict"
    assert stale.json()["current"]["title"] == "Read 20 pages"  # server copy, never silently overwritten

    no_if_match = await client.patch(f"/tasks/{t['id']}", json={"title": "z"}, headers={**auth, "Idempotency-Key": key()})
    assert no_if_match.status_code == 422


async def test_complete_and_delete_then_gone(client: httpx.AsyncClient, auth) -> None:
    t = (await client.post("/tasks", json={"title": "Run 5 km"}, headers={**auth, "Idempotency-Key": key()})).json()
    done = await client.patch(
        f"/tasks/{t['id']}",
        json={"completed_at": "2026-11-19T07:00:00Z"},
        headers={**auth, "Idempotency-Key": key(), "If-Match": "1"},
    )
    assert done.json()["completed_at"].startswith("2026-11-19T07:00:00")
    deleted = await client.delete(f"/tasks/{t['id']}", headers={**auth, "Idempotency-Key": key(), "If-Match": "2"})
    assert deleted.status_code == 204
    assert all(x["id"] != t["id"] for x in (await client.get("/tasks", headers=auth)).json())
    after = await client.patch(
        f"/tasks/{t['id']}", json={"title": "late edit"}, headers={**auth, "Idempotency-Key": key(), "If-Match": "3"}
    )
    assert after.status_code == 410 and after.json()["code"] == "gone"


async def test_duplicate_client_id_with_new_key(client: httpx.AsyncClient, auth) -> None:
    tid = str(uuid.uuid4())
    assert (await client.post("/tasks", json={"id": tid, "title": "a"}, headers={**auth, "Idempotency-Key": key()})).status_code == 201
    dup = await client.post("/tasks", json={"id": tid, "title": "b"}, headers={**auth, "Idempotency-Key": key()})
    assert dup.status_code == 409 and dup.json()["code"] == "duplicate"


async def test_ownership_isolation(client: httpx.AsyncClient, auth, other_user) -> None:
    mine = (await client.post("/tasks", json={"title": "private"}, headers={**auth, "Idempotency-Key": key()})).json()
    theirs = await bearer(client, "intruder")
    assert (await client.get("/tasks", headers=theirs)).json() == []
    r = await client.patch(f"/tasks/{mine['id']}", json={"title": "hacked"}, headers={**theirs, "Idempotency-Key": key(), "If-Match": "1"})
    assert r.status_code == 404  # never 403: existence is not revealed
    missing = await client.patch(f"/tasks/{uuid.uuid4()}", json={"title": "x"}, headers={**theirs, "Idempotency-Key": key(), "If-Match": "1"})
    assert missing.status_code == 404 and missing.json() == r.json()
    # Same idempotency key used by two different users does not collide.
    k = key()
    a = await client.post("/tasks", json={"title": "same key"}, headers={**auth, "Idempotency-Key": k})
    b = await client.post("/tasks", json={"title": "same key"}, headers={**theirs, "Idempotency-Key": k})
    assert a.status_code == b.status_code == 201 and a.json()["id"] != b.json()["id"]


async def test_list_by_planned_range(client: httpx.AsyncClient, auth) -> None:
    for d in ("2026-11-17", "2026-11-19", "2026-11-21"):
        await client.post("/tasks", json={"title": d, "planned_for": d}, headers={**auth, "Idempotency-Key": key()})
    r = await client.get("/tasks", params={"from": "2026-11-18", "to": "2026-11-20"}, headers=auth)
    assert [t["title"] for t in r.json()] == ["2026-11-19"]
