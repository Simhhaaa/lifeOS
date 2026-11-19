"""Daily check-in: readiness, the offline merge policy, conflicts and bounds."""

from datetime import date, timedelta

import httpx

from tests.conftest import key

DAY = "2026-11-19"


async def test_create_computes_readiness(client: httpx.AsyncClient, auth) -> None:
    r = await client.put(
        f"/daily-logs/{DAY}",
        json={"sleep_hours": 7.5, "energy": 4, "recovery": 3, "mood": 4},
        headers={**auth, "Idempotency-Key": key()},
    )
    assert r.status_code == 200
    out = r.json()
    assert out["readiness"]["result"] == {"level": "High", "points": 5}  # 2 + 2 + 1
    got = await client.get(f"/daily-logs/{DAY}", headers=auth)
    assert got.json()["id"] == out["id"]


async def test_readiness_needs_all_three_inputs(client: httpx.AsyncClient, auth) -> None:
    r = await client.put(f"/daily-logs/{DAY}", json={"sleep_hours": 6}, headers={**auth, "Idempotency-Key": key()})
    assert r.json()["readiness"]["result"] is None


async def test_offline_merge_fills_empty_fields(client: httpx.AsyncClient, auth) -> None:
    await client.put(f"/daily-logs/{DAY}", json={"sleep_hours": 7}, headers={**auth, "Idempotency-Key": key()})
    # Second device didn't know a log existed (no If-Match); it adds different fields → merged.
    merged = await client.put(
        f"/daily-logs/{DAY}",
        json={"sleep_hours": 7, "energy": 3, "recovery": 3},
        headers={**auth, "Idempotency-Key": key()},
    )
    assert merged.status_code == 200
    body = merged.json()
    assert (body["sleep_hours"], body["energy"], body["recovery"], body["version"]) == (7.0, 3, 3, 2)


async def test_offline_disagreement_is_a_conflict(client: httpx.AsyncClient, auth) -> None:
    await client.put(f"/daily-logs/{DAY}", json={"energy": 4}, headers={**auth, "Idempotency-Key": key()})
    clash = await client.put(f"/daily-logs/{DAY}", json={"energy": 2}, headers={**auth, "Idempotency-Key": key()})
    assert clash.status_code == 409
    assert clash.json()["current"]["energy"] == 4  # the user picks; nothing overwritten


async def test_versioned_update(client: httpx.AsyncClient, auth) -> None:
    first = (
        await client.put(f"/daily-logs/{DAY}", json={"energy": 4}, headers={**auth, "Idempotency-Key": key()})
    ).json()
    ok = await client.put(
        f"/daily-logs/{DAY}",
        json={"energy": 2},
        headers={**auth, "Idempotency-Key": key(), "If-Match": str(first["version"])},
    )
    assert ok.status_code == 200 and ok.json()["energy"] == 2
    stale = await client.put(
        f"/daily-logs/{DAY}", json={"energy": 5}, headers={**auth, "Idempotency-Key": key(), "If-Match": "1"}
    )
    assert stale.status_code == 409


async def test_bounds_and_future_dates(client: httpx.AsyncClient, auth) -> None:
    assert (
        await client.put(f"/daily-logs/{DAY}", json={"energy": 6}, headers={**auth, "Idempotency-Key": key()})
    ).status_code == 422
    assert (
        await client.put(f"/daily-logs/{DAY}", json={"sleep_hours": 7.3}, headers={**auth, "Idempotency-Key": key()})
    ).status_code == 422
    future = (date.today() + timedelta(days=5)).isoformat()
    r = await client.put(f"/daily-logs/{future}", json={"energy": 3}, headers={**auth, "Idempotency-Key": key()})
    assert r.status_code == 422


async def test_missing_log_is_404(client: httpx.AsyncClient, auth) -> None:
    r = await client.get("/daily-logs/2026-01-01", headers=auth)
    assert r.status_code == 404 and r.json()["code"] == "not_found"
