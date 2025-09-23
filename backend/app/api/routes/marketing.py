from typing import List

from fastapi import APIRouter, HTTPException

from ...schemas.marketing import Campaign, ContentItem, MarketingSummary, MetricSnapshot
from ...services.data import store

router = APIRouter(prefix="/marketing", tags=["marketing"])


@router.get("/campaigns", response_model=List[Campaign])
def list_campaigns() -> List[Campaign]:
    return list(store.campaigns.values())


@router.get("/campaigns/{campaign_id}", response_model=Campaign)
def get_campaign(campaign_id: str) -> Campaign:
    campaign = store.campaigns.get(campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign


@router.get("/content", response_model=List[ContentItem])
def list_content() -> List[ContentItem]:
    return list(store.content_items.values())


@router.get("/metrics", response_model=List[MetricSnapshot])
def list_metrics() -> List[MetricSnapshot]:
    return list(store.metrics.values())


@router.get("/summary", response_model=MarketingSummary)
def marketing_summary() -> MarketingSummary:
    return store.marketing_summary()
