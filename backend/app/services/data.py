from __future__ import annotations

from datetime import datetime, timedelta
from typing import Dict, List

from ..schemas.clients import Client, ClientSegment, Contact, Document, Industry, Interaction, InteractionChannel, ClientSummary
from ..schemas.projects import Milestone, Project, ProjectStatus, Task, TaskStatus, ProjectSummary
from ..schemas.financials import Expense, FinancialSummary, Invoice, InvoiceStatus, LineItem, Payment
from ..schemas.support import Channel, KnowledgeArticle, Message, SupportSummary, Ticket, TicketStatus
from ..schemas.hr import Employee, EmploymentType, ResourceCapacity, Skill, TimeOffRequest, TimeOffStatus
from ..schemas.marketing import Campaign, Channel as MarketingChannel, ContentItem, ContentStatus, MarketingSummary, MetricSnapshot
from ..schemas.monitoring import Alert, Check, MonitoringSummary, Site, SiteStatus


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
            project_type="website_design",
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
            project_type="hotel_audit",
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
