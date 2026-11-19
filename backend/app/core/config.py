"""Settings from environment variables only (spec §8: no secrets in code)."""

from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="LIFEOS_", env_file=".env", extra="ignore")

    env: Literal["local", "test", "preview", "production"] = "local"
    database_url: str = Field(description="postgresql+asyncpg://user:pass@host:port/db")

    # Ed25519 private key (PEM) used to sign access tokens. Generate with `python -m app.cli gen-key`.
    jwt_private_key: SecretStr
    access_token_minutes: int = 15
    refresh_token_days: int = 30

    web_origin: str = "http://localhost:3100"
    cookie_secure: bool = True

    idempotency_retention_days: int = 30
    login_max_attempts: int = 5
    login_window_seconds: int = 15 * 60

    @property
    def is_production(self) -> bool:
        return self.env == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
