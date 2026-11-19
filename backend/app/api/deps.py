"""Request dependencies: database session, authenticated principal, CSRF for cookie auth."""

import hmac
import uuid
from dataclasses import dataclass
from typing import Annotated

import jwt
from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.errors import ApiError
from app.core.security import decode_access_token
from app.models import User

ACCESS_COOKIE = "lifeos_access"
REFRESH_COOKIE = "lifeos_refresh"
CSRF_COOKIE = "lifeos_csrf"
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}

Session = Annotated[AsyncSession, Depends(get_session)]


@dataclass(frozen=True)
class Principal:
    user: User
    client: str
    via_cookie: bool

    @property
    def id(self) -> uuid.UUID:
        return self.user.id


def _unauthorized(detail: str = "Log in to continue") -> ApiError:
    return ApiError(401, "unauthorized", "Not authenticated", detail, headers={"WWW-Authenticate": "Bearer"})


async def current_principal(request: Request, session: Session) -> Principal:
    header = request.headers.get("authorization", "")
    token, via_cookie = (
        (header[7:], False) if header.lower().startswith("bearer ") else (request.cookies.get(ACCESS_COOKIE), True)
    )
    if not token:
        raise _unauthorized()
    try:
        user_id, client = decode_access_token(token)
    except jwt.PyJWTError as exc:
        raise _unauthorized("Session expired or invalid") from exc

    if via_cookie and request.method not in SAFE_METHODS:
        sent, expected = request.headers.get("x-csrf-token", ""), request.cookies.get(CSRF_COOKIE, "")
        if not expected or not hmac.compare_digest(sent, expected):
            raise ApiError(403, "csrf_failed", "Missing or invalid CSRF token")

    user = await session.get(User, user_id)
    if user is None:
        raise _unauthorized()
    return Principal(user=user, client=client, via_cookie=via_cookie)


CurrentUser = Annotated[Principal, Depends(current_principal)]
