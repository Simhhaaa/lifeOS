"""Fitness endpoints: library, workouts and sets, ownership, est. 1RM / PR maths, plan, body measurements."""

import uuid
from datetime import UTC, date, datetime, timedelta

import httpx

from tests.conftest import bearer, key


def ago(days: int = 0, hours: int = 0, minutes: int = 0) -> str:
    return (datetime.now(UTC) - timedelta(days=days, hours=hours, minutes=minutes)).isoformat()


async def post(client: httpx.AsyncClient, auth: dict, path: str, body: dict, **headers: str) -> httpx.Response:
    return await client.post(path, json=body, headers={**auth, "Idempotency-Key": key(), **headers})


async def exercise(
    client: httpx.AsyncClient, auth: dict, name: str, muscle: str = "chest", lift: str | None = None
) -> dict:
    r = await post(client, auth, "/exercises", {"name": name, "muscle_group": muscle, "tracked_lift": lift})
    assert r.status_code == 201, r.text
    return r.json()


def st(ex: dict, position: int, load: float, reps: int, **extra) -> dict:
    return {"exercise_id": ex["id"], "position": position, "load_kg": load, "reps": reps, **extra}


async def workout(client: httpx.AsyncClient, auth: dict, started_at: str, sets: list[dict], **extra) -> dict:
    r = await post(client, auth, "/workouts", {"started_at": started_at, "sets": sets, **extra})
    assert r.status_code == 201, r.text
    return r.json()


# ── library ──


async def test_exercise_library(client: httpx.AsyncClient, auth) -> None:
    bench = await exercise(client, auth, "Bench press", lift="bench")
    assert (bench["sessions_8w"], bench["best_e1rm_kg"], bench["last_done"], bench["version"]) == (0, None, None, 1)

    dup = await post(client, auth, "/exercises", {"name": "bench PRESS", "muscle_group": "chest"})
    assert dup.status_code == 409 and dup.json()["code"] == "duplicate"  # unique per owner, case-insensitive

    bad = await post(client, auth, "/exercises", {"name": "Curl", "muscle_group": "biceps"})
    assert bad.status_code == 422

    r = await client.patch(
        f"/exercises/{bench['id']}",
        json={"equipment": "Barbell"},
        headers={**auth, "Idempotency-Key": key(), "If-Match": "1"},
    )
    assert r.status_code == 200 and r.json()["equipment"] == "Barbell" and r.json()["version"] == 2
    stale = await client.patch(
        f"/exercises/{bench['id']}",
        json={"equipment": "x"},
        headers={**auth, "Idempotency-Key": key(), "If-Match": "1"},
    )
    assert stale.status_code == 409 and stale.json()["current"]["equipment"] == "Barbell"

    await workout(client, auth, ago(days=2), [st(bench, 1, 100, 5)])
    [listed] = (await client.get("/exercises", headers=auth)).json()
    assert (listed["sessions_8w"], listed["best_e1rm_kg"]) == (1, 116.7)
    assert listed["last_done"] == (datetime.now(UTC) - timedelta(days=2)).date().isoformat()


# ── workouts ──


async def test_workout_sets_volume_and_e1rm(client: httpx.AsyncClient, auth) -> None:
    bench = await exercise(client, auth, "Bench press", lift="bench")
    w = await workout(
        client,
        auth,
        ago(hours=2),
        [
            st(bench, 1, 40, 10, is_warmup=True),
            st(bench, 2, 80, 8, rpe=8.5),
            st(bench, 3, 60, 12),  # beyond 10 reps: no est. 1RM
        ],
        note="felt strong",
    )
    warm, work, high = w["sets"]
    assert warm["e1rm_kg"] is None  # warm-ups never count
    assert work["e1rm_kg"] == 101.3  # 80 × (1 + 8/30)
    assert high["e1rm_kg"] is None
    assert w["volume_kg"] == 80 * 8 + 60 * 12  # warm-up excluded
    assert (w["pr"], w["note"], w["ended_at"]) == (False, "felt strong", None)

    page = (await client.get("/workouts", headers=auth)).json()
    assert [x["id"] for x in page["items"]] == [w["id"]] and page["next_cursor"] is None


async def test_derived_fields_cannot_be_sent(client: httpx.AsyncClient, auth) -> None:
    bench = await exercise(client, auth, "Bench press")
    r = await post(client, auth, "/workouts", {"started_at": ago(hours=1), "volume_kg": 9999})
    assert r.status_code == 422
    r = await post(
        client, auth, "/workouts", {"started_at": ago(hours=1), "sets": [{**st(bench, 1, 50, 5), "e1rm_kg": 500}]}
    )
    assert r.status_code == 422
    r = await post(client, auth, "/workouts", {"started_at": ago(hours=1), "sets": [st(bench, 1, 50.3, 5)]})
    assert r.status_code == 422  # load in 0.25 kg steps
    r = await post(
        client, auth, "/workouts", {"started_at": ago(hours=1), "sets": [st(bench, 1, 50, 5), st(bench, 1, 55, 5)]}
    )
    assert r.status_code == 422  # positions unique
    future = (datetime.now(UTC) + timedelta(hours=2)).isoformat()
    assert (await post(client, auth, "/workouts", {"started_at": future})).status_code == 422


async def test_references_must_be_owned_and_workout_is_atomic(client: httpx.AsyncClient, auth, other_user) -> None:
    theirs = await bearer(client, "intruder")
    their_ex = await exercise(client, theirs, "Their squat", "legs")
    mine = await exercise(client, auth, "My squat", "legs")

    r = await post(
        client, auth, "/workouts", {"started_at": ago(hours=1), "sets": [st(mine, 1, 100, 5), st(their_ex, 2, 100, 5)]}
    )
    assert r.status_code == 422
    assert r.json()["errors"] == [{"field": "sets[1].exercise_id", "message": "not found"}]
    assert (await client.get("/workouts", headers=auth)).json()["items"] == []  # nothing half-written

    their_t = await post(client, theirs, "/workout-templates", {"name": "Legs"})
    r = await post(client, auth, "/workouts", {"started_at": ago(hours=1), "template_id": their_t.json()["id"]})
    assert r.status_code == 422 and r.json()["errors"][0]["field"] == "template_id"

    their_w = await workout(client, theirs, ago(hours=1), [])
    r = await post(client, auth, f"/workouts/{their_w['id']}/sets", st(mine, 1, 100, 5))
    assert r.status_code == 404


async def test_add_set_finish_and_replay(client: httpx.AsyncClient, auth) -> None:
    row = await exercise(client, auth, "Barbell row", "back")
    k = key()
    body = {"started_at": ago(hours=1)}
    first = await client.post("/workouts", json=body, headers={**auth, "Idempotency-Key": k})
    again = await client.post("/workouts", json=body, headers={**auth, "Idempotency-Key": k})
    assert first.status_code == again.status_code == 201 and first.json()["id"] == again.json()["id"]
    w = first.json()
    assert len((await client.get("/workouts", headers=auth)).json()["items"]) == 1

    s1 = await post(client, auth, f"/workouts/{w['id']}/sets", st(row, 1, 70, 8))
    assert s1.status_code == 201 and s1.json()["e1rm_kg"] == 88.7
    clash = await post(client, auth, f"/workouts/{w['id']}/sets", st(row, 1, 72.5, 8))
    assert clash.status_code == 409 and clash.json()["code"] == "duplicate"

    finish = f"/workouts/{w['id']}/finish"
    assert (
        await client.post(finish, json={}, headers={**auth, "Idempotency-Key": key()})
    ).status_code == 422  # If-Match required
    early = await post(client, auth, finish, {"ended_at": ago(hours=3)}, **{"If-Match": "1"})
    assert early.status_code == 422
    done = await post(client, auth, finish, {}, **{"If-Match": "1"})
    assert done.status_code == 200 and done.json()["ended_at"] and done.json()["version"] == 2
    assert len(done.json()["sets"]) == 1 and done.json()["volume_kg"] == 560
    stale = await post(client, auth, finish, {}, **{"If-Match": "1"})
    assert stale.status_code == 409


# ── PRs and the progression read model ──


async def test_pr_needs_measured_improvement(client: httpx.AsyncClient, auth) -> None:
    bench = await exercise(client, auth, "Bench press", lift="bench")
    fly = await exercise(client, auth, "Cable fly")  # not a tracked lift: never a PR
    w1 = await workout(client, auth, ago(days=10), [st(bench, 1, 100, 5), st(fly, 2, 20, 10)])  # 116.7 baseline
    w2 = await workout(client, auth, ago(days=8), [st(bench, 1, 100, 5)])  # equal: not a PR
    w3 = await workout(client, auth, ago(days=6), [st(bench, 1, 102.5, 5)])  # 119.6: PR
    w4 = await workout(client, auth, ago(days=4), [st(bench, 1, 100, 6)])  # 120.0: +0.4 < 0.5, not a PR
    w5 = await workout(
        client, auth, ago(days=2), [st(bench, 1, 140, 12), st(bench, 2, 105, 5)]
    )  # 12 reps ignored; 122.5 PR

    flags = {x["id"]: x["pr"] for x in (await client.get("/workouts", headers=auth)).json()["items"]}
    assert flags == {w1["id"]: False, w2["id"]: False, w3["id"]: True, w4["id"]: False, w5["id"]: True}

    p = (await client.get("/fitness/progression", headers=auth)).json()
    assert [(x["e1rm_kg"], x["pr"]) for x in p["lifts"]["bench"]] == [
        (116.7, False),
        (116.7, False),
        (119.6, True),
        (120.0, False),
        (122.5, True),
    ]
    assert p["records"] == [
        {
            "exercise": "Bench press",
            "e1rm_kg": 122.5,
            "load_kg": 105.0,
            "reps": 5,
            "date": (datetime.now(UTC) - timedelta(days=2)).date().isoformat(),
        }
    ]


async def test_weekly_volume_plan_and_rotation(client: httpx.AsyncClient, auth, other_user) -> None:
    bench = await exercise(client, auth, "Bench press", "chest", "bench")
    squat = await exercise(client, auth, "Back squat", "legs", "squat")
    push = (
        await post(
            client,
            auth,
            "/workout-templates",
            {"name": "Push", "exercises": [{"exercise_id": bench["id"], "target_sets": 3}]},
        )
    ).json()
    legs = (
        await post(client, auth, "/workout-templates", {"name": "Legs", "exercises": [{"exercise_id": squat["id"]}]})
    ).json()
    assert push["exercises"] == [{"exercise_id": bench["id"], "position": 1, "target_sets": 3, "target_reps": None}]

    assert (await client.get("/training-plan", headers=auth)).json() is None
    theirs = await bearer(client, "intruder")
    their_t = (await post(client, theirs, "/workout-templates", {"name": "Theirs"})).json()
    bad = await client.put(
        "/training-plan",
        json={"weekdays": [1], "rotation": [their_t["id"]]},
        headers={**auth, "Idempotency-Key": key()},
    )
    assert bad.status_code == 422 and bad.json()["errors"][0]["field"] == "rotation[0]"

    plan = {"weekdays": [5, 1, 3], "rotation": [push["id"], legs["id"]]}
    r = await client.put("/training-plan", json=plan, headers={**auth, "Idempotency-Key": key()})
    assert r.status_code == 200 and r.json()["weekdays"] == [1, 3, 5] and r.json()["version"] == 1
    blind = await client.put("/training-plan", json=plan, headers={**auth, "Idempotency-Key": key()})
    assert blind.status_code == 409  # another device set a plan; don't overwrite it unseen
    r = await client.put(
        "/training-plan",
        json={**plan, "weekdays": [1, 3, 5, 6]},
        headers={**auth, "Idempotency-Key": key(), "If-Match": "1"},
    )
    assert r.status_code == 200 and r.json()["version"] == 2

    started = datetime.now(UTC) - timedelta(minutes=5)
    w = await workout(
        client,
        auth,
        started.isoformat(),
        [st(bench, 1, 60, 10, is_warmup=True), st(bench, 2, 80, 8), st(bench, 3, 80, 8), st(squat, 4, 100, 5)],
        template_id=push["id"],
    )
    assert w["split"] == "Push"

    p = (await client.get("/fitness/progression", headers=auth)).json()
    assert p["next_in_rotation"] == "Legs"  # last logged split was Push
    day = started.date()
    monday = day - timedelta(days=day.weekday())
    assert [x["date"] for x in p["this_week"]] == [(monday + timedelta(days=i)).isoformat() for i in range(7)]
    assert [x["planned"] for x in p["this_week"]] == [True, False, True, False, True, True, False]
    assert next(x for x in p["this_week"] if x["date"] == day.isoformat())["workout_id"] == w["id"]
    assert len(p["weekly"]) == 8 and p["weekly"][-1]["week_start"] == monday.isoformat()
    assert p["weekly"][-1] == {
        "week_start": monday.isoformat(),
        "sessions": 1,
        "volume_kg": 80 * 8 * 2 + 100 * 5,
        "sets_by_muscle": {"chest": 2, "legs": 1},  # warm-up not counted
    }
    assert sum(x["sessions"] for x in p["weekly"][:-1]) == 0

    renamed = await client.patch(
        f"/workout-templates/{push['id']}",
        json={"name": "Push A", "exercises": [{"exercise_id": squat["id"]}, {"exercise_id": bench["id"]}]},
        headers={**auth, "Idempotency-Key": key(), "If-Match": "1"},
    )
    assert renamed.status_code == 200
    assert [(x["position"], x["exercise_id"]) for x in renamed.json()["exercises"]] == [
        (1, squat["id"]),
        (2, bench["id"]),
    ]


# ── body ──


async def test_body_measurements(client: httpx.AsyncClient, auth) -> None:
    today = datetime.now(UTC).date()
    assert (await post(client, auth, "/body-measurements", {"measured_on": today.isoformat()})).status_code == 422
    tomorrow = (today + timedelta(days=2)).isoformat()
    assert (
        await post(client, auth, "/body-measurements", {"measured_on": tomorrow, "weight_kg": 80})
    ).status_code == 422
    assert (
        await post(client, auth, "/body-measurements", {"measured_on": today.isoformat(), "weight_kg": 10})
    ).status_code == 422

    for days, kg, waist in [(3, 80.4, None), (40, 81.6, 86.0), (100, 83.0, None)]:
        d: date = today - timedelta(days=days)
        r = await post(
            client, auth, "/body-measurements", {"measured_on": d.isoformat(), "weight_kg": kg, "waist_cm": waist}
        )
        assert r.status_code == 201
    listed = (await client.get("/body-measurements", headers=auth)).json()  # default: last 8 weeks, oldest first
    assert [(x["weight_kg"], x["waist_cm"]) for x in listed] == [(81.6, 86.0), (80.4, None)]
    assert len((await client.get("/body-measurements?weeks=52", headers=auth)).json()) == 3
    assert uuid.UUID(listed[0]["id"])
