from fastapi import APIRouter

from ...schemas.dashboard import DashboardSnapshot
from ...schemas.operations import OperationsSnapshot
from ...services.data import store

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("", response_model=DashboardSnapshot)
def get_dashboard_snapshot() -> DashboardSnapshot:
    return DashboardSnapshot(
        projects=store.project_summary(),
        clients=store.client_summary(),
        financials=store.financial_summary(),
        support=store.support_summary(),
        marketing=store.marketing_summary(),
        monitoring=store.monitoring_summary(),
    )


@router.get("/operations", response_model=OperationsSnapshot)
def get_operations_snapshot() -> OperationsSnapshot:
    return store.operations_snapshot()
