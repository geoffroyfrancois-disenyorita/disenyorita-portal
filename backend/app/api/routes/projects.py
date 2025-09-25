from typing import List

from fastapi import APIRouter, HTTPException

from ...schemas.projects import (
    Project,
    ProjectProgress,
    ProjectSummary,
    ProjectTracker,
    ProjectUpdateRequest,
)
from ...services.data import store

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=List[Project])
def list_projects() -> List[Project]:
    return list(store.projects.values())


@router.get("/summary", response_model=ProjectSummary)
def project_summary() -> ProjectSummary:
    return store.project_summary()


@router.get("/portfolio", response_model=List[ProjectProgress])
def project_portfolio() -> List[ProjectProgress]:
    return store.project_portfolio()


@router.get("/{project_id}", response_model=Project)
def get_project(project_id: str) -> Project:
    project = store.projects.get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.get("/{project_id}/tracker", response_model=ProjectTracker)
def get_project_tracker(project_id: str) -> ProjectTracker:
    try:
        return store.project_tracker(project_id)
    except ValueError as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch("/{project_id}", response_model=Project)
def update_project(project_id: str, payload: ProjectUpdateRequest) -> Project:
    try:
        return store.update_project(project_id, payload)
    except ValueError as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=404, detail=str(exc)) from exc
