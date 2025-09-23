from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field

from .common import IdentifiedModel


class Channel(str, Enum):
    EMAIL = "email"
    PORTAL = "portal"
    CHAT = "chat"
    SOCIAL = "social"


class TicketStatus(str, Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CLOSED = "closed"


class Message(IdentifiedModel):
    author_id: Optional[str]
    body: str
    channel: Channel
    sent_at: datetime


class Ticket(IdentifiedModel):
    client_id: str
    subject: str
    status: TicketStatus = TicketStatus.OPEN
    priority: str = "medium"
    assignee_id: Optional[str] = None
    sla_due: Optional[datetime] = None
    messages: List[Message] = Field(default_factory=list)


class KnowledgeArticle(IdentifiedModel):
    title: str
    body: str
    tags: List[str] = Field(default_factory=list)
    published: bool = False


class SupportSummary(BaseModel):
    open_tickets: int
    breached_slas: int
    response_time_minutes: float
