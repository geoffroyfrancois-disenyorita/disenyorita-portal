from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field, root_validator

from .projects import TaskStatus


class ProjectTemplateTaskDefinition(BaseModel):
    name: str
    duration_days: int = Field(..., gt=0)
    depends_on: List[str] = Field(default_factory=list)
    status: TaskStatus = TaskStatus.TODO
    estimated_hours: Optional[float] = None
    billable: bool = True


class ProjectTemplateMilestoneDefinition(BaseModel):
    title: str
    offset_days: int = Field(..., ge=0)


class ProjectTemplateCreateRequest(BaseModel):
    template_id: str = Field(..., min_length=2)
    code_prefix: str = Field(..., min_length=2, max_length=12)
    tasks: List[ProjectTemplateTaskDefinition]
    milestones: List[ProjectTemplateMilestoneDefinition] = Field(default_factory=list)
    overwrite: bool = False

    @root_validator
    def validate_dependencies(cls, values: dict) -> dict:
        tasks = values.get("tasks") or []
        task_names = {task.name for task in tasks}
        if len(task_names) != len(tasks):
            raise ValueError("Task names within a template must be unique")
        for task in tasks:
            missing = set(task.depends_on) - task_names
            if missing:
                missing_str = ", ".join(sorted(missing))
                raise ValueError(
                    f"Task '{task.name}' references unknown dependencies: {missing_str}"
                )
        return values


class ProjectTemplateCreateResponse(BaseModel):
    template_id: str
