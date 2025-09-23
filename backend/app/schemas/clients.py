from enum import Enum
from typing import List, Optional
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from .common import IdentifiedModel
from pydantic.class_validators import root_validator

from .projects import Milestone, Project, ProjectStatus, Task
from .financials import Currency, InvoiceStatus
from .support import TicketStatus


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


class ProjectSetup(BaseModel):
    name: str
    template_id: str = Field(..., alias="project_type")
    start_date: datetime
    manager_id: str
    budget: float
    currency: str = "USD"
    start_after_name: Optional[str] = Field(default=None, alias="start_after")

    class Config:
        allow_population_by_field_name = True


class ClientCreateRequest(BaseModel):
    organization_name: str
    industry: Industry
    segment: ClientSegment
    billing_email: EmailStr
    preferred_channel: InteractionChannel = InteractionChannel.EMAIL
    timezone: str = "UTC"
    contacts: List[Contact] = Field(default_factory=list)
    projects: List[ProjectSetup] = Field(default_factory=list)

    @root_validator(pre=True)
    def coerce_project_list(cls, values: dict) -> dict:
        single_project = values.pop("project", None)
        projects = values.get("projects")
        if single_project and projects:
            raise ValueError("Provide either 'project' or 'projects', not both")
        if single_project and not projects:
            values["projects"] = [single_project]
        if not values.get("projects"):
            raise ValueError("At least one project setup is required")
        return values


class ClientWithProjects(BaseModel):
    client: Client
    projects: List[Project]


class ClientProjectDigest(BaseModel):
    id: str
    code: str
    name: str
    project_type: str
    status: ProjectStatus
    start_date: datetime
    end_date: Optional[datetime] = None
    manager_id: str
    budget: Optional[float] = None
    currency: str = "USD"
    late_tasks: List[Task] = Field(default_factory=list)
    next_task: Optional[Task] = None
    next_milestone: Optional[Milestone] = None


class ClientInvoiceDigest(BaseModel):
    id: str
    number: str
    status: InvoiceStatus
    due_date: datetime
    total: float
    balance_due: float
    currency: Currency
    project_id: Optional[str] = None
    project_name: Optional[str] = None


class ClientPaymentDigest(BaseModel):
    id: str
    invoice_id: str
    invoice_number: Optional[str]
    amount: float
    received_at: datetime
    method: str


class ClientFinancialSnapshot(BaseModel):
    outstanding_invoices: List[ClientInvoiceDigest] = Field(default_factory=list)
    next_invoice_due: Optional[ClientInvoiceDigest] = None
    recent_payments: List[ClientPaymentDigest] = Field(default_factory=list)
    total_outstanding: float = 0.0


class ClientTicketDigest(BaseModel):
    id: str
    subject: str
    status: TicketStatus
    priority: str
    sla_due: Optional[datetime] = None
    last_activity_at: Optional[datetime] = None


class ClientSupportSnapshot(BaseModel):
    open_tickets: List[ClientTicketDigest] = Field(default_factory=list)
    last_ticket_update: Optional[datetime] = None


class ClientDashboard(BaseModel):
    client: Client
    projects: List[ClientProjectDigest] = Field(default_factory=list)
    financials: ClientFinancialSnapshot
    support: ClientSupportSnapshot
