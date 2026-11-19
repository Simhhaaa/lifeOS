import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field


class Strict(BaseModel):
    """Request models reject unknown fields, so clients can't sneak in XP, levels or scores."""

    model_config = ConfigDict(extra="forbid")


class Meta(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    version: int
    created_at: datetime
    updated_at: datetime


Rating = Annotated[int, Field(ge=1, le=5)]
