"""Daily check-in, one per owner-local day, with the merge policy from docs/security-and-sync.md §6.4."""

from datetime import date, datetime, timedelta
from typing import Annotated
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Header, Request, Response
from sqlalchemy import select

from app.api.deps import CurrentUser, Session
from app.core.errors import ApiError, not_found, version_conflict
from app.core.idempotency import Idempotency, KeyHeader
from app.models import DailyLog
from app.progression.readiness import readiness
from app.repositories.owned import apply, check_version, parse_if_match
from app.schemas import daily as s

router = APIRouter(tags=["health"])
FIELDS = ("sleep_hours", "sleep_quality", "energy", "recovery", "mood")


def _out(log: DailyLog) -> s.DailyLog:
    sleep = float(log.sleep_hours) if log.sleep_hours is not None else None
    r = readiness(sleep, log.energy, log.recovery)
    return s.DailyLog(
        id=log.id,
        version=log.version,
        created_at=log.created_at,
        updated_at=log.updated_at,
        local_date=log.local_date,
        sleep_hours=sleep,
        sleep_quality=log.sleep_quality,
        energy=log.energy,
        recovery=log.recovery,
        mood=log.mood,
        readiness=s.Readiness(
            local_date=log.local_date,
            sleep_last_night_h=sleep,
            energy=log.energy,
            recovery=log.recovery,
            result=s.ReadinessResult(level=r[0], points=r[1]) if r else None,
        ),
    )


def _check_not_future(day: date, tz: str) -> None:
    today = datetime.now(ZoneInfo(tz)).date()
    if day > today + timedelta(days=1):
        raise ApiError(422, "validation_error", "A check-in can't be for a future day")


async def _find(session: Session, user_id, day: date) -> DailyLog | None:  # type: ignore[no-untyped-def]
    stmt = select(DailyLog).where(
        DailyLog.user_id == user_id, DailyLog.local_date == day, DailyLog.deleted_at.is_(None)
    )
    return (await session.execute(stmt.with_for_update())).scalar_one_or_none()


@router.get("/daily-logs/{date}", operation_id="getDailyLog", response_model=s.DailyLog)
async def get_daily_log(date: date, principal: CurrentUser, session: Session) -> s.DailyLog:  # noqa: A002
    log = await _find(session, principal.id, date)
    if log is None:
        raise not_found("Check-in")
    return _out(log)


@router.put("/daily-logs/{date}", operation_id="upsertDailyLog", response_model=s.DailyLog)
async def upsert_daily_log(
    date: date,  # noqa: A002
    body: s.DailyLogInput,
    key: KeyHeader,
    request: Request,
    principal: CurrentUser,
    session: Session,
    if_match: Annotated[str | None, Header(alias="If-Match", pattern=r"^[0-9]+$")] = None,
) -> Response:
    idem = Idempotency(session, principal.id, key, request)
    if replay := await idem.begin(
        {"date": str(date), "if_match": if_match, "body": body.model_dump(mode="json", exclude_unset=True)}
    ):
        return replay
    _check_not_future(date, principal.user.timezone)
    incoming = body.model_dump(exclude_unset=True)
    log = await _find(session, principal.id, date)

    if log is None:
        log = DailyLog(user_id=principal.id, local_date=date, **incoming)
        session.add(log)
    elif if_match is not None:
        # Client knew the record: normal optimistic update.
        check_version(log, parse_if_match(if_match) or 0, _OutAdapter)
        apply(log, incoming)
    else:
        # Client didn't know a record existed (e.g. offline on another device): merge only into
        # empty fields; a real disagreement is a conflict the user resolves (§6.4).
        clashes = [
            f
            for f, v in incoming.items()
            if v is not None and getattr(log, f) is not None and _norm(getattr(log, f)) != v
        ]
        if clashes:
            raise version_conflict(_out(log).model_dump(mode="json"))
        apply(log, {f: v for f, v in incoming.items() if v is not None and getattr(log, f) is None})

    await session.flush()
    await session.refresh(log)
    return await idem.finish(200, _out(log))


def _norm(v: object) -> object:
    return float(v) if hasattr(v, "as_integer_ratio") and not isinstance(v, int) else v  # Decimal → float


class _OutAdapter:
    """check_version expects a pydantic model class; adapt DailyLog → DailyLog schema."""

    @staticmethod
    def model_validate(obj: DailyLog) -> s.DailyLog:
        return _out(obj)
