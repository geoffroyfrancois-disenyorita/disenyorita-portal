export const dynamic = "force-dynamic";

import { api, Client, ClientCRMOverview } from "../../lib/api";
import { ClientsTable } from "./ClientsTable";
import { CRMOverview } from "./CRMOverview";

async function getClients(): Promise<Client[]> {
  return api.clients();
}

async function getCrmOverview(): Promise<ClientCRMOverview> {
  return api.clientCRMOverview();
}

export default async function ClientsPage(): Promise<JSX.Element> {
  const [clients, overview] = await Promise.all([getClients(), getCrmOverview()]);

  return (
    <div className="crm-page">
      <h2 className="section-title">Client Relationship Hub</h2>
      <p className="text-muted" style={{ maxWidth: "760px" }}>
        Stay ahead of renewals and relationship risks with CRM-grade visibility across every account. Segment pipelines, prioritize
        outreach, and confirm that executive sponsors have the coverage they expect.
      </p>
      <CRMOverview overview={overview} />
      <ClientsTable clients={clients} />
    </div>
  );
}
