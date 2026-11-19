"""Health & recovery and productivity tables."""

import uuid
from datetime import date, datetime

from sqlalchemy import (
    ARRAY,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, StdMixin


class DailyLog(StdMixin, Base):
    """The daily check-in: one per owner-local day."""

    __tablename__ = "daily_logs"
    __extra_args__ = (
        CheckConstraint("sleep_hours IS NULL OR sleep_hours BETWEEN 0 AND 16", name="sleep_range"),
        *(
            CheckConstraint(f"{c} IS NULL OR {c} BETWEEN 1 AND 5", name=f"{c}_range")
            for c in ("sleep_quality", "energy", "recovery", "mood")
        ),
        Index(
            "uq_daily_logs_user_date", "user_id", "local_date", unique=True, postgresql_where=text("deleted_at IS NULL")
        ),
    )
    local_date: Mapped[date] = mapped_column(Date, nullable=False)
    sleep_hours: Mapped[float | None] = mapped_column(Numeric(4, 2))
    sleep_quality: Mapped[int | None] = mapped_column(SmallInteger)
    energy: Mapped[int | None] = mapped_column(SmallInteger)
    recovery: Mapped[int | None] = mapped_column(SmallInteger)
    mood: Mapped[int | None] = mapped_column(SmallInteger)


class HealthRecord(StdMixin, Base):
    __tablename__ = "health_records"
    __extra_args__ = (
        CheckConstraint("metric IN ('steps','resting_hr','hydration_l')", name="metric"),
        CheckConstraint(
            "(metric = 'steps' AND value BETWEEN 0 AND 100000) OR (metric = 'resting_hr' AND value BETWEEN 25 AND 220)"
            " OR (metric = 'hydration_l' AND value BETWEEN 0 AND 15)",
            name="value_bounds",
        ),
        CheckConstraint("source IN ('manual','import')", name="source"),
        UniqueConstraint("user_id", "metric", "local_date", "source"),
    )
    metric: Mapped[str] = mapped_column(Text, nullable=False)
    local_date: Mapped[date] = mapped_column(Date, nullable=False)
    value: Mapped[float] = mapped_column(Numeric, nullable=False)
    source: Mapped[str] = mapped_column(Text, server_default="manual", nullable=False)
    source_ref: Mapped[str | None] = mapped_column(Text)


class Task(StdMixin, Base):
    __tablename__ = "tasks"
    __extra_args__ = (
        CheckConstraint("length(title) BETWEEN 1 AND 200", name="title_length"),
        CheckConstraint("notes IS NULL OR length(notes) <= 2000", name="notes_length"),
        CheckConstraint(
            "module IS NULL OR module IN ('academics','fitness','health','productivity','skills','goals')",
            name="module",
        ),
        CheckConstraint("priority IN ('high','normal','low')", name="priority"),
        Index("ix_tasks_user_planned_for", "user_id", "planned_for", postgresql_where=text("deleted_at IS NULL")),
    )
    title: Mapped[str] = mapped_column(Text, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    module: Mapped[str | None] = mapped_column(Text)
    priority: Mapped[str] = mapped_column(Text, server_default="normal", nullable=False)
    planned_for: Mapped[date | None] = mapped_column(Date)
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    assignment_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("assignments.id"))


class Habit(StdMixin, Base):
    __tablename__ = "habits"
    __extra_args__ = (CheckConstraint("schedule <@ ARRAY[1,2,3,4,5,6,7]::smallint[]", name="schedule_range"),)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    schedule: Mapped[list[int]] = mapped_column(
        ARRAY(SmallInteger), server_default=text("'{1,2,3,4,5,6,7}'"), nullable=False
    )
    active: Mapped[bool] = mapped_column(Boolean, server_default=text("true"), nullable=False)


class HabitLog(StdMixin, Base):
    __tablename__ = "habit_logs"
    __extra_args__ = (UniqueConstraint("habit_id", "local_date"),)
    habit_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("habits.id", ondelete="CASCADE"), nullable=False
    )
    local_date: Mapped[date] = mapped_column(Date, nullable=False)
    done: Mapped[bool] = mapped_column(Boolean, nullable=False)


class ScreenTimeRecord(StdMixin, Base):
    __tablename__ = "screen_time_records"
    __extra_args__ = (
        CheckConstraint("minutes BETWEEN 0 AND 1440", name="minutes_range"),
        CheckConstraint("source IN ('manual','import')", name="source"),
        UniqueConstraint("user_id", "local_date", "source"),
    )
    local_date: Mapped[date] = mapped_column(Date, nullable=False)
    minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    source: Mapped[str] = mapped_column(Text, server_default="manual", nullable=False)
