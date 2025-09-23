from pydantic import BaseModel

from .clients import ClientSummary
from .projects import ProjectSummary
from .financials import FinancialSummary
from .support import SupportSummary
from .marketing import MarketingSummary
from .monitoring import MonitoringSummary


class DashboardSnapshot(BaseModel):
    projects: ProjectSummary
    clients: ClientSummary
    financials: FinancialSummary
    support: SupportSummary
    marketing: MarketingSummary
    monitoring: MonitoringSummary
