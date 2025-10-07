export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";

import { api, ClientDashboard } from "../../../lib/api";

interface ClientPageProps {
  params: { clientId: string };
}

async function getClientDashboard(clientId: string): Promise<ClientDashboard | null> {
  try {
    return await api.clientDashboard(clientId);
  } catch (error) {
    console.error(error);
    return null;
  }
}

function formatDate(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(date);
}

function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency
  }).format(amount);
}

const revenueLabels: Record<string, string> = {
  monthly_subscription: "Monthly subscription",
  annual_subscription: "Annual subscription",
  one_time: "One-time engagement",
  multi_payment: "Installment plan"
};

function formatRevenueAmount(amount: number, classification: string, currency: string): string {
  const formatted = formatCurrency(amount, currency);
  if (classification === "monthly_subscription") {
    return `${formatted} / mo`;
  }
  if (classification === "annual_subscription") {
    return `${formatted} / yr`;
  }
  return formatted;
}

function formatRevenueDetails(profile: ClientDashboard["client"]["revenue_profile"]): string {
  const parts: string[] = [];
  if (profile.autopay) {
    parts.push("Autopay enabled");
  }
  if (profile.payment_count) {
    parts.push(`${profile.payment_count} payments`);
  }
  if (profile.remaining_balance) {
    parts.push(`${formatCurrency(profile.remaining_balance, profile.currency)} outstanding`);
  }
  if (profile.next_payment_due) {
    parts.push(`Next payment ${formatDate(profile.next_payment_due)}`);
  }
  if (profile.last_payment_at) {
    parts.push(`Last paid ${formatDate(profile.last_payment_at)}`);
  }
  return parts.join(" • ") || "Billing details up to date";
}

export default async function ClientDetailPage({ params }: ClientPageProps): Promise<JSX.Element> {
  const dashboard = await getClientDashboard(params.clientId);

  if (!dashboard) {
    notFound();
  }

  const { client, projects, financials, support } = dashboard;

  return (
    <div className="client-detail">
      <Link href="/clients" className="back-link">
        ← Back to clients
      </Link>
      <h1 className="section-title">{client.organization_name}</h1>
      <p className="text-muted" style={{ maxWidth: "760px" }}>
        Centralized intelligence for {client.organization_name}. Review project delivery, revenue health, and active support
        engagements to stay ahead of client expectations.
      </p>

      <div className="card-grid detail-cards">
        <div className="card">
          <h3>Client profile</h3>
          <dl className="definition-list">
            <div>
              <dt>Industry</dt>
              <dd style={{ textTransform: "capitalize" }}>{client.industry}</dd>
            </div>
            <div>
              <dt>Segment</dt>
              <dd style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}>{client.segment}</dd>
            </div>
            <div>
              <dt>Billing email</dt>
              <dd>{client.billing_email}</dd>
            </div>
            <div>
              <dt>Preferred channel</dt>
              <dd style={{ textTransform: "capitalize" }}>{client.preferred_channel}</dd>
            </div>
            <div>
              <dt>Timezone</dt>
              <dd>{client.timezone}</dd>
            </div>
          </dl>
          {client.contacts && client.contacts.length > 0 && (
            <div className="stack">
              <h4>Key contacts</h4>
              <ul className="stack">
                {client.contacts.map((contact) => (
                  <li key={contact.id}>
                    <strong>
                      {contact.first_name} {contact.last_name}
                    </strong>
                    {contact.title && <div className="text-muted">{contact.title}</div>}
                    <div>{contact.email}</div>
                    {contact.phone && <div>{contact.phone}</div>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="card">
          <h3>Revenue program</h3>
          <div className="metric">
            <span>Billing model</span>
            <strong>{revenueLabels[client.revenue_profile.classification] ?? "Custom"}</strong>
          </div>
          <div className="metric">
            <span>Contract value</span>
            <strong>
              {formatRevenueAmount(
                client.revenue_profile.amount,
                client.revenue_profile.classification,
                client.revenue_profile.currency
              )}
            </strong>
          </div>
          <p className="text-muted" style={{ marginTop: "0.75rem" }}>
            {formatRevenueDetails(client.revenue_profile)}
          </p>
        </div>

        <div className="card">
          <h3>Financial pulse</h3>
          <div className="metric">
            <span>Total outstanding</span>
            <strong>{formatCurrency(financials.total_outstanding)}</strong>
          </div>
          <div className="metric">
            <span>Next payment due</span>
            <strong>
              {financials.next_invoice_due
                ? `${formatCurrency(financials.next_invoice_due.balance_due, financials.next_invoice_due.currency)} · ${formatDate(
                    financials.next_invoice_due.due_date
                  )}`
                : "No pending invoices"}
            </strong>
          </div>
          {financials.recent_payments.length > 0 && (
            <div className="stack">
              <h4>Recent payments</h4>
              <ul className="stack">
                {financials.recent_payments.slice(0, 3).map((payment) => (
                  <li key={payment.id}>
                    {formatCurrency(payment.amount)} received on {formatDate(payment.received_at)} via {payment.method}
                    {payment.invoice_number && <span className="text-muted"> · Invoice {payment.invoice_number}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="card">
          <h3>Support status</h3>
          <div className="metric">
            <span>Open tickets</span>
            <strong>{support.open_tickets.length}</strong>
          </div>
          <div className="metric">
            <span>Last activity</span>
            <strong>{support.last_ticket_update ? formatDate(support.last_ticket_update) : "No recent updates"}</strong>
          </div>
          {support.open_tickets.length > 0 && (
            <ul className="stack">
              {support.open_tickets.map((ticket) => (
                <li key={ticket.id}>
                  <strong>{ticket.subject}</strong>
                  <div className="text-muted">
                    {ticket.status.replace("_", " ")} · Priority {ticket.priority}
                  </div>
                  {ticket.sla_due && <div>Target SLA: {formatDate(ticket.sla_due)}</div>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <section className="detail-section">
        <h2>Projects in progress</h2>
        <p className="text-muted">Track delivery milestones, upcoming tasks, and leadership across every engagement.</p>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Type</th>
                <th>Status</th>
                <th>Next milestone</th>
                <th>Next task</th>
                <th>Budget</th>
              </tr>
            </thead>
            <tbody>
              {projects.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-muted">
                    No active projects yet.
                  </td>
                </tr>
              )}
              {projects.map((project) => (
                <tr key={project.id}>
                  <td>
                    <div className="stack">
                      <strong>{project.name}</strong>
                      <span className="text-muted">Code {project.code}</span>
                    </div>
                  </td>
                  <td style={{ textTransform: "capitalize" }}>{project.project_type}</td>
                  <td style={{ textTransform: "capitalize" }}>{project.status.replace("_", " ")}</td>
                  <td>{project.next_milestone ? `${project.next_milestone.title} · ${formatDate(project.next_milestone.due_date)}` : "-"}</td>
                  <td>{project.next_task ? `${project.next_task.name} · ${formatDate(project.next_task.due_date)}` : "-"}</td>
                  <td>
                    {typeof project.budget === "number"
                      ? formatCurrency(project.budget, project.currency)
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="detail-section">
        <h2>Outstanding invoices</h2>
        <p className="text-muted">Monitor cash flow risk and upcoming payment commitments.</p>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Project</th>
                <th>Status</th>
                <th>Due date</th>
                <th>Balance due</th>
              </tr>
            </thead>
            <tbody>
              {financials.outstanding_invoices.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-muted">
                    No outstanding balances.
                  </td>
                </tr>
              )}
              {financials.outstanding_invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td>{invoice.number}</td>
                  <td>{invoice.project_name ?? "-"}</td>
                  <td style={{ textTransform: "capitalize" }}>{invoice.status.replace("_", " ")}</td>
                  <td>{formatDate(invoice.due_date)}</td>
                  <td>{formatCurrency(invoice.balance_due, invoice.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
