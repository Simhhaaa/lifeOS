"""Fitness request/response models (names match docs/api/openapi.yaml components)."""

import uuid
from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.common import Meta, Strict

MuscleGroup = Literal["chest", "back", "legs", "shoulders", "arms", "core", "full_body"]
TrackedLift = Literal["bench", "squat", "deadlift", "ohp"]


# ── exercises ──
class ExerciseInput(Strict):
    name: Annotated[str, Field(min_length=1, max_length=80)]
    muscle_group: MuscleGroup
    equipment: Annotated[str, Field(max_length=40)] | None = None
    tracked_lift: TrackedLift | None = None


class ExercisePatch(Strict):
    name: Annotated[str, Field(min_length=1, max_length=80)] | None = None
    muscle_group: MuscleGroup | None = None
    equipment: Annotated[str, Field(max_length=40)] | None = None
    tracked_lift: TrackedLift | None = None


class Exercise(Meta):
    name: str
    muscle_group: MuscleGroup
    equipment: str | None
    tracked_lift: TrackedLift | None
    sessions_8w: int = 0
    best_e1rm_kg: float | None = None
    last_done: date | None = None


# ── workouts and sets ──
class ExerciseSetInput(Strict):
    id: uuid.UUID | None = None
    exercise_id: uuid.UUID
    position: Annotated[int, Field(ge=1, le=200)]
    load_kg: Annotated[float, Field(ge=0, le=600, multiple_of=0.25)]
    reps: Annotated[int, Field(ge=1, le=100)]
    rpe: Annotated[float, Field(ge=5, le=10, multiple_of=0.5)] | None = None
    is_warmup: bool = False
    is_top_set: bool = False


class ExerciseSet(Meta):
    exercise_id: uuid.UUID
    position: int
    load_kg: float
    reps: int
    rpe: float | None
    is_warmup: bool
    is_top_set: bool
    e1rm_kg: float | None = None


class WorkoutInput(Strict):
    id: uuid.UUID | None = None
    template_id: uuid.UUID | None = None
    started_at: datetime
    ended_at: datetime | None = None
    note: Annotated[str, Field(max_length=2000)] | None = None
    sets: Annotated[list[ExerciseSetInput], Field(max_length=200)] = []

    @model_validator(mode="after")
    def _check(self) -> "WorkoutInput":
        if self.ended_at is not None and self.ended_at < self.started_at:
            raise ValueError("ended_at can't be before started_at")
        positions = [x.position for x in self.sets]
        if len(positions) != len(set(positions)):
            raise ValueError("set positions must be unique")
        return self


class FinishWorkoutInput(Strict):
    ended_at: datetime | None = None


class Workout(Meta):
    template_id: uuid.UUID | None
    split: str | None = None
    started_at: datetime
    ended_at: datetime | None
    local_date: date
    note: str | None
    sets: list[ExerciseSet] = []
    volume_kg: float = 0
    pr: bool = False


# ── templates (splits) and the training plan ──
class TemplateExerciseInput(Strict):
    exercise_id: uuid.UUID
    target_sets: Annotated[int, Field(ge=1, le=20)] | None = None
    target_reps: Annotated[int, Field(ge=1, le=100)] | None = None


class WorkoutTemplateInput(Strict):
    name: Annotated[str, Field(min_length=1, max_length=40)]
    exercises: Annotated[list[TemplateExerciseInput], Field(max_length=30)] = []


class TemplateExercise(BaseModel):
    exercise_id: uuid.UUID
    position: int
    target_sets: int | None
    target_reps: int | None


class WorkoutTemplate(Meta):
    name: str
    exercises: list[TemplateExercise] = []


class TrainingPlanInput(Strict):
    weekdays: Annotated[list[Annotated[int, Field(ge=1, le=7)]], Field(max_length=7)]
    rotation: Annotated[list[uuid.UUID], Field(min_length=1, max_length=7)]

    @field_validator("weekdays")
    @classmethod
    def _unique_days(cls, v: list[int]) -> list[int]:
        if len(v) != len(set(v)):
            raise ValueError("weekdays must be unique")
        return sorted(v)


class TrainingPlan(Meta):
    weekdays: list[int]
    rotation: list[uuid.UUID]
    active: bool


# ── body ──
class BodyMeasurementInput(Strict):
    measured_on: date
    weight_kg: Annotated[float, Field(ge=20, le=400)] | None = None
    waist_cm: Annotated[float, Field(ge=30, le=250)] | None = None

    @model_validator(mode="after")
    def _one(self) -> "BodyMeasurementInput":
        if self.weight_kg is None and self.waist_cm is None:
            raise ValueError("give weight_kg or waist_cm")
        return self


class BodyMeasurement(Meta):
    measured_on: date
    weight_kg: float | None
    waist_cm: float | None


# ── progression read model ──
class PlanDay(BaseModel):
    date: date
    planned: bool
    workout_id: uuid.UUID | None


class LiftPoint(BaseModel):
    date: date
    e1rm_kg: float
    load_kg: float
    reps: int
    pr: bool


class PersonalRecord(BaseModel):
    exercise: str
    e1rm_kg: float
    load_kg: float
    reps: int
    date: date


class WeekVolume(BaseModel):
    week_start: date
    sessions: int
    volume_kg: float
    sets_by_muscle: dict[str, int]


class FitnessProgression(BaseModel):
    this_week: list[PlanDay]
    next_in_rotation: str | None
    lifts: dict[str, list[LiftPoint]]
    records: list[PersonalRecord]
    weekly: list[WeekVolume]
