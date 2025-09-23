from typing import List

from fastapi import APIRouter, HTTPException

from ...schemas.support import KnowledgeArticle, SupportSummary, Ticket
from ...services.data import store

router = APIRouter(prefix="/support", tags=["support"])


@router.get("/tickets", response_model=List[Ticket])
def list_tickets() -> List[Ticket]:
    return list(store.tickets.values())


@router.get("/tickets/{ticket_id}", response_model=Ticket)
def get_ticket(ticket_id: str) -> Ticket:
    ticket = store.tickets.get(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return ticket


@router.get("/knowledge-base", response_model=List[KnowledgeArticle])
def list_articles() -> List[KnowledgeArticle]:
    return list(store.articles.values())


@router.get("/summary", response_model=SupportSummary)
def support_summary() -> SupportSummary:
    return store.support_summary()
