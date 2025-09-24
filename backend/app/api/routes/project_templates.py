from fastapi import APIRouter, HTTPException, status

from ...schemas.project_templates import (
    ProjectTemplateCreateRequest,
    ProjectTemplateCreateResponse,
    ProjectTemplateDefinition,
    ProjectTemplateMilestoneDefinition,
    ProjectTemplateTaskDefinition,
)
from ...services.project_templates import (
    MilestoneBlueprint,
    ProjectTemplate,
    TaskBlueprint,
    list_templates,
    register_template,
)

router = APIRouter(prefix="/project-templates", tags=["project_templates"])


@router.get("", response_model=list[ProjectTemplateDefinition])
def get_project_templates() -> list[ProjectTemplateDefinition]:
    templates: list[ProjectTemplateDefinition] = []
    for template_id, template in list_templates().items():
        task_definitions = [
            ProjectTemplateTaskDefinition(
                name=task.name,
                duration_days=task.duration_days,
                depends_on=list(task.depends_on),
                status=task.status,
                type=task.task_type,
                estimated_hours=task.estimated_hours,
                billable=task.billable,
                leader_id=task.leader_id,
            )
            for task in template.tasks
        ]
        milestone_definitions = [
            ProjectTemplateMilestoneDefinition(title=milestone.title, offset_days=milestone.offset_days)
            for milestone in template.milestones
        ]
        templates.append(
            ProjectTemplateDefinition(
                template_id=template_id,
                code_prefix=template.code_prefix,
                tasks=task_definitions,
                milestones=milestone_definitions,
            )
        )
    return templates


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
                task_type=task.type,
                estimated_hours=task.estimated_hours,
                billable=task.billable,
                leader_id=task.leader_id,
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
