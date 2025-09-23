from typing import List

from fastapi import APIRouter, HTTPException

from ...schemas.clients import Client, ClientSummary
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
