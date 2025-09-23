export const dynamic = "force-dynamic";

import { api, Ticket } from "../../lib/api";

async function getTickets(): Promise<Ticket[]> {
  return api.supportTickets();
}

function priorityTone(priority: string): string {
  switch (priority) {
    case "high":
      return "badge danger";
    case "medium":
      return "badge warning";
    default:
      return "badge";
  }
}

export default async function SupportPage(): Promise<JSX.Element> {
  const tickets = await getTickets();

  return (
    <div>
      <h2 className="section-title">Support Desk</h2>
      <p className="text-muted" style={{ maxWidth: "680px" }}>
        Unified inbox aggregates emails, portal messages, and social DMs with SLA tracking and AI-assisted triage.
      </p>
      <table className="table">
        <thead>
          <tr>
            <th>Subject</th>
            <th>Status</th>
            <th>Priority</th>
            <th>Assignee</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket) => (
            <tr key={ticket.id}>
              <td>{ticket.subject}</td>
              <td style={{ textTransform: "capitalize" }}>{ticket.status.replace("_", " ")}</td>
              <td>
                <span className={priorityTone(ticket.priority)} style={{ textTransform: "capitalize" }}>
                  {ticket.priority}
                </span>
              </td>
              <td>{ticket.assignee_id ?? "Unassigned"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
