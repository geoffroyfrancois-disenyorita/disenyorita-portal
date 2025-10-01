"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Project,
  ProjectStatus,
  ProjectTemplateCreateRequest,
  ProjectTemplateDefinition,
  ProjectUpdatePayload,
  Sprint,
  Task,
  TaskPriority,
  TaskStatus,
  TaskType,
  api
} from "../../lib/api";

const taskStatusOptions: TaskStatus[] = ["todo", "in_progress", "review", "done"];
const taskTypeOptions: TaskType[] = ["feature", "bug", "chore", "research", "qa"];
const taskPriorityOptions: TaskPriority[] = ["low", "medium", "high", "critical"];
const projectStatusOptions: ProjectStatus[] = ["planning", "in_progress", "on_hold", "completed", "cancelled"];
const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

type TimelineView = "gantt" | "calendar";

function taskStoryPoints(task: Task): number {
  if (typeof task.story_points === "number") {
    return Math.max(task.story_points, 0);
  }
  if (typeof task.estimated_hours === "number") {
    const computed = Math.round((task.estimated_hours / 4) * 10) / 10;
    return computed > 0 ? computed : 1;
  }
  return 1;
}

function formatSprintRange(sprint: Sprint): string {
  const start = new Date(sprint.start_date).toLocaleDateString();
  const end = new Date(sprint.end_date).toLocaleDateString();
  return `${start} → ${end}`;
}

function parseIsoDate(value?: string | null): Date | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function startOfMonth(date: Date): Date {
  const next = new Date(date.getTime());
  next.setDate(1);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, amount: number): Date {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + amount);
  return next;
}

function addMonths(date: Date, amount: number): Date {
  const next = new Date(date.getTime());
  next.setMonth(next.getMonth() + amount);
  return next;
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getInitialCalendarMonth(project?: Project | null): Date {
  const today = new Date();
  if (!project) {
    return today;
  }
  const candidates: Date[] = [];
  const projectStart = parseIsoDate(project.start_date);
  if (projectStart) {
    candidates.push(projectStart);
  }
  const projectEnd = parseIsoDate(project.end_date ?? undefined);
  if (projectEnd) {
    candidates.push(projectEnd);
  }
  project.tasks.forEach((task) => {
    const start = parseIsoDate(task.start_date);
    const due = parseIsoDate(task.due_date);
    if (start) {
      candidates.push(start);
    }
    if (due) {
      candidates.push(due);
    }
  });
  if (candidates.length === 0) {
    return today;
  }
  candidates.sort((a, b) => a.getTime() - b.getTime());
  return candidates[0];
}

interface TimelineTaskInfo {
  task: Task;
  startDate: Date | null;
  endDate: Date | null;
  dueDate: Date | null;
  dueDateKey: string | null;
}

interface CalendarDayCell {
  date: Date;
  inCurrentMonth: boolean;
  tasks: TimelineTaskInfo[];
}

interface AgileSummary {
  totalPoints: number;
  completedPoints: number;
  remainingPoints: number;
  velocity: number | null;
  forecastDate: Date | null;
  activeSprint?: {
    sprint: Sprint;
    committed: number;
    completed: number;
  } | null;
  backlogByStatus: Record<string, number>;
  backlogByPriority: Record<string, number>;
  unscheduled: number;
  upcomingSprints: Sprint[];
}

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
  priority: TaskPriority;
  story_points: string;
  sprint_id: string;
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
  priority: TaskPriority;
  storyPoints: string;
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

type TaskUpdateInput = ProjectUpdatePayload["tasks"] extends (infer R)[] ? R : never;

function normalizeTaskStatus(value: string): TaskStatus {
  return taskStatusOptions.includes(value as TaskStatus) ? (value as TaskStatus) : "todo";
}

function normalizeTaskType(value: string): TaskType {
  return taskTypeOptions.includes(value as TaskType) ? (value as TaskType) : "feature";
}

function normalizeProjectStatus(value: string): ProjectStatus {
  return projectStatusOptions.includes(value as ProjectStatus) ? (value as ProjectStatus) : "planning";
}

function normalizeTaskPriority(value: string): TaskPriority {
  return taskPriorityOptions.includes(value as TaskPriority) ? (value as TaskPriority) : "medium";
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
    due_date: isoToDateInput(task.due_date),
    priority: task.priority,
    story_points: task.story_points !== undefined && task.story_points !== null ? String(task.story_points) : "",
    sprint_id: task.sprint_id ?? ""
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
    leaderId: "",
    priority: "medium",
    storyPoints: ""
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
  const [timelineView, setTimelineView] = useState<TimelineView>("gantt");
  const [calendarMonth, setCalendarMonth] = useState<Date>(() =>
    startOfMonth(getInitialCalendarMonth(initialProjects[0] ?? null))
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

  useEffect(() => {
    setCalendarMonth(startOfMonth(getInitialCalendarMonth(selectedProject)));
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

  const sortedSprints = useMemo(() => {
    if (!selectedProject) {
      return [] as Sprint[];
    }
    return [...selectedProject.sprints].sort(
      (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
    );
  }, [selectedProject]);

  const sprintLookup = useMemo(() => {
    return sortedSprints.reduce<Record<string, Sprint>>((accumulator, sprint) => {
      accumulator[sprint.id] = sprint;
      return accumulator;
    }, {});
  }, [sortedSprints]);

  const agileSummary = useMemo<AgileSummary | null>(() => {
    if (!selectedProject) {
      return null;
    }
    const statusBaseline = taskStatusOptions.reduce<Record<string, number>>((accumulator, status) => {
      accumulator[status] = 0;
      return accumulator;
    }, {} as Record<string, number>);
    const priorityBaseline = taskPriorityOptions.reduce<Record<string, number>>(
      (accumulator, priority) => {
        accumulator[priority] = 0;
        return accumulator;
      },
      {} as Record<string, number>
    );

    const backlogByStatus: Record<string, number> = { ...statusBaseline };
    const backlogByPriority: Record<string, number> = { ...priorityBaseline };
    let totalPoints = 0;
    let completedPoints = 0;
    let unscheduled = 0;

    selectedProject.tasks.forEach((task) => {
      const points = taskStoryPoints(task);
      totalPoints += points;
      if (normalizeTaskStatus(task.status) === "done") {
        completedPoints += points;
      }
      const statusKey = normalizeTaskStatus(task.status);
      backlogByStatus[statusKey] = (backlogByStatus[statusKey] ?? 0) + 1;
      const priorityKey = normalizeTaskPriority(task.priority);
      backlogByPriority[priorityKey] = (backlogByPriority[priorityKey] ?? 0) + 1;
      if (!task.sprint_id) {
        unscheduled += 1;
      }
    });

    const activeSprint = selectedProject.active_sprint_id
      ? sortedSprints.find((sprint) => sprint.id === selectedProject.active_sprint_id)
      : sortedSprints.find((sprint) => sprint.status === "active");

    let activeSprintDetails: AgileSummary["activeSprint"] = null;
    if (activeSprint) {
      const sprintTasks = selectedProject.tasks.filter((task) => task.sprint_id === activeSprint.id);
      const committed = sprintTasks.reduce((sum, task) => sum + taskStoryPoints(task), 0);
      const completed = sprintTasks
        .filter((task) => normalizeTaskStatus(task.status) === "done")
        .reduce((sum, task) => sum + taskStoryPoints(task), 0);
      activeSprintDetails = { sprint: activeSprint, committed, completed };
    }

    const completedSprints = sortedSprints.filter(
      (sprint) => sprint.status === "completed" && sprint.completed_points > 0
    );
    const velocity = completedSprints.length
      ? completedSprints.reduce((sum, sprint) => sum + sprint.completed_points, 0) /
        completedSprints.length
      : null;

    const remainingPoints = Math.max(totalPoints - completedPoints, 0);
    let forecastDate: Date | null = null;
    if (velocity && velocity > 0 && completedSprints.length > 0) {
      const averageDurationMs =
        completedSprints.reduce((sum, sprint) => {
          const duration =
            new Date(sprint.end_date).getTime() - new Date(sprint.start_date).getTime();
          const minimum = DAY_IN_MS * 7;
          return sum + Math.max(duration, minimum);
        }, 0) / completedSprints.length;
      const baseline = activeSprint
        ? new Date(activeSprint.end_date)
        : selectedProject.end_date
        ? new Date(selectedProject.end_date)
        : new Date(selectedProject.start_date);
      const projectedMs = averageDurationMs * (remainingPoints / velocity);
      forecastDate = new Date(baseline.getTime() + projectedMs);
    }

    const upcomingSprints = sortedSprints.filter((sprint) => {
      if (sprint.status === "cancelled" || sprint.status === "completed") {
        return false;
      }
      if (activeSprint && sprint.id === activeSprint.id) {
        return false;
      }
      return true;
    });

    return {
      totalPoints,
      completedPoints,
      remainingPoints,
      velocity,
      forecastDate,
      activeSprint: activeSprintDetails,
      backlogByStatus,
      backlogByPriority,
      unscheduled,
      upcomingSprints
    };
  }, [selectedProject, sortedSprints]);

  const activeSprintDetails = agileSummary?.activeSprint ?? null;
  const sprintProgress = activeSprintDetails && activeSprintDetails.committed > 0
    ? Math.min(
        100,
        Math.round((activeSprintDetails.completed / activeSprintDetails.committed) * 100)
      )
    : 0;
  const velocityLabel = agileSummary?.velocity
    ? `${agileSummary.velocity.toFixed(1)} pts / sprint`
    : "Not enough data";
  const forecastLabel = agileSummary?.forecastDate
    ? agileSummary.forecastDate.toLocaleDateString()
    : "Not enough data";
  const backlogStatusEntries = agileSummary
    ? taskStatusOptions.map((status) => ({
        status,
        count: agileSummary.backlogByStatus[status] ?? 0
      }))
    : [];
  const backlogPriorityEntries = agileSummary
    ? taskPriorityOptions.map((priority) => ({
        priority,
        count: agileSummary.backlogByPriority[priority] ?? 0
      }))
    : [];

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

  const timelineTasks = useMemo<TimelineTaskInfo[]>(() => {
    if (!selectedProject) {
      return [];
    }
    const projectStartDate = parseIsoDate(selectedProject.start_date);
    return selectedProject.tasks.map((task) => {
      const edit = taskEditMap[task.id];
      const dueDateString = edit?.due_date ? edit.due_date : task.due_date ?? null;
      const dueDate = parseIsoDate(dueDateString);
      const rawStart = parseIsoDate(task.start_date) ?? dueDate ?? projectStartDate;
      let computedEnd = dueDate ?? rawStart;
      if (rawStart && computedEnd && computedEnd.getTime() < rawStart.getTime()) {
        computedEnd = rawStart;
      }
      return {
        task,
        startDate: rawStart ?? null,
        endDate: computedEnd ?? null,
        dueDate,
        dueDateKey: dueDate ? toDateKey(dueDate) : null
      };
    });
  }, [selectedProject, taskEditMap]);

  const ganttTimeline = useMemo(() => {
    const tasksWithDates = timelineTasks
      .filter((item) => item.startDate)
      .map((item) => {
        const start = item.startDate as Date;
        const endCandidate = item.endDate ?? start;
        const end = endCandidate.getTime() < start.getTime() ? start : endCandidate;
        return {
          ...item,
          start,
          end
        };
      });

    if (tasksWithDates.length === 0) {
      return null;
    }

    const rangeStart = tasksWithDates.reduce((min, item) => (item.start < min ? item.start : min), tasksWithDates[0].start);
    const rangeEnd = tasksWithDates.reduce((max, item) => (item.end > max ? item.end : max), tasksWithDates[0].end);
    const totalMsRaw = rangeEnd.getTime() - rangeStart.getTime();
    const totalMs = totalMsRaw <= 0 ? DAY_IN_MS : totalMsRaw;

    const tasks = tasksWithDates.map((item) => {
      const offsetMs = Math.max(0, item.start.getTime() - rangeStart.getTime());
      const durationMsRaw = item.end.getTime() - item.start.getTime();
      const durationMs = durationMsRaw <= 0 ? DAY_IN_MS : durationMsRaw;
      const offsetPercent = totalMsRaw <= 0 ? 0 : (offsetMs / totalMs) * 100;
      const widthPercentRaw = (durationMs / totalMs) * 100;
      const widthPercent = Math.min(100 - offsetPercent, Math.max(2, widthPercentRaw));
      return {
        ...item,
        offsetPercent,
        widthPercent
      };
    });

    return {
      start: rangeStart,
      end: rangeEnd,
      tasks
    };
  }, [timelineTasks]);

  const calendarDays = useMemo<CalendarDayCell[]>(() => {
    const monthStart = startOfMonth(calendarMonth);
    const currentMonth = monthStart.getMonth();
    const currentYear = monthStart.getFullYear();
    const gridStart = addDays(monthStart, -monthStart.getDay());
    const days: CalendarDayCell[] = [];

    for (let index = 0; index < 42; index += 1) {
      const date = addDays(gridStart, index);
      date.setHours(0, 0, 0, 0);
      const inCurrentMonth = date.getMonth() === currentMonth && date.getFullYear() === currentYear;
      const key = toDateKey(date);
      const tasks = timelineTasks.filter((item) => item.dueDateKey === key);
      days.push({
        date,
        inCurrentMonth,
        tasks
      });
    }

    return days;
  }, [calendarMonth, timelineTasks]);

  const handleCalendarPrevious = () => {
    setCalendarMonth((prev) => startOfMonth(addMonths(prev, -1)));
  };

  const handleCalendarNext = () => {
    setCalendarMonth((prev) => startOfMonth(addMonths(prev, 1)));
  };

  const calendarMonthLabel = calendarMonth.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric"
  });

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

          const update: TaskUpdateInput = {
            id: task.id,
            status: task.status,
            type: task.type,
            leader_id: task.leader_id.trim() ? task.leader_id.trim() : undefined
          };

          if (dueDateValue !== undefined) {
            update.due_date = dueDateValue;
          }

          if (original && task.priority !== original.priority) {
            update.priority = task.priority;
          }

          const trimmedPoints = task.story_points.trim();
          const originalPoints = original?.story_points ?? null;
          if (trimmedPoints) {
            const parsedPoints = Number(trimmedPoints);
            if (!Number.isNaN(parsedPoints) && parsedPoints !== originalPoints) {
              update.story_points = parsedPoints;
            }
          } else if (originalPoints !== null && originalPoints !== undefined) {
            update.story_points = null;
          }

          const trimmedSprint = task.sprint_id.trim();
          const originalSprint = original?.sprint_id ?? "";
          if (trimmedSprint !== originalSprint) {
            update.sprint_id = trimmedSprint ? trimmedSprint : null;
          }

          return update;
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
      const storyPointsValue = task.storyPoints.trim() ? Number(task.storyPoints) : undefined;
      const cleanStoryPoints =
        storyPointsValue !== undefined && !Number.isNaN(storyPointsValue) ? storyPointsValue : undefined;
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
        leader_id: task.leaderId.trim() ? task.leaderId.trim() : undefined,
        story_points: cleanStoryPoints,
        priority: task.priority
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

            {agileSummary ? (
              <div
                style={{
                  display: "grid",
                  gap: "1rem",
                  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                  margin: "1.5rem 0"
                }}
              >
                <div
                  style={{
                    border: "1px solid #f1d9cc",
                    borderRadius: "0.75rem",
                    padding: "1rem",
                    background: "#fdf4ec"
                  }}
                >
                  <h4 style={{ margin: "0 0 0.5rem 0" }}>Active sprint</h4>
                  {activeSprintDetails ? (
                    <>
                      <div style={{ fontWeight: 600 }}>{activeSprintDetails.sprint.name}</div>
                      <p className="text-muted" style={{ margin: "0.25rem 0" }}>
                        {formatSprintRange(activeSprintDetails.sprint)}
                      </p>
                      <div style={{ margin: "0.5rem 0" }}>
                        <div style={{ fontSize: "0.9rem", fontWeight: 600 }}>{sprintProgress}% complete</div>
                        <div
                          style={{
                            height: "8px",
                            background: "#f1d9cc",
                            borderRadius: "999px",
                            overflow: "hidden",
                            marginTop: "0.35rem"
                          }}
                        >
                          <div
                            style={{
                              width: `${sprintProgress}%`,
                              background: "#8b3921",
                              height: "100%"
                            }}
                          />
                        </div>
                        <p className="text-muted" style={{ margin: "0.35rem 0 0 0" }}>
                          {activeSprintDetails.completed.toFixed(1)} / {activeSprintDetails.committed.toFixed(1)} pts
                        </p>
                      </div>
                      {activeSprintDetails.sprint.focus_areas.length ? (
                        <p className="text-muted" style={{ margin: 0, fontSize: "0.85rem" }}>
                          Focus: {activeSprintDetails.sprint.focus_areas.join(", ")}
                        </p>
                      ) : null}
                      {agileSummary.upcomingSprints.length ? (
                        <div style={{ marginTop: "0.75rem" }}>
                          <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>Upcoming</span>
                          <ul className="plain-list" style={{ margin: "0.25rem 0 0 0" }}>
                            {agileSummary.upcomingSprints.slice(0, 2).map((sprint) => (
                              <li key={sprint.id}>
                                <strong>{sprint.name}</strong>
                                <div className="text-muted" style={{ fontSize: "0.75rem" }}>
                                  {formatSprintRange(sprint)}
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-muted" style={{ margin: 0 }}>
                      No active sprint scheduled.
                    </p>
                  )}
                </div>
                <div
                  style={{
                    border: "1px solid #f1d9cc",
                    borderRadius: "0.75rem",
                    padding: "1rem",
                    background: "#fdf4ec"
                  }}
                >
                  <h4 style={{ margin: "0 0 0.5rem 0" }}>Agile delivery metrics</h4>
                  <div className="definition-list" style={{ marginBottom: "0.75rem" }}>
                    <div>
                      <dt>Total story points</dt>
                      <dd>{agileSummary.totalPoints.toFixed(1)}</dd>
                    </div>
                    <div>
                      <dt>Completed</dt>
                      <dd>{agileSummary.completedPoints.toFixed(1)}</dd>
                    </div>
                    <div>
                      <dt>Remaining</dt>
                      <dd>{agileSummary.remainingPoints.toFixed(1)}</dd>
                    </div>
                    <div>
                      <dt>Velocity</dt>
                      <dd>{velocityLabel}</dd>
                    </div>
                    <div>
                      <dt>Forecast completion</dt>
                      <dd>{forecastLabel}</dd>
                    </div>
                  </div>
                  <div style={{ display: "grid", gap: "0.75rem" }}>
                    <div>
                      <h5 style={{ margin: "0 0 0.35rem 0", fontSize: "0.9rem" }}>Backlog by status</h5>
                      <ul className="plain-list" style={{ margin: 0 }}>
                        {backlogStatusEntries.map(({ status, count }) => (
                          <li key={status} style={{ display: "flex", justifyContent: "space-between" }}>
                            <span>{formatLabel(status)}</span>
                            <span>{count}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h5 style={{ margin: "0 0 0.35rem 0", fontSize: "0.9rem" }}>Backlog by priority</h5>
                      <ul className="plain-list" style={{ margin: 0 }}>
                        {backlogPriorityEntries.map(({ priority, count }) => (
                          <li key={priority} style={{ display: "flex", justifyContent: "space-between" }}>
                            <span>{formatLabel(priority)}</span>
                            <span>{count}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h5 style={{ margin: "0 0 0.35rem 0", fontSize: "0.9rem" }}>Unscheduled backlog</h5>
                      <p style={{ margin: 0 }}>
                        {agileSummary.unscheduled} task{agileSummary.unscheduled === 1 ? "" : "s"} without a sprint
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

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
                <div className="timeline-toolbar">
                  <span className="text-muted" style={{ fontSize: "0.9rem" }}>
                    Update task assignments below and choose your preferred timeline view.
                  </span>
                  <div className="timeline-toggle">
                    <button
                      type="button"
                      className={`button ghost${timelineView === "gantt" ? " active" : ""}`}
                      onClick={() => setTimelineView("gantt")}
                    >
                      Gantt view
                    </button>
                    <button
                      type="button"
                      className={`button ghost${timelineView === "calendar" ? " active" : ""}`}
                      onClick={() => setTimelineView("calendar")}
                    >
                      Calendar view
                    </button>
                  </div>
                </div>
                <div className="table-scroll">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Task</th>
                        <th>Status</th>
                        <th>Type</th>
                        <th>Priority</th>
                        <th>Story Points</th>
                        <th>Sprint</th>
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
                        const sprintInfo = task.sprint_id ? sprintLookup[task.sprint_id] : undefined;
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
                              <select
                                value={edit?.priority ?? "medium"}
                                onChange={(event) =>
                                  handleTaskEditChange(
                                    task.id,
                                    "priority",
                                    normalizeTaskPriority(event.target.value)
                                  )
                                }
                              >
                                {taskPriorityOptions.map((priority) => (
                                  <option key={priority} value={priority}>
                                    {formatLabel(priority)}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                step="0.5"
                                value={edit?.story_points ?? ""}
                                onChange={(event) =>
                                  handleTaskEditChange(task.id, "story_points", event.target.value)
                                }
                                placeholder="e.g. 5"
                              />
                            </td>
                            <td>
                              <select
                                value={edit?.sprint_id ?? ""}
                                onChange={(event) =>
                                  handleTaskEditChange(task.id, "sprint_id", event.target.value)
                                }
                              >
                                <option value="">Backlog</option>
                                {sortedSprints.map((sprint) => (
                                  <option key={sprint.id} value={sprint.id}>
                                    {sprint.name}
                                  </option>
                                ))}
                              </select>
                              {sprintInfo ? (
                                <div className="text-muted" style={{ fontSize: "0.75rem" }}>
                                  {formatSprintRange(sprintInfo)}
                                </div>
                              ) : null}
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
                <div className="timeline-visual">
                  {timelineView === "gantt" ? (
                    ganttTimeline && ganttTimeline.tasks.length > 0 ? (
                      <div className="gantt-wrapper">
                        <div className="gantt-range">
                          {formatDate(ganttTimeline.start.toISOString())} – {formatDate(ganttTimeline.end.toISOString())}
                        </div>
                        <div className="gantt-rows">
                          {ganttTimeline.tasks.map((item) => (
                            <div key={item.task.id} className="gantt-row">
                              <div>
                                <strong>{item.task.name}</strong>
                                <div className="text-muted" style={{ fontSize: "0.8rem" }}>
                                  {formatDate(item.start.toISOString())} – {formatDate(item.end.toISOString())}
                                </div>
                              </div>
                              <div className="gantt-track">
                                <div
                                  className="gantt-bar"
                                  style={{ left: `${item.offsetPercent}%`, width: `${item.widthPercent}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-muted" style={{ margin: "0.5rem 0" }}>
                        Add start and due dates to tasks to generate a Gantt chart timeline.
                      </p>
                    )
                  ) : (
                    <div className="calendar-wrapper">
                      <div className="calendar-header">
                        <button type="button" className="button ghost" onClick={handleCalendarPrevious}>
                          ← Prev
                        </button>
                        <div className="calendar-header-title">{calendarMonthLabel}</div>
                        <button type="button" className="button ghost" onClick={handleCalendarNext}>
                          Next →
                        </button>
                      </div>
                      <div className="calendar-grid calendar-grid--labels">
                        {dayNames.map((day) => (
                          <div key={day} className="calendar-label">
                            {day}
                          </div>
                        ))}
                      </div>
                      <div className="calendar-grid">
                        {calendarDays.map((day) => (
                          <div
                            key={toDateKey(day.date)}
                            className={`calendar-day${day.inCurrentMonth ? "" : " muted"}`}
                          >
                            <span className="calendar-date">{day.date.getDate()}</span>
                            {day.tasks.length === 0 ? (
                              <span className="text-muted" style={{ fontSize: "0.75rem" }}>
                                No due tasks
                              </span>
                            ) : (
                              <ul className="stack">
                                {day.tasks.map((item) => (
                                  <li
                                    key={item.task.id}
                                    className={`calendar-task status-${item.task.status}`}
                                  >
                                    {item.task.name}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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
                    Priority
                    <select
                      value={task.priority}
                      onChange={(event) =>
                        handleTemplateTaskChange(index, "priority", normalizeTaskPriority(event.target.value))
                      }
                    >
                      {taskPriorityOptions.map((priority) => (
                        <option key={priority} value={priority}>
                          {formatLabel(priority)}
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
                    Story Points
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={task.storyPoints}
                      onChange={(event) => handleTemplateTaskChange(index, "storyPoints", event.target.value)}
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
