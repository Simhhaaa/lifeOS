# LIFEOS backend

FastAPI + SQLAlchemy 2 (async) + Alembic on PostgreSQL 16. Design: `docs/architecture.md`, `docs/database.md`, `docs/api/openapi.yaml`.

## Run locally

```bash
docker compose up -d --wait db                 # from the repo root: Postgres on 127.0.0.1:54329 (+ lifeos_test)
cd backend
python3.13 -m venv .venv && .venv/bin/pip install -e ".[dev]"
cp .env.example .env                            # then put a key from: .venv/bin/python -m app.cli gen-key
set -a && source .env && set +a
.venv/bin/alembic upgrade head
.venv/bin/python -m app.cli create-owner --username <you> --timezone <Area/City>   # prompts for the password
.venv/bin/uvicorn app.main:app --reload --port 8000                                   # docs at /docs
```

## Test and lint

```bash
.venv/bin/python -m pytest -q        # uses the lifeos_test database; migrates down and up first
.venv/bin/ruff check . && .venv/bin/ruff format --check .
```

## What exists (Phase 2)

| Area | Where |
|---|---|
| Config from environment only | `app/core/config.py` |
| Problem+json errors with stable codes | `app/core/errors.py` |
| Argon2id, Ed25519 JWT access tokens, opaque refresh tokens | `app/core/security.py` |
| Idempotency in the same transaction as the write | `app/core/idempotency.py` |
| Ownership checks (404), `If-Match` versions (409), tombstones (410) | `app/repositories/owned.py` |
| Auth: login, refresh rotation with reuse detection, logout, `/me`, CSRF for cookies | `app/api/v1/auth.py`, `app/api/deps.py` |
| Reference endpoints: tasks, daily check-in (merge policy), sync pull | `app/api/v1/{tasks,daily_logs,sync}.py` |
| All tables from `docs/database.md`, plus sync triggers and an append-only XP ledger | `app/models/*`, `migrations/versions/*` |
| Owner CLI (no signup endpoint) | `app/cli.py` |

New endpoints follow the pattern in `app/api/v1/tasks.py`:
1. Authenticate.
2. `Idempotency.begin()`.
3. Validate with a strict schema.
4. `get_owned()` and `check_version()`.
5. Write.
6. `Idempotency.finish()`.

All of it happens in one transaction.
