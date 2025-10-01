export const dynamic = "force-dynamic";

import Link from "next/link";

import { api, AutomationDigest, Ticket } from "../../lib/api";

async function getTickets(): Promise<Ticket[]> {
  return api.supportTickets();
}

async function getAutomationDigest(): Promise<AutomationDigest> {
  return api.automationDigest();
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
  const [tickets, digest] = await Promise.all([getTickets(), getAutomationDigest()]);

  const ticketActions = new Map<string, { label: string; url: string }>();
  digest.tasks.forEach((task) => {
    const ticketId = task.related_ids?.ticket_id;
    if (!ticketId) {
      return;
    }
    ticketActions.set(ticketId, {
      label: task.action_label ?? "Open ticket",
      url: task.action_url ?? "/support"
    });
  });

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
            <th>Quick action</th>
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
              <td>
                {ticketActions.has(ticket.id) ? (
                  <Link
                    href={ticketActions.get(ticket.id)!.url}
                    style={{ color: "#8b3921", textDecoration: "none", fontWeight: 600 }}
                  >
                    {ticketActions.get(ticket.id)!.label}
                  </Link>
                ) : (
                  <span style={{ color: "#8c6f63" }}>—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
