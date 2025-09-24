from __future__ import annotations

from datetime import datetime, timedelta
from typing import Dict, List, Sequence

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
    ProjectUpdateRequest,
    Task,
    TaskStatus,
    TaskType,
    TaskUpdate,
)
from ..schemas.financials import (
    Currency,
    DeductionOpportunity,
    Expense,
    FinancialSummary,
    Invoice,
    InvoiceStatus,
    LineItem,
    MacroFinancials,
    Payment,
    PricingSuggestion,
    ProjectFinancials,
    TaxComputationRequest,
    TaxComputationResponse,
    TaxEntry,
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
                Document(name="2024 Retainer", url="https://files.example/retainer.pdf", uploaded_by="system", signed=True)
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
        discovery_task = Task(name="Discovery Workshop", status=TaskStatus.DONE, logged_hours=6)
        ux_task = Task(name="UX Wireframes", status=TaskStatus.IN_PROGRESS, estimated_hours=30, logged_hours=12)
        audit_task = Task(name="Operational Audit", status=TaskStatus.IN_PROGRESS, estimated_hours=40, logged_hours=18)
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
            tasks=[discovery_task, ux_task],
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
                LineItem(description="UX Design", quantity=1, unit_price=6000, total=6000),
                LineItem(description="Development Sprint", quantity=1, unit_price=4000, total=4000),
            ],
        )
        self.invoices[invoice.id] = invoice
        payment = Payment(invoice_id=invoice.id, amount=5000, received_at=now - timedelta(days=3), method="stripe")
        self.payments[payment.id] = payment
        expense = Expense(project_id=website_project.id, category="Software", amount=320, incurred_at=now - timedelta(days=4))
        self.expenses[expense.id] = expense

        retainer_invoice = Invoice(
            client_id=disenyorita_client.id,
            project_id=audit_project.id,
            number="INV-2024-00087",
            status=InvoiceStatus.PAID,
            issue_date=now - timedelta(days=32),
            due_date=now - timedelta(days=2),
            items=[
                LineItem(description="On-site Audit", quantity=1, unit_price=5200, total=5200),
                LineItem(description="Reporting & Analysis", quantity=1, unit_price=1800, total=1800),
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
            category="Travel",
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
        employee = Employee(
            first_name="Avery",
            last_name="Nguyen",
            email="avery@disenyorita.example",
            employment_type=EmploymentType.EMPLOYEE,
            title="Project Manager",
            skills=[Skill(name="Hospitality Ops", proficiency=4)],
        )
        self.employees[employee.id] = employee
        time_off = TimeOffRequest(employee_id=employee.id, start_date=now.date() + timedelta(days=10), end_date=now.date() + timedelta(days=12))
        self.time_off[time_off.id] = time_off

        # Marketing
        campaign = Campaign(
            name="Summer Boutique Launch",
            objective="Promote new branding showcase",
            channel=MarketingChannel.SOCIAL,
            start_date=now - timedelta(days=2),
            owner_id=employee.id,
        )
        self.campaigns[campaign.id] = campaign
        content = ContentItem(campaign_id=campaign.id, title="Instagram Reel", status=ContentStatus.SCHEDULED, scheduled_for=now + timedelta(days=1), platform="instagram")
        self.content_items[content.id] = content
        metric = MetricSnapshot(content_id=None, impressions=15000, clicks=1200, conversions=85, spend=450)
        self.metrics[metric.id] = metric

        # Monitoring
        site = Site(url="https://disenyorita.example", label="Disenyorita Marketing", brand="disenyorita")
        self.sites[site.id] = site
        check = Check(site_id=site.id, type="uptime", status="passing", last_run=now - timedelta(minutes=15), last_response_time_ms=380)
        self.checks[check.id] = check
        alert = Alert(site_id=site.id, message="SSL certificate expires in 7 days", severity="warning", triggered_at=now - timedelta(hours=3))
        self.alerts[alert.id] = alert

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

        tasks = list(project.tasks)
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

        if task_updates is not None:
            existing_tasks: Dict[str, Task] = {task.id: task for task in tasks}
            for task_update in task_updates:
                base = existing_tasks.get(task_update.id)
                if not base:
                    continue
                update_fields = task_update.dict(exclude_unset=True)
                update_fields.pop("id", None)
                update_fields["updated_at"] = now
                existing_tasks[task_update.id] = base.copy(update=update_fields)
            tasks = [existing_tasks[task.id] for task in tasks if task.id in existing_tasks]

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

        if template_id or "start_date" in update_data or task_updates is not None or milestone_updates is not None:
            update_data["tasks"] = tasks
            update_data["milestones"] = milestones
            update_data["end_date"] = self._calculate_project_end(tasks, milestones)
            if "status" not in update_data:
                update_data["status"] = self._derive_project_status_from_tasks(tasks)

        update_data["updated_at"] = now

        updated_project = project.copy(update=update_data)
        self.projects[project_id] = updated_project
        return updated_project

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
            progress = (completed_tasks / total_tasks * 100.0) if total_tasks else 0.0
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
                )
            )
        portfolio.sort(key=lambda record: record.updated_at, reverse=True)
        return portfolio

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
        return [
            ResourceCapacity(user_id=employee.id, available_hours=32, billable_ratio=0.75)
            for employee in self.employees.values()
        ]

    def site_statuses(self) -> List[SiteStatus]:
        statuses: List[SiteStatus] = []
        for site in self.sites.values():
            checks = [check for check in self.checks.values() if check.site_id == site.id]
            alerts = [alert for alert in self.alerts.values() if alert.site_id == site.id]
            statuses.append(SiteStatus(site=site, checks=checks, alerts=alerts))
        return statuses


store = InMemoryStore()
