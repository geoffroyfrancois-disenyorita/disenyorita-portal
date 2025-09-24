export const dynamic = "force-dynamic";

import { api, Project } from "../../lib/api";
import ProjectsDashboard from "./ProjectsDashboard";

async function getProjects(): Promise<Project[]> {
  return api.projects();
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
      <ProjectsDashboard initialProjects={projects} />
    </div>
  );
}
