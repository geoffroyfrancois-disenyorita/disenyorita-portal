from typing import List

from fastapi import APIRouter

from ...schemas.automation import AutomationDigest
from ...services.automation import AutomationEngine
from ...services.data import store


router = APIRouter(prefix="/automation", tags=["automation"])


@router.get("/digest", response_model=AutomationDigest)
def automation_digest() -> AutomationDigest:
    """Return suggested automation tasks for the current dataset."""

    engine = AutomationEngine(store)
    digest = engine.generate_digest()
    store.archive_automation_digest(digest)
    return digest


@router.get("/digest/history", response_model=List[AutomationDigest])
def automation_digest_history() -> List[AutomationDigest]:
    """Return archived automation digests for audit and trend analysis."""

    return store.automation_digest_history()

