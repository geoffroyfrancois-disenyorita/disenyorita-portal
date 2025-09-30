from typing import List

from fastapi import APIRouter, HTTPException, status

from ...schemas.clients import (
    Client,
    ClientCRMOverview,
    ClientCreateRequest,
    ClientDashboard,
    ClientEngagement,
    ClientSummary,
    ClientUpdateRequest,
    ClientWithProjects,
)
from ...services.data import store

router = APIRouter(prefix="/clients", tags=["clients"])


@router.get("", response_model=List[Client])
def list_clients() -> List[Client]:
    return list(store.clients.values())


@router.get("/summary", response_model=ClientSummary)
def client_summary() -> ClientSummary:
    return store.client_summary()


@router.get("/engagements", response_model=List[ClientEngagement])
def client_engagements() -> List[ClientEngagement]:
    return store.client_engagements()


@router.get("/crm/overview", response_model=ClientCRMOverview)
def client_crm_overview() -> ClientCRMOverview:
    return store.client_crm_overview()


@router.post("", response_model=ClientWithProjects, status_code=status.HTTP_201_CREATED)
def create_client(payload: ClientCreateRequest) -> ClientWithProjects:
    try:
        return store.create_client_with_projects(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/{client_id}", response_model=Client)
def get_client(client_id: str) -> Client:
    client = store.clients.get(client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return client


@router.patch("/{client_id}", response_model=Client)
def update_client(client_id: str, payload: ClientUpdateRequest) -> Client:
    try:
        return store.update_client(client_id, payload)
    except ValueError as exc:
        status_code = status.HTTP_404_NOT_FOUND if str(exc) == "Client not found" else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc


@router.get("/{client_id}/dashboard", response_model=ClientDashboard)
def client_dashboard(client_id: str) -> ClientDashboard:
    try:
        return store.client_dashboard(client_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
