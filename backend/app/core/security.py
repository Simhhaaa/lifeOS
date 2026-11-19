"""Password hashing (Argon2id) and token handling (docs/security-and-sync.md §2)."""

import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from app.core.config import get_settings

# Argon2id: 64 MiB memory, time cost 3, parallelism 1 (security doc §2).
_hasher = PasswordHasher(time_cost=3, memory_cost=64 * 1024, parallelism=1, hash_len=32, salt_len=16)
# A fixed dummy hash so unknown usernames take the same time as wrong passwords.
_DUMMY_HASH = _hasher.hash("timing-equaliser-not-a-password")

MIN_PASSWORD_LENGTH = 12


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(stored_hash: str | None, password: str) -> tuple[bool, str | None]:
    """Returns (ok, new_hash_if_rehash_needed). Constant-ish time for unknown users."""
    try:
        _hasher.verify(stored_hash or _DUMMY_HASH, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False, None
    if stored_hash is None:
        return False, None
    return True, (_hasher.hash(password) if _hasher.check_needs_rehash(stored_hash) else None)


def _private_key() -> Ed25519PrivateKey:
    key = serialization.load_pem_private_key(get_settings().jwt_private_key.get_secret_value().encode(), password=None)
    if not isinstance(key, Ed25519PrivateKey):
        raise RuntimeError("LIFEOS_JWT_PRIVATE_KEY must be an Ed25519 private key")
    return key


def issue_access_token(user_id: uuid.UUID, client: str) -> tuple[str, int]:
    ttl = get_settings().access_token_minutes * 60
    now = datetime.now(UTC)
    claims = {
        "sub": str(user_id),
        "aud": client,
        "iat": now,
        "exp": now + timedelta(seconds=ttl),
        "jti": secrets.token_hex(8),
    }
    return jwt.encode(claims, _private_key(), algorithm="EdDSA"), ttl


def decode_access_token(token: str) -> tuple[uuid.UUID, str]:
    """Returns (user_id, client). Raises jwt.PyJWTError on any problem."""
    public = _private_key().public_key()
    claims = jwt.decode(
        token, public, algorithms=["EdDSA"], audience=["web", "mobile"], options={"require": ["exp", "sub", "aud"]}
    )
    return uuid.UUID(claims["sub"]), str(claims["aud"])


def new_refresh_token() -> tuple[str, bytes]:
    """Opaque 256-bit token and its SHA-256. Only the hash is stored."""
    raw = secrets.token_urlsafe(32)
    return raw, hash_token(raw)


def hash_token(raw: str) -> bytes:
    return hashlib.sha256(raw.encode()).digest()


def new_csrf_token() -> str:
    return secrets.token_urlsafe(24)


def generate_private_key_pem() -> str:
    key = Ed25519PrivateKey.generate()
    return key.private_bytes(
        serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()
    ).decode()
