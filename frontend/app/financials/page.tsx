export const dynamic = "force-dynamic";

import Link from "next/link";

import { MetricCard } from "../components/MetricCard";
import { api, AutomationDigest, Invoice, MacroFinancials, PricingSuggestion, ProjectFinancials } from "../../lib/api";

async function getInvoices(): Promise<Invoice[]> {
  return api.invoices();
}

async function getProjectFinancials(): Promise<ProjectFinancials[]> {
  return api.projectFinancials();
}

async function getFinancialOverview(): Promise<MacroFinancials> {
  return api.financialOverview();
}

async function getPricingSuggestions(): Promise<PricingSuggestion[]> {
  return api.pricingSuggestions();
}

async function getAutomationDigest(): Promise<AutomationDigest> {
  return api.automationDigest();
}

function statusTone(status: string): "default" | "success" | "warning" | "danger" {
  switch (status) {
    case "paid":
      return "success";
    case "overdue":
      return "danger";
    case "sent":
      return "warning";
    default:
      return "default";
  }
}

function formatCurrency(value: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

export default async function FinancialsPage(): Promise<JSX.Element> {
  const [invoices, projectFinancials, overview, pricingSuggestions, digest] = await Promise.all([
    getInvoices(),
    getProjectFinancials(),
    getFinancialOverview(),
    getPricingSuggestions(),
    getAutomationDigest()
  ]);

  const reminderTasks = new Map<string, { label: string; url: string }>();
  digest.tasks.forEach((task) => {
    const invoiceId = task.related_ids?.invoice_id;
    if (!invoiceId) {
      return;
    }
    reminderTasks.set(invoiceId, {
      label: task.action_label ?? "Open task",
      url: task.action_url ?? "/financials"
    });
  });

  return (
    <div>
      <h2 className="section-title">Financial Control</h2>
      <p className="text-muted" style={{ maxWidth: "720px" }}>
        Cash flow clarity across projects, clients, and retained engagements. Track earnings, spending, and working capital
        to keep teams and leadership aligned.
      </p>

      <div className="card-grid" style={{ marginTop: "2rem", marginBottom: "2rem" }}>
        <MetricCard title="Total invoiced" value={formatCurrency(overview.total_invoiced)} helper="Lifetime billings" />
        <MetricCard
          title="Collected"
          value={formatCurrency(overview.total_collected)}
          helper="Cash received"
          tone="success"
        />
        <MetricCard
          title="Outstanding"
          value={formatCurrency(overview.total_outstanding)}
          helper="Awaiting collection"
          tone={overview.total_outstanding > 0 ? "warning" : "success"}
        />
        <MetricCard
          title="Expenses"
          value={formatCurrency(overview.total_expenses)}
          helper="Direct project costs"
          tone="warning"
        />
        <MetricCard
          title="Net cash flow"
          value={formatCurrency(overview.net_cash_flow)}
          helper="Collected minus spend"
          tone={overview.net_cash_flow >= 0 ? "success" : "danger"}
        />
      </div>

      <section style={{ marginTop: "2rem" }}>
        <h3 style={{ marginBottom: "0.5rem" }}>Project-level income &amp; spending</h3>
        <p className="text-muted" style={{ maxWidth: "680px" }}>
          Compare revenue collected against direct delivery costs to understand margin performance by engagement.
        </p>
        <table className="table">
          <thead>
            <tr>
              <th>Project</th>
              <th>Client</th>
              <th>Invoiced</th>
              <th>Collected</th>
              <th>Expenses</th>
              <th>Outstanding</th>
              <th>Net</th>
            </tr>
          </thead>
          <tbody>
            {projectFinancials.map((record) => (
              <tr key={record.project_id}>
                <td>{record.project_name}</td>
                <td>{record.client_name ?? "—"}</td>
                <td>{formatCurrency(record.total_invoiced, record.currency)}</td>
                <td>{formatCurrency(record.total_collected, record.currency)}</td>
                <td>{formatCurrency(record.total_expenses, record.currency)}</td>
                <td style={{ color: record.outstanding_amount > 0 ? "#facc15" : "#94a3b8" }}>
                  {formatCurrency(record.outstanding_amount, record.currency)}
                </td>
                <td style={{ color: record.net_revenue >= 0 ? "#4ade80" : "#f87171" }}>
                  {formatCurrency(record.net_revenue, record.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={{ marginTop: "3rem" }}>
        <h3 style={{ marginBottom: "0.5rem" }}>Invoice ledger</h3>
        <p className="text-muted" style={{ maxWidth: "680px" }}>
          Detailed view of invoices across all projects, including issued and due dates to support collections follow-up.
        </p>
        <table className="table">
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Client</th>
              <th>Status</th>
              <th>Issued</th>
              <th>Due</th>
              <th>Total</th>
              <th>Quick action</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <tr key={invoice.id}>
                <td>{invoice.number}</td>
                <td>{invoice.client_id}</td>
                <td>
                  <span className={`badge ${statusTone(invoice.status)}`} style={{ textTransform: "uppercase" }}>
                    {invoice.status}
                  </span>
                </td>
                <td>{new Date(invoice.issue_date).toLocaleDateString()}</td>
                <td>{new Date(invoice.due_date).toLocaleDateString()}</td>
                <td>{formatCurrency(invoice.items.reduce((acc, item) => acc + item.total, 0), invoice.currency)}</td>
                <td>
                  {reminderTasks.has(invoice.id) ? (
                    <Link
                      href={reminderTasks.get(invoice.id)!.url}
                      style={{
                        color: "#38bdf8",
                        textDecoration: "none",
                        fontWeight: 600
                      }}
                    >
                      {reminderTasks.get(invoice.id)!.label}
                    </Link>
                  ) : (
                    <span style={{ color: "#64748b" }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={{ marginTop: "3rem" }}>
        <h3 style={{ marginBottom: "0.5rem" }}>Pricing insights</h3>
        <p className="text-muted" style={{ maxWidth: "680px" }}>
          Use contribution margins to guide retainers and project proposals. Suggestions factor in delivery costs and target
          profitability thresholds.
        </p>
        <table className="table">
          <thead>
            <tr>
              <th>Service</th>
              <th>Current rate</th>
              <th>Recommended rate</th>
              <th>Margin</th>
              <th>Adjustment</th>
              <th>Guidance</th>
            </tr>
          </thead>
          <tbody>
            {pricingSuggestions.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", color: "#94a3b8" }}>
                  No pricing suggestions available yet. Add financial data to generate insights.
                </td>
              </tr>
            ) : (
              pricingSuggestions.map((suggestion) => (
                <tr key={suggestion.project_id}>
                  <td>{suggestion.service}</td>
                  <td>{formatCurrency(suggestion.current_rate, suggestion.currency)}</td>
                  <td>{formatCurrency(suggestion.recommended_rate, suggestion.currency)}</td>
                  <td>{suggestion.current_margin.toFixed(1)}%</td>
                  <td>
                    {suggestion.recommended_adjustment_pct >= 0
                      ? `+${suggestion.recommended_adjustment_pct.toFixed(1)}%`
                      : `${suggestion.recommended_adjustment_pct.toFixed(1)}%`}
                  </td>
                  <td style={{ maxWidth: "320px" }}>{suggestion.rationale}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <div style={{ marginTop: "3rem" }}>
        <Link
          href="/financials/tax-calculator"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            color: "#38bdf8",
            fontWeight: 600,
            textDecoration: "none"
          }}
        >
          Open Philippines tax calculator →
        </Link>
      </div>
    </div>
  );
}
