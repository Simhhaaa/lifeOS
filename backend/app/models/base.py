"""Declarative base and the standard columns of every owned, synced table (docs/database.md §1)."""

import uuid
from datetime import date, datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Index, Integer, MetaData, Sequence, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, declared_attr, mapped_column

NAMING = {
    "ix": "ix_%(table_name)s_%(column_0_N_name)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}

CHANGE_SEQ = Sequence("change_seq", metadata=MetaData(naming_convention=NAMING))


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING)


# Tables that get the change_seq/updated_at trigger (filled by StdMixin subclasses).
SYNCED_TABLES: list[str] = []


class StdMixin:
    """id · user_id · created_at · updated_at · version · deleted_at · change_seq."""

    def __init_subclass__(cls, **kw: object) -> None:
        super().__init_subclass__(**kw)
        name = getattr(cls, "__tablename__", None)
        if name and name not in SYNCED_TABLES:
            SYNCED_TABLES.append(name)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )

    @declared_attr
    def user_id(cls) -> Mapped[uuid.UUID]:  # noqa: N805
        return mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    version: Mapped[int] = mapped_column(Integer, server_default=text("1"), nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    change_seq: Mapped[int] = mapped_column(BigInteger, server_default=text("nextval('change_seq')"), nullable=False)

    @declared_attr.directive
    def __table_args__(cls) -> tuple:  # noqa: N805
        extra = getattr(cls, "__extra_args__", ())
        return (Index(f"ix_{cls.__tablename__}_user_change_seq", "user_id", "change_seq"), *extra)


LocalDate = date
