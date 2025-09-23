export const dynamic = "force-dynamic";

import { api, Project } from "../../lib/api";

async function getProjects(): Promise<Project[]> {
  return api.projects();
}

function badgeTone(status: string): string {
  switch (status) {
    case "completed":
      return "badge success";
    case "in_progress":
      return "badge warning";
    case "planning":
      return "badge";
    default:
      return "badge danger";
  }
}

export default async function ProjectsPage(): Promise<JSX.Element> {
  const projects = await getProjects();

  return (
    <div>
      <h2 className="section-title">Project Portfolio</h2>
      <p className="text-muted" style={{ maxWidth: "680px" }}>
        Cross-brand visibility into web builds, branding programs, hotel audits, and restaurant launches. Tasks, milestones, and
        budgets inherit governance from reusable templates.
      </p>
      <table className="table">
        <thead>
          <tr>
            <th>Project</th>
            <th>Type</th>
            <th>Status</th>
            <th>Budget</th>
            <th>Started</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => (
            <tr key={project.id}>
              <td>
                <strong>{project.name}</strong>
                <div className="text-muted" style={{ fontSize: "0.8rem" }}>
                  {project.code}
                </div>
              </td>
              <td style={{ textTransform: "capitalize" }}>{project.project_type.replace("_", " ")}</td>
              <td>
                <span className={badgeTone(project.status)} style={{ textTransform: "capitalize" }}>
                  {project.status.replace("_", " ")}
                </span>
              </td>
              <td>{project.budget ? `$${project.budget.toLocaleString()}` : "—"}</td>
              <td>{new Date(project.start_date).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
