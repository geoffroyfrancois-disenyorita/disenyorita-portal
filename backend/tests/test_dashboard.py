import inspect
import sys
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

client = TestClient(app)


def test_operations_snapshot_exposes_risk_hotspots() -> None:
    response = client.get("/api/v1/dashboard/operations")
    response.raise_for_status()
    payload = response.json()

    cash = payload["cash"]
    assert cash["runway_days"] is not None
    assert cash["monthly_burn_rate"] > 0
    assert cash["collection_rate"] <= 1

    assert payload["at_risk_projects"], "Expected at least one project flagged as at-risk"
    assert payload["capacity_alerts"], "Expected at least one capacity alert"
    assert payload["monitoring_incidents"], "Expected monitoring incidents to be surfaced"
    assert payload["upcoming_time_off"], "Expected upcoming time-off windows"

    recommendation_categories = {recommendation["category"] for recommendation in payload["recommendations"]}
    assert {"finance", "projects", "technology"}.issubset(recommendation_categories)
