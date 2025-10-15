from typing import List

from fastapi import APIRouter, Query

from ...schemas.automation import AutomationCategory, AutomationDigest, AutomationTaskList
from ...services.automation import AutomationEngine, summarize_tasks_for_category
from ...services.data import store


router = APIRouter(prefix="/automation", tags=["automation"])


@router.get("/digest", response_model=AutomationDigest)
def automation_digest() -> AutomationDigest:
    """Return suggested automation tasks for the current dataset."""

    engine = AutomationEngine(store)
    digest = engine.generate_digest()
    store.archive_automation_digest(digest)
    return digest


@router.get("/tasks", response_model=AutomationTaskList)
def automation_tasks(
    category: AutomationCategory | None = Query(
        None,
        description="Automation category to filter by.",
    ),
    limit: int | None = Query(
        None,
        ge=1,
        description="Maximum number of tasks to include in the response.",
    ),
) -> AutomationTaskList:
    """Return automation tasks scoped to a category with UI-friendly fields."""

    engine = AutomationEngine(store)
    digest = engine.generate_digest()
    store.archive_automation_digest(digest)
    tasks = summarize_tasks_for_category(digest, category=category, limit=limit)
    return AutomationTaskList(generated_at=digest.generated_at, category=category, tasks=tasks)


@router.get("/digest/history", response_model=List[AutomationDigest])
def automation_digest_history() -> List[AutomationDigest]:
    """Return archived automation digests for audit and trend analysis."""

    return store.automation_digest_history()

