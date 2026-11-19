"""Sync delta pulls and the append-only XP ledger."""

import uuid
from datetime import UTC, date, datetime

import httpx
import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.core.db import sessionmaker
from app.models import ActivityEvent, XpRule, XpTransaction
from tests.conftest import bearer, key


async def test_pull_changes_with_cursor_and_tombstones(client: httpx.AsyncClient, auth, other_user) -> None:
    t = (await client.post("/tasks", json={"title": "a"}, headers={**auth, "Idempotency-Key": key()})).json()
    await client.post("/tasks", json={"title": "b"}, headers={**auth, "Idempotency-Key": key()})
    await client.put("/daily-logs/2026-11-19", json={"energy": 3}, headers={**auth, "Idempotency-Key": key()})
    theirs = await bearer(client, "intruder")
    await client.post("/tasks", json={"title": "not yours"}, headers={**theirs, "Idempotency-Key": key()})

    full = (await client.get("/sync/changes", params={"since": "0"}, headers=auth)).json()
    entities = sorted(c["entity"] for c in full["changes"])
    assert entities == ["daily_log", "task", "task"]  # nothing from the other user
    assert all("user_id" not in (c["data"] or {}) for c in full["changes"])
    assert full["has_more"] is False

    empty = (await client.get("/sync/changes", params={"since": full["cursor"]}, headers=auth)).json()
    assert empty["changes"] == [] and empty["cursor"] == full["cursor"]

    await client.delete(f"/tasks/{t['id']}", headers={**auth, "Idempotency-Key": key(), "If-Match": "1"})
    delta = (await client.get("/sync/changes", params={"since": full["cursor"]}, headers=auth)).json()
    assert delta["changes"] == [{"entity": "task", "id": t["id"], "op": "delete", "version": 2, "data": None}]


async def test_pull_pagination(client: httpx.AsyncClient, auth) -> None:
    for i in range(5):
        await client.post("/tasks", json={"title": f"t{i}"}, headers={**auth, "Idempotency-Key": key()})
    page1 = (await client.get("/sync/changes", params={"since": "0", "limit": 3}, headers=auth)).json()
    assert len(page1["changes"]) == 3 and page1["has_more"] is True
    page2 = (await client.get("/sync/changes", params={"since": page1["cursor"], "limit": 3}, headers=auth)).json()
    assert len(page2["changes"]) == 2 and page2["has_more"] is False
    titles = [c["data"]["title"] for c in page1["changes"] + page2["changes"]]
    assert titles == [f"t{i}" for i in range(5)]


async def test_bad_cursor(client: httpx.AsyncClient, auth) -> None:
    r = await client.get("/sync/changes", params={"since": "abc"}, headers=auth)
    assert r.status_code == 422


async def _seed_award(user_id: uuid.UUID) -> uuid.UUID:
    async with sessionmaker()() as s, s.begin():
        s.add(
            XpRule(
                id="study.focus_minutes",
                version=1,
                event_type="study_session.logged",
                skill_key="learning",
                params={"per_minutes": 3, "session_cap": 60},
                valid_from=datetime.now(UTC),
                description="test",
            )
        )
        ev = ActivityEvent(
            user_id=user_id,
            type="study_session.logged",
            source_table="study_sessions",
            source_id=uuid.uuid4(),
            occurred_at=datetime.now(UTC),
            local_date=date.today(),
            payload={"minutes": 90},
        )
        s.add(ev)
        await s.flush()
        tx = XpTransaction(
            user_id=user_id,
            event_id=ev.id,
            rule_id="study.focus_minutes",
            rule_version=1,
            skill_key="learning",
            amount=30,
            kind="award",
            reason="Focused study · 90 min",
        )
        s.add(tx)
        await s.flush()
        return tx.id


async def test_xp_ledger_is_append_only(owner) -> None:
    tx_id = await _seed_award(owner)
    for stmt in (
        "UPDATE xp_transactions SET amount = 999 WHERE id = :id",
        "DELETE FROM xp_transactions WHERE id = :id",
    ):
        with pytest.raises(DBAPIError, match="append-only"):
            async with sessionmaker()() as s, s.begin():
                await s.execute(text(stmt), {"id": tx_id})


async def test_one_award_per_event_and_rule(owner) -> None:
    await _seed_award(owner)
    async with sessionmaker()() as s:
        (ev_id,) = (await s.execute(text("SELECT id FROM activity_events"))).one()
    with pytest.raises(DBAPIError):
        async with sessionmaker()() as s, s.begin():
            s.add(
                XpTransaction(
                    user_id=owner,
                    event_id=ev_id,
                    rule_id="study.focus_minutes",
                    rule_version=1,
                    skill_key="learning",
                    amount=30,
                    kind="award",
                    reason="duplicate",
                )
            )
