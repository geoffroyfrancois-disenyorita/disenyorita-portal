from __future__ import annotations

from datetime import datetime, timedelta
from typing import Dict, List

from ..schemas.clients import (
    Client,
    ClientCreateRequest,
    ClientDashboard,
    ClientFinancialSnapshot,
    ClientInvoiceDigest,
    ClientPaymentDigest,
    ClientProjectDigest,
    ClientSegment,
    ClientSummary,
    ClientSupportSnapshot,
    ClientTicketDigest,
    ClientWithProjects,
    Contact,
    Document,
    Industry,
    Interaction,
    InteractionChannel,
)
from ..schemas.projects import (
    Milestone,
    Project,
    ProjectStatus,
    ProjectSummary,
    ProjectTemplateType,
    Task,
    TaskStatus,
)
from ..schemas.financials import Expense, FinancialSummary, Invoice, InvoiceStatus, LineItem, Payment
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
