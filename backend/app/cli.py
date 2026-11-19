"""Owner administration. No public signup exists (spec §7).

python -m app.cli gen-key                     # print a new Ed25519 key for LIFEOS_JWT_PRIVATE_KEY
python -m app.cli create-owner --username me  # prompts for the password (never pass it as an argument)
"""

import argparse
import asyncio
import getpass
import sys

from sqlalchemy import func, select

from app.core.db import dispose, sessionmaker
from app.core.security import MIN_PASSWORD_LENGTH, generate_private_key_pem, hash_password
from app.models import User, UserSettings


async def _create_owner(username: str, timezone: str) -> int:
    password = getpass.getpass("Password (min 12 characters): ")
    if len(password) < MIN_PASSWORD_LENGTH:
        print(f"Password must be at least {MIN_PASSWORD_LENGTH} characters.", file=sys.stderr)
        return 1
    if getpass.getpass("Repeat password: ") != password:
        print("Passwords don't match.", file=sys.stderr)
        return 1
    async with sessionmaker()() as session, session.begin():
        if (await session.execute(select(func.count()).select_from(User))).scalar_one() > 0:
            print("An owner already exists. LIFEOS is single-owner.", file=sys.stderr)
            return 1
        user = User(username=username, password_hash=hash_password(password), timezone=timezone)
        session.add(user)
        await session.flush()
        session.add(UserSettings(user_id=user.id))
    await dispose()
    print(f"Owner '{username}' created.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("gen-key", help="Print a new Ed25519 private key (PEM)")
    owner = sub.add_parser("create-owner", help="Create the single owner account")
    owner.add_argument("--username", required=True)
    owner.add_argument("--timezone", required=True, help="Your IANA timezone, e.g. Europe/London")
    args = parser.parse_args()
    if args.cmd == "gen-key":
        print(generate_private_key_pem(), end="")
        return 0
    return asyncio.run(_create_owner(args.username, args.timezone))


if __name__ == "__main__":
    raise SystemExit(main())
