"""LOCAL DEVELOPMENT ONLY: create a test owner from LIFEOS_DEV_OWNER_PASSWORD (kept in the git-ignored .env).

    cd backend && set -a && source .env && set +a && .venv/bin/python scripts/dev_owner.py

Refuses to run outside LIFEOS_ENV=local. The real owner is created with `python -m app.cli create-owner`.
"""

import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.core.db import dispose, sessionmaker  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.models import User, UserSettings  # noqa: E402


async def main() -> int:
    if get_settings().env != "local":
        print("dev_owner.py only runs with LIFEOS_ENV=local", file=sys.stderr)
        return 1
    password = os.environ.get("LIFEOS_DEV_OWNER_PASSWORD", "")
    if len(password) < 12:
        print("Set LIFEOS_DEV_OWNER_PASSWORD (12+ chars) in backend/.env", file=sys.stderr)
        return 1
    username = os.environ.get("LIFEOS_DEV_OWNER_USERNAME", "dev")
    tz = os.environ.get("LIFEOS_DEV_OWNER_TIMEZONE", "UTC")
    async with sessionmaker()() as s, s.begin():
        if (await s.execute(select(User).where(User.username == username))).scalar_one_or_none():
            print(f"Dev owner '{username}' already exists.")
            return 0
        user = User(username=username, password_hash=hash_password(password), timezone=tz)
        s.add(user)
        await s.flush()
        s.add(UserSettings(user_id=user.id))
    await dispose()
    print(f"Dev owner '{username}' created (timezone {tz}).")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
