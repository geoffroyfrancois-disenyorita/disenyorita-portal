export const dynamic = "force-dynamic";

import { api, SiteStatus } from "../../lib/api";

async function getStatuses(): Promise<SiteStatus[]> {
  return api.siteStatuses();
}

function statusTone(status: string): string {
  return status === "passing" ? "badge success" : "badge danger";
}

export default async function MonitoringPage(): Promise<JSX.Element> {
  const statuses = await getStatuses();

  return (
    <div>
      <h2 className="section-title">Digital Health</h2>
      <p className="text-muted" style={{ maxWidth: "680px" }}>
        Automated uptime, SSL, and performance checks ensure every launch remains stable. Alerts surface proactive remediations.
      </p>
      <div className="grid-two">
        {statuses.map((status) => (
          <div key={status.site.id} className="card">
            <h3 style={{ marginBottom: "0.25rem" }}>{status.site.label}</h3>
            <p className="text-muted" style={{ marginTop: 0 }}>
              {status.site.url}
            </p>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "1rem" }}>
              {status.checks.map((check) => (
                <span key={check.id} className={statusTone(check.status)}>
                  {check.type} · {check.status}
                </span>
              ))}
            </div>
            <div style={{ marginTop: "1.5rem" }}>
              <h4 style={{ marginBottom: "0.5rem" }}>Alerts</h4>
              {status.alerts.length === 0 && <p className="text-muted">All clear.</p>}
              {status.alerts.map((alert) => (
                <div key={alert.id} style={{ marginBottom: "0.5rem" }}>
                  <span className="badge warning" style={{ marginRight: "0.5rem" }}>
                    {alert.severity}
                  </span>
                  <span>{alert.message}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
