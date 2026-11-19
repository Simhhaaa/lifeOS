"""FastAPI application factory."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import academics, auth, daily_logs, fitness, sync, tasks
from app.core import errors
from app.core.config import get_settings
from app.core.db import dispose

API_PREFIX = "/api/v1"


@asynccontextmanager
async def lifespan(_: FastAPI):  # type: ignore[no-untyped-def]
    yield
    await dispose()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="LIFEOS API",
        version="1.0.0-draft",
        lifespan=lifespan,
        docs_url=None if settings.is_production else "/docs",
        redoc_url=None,
        openapi_url=None if settings.is_production else "/openapi.json",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.web_origin],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Content-Type", "Authorization", "Idempotency-Key", "If-Match", "X-CSRF-Token"],
    )
    errors.install(app)
    for module in (auth, tasks, daily_logs, academics, fitness, sync):
        app.include_router(module.router, prefix=API_PREFIX)

    @app.get("/healthz", include_in_schema=False)
    async def healthz() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
