from typing import List

from fastapi import APIRouter, HTTPException, status

from ...schemas.clients import (
    Client,
    ClientCreateRequest,
    ClientDashboard,
    ClientSummary,
    ClientWithProjects,
)
from ...services.data import store

router = APIRouter(prefix="/clients", tags=["clients"])


@router.get("", response_model=List[Client])
def list_clients() -> List[Client]:
    return list(store.clients.values())


@router.get("/{client_id}", response_model=Client)
def get_client(client_id: str) -> Client:
    client = store.clients.get(client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return client


@router.get("/summary", response_model=ClientSummary)
def client_summary() -> ClientSummary:
    return store.client_summary()


@router.post("", response_model=ClientWithProjects, status_code=status.HTTP_201_CREATED)
def create_client(payload: ClientCreateRequest) -> ClientWithProjects:
    try:
        return store.create_client_with_projects(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/{client_id}/dashboard", response_model=ClientDashboard)
def client_dashboard(client_id: str) -> ClientDashboard:
    try:
        return store.client_dashboard(client_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
