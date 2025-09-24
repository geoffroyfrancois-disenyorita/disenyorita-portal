from __future__ import annotations

import inspect
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


client = TestClient(app)


def _priority_order(values: Iterable[str]) -> list[int]:
    ranking = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    return [ranking[value] for value in values]


def test_automation_digest_surfaces_cross_domain_tasks() -> None:
    response = client.get("/api/v1/automation/digest")
    assert response.status_code == 200

    body = response.json()
    assert "generated_at" in body

    tasks = body["tasks"]
    assert len(tasks) >= 5

    categories = {task["category"] for task in tasks}
    expected_categories = {"client", "project", "finance", "support", "marketing", "monitoring", "hr"}
    assert expected_categories <= categories

    client_task = next(
        task
        for task in tasks
        if task["category"] == "client" and "Sunset Boutique Hotel" in task["summary"]
    )
    assert client_task["priority"] in {"high", "critical"}

    support_task = next(task for task in tasks if task["category"] == "support")
    assert support_task["suggested_assignee"] == "support-1"
    assert "Priority" in support_task["details"]

    monitoring_task = next(task for task in tasks if task["category"] == "monitoring")
    assert "SSL certificate" in monitoring_task["details"]

    marketing_task = next(task for task in tasks if task["category"] == "marketing")
    assert marketing_task["due_at"] is not None

    hr_task = next(task for task in tasks if task["category"] == "hr")
    assert "time-off" in hr_task["summary"].lower()

    priorities = _priority_order(task["priority"] for task in tasks)
    assert priorities == sorted(priorities)
