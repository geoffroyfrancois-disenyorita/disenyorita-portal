from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from .common import IdentifiedModel


class Site(IdentifiedModel):
    url: str
    label: str
    brand: str
    active: bool = True


class Check(IdentifiedModel):
    site_id: str
    type: str
    status: str
    last_run: datetime
    last_response_time_ms: Optional[int] = None


class Alert(IdentifiedModel):
    site_id: str
    message: str
    severity: str
    triggered_at: datetime
    acknowledged: bool = False


class MonitoringSummary(BaseModel):
    monitored_sites: int
    incidents_today: int
    avg_response_time_ms: int
    failing_checks: int


class SiteStatus(BaseModel):
    site: Site
    checks: List[Check] = Field(default_factory=list)
    alerts: List[Alert] = Field(default_factory=list)
