"""Automation utilities for synthesizing suggested follow-up tasks."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, time, timedelta
from typing import Iterable, List

from ..schemas.automation import (
    AutomationCategory,
    AutomationDigest,
    AutomationPriority,
    AutomationTask,
)
from ..schemas.clients import ClientEngagement
from ..schemas.financials import Invoice, InvoiceStatus
from ..schemas.hr import Employee, TimeOffStatus
from ..schemas.marketing import Campaign, ContentItem, ContentStatus
from ..schemas.monitoring import Site
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
            employees=self._store.employees,
            campaigns=self._store.campaigns,
            sites=self._store.sites,
        )

        tasks.extend(self._client_tasks(context.clients.values()))
        tasks.extend(self._project_tasks())
        tasks.extend(self._financial_tasks())
        tasks.extend(self._support_tasks())
        tasks.extend(self._marketing_tasks(context))
        tasks.extend(self._monitoring_tasks(context))
        tasks.extend(self._hr_tasks(context))

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
                )
            )
        return tasks

    def _financial_tasks(self) -> List[AutomationTask]:
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

            tasks.append(
                AutomationTask(
                    category=AutomationCategory.FINANCE,
                    summary=f"Send reminder for invoice {invoice.number}",
                    priority=priority,
                    due_at=due_at,
                    details=f"Balance due ${balance:,.2f} by {invoice.due_date.date()}",
                    related_ids={"invoice_id": invoice.id, "client_id": invoice.client_id},
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
                )
            )
        return tasks

    def _invoice_balance(self, invoice: Invoice) -> float:
        payments = [payment.amount for payment in self._store.payments.values() if payment.invoice_id == invoice.id]
        total_paid = sum(payments)
        total_invoiced = sum(item.total for item in invoice.items) if invoice.items else 0.0
        return max(total_invoiced - total_paid, 0.0)

