import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import Strict


class LoginRequest(Strict):
    username: str = Field(max_length=64)
    password: str = Field(min_length=1, max_length=256)
    client: Literal["web", "mobile"]


class RefreshRequest(Strict):
    refresh_token: str | None = Field(default=None, description="Mobile only; web sends the cookie")


class TokenPair(BaseModel):
    access_token: str | None = None
    refresh_token: str | None = None
    expires_in: int


class User(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    username: str
    display_name: str | None
    timezone: str
