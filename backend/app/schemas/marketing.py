from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field

from .common import IdentifiedModel


class Channel(str, Enum):
    EMAIL = "email"
    SOCIAL = "social"
    ADS = "ads"
    EVENTS = "events"


class ContentStatus(str, Enum):
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    PUBLISHED = "published"


class Campaign(IdentifiedModel):
    name: str
    objective: str
    channel: Channel
    start_date: datetime
    end_date: Optional[datetime] = None
    owner_id: str


class ContentItem(IdentifiedModel):
    campaign_id: Optional[str]
    title: str
    status: ContentStatus = ContentStatus.DRAFT
    scheduled_for: Optional[datetime] = None
    platform: Optional[str] = None


class MetricSnapshot(IdentifiedModel):
    content_id: Optional[str]
    impressions: int
    clicks: int
    conversions: int
    spend: float


class MarketingSummary(BaseModel):
    active_campaigns: int
    scheduled_posts: int
    avg_engagement_rate: float
