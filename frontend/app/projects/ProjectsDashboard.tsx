"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Project,
  ProjectStatus,
  ProjectTemplateCreateRequest,
  ProjectTemplateDefinition,
  ProjectUpdatePayload,
  Task,
  TaskStatus,
  TaskType,
  api
} from "../../lib/api";

const taskStatusOptions: TaskStatus[] = ["todo", "in_progress", "review", "done"];
const taskTypeOptions: TaskType[] = ["feature", "bug", "chore", "research", "qa"];
const projectStatusOptions: ProjectStatus[] = ["planning", "in_progress", "on_hold", "completed", "cancelled"];

function formatLabel(value: string): string {
  return value
    .replace(/_/g, " ")
    .split(" ")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function formatDate(value?: string | null): string {
  if (!value) {
    return "—";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }
  return parsed.toLocaleDateString();
}

function isoToDateInput(value?: string | null): string {
  if (!value) {
    return "";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return parsed.toISOString().slice(0, 10);
}

function formatCurrency(amount?: number | null, currency = "USD"): string {
  if (amount === undefined || amount === null) {
    return "—";
  }
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch (error) {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

interface ProjectsDashboardProps {
  initialProjects: Project[];
}

interface ProjectFormState {
  name: string;
  manager_id: string;
  start_date: string;
  budget: string;
  currency: string;
  status: ProjectStatus;
  template_id: string;
}

interface ProjectTaskEditState {
  id: string;
  status: TaskStatus;
  type: TaskType;
  leader_id: string;
  due_date: string;
}

interface TemplateTaskRow {
  name: string;
  durationDays: string;
  dependsText: string;
  status: TaskStatus;
  type: TaskType;
  estimatedHours: string;
  billable: boolean;
  leaderId: string;
}

interface TemplateMilestoneRow {
  title: string;
  offsetDays: string;
}

interface TemplateFormState {
  templateId: string;
  codePrefix: string;
  overwrite: boolean;
  tasks: TemplateTaskRow[];
  milestones: TemplateMilestoneRow[];
}

function normalizeTaskStatus(value: string): TaskStatus {
  return taskStatusOptions.includes(value as TaskStatus) ? (value as TaskStatus) : "todo";
}

function normalizeTaskType(value: string): TaskType {
  return taskTypeOptions.includes(value as TaskType) ? (value as TaskType) : "feature";
}

function normalizeProjectStatus(value: string): ProjectStatus {
  return projectStatusOptions.includes(value as ProjectStatus) ? (value as ProjectStatus) : "planning";
}

function createProjectFormState(project: Project): ProjectFormState {
  return {
    name: project.name,
    manager_id: project.manager_id,
    start_date: isoToDateInput(project.start_date),
    budget: project.budget !== undefined && project.budget !== null ? String(project.budget) : "",
    currency: project.currency,
    status: normalizeProjectStatus(project.status),
    template_id: project.project_type
  };
}

function createTaskEditState(task: Task): ProjectTaskEditState {
  return {
    id: task.id,
    status: normalizeTaskStatus(task.status),
    type: normalizeTaskType(task.type),
    leader_id: task.leader_id ?? "",
    due_date: isoToDateInput(task.due_date)
  };
}

function createTemplateTaskRow(): TemplateTaskRow {
  return {
    name: "",
    durationDays: "5",
    dependsText: "",
    status: "todo",
    type: "feature",
    estimatedHours: "",
    billable: true,
    leaderId: ""
  };
}

function createTemplateMilestoneRow(): TemplateMilestoneRow {
  return {
    title: "",
    offsetDays: "10"
  };
}

export default function ProjectsDashboard({ initialProjects }: ProjectsDashboardProps): JSX.Element {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    initialProjects.length > 0 ? initialProjects[0].id : null
  );
  const [selectedProject, setSelectedProject] = useState<Project | null>(
    initialProjects.length > 0 ? initialProjects[0] : null
  );
  const [projectForm, setProjectForm] = useState<ProjectFormState | null>(
    initialProjects.length > 0 ? createProjectFormState(initialProjects[0]) : null
  );
  const [taskEdits, setTaskEdits] = useState<ProjectTaskEditState[]>(
    initialProjects.length > 0 ? initialProjects[0].tasks.map(createTaskEditState) : []
  );
  const [projectMessage, setProjectMessage] = useState<string | null>(null);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [projectLoading, setProjectLoading] = useState(false);
  const [savingProject, setSavingProject] = useState(false);

  const [templates, setTemplates] = useState<ProjectTemplateDefinition[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templateMessage, setTemplateMessage] = useState<string | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const [templateForm, setTemplateForm] = useState<TemplateFormState>({
    templateId: "",
    codePrefix: "",
    overwrite: false,
    tasks: [createTemplateTaskRow()],
    milestones: []
  });

  useEffect(() => {
    let active = true;
    setTemplatesLoading(true);
    api
      .projectTemplates()
      .then((library) => {
        if (!active) {
          return;
        }
        setTemplates(library);
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setTemplateError("Unable to load project templates.");
      })
      .finally(() => {
        if (!active) {
          return;
        }
        setTemplatesLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (selectedProject) {
      setProjectForm(createProjectFormState(selectedProject));
      setTaskEdits(selectedProject.tasks.map(createTaskEditState));
    } else {
      setProjectForm(null);
      setTaskEdits([]);
    }
  }, [selectedProject]);

  const dependencyLookup = useMemo(() => {
    if (!selectedProject) {
      return {} as Record<string, string>;
    }
    return selectedProject.tasks.reduce<Record<string, string>>((accumulator, task) => {
      accumulator[task.id] = task.name;
      return accumulator;
    }, {});
  }, [selectedProject]);

  const templateIdOptions = useMemo(() => {
    const identifiers = new Set<string>();
    templates.forEach((template) => identifiers.add(template.template_id));
    if (selectedProject) {
      identifiers.add(selectedProject.project_type);
    }
    return Array.from(identifiers).sort();
  }, [templates, selectedProject]);

  const taskEditMap = useMemo(() => {
    return taskEdits.reduce<Record<string, ProjectTaskEditState>>((accumulator, task) => {
      accumulator[task.id] = task;
      return accumulator;
    }, {});
  }, [taskEdits]);

  const handleProjectClick = async (projectId: string) => {
    const existing = projects.find((project) => project.id === projectId) ?? null;
    setSelectedProjectId(projectId);
    setSelectedProject(existing);
    setProjectError(null);
    setProjectMessage(null);
    setProjectLoading(true);
    try {
      const detail = await api.project(projectId);
      setSelectedProject(detail);
      setProjects((prev) => prev.map((project) => (project.id === detail.id ? detail : project)));
    } catch (error) {
      console.error(error);
      setProjectError("Unable to load project details.");
    } finally {
      setProjectLoading(false);
    }
  };

  const handleProjectFieldChange = <K extends keyof ProjectFormState>(field: K, value: ProjectFormState[K]) => {
    setProjectForm((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const handleTaskEditChange = <K extends keyof ProjectTaskEditState>(
    taskId: string,
    field: K,
    value: ProjectTaskEditState[K]
  ) => {
    setTaskEdits((prev) => prev.map((task) => (task.id === taskId ? { ...task, [field]: value } : task)));
  };

  const handleTemplateFieldChange = <K extends keyof TemplateFormState>(
    field: K,
    value: TemplateFormState[K]
  ) => {
    setTemplateForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleTemplateTaskChange = <K extends keyof TemplateTaskRow>(
    index: number,
    field: K,
    value: TemplateTaskRow[K]
  ) => {
    setTemplateForm((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task, taskIndex) => (taskIndex === index ? { ...task, [field]: value } : task))
    }));
  };

  const handleTemplateMilestoneChange = <K extends keyof TemplateMilestoneRow>(
    index: number,
    field: K,
    value: TemplateMilestoneRow[K]
  ) => {
    setTemplateForm((prev) => ({
      ...prev,
      milestones: prev.milestones.map((milestone, milestoneIndex) =>
        milestoneIndex === index ? { ...milestone, [field]: value } : milestone
      )
    }));
  };

  const addTemplateTask = () => {
    setTemplateForm((prev) => ({ ...prev, tasks: [...prev.tasks, createTemplateTaskRow()] }));
  };

  const removeTemplateTask = (index: number) => {
    setTemplateForm((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((_, taskIndex) => taskIndex !== index)
    }));
  };

  const addTemplateMilestone = () => {
    setTemplateForm((prev) => ({ ...prev, milestones: [...prev.milestones, createTemplateMilestoneRow()] }));
  };

  const removeTemplateMilestone = (index: number) => {
    setTemplateForm((prev) => ({
      ...prev,
      milestones: prev.milestones.filter((_, milestoneIndex) => milestoneIndex !== index)
    }));
  };

  const handleProjectSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedProject || !projectForm) {
      return;
    }
    setSavingProject(true);
    setProjectError(null);
    setProjectMessage(null);

    try {
      const payload: ProjectUpdatePayload = {
        name: projectForm.name,
        manager_id: projectForm.manager_id,
        currency: projectForm.currency,
        tasks: taskEdits.map((task) => {
          const original = selectedProject.tasks.find((item) => item.id === task.id);
          const originalDueDate = isoToDateInput(original?.due_date);
          let dueDateValue: string | null | undefined;
          if (task.due_date) {
            dueDateValue = task.due_date !== originalDueDate ? new Date(task.due_date).toISOString() : undefined;
          } else if (originalDueDate) {
            dueDateValue = null;
          }

          return {
            id: task.id,
            status: task.status,
            type: task.type,
            leader_id: task.leader_id.trim() ? task.leader_id.trim() : undefined,
            due_date: dueDateValue
          };
        })
      };

      if (projectForm.start_date) {
        payload.start_date = new Date(projectForm.start_date).toISOString();
      }

      if (projectForm.budget) {
        const parsedBudget = Number(projectForm.budget);
        if (!Number.isNaN(parsedBudget)) {
          payload.budget = parsedBudget;
        }
      }

      if (projectForm.status !== selectedProject.status) {
        payload.status = projectForm.status;
      }

      if (projectForm.template_id && projectForm.template_id !== selectedProject.project_type) {
        payload.template_id = projectForm.template_id;
      }

      const updated = await api.updateProject(selectedProject.id, payload);
      setSelectedProject(updated);
      setProjects((prev) => prev.map((project) => (project.id === updated.id ? updated : project)));
      setProjectMessage("Project timeline updated successfully.");
    } catch (error) {
      console.error(error);
      setProjectError("Unable to save project changes.");
    } finally {
      setSavingProject(false);
    }
  };

  const handleTemplateSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTemplateError(null);
    setTemplateMessage(null);

    const trimmedId = templateForm.templateId.trim();
    const trimmedPrefix = templateForm.codePrefix.trim();
    if (!trimmedId || !trimmedPrefix) {
      setTemplateError("Template ID and code prefix are required.");
      return;
    }

    const tasksPayload = templateForm.tasks.map((task) => {
      const duration = Math.max(1, Number(task.durationDays) || 1);
      const estimated = task.estimatedHours.trim() ? Number(task.estimatedHours) : undefined;
      const cleanEstimated = estimated !== undefined && !Number.isNaN(estimated) ? estimated : undefined;
      const dependencies = task.dependsText
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
      return {
        name: task.name.trim(),
        duration_days: duration,
        depends_on: dependencies,
        status: task.status,
        type: task.type,
        estimated_hours: cleanEstimated,
        billable: task.billable,
        leader_id: task.leaderId.trim() ? task.leaderId.trim() : undefined
      };
    });

    if (tasksPayload.some((task) => !task.name)) {
      setTemplateError("Each task requires a name.");
      return;
    }

    const taskNames = new Set(tasksPayload.map((task) => task.name));
    const missingDependency = tasksPayload
      .map((task) => task.depends_on.find((dependency) => !taskNames.has(dependency)))
      .find((dependency) => dependency !== undefined);
    if (missingDependency) {
      setTemplateError(`Unknown dependency: ${missingDependency}`);
      return;
    }

    const milestonePayload = templateForm.milestones
      .filter((milestone) => milestone.title.trim())
      .map((milestone) => ({
        title: milestone.title.trim(),
        offset_days: Math.max(0, Number(milestone.offsetDays) || 0)
      }));

    const payload: ProjectTemplateCreateRequest = {
      template_id: trimmedId,
      code_prefix: trimmedPrefix,
      tasks: tasksPayload,
      milestones: milestonePayload,
      overwrite: templateForm.overwrite
    };

    setCreatingTemplate(true);
    try {
      await api.createProjectTemplate(payload);
      const updatedLibrary = await api.projectTemplates();
      setTemplates(updatedLibrary);
      setTemplateMessage("Template saved successfully.");
      setTemplateForm({
        templateId: "",
        codePrefix: "",
        overwrite: false,
        tasks: [createTemplateTaskRow()],
        milestones: []
      });
    } catch (error) {
      console.error(error);
      setTemplateError("Unable to save template. Please review task dependencies and try again.");
    } finally {
      setCreatingTemplate(false);
    }
  };

  return (
    <div className="grid" style={{ gap: "2rem" }}>
      <div className="grid" style={{ gap: "1.5rem" }}>
        <div className="card">
          <div className="flex" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <h3>Active Projects</h3>
            <span className="text-muted">Click a project to drill into agile details.</span>
          </div>
          <div className="table-scroll">
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
                  <tr
                    key={project.id}
                    className={`clickable-row${selectedProjectId === project.id ? " active" : ""}`}
                    onClick={() => handleProjectClick(project.id)}
                  >
                    <td>
                      <strong>{project.name}</strong>
                      <div className="text-muted" style={{ fontSize: "0.8rem" }}>
                        {project.code}
                      </div>
                    </td>
                    <td style={{ textTransform: "capitalize" }}>{project.project_type.replace("_", " ")}</td>
                    <td>
                      <span className={`badge ${project.status === "completed" ? "success" : project.status === "in_progress" ? "warning" : project.status === "planning" ? "" : "danger"}`}>
                        {formatLabel(project.status)}
                      </span>
                    </td>
                    <td>{project.budget ? formatCurrency(project.budget, project.currency) : "—"}</td>
                    <td>{formatDate(project.start_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {selectedProject && projectForm ? (
          <div className="card">
            <h3>{selectedProject.name}</h3>
            <p className="text-muted" style={{ marginTop: 0 }}>
              Automate sprint planning and keep your delivery board aligned with project health.
            </p>
            <div className="definition-list">
              <div>
                <dt>Project Code</dt>
                <dd>{selectedProject.code}</dd>
              </div>
              <div>
                <dt>Projected Wrap</dt>
                <dd>{formatDate(selectedProject.end_date ?? undefined)}</dd>
              </div>
              <div>
                <dt>Total Budget</dt>
                <dd>{formatCurrency(selectedProject.budget, selectedProject.currency)}</dd>
              </div>
            </div>

            {projectLoading ? <p className="text-muted">Refreshing project data…</p> : null}
            {projectMessage ? <div className="form-feedback success">{projectMessage}</div> : null}
            {projectError ? <div className="form-feedback error">{projectError}</div> : null}

            <form className="form" onSubmit={handleProjectSubmit}>
              <fieldset className="form-section">
                <legend>Project Overview</legend>
                <div className="form-grid">
                  <label>
                    Project Name
                    <input
                      value={projectForm.name}
                      onChange={(event) => handleProjectFieldChange("name", event.target.value)}
                    />
                  </label>
                  <label>
                    Engagement Lead
                    <input
                      value={projectForm.manager_id}
                      onChange={(event) => handleProjectFieldChange("manager_id", event.target.value)}
                    />
                  </label>
                  <label>
                    Start Date
                    <input
                      type="date"
                      value={projectForm.start_date}
                      onChange={(event) => handleProjectFieldChange("start_date", event.target.value)}
                    />
                  </label>
                  <label>
                    Budget
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={projectForm.budget}
                      onChange={(event) => handleProjectFieldChange("budget", event.target.value)}
                    />
                  </label>
                  <label>
                    Currency
                    <input
                      value={projectForm.currency}
                      onChange={(event) => handleProjectFieldChange("currency", event.target.value.toUpperCase())}
                    />
                  </label>
                  <label>
                    Status
                    <select
                      value={projectForm.status}
                      onChange={(event) =>
                        handleProjectFieldChange("status", normalizeProjectStatus(event.target.value))
                      }
                    >
                      {projectStatusOptions.map((status) => (
                        <option key={status} value={status}>
                          {formatLabel(status)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Template
                    <select
                      value={projectForm.template_id}
                      onChange={(event) => handleProjectFieldChange("template_id", event.target.value)}
                      disabled={templatesLoading && templates.length === 0}
                    >
                      {templateIdOptions.map((identifier) => (
                        <option key={identifier} value={identifier}>
                          {formatLabel(identifier)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </fieldset>

              <fieldset className="form-section">
                <legend>Agile Task Board</legend>
                <div className="table-scroll">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Task</th>
                        <th>Status</th>
                        <th>Type</th>
                        <th>Leader</th>
                        <th>Dependencies</th>
                        <th>Start</th>
                        <th>Due</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedProject.tasks.map((task) => {
                        const edit = taskEditMap[task.id];
                        const dependencyNames = task.dependencies
                          .map((dependencyId) => dependencyLookup[dependencyId])
                          .filter(Boolean);
                        return (
                          <tr key={task.id}>
                            <td>
                              <strong>{task.name}</strong>
                              {task.estimated_hours ? (
                                <div className="text-muted" style={{ fontSize: "0.8rem" }}>
                                  Est. {task.estimated_hours} hrs
                                </div>
                              ) : null}
                            </td>
                            <td>
                              <select
                                value={edit?.status ?? "todo"}
                                onChange={(event) =>
                                  handleTaskEditChange(task.id, "status", normalizeTaskStatus(event.target.value))
                                }
                              >
                                {taskStatusOptions.map((status) => (
                                  <option key={status} value={status}>
                                    {formatLabel(status)}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <select
                                value={edit?.type ?? "feature"}
                                onChange={(event) =>
                                  handleTaskEditChange(task.id, "type", normalizeTaskType(event.target.value))
                                }
                              >
                                {taskTypeOptions.map((type) => (
                                  <option key={type} value={type}>
                                    {formatLabel(type)}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <input
                                value={edit?.leader_id ?? ""}
                                onChange={(event) => handleTaskEditChange(task.id, "leader_id", event.target.value)}
                                placeholder="Owner ID"
                              />
                            </td>
                            <td style={{ maxWidth: "180px" }}>
                              {dependencyNames.length > 0 ? dependencyNames.join(", ") : "—"}
                            </td>
                            <td>{formatDate(task.start_date)}</td>
                            <td>
                              <input
                                type="date"
                                value={edit?.due_date ?? ""}
                                onChange={(event) => handleTaskEditChange(task.id, "due_date", event.target.value)}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </fieldset>

              <div className="form-actions">
                <button type="submit" className="button primary" disabled={savingProject}>
                  {savingProject ? "Saving…" : "Save Project"}
                </button>
              </div>
            </form>
          </div>
        ) : null}
      </div>

      <div className="card">
        <h3>New Project Template</h3>
        <p className="text-muted" style={{ marginTop: 0 }}>
          Generate reusable plans that auto-calc dates, task types, and delivery cadence for new client initiatives.
        </p>

        {templateMessage ? <div className="form-feedback success">{templateMessage}</div> : null}
        {templateError ? <div className="form-feedback error">{templateError}</div> : null}

        <form className="form" onSubmit={handleTemplateSubmit}>
          <fieldset className="form-section">
            <legend>Template Details</legend>
            <div className="form-grid">
              <label>
                Template ID
                <input
                  value={templateForm.templateId}
                  onChange={(event) => handleTemplateFieldChange("templateId", event.target.value)}
                  placeholder="e.g. launch_playbook"
                />
              </label>
              <label>
                Code Prefix
                <input
                  value={templateForm.codePrefix}
                  onChange={(event) => handleTemplateFieldChange("codePrefix", event.target.value.toUpperCase())}
                  placeholder="e.g. LCH"
                />
              </label>
              <label style={{ alignSelf: "flex-end" }}>
                <span>Allow Overwrite</span>
                <input
                  type="checkbox"
                  checked={templateForm.overwrite}
                  onChange={(event) => handleTemplateFieldChange("overwrite", event.target.checked)}
                  style={{ width: "auto" }}
                />
              </label>
            </div>
          </fieldset>

          <fieldset className="form-section">
            <legend>Task Blueprint</legend>
            <div className="grid" style={{ gap: "1rem" }}>
              {templateForm.tasks.map((task, index) => (
                <div key={`task-${index}`} className="form-grid">
                  <label>
                    Task Name
                    <input
                      value={task.name}
                      onChange={(event) => handleTemplateTaskChange(index, "name", event.target.value)}
                    />
                  </label>
                  <label>
                    Duration (days)
                    <input
                      type="number"
                      min="1"
                      value={task.durationDays}
                      onChange={(event) => handleTemplateTaskChange(index, "durationDays", event.target.value)}
                    />
                  </label>
                  <label>
                    Status
                    <select
                      value={task.status}
                      onChange={(event) => handleTemplateTaskChange(index, "status", normalizeTaskStatus(event.target.value))}
                    >
                      {taskStatusOptions.map((status) => (
                        <option key={status} value={status}>
                          {formatLabel(status)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Type
                    <select
                      value={task.type}
                      onChange={(event) => handleTemplateTaskChange(index, "type", normalizeTaskType(event.target.value))}
                    >
                      {taskTypeOptions.map((type) => (
                        <option key={type} value={type}>
                          {formatLabel(type)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Depends On
                    <input
                      value={task.dependsText}
                      onChange={(event) => handleTemplateTaskChange(index, "dependsText", event.target.value)}
                      placeholder="Comma-separated tasks"
                    />
                  </label>
                  <label>
                    Estimated Hours
                    <input
                      type="number"
                      min="0"
                      value={task.estimatedHours}
                      onChange={(event) => handleTemplateTaskChange(index, "estimatedHours", event.target.value)}
                    />
                  </label>
                  <label>
                    Billable
                    <input
                      type="checkbox"
                      checked={task.billable}
                      onChange={(event) => handleTemplateTaskChange(index, "billable", event.target.checked)}
                      style={{ width: "auto" }}
                    />
                  </label>
                  <label>
                    Default Leader
                    <input
                      value={task.leaderId}
                      onChange={(event) => handleTemplateTaskChange(index, "leaderId", event.target.value)}
                      placeholder="Optional owner id"
                    />
                  </label>
                  {templateForm.tasks.length > 1 ? (
                    <div className="form-actions" style={{ justifyContent: "flex-start" }}>
                      <button
                        type="button"
                        className="button ghost"
                        onClick={() => removeTemplateTask(index)}
                      >
                        Remove Task
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
              <button type="button" className="button ghost" onClick={addTemplateTask}>
                Add Task
              </button>
            </div>
          </fieldset>

          <fieldset className="form-section">
            <legend>Milestones</legend>
            <div className="grid" style={{ gap: "1rem" }}>
              {templateForm.milestones.map((milestone, index) => (
                <div key={`milestone-${index}`} className="form-grid">
                  <label>
                    Title
                    <input
                      value={milestone.title}
                      onChange={(event) => handleTemplateMilestoneChange(index, "title", event.target.value)}
                    />
                  </label>
                  <label>
                    Offset (days)
                    <input
                      type="number"
                      min="0"
                      value={milestone.offsetDays}
                      onChange={(event) => handleTemplateMilestoneChange(index, "offsetDays", event.target.value)}
                    />
                  </label>
                  <div className="form-actions" style={{ justifyContent: "flex-start" }}>
                    <button
                      type="button"
                      className="button ghost"
                      onClick={() => removeTemplateMilestone(index)}
                    >
                      Remove Milestone
                    </button>
                  </div>
                </div>
              ))}
              <button type="button" className="button ghost" onClick={addTemplateMilestone}>
                Add Milestone
              </button>
            </div>
          </fieldset>

          <div className="form-actions">
            <button type="submit" className="button primary" disabled={creatingTemplate}>
              {creatingTemplate ? "Saving Template…" : "Save Template"}
            </button>
          </div>
        </form>

        <div className="form-section">
          <legend>Template Library</legend>
          {templatesLoading ? (
            <p className="text-muted">Loading template catalog…</p>
          ) : templates.length === 0 ? (
            <p className="text-muted">No templates saved yet. Use the form above to add your first reusable plan.</p>
          ) : (
            <ul className="stack">
              {templates.map((template) => (
                <li key={template.template_id} className="metric">
                  <span>{template.template_id.toUpperCase()}</span>
                  <strong>
                    {template.tasks.length} tasks · {template.milestones.length} milestones
                  </strong>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
