"""Fitness: exercise library, splits (templates), training plan, workouts with sets, body measurements.

Same write pattern as tasks.py and academics.py: idempotency → strict schema → ownership of the record and of
every referenced record (exercise_id, template_id) → version check → write, in one transaction.
Est. 1RM, volume and PR flags are computed on read (services/fitness.py); clients never send them, and
XP is awarded later by the Phase 5 engine from these records.
"""

import uuid
from datetime import UTC, datetime, timedelta
from typing import Annotated, Any

from fastapi import APIRouter, Header, Query, Request, Response
from sqlalchemy import delete, select

from app.api.deps import CurrentUser, Session
from app.core.errors import ApiError, version_conflict
from app.core.idempotency import Idempotency, KeyHeader
from app.models import (
    BodyMeasurement,
    Exercise,
    ExerciseSet,
    TrainingPlan,
    WorkoutSession,
    WorkoutTemplate,
    WorkoutTemplateExercise,
)
from app.repositories.owned import (
    apply,
    check_version,
    get_owned,
    insert_owned,
    local_date_for,
    parse_if_match,
    require_ref,
    today_for,
)
from app.schemas import fitness as s
from app.services.fitness import active_plan, body_history, exercise_stats, progression, set_out, workouts_out

router = APIRouter(tags=["fitness"])
IfMatch = Annotated[str, Header(alias="If-Match", pattern=r"^[0-9]+$")]
OptionalIfMatch = Annotated[str | None, Header(alias="If-Match", pattern=r"^[0-9]+$")]


def _idem_body(body: Any = None, **extra: Any) -> dict[str, Any]:
    out = {k: str(v) for k, v in extra.items()}
    if body is not None:
        out["body"] = body.model_dump(mode="json", exclude_unset=True)
    return out


def _invalid(field: str, message: str) -> ApiError:
    return ApiError(422, "validation_error", "The request is not valid", errors=[{"field": field, "message": message}])


def _not_future(ts: datetime, field: str) -> None:
    if ts.tzinfo is not None and (ts - datetime.now(UTC)).total_seconds() > 5 * 60:
        raise _invalid(field, "can't be in the future")


# ───────────────────────── exercise library ─────────────────────────


async def _exercise_out(session: Session, user_id: uuid.UUID, ex: Exercise, tz: str) -> s.Exercise:
    stats = await exercise_stats(session, user_id, today_for(tz))
    return s.Exercise.model_validate(ex).model_copy(update=stats.get(ex.id, {}))


@router.get("/exercises", operation_id="listExercises", response_model=list[s.Exercise])
async def list_exercises(principal: CurrentUser, session: Session) -> list[s.Exercise]:
    rows = (
        await session.execute(
            select(Exercise)
            .where(Exercise.user_id == principal.id, Exercise.deleted_at.is_(None))
            .order_by(Exercise.muscle_group, Exercise.name)
        )
    ).scalars()
    stats = await exercise_stats(session, principal.id, today_for(principal.user.timezone))
    return [s.Exercise.model_validate(r).model_copy(update=stats.get(r.id, {})) for r in rows]


@router.post("/exercises", operation_id="createExercise", status_code=201, response_model=s.Exercise)
async def create_exercise(
    body: s.ExerciseInput, key: KeyHeader, request: Request, principal: CurrentUser, session: Session
) -> Response:
    idem = Idempotency(session, principal.id, key, request)
    if replay := await idem.begin(body):
        return replay
    ex = await insert_owned(session, Exercise(user_id=principal.id, **body.model_dump()))  # name is unique
    return await idem.finish(201, await _exercise_out(session, principal.id, ex, principal.user.timezone))


@router.patch("/exercises/{id}", operation_id="updateExercise", response_model=s.Exercise)
async def update_exercise(
    id: uuid.UUID,  # noqa: A002
    body: s.ExercisePatch,
    key: KeyHeader,
    if_match: IfMatch,
    request: Request,
    principal: CurrentUser,
    session: Session,
) -> Response:
    idem = Idempotency(session, principal.id, key, request)
    if replay := await idem.begin(_idem_body(body, id=id, if_match=if_match)):
        return replay
    ex = await get_owned(session, Exercise, principal.id, id, lock=True)
    check_version(ex, parse_if_match(if_match) or 0, s.Exercise)
    values = body.model_dump(exclude_unset=True)
    for required in ("name", "muscle_group"):
        if required in values and values[required] is None:
            raise _invalid(required, "can't be empty")
    apply(ex, values)
    await insert_owned(session, ex)  # flush with duplicate-name detection
    return await idem.finish(200, await _exercise_out(session, principal.id, ex, principal.user.timezone))


# ───────────────────────── templates (splits) ─────────────────────────


async def _template_out(session: Session, t: WorkoutTemplate) -> s.WorkoutTemplate:
    rows = (
        await session.execute(
            select(WorkoutTemplateExercise)
            .where(WorkoutTemplateExercise.template_id == t.id)
            .order_by(WorkoutTemplateExercise.position)
        )
    ).scalars()
    return s.WorkoutTemplate.model_validate(t).model_copy(
        update={"exercises": [s.TemplateExercise.model_validate(r, from_attributes=True) for r in rows]}
    )


async def _set_template_exercises(
    session: Session, user_id: uuid.UUID, t: WorkoutTemplate, items: list[s.TemplateExerciseInput]
) -> None:
    for i, x in enumerate(items):
        await require_ref(session, Exercise, user_id, x.exercise_id, f"exercises[{i}].exercise_id")
    await session.execute(delete(WorkoutTemplateExercise).where(WorkoutTemplateExercise.template_id == t.id))
    for i, x in enumerate(items, start=1):
        session.add(WorkoutTemplateExercise(template_id=t.id, position=i, **x.model_dump()))
    await session.flush()


@router.get("/workout-templates", operation_id="listWorkoutTemplates", response_model=list[s.WorkoutTemplate])
async def list_templates(principal: CurrentUser, session: Session) -> list[s.WorkoutTemplate]:
    rows = (
        await session.execute(
            select(WorkoutTemplate)
            .where(WorkoutTemplate.user_id == principal.id, WorkoutTemplate.deleted_at.is_(None))
            .order_by(WorkoutTemplate.created_at)
        )
    ).scalars()
    return [await _template_out(session, t) for t in rows]


@router.post(
    "/workout-templates", operation_id="createWorkoutTemplate", status_code=201, response_model=s.WorkoutTemplate
)
async def create_template(
    body: s.WorkoutTemplateInput, key: KeyHeader, request: Request, principal: CurrentUser, session: Session
) -> Response:
    idem = Idempotency(session, principal.id, key, request)
    if replay := await idem.begin(body):
        return replay
    t = await insert_owned(session, WorkoutTemplate(user_id=principal.id, name=body.name))
    await _set_template_exercises(session, principal.id, t, body.exercises)
    return await idem.finish(201, await _template_out(session, t))


@router.patch("/workout-templates/{id}", operation_id="updateWorkoutTemplate", response_model=s.WorkoutTemplate)
async def update_template(
    id: uuid.UUID,  # noqa: A002
    body: s.WorkoutTemplateInput,
    key: KeyHeader,
    if_match: IfMatch,
    request: Request,
    principal: CurrentUser,
    session: Session,
) -> Response:
    """Replaces the name and the whole exercise list."""
    idem = Idempotency(session, principal.id, key, request)
    if replay := await idem.begin(_idem_body(body, id=id, if_match=if_match)):
        return replay
    t = await get_owned(session, WorkoutTemplate, principal.id, id, lock=True)
    check_version(t, parse_if_match(if_match) or 0, s.WorkoutTemplate)
    apply(t, {"name": body.name})
    await _set_template_exercises(session, principal.id, t, body.exercises)
    await session.refresh(t)
    return await idem.finish(200, await _template_out(session, t))


# ───────────────────────── training plan ─────────────────────────


@router.get("/training-plan", operation_id="getTrainingPlan", response_model=s.TrainingPlan | None)
async def get_training_plan(principal: CurrentUser, session: Session) -> TrainingPlan | None:
    return await active_plan(session, principal.id)


@router.put("/training-plan", operation_id="setTrainingPlan", response_model=s.TrainingPlan)
async def set_training_plan(
    body: s.TrainingPlanInput,
    key: KeyHeader,
    request: Request,
    principal: CurrentUser,
    session: Session,
    if_match: OptionalIfMatch = None,
) -> Response:
    """Creates the active plan, or replaces it. Replacing needs the current version in If-Match."""
    idem = Idempotency(session, principal.id, key, request)
    if replay := await idem.begin(_idem_body(body, if_match=if_match)):
        return replay
    for i, tid in enumerate(body.rotation):
        await require_ref(session, WorkoutTemplate, principal.id, tid, f"rotation[{i}]")
    plan = await active_plan(session, principal.id)
    if plan is None:
        plan = await insert_owned(session, TrainingPlan(user_id=principal.id, **body.model_dump()))
    else:
        if if_match is None:  # the client didn't know a plan exists (e.g. set on another device)
            raise version_conflict(s.TrainingPlan.model_validate(plan).model_dump(mode="json"))
        check_version(plan, parse_if_match(if_match) or 0, s.TrainingPlan)
        apply(plan, body.model_dump())
        await session.flush()
        await session.refresh(plan)
    return await idem.finish(200, s.TrainingPlan.model_validate(plan))


# ───────────────────────── workouts ─────────────────────────


@router.get("/workouts", operation_id="listWorkouts")
async def list_workouts(
    principal: CurrentUser,
    session: Session,
    cursor: str | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> dict[str, Any]:
    try:
        offset = int(cursor) if cursor else 0
    except ValueError as exc:
        raise ApiError(422, "validation_error", "Invalid cursor") from exc
    rows = list(
        (
            await session.execute(
                select(WorkoutSession)
                .where(WorkoutSession.user_id == principal.id, WorkoutSession.deleted_at.is_(None))
                .order_by(WorkoutSession.started_at.desc(), WorkoutSession.id)
                .offset(offset)
                .limit(limit + 1)
            )
        ).scalars()
    )
    items = await workouts_out(session, principal.id, rows[:limit])
    return {
        "items": [x.model_dump(mode="json") for x in items],
        "next_cursor": str(offset + limit) if len(rows) > limit else None,
    }


async def _insert_set(
    session: Session, user_id: uuid.UUID, workout_id: uuid.UUID, x: s.ExerciseSetInput, field: str
) -> ExerciseSet:
    await require_ref(session, Exercise, user_id, x.exercise_id, field)
    values = x.model_dump(exclude_none=True)
    return await insert_owned(session, ExerciseSet(user_id=user_id, workout_session_id=workout_id, **values))


@router.post("/workouts", operation_id="startWorkout", status_code=201, response_model=s.Workout)
async def start_workout(
    body: s.WorkoutInput, key: KeyHeader, request: Request, principal: CurrentUser, session: Session
) -> Response:
    idem = Idempotency(session, principal.id, key, request)
    if replay := await idem.begin(body):
        return replay
    _not_future(body.started_at, "started_at")
    if body.ended_at is not None:
        _not_future(body.ended_at, "ended_at")
    await require_ref(session, WorkoutTemplate, principal.id, body.template_id, "template_id")
    values = body.model_dump(exclude_none=True, exclude={"sets"})
    w = await insert_owned(
        session,
        WorkoutSession(
            user_id=principal.id, local_date=local_date_for(body.started_at, principal.user.timezone), **values
        ),
    )
    for i, x in enumerate(body.sets):  # same transaction: a bad set rolls back the whole workout
        await _insert_set(session, principal.id, w.id, x, f"sets[{i}].exercise_id")
    return await idem.finish(201, (await workouts_out(session, principal.id, [w]))[0])


@router.post("/workouts/{id}/sets", operation_id="addSet", status_code=201, response_model=s.ExerciseSet)
async def add_set(
    id: uuid.UUID,  # noqa: A002
    body: s.ExerciseSetInput,
    key: KeyHeader,
    request: Request,
    principal: CurrentUser,
    session: Session,
) -> Response:
    idem = Idempotency(session, principal.id, key, request)
    if replay := await idem.begin(_idem_body(body, id=id)):
        return replay
    w = await get_owned(session, WorkoutSession, principal.id, id)
    row = await _insert_set(session, principal.id, w.id, body, "exercise_id")  # duplicate position → 409
    return await idem.finish(201, set_out(row))


@router.post("/workouts/{id}/finish", operation_id="finishWorkout", response_model=s.Workout)
async def finish_workout(
    id: uuid.UUID,  # noqa: A002
    key: KeyHeader,
    if_match: IfMatch,
    request: Request,
    principal: CurrentUser,
    session: Session,
    body: s.FinishWorkoutInput | None = None,
) -> Response:
    body = body or s.FinishWorkoutInput()
    idem = Idempotency(session, principal.id, key, request)
    if replay := await idem.begin(_idem_body(body, id=id, if_match=if_match)):
        return replay
    w = await get_owned(session, WorkoutSession, principal.id, id, lock=True)
    check_version(w, parse_if_match(if_match) or 0, s.Workout)
    ended = body.ended_at or datetime.now(UTC)
    _not_future(ended, "ended_at")
    if ended < w.started_at:
        raise _invalid("ended_at", "can't be before started_at")
    apply(w, {"ended_at": ended})
    await session.flush()
    await session.refresh(w)
    return await idem.finish(200, (await workouts_out(session, principal.id, [w]))[0])


@router.get("/fitness/progression", operation_id="getFitnessProgression", response_model=s.FitnessProgression)
async def get_fitness_progression(
    principal: CurrentUser, session: Session, weeks: Annotated[int, Query(ge=1, le=52)] = 8
) -> s.FitnessProgression:
    return await progression(session, principal.id, today_for(principal.user.timezone), weeks)


# ───────────────────────── body ─────────────────────────


@router.get("/body-measurements", operation_id="listBodyMeasurements", response_model=list[s.BodyMeasurement])
async def list_body_measurements(
    principal: CurrentUser, session: Session, weeks: Annotated[int, Query(ge=1, le=104)] = 8
) -> list[BodyMeasurement]:
    since = today_for(principal.user.timezone) - timedelta(weeks=weeks)
    return await body_history(session, principal.id, since)


@router.post("/body-measurements", operation_id="logBodyMeasurement", status_code=201, response_model=s.BodyMeasurement)
async def log_body_measurement(
    body: s.BodyMeasurementInput, key: KeyHeader, request: Request, principal: CurrentUser, session: Session
) -> Response:
    idem = Idempotency(session, principal.id, key, request)
    if replay := await idem.begin(body):
        return replay
    if body.measured_on > today_for(principal.user.timezone):
        raise _invalid("measured_on", "can't be in the future")
    row = await insert_owned(session, BodyMeasurement(user_id=principal.id, **body.model_dump()))
    return await idem.finish(201, s.BodyMeasurement.model_validate(row))
