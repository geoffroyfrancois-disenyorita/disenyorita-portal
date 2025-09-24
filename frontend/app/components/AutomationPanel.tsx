import Link from "next/link";

import { api, AutomationDigest, AutomationTask } from "../../lib/api";

function priorityTone(priority: AutomationTask["priority"]): string {
  switch (priority) {
    case "critical":
      return "badge danger";
    case "high":
      return "badge warning";
    case "medium":
      return "badge";
    default:
      return "badge muted";
  }
}

function formatDueDate(task: AutomationTask): string | null {
  if (!task.due_at) {
    return null;
  }
  const dueDate = new Date(task.due_at);
  const now = new Date();
  const diffMs = dueDate.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) {
    return "Due today";
  }
  if (diffDays < 0) {
    return `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? "" : "s"}`;
  }
  if (diffDays === 1) {
    return "Due tomorrow";
  }
  return `Due in ${diffDays} days`;
}

function deriveFallbackAction(task: AutomationTask): string {
  switch (task.category) {
    case "finance":
      return "/financials";
    case "project":
      return "/projects";
    case "marketing":
      return "/marketing";
    case "support":
      return "/support";
    case "hr":
      return "/hr";
    case "monitoring":
      return "/monitoring";
    case "client":
    default:
      return "/clients";
  }
}

async function getAutomationDigest(): Promise<AutomationDigest> {
  return api.automationDigest();
}

export async function AutomationPanel(): Promise<JSX.Element> {
  const digest = await getAutomationDigest();
  const tasks = digest.tasks.slice(0, 6);

  return (
    <section className="card" style={{ marginTop: "3rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
        <div>
          <h3 style={{ margin: 0 }}>Automation priorities</h3>
          <p className="text-muted" style={{ margin: 0 }}>
            Digest generated {new Date(digest.generated_at).toLocaleString()} —
            surface the next best actions across teams with deep links and suggested owners.
          </p>
        </div>
        <Link href="/automation" style={{ color: "#6366f1", fontWeight: 600 }}>
          View full history →
        </Link>
      </div>
      {tasks.length === 0 ? (
        <p className="text-muted" style={{ margin: "0.5rem 0" }}>
          All clear! The automation engine has no outstanding follow-ups at the moment.
        </p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "1rem" }}>
          {tasks.map((task) => {
            const dueLabel = formatDueDate(task);
            const actionHref = task.action_url ?? deriveFallbackAction(task);
            return (
              <li
                key={task.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "1rem",
                  borderBottom: "1px solid rgba(148,163,184,0.2)",
                  paddingBottom: "1rem"
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <span className={priorityTone(task.priority)} style={{ textTransform: "uppercase", fontSize: "0.75rem" }}>
                      {task.priority}
                    </span>
                    <span style={{ fontWeight: 600 }}>{task.summary}</span>
                  </div>
                  {task.details && <p style={{ margin: 0, color: "#64748b" }}>{task.details}</p>}
                  <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", fontSize: "0.85rem", color: "#64748b" }}>
                    <span style={{ textTransform: "capitalize" }}>{task.category}</span>
                    {dueLabel && <span>{dueLabel}</span>}
                    {task.suggested_assignee && <span>Suggested: {task.suggested_assignee}</span>}
                  </div>
                </div>
                <Link
                  href={actionHref}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.65rem 1rem",
                    borderRadius: "0.75rem",
                    border: "1px solid rgba(129,140,248,0.4)",
                    color: "#6366f1",
                    fontWeight: 600,
                    textDecoration: "none",
                    background: "rgba(255,255,255,0.6)"
                  }}
                >
                  {task.action_label ?? "Open module"}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
