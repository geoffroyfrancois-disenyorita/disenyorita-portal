from datetime import date
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field

from .common import IdentifiedModel


class EmploymentType(str, Enum):
    EMPLOYEE = "employee"
    CONTRACTOR = "contractor"


class Skill(IdentifiedModel):
    name: str
    proficiency: int = Field(ge=1, le=5)


class TimeOffStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class TimeOffRequest(IdentifiedModel):
    employee_id: str
    start_date: date
    end_date: date
    status: TimeOffStatus = TimeOffStatus.PENDING
    reason: Optional[str] = None


class Employee(IdentifiedModel):
    first_name: str
    last_name: str
    email: EmailStr
    employment_type: EmploymentType
    title: str
    manager_id: Optional[str] = None
    skills: List[Skill] = Field(default_factory=list)
    time_off_requests: List[TimeOffRequest] = Field(default_factory=list)


class ResourceCapacity(BaseModel):
    user_id: str
    available_hours: float
    billable_ratio: float
