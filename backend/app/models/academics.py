import uuid
from datetime import date, datetime

from sqlalchemy import (
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
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, StdMixin


class Semester(StdMixin, Base):
    __tablename__ = "semesters"
    __extra_args__ = (
        CheckConstraint("sgpa IS NULL OR sgpa BETWEEN 0 AND 10", name="sgpa_range"),
        Index(
            "uq_semesters_user_ordinal", "user_id", "ordinal", unique=True, postgresql_where=text("deleted_at IS NULL")
        ),
    )
    label: Mapped[str] = mapped_column(Text, nullable=False)
    ordinal: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    credits: Mapped[int | None] = mapped_column(SmallInteger)
    sgpa: Mapped[float | None] = mapped_column(Numeric(4, 2))
    is_current: Mapped[bool] = mapped_column(Boolean, server_default=text("false"), nullable=False)


class Subject(StdMixin, Base):
    __tablename__ = "subjects"
    __extra_args__ = (
        CheckConstraint("credits IS NULL OR credits BETWEEN 0 AND 30", name="credits_range"),
        CheckConstraint("units_total >= 0 AND units_done BETWEEN 0 AND units_total", name="units_range"),
        Index(
            "uq_subjects_user_short_name",
            "user_id",
            "short_name",
            unique=True,
            postgresql_where=text("deleted_at IS NULL AND NOT archived"),
        ),
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    short_name: Mapped[str] = mapped_column(Text, nullable=False)
    credits: Mapped[int | None] = mapped_column(SmallInteger)
    units_total: Mapped[int] = mapped_column(SmallInteger, server_default=text("0"), nullable=False)
    units_done: Mapped[int] = mapped_column(SmallInteger, server_default=text("0"), nullable=False)
    semester_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("semesters.id"))
    archived: Mapped[bool] = mapped_column(Boolean, server_default=text("false"), nullable=False)


class _FocusSession:
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    planned_minutes: Mapped[int | None] = mapped_column(Integer)
    focus_rating: Mapped[int | None] = mapped_column(SmallInteger)
    local_date: Mapped[date] = mapped_column(Date, nullable=False)
    note: Mapped[str | None] = mapped_column(Text)


def _focus_checks(table: str) -> tuple:
    return (
        CheckConstraint("minutes BETWEEN 1 AND 600", name="minutes_range"),
        CheckConstraint("planned_minutes IS NULL OR planned_minutes BETWEEN 1 AND 600", name="planned_range"),
        CheckConstraint("focus_rating IS NULL OR focus_rating BETWEEN 1 AND 5", name="focus_rating_range"),
        CheckConstraint("note IS NULL OR length(note) <= 2000", name="note_length"),
        Index(f"ix_{table}_user_local_date", "user_id", "local_date"),
    )


class StudySession(StdMixin, _FocusSession, Base):
    __tablename__ = "study_sessions"
    __extra_args__ = _focus_checks("study_sessions")
    subject_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("subjects.id"))


class CodingSession(StdMixin, _FocusSession, Base):
    __tablename__ = "coding_sessions"
    __extra_args__ = (
        *_focus_checks("coding_sessions"),
        CheckConstraint("area IN ('dsa','project','course','other')", name="area"),
    )
    area: Mapped[str] = mapped_column(Text, nullable=False)


class DsaProblem(StdMixin, Base):
    __tablename__ = "dsa_problems"
    __extra_args__ = (
        CheckConstraint("difficulty IN ('easy','medium','hard')", name="difficulty"),
        Index(
            "uq_dsa_problems_user_url",
            "user_id",
            "url",
            unique=True,
            postgresql_where=text("url IS NOT NULL AND deleted_at IS NULL"),
        ),
        Index("ix_dsa_problems_user_local_date", "user_id", "local_date"),
    )
    coding_session_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("coding_sessions.id"))
    solved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    local_date: Mapped[date] = mapped_column(Date, nullable=False)
    difficulty: Mapped[str] = mapped_column(Text, nullable=False)
    topic: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str | None] = mapped_column(Text)
    url: Mapped[str | None] = mapped_column(Text)


class CodingMilestone(StdMixin, Base):
    __tablename__ = "coding_milestones"
    project: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    skill_key: Mapped[str] = mapped_column(Text, server_default="backend_development", nullable=False)
    planned_for: Mapped[date | None] = mapped_column(Date)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    evidence_url: Mapped[str | None] = mapped_column(Text)


class LearningMilestone(StdMixin, Base):
    __tablename__ = "learning_milestones"
    __extra_args__ = (
        CheckConstraint("kind IN ('learning','assessment')", name="kind"),
        CheckConstraint(
            "(score IS NULL) = (max_score IS NULL) AND (score IS NULL OR (score >= 0 AND score <= max_score))",
            name="score_pair",
        ),
    )
    subject_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("subjects.id"))
    kind: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    planned_for: Mapped[date | None] = mapped_column(Date)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    score: Mapped[float | None] = mapped_column(Numeric)
    max_score: Mapped[float | None] = mapped_column(Numeric)


class Assignment(StdMixin, Base):
    __tablename__ = "assignments"
    __extra_args__ = (
        CheckConstraint("status IN ('not_started','in_progress','submitted','graded')", name="status"),
        Index("ix_assignments_user_due", "user_id", "due_at", postgresql_where=text("deleted_at IS NULL")),
    )
    subject_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("subjects.id"), nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(Text, server_default="not_started", nullable=False)
    grade_score: Mapped[float | None] = mapped_column(Numeric)
    grade_max: Mapped[float | None] = mapped_column(Numeric)
