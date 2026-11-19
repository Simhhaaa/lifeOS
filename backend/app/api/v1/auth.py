"""Login, refresh rotation with reuse detection, logout, /me (docs/security-and-sync.md §2)."""

import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Request, Response
from fastapi.responses import JSONResponse
from sqlalchemy import select, update

from app.api.deps import ACCESS_COOKIE, CSRF_COOKIE, REFRESH_COOKIE, CurrentUser, Session
from app.core.config import get_settings
from app.core.errors import PROBLEM, ApiError
from app.core.rate_limit import SlidingWindow
from app.core.security import hash_token, issue_access_token, new_csrf_token, new_refresh_token, verify_password
from app.models import RefreshToken, User
from app.schemas import auth as s

router = APIRouter(tags=["auth"])

_settings = get_settings()
login_limiter = SlidingWindow(_settings.login_max_attempts, _settings.login_window_seconds)


def _bad_credentials() -> ApiError:
    return ApiError(401, "unauthorized", "Invalid username or password")


async def _issue(
    session: Session, response: Response, user_id: uuid.UUID, client: str, family_id: uuid.UUID
) -> s.TokenPair:
    settings = get_settings()
    access, ttl = issue_access_token(user_id, client)
    raw, digest = new_refresh_token()
    session.add(
        RefreshToken(
            user_id=user_id,
            family_id=family_id,
            token_hash=digest,
            client=client,
            expires_at=datetime.now(UTC) + timedelta(days=settings.refresh_token_days),
        )
    )
    if client == "mobile":
        return s.TokenPair(access_token=access, refresh_token=raw, expires_in=ttl)
    secure = settings.cookie_secure
    response.set_cookie(ACCESS_COOKIE, access, max_age=ttl, httponly=True, secure=secure, samesite="lax", path="/api")
    response.set_cookie(
        REFRESH_COOKIE,
        raw,
        max_age=settings.refresh_token_days * 86400,
        httponly=True,
        secure=secure,
        samesite="strict",
        path="/api/v1/auth",
    )
    response.set_cookie(
        CSRF_COOKIE,
        new_csrf_token(),
        max_age=settings.refresh_token_days * 86400,
        secure=secure,
        samesite="lax",
        path="/",
    )
    return s.TokenPair(expires_in=ttl)


@router.post("/auth/login", operation_id="login", response_model=s.TokenPair, response_model_exclude_none=True)
async def login(body: s.LoginRequest, request: Request, response: Response, session: Session) -> s.TokenPair:
    limit_key = f"{request.client.host if request.client else '-'}|{body.username.lower()}"
    if wait := login_limiter.retry_after(limit_key):
        raise ApiError(
            429,
            "rate_limited",
            "Too many login attempts",
            f"Try again in {wait} s.",
            headers={"Retry-After": str(wait)},
        )

    user = (await session.execute(select(User).where(User.username == body.username))).scalar_one_or_none()
    ok, rehash = verify_password(user.password_hash if user else None, body.password)
    if not ok or user is None:
        login_limiter.hit(limit_key)
        raise _bad_credentials()
    login_limiter.reset(limit_key)
    if rehash:
        user.password_hash = rehash
    return await _issue(session, response, user.id, body.client, family_id=uuid.uuid4())


@router.post("/auth/refresh", operation_id="refresh", response_model=s.TokenPair, response_model_exclude_none=True)
async def refresh(
    request: Request, response: Response, session: Session, body: s.RefreshRequest | None = None
) -> s.TokenPair:
    raw = (body.refresh_token if body else None) or request.cookies.get(REFRESH_COOKIE)
    if not raw:
        raise ApiError(401, "unauthorized", "No refresh token")
    now = datetime.now(UTC)
    token = (
        await session.execute(select(RefreshToken).where(RefreshToken.token_hash == hash_token(raw)).with_for_update())
    ).scalar_one_or_none()
    if token is None or token.revoked_at is not None or token.expires_at <= now:
        raise ApiError(401, "unauthorized", "Session expired; log in again")
    if token.used_at is not None:
        # Reuse of a rotated token means it was copied: revoke the whole family (security doc §2).
        # We hold the row lock, so revoke in this transaction and RETURN (not raise) the 401,
        # which lets the revocation commit.
        await session.execute(
            update(RefreshToken)
            .where(RefreshToken.family_id == token.family_id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=now)
        )
        return JSONResponse(  # type: ignore[return-value]
            {
                "type": "https://lifeos.local/problems/token_reused",
                "title": "This session was revoked for safety; log in again",
                "status": 401,
                "code": "token_reused",
            },
            status_code=401,
            media_type=PROBLEM,
        )
    token.used_at = now
    return await _issue(session, response, token.user_id, token.client, family_id=token.family_id)


@router.post("/auth/logout", operation_id="logout", status_code=204)
async def logout(
    request: Request, session: Session, principal: CurrentUser, body: s.RefreshRequest | None = None
) -> Response:
    raw = (body.refresh_token if body else None) or request.cookies.get(REFRESH_COOKIE)
    now = datetime.now(UTC)
    stmt = update(RefreshToken).where(RefreshToken.user_id == principal.id, RefreshToken.revoked_at.is_(None))
    if raw:
        family = (
            await session.execute(select(RefreshToken.family_id).where(RefreshToken.token_hash == hash_token(raw)))
        ).scalar_one_or_none()
        stmt = stmt.where(RefreshToken.family_id == family)
    else:
        stmt = stmt.where(RefreshToken.client == principal.client)
    await session.execute(stmt.values(revoked_at=now))
    out = Response(status_code=204)
    for name, path in ((ACCESS_COOKIE, "/api"), (REFRESH_COOKIE, "/api/v1/auth"), (CSRF_COOKIE, "/")):
        out.delete_cookie(name, path=path)
    return out


@router.get("/me", operation_id="getMe", response_model=s.User)
async def me(principal: CurrentUser) -> User:
    return principal.user
