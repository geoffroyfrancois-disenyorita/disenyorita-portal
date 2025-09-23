from typing import List

from fastapi import APIRouter

from ...schemas.monitoring import MonitoringSummary, SiteStatus
from ...services.data import store

router = APIRouter(prefix="/monitoring", tags=["monitoring"])


@router.get("/sites", response_model=List[SiteStatus])
def list_site_statuses() -> List[SiteStatus]:
    return store.site_statuses()


@router.get("/summary", response_model=MonitoringSummary)
def monitoring_summary() -> MonitoringSummary:
    return store.monitoring_summary()
