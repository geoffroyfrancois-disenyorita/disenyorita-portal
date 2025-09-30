from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Dict, Iterable, List, Optional

from ..schemas.projects import Milestone, Task, TaskPriority, TaskStatus, TaskType


@dataclass(frozen=True)
class TaskBlueprint:
    name: str
    duration_days: int
    depends_on: Iterable[str] = ()
    status: TaskStatus = TaskStatus.TODO
    estimated_hours: Optional[float] = None
    billable: bool = True
    task_type: TaskType = TaskType.FEATURE
    leader_id: Optional[str] = None
    story_points: Optional[float] = None
    priority: TaskPriority = TaskPriority.MEDIUM


@dataclass(frozen=True)
class MilestoneBlueprint:
    title: str
    offset_days: int


class ProjectTemplate:
    def __init__(
        self,
        *,
        code_prefix: str,
        tasks: Iterable[TaskBlueprint],
        milestones: Iterable[MilestoneBlueprint] = (),
    ) -> None:
        self.code_prefix = code_prefix
        self.tasks = list(tasks)
        self.milestones = list(milestones)


class ProjectTemplateLibrary:
    def __init__(self, templates: Optional[Dict[str, ProjectTemplate]] = None) -> None:
        self._templates: Dict[str, ProjectTemplate] = {}
        if templates:
            for template_id, template in templates.items():
                self.register(template_id, template, overwrite=True)

    def register(self, template_id: str, template: ProjectTemplate, *, overwrite: bool = False) -> None:
        if not template.tasks:
            raise ValueError("Project template must include at least one task")
        if not overwrite and template_id in self._templates:
            raise ValueError(f"Project template '{template_id}' already exists")
        self._validate_template(template)
        self._templates[template_id] = template

    def unregister(self, template_id: str) -> None:
        self._templates.pop(template_id, None)

    def definitions(self) -> Dict[str, ProjectTemplate]:
        return {template_id: template for template_id, template in self._templates.items()}

    def exists(self, template_id: str) -> bool:
        return template_id in self._templates

    def code_prefix(self, template_id: str) -> str:
        template = self._templates.get(template_id)
        if not template:
            raise ValueError(f"Unknown project template: {template_id}")
        return template.code_prefix

    def build_plan(self, template_id: str, start_date: datetime) -> tuple[List[Task], List[Milestone]]:
        template = self._templates.get(template_id)
        if not template:
            raise ValueError(f"Unknown project template: {template_id}")
        tasks: List[Task] = []
        dependencies_lookup: Dict[str, List[str]] = {}
        completion_lookup: Dict[str, datetime] = {}

        for blueprint in template.tasks:
            dependency_completion = [completion_lookup[name] for name in blueprint.depends_on]
            start_anchor = max(dependency_completion) if dependency_completion else start_date
            due_date = start_anchor + timedelta(days=blueprint.duration_days)
            task = Task(
                name=blueprint.name,
                status=blueprint.status,
                type=blueprint.task_type,
                estimated_hours=blueprint.estimated_hours,
                billable=blueprint.billable,
                leader_id=blueprint.leader_id,
                start_date=start_anchor,
                due_date=due_date,
                story_points=blueprint.story_points,
                priority=blueprint.priority,
            )
            tasks.append(task)
            dependencies_lookup[task.id] = list(blueprint.depends_on)
            completion_lookup[blueprint.name] = due_date

        name_to_id = {task.name: task.id for task in tasks}
        for task in tasks:
            dependency_names = dependencies_lookup[task.id]
            task.dependencies = [name_to_id[name] for name in dependency_names if name in name_to_id]

        milestones = [
            Milestone(title=milestone.title, due_date=start_date + timedelta(days=milestone.offset_days))
            for milestone in template.milestones
        ]
        return tasks, milestones

    def _validate_template(self, template: ProjectTemplate) -> None:
        task_names = {blueprint.name for blueprint in template.tasks}
        for blueprint in template.tasks:
            if blueprint.duration_days <= 0:
                raise ValueError(f"Task '{blueprint.name}' must have a positive duration")
            missing = set(blueprint.depends_on) - task_names
            if missing:
                missing_str = ", ".join(sorted(missing))
                raise ValueError(
                    f"Task '{blueprint.name}' references unknown dependencies: {missing_str}"
                )


DEFAULT_TEMPLATES: Dict[str, ProjectTemplate] = {
    "website": ProjectTemplate(
        code_prefix="WEB",
        tasks=[
            TaskBlueprint(
                name="Project Kickoff",
                duration_days=2,
                estimated_hours=6,
                task_type=TaskType.CHORE,
                story_points=3,
                priority=TaskPriority.MEDIUM,
            ),
            TaskBlueprint(
                name="Discovery & Strategy",
                duration_days=5,
                depends_on=["Project Kickoff"],
                estimated_hours=16,
                task_type=TaskType.RESEARCH,
                story_points=5,
                priority=TaskPriority.HIGH,
            ),
            TaskBlueprint(
                name="Content Architecture",
                duration_days=4,
                depends_on=["Discovery & Strategy"],
                estimated_hours=12,
                task_type=TaskType.FEATURE,
                story_points=5,
                priority=TaskPriority.HIGH,
            ),
            TaskBlueprint(
                name="Visual Design",
                duration_days=7,
                depends_on=["Content Architecture"],
                estimated_hours=30,
                task_type=TaskType.FEATURE,
                story_points=8,
                priority=TaskPriority.HIGH,
            ),
            TaskBlueprint(
                name="Development Sprint",
                duration_days=10,
                depends_on=["Visual Design"],
                estimated_hours=45,
                task_type=TaskType.FEATURE,
                story_points=13,
                priority=TaskPriority.CRITICAL,
            ),
            TaskBlueprint(
                name="Quality Assurance",
                duration_days=4,
                depends_on=["Development Sprint"],
                estimated_hours=18,
                task_type=TaskType.QA,
                story_points=5,
                priority=TaskPriority.HIGH,
            ),
            TaskBlueprint(
                name="Launch",
                duration_days=1,
                depends_on=["Quality Assurance"],
                estimated_hours=4,
                task_type=TaskType.CHORE,
                story_points=3,
                priority=TaskPriority.HIGH,
            ),
        ],
        milestones=[
            MilestoneBlueprint(title="Design Approved", offset_days=14),
            MilestoneBlueprint(title="Website Launched", offset_days=33),
        ],
    ),
    "branding": ProjectTemplate(
        code_prefix="BRD",
        tasks=[
            TaskBlueprint(
                name="Brand Workshop",
                duration_days=3,
                estimated_hours=8,
                task_type=TaskType.RESEARCH,
                story_points=3,
                priority=TaskPriority.MEDIUM,
            ),
            TaskBlueprint(
                name="Audience Research",
                duration_days=6,
                depends_on=["Brand Workshop"],
                estimated_hours=20,
                task_type=TaskType.RESEARCH,
                story_points=5,
                priority=TaskPriority.HIGH,
            ),
            TaskBlueprint(
                name="Moodboards",
                duration_days=4,
                depends_on=["Audience Research"],
                estimated_hours=16,
                task_type=TaskType.FEATURE,
                story_points=5,
                priority=TaskPriority.MEDIUM,
            ),
            TaskBlueprint(
                name="Logo Exploration",
                duration_days=5,
                depends_on=["Moodboards"],
                estimated_hours=24,
                task_type=TaskType.FEATURE,
                story_points=8,
                priority=TaskPriority.HIGH,
            ),
            TaskBlueprint(
                name="Brand Guidelines",
                duration_days=7,
                depends_on=["Logo Exploration"],
                estimated_hours=28,
                task_type=TaskType.FEATURE,
                story_points=8,
                priority=TaskPriority.HIGH,
            ),
            TaskBlueprint(
                name="Handover",
                duration_days=2,
                depends_on=["Brand Guidelines"],
                estimated_hours=6,
                task_type=TaskType.CHORE,
                story_points=3,
                priority=TaskPriority.MEDIUM,
            ),
        ],
        milestones=[
            MilestoneBlueprint(title="Concept Approved", offset_days=12),
            MilestoneBlueprint(title="Guidelines Delivered", offset_days=27),
        ],
    ),
    "consulting": ProjectTemplate(
        code_prefix="CON",
        tasks=[
            TaskBlueprint(
                name="Initial Assessment",
                duration_days=3,
                estimated_hours=10,
                task_type=TaskType.RESEARCH,
                story_points=3,
                priority=TaskPriority.MEDIUM,
            ),
            TaskBlueprint(
                name="Stakeholder Interviews",
                duration_days=5,
                depends_on=["Initial Assessment"],
                estimated_hours=18,
                task_type=TaskType.RESEARCH,
                story_points=5,
                priority=TaskPriority.MEDIUM,
            ),
            TaskBlueprint(
                name="Findings Synthesis",
                duration_days=4,
                depends_on=["Stakeholder Interviews"],
                estimated_hours=14,
                task_type=TaskType.FEATURE,
                story_points=5,
                priority=TaskPriority.HIGH,
            ),
            TaskBlueprint(
                name="Opportunity Mapping",
                duration_days=4,
                depends_on=["Findings Synthesis"],
                estimated_hours=12,
                task_type=TaskType.FEATURE,
                story_points=5,
                priority=TaskPriority.HIGH,
            ),
            TaskBlueprint(
                name="Roadmap Presentation",
                duration_days=2,
                depends_on=["Opportunity Mapping"],
                estimated_hours=10,
                task_type=TaskType.CHORE,
                story_points=3,
                priority=TaskPriority.MEDIUM,
            ),
        ],
        milestones=[
            MilestoneBlueprint(title="Discovery Complete", offset_days=10),
            MilestoneBlueprint(title="Final Presentation", offset_days=18),
        ],
    ),
}


template_library = ProjectTemplateLibrary(DEFAULT_TEMPLATES)


def register_template(template_id: str, template: ProjectTemplate, *, overwrite: bool = False) -> None:
    template_library.register(template_id, template, overwrite=overwrite)


def unregister_template(template_id: str) -> None:
    template_library.unregister(template_id)


def build_plan(template_id: str, start_date: datetime) -> tuple[List[Task], List[Milestone]]:
    return template_library.build_plan(template_id, start_date)


def list_templates() -> Dict[str, ProjectTemplate]:
    return template_library.definitions()


def project_code(prefix: str, sequence: int, *, year: int | None = None) -> str:
    year = year or datetime.utcnow().year
    return f"{prefix}-{year}-{sequence:02d}"
