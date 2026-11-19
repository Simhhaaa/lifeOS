"""Test setup: a real Postgres test database (docker compose), migrated with Alembic."""

import os
import uuid
from collections.abc import AsyncIterator

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

# Configure BEFORE importing the app (settings are read at import).
os.environ.update(
    LIFEOS_ENV="test",
    LIFEOS_DATABASE_URL=os.environ.get(
        "LIFEOS_TEST_DATABASE_URL", "postgresql+asyncpg://lifeos:lifeos-local-only@127.0.0.1:54329/lifeos_test"
    ),
    LIFEOS_JWT_PRIVATE_KEY=Ed25519PrivateKey.generate()
    .private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption())
    .decode(),
    LIFEOS_COOKIE_SECURE="false",
)

import httpx  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.api.v1.auth import login_limiter  # noqa: E402
from app.core.db import sessionmaker  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.main import app  # noqa: E402
from app.models import User, UserSettings  # noqa: E402

PASSWORD = "correct horse battery staple"
BACKEND = os.path.dirname(os.path.dirname(__file__))


def alembic_config() -> Config:
    cfg = Config(os.path.join(BACKEND, "alembic.ini"))
    cfg.set_main_option("script_location", os.path.join(BACKEND, "migrations"))
    return cfg


@pytest.fixture(scope="session", autouse=True)
def migrated_db() -> None:
    """Fresh schema for the run: downgrade to base, then upgrade to head (also exercises both directions)."""
    cfg = alembic_config()
    command.downgrade(cfg, "base")
    command.upgrade(cfg, "head")


@pytest.fixture(autouse=True)
async def clean_db() -> AsyncIterator[None]:
    login_limiter._hits.clear()
    async with sessionmaker()() as s, s.begin():
        tables = (
            await s.execute(
                text("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> 'alembic_version'")
            )
        ).scalars()
        await s.execute(text("TRUNCATE " + ", ".join(f'"{t}"' for t in tables) + " RESTART IDENTITY CASCADE"))
    yield


async def _make_user(username: str) -> uuid.UUID:
    async with sessionmaker()() as s, s.begin():
        user = User(username=username, password_hash=hash_password(PASSWORD), timezone="UTC")
        s.add(user)
        await s.flush()
        s.add(UserSettings(user_id=user.id))
        return user.id


@pytest.fixture
async def client() -> AsyncIterator[httpx.AsyncClient]:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test/api/v1") as c:
        yield c


@pytest.fixture
async def owner() -> uuid.UUID:
    return await _make_user("owner")


@pytest.fixture
async def other_user() -> uuid.UUID:
    """A second account that exists ONLY in tests, to prove ownership isolation."""
    return await _make_user("intruder")


async def bearer(client: httpx.AsyncClient, username: str = "owner") -> dict[str, str]:
    r = await client.post("/auth/login", json={"username": username, "password": PASSWORD, "client": "mobile"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def key() -> str:
    return str(uuid.uuid4())


@pytest.fixture
async def auth(client: httpx.AsyncClient, owner: uuid.UUID) -> dict[str, str]:
    return await bearer(client)
