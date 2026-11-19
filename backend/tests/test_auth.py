import httpx

from tests.conftest import PASSWORD, bearer, key


async def test_mobile_login_and_me(client: httpx.AsyncClient, owner) -> None:
    r = await client.post("/auth/login", json={"username": "owner", "password": PASSWORD, "client": "mobile"})
    assert r.status_code == 200
    body = r.json()
    assert body["access_token"] and body["refresh_token"] and body["expires_in"] == 900
    me = await client.get("/me", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert me.status_code == 200 and me.json()["username"] == "owner"
    assert "password_hash" not in me.json()


async def test_wrong_password_and_unknown_user_look_the_same(client: httpx.AsyncClient, owner) -> None:
    a = await client.post("/auth/login", json={"username": "owner", "password": "wrong-password!", "client": "web"})
    b = await client.post("/auth/login", json={"username": "nobody", "password": "wrong-password!", "client": "web"})
    assert a.status_code == b.status_code == 401
    assert a.json() == b.json()
    assert a.headers["content-type"].startswith("application/problem+json")


async def test_login_rate_limit(client: httpx.AsyncClient, owner) -> None:
    for _ in range(5):
        r = await client.post("/auth/login", json={"username": "owner", "password": "nope-nope-nope", "client": "web"})
        assert r.status_code == 401
    r = await client.post("/auth/login", json={"username": "owner", "password": PASSWORD, "client": "web"})
    assert r.status_code == 429 and r.json()["code"] == "rate_limited"
    assert int(r.headers["retry-after"]) > 0


async def test_unauthenticated_and_bad_token(client: httpx.AsyncClient) -> None:
    assert (await client.get("/me")).status_code == 401
    r = await client.get("/me", headers={"Authorization": "Bearer not.a.jwt"})
    assert r.status_code == 401 and r.json()["code"] == "unauthorized"


async def test_refresh_rotation_and_reuse_revokes_family(client: httpx.AsyncClient, owner) -> None:
    first = (
        await client.post("/auth/login", json={"username": "owner", "password": PASSWORD, "client": "mobile"})
    ).json()
    second = await client.post("/auth/refresh", json={"refresh_token": first["refresh_token"]})
    assert second.status_code == 200
    new_refresh = second.json()["refresh_token"]
    assert new_refresh != first["refresh_token"]

    # Re-using the rotated token = it was copied → whole family revoked.
    reuse = await client.post("/auth/refresh", json={"refresh_token": first["refresh_token"]})
    assert reuse.status_code == 401 and reuse.json()["code"] == "token_reused"
    # …including the newest token of that family.
    after = await client.post("/auth/refresh", json={"refresh_token": new_refresh})
    assert after.status_code == 401


async def test_logout_revokes_refresh(client: httpx.AsyncClient, owner) -> None:
    tokens = (
        await client.post("/auth/login", json={"username": "owner", "password": PASSWORD, "client": "mobile"})
    ).json()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    assert (
        await client.post("/auth/logout", headers=headers, json={"refresh_token": tokens["refresh_token"]})
    ).status_code == 204
    assert (await client.post("/auth/refresh", json={"refresh_token": tokens["refresh_token"]})).status_code == 401


async def test_web_cookies_and_csrf(client: httpx.AsyncClient, owner) -> None:
    r = await client.post("/auth/login", json={"username": "owner", "password": PASSWORD, "client": "web"})
    assert r.status_code == 200
    assert "access_token" not in r.json()  # tokens never in the body for web
    set_cookie = r.headers.get_list("set-cookie")
    access = next(c for c in set_cookie if c.startswith("lifeos_access="))
    assert "HttpOnly" in access and "SameSite=lax" in access
    csrf = client.cookies.get("lifeos_csrf")
    assert csrf

    task = {"title": "Plan tomorrow"}
    no_csrf = await client.post("/tasks", json=task, headers={"Idempotency-Key": key()})
    assert no_csrf.status_code == 403 and no_csrf.json()["code"] == "csrf_failed"
    ok = await client.post("/tasks", json=task, headers={"Idempotency-Key": key(), "X-CSRF-Token": csrf})
    assert ok.status_code == 201
    assert (await client.get("/tasks")).status_code == 200  # reads don't need CSRF


async def test_bearer_mutation_needs_no_csrf(client: httpx.AsyncClient, owner) -> None:
    headers = await bearer(client)
    r = await client.post("/tasks", json={"title": "x"}, headers={**headers, "Idempotency-Key": key()})
    assert r.status_code == 201
