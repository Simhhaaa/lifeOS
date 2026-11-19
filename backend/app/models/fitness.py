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
    PrimaryKeyConstraint,
    SmallInteger,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, StdMixin


class Exercise(StdMixin, Base):
    __tablename__ = "exercises"
    __extra_args__ = (
        CheckConstraint(
            "muscle_group IN ('chest','back','legs','shoulders','arms','core','full_body')", name="muscle_group"
        ),
        CheckConstraint(
            "tracked_lift IS NULL OR tracked_lift IN ('bench','squat','deadlift','ohp')", name="tracked_lift"
        ),
        Index(
            "uq_exercises_user_name",
            "user_id",
            text("lower(name)"),
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    muscle_group: Mapped[str] = mapped_column(Text, nullable=False)
    equipment: Mapped[str | None] = mapped_column(Text)
    tracked_lift: Mapped[str | None] = mapped_column(Text)


class WorkoutTemplate(StdMixin, Base):
    __tablename__ = "workout_templates"
    name: Mapped[str] = mapped_column(Text, nullable=False)


class WorkoutTemplateExercise(Base):
    __tablename__ = "workout_template_exercises"
    __table_args__ = (PrimaryKeyConstraint("template_id", "position"),)
    template_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workout_templates.id", ondelete="CASCADE")
    )
    position: Mapped[int] = mapped_column(SmallInteger)
    exercise_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("exercises.id"), nullable=False)
    target_sets: Mapped[int | None] = mapped_column(SmallInteger)
    target_reps: Mapped[int | None] = mapped_column(SmallInteger)


class TrainingPlan(StdMixin, Base):
    __tablename__ = "training_plans"
    __extra_args__ = (
        CheckConstraint("weekdays <@ ARRAY[1,2,3,4,5,6,7]::smallint[]", name="weekdays_range"),
        Index(
            "uq_training_plans_one_active",
            "user_id",
            unique=True,
            postgresql_where=text("active AND deleted_at IS NULL"),
        ),
    )
    weekdays: Mapped[list[int]] = mapped_column(ARRAY(SmallInteger), nullable=False)
    rotation: Mapped[list[uuid.UUID]] = mapped_column(ARRAY(UUID(as_uuid=True)), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, server_default=text("true"), nullable=False)


class WorkoutSession(StdMixin, Base):
    __tablename__ = "workout_sessions"
    __extra_args__ = (
        CheckConstraint("ended_at IS NULL OR ended_at >= started_at", name="ended_after_start"),
        Index("ix_workout_sessions_user_local_date", "user_id", "local_date"),
    )
    template_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("workout_templates.id"))
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    local_date: Mapped[date] = mapped_column(Date, nullable=False)
    note: Mapped[str | None] = mapped_column(Text)


class ExerciseSet(StdMixin, Base):
    __tablename__ = "exercise_sets"
    __extra_args__ = (
        CheckConstraint("load_kg BETWEEN 0 AND 600", name="load_range"),
        CheckConstraint("reps BETWEEN 1 AND 100", name="reps_range"),
        CheckConstraint("rpe IS NULL OR rpe BETWEEN 5 AND 10", name="rpe_range"),
        UniqueConstraint("workout_session_id", "position"),
    )
    workout_session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workout_sessions.id", ondelete="CASCADE"), nullable=False
    )
    exercise_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("exercises.id"), nullable=False)
    position: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    load_kg: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False)
    reps: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    rpe: Mapped[float | None] = mapped_column(Numeric(3, 1))
    is_warmup: Mapped[bool] = mapped_column(Boolean, server_default=text("false"), nullable=False)
    is_top_set: Mapped[bool] = mapped_column(Boolean, server_default=text("false"), nullable=False)


class BodyMeasurement(StdMixin, Base):
    __tablename__ = "body_measurements"
    __extra_args__ = (
        CheckConstraint("weight_kg IS NULL OR weight_kg BETWEEN 20 AND 400", name="weight_range"),
        CheckConstraint("waist_cm IS NULL OR waist_cm BETWEEN 30 AND 250", name="waist_range"),
        CheckConstraint("weight_kg IS NOT NULL OR waist_cm IS NOT NULL", name="one_value"),
    )
    measured_on: Mapped[date] = mapped_column(Date, nullable=False)
    weight_kg: Mapped[float | None] = mapped_column(Numeric(5, 2))
    waist_cm: Mapped[float | None] = mapped_column(Numeric(5, 1))


class ProgressPhoto(StdMixin, Base):
    __tablename__ = "progress_photos"
    __extra_args__ = (
        CheckConstraint("content_type IN ('image/jpeg','image/png','image/heic')", name="content_type"),
        CheckConstraint("bytes BETWEEN 1 AND 15728640", name="bytes_range"),
        CheckConstraint("upload_state IN ('pending','stored')", name="upload_state"),
    )
    taken_on: Mapped[date] = mapped_column(Date, nullable=False)
    object_key: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    content_type: Mapped[str] = mapped_column(Text, nullable=False)
    bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    upload_state: Mapped[str] = mapped_column(Text, server_default="pending", nullable=False)


class CardioSession(StdMixin, Base):
    __tablename__ = "cardio_sessions"
    __extra_args__ = (
        CheckConstraint("kind IN ('run','walk','cycle','other')", name="kind"),
        CheckConstraint("distance_km BETWEEN 0 AND 300", name="distance_range"),
        CheckConstraint("duration_s BETWEEN 1 AND 86400", name="duration_range"),
        CheckConstraint("source IN ('manual','import')", name="source"),
        Index("ix_cardio_sessions_user_local_date", "user_id", "local_date"),
    )
    kind: Mapped[str] = mapped_column(Text, nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    local_date: Mapped[date] = mapped_column(Date, nullable=False)
    distance_km: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False)
    duration_s: Mapped[int] = mapped_column(Integer, nullable=False)
    source: Mapped[str] = mapped_column(Text, server_default="manual", nullable=False)
