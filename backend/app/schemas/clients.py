from enum import Enum
from typing import List, Optional
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from .common import IdentifiedModel


class Industry(str, Enum):
    HOSPITALITY = "hospitality"
    CREATIVE = "creative"
    TECHNOLOGY = "technology"
    OTHER = "other"


class Contact(IdentifiedModel):
    first_name: str
    last_name: str
    email: EmailStr
    phone: Optional[str] = None
    title: Optional[str] = None


class InteractionChannel(str, Enum):
    EMAIL = "email"
    PORTAL = "portal"
    SOCIAL = "social"
    PHONE = "phone"


class Interaction(IdentifiedModel):
    channel: InteractionChannel
    subject: str
    summary: str
    occurred_at: datetime
    owner_id: Optional[str] = None


class ClientSegment(str, Enum):
    RETAINER = "retainer"
    PROJECT = "project"
    VIP = "vip"
    PROSPECT = "prospect"


class Document(IdentifiedModel):
    name: str
    url: str
    version: str = "1.0"
    uploaded_by: str
    signed: bool = False


class Client(IdentifiedModel):
    organization_name: str
    industry: Industry
    segment: ClientSegment
    billing_email: EmailStr
    preferred_channel: InteractionChannel = InteractionChannel.EMAIL
    timezone: str = "UTC"
    contacts: List[Contact] = Field(default_factory=list)
    interactions: List[Interaction] = Field(default_factory=list)
    documents: List[Document] = Field(default_factory=list)


class ClientSummary(BaseModel):
    total_clients: int
    by_segment: dict
    active_portal_users: int
