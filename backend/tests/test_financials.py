from datetime import date, datetime, timezone
import sys
import typing

import pytest

if sys.version_info >= (3, 12):
    _original_forward_ref_evaluate = typing.ForwardRef._evaluate  # type: ignore[attr-defined]

    def _patched_forward_ref_evaluate(
        self: typing.ForwardRef,  # type: ignore[type-arg]
        globalns: dict[str, object] | None,
        localns: dict[str, object] | None,
        type_params: object | None = None,
        *,
        recursive_guard: set[tuple[typing.ForwardRef, tuple[object, ...]]] | None = None,
    ):
        guard = recursive_guard or set()
        return _original_forward_ref_evaluate(self, globalns, localns, type_params, recursive_guard=guard)

    typing.ForwardRef._evaluate = _patched_forward_ref_evaluate  # type: ignore[attr-defined]

from pathlib import Path

if str(Path(__file__).resolve().parents[1]) not in sys.path:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient

from app.main import app
from app.schemas.financials import Expense, Invoice, InvoiceStatus, LineItem, Payment, TaxComputationRequest
from app.services.data import store


client = TestClient(app)


def test_tax_computation_endpoint_returns_expected_totals() -> None:
    payload = TaxComputationRequest(
        incomes=[{"label": "Design retainers", "amount": 1_500_000}],
        cost_of_sales=[{"label": "Subcontractors", "amount": 400_000}],
        operating_expenses=[{"label": "Rent", "amount": 200_000}],
        other_deductions=[{"label": "PhilHealth", "amount": 30_000}],
        apply_percentage_tax=True,
        percentage_tax_rate=3,
        vat_registered=False,
    )

    response = client.post("/api/v1/financials/tax/compute", json=payload.dict())
    assert response.status_code == 200
    data = response.json()

    assert data["gross_revenue"] == 1_500_000
    assert data["total_cost_of_sales"] == 400_000
    assert data["total_operating_expenses"] == 200_000
    assert data["total_other_deductions"] == 30_000
    assert data["taxable_income"] == 870_000
    # 870k falls in the 800k-2M bracket: 130k base + 70k * 30%
    assert data["income_tax"] == 151_000
    assert data["percentage_tax"] == 45_000
    assert data["vat_due"] == 0
    assert data["total_tax"] == 196_000
    assert data["effective_tax_rate"] == pytest.approx(13.06, rel=1e-2)
    # Expect deduction guidance for categories not supplied in request
    categories = {tip["category"] for tip in data["deduction_opportunities"]}
    assert "sss" in categories
    assert "pag-ibig" in categories


def test_tax_profile_includes_business_context_and_calendar() -> None:
    response = client.get("/api/v1/financials/tax/profile")
    assert response.status_code == 200
    data = response.json()

    business = data["business_profile"]
    assert business["taxpayer_type"] == "Individual"
    assert business["psic_primary_code"] == "82212"
    summary_text = " ".join(business["filing_frequencies"])
    assert "1701" in summary_text
    assert "1701A" in summary_text
    assert "1701MS" in summary_text
    assert "2551Q" in summary_text

    notes = business.get("compliance_notes")
    assert isinstance(notes, list) and len(notes) >= 4

    calendar = data["filing_calendar"]
    assert len(calendar) >= 9
    due_dates = [date.fromisoformat(entry["due_date"]) for entry in calendar]
    assert due_dates == sorted(due_dates)
    forms = {entry["form"] for entry in calendar}
    assert {
        "BIR Form 1701",
        "BIR Form 1701A",
        "BIR Form 1701MS",
        "BIR Form 1701Q",
        "BIR Form 2551Q",
    }.issubset(forms)


def test_pricing_suggestions_flag_low_margin_projects() -> None:
    project = next(iter(store.projects.values()))
    now = datetime.now(timezone.utc)
    invoice = Invoice(
        client_id=project.client_id,
        project_id=project.id,
        number="INV-LOW-MARGIN",
        status=InvoiceStatus.PAID,
        issue_date=now,
        due_date=now,
        items=[LineItem(description="Support bundle", quantity=1, unit_price=1_000, total=1_000)],
    )
    payment = Payment(invoice_id=invoice.id, amount=1_000, received_at=now, method="bank_transfer")
    expense = Expense(project_id=project.id, category="Subcontractor", amount=4_800, incurred_at=now)

    store.invoices[invoice.id] = invoice
    store.payments[payment.id] = payment
    store.expenses[expense.id] = expense

    try:
        response = client.get("/api/v1/financials/pricing/suggestions")
        assert response.status_code == 200
        suggestions = response.json()
        assert suggestions

        matching = next(s for s in suggestions if s["project_id"] == project.id)
        assert matching["recommended_rate"] >= matching["current_rate"]
        assert matching["recommended_adjustment_pct"] >= 0
        assert "Recommend increasing" in matching["rationale"] or "below" in matching["rationale"].lower()
    finally:
        store.invoices.pop(invoice.id, None)
        store.payments.pop(payment.id, None)
        store.expenses.pop(expense.id, None)
