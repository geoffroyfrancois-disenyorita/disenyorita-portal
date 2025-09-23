from typing import List

from fastapi import APIRouter, HTTPException

from ...schemas.financials import (
    Expense,
    FinancialSummary,
    Invoice,
    MacroFinancials,
    Payment,
    PricingSuggestion,
    ProjectFinancials,
    TaxComputationRequest,
    TaxComputationResponse,
)
from ...services.data import store

router = APIRouter(prefix="/financials", tags=["financials"])


@router.get("/invoices", response_model=List[Invoice])
def list_invoices() -> List[Invoice]:
    return list(store.invoices.values())


@router.get("/invoices/{invoice_id}", response_model=Invoice)
def get_invoice(invoice_id: str) -> Invoice:
    invoice = store.invoices.get(invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice


@router.get("/payments", response_model=List[Payment])
def list_payments() -> List[Payment]:
    return list(store.payments.values())


@router.get("/expenses", response_model=List[Expense])
def list_expenses() -> List[Expense]:
    return list(store.expenses.values())


@router.get("/summary", response_model=FinancialSummary)
def financial_summary() -> FinancialSummary:
    return store.financial_summary()


@router.get("/projects", response_model=List[ProjectFinancials])
def project_financials() -> List[ProjectFinancials]:
    return store.project_financials()


@router.get("/overview", response_model=MacroFinancials)
def macro_financials() -> MacroFinancials:
    return store.macro_financials()


@router.post("/tax/compute", response_model=TaxComputationResponse)
def compute_tax(payload: TaxComputationRequest) -> TaxComputationResponse:
    return store.calculate_tax(payload)


@router.get("/pricing/suggestions", response_model=List[PricingSuggestion])
def pricing_suggestions() -> List[PricingSuggestion]:
    return store.pricing_suggestions()
