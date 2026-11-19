"""Fitness read model: the numbers behind the Fitness screen.

Definitions (docs/progression-rules.md):
- Estimated 1RM (Epley) = load × (1 + reps / 30), only for sets of 1–10 reps; warm-up sets never count.
- A lift's session value is the best est. 1RM among that session's working sets of exercises tracked as the lift.
- A PR is a session value that beats the best value from every EARLIER session of that lift by ≥ 0.5 kg
  (the `lift.e1rm_pr` threshold). A lift's first session sets the baseline and is not a PR.
- Volume = Σ load × reps over working sets. Weeks start Monday (D14); dates are owner-local (D5).
"""

import uuid
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import BodyMeasurement, Exercise, ExerciseSet, TrainingPlan, WorkoutSession, WorkoutTemplate
from app.schemas import fitness as s

PR_MIN_GAIN_KG = 0.5


def e1rm(load_kg: float, reps: int) -> float | None:
    if not 1 <= reps <= 10:
        return None
    return round(float(load_kg) * (1 + reps / 30), 1)


def window_start(today: date, weeks: int) -> date:
    """Monday of the week `weeks - 1` weeks before this one."""
    return today - timedelta(days=today.weekday()) - timedelta(weeks=weeks - 1)


@dataclass
class SetRow:
    set: ExerciseSet
    workout_id: uuid.UUID
    started_at: datetime
    local_date: date
    exercise: Exercise


async def _sets(session: AsyncSession, user_id: uuid.UUID, workout_ids: list[uuid.UUID] | None = None) -> list[SetRow]:
    stmt = (
        select(ExerciseSet, WorkoutSession.started_at, WorkoutSession.local_date, Exercise)
        .join(WorkoutSession, WorkoutSession.id == ExerciseSet.workout_session_id)
        .join(Exercise, Exercise.id == ExerciseSet.exercise_id)
        .where(
            ExerciseSet.user_id == user_id,
            ExerciseSet.deleted_at.is_(None),
            WorkoutSession.deleted_at.is_(None),
        )
        .order_by(WorkoutSession.started_at, ExerciseSet.position)
    )
    if workout_ids is not None:
        stmt = stmt.where(ExerciseSet.workout_session_id.in_(workout_ids))
    rows = (await session.execute(stmt)).all()
    return [SetRow(r[0], r[0].workout_session_id, r[1], r[2], r[3]) for r in rows]


@dataclass
class LiftSession:
    lift: str
    workout_id: uuid.UUID
    local_date: date
    set: ExerciseSet
    exercise: str
    e1rm: float
    pr: bool


def lift_history(rows: list[SetRow]) -> list[LiftSession]:
    """One entry per (tracked lift, workout), oldest first, with PR flags from the full history."""
    best_in_session: dict[tuple[str, uuid.UUID], tuple[float, SetRow]] = {}
    order: list[tuple[str, uuid.UUID]] = []
    for r in rows:  # rows are ordered by workout start
        lift = r.exercise.tracked_lift
        if lift is None or r.set.is_warmup:
            continue
        value = e1rm(r.set.load_kg, r.set.reps)
        if value is None:
            continue
        k = (lift, r.workout_id)
        if k not in best_in_session:
            order.append(k)
            best_in_session[k] = (value, r)
        elif value > best_in_session[k][0]:
            best_in_session[k] = (value, r)
    out: list[LiftSession] = []
    best_so_far: dict[str, float] = {}
    for k in order:
        value, r = best_in_session[k]
        prior = best_so_far.get(k[0])
        out.append(
            LiftSession(
                lift=k[0],
                workout_id=r.workout_id,
                local_date=r.local_date,
                set=r.set,
                exercise=r.exercise.name,
                e1rm=value,
                pr=prior is not None and value >= prior + PR_MIN_GAIN_KG,
            )
        )
        best_so_far[k[0]] = max(value, prior or 0)
    return out


def set_out(x: ExerciseSet) -> s.ExerciseSet:
    return s.ExerciseSet.model_validate(x).model_copy(
        update={"e1rm_kg": None if x.is_warmup else e1rm(x.load_kg, x.reps)}
    )


async def workouts_out(session: AsyncSession, user_id: uuid.UUID, workouts: list[WorkoutSession]) -> list[s.Workout]:
    if not workouts:
        return []
    ids = [w.id for w in workouts]
    rows = await _sets(session, user_id, ids)
    by_workout: dict[uuid.UUID, list[ExerciseSet]] = defaultdict(list)
    for r in rows:
        by_workout[r.workout_id].append(r.set)
    pr_workouts = {x.workout_id for x in lift_history(await _sets(session, user_id)) if x.pr}
    template_ids = {w.template_id for w in workouts if w.template_id}
    names = {}
    if template_ids:
        names = dict(
            (
                await session.execute(
                    select(WorkoutTemplate.id, WorkoutTemplate.name).where(WorkoutTemplate.id.in_(template_ids))
                )
            ).all()
        )
    out = []
    for w in workouts:
        sets = by_workout.get(w.id, [])
        volume = sum(float(x.load_kg) * x.reps for x in sets if not x.is_warmup)
        out.append(
            s.Workout.model_validate(w).model_copy(
                update={
                    "split": names.get(w.template_id) if w.template_id else None,
                    "sets": [set_out(x) for x in sets],
                    "volume_kg": round(volume, 1),
                    "pr": w.id in pr_workouts,
                }
            )
        )
    return out


async def exercise_stats(session: AsyncSession, user_id: uuid.UUID, today: date) -> dict[uuid.UUID, dict]:
    """sessions_8w and best_e1rm_kg over the last 8 Monday-weeks; last_done over all time."""
    since = window_start(today, 8)
    stats: dict[uuid.UUID, dict] = defaultdict(lambda: {"sessions": set(), "best": None, "last": None})
    for r in await _sets(session, user_id):
        st = stats[r.exercise.id]
        st["last"] = max(st["last"] or r.local_date, r.local_date)
        if r.local_date < since:
            continue
        st["sessions"].add(r.workout_id)
        value = None if r.set.is_warmup else e1rm(r.set.load_kg, r.set.reps)
        if value is not None and (st["best"] is None or value > st["best"]):
            st["best"] = value
    return {
        k: {"sessions_8w": len(v["sessions"]), "best_e1rm_kg": v["best"], "last_done": v["last"]}
        for k, v in stats.items()
    }


async def active_plan(session: AsyncSession, user_id: uuid.UUID) -> TrainingPlan | None:
    return (
        await session.execute(
            select(TrainingPlan).where(
                TrainingPlan.user_id == user_id, TrainingPlan.active.is_(True), TrainingPlan.deleted_at.is_(None)
            )
        )
    ).scalar_one_or_none()


async def progression(session: AsyncSession, user_id: uuid.UUID, today: date, weeks: int) -> s.FitnessProgression:
    since = window_start(today, weeks)
    monday = today - timedelta(days=today.weekday())
    rows = await _sets(session, user_id)
    history = lift_history(rows)

    # Lifts and records (records: best value per tracked lift within the window).
    lifts: dict[str, list[s.LiftPoint]] = {}
    best: dict[str, LiftSession] = {}
    for x in history:
        if x.local_date < since:
            continue
        lifts.setdefault(x.lift, []).append(
            s.LiftPoint(date=x.local_date, e1rm_kg=x.e1rm, load_kg=float(x.set.load_kg), reps=x.set.reps, pr=x.pr)
        )
        if x.lift not in best or x.e1rm > best[x.lift].e1rm:
            best[x.lift] = x
    records = [
        s.PersonalRecord(
            exercise=b.exercise, e1rm_kg=b.e1rm, load_kg=float(b.set.load_kg), reps=b.set.reps, date=b.local_date
        )
        for b in sorted(best.values(), key=lambda b: -b.e1rm)
    ]

    # Weekly volume and frequency.
    workouts = list(
        (
            await session.execute(
                select(WorkoutSession).where(
                    WorkoutSession.user_id == user_id,
                    WorkoutSession.deleted_at.is_(None),
                    WorkoutSession.local_date >= since,
                )
            )
        ).scalars()
    )
    weekly = [
        {"week_start": since + timedelta(weeks=i), "sessions": 0, "volume_kg": 0.0, "sets_by_muscle": defaultdict(int)}
        for i in range(weeks)
    ]

    def week_of(d: date) -> dict | None:
        i = (d - since).days // 7
        return weekly[i] if 0 <= i < weeks else None

    for w in workouts:
        if wk := week_of(w.local_date):
            wk["sessions"] += 1
    for r in rows:
        wk = week_of(r.local_date)
        if wk is None or r.set.is_warmup:
            continue
        wk["volume_kg"] += float(r.set.load_kg) * r.set.reps
        wk["sets_by_muscle"][r.exercise.muscle_group] += 1

    # This week against the plan, and what comes next in the rotation.
    plan = await active_plan(session, user_id)
    first_by_day: dict[date, WorkoutSession] = {}
    for w in sorted(workouts, key=lambda w: w.started_at):
        first_by_day.setdefault(w.local_date, w)
    this_week = []
    for i in range(7):
        d = monday + timedelta(days=i)
        w = first_by_day.get(d)
        this_week.append(
            s.PlanDay(date=d, planned=bool(plan and (i + 1) in plan.weekdays), workout_id=w.id if w else None)
        )
    next_name = None
    if plan and plan.rotation:
        last = (
            await session.execute(
                select(WorkoutSession.template_id)
                .where(
                    WorkoutSession.user_id == user_id,
                    WorkoutSession.deleted_at.is_(None),
                    WorkoutSession.template_id.in_(plan.rotation),
                )
                .order_by(WorkoutSession.started_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        nxt = plan.rotation[(plan.rotation.index(last) + 1) % len(plan.rotation)] if last else plan.rotation[0]
        next_name = (
            await session.execute(select(WorkoutTemplate.name).where(WorkoutTemplate.id == nxt))
        ).scalar_one_or_none()

    return s.FitnessProgression(
        this_week=this_week,
        next_in_rotation=next_name,
        lifts=lifts,
        records=records,
        weekly=[
            s.WeekVolume(
                week_start=w["week_start"],
                sessions=w["sessions"],
                volume_kg=round(w["volume_kg"], 1),
                sets_by_muscle=dict(w["sets_by_muscle"]),
            )
            for w in weekly
        ],
    )


async def body_history(session: AsyncSession, user_id: uuid.UUID, since: date) -> list[BodyMeasurement]:
    return list(
        (
            await session.execute(
                select(BodyMeasurement)
                .where(
                    BodyMeasurement.user_id == user_id,
                    BodyMeasurement.deleted_at.is_(None),
                    BodyMeasurement.measured_on >= since,
                )
                .order_by(BodyMeasurement.measured_on, BodyMeasurement.created_at)
            )
        ).scalars()
    )
