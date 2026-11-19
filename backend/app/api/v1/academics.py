"""Academics: subjects, study/coding sessions, DSA problems, assignments, milestones, semesters.

Every write follows the tasks.py pattern: idempotency → strict schema → ownership of the record AND of any
referenced record (subject_id, coding_session_id) → version check → write, all in one transaction.
XP is not awarded here; the Phase 5 engine derives it from these records (docs/progression-rules.md §11).
"""

import uuid
from datetime import UTC, date, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Header, Query, Request, Response
from sqlalchemy import select

from app.api.deps import CurrentUser, Session
from app.core.errors import ApiError, version_conflict
from app.core.idempotency import Idempotency, KeyHeader
from app.models import (
    Assignment,
    CodingMilestone,
    CodingSession,
    DsaProblem,
    LearningMilestone,
    Semester,
    StudySession,
    Subject,
)
from app.repositories.owned import (
    apply,
    check_version,
    get_owned,
    insert_owned,
    local_date_for,
    parse_if_match,
    require_ref,
)
from app.schemas import academics as s
from app.services.academics import academics_summary, cgpa, subject_stats

router = APIRouter(tags=["academics"])
IfMatch = Annotated[str, Header(alias="If-Match", pattern=r"^[0-9]+$")]


def _idem_body(body: Any = None, **extra: Any) -> dict[str, Any]:
    out = {k: str(v) for k, v in extra.items()}
    if body is not None:
        out["body"] = body.model_dump(mode="json", exclude_unset=True)
    return out


def _not_future(ts: datetime) -> None:
    if ts.tzinfo is not None and (ts - datetime.now(UTC)).total_seconds() > 5 * 60:
        raise ApiError(
            422,
            "validation_error",
            "The request is not valid",
            errors=[{"field": "started_at", "message": "can't be in the future"}],
        )


# ───────────────────────── subjects ─────────────────────────


async def _subject_out(session: Session, user_id: uuid.UUID, subj: Subject, today: date) -> s.Subject:
    stats = await subject_stats(session, user_id, today, only=subj.id)
    return s.Subject.model_validate(subj).model_copy(update=stats.get(subj.id, {}))


@router.get("/subjects", operation_id="listSubjects", response_model=list[s.Subject])
async def list_subjects(principal: CurrentUser, session: Session) -> list[s.Subject]:
    today = local_date_for(datetime.now(UTC), principal.user.timezone)
    rows = (
        await session.execute(
            select(Subject)
            .where(Subject.user_id == principal.id, Subject.deleted_at.is_(None), Subject.archived.is_(False))
            .order_by(Subject.short_name)
        )
    ).scalars()
    stats = await subject_stats(session, principal.id, today)
    return [s.Subject.model_validate(r).model_copy(update=stats.get(r.id, {})) for r in rows]


@router.post("/subjects", operation_id="createSubject", status_code=201, response_model=s.Subject)
async def create_subject(
    body: s.SubjectInput, key: KeyHeader, request: Request, principal: CurrentUser, session: Session
) -> Response:
    idem = Idempotency(session, principal.id, key, request)
    if replay := await idem.begin(body):
        return replay
    await require_ref(session, Semester, principal.id, body.semester_id, "semester_id")
    subj = await insert_owned(session, Subject(user_id=principal.id, **body.model_dump()))
    today = local_date_for(datetime.now(UTC), principal.user.timezone)
    return await idem.finish(201, await _subject_out(session, principal.id, subj, today))


@router.patch("/subjects/{id}", operation_id="updateSubject", response_model=s.Subject)
async def update_subject(
    id: uuid.UUID,  # noqa: A002
    body: s.SubjectPatch,
    key: KeyHeader,
    if_match: IfMatch,
    request: Request,
    principal: CurrentUser,
    session: Session,
) -> Response:
    idem = Idempotency(session, principal.id, key, request)
    if replay := await idem.begin(_idem_body(body, id=id, if_match=if_match)):
        return replay
    subj = await get_owned(session, Subject, principal.id, id, lock=True)
    check_version(subj, parse_if_match(if_match) or 0, s.Subject)
    values = body.model_dump(exclude_unset=True)
    if (values.get("units_done", subj.units_done)) > (values.get("units_total", subj.units_total)):
        raise ApiError(
            422,
            "validation_error",
            "The request is not valid",
            errors=[{"field": "units_done", "message": "can't exceed units_total"}],
        )
    await require_ref(session, Semester, principal.id, values.get("semester_id"), "semester_id")
    apply(subj, values)
    await insert_owned(session, subj)  # flush with duplicate detection (short_name is unique)
    today = local_date_for(datetime.now(UTC), principal.user.timezone)
    return await idem.finish(200, await _subject_out(session, principal.id, subj, today))


@router.delete("/subjects/{id}", operation_id="deleteSubject", status_code=204)
async def delete_subject(
    id: uuid.UUID,  # noqa: A002
    key: KeyHeader,
    if_match: IfMatch,
    request: Request,
    principal: CurrentUser,
    session: Session,
) -> Response:
    idem = Idempotency(session, principal.id, key, request)
    if replay := await idem.begin(_idem_body(id=id, if_match=if_match)):
        return replay
    subj = await get_owned(session, Subject, principal.id, id, lock=True)
    check_version(subj, parse_if_match(if_match) or 0, s.Subject)
    apply(subj, {"deleted_at": datetime.now(UTC)})
    return await idem.finish(204)


# ───────────────────────── sessions ─────────────────────────


@router.get("/study/sessions", operation_id="listStudySessions")
async def list_study_sessions(
    principal: CurrentUser,
    session: Session,
    from_: Annotated[date | None, Query(alias="from")] = None,
    to: date | None = None,
    cursor: str | None = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> dict[str, Any]:
    try:
        offset = int(cursor) if cursor else 0
    except ValueError as exc:
        raise ApiError(422, "validation_error", "Invalid cursor") from exc
    stmt = select(StudySession).where(StudySession.user_id == principal.id, StudySession.deleted_at.is_(None))
    if from_:
        stmt = stmt.where(StudySession.local_date >= from_)
    if to:
        stmt = stmt.where(StudySession.local_date <= to)
    rows = list(
        (
            await session.execute(
                stmt.order_by(StudySession.started_at.desc(), StudySession.id).offset(offset).limit(limit + 1)
            )
        ).scalars()
    )
    items = [s.StudySession.model_validate(r).model_dump(mode="json") for r in rows[:limit]]
    return {"items": items, "next_cursor": str(offset + limit) if len(rows) > limit else None}


@router.post("/study/sessions", operation_id="createStudySession", status_code=201, response_model=s.StudySession)
async def create_study_session(
    body: s.StudySessionInput, key: KeyHeader, request: Request, principal: CurrentUser, session: Session
) -> Response:
    idem = Idempotency(session, principal.id, key, request)
    if replay := await idem.begin(body):
        return replay
    _not_future(body.started_at)
    await require_ref(session, Subject, principal.id, body.subject_id, "subject_id")
    values = body.model_dump(exclude_none=True)
    row = await insert_owned(
        session,
        StudySession(
            user_id=principal.id, local_date=local_date_for(body.started_at, principal.user.timezone), **values
        ),
    )
    return await idem.finish(201, s.StudySession.model_validate(row))


@router.post("/coding/sessions", operation_id="createCodingSession", status_code=201, response_model=s.CodingSession)
async def create_coding_session(
    body: s.CodingSessionInput, key: KeyHeader, request: Request, principal: CurrentUser, session: Session
) -> Response:
    idem = Idempotency(session, principal.id, key, request)
    if replay := await idem.begin(body):
        return replay
    _not_future(body.started_at)
    tz = principal.user.timezone
    values = body.model_dump(exclude_none=True, exclude={"problems"})
    row = await insert_owned(
        session, CodingSession(user_id=principal.id, local_date=local_date_for(body.started_at, tz), **values)
    )
    problems = []
    for p in body.problems:  # solved during this session: same transaction, linked to it
        pv = p.model_dump(exclude_none=True, exclude={"coding_session_id"})
        problems.append(
            await insert_owned(
                session,
                DsaProblem(
                    user_id=principal.id, coding_session_id=row.id, local_date=local_date_for(p.solved_at, tz), **pv
                ),
            )
        )
    out = s.CodingSession.model_validate(row).model_copy(
        update={"problems": [s.DsaProblem.model_validate(p) for p in problems]}
    )
    return await idem.finish(201, out)


@router.post("/dsa/problems", operation_id="logDsaProblem", status_code=201, response_model=s.DsaProblem)
async def log_dsa_problem(
    body: s.DsaProblemInput, key: KeyHeader, request: Request, principal: CurrentUser, session: Session
) -> Response:
    idem = Idempotency(session, principal.id, key, request)
    if replay := await idem.begin(body):
        return replay
    await require_ref(session, CodingSession, principal.id, body.coding_session_id, "coding_session_id")
    values = body.model_dump(exclude_none=True)
    row = await insert_owned(
        session,
        DsaProblem(user_id=principal.id, local_date=local_date_for(body.solved_at, principal.user.timezone), **values),
    )
    return await idem.finish(201, s.DsaProblem.model_validate(row))


# ───────────────────────── assignments ─────────────────────────


@router.get("/assignments", operation_id="listAssignments", response_model=list[s.Assignment])
async def list_assignments(principal: CurrentUser, session: Session) -> list[Assignment]:
    stmt = select(Assignment).where(Assignment.user_id == principal.id, Assignment.deleted_at.is_(None))
    return list((await session.execute(stmt.order_by(Assignment.due_at))).scalars())


@router.post("/assignments", operation_id="createAssignment", status_code=201, response_model=s.Assignment)
async def create_assignment(
    body: s.AssignmentInput, key: KeyHeader, request: Request, principal: CurrentUser, session: Session
) -> Response:
    idem = Idempotency(session, principal.id, key, request)
    if replay := await idem.begin(body):
        return replay
    await require_ref(session, Subject, principal.id, body.subject_id, "subject_id")
    row = await insert_owned(session, Assignment(user_id=principal.id, **body.model_dump()))
    return await idem.finish(201, s.Assignment.model_validate(row))


@router.patch("/assignments/{id}", operation_id="updateAssignment", response_model=s.Assignment)
async def update_assignment(
    id: uuid.UUID,  # noqa: A002
    body: s.AssignmentInput,
    key: KeyHeader,
    if_match: IfMatch,
    request: Request,
    principal: CurrentUser,
    session: Session,
) -> Response:
    idem = Idempotency(session, principal.id, key, request)
    if replay := await idem.begin(_idem_body(body, id=id, if_match=if_match)):
        return replay
    row = await get_owned(session, Assignment, principal.id, id, lock=True)
    check_version(row, parse_if_match(if_match) or 0, s.Assignment)
    await require_ref(session, Subject, principal.id, body.subject_id, "subject_id")
    apply(row, body.model_dump())
    await session.flush()
    await session.refresh(row)
    return await idem.finish(200, s.Assignment.model_validate(row))


# ───────────────────────── milestones ─────────────────────────


def _milestone_out(m: LearningMilestone | CodingMilestone) -> s.Milestone:
    common = {
        "id": m.id,
        "version": m.version,
        "created_at": m.created_at,
        "updated_at": m.updated_at,
        "title": m.title,
        "planned_for": m.planned_for,
        "completed_at": m.completed_at,
    }
    if isinstance(m, CodingMilestone):
        return s.Milestone(kind="project", project=m.project, **common)
    return s.Milestone(
        kind=m.kind,
        subject_id=m.subject_id,
        score=float(m.score) if m.score is not None else None,
        max_score=float(m.max_score) if m.max_score is not None else None,
        **common,
    )


@router.get("/milestones", operation_id="listMilestones", response_model=list[s.Milestone])
async def list_milestones(principal: CurrentUser, session: Session) -> list[s.Milestone]:
    learn = (
        await session.execute(
            select(LearningMilestone).where(
                LearningMilestone.user_id == principal.id, LearningMilestone.deleted_at.is_(None)
            )
        )
    ).scalars()
    proj = (
        await session.execute(
            select(CodingMilestone).where(CodingMilestone.user_id == principal.id, CodingMilestone.deleted_at.is_(None))
        )
    ).scalars()
    items = [_milestone_out(m) for m in [*learn, *proj]]
    # Done first by completion date (newest first), then planned ones by date.
    done = sorted((m for m in items if m.completed_at), key=lambda m: m.completed_at, reverse=True)  # type: ignore[arg-type,return-value]
    todo = sorted(
        (m for m in items if not m.completed_at), key=lambda m: (m.planned_for is None, m.planned_for or date.max)
    )
    return [*done, *todo]


@router.post("/milestones", operation_id="createMilestone", status_code=201, response_model=s.Milestone)
async def create_milestone(
    body: s.MilestoneInput, key: KeyHeader, request: Request, principal: CurrentUser, session: Session
) -> Response:
    idem = Idempotency(session, principal.id, key, request)
    if replay := await idem.begin(body):
        return replay
    if body.kind == "project":
        row: LearningMilestone | CodingMilestone = await insert_owned(
            session,
            CodingMilestone(
                user_id=principal.id,
                project=body.project,
                title=body.title,
                planned_for=body.planned_for,
                completed_at=body.completed_at,
            ),
        )
    else:
        await require_ref(session, Subject, principal.id, body.subject_id, "subject_id")
        row = await insert_owned(
            session, LearningMilestone(user_id=principal.id, **body.model_dump(exclude={"project"}, exclude_none=True))
        )
    return await idem.finish(201, _milestone_out(row))


@router.patch("/milestones/{id}", operation_id="updateMilestone", response_model=s.Milestone)
async def update_milestone(
    id: uuid.UUID,  # noqa: A002
    body: s.MilestonePatch,
    key: KeyHeader,
    if_match: IfMatch,
    request: Request,
    principal: CurrentUser,
    session: Session,
) -> Response:
    idem = Idempotency(session, principal.id, key, request)
    if replay := await idem.begin(_idem_body(body, id=id, if_match=if_match)):
        return replay
    row: LearningMilestone | CodingMilestone
    try:
        row = await get_owned(session, LearningMilestone, principal.id, id, lock=True)
    except ApiError as e:
        if e.status != 404:
            raise
        row = await get_owned(session, CodingMilestone, principal.id, id, lock=True)
    current = _milestone_out(row)
    if row.version != (parse_if_match(if_match) or 0):
        raise version_conflict(current.model_dump(mode="json"))
    values = body.model_dump(exclude_unset=True)
    if isinstance(row, CodingMilestone) and ({"score", "max_score"} & values.keys()):
        raise ApiError(
            422,
            "validation_error",
            "The request is not valid",
            errors=[{"field": "score", "message": "project milestones have no score"}],
        )
    if isinstance(row, LearningMilestone):
        score = values.get("score", row.score)
        max_score = values.get("max_score", row.max_score)
        if (score is None) != (max_score is None) or (
            score is not None and max_score is not None and score > max_score
        ):
            raise ApiError(
                422,
                "validation_error",
                "The request is not valid",
                errors=[{"field": "score", "message": "score and max_score go together; score ≤ max_score"}],
            )
    apply(row, values)
    await session.flush()
    await session.refresh(row)
    return await idem.finish(200, _milestone_out(row))


# ───────────────────────── semesters ─────────────────────────


@router.get("/semesters", operation_id="listSemesters", response_model=s.SemesterList)
async def list_semesters(principal: CurrentUser, session: Session) -> s.SemesterList:
    rows = list(
        (
            await session.execute(
                select(Semester)
                .where(Semester.user_id == principal.id, Semester.deleted_at.is_(None))
                .order_by(Semester.ordinal)
            )
        ).scalars()
    )
    return s.SemesterList(semesters=[s.Semester.model_validate(r) for r in rows], cgpa=cgpa(rows))


@router.post("/semesters", operation_id="createSemester", status_code=201, response_model=s.Semester)
async def create_semester(
    body: s.SemesterInput, key: KeyHeader, request: Request, principal: CurrentUser, session: Session
) -> Response:
    idem = Idempotency(session, principal.id, key, request)
    if replay := await idem.begin(body):
        return replay
    row = await insert_owned(session, Semester(user_id=principal.id, **body.model_dump()))
    return await idem.finish(201, s.Semester.model_validate(row))


@router.patch("/semesters/{id}", operation_id="updateSemester", response_model=s.Semester)
async def update_semester(
    id: uuid.UUID,  # noqa: A002
    body: s.SemesterPatch,
    key: KeyHeader,
    if_match: IfMatch,
    request: Request,
    principal: CurrentUser,
    session: Session,
) -> Response:
    idem = Idempotency(session, principal.id, key, request)
    if replay := await idem.begin(_idem_body(body, id=id, if_match=if_match)):
        return replay
    row = await get_owned(session, Semester, principal.id, id, lock=True)
    check_version(row, parse_if_match(if_match) or 0, s.Semester)
    apply(row, body.model_dump(exclude_unset=True))
    await session.flush()
    await session.refresh(row)
    return await idem.finish(200, s.Semester.model_validate(row))


# ───────────────────────── summary ─────────────────────────


@router.get("/study/analytics", operation_id="getAcademicsSummary", response_model=s.AcademicsSummary)
async def get_academics_summary(principal: CurrentUser, session: Session) -> s.AcademicsSummary:
    return await academics_summary(session, principal.id, principal.user.timezone)
