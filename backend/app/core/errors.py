"""RFC 9457 problem+json errors with stable machine codes (docs/api-contracts.md §1)."""

from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

PROBLEM = "application/problem+json"


class ApiError(Exception):
    """Raise anywhere in a request; rendered as problem+json."""

    def __init__(
        self,
        status: int,
        code: str,
        title: str,
        detail: str | None = None,
        *,
        current: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
        errors: list[dict[str, str]] | None = None,
    ) -> None:
        self.status, self.code, self.title, self.detail = status, code, title, detail
        self.current, self.headers, self.errors = current, headers, errors


def not_found(what: str = "Resource") -> ApiError:
    # Used for missing AND foreign records, so existence is never revealed.
    return ApiError(404, "not_found", f"{what} not found")


def version_conflict(current: dict[str, Any]) -> ApiError:
    return ApiError(
        409,
        "version_conflict",
        "This record changed on another device",
        "Your copy is out of date. The current server copy is included as `current`.",
        current=current,
    )


def gone(what: str = "Record") -> ApiError:
    return ApiError(410, "gone", f"{what} was deleted on another device")


def _body(status: int, code: str, title: str, detail: str | None, **extra: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "type": f"https://lifeos.local/problems/{code}",
        "title": title,
        "status": status,
        "code": code,
    }
    if detail:
        body["detail"] = detail
    body.update({k: v for k, v in extra.items() if v is not None})
    return body


def install(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def _api_error(_: Request, exc: ApiError) -> JSONResponse:
        return JSONResponse(
            _body(exc.status, exc.code, exc.title, exc.detail, current=exc.current, errors=exc.errors),
            status_code=exc.status,
            media_type=PROBLEM,
            headers=exc.headers,
        )

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        errors = [
            {"field": ".".join(str(p) for p in e["loc"][1:]) or str(e["loc"][0]), "message": e["msg"]}
            for e in exc.errors()
        ]
        return JSONResponse(
            _body(422, "validation_error", "The request is not valid", None, errors=errors),
            status_code=422,
            media_type=PROBLEM,
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = {401: "unauthorized", 403: "forbidden", 404: "not_found", 405: "method_not_allowed"}.get(
            exc.status_code, "error"
        )
        return JSONResponse(
            _body(exc.status_code, code, str(exc.detail), None),
            status_code=exc.status_code,
            media_type=PROBLEM,
            headers=getattr(exc, "headers", None),
        )
