export const dynamic = "force-dynamic";

import { api, Client } from "../../lib/api";
import { ClientsTable } from "./ClientsTable";

async function getClients(): Promise<Client[]> {
  return api.clients();
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
      <ClientsTable clients={clients} />
    </div>
  );
}
