from typing import List

from fastapi import APIRouter, HTTPException

from ...schemas.hr import Employee, ResourceCapacity, TimeOffRequest
from ...services.data import store

router = APIRouter(prefix="/hr", tags=["hr"])


@router.get("/employees", response_model=List[Employee])
def list_employees() -> List[Employee]:
    return list(store.employees.values())


@router.get("/employees/{employee_id}", response_model=Employee)
def get_employee(employee_id: str) -> Employee:
    employee = store.employees.get(employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    return employee


@router.get("/time-off", response_model=List[TimeOffRequest])
def list_time_off() -> List[TimeOffRequest]:
    return list(store.time_off.values())


@router.get("/capacity", response_model=List[ResourceCapacity])
def resource_capacity() -> List[ResourceCapacity]:
    return store.resource_capacity()
