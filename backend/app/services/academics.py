"""Academics read model: the numbers behind the Academics screen.

All windows are owner-local calendar days (D5); weeks start Monday (D14):
- study/coding hours: last 14 days (today included) vs the 14 before
- subject stats: last 28 days; last studied = most recent session ever
- sessions timeline: last 7 days
- DSA: lifetime count; window = the last 8 Monday-weeks (this week included)
"""

import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Assignment, CodingSession, DsaProblem, Semester, StudySession, Subject
from app.repositories.owned import local_date_for
from app.schemas import academics as s

AREA_LABEL = {"dsa": "DSA practice", "project": "Project work", "course": "Course lab", "other": "Coding"}


def cgpa(semesters: list[Semester]) -> float | None:
    """Σ(SGPA × credits) / Σ(credits) over semesters with both an SGPA and credits."""
    graded = [x for x in semesters if x.sgpa is not None and x.credits]
    credits = sum(x.credits or 0 for x in graded)
    if not credits:
        return None
    return round(sum(float(x.sgpa) * (x.credits or 0) for x in graded) / credits, 2)


async def subject_stats(
    session: AsyncSession, user_id: uuid.UUID, today: date, only: uuid.UUID | None = None
) -> dict[uuid.UUID, dict[str, Any]]:
    since = today - timedelta(days=27)
    live = (StudySession.user_id == user_id, StudySession.deleted_at.is_(None), StudySession.subject_id.is_not(None))
    window = select(
        StudySession.subject_id,
        func.coalesce(func.sum(StudySession.minutes), 0),
        func.count(StudySession.id),
    ).where(*live, StudySession.local_date >= since, StudySession.local_date <= today)
    last = select(StudySession.subject_id, func.max(StudySession.started_at)).where(*live)
    if only:
        window = window.where(StudySession.subject_id == only)
        last = last.where(StudySession.subject_id == only)
    out: dict[uuid.UUID, dict[str, Any]] = {}
    for sid, minutes, count in (await session.execute(window.group_by(StudySession.subject_id))).all():
        out.setdefault(sid, {}).update(hours_28d=round(minutes / 60, 1), sessions_28d=count)
    for sid, ts in (await session.execute(last.group_by(StudySession.subject_id))).all():
        out.setdefault(sid, {})["last_studied_at"] = ts
    return out


async def _hours(
    session: AsyncSession, model: type[StudySession] | type[CodingSession], user_id: uuid.UUID, start: date, end: date
) -> float:
    total = (
        await session.execute(
            select(func.coalesce(func.sum(model.minutes), 0)).where(
                model.user_id == user_id, model.deleted_at.is_(None), model.local_date >= start, model.local_date <= end
            )
        )
    ).scalar_one()
    return round(total / 60, 1)


async def academics_summary(session: AsyncSession, user_id: uuid.UUID, tz: str) -> s.AcademicsSummary:
    today = local_date_for(datetime.now(UTC), tz)
    d13, d14, d27 = today - timedelta(days=13), today - timedelta(days=14), today - timedelta(days=27)

    subjects = list(
        (
            await session.execute(
                select(Subject)
                .where(Subject.user_id == user_id, Subject.deleted_at.is_(None), Subject.archived.is_(False))
                .order_by(Subject.short_name)
            )
        ).scalars()
    )
    stats = await subject_stats(session, user_id, today)
    short = {x.id: x.short_name for x in subjects}

    # Sessions, last 7 days (both kinds), oldest first.
    since7 = today - timedelta(days=6)
    study = (
        await session.execute(
            select(StudySession).where(
                StudySession.user_id == user_id, StudySession.deleted_at.is_(None), StudySession.local_date >= since7
            )
        )
    ).scalars()
    coding = (
        await session.execute(
            select(CodingSession).where(
                CodingSession.user_id == user_id, CodingSession.deleted_at.is_(None), CodingSession.local_date >= since7
            )
        )
    ).scalars()
    sessions = [
        *(
            s.FocusSession(
                id=x.id, kind="study", start=x.started_at, minutes=x.minutes, label=short.get(x.subject_id, "Study")
            )
            for x in study
        ),  # type: ignore[arg-type]
        *(
            s.FocusSession(id=x.id, kind="coding", start=x.started_at, minutes=x.minutes, label=AREA_LABEL[x.area])
            for x in coding
        ),
    ]
    sessions.sort(key=lambda x: x.start)

    # DSA
    live_dsa = (DsaProblem.user_id == user_id, DsaProblem.deleted_at.is_(None))
    lifetime = (await session.execute(select(func.count()).select_from(DsaProblem).where(*live_dsa))).scalar_one()
    week0 = today - timedelta(days=today.weekday()) - timedelta(weeks=7)
    in_window = (*live_dsa, DsaProblem.local_date >= week0)
    window = (await session.execute(select(func.count()).select_from(DsaProblem).where(*in_window))).scalar_one()
    by_diff = dict(
        (
            await session.execute(
                select(DsaProblem.difficulty, func.count()).where(*in_window).group_by(DsaProblem.difficulty)
            )
        ).all()
    )
    by_topic = [
        s.TopicCount(topic=t, solved=n)
        for t, n in (
            await session.execute(
                select(DsaProblem.topic, func.count())
                .where(*in_window)
                .group_by(DsaProblem.topic)
                .order_by(func.count().desc(), DsaProblem.topic)
            )
        ).all()
    ]
    dates = (await session.execute(select(DsaProblem.local_date).where(*in_window))).scalars().all()
    weekly = []
    for k in range(8):
        ws = week0 + timedelta(weeks=k)
        weekly.append(s.WeekCount(week_start=ws, count=sum(1 for d in dates if ws <= d < ws + timedelta(weeks=1))))

    nxt = (
        await session.execute(
            select(Assignment)
            .where(
                Assignment.user_id == user_id,
                Assignment.deleted_at.is_(None),
                Assignment.status.in_(("not_started", "in_progress")),
            )
            .order_by(Assignment.due_at)
            .limit(1)
        )
    ).scalar_one_or_none()

    return s.AcademicsSummary(
        study_hours_14d=await _hours(session, StudySession, user_id, d13, today),
        prev_study_hours_14d=await _hours(session, StudySession, user_id, d27, d14),
        coding_hours_14d=await _hours(session, CodingSession, user_id, d13, today),
        prev_coding_hours_14d=await _hours(session, CodingSession, user_id, d27, d14),
        subjects=[s.Subject.model_validate(x).model_copy(update=stats.get(x.id, {})) for x in subjects],
        sessions_7d=sessions,
        dsa=s.DsaSummary(
            lifetime=lifetime,
            window=window,
            by_difficulty={k: by_diff.get(k, 0) for k in ("easy", "medium", "hard")},
            by_topic=by_topic,
            weekly=weekly,
        ),
        next_deadline=s.Assignment.model_validate(nxt) if nxt else None,
    )
