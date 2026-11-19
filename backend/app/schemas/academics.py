"""Academics request/response models (names match docs/api/openapi.yaml components)."""

import uuid
from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field, model_validator

from app.schemas.common import Meta, Rating, Strict

Minutes = Annotated[int, Field(ge=1, le=600)]
Difficulty = Literal["easy", "medium", "hard"]
Area = Literal["dsa", "project", "course", "other"]
AssignmentStatus = Literal["not_started", "in_progress", "submitted", "graded"]


# ── subjects ──
class SubjectInput(Strict):
    name: Annotated[str, Field(min_length=1, max_length=120)]
    short_name: Annotated[str, Field(min_length=1, max_length=12)]
    credits: Annotated[int, Field(ge=0, le=30)] | None = None
    units_total: Annotated[int, Field(ge=0, le=100)] = 0
    units_done: Annotated[int, Field(ge=0, le=100)] = 0
    semester_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def _units(self) -> "SubjectInput":
        if self.units_done > self.units_total:
            raise ValueError("units_done can't exceed units_total")
        return self


class SubjectPatch(Strict):
    name: Annotated[str, Field(min_length=1, max_length=120)] | None = None
    short_name: Annotated[str, Field(min_length=1, max_length=12)] | None = None
    credits: Annotated[int, Field(ge=0, le=30)] | None = None
    units_total: Annotated[int, Field(ge=0, le=100)] | None = None
    units_done: Annotated[int, Field(ge=0, le=100)] | None = None
    semester_id: uuid.UUID | None = None


class Subject(Meta):
    name: str
    short_name: str
    credits: int | None
    units_total: int
    units_done: int
    semester_id: uuid.UUID | None
    hours_28d: float = 0
    sessions_28d: int = 0
    last_studied_at: datetime | None = None


# ── sessions ──
class StudySessionInput(Strict):
    id: uuid.UUID | None = None
    subject_id: uuid.UUID | None = None
    started_at: datetime
    minutes: Minutes
    planned_minutes: Minutes | None = None
    focus_rating: Rating | None = None
    note: Annotated[str, Field(max_length=2000)] | None = None


class StudySession(Meta):
    subject_id: uuid.UUID | None
    started_at: datetime
    minutes: int
    planned_minutes: int | None
    focus_rating: int | None
    note: str | None
    local_date: date


class DsaProblemInput(Strict):
    id: uuid.UUID | None = None
    coding_session_id: uuid.UUID | None = None
    difficulty: Difficulty
    topic: Annotated[str, Field(min_length=1, max_length=60)]
    title: Annotated[str, Field(max_length=200)] | None = None
    url: Annotated[str, Field(max_length=500, pattern=r"^https?://")] | None = None
    solved_at: datetime


class DsaProblem(Meta):
    coding_session_id: uuid.UUID | None
    difficulty: Difficulty
    topic: str
    title: str | None
    url: str | None
    solved_at: datetime
    local_date: date


class CodingSessionInput(Strict):
    id: uuid.UUID | None = None
    area: Area
    started_at: datetime
    minutes: Minutes
    planned_minutes: Minutes | None = None
    focus_rating: Rating | None = None
    problems: Annotated[list[DsaProblemInput], Field(max_length=20)] = []


class CodingSession(Meta):
    area: Area
    started_at: datetime
    minutes: int
    planned_minutes: int | None
    focus_rating: int | None
    local_date: date
    problems: list[DsaProblem] = []


# ── assignments ──
class AssignmentInput(Strict):
    subject_id: uuid.UUID
    title: Annotated[str, Field(min_length=1, max_length=200)]
    due_at: datetime
    status: AssignmentStatus = "not_started"
    grade_score: Annotated[float, Field(ge=0)] | None = None
    grade_max: Annotated[float, Field(gt=0)] | None = None

    @model_validator(mode="after")
    def _grade(self) -> "AssignmentInput":
        if (self.grade_score is None) != (self.grade_max is None):
            raise ValueError("grade_score and grade_max go together")
        if self.grade_score is not None and self.grade_max is not None and self.grade_score > self.grade_max:
            raise ValueError("grade_score can't exceed grade_max")
        return self


class Assignment(Meta):
    subject_id: uuid.UUID
    title: str
    due_at: datetime
    status: AssignmentStatus
    grade_score: float | None
    grade_max: float | None


# ── milestones (learning, assessment → learning_milestones; project → coding_milestones) ──
class MilestoneInput(Strict):
    kind: Literal["learning", "assessment", "project"]
    title: Annotated[str, Field(min_length=1, max_length=200)]
    subject_id: uuid.UUID | None = None
    project: Annotated[str, Field(max_length=120)] | None = None
    planned_for: date | None = None
    completed_at: datetime | None = None
    score: Annotated[float, Field(ge=0)] | None = None
    max_score: Annotated[float, Field(gt=0)] | None = None

    @model_validator(mode="after")
    def _shape(self) -> "MilestoneInput":
        if self.kind == "project" and not self.project:
            raise ValueError("project milestones need a project name")
        if self.kind != "project" and self.project:
            raise ValueError("project is only for project milestones")
        if (self.score is None) != (self.max_score is None):
            raise ValueError("score and max_score go together")
        if self.score is not None and self.max_score is not None and self.score > self.max_score:
            raise ValueError("score can't exceed max_score")
        if self.kind == "project" and self.score is not None:
            raise ValueError("project milestones have no score")
        return self


class MilestonePatch(Strict):
    title: Annotated[str, Field(min_length=1, max_length=200)] | None = None
    planned_for: date | None = None
    completed_at: datetime | None = None
    score: Annotated[float, Field(ge=0)] | None = None
    max_score: Annotated[float, Field(gt=0)] | None = None


class Milestone(BaseModel):
    id: uuid.UUID
    version: int
    created_at: datetime
    updated_at: datetime
    kind: Literal["learning", "assessment", "project"]
    title: str
    subject_id: uuid.UUID | None = None
    project: str | None = None
    planned_for: date | None
    completed_at: datetime | None
    score: float | None = None
    max_score: float | None = None


# ── semesters ──
class SemesterInput(Strict):
    label: Annotated[str, Field(min_length=1, max_length=40)]
    ordinal: Annotated[int, Field(ge=1, le=20)]
    credits: Annotated[int, Field(ge=0, le=60)] | None = None
    sgpa: Annotated[float, Field(ge=0, le=10)] | None = None
    is_current: bool = False


class SemesterPatch(Strict):
    label: Annotated[str, Field(min_length=1, max_length=40)] | None = None
    credits: Annotated[int, Field(ge=0, le=60)] | None = None
    sgpa: Annotated[float, Field(ge=0, le=10)] | None = None
    is_current: bool | None = None


class Semester(Meta):
    label: str
    ordinal: int
    credits: int | None
    sgpa: float | None
    is_current: bool


class SemesterList(BaseModel):
    semesters: list[Semester]
    cgpa: float | None


# ── summary ──
class FocusSession(BaseModel):
    id: uuid.UUID
    kind: Literal["study", "coding"]
    start: datetime
    minutes: int
    label: str


class TopicCount(BaseModel):
    topic: str
    solved: int


class WeekCount(BaseModel):
    week_start: date
    count: int


class DsaSummary(BaseModel):
    lifetime: int
    window: int
    by_difficulty: dict[str, int]
    by_topic: list[TopicCount]
    weekly: list[WeekCount]


class AcademicsSummary(BaseModel):
    study_hours_14d: float
    prev_study_hours_14d: float
    coding_hours_14d: float
    prev_coding_hours_14d: float
    subjects: list[Subject]
    sessions_7d: list[FocusSession]
    dsa: DsaSummary
    next_deadline: Assignment | None
