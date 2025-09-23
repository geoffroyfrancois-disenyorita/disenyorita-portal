export const dynamic = "force-dynamic";

import { api, Client } from "../../lib/api";

async function getClients(): Promise<Client[]> {
  return api.clients();
}

function labelForSegment(segment: string): string {
  switch (segment) {
    case "retainer":
      return "badge success";
    case "project":
      return "badge";
    case "vip":
      return "badge warning";
    default:
      return "badge";
  }
}

export default async function ClientsPage(): Promise<JSX.Element> {
  const clients = await getClients();

  return (
    <div>
      <h2 className="section-title">Client Intelligence</h2>
      <p className="text-muted" style={{ maxWidth: "680px" }}>
        Every account centralizes contacts, documents, and preferred communication channels to power proactive service across the
        two brands.
      </p>
      <table className="table">
        <thead>
          <tr>
            <th>Organization</th>
            <th>Industry</th>
            <th>Segment</th>
            <th>Billing Email</th>
            <th>Timezone</th>
          </tr>
        </thead>
        <tbody>
          {clients.map((client) => (
            <tr key={client.id}>
              <td>{client.organization_name}</td>
              <td style={{ textTransform: "capitalize" }}>{client.industry}</td>
              <td>
                <span className={labelForSegment(client.segment)} style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  {client.segment}
                </span>
              </td>
              <td>{client.billing_email}</td>
              <td>{client.timezone}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
