from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field

from .common import IdentifiedModel


class Currency(str, Enum):
    USD = "USD"
    EUR = "EUR"
    GBP = "GBP"


class InvoiceStatus(str, Enum):
    DRAFT = "draft"
    SENT = "sent"
    PAID = "paid"
    OVERDUE = "overdue"
    VOID = "void"


class LineItem(BaseModel):
    description: str
    quantity: float
    unit_price: float
    total: float


class Invoice(IdentifiedModel):
    client_id: str
    project_id: Optional[str]
    number: str
    currency: Currency = Currency.USD
    status: InvoiceStatus = InvoiceStatus.DRAFT
    issue_date: datetime
    due_date: datetime
    items: List[LineItem] = Field(default_factory=list)
    notes: Optional[str] = None


class Payment(IdentifiedModel):
    invoice_id: str
    amount: float
    received_at: datetime
    method: str


class Expense(IdentifiedModel):
    project_id: Optional[str]
    category: str
    amount: float
    currency: Currency = Currency.USD
    incurred_at: datetime
    receipt_url: Optional[str] = None


class FinancialSummary(BaseModel):
    mrr: float
    outstanding_invoices: float
    overdue_invoices: int
    expenses_this_month: float


class ProjectFinancials(BaseModel):
    project_id: str
    project_name: str
    client_name: Optional[str]
    currency: Currency = Currency.USD
    total_invoiced: float
    total_collected: float
    total_expenses: float
    outstanding_amount: float
    net_revenue: float


class MacroFinancials(BaseModel):
    total_invoiced: float
    total_collected: float
    total_outstanding: float
    total_expenses: float
    net_cash_flow: float


class TaxEntry(BaseModel):
    label: str
    amount: float


class TaxComputationRequest(BaseModel):
    incomes: List[TaxEntry] = Field(default_factory=list)
    cost_of_sales: List[TaxEntry] = Field(default_factory=list)
    operating_expenses: List[TaxEntry] = Field(default_factory=list)
    other_deductions: List[TaxEntry] = Field(default_factory=list)
    apply_percentage_tax: bool = True
    percentage_tax_rate: float = 3.0
    vat_registered: bool = False


class DeductionOpportunity(BaseModel):
    category: str
    message: str


class TaxComputationResponse(BaseModel):
    gross_revenue: float
    total_cost_of_sales: float
    total_operating_expenses: float
    total_other_deductions: float
    taxable_income: float
    income_tax: float
    percentage_tax: float
    vat_due: float
    total_tax: float
    effective_tax_rate: float
    deduction_opportunities: List[DeductionOpportunity] = Field(default_factory=list)


class PricingSuggestion(BaseModel):
    project_id: str
    service: str
    current_rate: float
    recommended_rate: float
    current_margin: float
    recommended_adjustment_pct: float
    rationale: str
    currency: Currency = Currency.USD
