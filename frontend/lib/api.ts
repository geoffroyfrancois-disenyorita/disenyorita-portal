export type ApiOptions = RequestInit & { revalidate?: number };

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000/api/v1";

async function request<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { revalidate, ...fetchOptions } = options;
  const response = await fetch(`${API_BASE}${path}`, {
    ...fetchOptions,
    headers: {
      "Content-Type": "application/json",
      ...(fetchOptions.headers ?? {})
    },
    cache: revalidate ? "force-cache" : "no-store"
  });

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export const api = {
  dashboard: () => request<DashboardSnapshot>("/dashboard"),
  operations: () => request<OperationsSnapshot>("/dashboard/operations"),
  automationDigest: () => request<AutomationDigest>("/automation/digest"),
  automationHistory: () => request<AutomationDigest[]>("/automation/digest/history"),
  projects: () => request<Project[]>("/projects"),
  project: (projectId: string) => request<Project>(`/projects/${projectId}`),
  updateProject: (projectId: string, payload: ProjectUpdatePayload) =>
    request<Project>(`/projects/${projectId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  projectTemplates: () => request<ProjectTemplateDefinition[]>("/project-templates"),
  createProjectTemplate: (payload: ProjectTemplateCreateRequest) =>
    request<ProjectTemplateCreateResponse>("/project-templates", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  clients: () => request<Client[]>("/clients"),
  client: (clientId: string) => request<Client>(`/clients/${clientId}`),
  clientDashboard: (clientId: string) => request<ClientDashboard>(`/clients/${clientId}/dashboard`),
  createClient: (payload: ClientCreateRequest) =>
    request<ClientWithProjects>("/clients", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  invoices: () => request<Invoice[]>("/financials/invoices"),
  financialOverview: () => request<MacroFinancials>("/financials/overview"),
  projectFinancials: () => request<ProjectFinancials[]>("/financials/projects"),
  pricingSuggestions: () => request<PricingSuggestion[]>("/financials/pricing/suggestions"),
  taxProfile: () => request<TaxProfile>("/financials/tax/profile"),
  computeTax: (payload: TaxComputationPayload) =>
    request<TaxComputationResult>("/financials/tax/compute", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  supportTickets: () => request<Ticket[]>("/support/tickets"),
  employees: () => request<Employee[]>("/hr/employees"),
  hrTimeOff: () => request<TimeOffRequest[]>("/hr/time-off"),
  campaigns: () => request<Campaign[]>("/marketing/campaigns"),
  siteStatuses: () => request<SiteStatus[]>("/monitoring/sites")
};

export interface DashboardSnapshot {
  projects: {
    total_projects: number;
    by_status: Record<string, number>;
    billable_hours: number;
    overdue_tasks: number;
  };
  clients: {
    total_clients: number;
    by_segment: Record<string, number>;
    active_portal_users: number;
  };
  financials: {
    mrr: number;
    outstanding_invoices: number;
    overdue_invoices: number;
    expenses_this_month: number;
  };
  support: {
    open_tickets: number;
    breached_slas: number;
    response_time_minutes: number;
  };
  marketing: {
    active_campaigns: number;
    scheduled_posts: number;
    avg_engagement_rate: number;
  };
  monitoring: {
    monitored_sites: number;
    incidents_today: number;
    avg_response_time_ms: number;
    failing_checks: number;
  };
}

export interface CashRunway {
  total_cash_on_hand: number;
  monthly_burn_rate: number;
  runway_days: number | null;
  outstanding_invoices: number;
  upcoming_payables: number;
  collection_rate: number;
}

export interface OperationsProject {
  project_id: string;
  project_name: string;
  client_name?: string | null;
  health: string;
  progress: number;
  late_tasks: number;
  next_milestone_title?: string | null;
  next_milestone_due?: string | null;
  active_sprint_name?: string | null;
  sprint_committed_points?: number | null;
  sprint_completed_points?: number | null;
  velocity?: number | null;
}

export interface CapacityAlert {
  employee_id: string;
  employee_name: string;
  available_hours: number;
  billable_ratio: number;
  reason: string;
}

export interface TimeOffWindow {
  employee_id: string;
  employee_name: string;
  start_date: string;
  end_date: string;
  status: string;
}

export interface MonitoringIncident {
  site_id: string;
  site_label: string;
  severity: string;
  triggered_at: string;
  message: string;
  acknowledged: boolean;
}

export interface OperationsRecommendation {
  title: string;
  description: string;
  category: string;
  impact: string;
}

export interface OperationsSnapshot {
  generated_at: string;
  cash: CashRunway;
  at_risk_projects: OperationsProject[];
  capacity_alerts: CapacityAlert[];
  upcoming_time_off: TimeOffWindow[];
  monitoring_incidents: MonitoringIncident[];
  recommendations: OperationsRecommendation[];
}

export type AutomationCategory =
  | "client"
  | "project"
  | "finance"
  | "support"
  | "marketing"
  | "monitoring"
  | "hr";

export type AutomationPriority = "low" | "medium" | "high" | "critical";

export interface AutomationTask {
  id: string;
  category: AutomationCategory;
  summary: string;
  priority: AutomationPriority;
  due_at?: string | null;
  suggested_assignee?: string | null;
  details?: string | null;
  related_ids: Record<string, string>;
  action_label?: string | null;
  action_url?: string | null;
}

export interface AutomationDigest {
  id: string;
  generated_at: string;
  tasks: AutomationTask[];
}

export interface Project {
  id: string;
  name: string;
  code: string;
  client_id: string;
  project_type: string;
  status: string;
  start_date: string;
  end_date?: string | null;
  manager_id: string;
  budget?: number;
  currency: string;
  milestones: Milestone[];
  tasks: Task[];
  sprints: Sprint[];
  active_sprint_id?: string | null;
}

export interface Milestone {
  id: string;
  title: string;
  due_date: string;
  completed: boolean;
}

export interface Task {
  id: string;
  name: string;
  status: string;
  type: string;
  assignee_id?: string;
  leader_id?: string;
  start_date?: string;
  due_date?: string;
  billable: boolean;
  estimated_hours?: number;
  logged_hours: number;
  dependencies: string[];
  priority: TaskPriority;
  story_points?: number | null;
  sprint_id?: string | null;
}

export type TaskStatus = "todo" | "in_progress" | "review" | "done";
export type TaskType = "feature" | "bug" | "chore" | "research" | "qa";
export type TaskPriority = "low" | "medium" | "high" | "critical";
export type ProjectStatus = "planning" | "in_progress" | "on_hold" | "completed" | "cancelled";

export type SprintStatus = "planning" | "active" | "completed" | "cancelled";

export interface Sprint {
  id: string;
  name: string;
  goal?: string | null;
  status: SprintStatus;
  start_date: string;
  end_date: string;
  committed_points: number;
  completed_points: number;
  velocity?: number | null;
  focus_areas: string[];
  created_at: string;
  updated_at: string;
}

export interface TaskUpdatePayload {
  id: string;
  name?: string;
  status?: TaskStatus;
  type?: TaskType;
  assignee_id?: string;
  leader_id?: string;
  start_date?: string;
  due_date?: string | null;
  billable?: boolean;
  estimated_hours?: number;
  logged_hours?: number;
  dependencies?: string[];
  priority?: TaskPriority;
  story_points?: number | null;
  sprint_id?: string | null;
}

export interface MilestoneUpdatePayload {
  id: string;
  title?: string;
  due_date?: string;
  completed?: boolean;
}

export interface ProjectUpdatePayload {
  name?: string;
  status?: ProjectStatus;
  manager_id?: string;
  start_date?: string;
  budget?: number;
  currency?: string;
  template_id?: string;
  tasks?: TaskUpdatePayload[];
  milestones?: MilestoneUpdatePayload[];
}

export interface ProjectTemplateTaskDefinition {
  name: string;
  duration_days: number;
  depends_on: string[];
  status: TaskStatus;
  type: TaskType;
  estimated_hours?: number;
  billable: boolean;
  leader_id?: string | null;
  story_points?: number | null;
  priority: TaskPriority;
}

export interface ProjectTemplateMilestoneDefinition {
  title: string;
  offset_days: number;
}

export interface ProjectTemplateDefinition {
  template_id: string;
  code_prefix: string;
  tasks: ProjectTemplateTaskDefinition[];
  milestones: ProjectTemplateMilestoneDefinition[];
}

export interface ProjectTemplateCreateRequest {
  template_id: string;
  code_prefix: string;
  tasks: ProjectTemplateTaskDefinition[];
  milestones: ProjectTemplateMilestoneDefinition[];
  overwrite?: boolean;
}

export interface ProjectTemplateCreateResponse {
  template_id: string;
}

export type Industry = "hospitality" | "creative" | "technology" | "other";

export type ClientSegment = "retainer" | "project" | "vip" | "prospect";

export type InteractionChannel = "email" | "portal" | "social" | "phone";

export interface TimestampedEntity {
  id: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface ContactInput {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  title?: string | null;
}

export interface Contact extends TimestampedEntity, ContactInput {}

export interface Interaction extends TimestampedEntity {
  channel: InteractionChannel;
  subject: string;
  summary: string;
  occurred_at: string;
  owner_id?: string | null;
}

export interface ClientDocument extends TimestampedEntity {
  name: string;
  url: string;
  version: string;
  uploaded_by: string;
  signed: boolean;
}

export interface Client extends TimestampedEntity {
  id: string;
  organization_name: string;
  industry: Industry;
  segment: ClientSegment;
  billing_email: string;
  preferred_channel: InteractionChannel;
  timezone: string;
  contacts?: Contact[];
  interactions?: Interaction[];
  documents?: ClientDocument[];
}

export interface ClientProjectDigest {
  id: string;
  code: string;
  name: string;
  project_type: string;
  status: string;
  start_date: string;
  end_date?: string | null;
  manager_id: string;
  budget?: number | null;
  currency: string;
  late_tasks: Task[];
  next_task?: Task | null;
  next_milestone?: Milestone | null;
}

export interface ClientInvoiceDigest {
  id: string;
  number: string;
  status: string;
  due_date: string;
  total: number;
  balance_due: number;
  currency: string;
  project_id?: string | null;
  project_name?: string | null;
}

export interface ClientPaymentDigest {
  id: string;
  invoice_id: string;
  invoice_number?: string | null;
  amount: number;
  received_at: string;
  method: string;
}

export interface ClientFinancialSnapshot {
  outstanding_invoices: ClientInvoiceDigest[];
  next_invoice_due?: ClientInvoiceDigest | null;
  recent_payments: ClientPaymentDigest[];
  total_outstanding: number;
}

export interface ClientTicketDigest {
  id: string;
  subject: string;
  status: string;
  priority: string;
  sla_due?: string | null;
  last_activity_at?: string | null;
}

export interface ClientSupportSnapshot {
  open_tickets: ClientTicketDigest[];
  last_ticket_update?: string | null;
}

export interface ClientDashboard {
  client: Client;
  projects: ClientProjectDigest[];
  financials: ClientFinancialSnapshot;
  support: ClientSupportSnapshot;
}

export interface ProjectSetup {
  name: string;
  project_type: string;
  start_date: string;
  manager_id: string;
  budget: number;
  currency: string;
  start_after?: string | null;
}

export interface ClientCreateRequest {
  organization_name: string;
  industry: Industry;
  segment: ClientSegment;
  billing_email: string;
  preferred_channel: InteractionChannel;
  timezone: string;
  contacts: ContactInput[];
  projects: ProjectSetup[];
}

export interface ClientWithProjects {
  client: Client;
  projects: Project[];
}

export interface Invoice {
  id: string;
  client_id: string;
  project_id?: string;
  number: string;
  currency: string;
  status: string;
  issue_date: string;
  due_date: string;
  items: LineItem[];
}

export interface ProjectFinancials {
  project_id: string;
  project_name: string;
  client_name?: string | null;
  currency: string;
  total_invoiced: number;
  total_collected: number;
  total_expenses: number;
  outstanding_amount: number;
  net_revenue: number;
}

export interface MacroFinancials {
  total_invoiced: number;
  total_collected: number;
  total_outstanding: number;
  total_expenses: number;
  net_cash_flow: number;
}

export interface TaxEntryInput {
  label: string;
  amount: number;
}

export interface TaxComputationPayload {
  incomes: TaxEntryInput[];
  cost_of_sales: TaxEntryInput[];
  operating_expenses: TaxEntryInput[];
  other_deductions: TaxEntryInput[];
  apply_percentage_tax: boolean;
  percentage_tax_rate: number;
  vat_registered: boolean;
}

export interface DeductionOpportunity {
  category: string;
  message: string;
}

export interface TaxBusinessProfile {
  taxpayer_type: string;
  registration_type: string;
  psic_primary_code: string;
  psic_primary_description: string;
  primary_line_of_business: string;
  psic_secondary_code: string;
  psic_secondary_description: string;
  secondary_line_of_business: string;
  filing_frequencies: string[];
  compliance_notes: string[];
}

export interface FilingObligation {
  form: string;
  description: string;
  frequency: string;
  period: string;
  due_date: string;
}

export interface TaxComputationResult {
  gross_revenue: number;
  total_cost_of_sales: number;
  total_operating_expenses: number;
  total_other_deductions: number;
  taxable_income: number;
  income_tax: number;
  percentage_tax: number;
  vat_due: number;
  total_tax: number;
  effective_tax_rate: number;
  deduction_opportunities: DeductionOpportunity[];
}

export interface TaxProfile {
  incomes: TaxEntryInput[];
  cost_of_sales: TaxEntryInput[];
  operating_expenses: TaxEntryInput[];
  other_deductions: TaxEntryInput[];
  apply_percentage_tax: boolean;
  percentage_tax_rate: number;
  vat_registered: boolean;
  business_profile: TaxBusinessProfile;
  filing_calendar: FilingObligation[];
  last_updated: string;
  source_summary: Record<string, number>;
  computed: TaxComputationResult;
}

export interface PricingSuggestion {
  project_id: string;
  service: string;
  current_rate: number;
  recommended_rate: number;
  current_margin: number;
  recommended_adjustment_pct: number;
  rationale: string;
  currency: string;
}

export interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface Ticket {
  id: string;
  client_id: string;
  subject: string;
  status: string;
  priority: string;
  assignee_id?: string;
}

export interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  employment_type: string;
  title: string;
}

export interface TimeOffRequest {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  status: string;
}

export interface Campaign {
  id: string;
  name: string;
  objective: string;
  channel: string;
  start_date: string;
  end_date?: string;
  owner_id: string;
}

export interface SiteStatus {
  site: {
    id: string;
    url: string;
    label: string;
    brand: string;
  };
  checks: Array<{
    id: string;
    type: string;
    status: string;
    last_run: string;
    last_response_time_ms?: number;
  }>;
  alerts: Array<{
    id: string;
    message: string;
    severity: string;
    triggered_at: string;
    acknowledged: boolean;
  }>;
}
