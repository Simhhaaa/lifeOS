"""Progression: events, versioned rules, the append-only XP ledger, goals, quests, achievements."""

import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    Numeric,
    PrimaryKeyConstraint,
    SmallInteger,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, StdMixin


def _uid() -> Mapped[uuid.UUID]:
    return mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)


class SkillProfile(StdMixin, Base):
    __tablename__ = "skill_profiles"
    __extra_args__ = (UniqueConstraint("user_id", "key"), CheckConstraint("lifetime_xp >= 0", name="xp_non_negative"))
    key: Mapped[str] = mapped_column(Text, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    lifetime_xp: Mapped[int] = mapped_column(BigInteger, server_default=text("0"), nullable=False)
    level: Mapped[int] = mapped_column(Integer, server_default=text("1"), nullable=False)


class ActivityEvent(Base):
    __tablename__ = "activity_events"
    __table_args__ = (
        UniqueConstraint("user_id", "type", "source_id"),
        Index("ix_activity_events_user_date", "user_id", "local_date"),
    )
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    user_id: Mapped[uuid.UUID] = _uid()
    type: Mapped[str] = mapped_column(Text, nullable=False)
    source_table: Mapped[str] = mapped_column(Text, nullable=False)
    source_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    local_date: Mapped[date] = mapped_column(Date, nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class XpRule(Base):
    __tablename__ = "xp_rules"
    __table_args__ = (
        PrimaryKeyConstraint("id", "version"),
        Index("uq_xp_rules_one_open_version", "id", unique=True, postgresql_where=text("valid_to IS NULL")),
    )
    id: Mapped[str] = mapped_column(Text)
    version: Mapped[int] = mapped_column(Integer)
    event_type: Mapped[str] = mapped_column(Text, nullable=False)
    skill_key: Mapped[str] = mapped_column(Text, nullable=False)
    params: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    valid_from: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    valid_to: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    description: Mapped[str] = mapped_column(Text, nullable=False)


class XpTransaction(Base):
    """Append-only. The app role gets no UPDATE/DELETE on this table (migration grants)."""

    __tablename__ = "xp_transactions"
    __table_args__ = (
        ForeignKeyConstraint(["rule_id", "rule_version"], ["xp_rules.id", "xp_rules.version"]),
        CheckConstraint("kind IN ('award','correction')", name="kind"),
        CheckConstraint("kind = 'correction' OR (event_id IS NOT NULL AND amount > 0)", name="award_shape"),
        Index(
            "uq_xp_transactions_event_rule", "event_id", "rule_id", unique=True, postgresql_where=text("kind = 'award'")
        ),
        Index("ix_xp_transactions_user_created", "user_id", text("created_at DESC")),
        Index("ix_xp_transactions_user_skill_created", "user_id", "skill_key", text("created_at DESC")),
    )
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    user_id: Mapped[uuid.UUID] = _uid()
    event_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("activity_events.id"))
    rule_id: Mapped[str | None] = mapped_column(Text)
    rule_version: Mapped[int | None] = mapped_column(Integer)
    skill_key: Mapped[str] = mapped_column(Text, nullable=False)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    kind: Mapped[str] = mapped_column(Text, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    cap_note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class PerformanceMetric(Base):
    __tablename__ = "performance_metrics"
    __table_args__ = (
        UniqueConstraint("user_id", "metric", "source_id"),
        Index("ix_performance_metrics_user_metric_date", "user_id", "metric", "local_date"),
    )
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    user_id: Mapped[uuid.UUID] = _uid()
    metric: Mapped[str] = mapped_column(Text, nullable=False)
    local_date: Mapped[date] = mapped_column(Date, nullable=False)
    value: Mapped[float] = mapped_column(Numeric, nullable=False)
    source_table: Mapped[str] = mapped_column(Text, nullable=False)
    source_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)


class AttributeSnapshot(Base):
    __tablename__ = "attribute_snapshots"
    __table_args__ = (
        PrimaryKeyConstraint("user_id", "local_date", "attribute"),
        CheckConstraint("score IS NULL OR score BETWEEN 0 AND 100", name="score_range"),
        CheckConstraint("coverage BETWEEN 0 AND 1", name="coverage_range"),
    )
    user_id: Mapped[uuid.UUID] = _uid()
    local_date: Mapped[date] = mapped_column(Date)
    attribute: Mapped[str] = mapped_column(Text)
    score: Mapped[int | None] = mapped_column(SmallInteger)
    coverage: Mapped[float] = mapped_column(Numeric(4, 3), nullable=False)
    signals: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)


class Goal(StdMixin, Base):
    __tablename__ = "goals"
    __extra_args__ = (
        CheckConstraint("start_value <> target_value", name="start_not_target"),
        CheckConstraint("status IN ('active','completed','abandoned')", name="status"),
    )
    title: Mapped[str] = mapped_column(Text, nullable=False)
    metric: Mapped[str] = mapped_column(Text, nullable=False)
    start_value: Mapped[float] = mapped_column(Numeric, nullable=False)
    target_value: Mapped[float] = mapped_column(Numeric, nullable=False)
    unit: Mapped[str] = mapped_column(Text, nullable=False)
    due_on: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(Text, server_default="active", nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class GoalMilestone(StdMixin, Base):
    __tablename__ = "goal_milestones"
    __extra_args__ = (UniqueConstraint("goal_id", "value"),)
    goal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("goals.id", ondelete="CASCADE"), nullable=False
    )
    label: Mapped[str] = mapped_column(Text, nullable=False)
    value: Mapped[float] = mapped_column(Numeric, nullable=False)
    reached_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class GoalProgress(Base):
    __tablename__ = "goal_progress"
    __table_args__ = (Index("ix_goal_progress_goal_date", "goal_id", "local_date"),)
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    goal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("goals.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = _uid()
    local_date: Mapped[date] = mapped_column(Date, nullable=False)
    value: Mapped[float] = mapped_column(Numeric, nullable=False)
    source_table: Mapped[str] = mapped_column(Text, nullable=False)
    source_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)


class Quest(StdMixin, Base):
    __tablename__ = "quests"
    __extra_args__ = (
        CheckConstraint("period IN ('day','week')", name="period"),
        CheckConstraint("target > 0", name="target_positive"),
        CheckConstraint("origin IN ('manual','template','challenge')", name="origin"),
        Index("ix_quests_user_period", "user_id", "period", "period_start"),
    )
    period: Mapped[str] = mapped_column(Text, nullable=False)
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    metric: Mapped[str] = mapped_column(Text, nullable=False)
    target: Mapped[float] = mapped_column(Numeric, nullable=False)
    origin: Mapped[str] = mapped_column(Text, server_default="manual", nullable=False)
    challenge_basis: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Achievement(Base):
    __tablename__ = "achievements"
    key: Mapped[str] = mapped_column(Text, primary_key=True)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    criteria: Mapped[str] = mapped_column(Text, nullable=False)
    rule: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    rule_version: Mapped[int] = mapped_column(Integer, server_default=text("1"), nullable=False)


class AchievementUnlock(Base):
    __tablename__ = "achievement_unlocks"
    __table_args__ = (PrimaryKeyConstraint("user_id", "achievement_key"),)
    user_id: Mapped[uuid.UUID] = _uid()
    achievement_key: Mapped[str] = mapped_column(Text, ForeignKey("achievements.key"))
    unlocked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    evidence: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)


class InsightDismissal(Base):
    __tablename__ = "insight_dismissals"
    __table_args__ = (PrimaryKeyConstraint("user_id", "insight_key"),)
    user_id: Mapped[uuid.UUID] = _uid()
    insight_key: Mapped[str] = mapped_column(Text)
    dismissed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
