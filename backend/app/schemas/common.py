from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
import uuid


def generate_uuid() -> str:
    return str(uuid.uuid4())


class TimestampedModel(BaseModel):
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    deleted_at: Optional[datetime] = None


class IdentifiedModel(TimestampedModel):
    id: str = Field(default_factory=generate_uuid)


class PaginatedResult(BaseModel):
    total: int
    items: list
