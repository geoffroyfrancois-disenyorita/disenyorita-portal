import { api, CapacityAlert, MonitoringIncident, OperationsProject, OperationsSnapshot, TimeOffWindow } from "../../lib/api";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
}

function formatRunway(days: number | null): string {
  if (days === null) {
    return "Not enough data";
  }
  if (days <= 30) {
    return `${days} day${days === 1 ? "" : "s"}`;
  }
  const months = Math.floor(days / 30);
  const remainingDays = days % 30;
  if (remainingDays === 0) {
    return `${months} month${months === 1 ? "" : "s"}`;
  }
  return `${months}m ${remainingDays}d`;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function toneForSeverity(incident: MonitoringIncident): string {
  switch (incident.severity) {
    case "critical":
      return "badge danger";
    case "warning":
      return "badge warning";
    default:
      return "badge";
  }
}

function capacitySummary(alerts: CapacityAlert[]): string {
  if (alerts.length === 0) {
    return "All team members have adequate buffer.";
  }
  const tightest = alerts[0];
  return `${alerts.length} team member${alerts.length === 1 ? "" : "s"} nearing capacity — ${
    tightest.employee_name
  } has only ${Math.round(tightest.available_hours)}h free.`;
}

async function getOperations(): Promise<OperationsSnapshot> {
  return api.operations();
}

export async function OperationsPanel(): Promise<JSX.Element> {
  const snapshot = await getOperations();
  const runwayLabel = formatRunway(snapshot.cash.runway_days);
  const collectionRate = Math.round(snapshot.cash.collection_rate * 100);

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "1.5rem", marginTop: "3rem" }}>
      <div className="grid-two">
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
            <div>
              <h3 style={{ margin: 0 }}>Cash runway</h3>
              <p className="text-muted" style={{ margin: 0 }}>
                Live view of the combined studio + hospitality cash position.
              </p>
            </div>
            <span className="badge warning" style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {runwayLabel}
            </span>
          </div>
          <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
            <div>
              <p className="text-muted" style={{ margin: 0 }}>Cash on hand</p>
              <strong style={{ fontSize: "1.4rem" }}>{formatCurrency(snapshot.cash.total_cash_on_hand)}</strong>
            </div>
            <div>
              <p className="text-muted" style={{ margin: 0 }}>Monthly burn</p>
              <strong style={{ fontSize: "1.4rem" }}>{formatCurrency(snapshot.cash.monthly_burn_rate)}</strong>
            </div>
            <div>
              <p className="text-muted" style={{ margin: 0 }}>Outstanding invoices</p>
              <strong>{formatCurrency(snapshot.cash.outstanding_invoices)}</strong>
            </div>
            <div>
              <p className="text-muted" style={{ margin: 0 }}>Collection rate</p>
              <strong>{collectionRate}%</strong>
            </div>
          </div>
          <div>
            <h4 style={{ margin: "0 0 0.5rem 0" }}>Recommended actions</h4>
            <ul className="plain-list">
              {snapshot.recommendations.map((recommendation) => (
                <li key={`${recommendation.category}-${recommendation.title}`}>
                  <span style={{ fontWeight: 600 }}>{recommendation.title}</span>
                  <p className="text-muted" style={{ margin: "0.25rem 0 0 0" }}>
                    {recommendation.description}
                  </p>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-muted" style={{ margin: 0, fontSize: "0.8rem" }}>
            Generated {new Date(snapshot.generated_at).toLocaleString()}.
          </p>
        </div>
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <h3 style={{ margin: 0 }}>Delivery watchlist</h3>
            <p className="text-muted" style={{ margin: 0 }}>{capacitySummary(snapshot.capacity_alerts)}</p>
          </div>
          <div>
            <h4 style={{ margin: "0 0 0.5rem 0" }}>Projects at risk</h4>
            {snapshot.at_risk_projects.length === 0 ? (
              <p className="text-muted" style={{ margin: 0 }}>No active delivery risks right now.</p>
            ) : (
              <ul className="plain-list">
                {snapshot.at_risk_projects.map((project: OperationsProject) => (
                  <li key={project.project_id} style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
                      <span style={{ fontWeight: 600 }}>{project.project_name}</span>
                      <span className="badge danger" style={{ textTransform: "capitalize" }}>
                        {project.health.replace("_", " ")}
                      </span>
                    </div>
                  <p className="text-muted" style={{ margin: 0 }}>
                    {project.client_name ?? "Unassigned client"} • {project.late_tasks} late task{project.late_tasks === 1 ? "" : "s"}
                    {project.next_milestone_title
                      ? ` • Next milestone "${project.next_milestone_title}" on ${formatDate(project.next_milestone_due ?? "")}`
                      : ""}
                  </p>
                  {project.active_sprint_name ? (
                    <p className="text-muted" style={{ margin: 0 }}>
                      Sprint {project.active_sprint_name} — {Math.round((project.sprint_completed_points ?? 0) * 10) / 10}/
                      {Math.round((project.sprint_committed_points ?? 0) * 10) / 10} pts
                      {project.velocity ? ` • Velocity ${Math.round(project.velocity * 10) / 10} pts/sprint` : ""}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
          <div>
            <h4 style={{ margin: "0 0 0.5rem 0" }}>Monitoring incidents</h4>
            {snapshot.monitoring_incidents.length === 0 ? (
              <p className="text-muted" style={{ margin: 0 }}>All monitored assets are healthy.</p>
            ) : (
              <ul className="plain-list">
                {snapshot.monitoring_incidents.map((incident: MonitoringIncident) => (
                  <li key={`${incident.site_id}-${incident.triggered_at}`} style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
                      <span style={{ fontWeight: 600 }}>{incident.site_label}</span>
                      <span className={toneForSeverity(incident)} style={{ textTransform: "capitalize" }}>
                        {incident.severity}
                      </span>
                    </div>
                    <p className="text-muted" style={{ margin: 0 }}>{incident.message}</p>
                    <span style={{ fontSize: "0.8rem", color: "#b08977" }}>
                      Triggered {new Date(incident.triggered_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div>
          <h3 style={{ margin: 0 }}>Team schedule</h3>
          <p className="text-muted" style={{ margin: 0 }}>
            Keep stakeholders informed about who is away before you commit to new deliverables.
          </p>
        </div>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Team member</th>
                <th>Status</th>
                <th>Window</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.upcoming_time_off.map((window: TimeOffWindow) => (
                <tr key={`${window.employee_id}-${window.start_date}`}>
                  <td>{window.employee_name}</td>
                  <td style={{ textTransform: "capitalize" }}>{window.status.replace("_", " ")}</td>
                  <td>
                    {formatDate(window.start_date)} → {formatDate(window.end_date)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
