import uuid
from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import Meta, Rating, Strict

Module = Literal["academics", "fitness", "health", "productivity", "skills", "goals"]


class TaskInput(Strict):
    id: uuid.UUID | None = Field(default=None, description="Optional client-generated id (offline create)")
    title: Annotated[str, Field(min_length=1, max_length=200)]
    notes: Annotated[str, Field(max_length=2000)] | None = None
    module: Module | None = None
    priority: Literal["high", "normal", "low"] = "normal"
    planned_for: date | None = None
    due_at: datetime | None = None
    assignment_id: uuid.UUID | None = None


class TaskPatch(Strict):
    title: Annotated[str, Field(min_length=1, max_length=200)] | None = None
    notes: Annotated[str, Field(max_length=2000)] | None = None
    module: Module | None = None
    priority: Literal["high", "normal", "low"] | None = None
    planned_for: date | None = None
    due_at: datetime | None = None
    assignment_id: uuid.UUID | None = None
    completed_at: datetime | None = None


class Task(Meta):
    title: str
    notes: str | None
    module: Module | None
    priority: Literal["high", "normal", "low"]
    planned_for: date | None
    due_at: datetime | None
    assignment_id: uuid.UUID | None
    completed_at: datetime | None


class DailyLogInput(Strict):
    sleep_hours: Annotated[float, Field(ge=0, le=16, multiple_of=0.25)] | None = None
    sleep_quality: Rating | None = None
    energy: Rating | None = None
    recovery: Rating | None = None
    mood: Rating | None = None


class ReadinessResult(BaseModel):
    level: Literal["High", "Moderate", "Low"]
    points: int


class Readiness(BaseModel):
    local_date: date
    sleep_last_night_h: float | None
    energy: int | None
    recovery: int | None
    result: ReadinessResult | None


class DailyLog(Meta):
    model_config = ConfigDict(from_attributes=True)

    local_date: date
    sleep_hours: float | None
    sleep_quality: int | None
    energy: int | None
    recovery: int | None
    mood: int | None
    readiness: Readiness
