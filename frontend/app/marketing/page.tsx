export const dynamic = "force-dynamic";

import Link from "next/link";

import { api, AutomationDigest, Campaign } from "../../lib/api";

async function getCampaigns(): Promise<Campaign[]> {
  return api.campaigns();
}

async function getAutomationDigest(): Promise<AutomationDigest> {
  return api.automationDigest();
}

export default async function MarketingPage(): Promise<JSX.Element> {
  const [campaigns, digest] = await Promise.all([getCampaigns(), getAutomationDigest()]);

  const marketingTasks = digest.tasks.filter((task) => task.category === "marketing").slice(0, 5);

  return (
    <div>
      <h2 className="section-title">Marketing Operations</h2>
      <p className="text-muted" style={{ maxWidth: "680px" }}>
        Editorial calendar connects brand assets, scheduled posts, and attribution metrics to keep both teams in sync.
      </p>
      <table className="table">
        <thead>
          <tr>
            <th>Campaign</th>
            <th>Objective</th>
            <th>Channel</th>
            <th>Owner</th>
            <th>Start</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((campaign) => (
            <tr key={campaign.id}>
              <td>{campaign.name}</td>
              <td>{campaign.objective}</td>
              <td style={{ textTransform: "capitalize" }}>{campaign.channel}</td>
              <td>{campaign.owner_id}</td>
              <td>{new Date(campaign.start_date).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <section className="card" style={{ marginTop: "2.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div>
          <h3 style={{ margin: 0 }}>Automation quick wins</h3>
          <p className="text-muted" style={{ margin: 0 }}>
            Align the content studio with automation prompts so planned assets are approved and published on time.
          </p>
        </div>
        {marketingTasks.length === 0 ? (
          <p className="text-muted" style={{ margin: 0 }}>No pending marketing automations.</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {marketingTasks.map((task) => (
              <li key={task.id} style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 600 }}>{task.summary}</p>
                  {task.details && <p style={{ margin: "0.25rem 0", color: "#64748b" }}>{task.details}</p>}
                  {task.due_at && (
                    <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>
                      Due {new Date(task.due_at).toLocaleString()}
                    </p>
                  )}
                </div>
                <Link
                  href={task.action_url ?? "/marketing"}
                  style={{ color: "#6366f1", fontWeight: 600, textDecoration: "none", alignSelf: "center" }}
                >
                  {task.action_label ?? "Open"}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
