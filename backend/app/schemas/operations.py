from datetime import date, datetime
from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from .hr import TimeOffStatus
from .projects import ProjectHealth


class CashRunway(BaseModel):
    total_cash_on_hand: float
    monthly_burn_rate: float
    runway_days: Optional[int]
    outstanding_invoices: float
    upcoming_payables: float
    collection_rate: float


class OperationsProject(BaseModel):
    project_id: str
    project_name: str
    client_name: Optional[str]
    health: ProjectHealth
    progress: float
    late_tasks: int
    next_milestone_title: Optional[str]
    next_milestone_due: Optional[datetime]
    active_sprint_name: Optional[str] = None
    sprint_committed_points: Optional[float] = None
    sprint_completed_points: Optional[float] = None
    velocity: Optional[float] = None


class CapacityAlert(BaseModel):
    employee_id: str
    employee_name: str
    available_hours: float
    billable_ratio: float
    reason: str


class TimeOffWindow(BaseModel):
    employee_id: str
    employee_name: str
    start_date: date
    end_date: date
    status: TimeOffStatus


class MonitoringIncident(BaseModel):
    site_id: str
    site_label: str
    severity: str
    triggered_at: datetime
    message: str
    acknowledged: bool


class OperationsRecommendation(BaseModel):
    title: str
    description: str
    category: str
    impact: str


class OperationsSnapshot(BaseModel):
    generated_at: datetime
    cash: CashRunway
    at_risk_projects: List[OperationsProject] = Field(default_factory=list)
    capacity_alerts: List[CapacityAlert] = Field(default_factory=list)
    upcoming_time_off: List[TimeOffWindow] = Field(default_factory=list)
    monitoring_incidents: List[MonitoringIncident] = Field(default_factory=list)
    recommendations: List[OperationsRecommendation] = Field(default_factory=list)
