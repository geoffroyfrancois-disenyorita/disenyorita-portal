from fastapi import APIRouter

from ...schemas.automation import AutomationDigest
from ...services.automation import AutomationEngine
from ...services.data import store


router = APIRouter(prefix="/automation", tags=["automation"])


@router.get("/digest", response_model=AutomationDigest)
def automation_digest() -> AutomationDigest:
    """Return suggested automation tasks for the current dataset."""

    engine = AutomationEngine(store)
    return engine.generate_digest()

