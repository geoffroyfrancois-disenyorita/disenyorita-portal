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
  projects: () => request<Project[]>("/projects"),
  clients: () => request<Client[]>("/clients"),
  invoices: () => request<Invoice[]>("/financials/invoices"),
  financialOverview: () => request<MacroFinancials>("/financials/overview"),
  projectFinancials: () => request<ProjectFinancials[]>("/financials/projects"),
  pricingSuggestions: () => request<PricingSuggestion[]>("/financials/pricing/suggestions"),
  computeTax: (payload: TaxComputationPayload) =>
    request<TaxComputationResult>("/financials/tax/compute", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  supportTickets: () => request<Ticket[]>("/support/tickets"),
  employees: () => request<Employee[]>("/hr/employees"),
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

export interface Project {
  id: string;
  name: string;
  code: string;
  client_id: string;
  project_type: string;
  status: string;
  start_date: string;
  manager_id: string;
  budget?: number;
  currency: string;
  milestones: Milestone[];
  tasks: Task[];
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
  assignee_id?: string;
  due_date?: string;
  billable: boolean;
  estimated_hours?: number;
  logged_hours: number;
}

export interface Client {
  id: string;
  organization_name: string;
  industry: string;
  segment: string;
  billing_email: string;
  preferred_channel: string;
  timezone: string;
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
