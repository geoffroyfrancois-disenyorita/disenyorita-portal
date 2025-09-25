import inspect
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import ForwardRef


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

_forward_ref_signature = inspect.signature(ForwardRef._evaluate)
if "recursive_guard" in _forward_ref_signature.parameters:
    _original_forward_ref_evaluate = ForwardRef._evaluate

    def _patched_forward_ref_evaluate(self, globalns, localns, *args, **kwargs):
        if "recursive_guard" not in kwargs and args:
            kwargs["recursive_guard"] = args[-1]
            args = args[:-1]
        return _original_forward_ref_evaluate(self, globalns, localns, *args, **kwargs)

    ForwardRef._evaluate = _patched_forward_ref_evaluate

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.services.data import store  # noqa: E402


client = TestClient(app)


def _project_by_name(name: str) -> dict:
    response = client.get("/api/v1/projects")
    response.raise_for_status()
    return next(project for project in response.json() if project["name"] == name)


def test_project_tracker_surfaces_automation_and_notifications() -> None:
    store.task_notifications.clear()

    project_record = _project_by_name("Sunset Boutique Website Refresh")
    project_id = project_record["id"]

    project = store.projects[project_id]
    discovery_task = next(task for task in project.tasks if task.name == "Discovery Workshop")
    ux_task = next(task for task in project.tasks if task.name == "UX Wireframes")

    original_discovery = discovery_task.copy(deep=True)
    original_ux = ux_task.copy(deep=True)

    now = datetime.utcnow()

    reset_payload = {
        "tasks": [
            {
                "id": discovery_task.id,
                "status": "todo",
                "start_date": None,
                "due_date": (now + timedelta(days=1)).isoformat(),
            },
            {
                "id": ux_task.id,
                "status": "todo",
                "start_date": None,
                "due_date": (now + timedelta(hours=6)).isoformat(),
                "dependencies": [discovery_task.id],
            },
        ]
    }
    response = client.patch(f"/api/v1/projects/{project_id}", json=reset_payload)
    assert response.status_code == 200

    response = client.patch(
        f"/api/v1/projects/{project_id}",
        json={"tasks": [{"id": discovery_task.id, "status": "in_progress"}]},
    )
    assert response.status_code == 200

    response = client.patch(
        f"/api/v1/projects/{project_id}",
        json={"tasks": [{"id": discovery_task.id, "status": "done"}]},
    )
    assert response.status_code == 200

    response = client.patch(
        f"/api/v1/projects/{project_id}",
        json={"tasks": [{"id": ux_task.id, "due_date": (now - timedelta(hours=1)).isoformat()}]},
    )
    assert response.status_code == 200

    tracker_response = client.get(f"/api/v1/projects/{project_id}/tracker")
    assert tracker_response.status_code == 200

    tracker = tracker_response.json()

    assert tracker["project_id"] == project_id
    assert tracker["health"] == "at_risk"

    tasks = {task["task_id"]: task for task in tracker["tasks"]}
    assert tasks[discovery_task.id]["status"] == "done"
    assert tasks[discovery_task.id]["start_date"] is not None
    assert tasks[ux_task.id]["status"] == "in_progress"
    assert tasks[ux_task.id]["is_late"] is True

    alerts = {alert["task_id"]: alert for alert in tracker["alerts"]}
    assert alerts[ux_task.id]["severity"] == "late"

    notification_types = {notification["type"] for notification in tracker["notifications"]}
    assert "start_confirmation" in notification_types
    assert "auto_started" in notification_types

    start_confirmation = next(
        notification
        for notification in tracker["notifications"]
        if notification["type"] == "start_confirmation"
    )
    assert start_confirmation["requires_confirmation"] is True
    assert start_confirmation["allow_start_date_edit"] is True

    auto_started = next(
        notification
        for notification in tracker["notifications"]
        if notification["type"] == "auto_started"
    )
    assert auto_started["allow_start_date_edit"] is True
    assert auto_started["task_id"] == ux_task.id

    cleanup_payload = {
        "tasks": [
            {
                "id": original_discovery.id,
                "status": original_discovery.status.value,
                "start_date": original_discovery.start_date.isoformat()
                if original_discovery.start_date
                else None,
                "due_date": original_discovery.due_date.isoformat()
                if original_discovery.due_date
                else None,
                "dependencies": list(original_discovery.dependencies),
            },
            {
                "id": original_ux.id,
                "status": original_ux.status.value,
                "start_date": original_ux.start_date.isoformat()
                if original_ux.start_date
                else None,
                "due_date": original_ux.due_date.isoformat()
                if original_ux.due_date
                else None,
                "dependencies": list(original_ux.dependencies),
            },
        ]
    }
    cleanup_response = client.patch(
        f"/api/v1/projects/{project_id}", json=cleanup_payload
    )
    assert cleanup_response.status_code == 200
