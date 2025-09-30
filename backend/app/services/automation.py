"""Automation utilities for synthesizing suggested follow-up tasks."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, time, timedelta
from typing import Iterable, List
from urllib.parse import quote_plus

from ..schemas.automation import (
    AutomationCategory,
    AutomationDigest,
    AutomationPriority,
    AutomationTask,
)
from ..schemas.clients import Client, ClientEngagement
from ..schemas.financials import Invoice, InvoiceStatus
from ..schemas.hr import Employee, TimeOffStatus
from ..schemas.marketing import Campaign, ContentItem, ContentStatus
from ..schemas.monitoring import Check, Site
from ..schemas.projects import ProjectHealth, ProjectStatus
from ..schemas.support import TicketStatus
from .data import InMemoryStore


_PRIORITY_ORDER = {
    AutomationPriority.CRITICAL: 0,
    AutomationPriority.HIGH: 1,
    AutomationPriority.MEDIUM: 2,
    AutomationPriority.LOW: 3,
}


@dataclass
class _Context:
    """Lightweight cache of frequently accessed store entities."""

    clients: dict[str, ClientEngagement]
    client_records: dict[str, Client]
    employees: dict[str, Employee]
    campaigns: dict[str, Campaign]
    sites: dict[str, Site]


class AutomationEngine:
    """Generate actionable suggestions derived from the in-memory store."""

    def __init__(self, store: InMemoryStore, *, now: datetime | None = None) -> None:
        self._store = store
        self._now = now

    @property
    def now(self) -> datetime:
        return self._now or datetime.utcnow()

    def generate_digest(self) -> AutomationDigest:
        """Build a digest capturing automation tasks across domains."""

        tasks: List[AutomationTask] = []

        context = _Context(
            clients={eng.client_id: eng for eng in self._store.client_engagements()},
            client_records=self._store.clients,
            employees=self._store.employees,
            campaigns=self._store.campaigns,
            sites=self._store.sites,
        )

        tasks.extend(self._client_tasks(context.clients.values()))
        tasks.extend(self._project_tasks())
        tasks.extend(self._financial_tasks(context))
        tasks.extend(self._support_tasks())
        tasks.extend(self._marketing_tasks(context))
        tasks.extend(self._monitoring_tasks(context))
        tasks.extend(self._hr_tasks(context))
        tasks.extend(self._recurring_tasks(context))
        tasks.extend(self._tax_tasks())

        tasks.sort(key=self._sort_key)
        return AutomationDigest(generated_at=self.now, tasks=tasks)

    @staticmethod
    def _sort_key(task: AutomationTask) -> tuple[int, float]:
        priority_rank = _PRIORITY_ORDER[task.priority]
        due = task.due_at.timestamp() if task.due_at is not None else float("inf")
        return priority_rank, due

    def _client_tasks(self, engagements: Iterable[ClientEngagement]) -> List[AutomationTask]:
        tasks: List[AutomationTask] = []
        for engagement in engagements:
            if engagement.health not in {"at_risk", "needs_attention"}:
                continue

            if engagement.health == "needs_attention":
                priority = AutomationPriority.CRITICAL
                due_at = self.now
            else:
                priority = AutomationPriority.HIGH
                due_at = self.now + timedelta(days=1)

            details: list[str] = []
            if engagement.late_projects:
                details.append(f"{engagement.late_projects} late projects")
            if engagement.outstanding_balance:
                balance = f"₱{engagement.outstanding_balance:,.2f}" if engagement.segment.value == "vip" else f"${engagement.outstanding_balance:,.2f}"
                details.append(f"Outstanding balance of {balance}")
            if engagement.next_milestone:
                due_delta = engagement.next_milestone.due_date - self.now
                details.append(
                    "Next milestone '"
                    + engagement.next_milestone.title
                    + f"' due in {due_delta.days} days"
                )

            tasks.append(
                AutomationTask(
                    category=AutomationCategory.CLIENT,
                    summary=f"Check in with {engagement.organization_name}",
                    priority=priority,
                    due_at=due_at,
                    details="; ".join(details) if details else None,
                    related_ids={"client_id": engagement.client_id},
                    action_label="Open client dashboard",
                    action_url=f"/clients/{engagement.client_id}",
                )
            )
        return tasks

    def _project_tasks(self) -> List[AutomationTask]:
        tasks: List[AutomationTask] = []
        for progress in self._store.project_portfolio():
            if progress.status in {ProjectStatus.CANCELLED, ProjectStatus.COMPLETED}:
                continue

            if progress.health == ProjectHealth.BLOCKED:
                priority = AutomationPriority.CRITICAL
            elif progress.health == ProjectHealth.AT_RISK:
                priority = AutomationPriority.HIGH
            else:
                priority = AutomationPriority.MEDIUM

            details: list[str] = []
            if progress.late_tasks:
                details.append(f"{progress.late_tasks} tasks late")
            if progress.next_milestone:
                due_delta = progress.next_milestone.due_date - self.now
                if due_delta <= timedelta(days=14):
                    due_at = progress.next_milestone.due_date
                else:
                    due_at = None
                details.append(
                    f"Next milestone '{progress.next_milestone.title}' due {progress.next_milestone.due_date.date()}"
                )
            else:
                due_at = None

            tasks.append(
                AutomationTask(
                    category=AutomationCategory.PROJECT,
                    summary=f"Review project plan for {progress.name}",
                    priority=priority,
                    due_at=due_at,
                    details="; ".join(details) if details else None,
                    related_ids={
                        "project_id": progress.project_id,
                        "client_id": progress.client_id,
                    },
                    action_label="Review project",
                    action_url=f"/projects/{progress.project_id}",
                )
            )
        return tasks

    def _financial_tasks(self, context: _Context) -> List[AutomationTask]:
        tasks: List[AutomationTask] = []
        for invoice in self._store.invoices.values():
            if invoice.status not in {InvoiceStatus.SENT, InvoiceStatus.OVERDUE}:
                continue

            balance = self._invoice_balance(invoice)
            if balance <= 0:
                continue

            if invoice.status == InvoiceStatus.OVERDUE:
                priority = AutomationPriority.CRITICAL
                due_at = self.now
            else:
                days_until_due = (invoice.due_date - self.now).days
                priority = AutomationPriority.HIGH if days_until_due <= 14 else AutomationPriority.MEDIUM
                due_at = invoice.due_date if days_until_due <= 21 else None

            client = context.client_records.get(invoice.client_id)
            if client:
                subject = quote_plus(f"Invoice {invoice.number} payment reminder")
                body = quote_plus(
                    "Hi team, just a friendly reminder that invoice "
                    f"{invoice.number} is due on {invoice.due_date.date()}. Please let us know if you need anything."
                )
                action_url = f"mailto:{client.billing_email}?subject={subject}&body={body}"
            else:
                action_url = "/financials"

            tasks.append(
                AutomationTask(
                    category=AutomationCategory.FINANCE,
                    summary=f"Send reminder for invoice {invoice.number}",
                    priority=priority,
                    due_at=due_at,
                    details=f"Balance due ${balance:,.2f} by {invoice.due_date.date()}",
                    related_ids={"invoice_id": invoice.id, "client_id": invoice.client_id},
                    action_label="Send reminder",
                    action_url=action_url,
                )
            )
        return tasks

    def _support_tasks(self) -> List[AutomationTask]:
        tasks: List[AutomationTask] = []
        for ticket in self._store.tickets.values():
            if ticket.status in {TicketStatus.RESOLVED, TicketStatus.CLOSED}:
                continue

            if ticket.sla_due and ticket.sla_due < self.now:
                priority = AutomationPriority.CRITICAL
                due_at = self.now
            elif ticket.priority.lower() in {"urgent", "high"}:
                priority = AutomationPriority.HIGH
                due_at = ticket.sla_due or self.now + timedelta(hours=2)
            else:
                priority = AutomationPriority.MEDIUM
                due_at = ticket.sla_due

            tasks.append(
                AutomationTask(
                    category=AutomationCategory.SUPPORT,
                    summary=f"Follow up on ticket '{ticket.subject}'",
                    priority=priority,
                    due_at=due_at,
                    details=f"Status: {ticket.status.value}, Priority: {ticket.priority}",
                    related_ids={"ticket_id": ticket.id, "client_id": ticket.client_id},
                    suggested_assignee=ticket.assignee_id,
                    action_label="Open ticket",
                    action_url=f"/support?ticketId={ticket.id}",
                )
            )
        return tasks

    def _marketing_tasks(self, context: _Context) -> List[AutomationTask]:
        tasks: List[AutomationTask] = []
        for content in self._store.content_items.values():
            if content.status != ContentStatus.SCHEDULED or not content.scheduled_for:
                continue

            delta = content.scheduled_for - self.now
            if delta > timedelta(days=2):
                continue

            campaign = context.campaigns.get(content.campaign_id) if content.campaign_id else None
            summary = f"Prep scheduled content '{content.title}'"
            details = [f"Platform: {content.platform}" if content.platform else "Scheduled content"]
            if campaign:
                details.append(f"Campaign: {campaign.name}")

            related_ids = {"content_id": content.id}
            if content.campaign_id:
                related_ids["campaign_id"] = content.campaign_id

            tasks.append(
                AutomationTask(
                    category=AutomationCategory.MARKETING,
                    summary=summary,
                    priority=AutomationPriority.MEDIUM,
                    due_at=content.scheduled_for,
                    details="; ".join(details),
                    related_ids=related_ids,
                    suggested_assignee=campaign.owner_id if campaign else None,
                    action_label="Prep content",
                    action_url=f"/marketing?contentId={content.id}",
                )
            )
        return tasks

    def _monitoring_tasks(self, context: _Context) -> List[AutomationTask]:
        tasks: List[AutomationTask] = []
        for alert in self._store.alerts.values():
            if alert.acknowledged:
                continue

            severity = alert.severity.lower()
            if severity in {"critical", "severe"}:
                priority = AutomationPriority.CRITICAL
            elif severity in {"warning", "high"}:
                priority = AutomationPriority.HIGH
            else:
                priority = AutomationPriority.MEDIUM

            site = context.sites.get(alert.site_id)
            site_label = site.label if site else "Unknown site"

            tasks.append(
                AutomationTask(
                    category=AutomationCategory.MONITORING,
                    summary=f"Investigate alert on {site_label}",
                    priority=priority,
                    due_at=alert.triggered_at + timedelta(hours=6),
                    details=alert.message,
                    related_ids={"alert_id": alert.id, "site_id": alert.site_id},
                    action_label="Open incident",
                    action_url=f"/monitoring?alertId={alert.id}",
                )
            )
        return tasks

    def _hr_tasks(self, context: _Context) -> List[AutomationTask]:
        tasks: List[AutomationTask] = []
        for request in self._store.time_off.values():
            if request.status != TimeOffStatus.PENDING:
                continue

            employee = context.employees.get(request.employee_id)
            assignee = employee.manager_id if employee else None
            employee_name = f"{employee.first_name} {employee.last_name}" if employee else "Team member"
            start_datetime = datetime.combine(request.start_date, time.min)
            due_at = start_datetime - timedelta(days=2)

            tasks.append(
                AutomationTask(
                    category=AutomationCategory.HR,
                    summary=f"Review time-off request for {employee_name}",
                    priority=AutomationPriority.MEDIUM,
                    due_at=due_at,
                    details=f"Requested {request.start_date} to {request.end_date}",
                    related_ids={"time_off_request_id": request.id, "employee_id": request.employee_id},
                    suggested_assignee=assignee,
                    action_label="Approve leave",
                    action_url=f"/hr?requestId={request.id}",
                )
            )
        return tasks

    def _recurring_tasks(self, context: _Context) -> List[AutomationTask]:
        tasks: List[AutomationTask] = []
        renewal_window = timedelta(days=45)
        for client in self._store.clients.values():
            for document in client.documents:
                if not document.signed:
                    continue
                if "retainer" not in document.name.lower() and "contract" not in document.name.lower():
                    continue

                renewal_date = document.created_at + timedelta(days=365)
                if renewal_date < self.now - timedelta(days=5):
                    continue
                if renewal_date - self.now > renewal_window:
                    continue

                if renewal_date <= self.now:
                    priority = AutomationPriority.CRITICAL
                    due_at = self.now
                else:
                    priority = AutomationPriority.HIGH
                    due_at = renewal_date - timedelta(days=15)

                tasks.append(
                    AutomationTask(
                        category=AutomationCategory.CLIENT,
                        summary=f"Prep contract renewal for {client.organization_name}",
                        priority=priority,
                        due_at=due_at,
                        details=f"Retainer version {document.version} expires {renewal_date.date()}",
                        related_ids={"client_id": client.id, "document_id": document.id},
                        action_label="Review agreement",
                        action_url=document.url,
                    )
                )

        for content in self._store.content_items.values():
            if content.status != ContentStatus.DRAFT:
                continue
            age = self.now - content.created_at
            if age < timedelta(days=3):
                continue

            campaign = context.campaigns.get(content.campaign_id) if content.campaign_id else None
            due_at = content.scheduled_for - timedelta(days=1) if content.scheduled_for else self.now + timedelta(days=1)
            details = [f"Platform: {content.platform}" if content.platform else "Draft content awaiting approval"]
            if campaign:
                details.append(f"Campaign: {campaign.name}")

            tasks.append(
                AutomationTask(
                    category=AutomationCategory.MARKETING,
                    summary=f"Approve content '{content.title}'",
                    priority=AutomationPriority.HIGH,
                    due_at=due_at,
                    details="; ".join(details),
                    related_ids={"content_id": content.id},
                    suggested_assignee=campaign.owner_id if campaign else None,
                    action_label="Approve content",
                    action_url=f"/marketing?contentId={content.id}",
                )
            )

        for check in self._store.checks.values():
            check_type = check.type.lower()
            if "soc" not in check_type and "compliance" not in check_type:
                continue

            time_since_audit = self.now - check.last_run
            if time_since_audit < timedelta(days=30):
                continue

            due_at_candidate = check.last_run + timedelta(days=35)
            due_at = due_at_candidate if due_at_candidate > self.now else self.now + timedelta(days=1)
            site = context.sites.get(check.site_id)
            site_label = site.label if site else "Infrastructure"

            tasks.append(
                AutomationTask(
                    category=AutomationCategory.MONITORING,
                    summary=f"Run SOC control review for {site_label}",
                    priority=AutomationPriority.HIGH,
                    due_at=due_at,
                    details=f"Last audit ran {time_since_audit.days} days ago",
                    related_ids={"check_id": check.id, "site_id": check.site_id},
                    action_label="Review controls",
                    action_url=f"/monitoring?checkId={check.id}",
                )
            )

        return tasks

    def _tax_tasks(self) -> List[AutomationTask]:
        tasks: List[AutomationTask] = []
        profile = self._store.tax_profile()
        today = self.now.date()
        for tip in profile.computed.deduction_opportunities:
            tasks.append(
                AutomationTask(
                    category=AutomationCategory.FINANCE,
                    summary=f"Document {tip.category.upper()} deductions",
                    priority=AutomationPriority.MEDIUM,
                    due_at=self.now + timedelta(days=7),
                    details=tip.message,
                    related_ids={"tax_profile": "philippines"},
                    action_label="Open tax planner",
                    action_url="/financials/tax-calculator",
                )
            )
        for obligation in profile.filing_calendar:
            due_date = obligation.due_date
            if due_date < today:
                continue
            days_until_due = (due_date - today).days
            priority = AutomationPriority.HIGH if days_until_due <= 14 else AutomationPriority.MEDIUM
            tasks.append(
                AutomationTask(
                    category=AutomationCategory.FINANCE,
                    summary=f"Prepare {obligation.form} for {obligation.period}",
                    priority=priority,
                    due_at=datetime.combine(due_date, time(hour=10)),
                    details=(
                        f"{obligation.frequency} filing due on {due_date.strftime('%B %d, %Y')} — {obligation.description}"
                    ),
                    related_ids={
                        "tax_profile": "philippines",
                        "form": obligation.form,
                        "period": obligation.period,
                    },
                    action_label="Open tax planner",
                    action_url="/financials/tax-calculator",
                )
            )
        return tasks

    def _invoice_balance(self, invoice: Invoice) -> float:
        payments = [payment.amount for payment in self._store.payments.values() if payment.invoice_id == invoice.id]
        total_paid = sum(payments)
        total_invoiced = sum(item.total for item in invoice.items) if invoice.items else 0.0
        return max(total_invoiced - total_paid, 0.0)

