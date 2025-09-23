export const dynamic = "force-dynamic";

import { api, Invoice } from "../../lib/api";

async function getInvoices(): Promise<Invoice[]> {
  return api.invoices();
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

export default async function FinancialsPage(): Promise<JSX.Element> {
  const invoices = await getInvoices();

  return (
    <div>
      <h2 className="section-title">Financial Control</h2>
      <p className="text-muted" style={{ maxWidth: "680px" }}>
        Invoices, payments, and expenses link directly to projects and clients to simplify billing accuracy and profitability
        reporting.
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
              <td>
                {`$${invoice.items.reduce((acc, item) => acc + item.total, 0).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
