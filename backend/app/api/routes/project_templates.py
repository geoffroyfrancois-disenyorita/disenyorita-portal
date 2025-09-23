from fastapi import APIRouter, HTTPException, status

from ...schemas.project_templates import (
    ProjectTemplateCreateRequest,
    ProjectTemplateCreateResponse,
)
from ...services.project_templates import (
    MilestoneBlueprint,
    ProjectTemplate,
    TaskBlueprint,
    register_template,
)

router = APIRouter(prefix="/project-templates", tags=["project_templates"])


@router.post("", response_model=ProjectTemplateCreateResponse, status_code=status.HTTP_201_CREATED)
def create_project_template(payload: ProjectTemplateCreateRequest) -> ProjectTemplateCreateResponse:
    template = ProjectTemplate(
        code_prefix=payload.code_prefix,
        tasks=[
            TaskBlueprint(
                name=task.name,
                duration_days=task.duration_days,
                depends_on=task.depends_on,
                status=task.status,
                estimated_hours=task.estimated_hours,
                billable=task.billable,
            )
            for task in payload.tasks
        ],
        milestones=[
            MilestoneBlueprint(title=milestone.title, offset_days=milestone.offset_days)
            for milestone in payload.milestones
        ],
    )

    try:
        register_template(payload.template_id, template, overwrite=payload.overwrite)
    except ValueError as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return ProjectTemplateCreateResponse(template_id=payload.template_id)
