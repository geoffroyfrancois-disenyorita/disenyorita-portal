export const dynamic = "force-dynamic";

import { api, DashboardSnapshot } from "../lib/api";
import { MetricCard } from "./components/MetricCard";

async function getDashboard(): Promise<DashboardSnapshot> {
  return api.dashboard();
}

export default async function DashboardPage(): Promise<JSX.Element> {
  const data = await getDashboard();

  return (
    <div>
      <h2 className="section-title">Executive Overview</h2>
      <p className="text-muted" style={{ maxWidth: "720px" }}>
        Consolidated KPIs for Disenyorita's digital studio and Isla's hospitality consulting practice. All metrics update from the
        secure API with RBAC-aware access policies.
      </p>
      <div className="card-grid" style={{ marginTop: "2rem" }}>
        <MetricCard title="Active projects" value={String(data.projects.total_projects)} helper="Across both business units" />
        <MetricCard title="MRR" value={`$${data.financials.mrr.toLocaleString()}`} helper="Recurring retainers" tone="success" />
        <MetricCard
          title="Avg response"
          value={`${data.support.response_time_minutes}m`}
          helper="Client communications"
          tone="warning"
        />
        <MetricCard
          title="Scheduled posts"
          value={String(data.marketing.scheduled_posts)}
          helper="Marketing calendar"
          tone="default"
        />
        <MetricCard
          title="Monitoring incidents"
          value={String(data.monitoring.incidents_today)}
          helper="Last 24 hours"
          tone={data.monitoring.incidents_today > 0 ? "danger" : "success"}
        />
        <MetricCard
          title="Portal adoption"
          value={`${data.clients.active_portal_users}/${data.clients.total_clients}`}
          helper="Clients using secure portal"
        />
      </div>
    </div>
  );
}
