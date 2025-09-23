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
