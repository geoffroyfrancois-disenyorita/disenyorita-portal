export const dynamic = "force-dynamic";

import { api, AutomationDigest } from "../../lib/api";

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

async function getAutomationHistory(): Promise<AutomationDigest[]> {
  return api.automationHistory();
}

export default async function AutomationHistoryPage(): Promise<JSX.Element> {
  const history = await getAutomationHistory();

  return (
    <div>
      <h2 className="section-title">Automation archive</h2>
      <p className="text-muted" style={{ maxWidth: "720px" }}>
        Daily snapshots capture the automation engine output for audit trails and change management. Use the archive to see
        how playbooks evolve over time and which teams are absorbing actions.
      </p>
      <table className="table" style={{ marginTop: "1.5rem" }}>
        <thead>
          <tr>
            <th>Generated</th>
            <th>Total tasks</th>
            <th>Top priority</th>
            <th>Highlights</th>
          </tr>
        </thead>
        <tbody>
          {history.length === 0 ? (
            <tr>
              <td colSpan={4} style={{ textAlign: "center", color: "#8c6f63" }}>
                No automation history recorded yet.
              </td>
            </tr>
          ) : (
            history
              .slice()
              .reverse()
              .map((digest) => {
                const priorities = digest.tasks.map((task) => task.priority);
                const topPriority = priorities.includes("critical")
                  ? "critical"
                  : priorities.includes("high")
                  ? "high"
                  : priorities.includes("medium")
                  ? "medium"
                  : "low";
                const highlights = digest.tasks.slice(0, 3).map((task) => task.summary);
                return (
                  <tr key={digest.id}>
                    <td>{formatDate(digest.generated_at)}</td>
                    <td>{digest.tasks.length}</td>
                    <td style={{ textTransform: "capitalize" }}>{topPriority}</td>
                    <td>{highlights.join(" • ")}</td>
                  </tr>
                );
              })
          )}
        </tbody>
      </table>
    </div>
  );
}
