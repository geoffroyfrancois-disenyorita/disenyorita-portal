from datetime import datetime, timedelta
import inspect
from pathlib import Path
import sys
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


from fastapi.testclient import TestClient

from app.main import app
from app.schemas.financials import Invoice, InvoiceStatus, LineItem, Payment
from app.services.data import store


client = TestClient(app)


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_dashboard_snapshot() -> None:
    response = client.get("/api/v1/dashboard")
    assert response.status_code == 200
    payload = response.json()
    assert "projects" in payload
    assert payload["projects"]["total_projects"] >= 1


def test_financial_summary_outstanding_reflects_partial_payments() -> None:
    now = datetime.utcnow()
    invoice = Invoice(
        client_id="test-client",
        project_id=None,
        number="INV-TEST-1001",
        status=InvoiceStatus.SENT,
        issue_date=now,
        due_date=now + timedelta(days=30),
        items=[
            LineItem(description="Design", quantity=1, unit_price=300, total=300),
            LineItem(description="Development", quantity=2, unit_price=200, total=400),
        ],
    )
    payment = Payment(invoice_id=invoice.id, amount=250, received_at=now, method="bank_transfer")
    store.invoices[invoice.id] = invoice
    store.payments[payment.id] = payment

    try:
        response = client.get("/api/v1/financials/summary")
        assert response.status_code == 200
        payload = response.json()

        expected_outstanding = 0.0
        for existing_invoice in store.invoices.values():
            if existing_invoice.status not in {InvoiceStatus.SENT, InvoiceStatus.OVERDUE}:
                continue
            total = sum(item.total for item in existing_invoice.items) if existing_invoice.items else 0.0
            paid = sum(
                existing_payment.amount
                for existing_payment in store.payments.values()
                if existing_payment.invoice_id == existing_invoice.id
            )
            expected_outstanding += max(total - paid, 0.0)

        assert payload["outstanding_invoices"] == expected_outstanding
    finally:
        store.invoices.pop(invoice.id, None)
        store.payments.pop(payment.id, None)
