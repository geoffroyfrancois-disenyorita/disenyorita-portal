from __future__ import annotations

import inspect
from datetime import datetime
from pathlib import Path
import sys
from typing import ForwardRef, Iterable


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
from app.services.project_templates import template_library, unregister_template  # noqa: E402
from app.schemas.projects import ProjectTemplateType  # noqa: E402
from app.schemas.clients import Client  # noqa: E402


client = TestClient(app)


def _cleanup(client_id: str, project_ids: Iterable[str]) -> None:
    store.clients.pop(client_id, None)
    for project_id in project_ids:
        store.projects.pop(project_id, None)


def _seeded_client_with_data() -> Client:
    for client in store.clients.values():
        if client.organization_name == "Sunset Boutique Hotel":
            return client
    raise AssertionError("Expected seeded client not found")


def test_create_client_with_single_project_template() -> None:
    start = datetime.utcnow().replace(microsecond=0)
    payload = {
        "organization_name": "Northwind Ventures",
        "industry": "technology",
        "segment": "project",
        "billing_email": "finance@northwind.example",
        "preferred_channel": "email",
        "timezone": "UTC",
        "contacts": [
            {
                "first_name": "Lena",
                "last_name": "Park",
                "email": "lena@northwind.example",
                "title": "COO",
            }
        ],
        "projects": [
            {
                "name": "Brand Refresh Initiative",
                "project_type": ProjectTemplateType.BRANDING.value,
                "start_date": start.isoformat(),
                "manager_id": "pm-42",
                "budget": 26000,
                "currency": "USD",
            }
        ],
    }

    response = client.post("/api/v1/clients", json=payload)
    assert response.status_code == 201

    body = response.json()
    created_client = body["client"]
    created_projects = body["projects"]

    assert len(created_projects) == 1
    created_project = created_projects[0]

    try:
        assert created_client["organization_name"] == payload["organization_name"]
        assert created_project["project_type"] == payload["projects"][0]["project_type"]

        expected_task_count = len(template_library.build_plan(ProjectTemplateType.BRANDING.value, start)[0])
        assert len(created_project["tasks"]) == expected_task_count

        task_ids = {task["id"] for task in created_project["tasks"]}
        assert task_ids  # ensure tasks exist

        for task in created_project["tasks"]:
            assert set(task.get("dependencies", [])) <= task_ids
            due = datetime.fromisoformat(task["due_date"])
            assert due >= start

        for milestone in created_project["milestones"]:
            milestone_due = datetime.fromisoformat(milestone["due_date"])
            assert milestone_due >= start

        assert any(task["dependencies"] for task in created_project["tasks"][1:])
    finally:
        _cleanup(created_client["id"], [created_project["id"]])


def test_branding_then_website_sequence() -> None:
    start = datetime.utcnow().replace(microsecond=0)
    payload = {
        "organization_name": "Blue Skyline Retail",
        "industry": "creative",
        "segment": "project",
        "billing_email": "ops@blueskyline.example",
        "preferred_channel": "email",
        "timezone": "UTC",
        "projects": [
            {
                "name": "Blue Skyline Brand System",
                "project_type": ProjectTemplateType.BRANDING.value,
                "start_date": start.isoformat(),
                "manager_id": "pm-12",
                "budget": 32000,
                "currency": "USD",
            },
            {
                "name": "Blue Skyline Website",
                "project_type": ProjectTemplateType.WEBSITE.value,
                "start_date": start.isoformat(),
                "manager_id": "pm-34",
                "budget": 45000,
                "currency": "USD",
            },
        ],
    }

    response = client.post("/api/v1/clients", json=payload)
    assert response.status_code == 201

    body = response.json()
    created_client = body["client"]
    created_projects = body["projects"]
    assert len(created_projects) == 2

    try:
        branding_project = next(
            project for project in created_projects if project["project_type"] == ProjectTemplateType.BRANDING.value
        )
        website_project = next(
            project for project in created_projects if project["project_type"] == ProjectTemplateType.WEBSITE.value
        )

        branding_end = datetime.fromisoformat(branding_project["end_date"])
        website_start = datetime.fromisoformat(website_project["start_date"])
        assert website_start >= branding_end

        earliest_website_due = min(
            datetime.fromisoformat(task["due_date"]) for task in website_project["tasks"]
        )
        assert earliest_website_due >= branding_end
    finally:
        _cleanup(created_client["id"], [project["id"] for project in created_projects])


def test_create_and_use_custom_project_template() -> None:
    template_payload = {
        "template_id": "ops-advisory",
        "code_prefix": "OPS",
        "tasks": [
            {"name": "Kickoff Session", "duration_days": 2},
            {
                "name": "Opportunity Deep Dive",
                "duration_days": 4,
                "depends_on": ["Kickoff Session"],
                "estimated_hours": 18,
            },
        ],
        "milestones": [
            {"title": "Alignment Workshop", "offset_days": 3},
        ],
    }

    template_response = client.post("/api/v1/project-templates", json=template_payload)
    assert template_response.status_code == 201

    start = datetime.utcnow().replace(microsecond=0)
    client_payload = {
        "organization_name": "Orchid Advisory",
        "industry": "technology",
        "segment": "project",
        "billing_email": "finance@orchid.example",
        "projects": [
            {
                "name": "Operational Advisory",
                "project_type": template_payload["template_id"],
                "start_date": start.isoformat(),
                "manager_id": "pm-88",
                "budget": 18000,
                "currency": "USD",
            }
        ],
    }

    response = client.post("/api/v1/clients", json=client_payload)
    assert response.status_code == 201
    body = response.json()
    created_client = body["client"]
    created_project = body["projects"][0]

    try:
        assert created_project["project_type"] == template_payload["template_id"]
        assert created_project["code"].startswith(template_payload["code_prefix"])
        assert len(created_project["tasks"]) == len(template_payload["tasks"])

        second_task = created_project["tasks"][1]
        assert second_task["dependencies"]
    finally:
        _cleanup(created_client["id"], [created_project["id"]])
        unregister_template(template_payload["template_id"])


def test_client_dashboard_links_related_entities() -> None:
    seeded_client = _seeded_client_with_data()

    response = client.get(f"/api/v1/clients/{seeded_client.id}/dashboard")
    assert response.status_code == 200

    body = response.json()
    assert body["client"]["id"] == seeded_client.id

    projects = body["projects"]
    assert projects

    project_digest = next(
        project for project in projects if project["name"] == "Sunset Boutique Website Refresh"
    )
    assert project_digest["code"]
    assert project_digest["status"] in {"in_progress", "planning", "completed", "on_hold", "cancelled"}
    assert "late_tasks" in project_digest
    assert project_digest["next_milestone"]["title"] == "Launch MVP"
    if project_digest["next_task"]:
        assert project_digest["next_task"]["status"] != "done"

    financials = body["financials"]
    assert financials["total_outstanding"] >= 0
    assert financials["outstanding_invoices"]
    assert financials["next_invoice_due"]["balance_due"] > 0
    assert financials["recent_payments"]

    support = body["support"]
    assert support["open_tickets"]
    ticket = support["open_tickets"][0]
    assert ticket["status"] in {"open", "in_progress"}
    assert support["last_ticket_update"] is not None


def test_client_dashboard_missing_client_returns_404() -> None:
    response = client.get("/api/v1/clients/non-existent/dashboard")
    assert response.status_code == 404
