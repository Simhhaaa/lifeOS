"""Academics endpoints: CRUD, reference ownership, validation, local dates and the summary maths."""

import uuid
from datetime import UTC, datetime, timedelta

import httpx
from sqlalchemy import text

from app.core.db import sessionmaker
from tests.conftest import bearer, key


def ago(days: int = 0, hours: int = 0) -> str:
    return (datetime.now(UTC) - timedelta(days=days, hours=hours)).isoformat()


async def post(client: httpx.AsyncClient, auth: dict, path: str, body: dict) -> httpx.Response:
    return await client.post(path, json=body, headers={**auth, "Idempotency-Key": key()})


async def subject(client: httpx.AsyncClient, auth: dict, short: str = "DBMS", **extra) -> dict:
    r = await post(
        client, auth, "/subjects", {"name": f"{short} course", "short_name": short, "units_total": 12, **extra}
    )
    assert r.status_code == 201, r.text
    return r.json()


# ── subjects ──


async def test_subject_crud_and_rules(client: httpx.AsyncClient, auth) -> None:
    s = await subject(client, auth, units_done=7, credits=4)
    assert (s["units_done"], s["hours_28d"], s["sessions_28d"], s["last_studied_at"]) == (7, 0, 0, None)

    dup = await post(client, auth, "/subjects", {"name": "Other", "short_name": "DBMS"})
    assert dup.status_code == 409 and dup.json()["code"] == "duplicate"

    too_many = await client.patch(
        f"/subjects/{s['id']}", json={"units_done": 13}, headers={**auth, "Idempotency-Key": key(), "If-Match": "1"}
    )
    assert too_many.status_code == 422
    ok = await client.patch(
        f"/subjects/{s['id']}", json={"units_done": 8}, headers={**auth, "Idempotency-Key": key(), "If-Match": "1"}
    )
    assert ok.status_code == 200 and ok.json()["units_done"] == 8 and ok.json()["version"] == 2

    gone = await client.delete(f"/subjects/{s['id']}", headers={**auth, "Idempotency-Key": key(), "If-Match": "2"})
    assert gone.status_code == 204
    assert (await client.get("/subjects", headers=auth)).json() == []


async def test_references_must_be_owned(client: httpx.AsyncClient, auth, other_user) -> None:
    theirs = await bearer(client, "intruder")
    their_subject = await subject(client, theirs, "OS")
    r = await post(
        client, auth, "/study/sessions", {"subject_id": their_subject["id"], "started_at": ago(hours=2), "minutes": 30}
    )
    assert r.status_code == 422
    assert r.json()["errors"] == [{"field": "subject_id", "message": "not found"}]
    missing = await post(
        client, auth, "/study/sessions", {"subject_id": str(uuid.uuid4()), "started_at": ago(hours=2), "minutes": 30}
    )
    assert missing.json() == r.json()  # foreign and missing look identical


# ── sessions ──


async def test_study_session_local_date_follows_owner_timezone(client: httpx.AsyncClient, auth) -> None:
    async with sessionmaker()() as s, s.begin():
        await s.execute(text("UPDATE users SET timezone = 'Asia/Kolkata'"))
    # 20:00 UTC is 01:30 the next day in India (UTC+5:30).
    started = (datetime.now(UTC) - timedelta(days=2)).replace(hour=20, minute=0, second=0, microsecond=0)
    r = await post(client, auth, "/study/sessions", {"started_at": started.isoformat(), "minutes": 45})
    assert r.status_code == 201
    assert r.json()["local_date"] == (started + timedelta(hours=5, minutes=30)).date().isoformat()


async def test_session_validation(client: httpx.AsyncClient, auth) -> None:
    future = await post(
        client,
        auth,
        "/study/sessions",
        {"started_at": (datetime.now(UTC) + timedelta(hours=2)).isoformat(), "minutes": 30},
    )
    assert future.status_code == 422
    too_long = await post(client, auth, "/study/sessions", {"started_at": ago(hours=1), "minutes": 601})
    assert too_long.status_code == 422
    bad_focus = await post(
        client, auth, "/study/sessions", {"started_at": ago(hours=1), "minutes": 30, "focus_rating": 6}
    )
    assert bad_focus.status_code == 422


async def test_study_session_replay_and_paging(client: httpx.AsyncClient, auth) -> None:
    k, body = key(), {"started_at": ago(hours=3), "minutes": 50}
    a = await client.post("/study/sessions", json=body, headers={**auth, "Idempotency-Key": k})
    b = await client.post("/study/sessions", json=body, headers={**auth, "Idempotency-Key": k})
    assert a.json() == b.json()
    for i in range(3):
        await post(client, auth, "/study/sessions", {"started_at": ago(days=i + 1), "minutes": 20})
    page = (await client.get("/study/sessions", params={"limit": 2}, headers=auth)).json()
    assert len(page["items"]) == 2 and page["next_cursor"] == "2"
    rest = (
        await client.get("/study/sessions", params={"limit": 2, "cursor": page["next_cursor"]}, headers=auth)
    ).json()
    assert len(rest["items"]) == 2 and rest["next_cursor"] is None


async def test_coding_session_with_problems_is_atomic(client: httpx.AsyncClient, auth) -> None:
    body = {
        "area": "dsa",
        "started_at": ago(hours=4),
        "minutes": 90,
        "problems": [
            {"difficulty": "medium", "topic": "Graphs", "solved_at": ago(hours=3), "url": "https://example.com/p/1"},
            {"difficulty": "hard", "topic": "DP", "solved_at": ago(hours=3)},
        ],
    }
    r = await post(client, auth, "/coding/sessions", body)
    assert r.status_code == 201
    out = r.json()
    assert len(out["problems"]) == 2 and all(p["coding_session_id"] == out["id"] for p in out["problems"])

    # Same problem URL again → 409, and the whole second session is rolled back.
    again = await post(client, auth, "/coding/sessions", {**body, "problems": body["problems"][:1]})
    assert again.status_code == 409
    summary = (await client.get("/study/analytics", headers=auth)).json()
    assert summary["coding_hours_14d"] == 1.5 and summary["dsa"]["lifetime"] == 2


# ── assignments ──


async def test_assignments(client: httpx.AsyncClient, auth) -> None:
    s = await subject(client, auth, "OS")
    due = (datetime.now(UTC) + timedelta(days=1)).isoformat()
    a = await post(client, auth, "/assignments", {"subject_id": s["id"], "title": "OS assignment 3", "due_at": due})
    assert a.status_code == 201 and a.json()["status"] == "not_started"
    bad_grade = await post(
        client,
        auth,
        "/assignments",
        {"subject_id": s["id"], "title": "x", "due_at": due, "grade_score": 21, "grade_max": 20},
    )
    assert bad_grade.status_code == 422

    graded = {
        **{k: a.json()[k] for k in ("subject_id", "title", "due_at")},
        "status": "graded",
        "grade_score": 18,
        "grade_max": 20,
    }
    upd = await client.patch(
        f"/assignments/{a.json()['id']}", json=graded, headers={**auth, "Idempotency-Key": key(), "If-Match": "1"}
    )
    assert upd.status_code == 200 and upd.json()["grade_score"] == 18
    stale = await client.patch(
        f"/assignments/{a.json()['id']}", json=graded, headers={**auth, "Idempotency-Key": key(), "If-Match": "1"}
    )
    assert stale.status_code == 409


# ── milestones ──


async def test_milestones(client: httpx.AsyncClient, auth) -> None:
    learn = await post(
        client, auth, "/milestones", {"kind": "learning", "title": "SQL joins module", "planned_for": "2026-12-01"}
    )
    exam = await post(
        client,
        auth,
        "/milestones",
        {"kind": "assessment", "title": "DBMS mid-sem", "completed_at": ago(days=3), "score": 34, "max_score": 40},
    )
    proj = await post(client, auth, "/milestones", {"kind": "project", "title": "API skeleton", "project": "LifeOS"})
    assert learn.status_code == exam.status_code == proj.status_code == 201
    assert proj.json()["project"] == "LifeOS" and exam.json()["score"] == 34

    assert (await post(client, auth, "/milestones", {"kind": "project", "title": "No project"})).status_code == 422
    assert (
        await post(client, auth, "/milestones", {"kind": "assessment", "title": "x", "score": 41, "max_score": 40})
    ).status_code == 422

    done = await client.patch(
        f"/milestones/{proj.json()['id']}",
        json={"completed_at": ago()},
        headers={**auth, "Idempotency-Key": key(), "If-Match": "1"},
    )
    assert done.status_code == 200 and done.json()["completed_at"]
    no_score = await client.patch(
        f"/milestones/{proj.json()['id']}",
        json={"score": 5, "max_score": 5},
        headers={**auth, "Idempotency-Key": key(), "If-Match": "2"},
    )
    assert no_score.status_code == 422

    listed = (await client.get("/milestones", headers=auth)).json()
    assert [m["title"] for m in listed] == [
        "API skeleton",
        "DBMS mid-sem",
        "SQL joins module",
    ]  # done (newest first), then planned


# ── semesters ──


async def test_semesters_and_cgpa(client: httpx.AsyncClient, auth) -> None:
    await post(client, auth, "/semesters", {"label": "Sem 1", "ordinal": 1, "credits": 20, "sgpa": 8.0})
    s2 = await post(client, auth, "/semesters", {"label": "Sem 2", "ordinal": 2, "credits": 20})
    dup = await post(client, auth, "/semesters", {"label": "Again", "ordinal": 2})
    assert dup.status_code == 409
    listed = (await client.get("/semesters", headers=auth)).json()
    assert listed["cgpa"] == 8.0  # Sem 2 has no SGPA yet
    await client.patch(
        f"/semesters/{s2.json()['id']}", json={"sgpa": 9.0}, headers={**auth, "Idempotency-Key": key(), "If-Match": "1"}
    )
    assert (await client.get("/semesters", headers=auth)).json()["cgpa"] == 8.5


# ── summary ──


async def test_summary_windows(client: httpx.AsyncClient, auth, other_user) -> None:
    dbms = await subject(client, auth, "DBMS")
    await post(
        client, auth, "/study/sessions", {"subject_id": dbms["id"], "started_at": ago(hours=3), "minutes": 90}
    )  # this window
    await post(
        client, auth, "/study/sessions", {"subject_id": dbms["id"], "started_at": ago(days=20), "minutes": 60}
    )  # previous 14d
    await post(client, auth, "/study/sessions", {"started_at": ago(days=40), "minutes": 600})  # outside both
    await post(client, auth, "/coding/sessions", {"area": "project", "started_at": ago(days=2), "minutes": 120})
    await post(client, auth, "/dsa/problems", {"difficulty": "easy", "topic": "Arrays", "solved_at": ago(days=1)})
    await post(client, auth, "/dsa/problems", {"difficulty": "easy", "topic": "Arrays", "solved_at": ago(days=100)})
    soon = (datetime.now(UTC) + timedelta(days=2)).isoformat()
    later = (datetime.now(UTC) + timedelta(days=9)).isoformat()
    await post(client, auth, "/assignments", {"subject_id": dbms["id"], "title": "Later", "due_at": later})
    await post(client, auth, "/assignments", {"subject_id": dbms["id"], "title": "Soon", "due_at": soon})
    await post(
        client,
        auth,
        "/assignments",
        {"subject_id": dbms["id"], "title": "Done", "due_at": ago(days=1), "status": "submitted"},
    )
    # Another user's data never shows up.
    theirs = await bearer(client, "intruder")
    await post(client, theirs, "/study/sessions", {"started_at": ago(hours=1), "minutes": 300})

    r = (await client.get("/study/analytics", headers=auth)).json()
    assert (r["study_hours_14d"], r["prev_study_hours_14d"]) == (1.5, 1.0)
    assert (r["coding_hours_14d"], r["prev_coding_hours_14d"]) == (2.0, 0)
    subj = r["subjects"][0]
    assert (subj["short_name"], subj["hours_28d"], subj["sessions_28d"]) == ("DBMS", 2.5, 2)
    assert [x["kind"] for x in r["sessions_7d"]] == ["coding", "study"]  # oldest first
    assert r["sessions_7d"][1]["label"] == "DBMS" and r["sessions_7d"][0]["label"] == "Project work"
    assert r["dsa"]["lifetime"] == 2 and r["dsa"]["window"] == 1
    assert r["dsa"]["by_difficulty"] == {"easy": 1, "medium": 0, "hard": 0}
    assert r["dsa"]["by_topic"] == [{"topic": "Arrays", "solved": 1}] and len(r["dsa"]["weekly"]) == 8
    assert r["next_deadline"]["title"] == "Soon"
