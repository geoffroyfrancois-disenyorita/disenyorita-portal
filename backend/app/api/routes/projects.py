from typing import List

from fastapi import APIRouter, HTTPException

from ...schemas.projects import Project, ProjectSummary
from ...services.data import store

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=List[Project])
def list_projects() -> List[Project]:
    return list(store.projects.values())


@router.get("/{project_id}", response_model=Project)
def get_project(project_id: str) -> Project:
    project = store.projects.get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.get("/summary", response_model=ProjectSummary)
def project_summary() -> ProjectSummary:
    return store.project_summary()
