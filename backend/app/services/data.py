from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta
from uuid import uuid4
from typing import Dict, List, Sequence, Tuple

from ..schemas.clients import (
    Client,
    ClientCreateRequest,
    ClientDashboard,
    ClientEngagement,
    ClientFinancialSnapshot,
    ClientInvoiceDigest,
    ClientPaymentDigest,
    ClientProjectDigest,
    ClientSegment,
    ClientSummary,
    ClientSupportSnapshot,
    ClientTicketDigest,
    ClientUpdateRequest,
    ClientWithProjects,
    Contact,
    ContactUpdate,
    Document,
    DocumentUpdate,
    Industry,
    Interaction,
    InteractionChannel,
    InteractionUpdate,
)
from ..schemas.projects import (
    Milestone,
    MilestoneUpdate,
    Project,
    ProjectHealth,
    ProjectProgress,
    ProjectStatus,
    ProjectSummary,
    ProjectTemplateType,
    ProjectTracker,
    ProjectUpdateRequest,
    Sprint,
    SprintStatus,
    Task,
    TaskAlert,
    TaskAlertSeverity,
    TaskNotification,
    TaskNotificationType,
    TaskPriority,
    TaskStatus,
    TaskTimelineEntry,
    TaskType,
    TaskUpdate,
)
from ..schemas.automation import AutomationDigest
from ..schemas.financials import (
    Currency,
    DeductionOpportunity,
    Expense,
    FilingObligation,
    FinancialSummary,
    Invoice,
    InvoiceStatus,
    LineItem,
    MacroFinancials,
    Payment,
    PricingSuggestion,
    ProjectFinancials,
    TaxBusinessProfile,
    TaxComputationRequest,
    TaxComputationResponse,
    TaxEntry,
    TaxProfile,
)
from ..schemas.support import Channel, KnowledgeArticle, Message, SupportSummary, Ticket, TicketStatus
from ..schemas.hr import Employee, EmploymentType, ResourceCapacity, Skill, TimeOffRequest, TimeOffStatus
from ..schemas.marketing import (
    Campaign,
    Channel as MarketingChannel,
    ContentItem,
    ContentStatus,
    MarketingSummary,
    MetricSnapshot,
)
from ..schemas.monitoring import Alert, Check, MonitoringSummary, Site, SiteStatus
from ..schemas.operations import (
    CashRunway,
    CapacityAlert,
    MonitoringIncident,
    OperationsProject,
    OperationsRecommendation,
    OperationsSnapshot,
    TimeOffWindow,
)
from .project_templates import build_plan, project_code, template_library


PH_TAX_BRACKETS: Sequence[Dict[str, float]] = (
    {"min": 0.0, "max": 250_000.0, "base": 0.0, "rate": 0.0},
    {"min": 250_000.0, "max": 400_000.0, "base": 0.0, "rate": 0.2},
    {"min": 400_000.0, "max": 800_000.0, "base": 30_000.0, "rate": 0.25},
    {"min": 800_000.0, "max": 2_000_000.0, "base": 130_000.0, "rate": 0.3},
    {"min": 2_000_000.0, "max": 8_000_000.0, "base": 490_000.0, "rate": 0.32},
    {"min": 8_000_000.0, "max": float("inf"), "base": 2_410_000.0, "rate": 0.35},
)


class InMemoryStore:
    def __init__(self) -> None:
        now = datetime.utcnow()
        self.clients: Dict[str, Client] = {}
        self.projects: Dict[str, Project] = {}
        self.invoices: Dict[str, Invoice] = {}
        self.payments: Dict[str, Payment] = {}
        self.expenses: Dict[str, Expense] = {}
        self.tickets: Dict[str, Ticket] = {}
        self.articles: Dict[str, KnowledgeArticle] = {}
        self.employees: Dict[str, Employee] = {}
        self.time_off: Dict[str, TimeOffRequest] = {}
        self.campaigns: Dict[str, Campaign] = {}
        self.content_items: Dict[str, ContentItem] = {}
        self.metrics: Dict[str, MetricSnapshot] = {}
        self.sites: Dict[str, Site] = {}
        self.checks: Dict[str, Check] = {}
        self.alerts: Dict[str, Alert] = {}
        self.automation_digests: List[AutomationDigest] = []
        self.automation_broadcasts: List[str] = []
        self.task_notifications: List[TaskNotification] = []
        self.operating_expense_baselines: Dict[str, float] = {
            "Coworking membership": 96_000.0 / 12,
            "Software subscriptions": 84_000.0 / 12,
            "Marketing automation tools": 108_000.0 / 12,
        }
        self.statutory_contributions: Dict[str, float] = {
            "SSS": 24_000.0 / 12,
            "PhilHealth": 36_000.0 / 12,
            "Pag-IBIG": 18_000.0 / 12,
            "PERA": 48_000.0 / 12,
        }
        self.capacity_overrides: Dict[str, Tuple[float, float]] = {}
        self.tax_configuration: Dict[str, float | bool] = {
            "apply_percentage_tax": True,
            "percentage_tax_rate": 3.0,
            "vat_registered": False,
        }
        self._tax_profile_updated_at = now

        # Seed clients
        disenyorita_client = Client(
            organization_name="Sunset Boutique Hotel",
            industry=Industry.HOSPITALITY,
            segment=ClientSegment.RETAINER,
            billing_email="finance@sunsetboutique.example",
            preferred_channel=InteractionChannel.EMAIL,
            timezone="America/New_York",
            contacts=[
                Contact(first_name="Maya", last_name="Lopez", email="maya@sunsetboutique.example", title="GM"),
            ],
            interactions=[
                Interaction(
                    channel=InteractionChannel.EMAIL,
                    subject="Quarterly strategy sync",
                    summary="Aligned on Q2 priorities for guest experience upgrades.",
                    occurred_at=now - timedelta(days=5),
                )
            ],
            documents=[
                Document(
                    name="2024 Retainer",
                    url="https://files.example/retainer.pdf",
                    uploaded_by="system",
                    signed=True,
                    created_at=now - timedelta(days=320),
                    updated_at=now - timedelta(days=300),
                )
            ],
        )
        isla_client = Client(
            organization_name="Aurora Creative Studio",
            industry=Industry.CREATIVE,
            segment=ClientSegment.PROJECT,
            billing_email="ap@auroracreative.example",
            preferred_channel=InteractionChannel.PORTAL,
            timezone="Europe/Paris",
        )
        for client in (disenyorita_client, isla_client):
            self.clients[client.id] = client

        # Seed projects
        sprint_history = Sprint(
            name="Sprint 4 – Hospitality Foundations",
            status=SprintStatus.COMPLETED,
            start_date=now - timedelta(days=28),
            end_date=now - timedelta(days=14),
            committed_points=32,
            completed_points=30,
            velocity=30,
            focus_areas=["Booking flows", "Information architecture"],
        )
        active_sprint = Sprint(
            name="Sprint 5 – Guest Experience Upgrade",
            status=SprintStatus.ACTIVE,
            start_date=now - timedelta(days=7),
            end_date=now + timedelta(days=7),
            committed_points=36,
            completed_points=18,
            focus_areas=["Mobile booking", "Guest communications"],
        )
        upcoming_sprint = Sprint(
            name="Sprint 6 – Conversion Experiments",
            status=SprintStatus.PLANNING,
            start_date=now + timedelta(days=8),
            end_date=now + timedelta(days=22),
            committed_points=34,
            focus_areas=["Upsell flows", "Personalized offers"],
        )

        discovery_task = Task(
            name="Discovery Workshop",
            status=TaskStatus.DONE,
            logged_hours=6,
            start_date=now - timedelta(days=32),
            due_date=now - timedelta(days=27),
            story_points=5,
            priority=TaskPriority.HIGH,
            sprint_id=sprint_history.id,
        )
        architecture_task = Task(
            name="Information Architecture",
            status=TaskStatus.DONE,
            estimated_hours=16,
            logged_hours=14,
            start_date=now - timedelta(days=26),
            due_date=now - timedelta(days=20),
            story_points=5,
            priority=TaskPriority.HIGH,
            sprint_id=sprint_history.id,
            dependencies=[discovery_task.id],
        )
        ux_task = Task(
            name="UX Wireframes",
            status=TaskStatus.DONE,
            estimated_hours=30,
            logged_hours=12,
            start_date=now - timedelta(days=14),
            due_date=now - timedelta(days=1),
            story_points=8,
            priority=TaskPriority.HIGH,
            sprint_id=active_sprint.id,
            dependencies=[architecture_task.id],
        )
        integration_task = Task(
            name="Booking Engine Integration",
            status=TaskStatus.IN_PROGRESS,
            estimated_hours=28,
            logged_hours=10,
            start_date=now - timedelta(days=6),
            due_date=now + timedelta(days=4),
            story_points=8,
            priority=TaskPriority.CRITICAL,
            sprint_id=active_sprint.id,
            dependencies=[ux_task.id],
        )
        cms_task = Task(
            name="Hospitality CMS Enhancements",
            status=TaskStatus.TODO,
            estimated_hours=18,
            start_date=now - timedelta(days=2),
            due_date=now + timedelta(days=6),
            story_points=5,
            priority=TaskPriority.HIGH,
            sprint_id=active_sprint.id,
            dependencies=[integration_task.id],
        )
        accessibility_task = Task(
            name="Accessibility Review",
            status=TaskStatus.REVIEW,
            estimated_hours=10,
            logged_hours=6,
            start_date=now - timedelta(days=5),
            due_date=now - timedelta(days=1),
            story_points=3,
            priority=TaskPriority.HIGH,
            sprint_id=active_sprint.id,
            dependencies=[integration_task.id],
        )
        qa_task = Task(
            name="Regression QA",
            status=TaskStatus.TODO,
            estimated_hours=20,
            start_date=now + timedelta(days=1),
            due_date=now + timedelta(days=10),
            story_points=5,
            priority=TaskPriority.MEDIUM,
            sprint_id=upcoming_sprint.id,
            dependencies=[cms_task.id, accessibility_task.id],
        )
        experiment_task = Task(
            name="Personalized Offers Experiment",
            status=TaskStatus.TODO,
            estimated_hours=12,
            story_points=4,
            priority=TaskPriority.MEDIUM,
            sprint_id=upcoming_sprint.id,
            dependencies=[ux_task.id],
        )
        audit_task = Task(
            name="Operational Audit",
            status=TaskStatus.IN_PROGRESS,
            estimated_hours=40,
            logged_hours=18,
            start_date=now - timedelta(days=4),
            due_date=now + timedelta(days=3),
            story_points=10,
            priority=TaskPriority.HIGH,
        )
        website_project = Project(
            name="Sunset Boutique Website Refresh",
            code="DIS-WEB-2024-01",
            client_id=disenyorita_client.id,
            project_type=ProjectTemplateType.WEBSITE.value,
            status=ProjectStatus.IN_PROGRESS,
            start_date=now - timedelta(days=21),
            manager_id="user-1",
            budget=12000,
            milestones=[
                Milestone(title="Launch MVP", due_date=now + timedelta(days=14)),
            ],
            tasks=[
                discovery_task,
                architecture_task,
                ux_task,
                integration_task,
                cms_task,
                accessibility_task,
                qa_task,
                experiment_task,
            ],
            sprints=[sprint_history, active_sprint, upcoming_sprint],
            active_sprint_id=active_sprint.id,
        )
        audit_project = Project(
            name="Harborfront Hotel Audit",
            code="ISL-AUD-2024-02",
            client_id=disenyorita_client.id,
            project_type=ProjectTemplateType.CONSULTING.value,
            status=ProjectStatus.PLANNING,
            start_date=now - timedelta(days=7),
            manager_id="user-2",
            tasks=[audit_task],
        )
        for project in (website_project, audit_project):
            self.projects[project.id] = project

        # Financials
        invoice = Invoice(
            client_id=disenyorita_client.id,
            project_id=website_project.id,
            number="INV-2024-00045",
            status=InvoiceStatus.SENT,
            issue_date=now - timedelta(days=10),
            due_date=now + timedelta(days=20),
            items=[
                LineItem(description="Brand strategy sprint", quantity=1, unit_price=6200, total=6200),
                LineItem(description="E-commerce launch playbook", quantity=1, unit_price=3800, total=3800),
            ],
        )
        self.invoices[invoice.id] = invoice
        payment = Payment(invoice_id=invoice.id, amount=5000, received_at=now - timedelta(days=3), method="stripe")
        self.payments[payment.id] = payment
        expense = Expense(
            project_id=website_project.id,
            category="Marketplace fees",
            amount=320,
            incurred_at=now - timedelta(days=4),
        )
        self.expenses[expense.id] = expense

        retainer_invoice = Invoice(
            client_id=disenyorita_client.id,
            project_id=audit_project.id,
            number="INV-2024-00087",
            status=InvoiceStatus.PAID,
            issue_date=now - timedelta(days=32),
            due_date=now - timedelta(days=2),
            items=[
                LineItem(description="Brand refresh retainer", quantity=1, unit_price=5200, total=5200),
                LineItem(description="Quarterly campaign oversight", quantity=1, unit_price=1800, total=1800),
            ],
        )
        self.invoices[retainer_invoice.id] = retainer_invoice
        audit_payment = Payment(
            invoice_id=retainer_invoice.id,
            amount=7000,
            received_at=now - timedelta(days=1),
            method="bank_transfer",
        )
        self.payments[audit_payment.id] = audit_payment
        audit_expense = Expense(
            project_id=audit_project.id,
            category="Digital ads",
            amount=540,
            incurred_at=now - timedelta(days=6),
        )
        self.expenses[audit_expense.id] = audit_expense

        # Support
        ticket = Ticket(
            client_id=disenyorita_client.id,
            subject="Homepage hero image not updating",
            status=TicketStatus.IN_PROGRESS,
            priority="high",
            assignee_id="support-1",
            messages=[
                Message(author_id=None, body="Client reported hero image cache issue", channel=Channel.EMAIL, sent_at=now - timedelta(hours=6))
            ],
        )
        self.tickets[ticket.id] = ticket
        article = KnowledgeArticle(title="Clearing CDN cache", body="Step by step guide to purge CDN cache.", tags=["cdn", "troubleshooting"], published=True)
        self.articles[article.id] = article

        # HR
        project_manager = Employee(
            first_name="Avery",
            last_name="Nguyen",
            email="avery@disenyorita.example",
            employment_type=EmploymentType.EMPLOYEE,
            title="Project Manager",
            skills=[Skill(name="Hospitality Ops", proficiency=4)],
        )
        self.employees[project_manager.id] = project_manager
        manager_leave = TimeOffRequest(
            employee_id=project_manager.id,
            start_date=now.date() + timedelta(days=10),
            end_date=now.date() + timedelta(days=12),
            status=TimeOffStatus.APPROVED,
            reason="Annual family break",
        )
        self.time_off[manager_leave.id] = manager_leave
        self.capacity_overrides[project_manager.id] = (18.0, 0.9)

        designer = Employee(
            first_name="Lia",
            last_name="Santos",
            email="lia@disenyorita.example",
            employment_type=EmploymentType.EMPLOYEE,
            title="Brand Designer",
            manager_id=project_manager.id,
            skills=[Skill(name="Brand Strategy", proficiency=5), Skill(name="UX", proficiency=4)],
        )
        self.employees[designer.id] = designer
        designer_leave = TimeOffRequest(
            employee_id=designer.id,
            start_date=now.date() + timedelta(days=3),
            end_date=now.date() + timedelta(days=4),
            status=TimeOffStatus.PENDING,
            reason="Creative summit attendance",
        )
        self.time_off[designer_leave.id] = designer_leave
        self.capacity_overrides[designer.id] = (24.0, 0.82)

        consultant = Employee(
            first_name="Marco",
            last_name="Cruz",
            email="marco@isla.example",
            employment_type=EmploymentType.CONTRACTOR,
            title="Hospitality Consultant",
            manager_id=project_manager.id,
            skills=[Skill(name="F&B Operations", proficiency=5), Skill(name="Revenue Management", proficiency=4)],
        )
        self.employees[consultant.id] = consultant
        consultant_leave = TimeOffRequest(
            employee_id=consultant.id,
            start_date=now.date() + timedelta(days=18),
            end_date=now.date() + timedelta(days=19),
            status=TimeOffStatus.APPROVED,
            reason="Client site visit",
        )
        self.time_off[consultant_leave.id] = consultant_leave
        self.capacity_overrides[consultant.id] = (32.0, 0.68)

        # Marketing
        campaign = Campaign(
            name="Summer Boutique Launch",
            objective="Promote new branding showcase",
            channel=MarketingChannel.SOCIAL,
            start_date=now - timedelta(days=2),
            owner_id=project_manager.id,
        )
        self.campaigns[campaign.id] = campaign
        content = ContentItem(campaign_id=campaign.id, title="Instagram Reel", status=ContentStatus.SCHEDULED, scheduled_for=now + timedelta(days=1), platform="instagram")
        self.content_items[content.id] = content
        pending_content = ContentItem(
            campaign_id=campaign.id,
            title="Hotel audit checklist blog",
            status=ContentStatus.DRAFT,
            scheduled_for=now + timedelta(days=5),
            platform="blog",
            created_at=now - timedelta(days=6),
            updated_at=now - timedelta(days=6),
        )
        self.content_items[pending_content.id] = pending_content
        metric = MetricSnapshot(content_id=None, impressions=15000, clicks=1200, conversions=85, spend=450)
        self.metrics[metric.id] = metric

        # Monitoring
        site = Site(url="https://disenyorita.example", label="Disenyorita Marketing", brand="disenyorita")
        self.sites[site.id] = site
        check = Check(site_id=site.id, type="uptime", status="passing", last_run=now - timedelta(minutes=15), last_response_time_ms=380)
        self.checks[check.id] = check
        alert = Alert(site_id=site.id, message="SSL certificate expires in 7 days", severity="warning", triggered_at=now - timedelta(hours=3))
        self.alerts[alert.id] = alert
        compliance_check = Check(
            site_id=site.id,
            type="soc_audit",
            status="pending",
            last_run=now - timedelta(days=62),
            last_response_time_ms=None,
        )
        self.checks[compliance_check.id] = compliance_check

        isla_site = Site(url="https://portal.isla.example", label="Isla Client Portal", brand="isla")
        self.sites[isla_site.id] = isla_site
        portal_check = Check(
            site_id=isla_site.id,
            type="synthetic_login",
            status="failing",
            last_run=now - timedelta(minutes=8),
            last_response_time_ms=2150,
        )
        self.checks[portal_check.id] = portal_check
        outage_alert = Alert(
            site_id=isla_site.id,
            message="Client portal login failures detected (SSL certificate check failing)",
            severity="critical",
            triggered_at=now - timedelta(minutes=20),
            acknowledged=False,
        )
        self.alerts[outage_alert.id] = outage_alert

    def _generate_project_code(self, template_id: str) -> str:
        prefix = template_library.code_prefix(template_id)
        sequence = sum(
            1 for project in self.projects.values() if project.project_type == template_id
        ) + 1
        return project_code(prefix, sequence)

    @staticmethod
    def _calculate_project_end(tasks: List[Task], milestones: List[Milestone]) -> datetime | None:
        due_dates = [task.due_date for task in tasks if task.due_date]
        due_dates.extend(milestone.due_date for milestone in milestones)
        if not due_dates:
            return None
        return max(due_dates)

    @staticmethod
    def _derive_project_status_from_tasks(tasks: List[Task]) -> ProjectStatus:
        if not tasks:
            return ProjectStatus.PLANNING
        statuses = {task.status for task in tasks}
        if statuses and all(status == TaskStatus.DONE for status in statuses):
            return ProjectStatus.COMPLETED
        if any(status in {TaskStatus.IN_PROGRESS, TaskStatus.REVIEW} for status in statuses):
            return ProjectStatus.IN_PROGRESS
        if any(status == TaskStatus.DONE for status in statuses):
            return ProjectStatus.IN_PROGRESS
        return ProjectStatus.PLANNING

    def create_client_with_projects(self, payload: ClientCreateRequest) -> ClientWithProjects:
        client = Client(
            organization_name=payload.organization_name,
            industry=payload.industry,
            segment=payload.segment,
            billing_email=payload.billing_email,
            preferred_channel=payload.preferred_channel,
            timezone=payload.timezone,
            contacts=[
                Contact(
                    **contact.dict(exclude={"id", "created_at", "updated_at", "deleted_at"})
                )
                for contact in payload.contacts
            ],
        )

        project_setups = [setup.copy() for setup in payload.projects]
        branding_reference = next(
            (setup.name for setup in project_setups if setup.template_id == ProjectTemplateType.BRANDING.value),
            None,
        )
        if branding_reference:
            for idx, setup in enumerate(project_setups):
                if (
                    setup.template_id == ProjectTemplateType.WEBSITE.value
                    and setup.start_after_name is None
                ):
                    project_setups[idx] = setup.copy(update={"start_after_name": branding_reference})

        pending = list(project_setups)
        scheduled_completion: Dict[str, datetime] = {}
        created_projects: List[Project] = []
        known_names = {setup.name for setup in pending}

        while pending:
            progress_made = False
            for setup in list(pending):
                dependency_name = setup.start_after_name
                dependency_completion = None
                if dependency_name:
                    if dependency_name not in known_names:
                        raise ValueError(
                            f"Project '{setup.name}' depends on unknown project '{dependency_name}'"
                        )
                    if dependency_name not in scheduled_completion:
                        continue
                    dependency_completion = scheduled_completion[dependency_name]

                actual_start = setup.start_date
                if dependency_completion:
                    actual_start = max(actual_start, dependency_completion)

                tasks, milestones = build_plan(setup.template_id, actual_start)
                project_end = self._calculate_project_end(tasks, milestones)

                project = Project(
                    name=setup.name,
                    code=self._generate_project_code(setup.template_id),
                    client_id=client.id,
                    project_type=setup.template_id,
                    status=ProjectStatus.PLANNING,
                    start_date=actual_start,
                    end_date=project_end,
                    manager_id=setup.manager_id,
                    budget=setup.budget,
                    currency=setup.currency,
                    tasks=tasks,
                    milestones=milestones,
                )

                self.projects[project.id] = project
                created_projects.append(project)
                scheduled_completion[setup.name] = project_end or actual_start
                pending.remove(setup)
                progress_made = True

            if not progress_made:
                unresolved = ", ".join(setup.name for setup in pending)
                raise ValueError(f"Unable to resolve project scheduling for: {unresolved}")

        self.clients[client.id] = client

        return ClientWithProjects(client=client, projects=created_projects)

    def update_client(self, client_id: str, payload: ClientUpdateRequest) -> Client:
        client = self.clients.get(client_id)
        if not client:
            raise ValueError("Client not found")

        now = datetime.utcnow()
        update_fields = payload.dict(
            exclude_unset=True,
            exclude={"contacts", "interactions", "documents"},
        )

        if payload.contacts is not None:
            existing_contacts: Dict[str, Contact] = {contact.id: contact for contact in client.contacts}
            contacts: List[Contact] = []
            for contact_update in payload.contacts:
                if contact_update.id and contact_update.id in existing_contacts:
                    base = existing_contacts[contact_update.id]
                    update_data = contact_update.dict(exclude_unset=True)
                    update_data.pop("id", None)
                    update_data["updated_at"] = now
                    contacts.append(base.copy(update=update_data))
                else:
                    if (
                        contact_update.first_name is None
                        or contact_update.last_name is None
                        or contact_update.email is None
                    ):
                        raise ValueError(
                            "New contacts require first_name, last_name, and email"
                        )
                    contacts.append(
                        Contact(
                            first_name=contact_update.first_name,
                            last_name=contact_update.last_name,
                            email=contact_update.email,
                            phone=contact_update.phone,
                            title=contact_update.title,
                        )
                    )
            update_fields["contacts"] = contacts

        if payload.interactions is not None:
            existing_interactions: Dict[str, Interaction] = {
                interaction.id: interaction for interaction in client.interactions
            }
            interactions: List[Interaction] = []
            for interaction_update in payload.interactions:
                if interaction_update.id and interaction_update.id in existing_interactions:
                    base = existing_interactions[interaction_update.id]
                    update_data = interaction_update.dict(exclude_unset=True)
                    update_data.pop("id", None)
                    update_data["updated_at"] = now
                    interactions.append(base.copy(update=update_data))
                else:
                    if (
                        interaction_update.channel is None
                        or interaction_update.subject is None
                        or interaction_update.summary is None
                        or interaction_update.occurred_at is None
                    ):
                        raise ValueError(
                            "New interactions require channel, subject, summary, and occurred_at"
                        )
                    interactions.append(
                        Interaction(
                            channel=interaction_update.channel,
                            subject=interaction_update.subject,
                            summary=interaction_update.summary,
                            occurred_at=interaction_update.occurred_at,
                            owner_id=interaction_update.owner_id,
                        )
                    )
            interactions.sort(key=lambda entry: entry.occurred_at, reverse=True)
            update_fields["interactions"] = interactions

        if payload.documents is not None:
            existing_documents: Dict[str, Document] = {
                document.id: document for document in client.documents
            }
            documents: List[Document] = []
            for document_update in payload.documents:
                if document_update.id and document_update.id in existing_documents:
                    base = existing_documents[document_update.id]
                    update_data = document_update.dict(exclude_unset=True)
                    update_data.pop("id", None)
                    update_data["updated_at"] = now
                    documents.append(base.copy(update=update_data))
                else:
                    doc_payload = document_update.dict(exclude_unset=True)
                    for field in ("name", "url", "uploaded_by"):
                        if field not in doc_payload:
                            raise ValueError(
                                "New documents require name, url, and uploaded_by"
                            )
                    documents.append(Document(**doc_payload))
            update_fields["documents"] = documents

        update_fields["updated_at"] = now
        updated_client = client.copy(update=update_fields)
        self.clients[client_id] = updated_client
        return updated_client

    def update_project(self, project_id: str, payload: ProjectUpdateRequest) -> Project:
        project = self.projects.get(project_id)
        if not project:
            raise ValueError("Project not found")

        update_data = payload.dict(exclude_unset=True)
        template_id = update_data.pop("template_id", None)
        task_updates = update_data.pop("tasks", None)
        milestone_updates = update_data.pop("milestones", None)
        now = datetime.utcnow()

        start_date = update_data.get("start_date", project.start_date)

        tasks = [
            task if isinstance(task, Task) else Task.parse_obj(task)
            for task in project.tasks
        ]
        milestones = list(project.milestones)

        if template_id:
            template_tasks, template_milestones = build_plan(template_id, start_date)
            tasks = [task.copy(update={"updated_at": now}) for task in template_tasks]
            milestones = [milestone.copy(update={"updated_at": now}) for milestone in template_milestones]
            update_data["project_type"] = template_id
            if "start_date" not in update_data:
                update_data["start_date"] = start_date
        elif "start_date" in update_data:
            delta = update_data["start_date"] - project.start_date
            if delta:
                tasks = [
                    task.copy(
                        update={
                            "start_date": task.start_date + delta if task.start_date else None,
                            "due_date": task.due_date + delta if task.due_date else None,
                            "updated_at": now,
                        }
                    )
                    for task in tasks
                ]
                milestones = [
                    milestone.copy(update={"due_date": milestone.due_date + delta, "updated_at": now})
                    for milestone in milestones
                ]

        manual_started_ids: List[str] = []
        completed_ids: List[str] = []

        if task_updates is not None:
            existing_tasks: Dict[str, Task] = {}
            ordered_task_ids: List[str] = []
            for task in tasks:
                if isinstance(task, Task):
                    parsed_task = task
                else:
                    parsed_task = Task.parse_obj(task)
                existing_tasks[parsed_task.id] = parsed_task
                ordered_task_ids.append(parsed_task.id)
            for task_payload in task_updates:
                task_update = task_payload if isinstance(task_payload, TaskUpdate) else TaskUpdate(**task_payload)
                base = existing_tasks.get(task_update.id)
                if not base:
                    continue
                update_fields = task_update.dict(exclude_unset=True)
                update_fields.pop("id", None)
                new_status = update_fields.get("status")
                if (
                    new_status == TaskStatus.IN_PROGRESS
                    and base.status != TaskStatus.IN_PROGRESS
                    and "start_date" not in update_fields
                    and base.start_date is None
                ):
                    update_fields["start_date"] = now
                update_fields["updated_at"] = now
                updated_task = base.copy(update=update_fields)
                if base.status != updated_task.status:
                    if updated_task.status == TaskStatus.IN_PROGRESS:
                        manual_started_ids.append(updated_task.id)
                    if updated_task.status == TaskStatus.DONE:
                        completed_ids.append(updated_task.id)
                existing_tasks[task_update.id] = updated_task
            tasks = [existing_tasks[task_id] for task_id in ordered_task_ids if task_id in existing_tasks]

        manual_started_tasks: List[Task] = []
        completed_tasks: List[Task] = []

        if manual_started_ids or completed_ids:
            lookup_after_updates = {task.id: task for task in tasks}
            manual_started_tasks = [
                lookup_after_updates[task_id]
                for task_id in manual_started_ids
                if task_id in lookup_after_updates
            ]
            completed_tasks = [
                lookup_after_updates[task_id]
                for task_id in completed_ids
                if task_id in lookup_after_updates
            ]

        auto_started_tasks: List[Task] = []
        if completed_tasks:
            tasks, auto_started_tasks = self._auto_start_ready_tasks(
                tasks,
                completed_tasks=completed_tasks,
                now=now,
            )

        if milestone_updates is not None:
            existing_milestones: Dict[str, Milestone] = {milestone.id: milestone for milestone in milestones}
            for milestone_update in milestone_updates:
                base = existing_milestones.get(milestone_update.id)
                if not base:
                    continue
                update_fields = milestone_update.dict(exclude_unset=True)
                update_fields.pop("id", None)
                update_fields["updated_at"] = now
                existing_milestones[milestone_update.id] = base.copy(update=update_fields)
            milestones = [existing_milestones[milestone.id] for milestone in milestones if milestone.id in existing_milestones]

        if manual_started_tasks or auto_started_tasks:
            project_name = update_data.get("name", project.name)
            self._emit_task_notifications(
                project_id=project_id,
                project_name=project_name,
                manual_starts=manual_started_tasks,
                auto_starts=auto_started_tasks,
                triggered_at=now,
            )

        if template_id or "start_date" in update_data or task_updates is not None or milestone_updates is not None or auto_started_tasks:
            update_data["tasks"] = tasks
            update_data["milestones"] = milestones
            update_data["end_date"] = self._calculate_project_end(tasks, milestones)
            if "status" not in update_data:
                update_data["status"] = self._derive_project_status_from_tasks(tasks)

        update_data["updated_at"] = now

        updated_project = project.copy(update=update_data)
        self.projects[project_id] = updated_project
        return updated_project

    def _auto_start_ready_tasks(
        self,
        tasks: List[Task],
        *,
        completed_tasks: List[Task],
        now: datetime,
    ) -> Tuple[List[Task], List[Task]]:
        if not completed_tasks:
            return tasks, []

        completed_ids = {task.id for task in completed_tasks}
        tasks_by_id = {task.id: task for task in tasks}
        auto_started: List[Task] = []

        for index, task in enumerate(tasks):
            if task.status != TaskStatus.TODO:
                continue

            dependency_objects = [
                tasks_by_id[dependency]
                for dependency in task.dependencies
                if dependency in tasks_by_id
            ]

            if task.dependencies:
                if not dependency_objects or not all(
                    dependency.status == TaskStatus.DONE for dependency in dependency_objects
                ):
                    continue
                if not any(dependency.id in completed_ids for dependency in dependency_objects):
                    continue
            else:
                if index == 0:
                    continue
                prior_tasks = tasks[:index]
                if not any(previous.id in completed_ids for previous in prior_tasks):
                    continue
                if any(previous.status != TaskStatus.DONE for previous in prior_tasks):
                    continue

            updated_task = task.copy(
                update={
                    "status": TaskStatus.IN_PROGRESS,
                    "start_date": task.start_date or now,
                    "updated_at": now,
                }
            )
            tasks_by_id[task.id] = updated_task
            auto_started.append(updated_task)

        ordered_tasks = [tasks_by_id[task.id] for task in tasks]
        return ordered_tasks, auto_started

    def _emit_task_notifications(
        self,
        *,
        project_id: str,
        project_name: str,
        manual_starts: List[Task],
        auto_starts: List[Task],
        triggered_at: datetime,
    ) -> None:
        for task in manual_starts:
            notification = TaskNotification(
                notification_id=str(uuid4()),
                project_id=project_id,
                project_name=project_name,
                task_id=task.id,
                task_name=task.name,
                type=TaskNotificationType.START_CONFIRMATION,
                message=f"Task '{task.name}' was marked as in progress. Confirm the kickoff?",
                triggered_at=triggered_at,
                requires_confirmation=True,
                allow_start_date_edit=True,
                suggested_start_date=task.start_date or triggered_at,
            )
            self._record_task_notification(notification)

        for task in auto_starts:
            notification = TaskNotification(
                notification_id=str(uuid4()),
                project_id=project_id,
                project_name=project_name,
                task_id=task.id,
                task_name=task.name,
                type=TaskNotificationType.AUTO_STARTED,
                message="Task automatically moved to in progress after predecessors completed.",
                triggered_at=triggered_at,
                requires_confirmation=False,
                allow_start_date_edit=True,
                suggested_start_date=task.start_date or triggered_at,
            )
            self._record_task_notification(notification)

    def _record_task_notification(self, notification: TaskNotification) -> None:
        self.task_notifications.append(notification)
        self.task_notifications = self.task_notifications[-200:]

    def client_dashboard(self, client_id: str) -> ClientDashboard:
        client = self.clients.get(client_id)
        if not client:
            raise ValueError("Client not found")

        now = datetime.utcnow()

        project_digests: List[ClientProjectDigest] = []
        client_projects = [
            project for project in self.projects.values() if project.client_id == client_id
        ]
        for project in sorted(client_projects, key=lambda proj: proj.start_date):
            late_tasks = sorted(
                (
                    task
                    for task in project.tasks
                    if task.due_date and task.due_date < now and task.status != TaskStatus.DONE
                ),
                key=lambda task: task.due_date,
            )

            upcoming_tasks = sorted(
                (
                    task
                    for task in project.tasks
                    if task.status != TaskStatus.DONE and task.due_date and task.due_date >= now
                ),
                key=lambda task: task.due_date,
            )
            next_task = upcoming_tasks[0] if upcoming_tasks else next(
                (task for task in project.tasks if task.status != TaskStatus.DONE),
                None,
            )

            upcoming_milestones = sorted(
                (milestone for milestone in project.milestones if not milestone.completed),
                key=lambda milestone: milestone.due_date,
            )

            project_digests.append(
                ClientProjectDigest(
                    id=project.id,
                    code=project.code,
                    name=project.name,
                    project_type=project.project_type,
                    status=project.status,
                    start_date=project.start_date,
                    end_date=project.end_date,
                    manager_id=project.manager_id,
                    budget=project.budget,
                    currency=project.currency,
                    late_tasks=late_tasks,
                    next_task=next_task,
                    next_milestone=upcoming_milestones[0] if upcoming_milestones else None,
                )
            )

        client_invoices = [
            invoice for invoice in self.invoices.values() if invoice.client_id == client_id
        ]
        invoice_lookup = {invoice.id: invoice for invoice in client_invoices}

        outstanding_invoices: List[ClientInvoiceDigest] = []
        for invoice in client_invoices:
            invoice_total = sum(item.total for item in invoice.items) if invoice.items else 0.0
            payments = [
                payment.amount
                for payment in self.payments.values()
                if payment.invoice_id == invoice.id
            ]
            paid_total = sum(payments)
            balance_due = max(invoice_total - paid_total, 0.0)

            project_name = None
            if invoice.project_id:
                project = self.projects.get(invoice.project_id)
                if project:
                    project_name = project.name

            digest = ClientInvoiceDigest(
                id=invoice.id,
                number=invoice.number,
                status=invoice.status,
                due_date=invoice.due_date,
                total=invoice_total,
                balance_due=balance_due,
                currency=invoice.currency,
                project_id=invoice.project_id,
                project_name=project_name,
            )
            if invoice.status in {InvoiceStatus.SENT, InvoiceStatus.OVERDUE} and balance_due > 0:
                outstanding_invoices.append(digest)

        outstanding_invoices.sort(key=lambda invoice: invoice.due_date)
        total_outstanding = sum(invoice.balance_due for invoice in outstanding_invoices)
        next_invoice_due = outstanding_invoices[0] if outstanding_invoices else None

        client_payments = [
            payment
            for payment in self.payments.values()
            if payment.invoice_id in invoice_lookup
        ]
        payment_digests = [
            ClientPaymentDigest(
                id=payment.id,
                invoice_id=payment.invoice_id,
                invoice_number=invoice_lookup.get(payment.invoice_id).number
                if invoice_lookup.get(payment.invoice_id)
                else None,
                amount=payment.amount,
                received_at=payment.received_at,
                method=payment.method,
            )
            for payment in client_payments
        ]
        payment_digests.sort(key=lambda payment: payment.received_at, reverse=True)

        financial_snapshot = ClientFinancialSnapshot(
            outstanding_invoices=outstanding_invoices,
            next_invoice_due=next_invoice_due,
            recent_payments=payment_digests,
            total_outstanding=total_outstanding,
        )

        client_tickets = [
            ticket for ticket in self.tickets.values() if ticket.client_id == client_id
        ]
        ticket_activity = [
            message.sent_at
            for ticket in client_tickets
            for message in ticket.messages
        ]
        open_ticket_digests = []
        for ticket in client_tickets:
            if ticket.status in {TicketStatus.OPEN, TicketStatus.IN_PROGRESS}:
                last_activity = max((message.sent_at for message in ticket.messages), default=None)
                open_ticket_digests.append(
                    ClientTicketDigest(
                        id=ticket.id,
                        subject=ticket.subject,
                        status=ticket.status,
                        priority=ticket.priority,
                        sla_due=ticket.sla_due,
                        last_activity_at=last_activity,
                    )
                )

        open_ticket_digests.sort(
            key=lambda ticket: ticket.last_activity_at or datetime.min,
            reverse=True,
        )

        support_snapshot = ClientSupportSnapshot(
            open_tickets=open_ticket_digests,
            last_ticket_update=max(ticket_activity) if ticket_activity else None,
        )

        return ClientDashboard(
            client=client,
            projects=project_digests,
            financials=financial_snapshot,
            support=support_snapshot,
        )

    @staticmethod
    def _task_story_points(task: Task) -> float:
        if task.story_points is not None:
            return max(task.story_points, 0.0)
        if task.estimated_hours:
            return max(round(task.estimated_hours / 4.0, 1), 1.0)
        return 1.0

    def project_portfolio(self) -> List[ProjectProgress]:
        now = datetime.utcnow()
        portfolio: List[ProjectProgress] = []
        for project in self.projects.values():
            total_tasks = len(project.tasks)
            completed_tasks = sum(1 for task in project.tasks if task.status == TaskStatus.DONE)
            late_tasks = sum(
                1
                for task in project.tasks
                if task.due_date and task.due_date < now and task.status != TaskStatus.DONE
            )
            total_story_points = sum(self._task_story_points(task) for task in project.tasks)
            completed_story_points = sum(
                self._task_story_points(task)
                for task in project.tasks
                if task.status == TaskStatus.DONE
            )
            story_point_progress = (
                (completed_story_points / total_story_points) * 100.0
                if total_story_points
                else 0.0
            )
            progress = (
                (completed_tasks / total_tasks) * 100.0
                if total_tasks
                else story_point_progress
            )
            upcoming_milestones = sorted(
                (milestone for milestone in project.milestones if not milestone.completed),
                key=lambda milestone: milestone.due_date,
            )
            next_milestone = upcoming_milestones[0] if upcoming_milestones else None
            client_name = (
                self.clients[project.client_id].organization_name
                if project.client_id in self.clients
                else None
            )
            active_sprint = None
            if project.active_sprint_id:
                active_sprint = next(
                    (sprint for sprint in project.sprints if sprint.id == project.active_sprint_id),
                    None,
                )
            if not active_sprint:
                active_sprint = next(
                    (sprint for sprint in project.sprints if sprint.status == SprintStatus.ACTIVE),
                    None,
                )
            sprint_committed = None
            sprint_completed = None
            if active_sprint:
                sprint_tasks = [
                    task for task in project.tasks if task.sprint_id == active_sprint.id
                ]
                sprint_committed = sum(self._task_story_points(task) for task in sprint_tasks)
                sprint_completed = sum(
                    self._task_story_points(task)
                    for task in sprint_tasks
                    if task.status == TaskStatus.DONE
                )
            completed_sprints = [
                sprint
                for sprint in project.sprints
                if sprint.status == SprintStatus.COMPLETED and sprint.completed_points
            ]
            velocity = None
            if completed_sprints:
                velocity = sum(sprint.completed_points for sprint in completed_sprints) / len(
                    completed_sprints
                )
            forecast_completion = None
            remaining_points = max(total_story_points - completed_story_points, 0.0)
            if velocity and velocity > 0:
                baseline_end = (
                    active_sprint.end_date
                    if active_sprint and active_sprint.end_date
                    else now
                )
                average_duration_days = (
                    sum(
                        max((sprint.end_date - sprint.start_date).days, 7)
                        for sprint in completed_sprints
                    )
                    / len(completed_sprints)
                )
                average_duration_days = max(average_duration_days, 7)
                projected_days = average_duration_days * (remaining_points / velocity)
                forecast_completion = baseline_end + timedelta(days=projected_days)
            if project.status == ProjectStatus.COMPLETED:
                health = ProjectHealth.COMPLETED
            elif project.status == ProjectStatus.ON_HOLD:
                health = ProjectHealth.BLOCKED
            elif late_tasks > 0:
                health = ProjectHealth.AT_RISK
            else:
                health = ProjectHealth.ON_TRACK
            portfolio.append(
                ProjectProgress(
                    project_id=project.id,
                    code=project.code,
                    name=project.name,
                    status=project.status,
                    client_id=project.client_id,
                    client_name=client_name,
                    total_tasks=total_tasks,
                    completed_tasks=completed_tasks,
                    late_tasks=late_tasks,
                    progress=progress,
                    next_milestone=next_milestone,
                    health=health,
                    updated_at=project.updated_at,
                    total_story_points=total_story_points,
                    completed_story_points=completed_story_points,
                    active_sprint_id=active_sprint.id if active_sprint else None,
                    active_sprint_name=active_sprint.name if active_sprint else None,
                    sprint_committed_points=sprint_committed,
                    sprint_completed_points=sprint_completed,
                    velocity=velocity,
                    forecast_completion=forecast_completion,
                    story_point_progress=story_point_progress,
                )
            )
        portfolio.sort(key=lambda record: record.updated_at, reverse=True)
        return portfolio

    def project_tracker(self, project_id: str) -> ProjectTracker:
        project = self.projects.get(project_id)
        if not project:
            raise ValueError("Project not found")

        now = datetime.utcnow()
        alerts: List[TaskAlert] = []
        timeline: List[TaskTimelineEntry] = []
        late_tasks = 0

        for task in project.tasks:
            is_late = bool(
                task.due_date and task.due_date < now and task.status != TaskStatus.DONE
            )
            will_be_late = bool(
                task.due_date
                and task.status in {TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.REVIEW}
                and not is_late
                and task.due_date - now <= timedelta(days=2)
            )

            if is_late:
                late_tasks += 1
                overdue_delta = now - task.due_date
                days_overdue = max(overdue_delta.days, 0)
                alerts.append(
                    TaskAlert(
                        task_id=task.id,
                        task_name=task.name,
                        severity=TaskAlertSeverity.LATE,
                        due_date=task.due_date,
                        message=(
                            f"Task '{task.name}' is overdue by {days_overdue} day(s)."
                            if days_overdue
                            else f"Task '{task.name}' is overdue."
                        ),
                    )
                )
            elif will_be_late:
                remaining = task.due_date - now if task.due_date else None
                hours_left = int(remaining.total_seconds() // 3600) if remaining else 0
                alerts.append(
                    TaskAlert(
                        task_id=task.id,
                        task_name=task.name,
                        severity=TaskAlertSeverity.AT_RISK,
                        due_date=task.due_date,
                        message=(
                            f"Task '{task.name}' is at risk of slipping (due in {hours_left} hour(s))."
                        ),
                    )
                )

            timeline.append(
                TaskTimelineEntry(
                    task_id=task.id,
                    name=task.name,
                    status=task.status,
                    assignee_id=task.assignee_id,
                    start_date=task.start_date,
                    due_date=task.due_date,
                    estimated_hours=task.estimated_hours,
                    logged_hours=task.logged_hours,
                    dependencies=list(task.dependencies),
                    is_late=is_late,
                    will_be_late=will_be_late,
                )
            )

        if project.status == ProjectStatus.COMPLETED:
            health = ProjectHealth.COMPLETED
        elif project.status == ProjectStatus.ON_HOLD:
            health = ProjectHealth.BLOCKED
        elif late_tasks > 0:
            health = ProjectHealth.AT_RISK
        else:
            health = ProjectHealth.ON_TRACK

        notifications = [
            notification
            for notification in self.task_notifications
            if notification.project_id == project_id
        ]
        notifications.sort(key=lambda item: item.triggered_at, reverse=True)

        total_story_points = sum(self._task_story_points(task) for task in project.tasks)
        completed_story_points = sum(
            self._task_story_points(task)
            for task in project.tasks
            if task.status == TaskStatus.DONE
        )
        active_sprint = None
        if project.active_sprint_id:
            active_sprint = next(
                (sprint for sprint in project.sprints if sprint.id == project.active_sprint_id),
                None,
            )
        if not active_sprint:
            active_sprint = next(
                (sprint for sprint in project.sprints if sprint.status == SprintStatus.ACTIVE),
                None,
            )
        completed_sprints = [
            sprint
            for sprint in project.sprints
            if sprint.status == SprintStatus.COMPLETED and sprint.completed_points
        ]
        velocity = None
        if completed_sprints:
            velocity = sum(sprint.completed_points for sprint in completed_sprints) / len(
                completed_sprints
            )
        forecast_completion = None
        remaining_points = max(total_story_points - completed_story_points, 0.0)
        if velocity and velocity > 0:
            baseline_end = (
                active_sprint.end_date
                if active_sprint and active_sprint.end_date
                else now
            )
            average_duration_days = (
                sum(
                    max((sprint.end_date - sprint.start_date).days, 7)
                    for sprint in completed_sprints
                )
                / len(completed_sprints)
            )
            average_duration_days = max(average_duration_days, 7)
            projected_days = average_duration_days * (remaining_points / velocity)
            forecast_completion = baseline_end + timedelta(days=projected_days)

        active_sprint_snapshot = None
        if active_sprint:
            sprint_tasks = [task for task in project.tasks if task.sprint_id == active_sprint.id]
            committed_points = sum(self._task_story_points(task) for task in sprint_tasks)
            completed_points = sum(
                self._task_story_points(task)
                for task in sprint_tasks
                if task.status == TaskStatus.DONE
            )
            active_sprint_snapshot = active_sprint.copy(
                update={
                    "committed_points": committed_points,
                    "completed_points": completed_points,
                }
            )

        upcoming_sprints = [
            sprint
            for sprint in sorted(project.sprints, key=lambda sprint: sprint.start_date)
            if sprint.status in {SprintStatus.PLANNING, SprintStatus.ACTIVE}
            and (not active_sprint or sprint.id != active_sprint.id)
        ]
        backlog_summary = {
            "status": {status.value: 0 for status in TaskStatus},
            "priority": {priority.value: 0 for priority in TaskPriority},
            "unscheduled": 0,
        }
        for task in project.tasks:
            backlog_summary["status"][task.status.value] += 1
            backlog_summary["priority"][task.priority.value] += 1
            if not task.sprint_id:
                backlog_summary["unscheduled"] += 1

        return ProjectTracker(
            project_id=project.id,
            project_name=project.name,
            code=project.code,
            status=project.status,
            health=health,
            generated_at=now,
            tasks=timeline,
            alerts=alerts,
            notifications=notifications,
            active_sprint=active_sprint_snapshot,
            upcoming_sprints=upcoming_sprints,
            backlog_summary=backlog_summary,
            total_story_points=total_story_points,
            completed_story_points=completed_story_points,
            velocity=velocity,
            forecast_completion=forecast_completion,
        )

    def project_summary(self) -> ProjectSummary:
        by_status: Dict[str, int] = {status.value: 0 for status in ProjectStatus}
        overdue_tasks = 0
        billable_hours = 0.0
        for project in self.projects.values():
            by_status[project.status.value] += 1
            for task in project.tasks:
                billable_hours += task.logged_hours if task.billable else 0
                if task.due_date and task.due_date < datetime.utcnow() and task.status != TaskStatus.DONE:
                    overdue_tasks += 1
        return ProjectSummary(
            total_projects=len(self.projects),
            by_status=by_status,
            billable_hours=billable_hours,
            overdue_tasks=overdue_tasks,
        )

    def client_summary(self) -> ClientSummary:
        by_segment: Dict[str, int] = {segment.value: 0 for segment in ClientSegment}
        for client in self.clients.values():
            by_segment[client.segment.value] += 1
        return ClientSummary(
            total_clients=len(self.clients),
            by_segment=by_segment,
            active_portal_users=sum(1 for client in self.clients.values() if client.preferred_channel == InteractionChannel.PORTAL),
        )

    def client_engagements(self) -> List[ClientEngagement]:
        now = datetime.utcnow()
        engagements: List[ClientEngagement] = []
        for client in self.clients.values():
            client_projects = [
                project for project in self.projects.values() if project.client_id == client.id
            ]
            active_projects = [
                project
                for project in client_projects
                if project.status not in {ProjectStatus.COMPLETED, ProjectStatus.CANCELLED}
            ]
            late_projects = [
                project
                for project in active_projects
                if any(
                    task.due_date and task.due_date < now and task.status != TaskStatus.DONE
                    for task in project.tasks
                )
            ]
            upcoming_milestones = sorted(
                (
                    milestone
                    for project in active_projects
                    for milestone in project.milestones
                    if not milestone.completed
                ),
                key=lambda milestone: milestone.due_date,
            )
            next_milestone = upcoming_milestones[0] if upcoming_milestones else None

            outstanding_balance = 0.0
            for invoice in self.invoices.values():
                if invoice.client_id != client.id:
                    continue
                invoice_total = sum(item.total for item in invoice.items) if invoice.items else 0.0
                payments_total = sum(
                    payment.amount for payment in self.payments.values() if payment.invoice_id == invoice.id
                )
                outstanding_balance += max(invoice_total - payments_total, 0.0)

            last_interaction_at = max(
                (interaction.occurred_at for interaction in client.interactions),
                default=None,
            )
            interaction_gap_days = (
                (now - last_interaction_at).days if last_interaction_at else None
            )

            has_on_hold = any(project.status == ProjectStatus.ON_HOLD for project in active_projects)
            needs_attention = has_on_hold or len(late_projects) >= 2 or outstanding_balance > 15000
            at_risk = (
                len(late_projects) > 0
                or outstanding_balance > 0
                or (interaction_gap_days is not None and interaction_gap_days > 30)
            )

            if not active_projects and outstanding_balance <= 0:
                health = "no_active_work"
            elif needs_attention:
                health = "needs_attention"
            elif at_risk:
                health = "at_risk"
            else:
                health = "on_track"

            engagements.append(
                ClientEngagement(
                    client_id=client.id,
                    organization_name=client.organization_name,
                    segment=client.segment,
                    active_projects=len(active_projects),
                    late_projects=len(late_projects),
                    outstanding_balance=outstanding_balance,
                    next_milestone=next_milestone,
                    last_interaction_at=last_interaction_at,
                    health=health,
                )
            )

        engagements.sort(key=lambda entry: entry.organization_name.lower())
        return engagements

    def financial_summary(self) -> FinancialSummary:
        outstanding = 0.0
        for invoice in self.invoices.values():
            if invoice.status not in {InvoiceStatus.SENT, InvoiceStatus.OVERDUE}:
                continue
            invoice_total = sum(item.total for item in invoice.items) if invoice.items else 0.0
            payments_total = sum(
                payment.amount for payment in self.payments.values() if payment.invoice_id == invoice.id
            )
            outstanding += max(invoice_total - payments_total, 0.0)
        overdue = sum(1 for invoice in self.invoices.values() if invoice.status == InvoiceStatus.OVERDUE)
        expenses = sum(expense.amount for expense in self.expenses.values())
        return FinancialSummary(
            mrr=18000,
            outstanding_invoices=outstanding,
            overdue_invoices=overdue,
            expenses_this_month=expenses,
        )

    def project_financials(self) -> List[ProjectFinancials]:
        project_financials: List[ProjectFinancials] = []
        for project in self.projects.values():
            project_invoices = [invoice for invoice in self.invoices.values() if invoice.project_id == project.id]
            invoice_ids = {invoice.id for invoice in project_invoices}
            total_invoiced = sum(
                sum(item.total for item in invoice.items) for invoice in project_invoices if invoice.items
            )
            total_collected = sum(
                payment.amount for payment in self.payments.values() if payment.invoice_id in invoice_ids
            )
            total_expenses = sum(expense.amount for expense in self.expenses.values() if expense.project_id == project.id)
            outstanding_amount = max(total_invoiced - total_collected, 0.0)
            client_name = None
            if project.client_id in self.clients:
                client_name = self.clients[project.client_id].organization_name
            currency = project_invoices[0].currency if project_invoices else Currency.USD
            project_financials.append(
                ProjectFinancials(
                    project_id=project.id,
                    project_name=project.name,
                    client_name=client_name,
                    currency=currency,
                    total_invoiced=total_invoiced,
                    total_collected=total_collected,
                    total_expenses=total_expenses,
                    outstanding_amount=outstanding_amount,
                    net_revenue=total_collected - total_expenses,
                )
            )
        project_financials.sort(key=lambda record: record.project_name)
        return project_financials

    def macro_financials(self) -> MacroFinancials:
        project_financials = self.project_financials()
        total_invoiced = sum(project.total_invoiced for project in project_financials)
        total_collected = sum(project.total_collected for project in project_financials)
        total_expenses = sum(project.total_expenses for project in project_financials)
        total_outstanding = sum(project.outstanding_amount for project in project_financials)
        return MacroFinancials(
            total_invoiced=total_invoiced,
            total_collected=total_collected,
            total_outstanding=total_outstanding,
            total_expenses=total_expenses,
            net_cash_flow=total_collected - total_expenses,
        )

    def archive_automation_digest(self, digest: AutomationDigest) -> None:
        self.automation_digests.append(digest)
        # Keep roughly the last ten months of daily snapshots
        self.automation_digests = self.automation_digests[-300:]

    def automation_digest_history(self) -> List[AutomationDigest]:
        return list(self.automation_digests)

    def record_automation_broadcast(self, digest: AutomationDigest) -> None:
        summary = f"{digest.generated_at.isoformat()}|tasks={len(digest.tasks)}"
        self.automation_broadcasts.append(summary)
        self.automation_broadcasts = self.automation_broadcasts[-120:]

    def tax_profile(self) -> TaxProfile:
        exchange_rate = 56.0

        def to_php(amount: float, currency: Currency) -> float:
            if currency == Currency.USD:
                return round(amount * exchange_rate, 2)
            return round(amount, 2)

        revenue_by_client: Dict[str, float] = {}
        for invoice in self.invoices.values():
            total = sum(item.total for item in invoice.items) if invoice.items else 0.0
            client_name = self.clients[invoice.client_id].organization_name if invoice.client_id in self.clients else "Client"
            revenue_by_client[client_name] = revenue_by_client.get(client_name, 0.0) + to_php(total, invoice.currency)

        incomes = [TaxEntry(label=f"{client} billings", amount=value) for client, value in revenue_by_client.items()]

        delivery_costs: Dict[str, float] = {}
        for expense in self.expenses.values():
            delivery_costs[expense.category] = delivery_costs.get(expense.category, 0.0) + to_php(expense.amount, expense.currency)
        cost_of_sales = [TaxEntry(label=label, amount=value) for label, value in delivery_costs.items()]

        operating_expenses = [
            TaxEntry(label=label, amount=amount)
            for label, amount in self.operating_expense_baselines.items()
        ]

        other_deductions = [
            TaxEntry(label=label, amount=amount)
            for label, amount in self.statutory_contributions.items()
        ]

        payload = TaxComputationRequest(
            incomes=incomes,
            cost_of_sales=cost_of_sales,
            operating_expenses=operating_expenses,
            other_deductions=other_deductions,
            apply_percentage_tax=bool(self.tax_configuration["apply_percentage_tax"]),
            percentage_tax_rate=float(self.tax_configuration["percentage_tax_rate"]),
            vat_registered=bool(self.tax_configuration["vat_registered"]),
        )

        computation = self.calculate_tax(payload)

        today = datetime.utcnow().date()

        def upcoming_due(month: int, day: int) -> date:
            due = date(today.year, month, day)
            if due < today:
                due = date(today.year + 1, month, day)
            return due

        annual_due = upcoming_due(4, 15)
        filing_calendar: List[FilingObligation] = []

        annual_forms: List[tuple[str, str]] = [
            (
                "BIR Form 1701",
                "Annual income tax return for individuals earning from business or profession under graduated rates.",
            ),
            (
                "BIR Form 1701A",
                "Annual income tax return attachment for purely self-employed individuals under graduated rates.",
            ),
            (
                "BIR Form 1701MS",
                "Annual income tax return schedule for mixed income earners and summary of quarterly filings.",
            ),
        ]

        for form, description in annual_forms:
            filing_calendar.append(
                FilingObligation(
                    form=form,
                    description=description,
                    frequency="Annual",
                    period=f"Tax year {annual_due.year}",
                    due_date=annual_due,
                )
            )

        quarter_schedule = [
            ("Q1", 5, 15),
            ("Q2", 8, 15),
            ("Q3", 11, 15),
        ]

        quarter_forms: List[tuple[str, str]] = [
            (
                "BIR Form 1701Q",
                "Quarterly income tax return for individuals earning from business or profession.",
            ),
            (
                "BIR Form 2551Q",
                "Quarterly percentage tax return for self-employed individuals not availing of the 8% flat rate.",
            ),
        ]

        for quarter_label, month, day in quarter_schedule:
            due = upcoming_due(month, day)
            for form, description in quarter_forms:
                filing_calendar.append(
                    FilingObligation(
                        form=form,
                        description=description,
                        frequency="Quarterly",
                        period=f"{quarter_label} {due.year}",
                        due_date=due,
                    )
                )

        filing_calendar.sort(key=lambda obligation: obligation.due_date)

        business_profile = TaxBusinessProfile(
            taxpayer_type="Individual",
            registration_type="Freelancer / Sole Proprietor",
            psic_primary_code="82212",
            psic_primary_description="Sales and marketing (including telemarketing) activities",
            primary_line_of_business="Branding consultant",
            psic_secondary_code="47913",
            psic_secondary_description="Retail sale via internet",
            secondary_line_of_business="Freelancer-led online sales",
            filing_frequencies=[
                "Annual income tax package (BIR Forms 1701 / 1701A / 1701MS) due every April 15.",
                "Quarterly income tax (BIR Form 1701Q) due May 15, August 15, and November 15.",
                "Quarterly percentage tax (BIR Form 2551Q) due May 15, August 15, and November 15 unless the 8% optional rate is elected.",
            ],
            compliance_notes=[
                "File required tax returns even with no operations to avoid penalties.",
                "Register manual books of accounts before the first applicable quarterly or annual filing deadline.",
                "Update the RDO via BIR Form 1905 for any transfer, cessation, or registration changes.",
                "Self-employed individuals under graduated rates must file BIR Form 2551Q each quarter unless properly opting into the 8% income tax.",
            ],
        )

        timestamps = [
            *[invoice.updated_at for invoice in self.invoices.values()],
            *[expense.updated_at for expense in self.expenses.values()],
        ]
        if timestamps:
            last_updated = max(timestamps)
        else:
            last_updated = datetime.utcnow()
        self._tax_profile_updated_at = max(self._tax_profile_updated_at, last_updated)

        return TaxProfile(
            incomes=incomes,
            cost_of_sales=cost_of_sales,
            operating_expenses=operating_expenses,
            other_deductions=other_deductions,
            apply_percentage_tax=payload.apply_percentage_tax,
            percentage_tax_rate=payload.percentage_tax_rate,
            vat_registered=payload.vat_registered,
            business_profile=business_profile,
            filing_calendar=filing_calendar,
            last_updated=self._tax_profile_updated_at,
            source_summary={
                "invoices": len(self.invoices),
                "expenses": len(self.expenses),
                "statutory_records": len(self.statutory_contributions),
            },
            computed=computation,
        )

    def _calculate_income_tax(self, taxable_income: float) -> float:
        for bracket in PH_TAX_BRACKETS:
            if taxable_income > bracket["min"] and taxable_income <= bracket["max"]:
                return bracket["base"] + (taxable_income - bracket["min"]) * bracket["rate"]
        return 0.0

    def calculate_tax(self, request: TaxComputationRequest) -> TaxComputationResponse:
        def safe_total(entries: List[TaxEntry]) -> float:
            return sum(max(entry.amount, 0.0) for entry in entries)

        gross_revenue = safe_total(request.incomes)
        total_cost_of_sales = safe_total(request.cost_of_sales)
        total_operating_expenses = safe_total(request.operating_expenses)
        total_other_deductions = safe_total(request.other_deductions)
        taxable_income = max(gross_revenue - total_cost_of_sales - total_operating_expenses - total_other_deductions, 0.0)
        income_tax = self._calculate_income_tax(taxable_income)
        percentage_tax = (
            (gross_revenue * max(request.percentage_tax_rate, 0.0)) / 100.0 if request.apply_percentage_tax else 0.0
        )
        vat_due = gross_revenue * 0.12 if request.vat_registered else 0.0
        total_tax = income_tax + percentage_tax + vat_due
        effective_rate = (total_tax / gross_revenue * 100.0) if gross_revenue > 0 else 0.0

        deduction_opportunities: List[DeductionOpportunity] = []
        tracked_categories = {entry.label.lower() for entry in request.other_deductions}
        statutory_categories = {
            "sss": "Include SSS contributions made for the proprietor to lower taxable income.",
            "philhealth": "PhilHealth premiums qualify as allowable deductions when properly documented.",
            "pag-ibig": "Pag-IBIG savings and MP2 dividends may be deductible—keep official receipts ready.",
            "pera": "Personal Equity and Retirement Account (PERA) contributions can be deducted up to statutory limits.",
            "depreciation": "Consider depreciating large equipment purchases instead of expensing them upfront.",
        }
        for keyword, message in statutory_categories.items():
            if keyword not in tracked_categories:
                deduction_opportunities.append(DeductionOpportunity(category=keyword, message=message))

        if gross_revenue > 0 and total_operating_expenses / gross_revenue < 0.2:
            deduction_opportunities.append(
                DeductionOpportunity(
                    category="operating expenses",
                    message="Operating expenses are below 20% of revenue. Review utilities, rent, and admin costs to ensure"
                    " everything is captured.",
                )
            )

        has_online_sales = any(
            "retail" in entry.label.lower() or "online" in entry.label.lower() for entry in request.incomes
        )
        if has_online_sales and gross_revenue > 0 and total_cost_of_sales / gross_revenue < 0.1:
            deduction_opportunities.append(
                DeductionOpportunity(
                    category="marketplace fees",
                    message="Online retail revenue detected. Track platform commissions and payment gateway charges as cost"
                    " of sales to reduce taxable income.",
                )
            )

        return TaxComputationResponse(
            gross_revenue=gross_revenue,
            total_cost_of_sales=total_cost_of_sales,
            total_operating_expenses=total_operating_expenses,
            total_other_deductions=total_other_deductions,
            taxable_income=taxable_income,
            income_tax=income_tax,
            percentage_tax=percentage_tax,
            vat_due=vat_due,
            total_tax=total_tax,
            effective_tax_rate=effective_rate,
            deduction_opportunities=deduction_opportunities,
        )

    def pricing_suggestions(self) -> List[PricingSuggestion]:
        suggestions: List[PricingSuggestion] = []
        target_margin = 0.45
        for project in self.project_financials():
            revenue = project.total_collected or project.total_invoiced
            if revenue <= 0:
                continue

            current_margin = (project.net_revenue / revenue) if revenue else 0.0
            expenses = project.total_expenses
            recommended_rate = revenue
            adjustment_pct = 0.0
            rationale_parts: List[str] = []

            if current_margin < target_margin:
                recommended_rate = expenses / (1 - target_margin) if expenses > 0 else revenue
                adjustment_pct = ((recommended_rate - revenue) / revenue) * 100 if revenue else 0.0
                rationale_parts.append(
                    f"Margin is {current_margin * 100:.1f}% which is below the {target_margin * 100:.0f}% target."
                )
                rationale_parts.append("Recommend increasing rates or introducing premium packages to protect margin.")
            else:
                rationale_parts.append(
                    "Healthy margin achieved. Consider bundling value-add services to capture more revenue while maintaining"
                    " utilization."
                )

            suggestions.append(
                PricingSuggestion(
                    project_id=project.project_id,
                    service=project.project_name,
                    current_rate=revenue,
                    recommended_rate=recommended_rate,
                    current_margin=current_margin * 100,
                    recommended_adjustment_pct=adjustment_pct,
                    rationale=" ".join(rationale_parts),
                    currency=project.currency,
                )
            )

        suggestions.sort(key=lambda suggestion: suggestion.recommended_adjustment_pct, reverse=True)
        return suggestions

    def support_summary(self) -> SupportSummary:
        open_tickets = sum(1 for ticket in self.tickets.values() if ticket.status in {TicketStatus.OPEN, TicketStatus.IN_PROGRESS})
        breached = sum(1 for ticket in self.tickets.values() if ticket.sla_due and ticket.sla_due < datetime.utcnow())
        return SupportSummary(
            open_tickets=open_tickets,
            breached_slas=breached,
            response_time_minutes=28.5,
        )

    def marketing_summary(self) -> MarketingSummary:
        scheduled = sum(1 for content in self.content_items.values() if content.status == ContentStatus.SCHEDULED)
        return MarketingSummary(
            active_campaigns=sum(1 for campaign in self.campaigns.values()),
            scheduled_posts=scheduled,
            avg_engagement_rate=4.6,
        )

    def monitoring_summary(self) -> MonitoringSummary:
        response_times = [check.last_response_time_ms for check in self.checks.values() if check.last_response_time_ms]
        avg_response = int(sum(response_times) / len(response_times)) if response_times else 0
        incidents_today = sum(1 for alert in self.alerts.values() if alert.triggered_at.date() == datetime.utcnow().date())
        failing_checks = sum(1 for check in self.checks.values() if check.status != "passing")
        return MonitoringSummary(
            monitored_sites=len(self.sites),
            incidents_today=incidents_today,
            avg_response_time_ms=avg_response,
            failing_checks=failing_checks,
        )

    def resource_capacity(self) -> List[ResourceCapacity]:
        today = date.today()
        horizon = today + timedelta(days=14)
        capacities: List[ResourceCapacity] = []
        for employee in self.employees.values():
            available_hours: float
            billable_ratio: float
            override = self.capacity_overrides.get(employee.id)
            if override:
                available_hours, billable_ratio = override
            else:
                upcoming = [
                    request
                    for request in self.time_off.values()
                    if request.employee_id == employee.id
                    and request.status != TimeOffStatus.REJECTED
                    and request.start_date <= horizon
                    and request.end_date >= today
                ]
                time_off_days = sum((request.end_date - request.start_date).days + 1 for request in upcoming)
                available_hours = max(12.0, 36.0 - time_off_days * 8)
                billable_ratio = 0.72

            capacities.append(
                ResourceCapacity(
                    user_id=employee.id,
                    available_hours=round(available_hours, 1),
                    billable_ratio=round(billable_ratio, 2),
                )
            )

        capacities.sort(key=lambda record: record.available_hours)
        return capacities

    def site_statuses(self) -> List[SiteStatus]:
        statuses: List[SiteStatus] = []
        for site in self.sites.values():
            checks = [check for check in self.checks.values() if check.site_id == site.id]
            alerts = [alert for alert in self.alerts.values() if alert.site_id == site.id]
            statuses.append(SiteStatus(site=site, checks=checks, alerts=alerts))
        return statuses

    def operations_snapshot(self) -> OperationsSnapshot:
        now = datetime.utcnow()
        macro = self.macro_financials()
        cash_on_hand = max(macro.total_collected - macro.total_expenses, 0.0)

        expenses_by_month = defaultdict(float)
        for expense in self.expenses.values():
            key = (expense.incurred_at.year, expense.incurred_at.month)
            expenses_by_month[key] += expense.amount
        trailing_months = len(expenses_by_month)
        trailing_burn = (
            sum(expenses_by_month.values()) / trailing_months if trailing_months else 0.0
        )
        baseline_burn = sum(self.operating_expense_baselines.values()) + sum(
            self.statutory_contributions.values()
        )
        monthly_burn = max(trailing_burn, baseline_burn)
        runway_days = int((cash_on_hand / monthly_burn) * 30) if monthly_burn else None
        collection_rate = (
            macro.total_collected / macro.total_invoiced if macro.total_invoiced else 1.0
        )

        cash = CashRunway(
            total_cash_on_hand=round(cash_on_hand, 2),
            monthly_burn_rate=round(monthly_burn, 2),
            runway_days=runway_days,
            outstanding_invoices=round(macro.total_outstanding, 2),
            upcoming_payables=round(baseline_burn, 2),
            collection_rate=round(collection_rate, 2),
        )

        at_risk_projects: List[OperationsProject] = []
        for project in self.project_portfolio():
            if project.health not in {ProjectHealth.AT_RISK, ProjectHealth.BLOCKED}:
                continue
            next_title = project.next_milestone.title if project.next_milestone else None
            next_due = project.next_milestone.due_date if project.next_milestone else None
            at_risk_projects.append(
                OperationsProject(
                    project_id=project.project_id,
                    project_name=project.name,
                    client_name=project.client_name,
                    health=project.health,
                    progress=round(project.progress, 1),
                    late_tasks=project.late_tasks,
                    next_milestone_title=next_title,
                    next_milestone_due=next_due,
                    active_sprint_name=project.active_sprint_name,
                    sprint_committed_points=project.sprint_committed_points,
                    sprint_completed_points=project.sprint_completed_points,
                    velocity=project.velocity,
                )
            )
        at_risk_projects.sort(
            key=lambda entry: (
                entry.health != ProjectHealth.BLOCKED,
                -entry.late_tasks,
                entry.progress,
            )
        )

        capacity_alerts: List[CapacityAlert] = []
        for capacity in self.resource_capacity():
            employee = self.employees.get(capacity.user_id)
            if not employee:
                continue
            reasons: List[str] = []
            if capacity.available_hours <= 24:
                reasons.append(
                    f"Only {capacity.available_hours:.0f}h availability remaining in next sprint"
                )
            if capacity.billable_ratio >= 0.8:
                reasons.append(
                    f"Billable load at {capacity.billable_ratio * 100:.0f}%"
                )
            if not reasons:
                continue
            capacity_alerts.append(
                CapacityAlert(
                    employee_id=capacity.user_id,
                    employee_name=f"{employee.first_name} {employee.last_name}",
                    available_hours=capacity.available_hours,
                    billable_ratio=capacity.billable_ratio,
                    reason="; ".join(reasons),
                )
            )

        upcoming_time_off: List[TimeOffWindow] = []
        horizon = now.date() + timedelta(days=45)
        for request in self.time_off.values():
            if request.status == TimeOffStatus.REJECTED:
                continue
            if request.start_date < now.date():
                continue
            if request.start_date > horizon:
                continue
            employee = self.employees.get(request.employee_id)
            if not employee:
                continue
            upcoming_time_off.append(
                TimeOffWindow(
                    employee_id=request.employee_id,
                    employee_name=f"{employee.first_name} {employee.last_name}",
                    start_date=request.start_date,
                    end_date=request.end_date,
                    status=request.status,
                )
            )
        upcoming_time_off.sort(key=lambda window: window.start_date)

        monitoring_incidents: List[MonitoringIncident] = []
        for status in self.site_statuses():
            for alert in status.alerts:
                if alert.acknowledged:
                    continue
                monitoring_incidents.append(
                    MonitoringIncident(
                        site_id=status.site.id,
                        site_label=status.site.label,
                        severity=alert.severity,
                        triggered_at=alert.triggered_at,
                        message=alert.message,
                        acknowledged=alert.acknowledged,
                    )
                )
        monitoring_incidents.sort(
            key=lambda incident: incident.triggered_at,
            reverse=True,
        )

        recommendations: List[OperationsRecommendation] = []
        if runway_days is not None and runway_days < 120:
            recommendations.append(
                OperationsRecommendation(
                    title="Extend cash runway",
                    description=(
                        "Cash coverage is under four months. Review retainers, pause discretionary spend, "
                        "and fast-track invoicing."
                    ),
                    category="finance",
                    impact="high",
                )
            )
        if at_risk_projects:
            project_names = ", ".join(
                project.project_name for project in at_risk_projects[:2]
            )
            recommendations.append(
                OperationsRecommendation(
                    title="Stabilise delivery timelines",
                    description=(
                        f"Escalate blockers for {project_names} to protect hospitality launch commitments."
                    ),
                    category="projects",
                    impact="high"
                    if any(project.health == ProjectHealth.BLOCKED for project in at_risk_projects)
                    else "medium",
                )
            )
        if capacity_alerts:
            recommendations.append(
                OperationsRecommendation(
                    title="Rebalance workloads",
                    description=(
                        "Team capacity is stretched; consider contracting support or reassigning billable work."
                    ),
                    category="people",
                    impact="medium",
                )
            )
        if monitoring_incidents:
            recommendations.append(
                OperationsRecommendation(
                    title="Resolve client portal outage",
                    description=(
                        "Active monitoring incidents require attention before the next client status sync."
                    ),
                    category="technology",
                    impact="high",
                )
            )
        if not recommendations:
            recommendations.append(
                OperationsRecommendation(
                    title="Operations steady",
                    description="No critical risks detected across finance, delivery, or infrastructure.",
                    category="summary",
                    impact="low",
                )
            )

        return OperationsSnapshot(
            generated_at=now,
            cash=cash,
            at_risk_projects=at_risk_projects,
            capacity_alerts=capacity_alerts,
            upcoming_time_off=upcoming_time_off,
            monitoring_incidents=monitoring_incidents,
            recommendations=recommendations,
        )


store = InMemoryStore()
