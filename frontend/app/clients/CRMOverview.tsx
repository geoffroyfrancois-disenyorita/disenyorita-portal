import { ClientCRMOverview, ClientSegment } from "../../lib/api";

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0
});

const numberFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const percentFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

function formatMetricValue(metric: ClientCRMOverview["metrics"][number]): string {
  switch (metric.unit) {
    case "currency":
      return currencyFormatter.format(metric.value);
    case "percent":
      return `${percentFormatter.format(metric.value)}%`;
    case "days":
      return `${Math.round(metric.value)} days`;
    case "accounts":
      return numberFormatter.format(metric.value);
    default:
      return metric.value.toString();
  }
}

const segmentLabels: Record<ClientSegment, string> = {
  retainer: "Retainer",
  project: "Project",
  vip: "VIP",
  prospect: "Prospect"
};

const segmentBadgeClass: Record<ClientSegment, string> = {
  retainer: "success",
  project: "neutral",
  vip: "warning",
  prospect: "info"
};

function formatDays(value?: number | null): string {
  if (value === null || value === undefined) {
    return "—";
  }
  return `${Math.round(value)} days`;
}

function formatLastInteraction(days?: number | null): string {
  if (days === null || days === undefined) {
    return "No interactions recorded";
  }
  if (days <= 0) {
    return "Touched today";
  }
  if (days === 1) {
    return "1 day ago";
  }
  return `${days} days ago`;
}

function formatChannel(channel: string): string {
  switch (channel) {
    case "email":
      return "Email";
    case "portal":
      return "Client portal";
    case "social":
      return "Social";
    case "phone":
      return "Phone";
    default:
      return channel;
  }
}

interface CRMOverviewProps {
  overview: ClientCRMOverview;
}

export function CRMOverview({ overview }: CRMOverviewProps): JSX.Element {
  return (
    <section className="crm-overview" aria-labelledby="crm-overview-title">
      <h3 id="crm-overview-title" className="sr-only">
        CRM overview
      </h3>
      <div className="crm-metrics" role="list">
        {overview.metrics.map((metric) => (
          <article key={metric.label} className="crm-metric-card" role="listitem">
            <header className="crm-metric-header">
              <h4>{metric.label}</h4>
              {metric.description && <p className="crm-metric-description">{metric.description}</p>}
            </header>
            <p className="crm-metric-value">{formatMetricValue(metric)}</p>
          </article>
        ))}
      </div>

      <div className="crm-overview-grid">
        <section className="crm-section crm-section--pipeline" aria-labelledby="crm-pipeline-title">
          <div className="crm-section-header">
            <div>
              <h4 id="crm-pipeline-title">Pipeline health</h4>
              <p className="crm-section-subtitle">
                Segment coverage and account velocity grouped by delivery model.
              </p>
            </div>
          </div>
          <div className="table-scroll">
            <table className="table crm-pipeline-table">
              <thead>
                <tr>
                  <th scope="col">Stage</th>
                  <th scope="col">Accounts</th>
                  <th scope="col">Active projects</th>
                  <th scope="col">Outstanding</th>
                  <th scope="col">Avg days since touch</th>
                  <th scope="col">Follow-ups</th>
                </tr>
              </thead>
              <tbody>
                {overview.pipeline.map((stage) => (
                  <tr key={stage.segment}>
                    <th scope="row">
                      <div className="crm-pipeline-stage">
                        <span className={`badge ${segmentBadgeClass[stage.segment]}`}>
                          {segmentLabels[stage.segment]}
                        </span>
                        <span>{stage.label}</span>
                      </div>
                    </th>
                    <td>{numberFormatter.format(stage.client_count)}</td>
                    <td>{numberFormatter.format(stage.total_active_projects)}</td>
                    <td>{currencyFormatter.format(stage.total_outstanding_balance)}</td>
                    <td>{formatDays(stage.avg_days_since_touch)}</td>
                    <td>
                      {stage.follow_up_needed > 0 ? (
                        <span className="crm-followup-highlight">
                          {numberFormatter.format(stage.follow_up_needed)} need outreach
                        </span>
                      ) : (
                        "All engaged"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="crm-section" aria-labelledby="crm-interactions-title">
          <div className="crm-section-header">
            <div>
              <h4 id="crm-interactions-title">Proactive follow-ups</h4>
              <p className="crm-section-subtitle">
                Accounts without a touchpoint in the last three weeks automatically surface here.
              </p>
            </div>
          </div>
          <ul className="crm-gap-list">
            {overview.interaction_gaps.length === 0 && (
              <li className="crm-gap-item empty">Every account has been contacted within the last 21 days.</li>
            )}
            {overview.interaction_gaps.map((gap) => (
              <li key={gap.client_id} className="crm-gap-item">
                <div className="crm-gap-header">
                  <span className="crm-gap-name">{gap.organization_name}</span>
                  <span className={`badge ${segmentBadgeClass[gap.segment]}`}>
                    {segmentLabels[gap.segment]}
                  </span>
                </div>
                <div className="crm-gap-meta">
                  <span>{formatLastInteraction(gap.days_since_last)}</span>
                  <span>Prefers {formatChannel(gap.preferred_channel)}</span>
                </div>
                <p className="crm-gap-action">{gap.suggested_next_step}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="crm-section" aria-labelledby="crm-contacts-title">
          <div className="crm-section-header">
            <div>
              <h4 id="crm-contacts-title">Contact coverage gaps</h4>
              <p className="crm-section-subtitle">
                Ensure every account has buying committee stakeholders documented.
              </p>
            </div>
          </div>
          <ul className="crm-gap-list">
            {overview.contact_gaps.length === 0 && (
              <li className="crm-gap-item empty">Contact coverage looks great across all clients.</li>
            )}
            {overview.contact_gaps.map((gap) => (
              <li key={gap.client_id} className="crm-gap-item">
                <div className="crm-gap-header">
                  <span className="crm-gap-name">{gap.organization_name}</span>
                  <span className={`badge ${segmentBadgeClass[gap.segment]}`}>
                    {segmentLabels[gap.segment]}
                  </span>
                </div>
                <div className="crm-gap-meta">
                  <span>{numberFormatter.format(gap.contact_count)} contacts</span>
                </div>
                <p className="crm-gap-action">Add a {gap.recommended_role.toLowerCase()} to strengthen engagement.</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </section>
  );
}

