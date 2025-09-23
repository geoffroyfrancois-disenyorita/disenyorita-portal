from enum import Enum
from typing import List, Optional
from datetime import datetime

from pydantic import BaseModel, Field

from .common import IdentifiedModel


class ProjectStatus(str, Enum):
    PLANNING = "planning"
    IN_PROGRESS = "in_progress"
    ON_HOLD = "on_hold"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class TaskStatus(str, Enum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    REVIEW = "review"
    DONE = "done"


class ProjectTemplateType(str, Enum):
    WEBSITE = "website"
    BRANDING = "branding"
    CONSULTING = "consulting"


class Task(IdentifiedModel):
    name: str
    status: TaskStatus = TaskStatus.TODO
    assignee_id: Optional[str] = None
    due_date: Optional[datetime] = None
    billable: bool = True
    estimated_hours: Optional[float] = None
    logged_hours: float = 0
    dependencies: List[str] = Field(default_factory=list)


class Milestone(IdentifiedModel):
    title: str
    due_date: datetime
    completed: bool = False


class Project(IdentifiedModel):
    name: str
    code: str
    client_id: str
    project_type: str
    status: ProjectStatus = ProjectStatus.PLANNING
    start_date: datetime
    end_date: Optional[datetime] = None
    manager_id: str
    budget: Optional[float] = None
    currency: str = "USD"
    milestones: List[Milestone] = Field(default_factory=list)
    tasks: List[Task] = Field(default_factory=list)


class TimeEntry(IdentifiedModel):
    task_id: str
    user_id: str
    date: datetime
    hours: float
    notes: Optional[str] = None
    billable: bool = True


class ProjectSummary(BaseModel):
    total_projects: int
    by_status: dict
    billable_hours: float
    overdue_tasks: int
