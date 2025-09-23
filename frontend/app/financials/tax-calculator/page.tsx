"use client";

import Link from "next/link";
import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  api,
  DeductionOpportunity,
  TaxComputationPayload,
  TaxComputationResult,
  TaxEntryInput
} from "../../../lib/api";

type Entry = TaxEntryInput & { id: string };

function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

const defaultIncomes: Entry[] = [
  { id: generateId(), label: "Service retainers", amount: 1_800_000 },
  { id: generateId(), label: "Consulting projects", amount: 420_000 }
];

const defaultCostOfSales: Entry[] = [
  { id: generateId(), label: "Production subcontractors", amount: 360_000 },
  { id: generateId(), label: "Materials & hosting", amount: 95_000 }
];

const defaultOperatingExpenses: Entry[] = [
  { id: generateId(), label: "Studio rent", amount: 180_000 },
  { id: generateId(), label: "Team salaries", amount: 420_000 },
  { id: generateId(), label: "Utilities & internet", amount: 48_000 }
];

const defaultDeductions: Entry[] = [
  { id: generateId(), label: "PhilHealth", amount: 36_000 },
  { id: generateId(), label: "Pag-IBIG", amount: 18_000 }
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number.isFinite(value) ? value : 0);
}

function sanitizeEntries(entries: Entry[]): TaxEntryInput[] {
  return entries.map((entry) => ({
    label: entry.label.trim() || "Untitled",
    amount: Number.isFinite(entry.amount) ? Math.max(entry.amount, 0) : 0
  }));
}

function EntryList({
  title,
  description,
  entries,
  onChange,
  onAdd,
  onRemove
}: {
  title: string;
  description: string;
  entries: Entry[];
  onChange: (id: string, field: "label" | "amount", value: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}): JSX.Element {
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div>
        <h3 style={{ margin: 0 }}>{title}</h3>
        <p className="text-muted" style={{ margin: 0, fontSize: "0.9rem" }}>
          {description}
        </p>
      </div>
      {entries.map((entry) => (
        <div key={entry.id} style={{ display: "grid", gridTemplateColumns: "1fr 160px 32px", gap: "0.75rem", alignItems: "center" }}>
          <input
            type="text"
            value={entry.label}
            placeholder="Label"
            onChange={(event) => onChange(entry.id, "label", event.target.value)}
            style={{
              padding: "0.75rem",
              borderRadius: "0.75rem",
              border: "1px solid rgba(148,163,184,0.2)",
              background: "rgba(15,23,42,0.6)",
              color: "#e2e8f0"
            }}
          />
          <input
            type="number"
            min={0}
            value={entry.amount}
            onChange={(event) => onChange(entry.id, "amount", event.target.value)}
            style={{
              padding: "0.75rem",
              borderRadius: "0.75rem",
              border: "1px solid rgba(148,163,184,0.2)",
              background: "rgba(15,23,42,0.6)",
              color: "#e2e8f0"
            }}
          />
          <button
            type="button"
            onClick={() => onRemove(entry.id)}
            aria-label={`Remove ${entry.label}`}
            style={{
              border: "none",
              background: "transparent",
              color: "#94a3b8",
              fontSize: "1.25rem",
              cursor: "pointer"
            }}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={onAdd}
        style={{
          padding: "0.75rem 1rem",
          borderRadius: "0.75rem",
          border: "1px solid rgba(56,189,248,0.4)",
          background: "transparent",
          color: "#38bdf8",
          fontWeight: 600,
          cursor: "pointer"
        }}
      >
        + Add entry
      </button>
    </div>
  );
}

export default function TaxCalculatorPage(): JSX.Element {
  const [incomes, setIncomes] = useState<Entry[]>(defaultIncomes);
  const [costOfSales, setCostOfSales] = useState<Entry[]>(defaultCostOfSales);
  const [operatingExpenses, setOperatingExpenses] = useState<Entry[]>(defaultOperatingExpenses);
  const [otherDeductions, setOtherDeductions] = useState<Entry[]>(defaultDeductions);
  const [applyPercentageTax, setApplyPercentageTax] = useState<boolean>(true);
  const [percentageTaxRate, setPercentageTaxRate] = useState<number>(3);
  const [vatRegistered, setVatRegistered] = useState<boolean>(false);
  const [calculation, setCalculation] = useState<TaxComputationResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const totalIncome = useMemo(() => incomes.reduce((sum, entry) => sum + (Number.isFinite(entry.amount) ? entry.amount : 0), 0), [incomes]);
  const totalExpenses = useMemo(
    () =>
      costOfSales.concat(operatingExpenses).reduce((sum, entry) => sum + (Number.isFinite(entry.amount) ? entry.amount : 0), 0),
    [costOfSales, operatingExpenses]
  );
  const totalDeductions = useMemo(
    () => otherDeductions.reduce((sum, entry) => sum + (Number.isFinite(entry.amount) ? entry.amount : 0), 0),
    [otherDeductions]
  );

  const handleEntryChange = useCallback(
    (setState: Dispatch<SetStateAction<Entry[]>>) =>
      (id: string, field: "label" | "amount", value: string) => {
        setState((prev) =>
          prev.map((entry) => {
            if (entry.id !== id) {
              return entry;
            }
            if (field === "amount") {
              const parsed = Number(value);
              return { ...entry, amount: Number.isFinite(parsed) ? parsed : 0 };
            }
            return { ...entry, label: value };
          })
        );
      },
    []
  );

  const handleEntryAdd = useCallback(
    (setState: Dispatch<SetStateAction<Entry[]>>) => () => {
      setState((prev) => [...prev, { id: generateId(), label: "", amount: 0 }]);
    },
    []
  );

  const handleEntryRemove = useCallback(
    (setState: Dispatch<SetStateAction<Entry[]>>) => (id: string) => {
      setState((prev) => prev.filter((entry) => entry.id !== id));
    },
    []
  );

  const recalculate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload: TaxComputationPayload = {
        incomes: sanitizeEntries(incomes),
        cost_of_sales: sanitizeEntries(costOfSales),
        operating_expenses: sanitizeEntries(operatingExpenses),
        other_deductions: sanitizeEntries(otherDeductions),
        apply_percentage_tax: applyPercentageTax,
        percentage_tax_rate: percentageTaxRate,
        vat_registered: vatRegistered
      };
      const result = await api.computeTax(payload);
      setCalculation(result);
    } catch (thrown) {
      console.error(thrown);
      setError("Unable to calculate taxes right now. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [applyPercentageTax, costOfSales, incomes, operatingExpenses, otherDeductions, percentageTaxRate, vatRegistered]);

  useEffect(() => {
    void recalculate();
  }, [recalculate]);

  const deductionOpportunities: DeductionOpportunity[] = calculation?.deduction_opportunities ?? [];

  return (
    <div>
      <Link href="/financials" style={{ color: "#38bdf8", textDecoration: "none", fontWeight: 600 }}>
        ← Back to financial control
      </Link>
      <h2 className="section-title" style={{ marginTop: "1.5rem" }}>
        Philippines Individual Company Tax Automation
      </h2>
      <p className="text-muted" style={{ maxWidth: "720px" }}>
        Capture every peso of revenue, expenses, and allowable deductions to automate Philippine income tax, percentage tax,
        and VAT projections. Use the planner to stay compliant with TRAIN law while maximizing cash for growth.
      </p>

      <div className="grid-two" style={{ marginTop: "2rem", gap: "1.5rem" }}>
        <EntryList
          title="Income sources"
          description="List all annual revenue streams including retainers, project work, and product sales."
          entries={incomes}
          onChange={handleEntryChange(setIncomes)}
          onAdd={handleEntryAdd(setIncomes)}
          onRemove={handleEntryRemove(setIncomes)}
        />
        <EntryList
          title="Direct costs"
          description="Capture cost of sales such as subcontractors, production, and other delivery expenses."
          entries={costOfSales}
          onChange={handleEntryChange(setCostOfSales)}
          onAdd={handleEntryAdd(setCostOfSales)}
          onRemove={handleEntryRemove(setCostOfSales)}
        />
      </div>

      <div className="grid-two" style={{ marginTop: "1.5rem", gap: "1.5rem" }}>
        <EntryList
          title="Operating expenses"
          description="Administrative overhead like rent, salaries, utilities, insurance, and marketing."
          entries={operatingExpenses}
          onChange={handleEntryChange(setOperatingExpenses)}
          onAdd={handleEntryAdd(setOperatingExpenses)}
          onRemove={handleEntryRemove(setOperatingExpenses)}
        />
        <EntryList
          title="Allowable deductions"
          description="Government contributions and other deductions that lower taxable income."
          entries={otherDeductions}
          onChange={handleEntryChange(setOtherDeductions)}
          onAdd={handleEntryAdd(setOtherDeductions)}
          onRemove={handleEntryRemove(setOtherDeductions)}
        />
      </div>

      <div className="card" style={{ marginTop: "2rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
        <h3 style={{ margin: 0 }}>Tax configuration</h3>
        <label style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <input
            type="checkbox"
            checked={applyPercentageTax}
            onChange={(event) => setApplyPercentageTax(event.target.checked)}
          />
          <span>Apply percentage tax on gross receipts</span>
        </label>
        {applyPercentageTax && (
          <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", maxWidth: "320px" }}>
            <span className="text-muted">Percentage tax rate</span>
            <select
              value={percentageTaxRate}
              onChange={(event) => setPercentageTaxRate(Number(event.target.value))}
              style={{
                padding: "0.75rem",
                borderRadius: "0.75rem",
                border: "1px solid rgba(148,163,184,0.2)",
                background: "rgba(15,23,42,0.6)",
                color: "#e2e8f0"
              }}
            >
              <option value={1}>1% (CREATE relief for MSMEs)</option>
              <option value={3}>3% standard percentage tax</option>
            </select>
          </label>
        )}
        <label style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <input type="checkbox" checked={vatRegistered} onChange={(event) => setVatRegistered(event.target.checked)} />
          <span>VAT registered (12% on gross sales)</span>
        </label>
        <button
          type="button"
          onClick={() => void recalculate()}
          disabled={loading}
          style={{
            alignSelf: "flex-start",
            padding: "0.85rem 1.5rem",
            borderRadius: "0.75rem",
            border: "none",
            background: loading ? "rgba(148,163,184,0.4)" : "#38bdf8",
            color: loading ? "#0f172a" : "#0f172a",
            fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer"
          }}
        >
          {loading ? "Calculating…" : "Recalculate tax obligations"}
        </button>
        {error && <p style={{ color: "#f87171", margin: 0 }}>{error}</p>}
      </div>

      <div className="card" style={{ marginTop: "2.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
        <h3 style={{ margin: 0 }}>Financial snapshot</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem" }}>
          <div>
            <p className="text-muted" style={{ margin: 0 }}>Total income</p>
            <p style={{ fontSize: "1.4rem", margin: "0.25rem 0" }}>{formatCurrency(totalIncome)}</p>
          </div>
          <div>
            <p className="text-muted" style={{ margin: 0 }}>Total expenses</p>
            <p style={{ fontSize: "1.4rem", margin: "0.25rem 0", color: "#f97316" }}>{formatCurrency(totalExpenses)}</p>
          </div>
          <div>
            <p className="text-muted" style={{ margin: 0 }}>Allowable deductions</p>
            <p style={{ fontSize: "1.4rem", margin: "0.25rem 0", color: "#facc15" }}>{formatCurrency(totalDeductions)}</p>
          </div>
          <div>
            <p className="text-muted" style={{ margin: 0 }}>Projected taxable income</p>
            <p style={{ fontSize: "1.4rem", margin: "0.25rem 0" }}>
              {formatCurrency(calculation?.taxable_income ?? Math.max(totalIncome - totalExpenses - totalDeductions, 0))}
            </p>
          </div>
        </div>
      </div>

      {calculation && (
        <div className="card" style={{ marginTop: "2.5rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <h3 style={{ margin: 0 }}>Automated tax breakdown</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
            <div>
              <p className="text-muted" style={{ margin: 0 }}>Income tax</p>
              <p style={{ fontSize: "1.5rem", margin: "0.25rem 0", color: "#f97316" }}>
                {formatCurrency(calculation.income_tax)}
              </p>
            </div>
            <div>
              <p className="text-muted" style={{ margin: 0 }}>Percentage tax</p>
              <p style={{ fontSize: "1.5rem", margin: "0.25rem 0", color: "#facc15" }}>
                {formatCurrency(calculation.percentage_tax)}
              </p>
            </div>
            <div>
              <p className="text-muted" style={{ margin: 0 }}>VAT due</p>
              <p style={{ fontSize: "1.5rem", margin: "0.25rem 0", color: "#38bdf8" }}>
                {formatCurrency(calculation.vat_due)}
              </p>
            </div>
            <div>
              <p className="text-muted" style={{ margin: 0 }}>Total estimated tax</p>
              <p style={{ fontSize: "1.5rem", margin: "0.25rem 0", color: "#f87171" }}>
                {formatCurrency(calculation.total_tax)}
              </p>
            </div>
            <div>
              <p className="text-muted" style={{ margin: 0 }}>Effective tax rate</p>
              <p style={{ fontSize: "1.5rem", margin: "0.25rem 0" }}>{calculation.effective_tax_rate.toFixed(2)}%</p>
            </div>
          </div>
          <p className="text-muted" style={{ margin: 0, fontSize: "0.85rem" }}>
            Figures assume compliance with Bureau of Internal Revenue requirements under the TRAIN law. Cross-check with a
            licensed tax professional prior to filing.
          </p>
        </div>
      )}

      {deductionOpportunities.length > 0 && (
        <div className="card" style={{ marginTop: "2.5rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <h3 style={{ margin: 0 }}>Deduction opportunities</h3>
          <p className="text-muted" style={{ margin: 0 }}>
            Strengthen deduction compliance and documentation using the reminders below.
          </p>
          <ul style={{ margin: 0, paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {deductionOpportunities.map((tip) => (
              <li key={tip.category} style={{ lineHeight: 1.5 }}>
                <strong style={{ textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.75rem" }}>
                  {tip.category}
                </strong>
                <p style={{ margin: "0.25rem 0 0", color: "#cbd5f5" }}>{tip.message}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
