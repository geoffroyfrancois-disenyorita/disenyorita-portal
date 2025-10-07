"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  api,
  Client,
  ClientCreateRequest,
  ClientRevenueProfile,
  ClientSegment,
  ContactInput,
  Industry,
  InteractionChannel,
  RevenueClassification
} from "../../lib/api";

interface ClientsTableProps {
  clients: Client[];
}

interface ClientFormState {
  organization_name: string;
  industry: Industry;
  segment: ClientSegment;
  billing_email: string;
  preferred_channel: InteractionChannel;
  timezone: string;
  contact: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    title: string;
  };
  project: {
    name: string;
    project_type: string;
    start_date: string;
    manager_id: string;
    budget: string;
    currency: string;
    start_after: string;
  };
  revenue: {
    classification: RevenueClassification;
    amount: string;
    currency: string;
    autopay: boolean;
    next_payment_due: string;
    payment_count: string;
    remaining_balance: string;
  };
}

const industryOptions: { label: string; value: Industry }[] = [
  { label: "Hospitality", value: "hospitality" },
  { label: "Creative", value: "creative" },
  { label: "Technology", value: "technology" },
  { label: "Other", value: "other" }
];

const segmentOptions: { label: string; value: ClientSegment }[] = [
  { label: "Retainer", value: "retainer" },
  { label: "Project", value: "project" },
  { label: "VIP", value: "vip" },
  { label: "Prospect", value: "prospect" }
];

const channelOptions: { label: string; value: InteractionChannel }[] = [
  { label: "Email", value: "email" },
  { label: "Client Portal", value: "portal" },
  { label: "Social", value: "social" },
  { label: "Phone", value: "phone" }
];

const projectTemplateOptions = [
  { label: "Website", value: "website" },
  { label: "Branding", value: "branding" },
  { label: "Consulting", value: "consulting" }
];

const segmentLabels: Record<ClientSegment, string> = {
  retainer: "Retainer",
  project: "Project",
  vip: "VIP",
  prospect: "Prospect"
};

const segmentBadgeClasses: Record<ClientSegment, string> = {
  retainer: "success",
  project: "neutral",
  vip: "warning",
  prospect: "info"
};

const revenueLabels: Record<RevenueClassification, string> = {
  monthly_subscription: "Monthly subscription",
  annual_subscription: "Annual subscription",
  one_time: "One-time engagement",
  multi_payment: "Installment plan"
};

const revenueBadgeClasses: Record<RevenueClassification, string> = {
  monthly_subscription: "success",
  annual_subscription: "info",
  one_time: "neutral",
  multi_payment: "warning"
};

const revenueFilterOptions: { label: string; value: RevenueClassification | "all" }[] = [
  { label: "All billing models", value: "all" },
  { label: "Monthly subscriptions", value: "monthly_subscription" },
  { label: "Annual subscriptions", value: "annual_subscription" },
  { label: "Installment plans", value: "multi_payment" },
  { label: "One-time", value: "one_time" }
];

const currencyFormatterCache = new Map<string, Intl.NumberFormat>();

function formatCurrency(amount: number, currency: string): string {
  const cacheKey = currency;
  if (!currencyFormatterCache.has(cacheKey)) {
    currencyFormatterCache.set(
      cacheKey,
      new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
        maximumFractionDigits: currency === "JPY" ? 0 : 2
      })
    );
  }

  return currencyFormatterCache.get(cacheKey)!.format(amount);
}

function latestInteractionTimestamp(client: Client): string | null {
  if (!client.interactions || client.interactions.length === 0) {
    return null;
  }

  return client.interactions
    .map((interaction) => interaction.occurred_at)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
}

function formatRelativeInteraction(isoTimestamp: string): { label: string; days: number } {
  const interactionDate = new Date(isoTimestamp);
  const diffMs = Date.now() - interactionDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) {
    return { label: "Today", days: 0 };
  }
  if (diffDays === 1) {
    return { label: "1 day ago", days: 1 };
  }
  if (diffDays < 7) {
    return { label: `${diffDays} days ago`, days: diffDays };
  }

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) {
    return { label: `${diffWeeks} wk${diffWeeks === 1 ? "" : "s"} ago`, days: diffDays };
  }

  return {
    label: interactionDate.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric"
    }),
    days: diffDays
  };
}

function formatChannelLabel(channel: InteractionChannel): string {
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

function formatRevenueAmount(profile: ClientRevenueProfile): string {
  const base = formatCurrency(Number(profile.amount || 0), profile.currency);
  if (profile.classification === "monthly_subscription") {
    return `${base} / mo`;
  }
  if (profile.classification === "annual_subscription") {
    return `${base} / yr`;
  }
  return base;
}

function formatShortDate(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  });
}

function formatRevenueMeta(profile: ClientRevenueProfile): string {
  const details: string[] = [];
  if (profile.autopay) {
    details.push("Autopay enabled");
  }
  if (profile.payment_count) {
    details.push(`${profile.payment_count} payments`);
  }
  if (profile.remaining_balance && profile.remaining_balance > 0) {
    details.push(`${formatCurrency(profile.remaining_balance, profile.currency)} outstanding`);
  }
  const nextDue = formatShortDate(profile.next_payment_due ?? null);
  if (nextDue) {
    details.push(`Next ${nextDue}`);
  }
  return details.join(" • ");
}

function initialFormState(): ClientFormState {
  return {
    organization_name: "",
    industry: "hospitality",
    segment: "retainer",
    billing_email: "",
    preferred_channel: "email",
    timezone: "UTC",
    contact: {
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      title: ""
    },
    project: {
      name: "",
      project_type: "website",
      start_date: "",
      manager_id: "",
      budget: "",
      currency: "USD",
      start_after: ""
    },
    revenue: {
      classification: "monthly_subscription",
      amount: "",
      currency: "USD",
      autopay: true,
      next_payment_due: "",
      payment_count: "",
      remaining_balance: ""
    }
  };
}

export function ClientsTable({ clients }: ClientsTableProps): JSX.Element {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formState, setFormState] = useState<ClientFormState>(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [segmentFilter, setSegmentFilter] = useState<ClientSegment | "all">("all");
  const [industryFilter, setIndustryFilter] = useState<Industry | "all">("all");
  const [billingFilter, setBillingFilter] = useState<RevenueClassification | "all">("all");

  const canSubmit = useMemo(() => {
    const { organization_name, billing_email, project, revenue } = formState;
    return Boolean(
      organization_name &&
      billing_email &&
      project.name &&
      project.project_type &&
      project.start_date &&
      project.manager_id &&
      project.budget &&
      revenue.amount
    );
  }, [formState]);

  const modalBadgeVariant = isSubmitting ? "info" : canSubmit ? "success" : "warning";
  const modalStatusLabel = isSubmitting ? "Submitting…" : canSubmit ? "Ready to submit" : "Fill required fields";

  const handleClose = () => {
    setIsModalOpen(false);
    setFormState(initialFormState());
    setError(null);
  };

  const handleModalReset = () => {
    setFormState(initialFormState());
    setError(null);
  };

  const filteredClients = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return clients.filter((client) => {
      const matchesTerm = term
        ? client.organization_name.toLowerCase().includes(term) ||
          client.billing_email.toLowerCase().includes(term) ||
          (client.contacts ?? []).some((contact) => {
            const fullName = `${contact.first_name} ${contact.last_name}`.toLowerCase();
            return (
              fullName.includes(term) ||
              (contact.email ?? "").toLowerCase().includes(term) ||
              (contact.title ?? "").toLowerCase().includes(term)
            );
          })
        : true;

      const matchesSegment = segmentFilter === "all" || client.segment === segmentFilter;
      const matchesIndustry = industryFilter === "all" || client.industry === industryFilter;
      const matchesBilling =
        billingFilter === "all" || client.revenue_profile?.classification === billingFilter;
      return matchesTerm && matchesSegment && matchesIndustry && matchesBilling;
    });
  }, [clients, searchTerm, segmentFilter, industryFilter, billingFilter]);

  const hasActiveFilters = useMemo(
    () =>
      searchTerm.trim() !== "" ||
      segmentFilter !== "all" ||
      industryFilter !== "all" ||
      billingFilter !== "all",
    [searchTerm, segmentFilter, industryFilter, billingFilter]
  );

  const handleClearFilters = () => {
    setSearchTerm("");
    setSegmentFilter("all");
    setIndustryFilter("all");
    setBillingFilter("all");
  };

  const segmentSelectOptions = [{ label: "All segments", value: "all" as const }, ...segmentOptions];
  const industrySelectOptions = [{ label: "All industries", value: "all" as const }, ...industryOptions];
  const billingSelectOptions = revenueFilterOptions;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting || !canSubmit) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const contactInput = formState.contact;
      const contacts: ContactInput[] = contactInput.email
        ? [
            {
              first_name: contactInput.first_name,
              last_name: contactInput.last_name,
              email: contactInput.email,
              phone: contactInput.phone || null,
              title: contactInput.title || null
            }
          ]
        : [];

      const revenueProfile: ClientRevenueProfile = {
        classification: formState.revenue.classification,
        amount: Number(formState.revenue.amount),
        currency: formState.revenue.currency,
        autopay: formState.revenue.autopay,
        next_payment_due: formState.revenue.next_payment_due
          ? new Date(`${formState.revenue.next_payment_due}T00:00:00Z`).toISOString()
          : null,
        last_payment_at: null,
        payment_count: formState.revenue.payment_count ? Number(formState.revenue.payment_count) : null,
        remaining_balance:
          formState.revenue.remaining_balance !== ""
            ? Number(formState.revenue.remaining_balance)
            : null
      };

      const payload: ClientCreateRequest = {
        organization_name: formState.organization_name,
        industry: formState.industry,
        segment: formState.segment,
        billing_email: formState.billing_email,
        preferred_channel: formState.preferred_channel,
        timezone: formState.timezone,
        contacts,
        projects: [
          {
            name: formState.project.name,
            project_type: formState.project.project_type,
            start_date: new Date(`${formState.project.start_date}T00:00:00Z`).toISOString(),
            manager_id: formState.project.manager_id,
            budget: Number(formState.project.budget),
            currency: formState.project.currency,
            start_after: formState.project.start_after || null
          }
        ],
        revenue_profile: revenueProfile
      };

      await api.createClient(payload);
      setSuccessMessage("Client successfully created.");
      setTimeout(() => setSuccessMessage(null), 5000);
      handleClose();
      router.refresh();
    } catch (submitError) {
      if (submitError instanceof Error) {
        setError(submitError.message);
      } else {
        setError("Unable to save the client. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div className="clients-toolbar">
        <div className="clients-toolbar-actions">
          <button className="button primary" onClick={() => setIsModalOpen(true)}>
            + Add Client
          </button>
          {successMessage && <span className="form-feedback success">{successMessage}</span>}
          <span className="crm-result-count">
            {filteredClients.length === clients.length
              ? `${clients.length} clients`
              : `${filteredClients.length} of ${clients.length} clients`}
          </span>
        </div>
        <div className="clients-toolbar-filters">
          <input
            type="search"
            placeholder="Search clients or contacts"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
          <select
            value={segmentFilter}
            onChange={(event) => setSegmentFilter(event.target.value as ClientSegment | "all")}
          >
            {segmentSelectOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={industryFilter}
            onChange={(event) => setIndustryFilter(event.target.value as Industry | "all")}
          >
            {industrySelectOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={billingFilter}
            onChange={(event) => setBillingFilter(event.target.value as RevenueClassification | "all")}
          >
            {billingSelectOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button className="button ghost" type="button" onClick={handleClearFilters} disabled={!hasActiveFilters}>
            Clear
          </button>
        </div>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Organization</th>
            <th>Segment</th>
            <th>Industry</th>
            <th>Revenue</th>
            <th>Contacts</th>
            <th>Last touch</th>
            <th>Preferred channel</th>
            <th>Timezone</th>
          </tr>
        </thead>
        <tbody>
          {filteredClients.length === 0 ? (
            <tr>
              <td className="table-empty" colSpan={8}>
                No clients match the current filters. Update your filters or clear them to view all accounts.
              </td>
            </tr>
          ) : (
            filteredClients.map((client) => {
              const latestInteraction = latestInteractionTimestamp(client);
              const interactionDetails = latestInteraction
                ? formatRelativeInteraction(latestInteraction)
                : null;
              const lastTouchClass = interactionDetails
                ? `crm-last-touch${interactionDetails.days > 21 ? " stale" : interactionDetails.days <= 7 ? " fresh" : ""}`
                : "crm-last-touch";
              const contacts = client.contacts ?? [];
              const primaryContact = contacts[0];
              const contactCellClass = contacts.length === 0 ? "crm-contact-cell empty" : "crm-contact-cell";
              const revenueProfile = client.revenue_profile;
              const revenueMeta = revenueProfile ? formatRevenueMeta(revenueProfile) : "";

              return (
                <tr
                  key={client.id}
                  className="clickable-row"
                  onClick={() => router.push(`/clients/${client.id}`)}
                >
                  <td>
                    <Link href={`/clients/${client.id}`} onClick={(event) => event.stopPropagation()}>
                      {client.organization_name}
                    </Link>
                    <div className="crm-org-meta">{client.billing_email}</div>
                  </td>
                  <td>
                    <span className={`badge ${segmentBadgeClasses[client.segment]}`}>
                      {segmentLabels[client.segment]}
                    </span>
                  </td>
                  <td style={{ textTransform: "capitalize" }}>{client.industry}</td>
                  <td>
                    {revenueProfile ? (
                      <div className="crm-revenue-cell">
                        <span className={`badge ${revenueBadgeClasses[revenueProfile.classification]}`}>
                          {revenueLabels[revenueProfile.classification]}
                        </span>
                        <span className="crm-revenue-amount">{formatRevenueAmount(revenueProfile)}</span>
                        {revenueMeta && <span className="crm-revenue-meta">{revenueMeta}</span>}
                      </div>
                    ) : (
                      <span className="text-muted">No billing profile</span>
                    )}
                  </td>
                  <td>
                    <div className={contactCellClass}>
                      <span className="crm-contact-count">
                        {contacts.length > 0
                          ? `${contacts.length} ${contacts.length === 1 ? "contact" : "contacts"}`
                          : "No contacts"}
                      </span>
                      {primaryContact && (
                        <span className="crm-contact-primary">
                          {primaryContact.first_name} {primaryContact.last_name}
                          {primaryContact.title ? ` • ${primaryContact.title}` : ""}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className={lastTouchClass}>
                    {interactionDetails ? interactionDetails.label : "No interactions logged"}
                  </td>
                  <td>{formatChannelLabel(client.preferred_channel)}</td>
                  <td>{client.timezone}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {isModalOpen && (
        <div className="modal-backdrop" role="presentation" onClick={handleClose}>
          <div className="modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>New Client</h3>
              <button className="button ghost" onClick={handleClose}>
                Close
              </button>
            </div>
            <div className="editor-toolbar editor-toolbar--compact modal-toolbar">
              <div>
                <h4 className="editor-toolbar-title">Client onboarding</h4>
                <p className="editor-toolbar-description">
                  Capture the essentials to spin up a workspace and kickoff project.
                </p>
              </div>
              <div className="editor-toolbar-actions">
                <span className={`badge ${modalBadgeVariant}`}>{modalStatusLabel}</span>
                <button
                  type="button"
                  className="button ghost"
                  onClick={handleModalReset}
                  disabled={isSubmitting}
                >
                  Clear form
                </button>
              </div>
            </div>
            <form className="form" onSubmit={handleSubmit}>
              <fieldset className="form-section">
                <legend>Organization</legend>
                <div className="form-grid">
                  <label>
                    <span className="form-label">Organization name</span>
                    <span className="form-helper">Legal or DBA name used on proposals and invoices.</span>
                    <input
                      type="text"
                      value={formState.organization_name}
                      onChange={(event) =>
                        setFormState((prev) => ({ ...prev, organization_name: event.target.value }))
                      }
                      placeholder="e.g. Sunrise Hospitality Group"
                      required
                    />
                  </label>
                  <label>
                    <span className="form-label">Billing email</span>
                    <span className="form-helper">Primary finance contact for statements and receipts.</span>
                    <input
                      type="email"
                      value={formState.billing_email}
                      onChange={(event) =>
                        setFormState((prev) => ({ ...prev, billing_email: event.target.value }))
                      }
                      placeholder="finance@client.com"
                      required
                    />
                  </label>
                  <label>
                    <span className="form-label">Industry</span>
                    <span className="form-helper">Tailors benchmarks and suggested playbooks.</span>
                    <select
                      value={formState.industry}
                      onChange={(event) =>
                        setFormState((prev) => ({ ...prev, industry: event.target.value as Industry }))
                      }
                    >
                      {industryOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="form-label">Segment</span>
                    <span className="form-helper">Helps triage success playbooks and service tiers.</span>
                    <select
                      value={formState.segment}
                      onChange={(event) =>
                        setFormState((prev) => ({ ...prev, segment: event.target.value as ClientSegment }))
                      }
                    >
                      {segmentOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="form-label">Preferred channel</span>
                    <span className="form-helper">Where the account team should reach out by default.</span>
                    <select
                      value={formState.preferred_channel}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          preferred_channel: event.target.value as InteractionChannel
                        }))
                      }
                    >
                      {channelOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="form-label">Timezone</span>
                    <span className="form-helper">Keep scheduling aligned with the client team.</span>
                    <input
                      type="text"
                      value={formState.timezone}
                      onChange={(event) =>
                        setFormState((prev) => ({ ...prev, timezone: event.target.value }))
                      }
                      placeholder="e.g. America/New_York"
                    />
                  </label>
                </div>
              </fieldset>

              <fieldset className="form-section">
                <legend>Primary contact</legend>
                <div className="form-grid">
                  <label>
                    <span className="form-label">First name</span>
                    <span className="form-helper">Primary relationship owner on the client side.</span>
                    <input
                      type="text"
                      value={formState.contact.first_name}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          contact: { ...prev.contact, first_name: event.target.value }
                        }))
                      }
                    />
                  </label>
                  <label>
                    <span className="form-label">Last name</span>
                    <span className="form-helper">Helps personalize automated communications.</span>
                    <input
                      type="text"
                      value={formState.contact.last_name}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          contact: { ...prev.contact, last_name: event.target.value }
                        }))
                      }
                    />
                  </label>
                  <label>
                    <span className="form-label">Email</span>
                    <span className="form-helper">We'll send kickoff notes and status digests here.</span>
                    <input
                      type="email"
                      value={formState.contact.email}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          contact: { ...prev.contact, email: event.target.value }
                        }))
                      }
                    />
                  </label>
                  <label>
                    <span className="form-label">Phone</span>
                    <span className="form-helper">Optional. Add for urgent SMS or call updates.</span>
                    <input
                      type="tel"
                      value={formState.contact.phone}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          contact: { ...prev.contact, phone: event.target.value }
                        }))
                      }
                      placeholder="Optional"
                    />
                  </label>
                  <label>
                    <span className="form-label">Title</span>
                    <span className="form-helper">Optional role for context in reports.</span>
                    <input
                      type="text"
                      value={formState.contact.title}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          contact: { ...prev.contact, title: event.target.value }
                        }))
                      }
                      placeholder="Optional"
                    />
                  </label>
              </div>
            </fieldset>

            <fieldset className="form-section">
              <legend>Billing & revenue</legend>
              <div className="form-grid">
                <label>
                  <span className="form-label">Billing model</span>
                  <span className="form-helper">Choose how this client pays for ongoing work.</span>
                  <select
                    value={formState.revenue.classification}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        revenue: { ...prev.revenue, classification: event.target.value as RevenueClassification }
                      }))
                    }
                  >
                    {revenueFilterOptions
                      .filter((option) => option.value !== "all")
                      .map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  <span className="form-label">Contract value</span>
                  <span className="form-helper">For subscriptions use the recurring amount; for projects the total value.</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formState.revenue.amount}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        revenue: { ...prev.revenue, amount: event.target.value }
                      }))
                    }
                    required
                  />
                </label>
                <label>
                  <span className="form-label">Currency</span>
                  <span className="form-helper">Currency used for invoices and renewals.</span>
                  <select
                    value={formState.revenue.currency}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        revenue: { ...prev.revenue, currency: event.target.value }
                      }))
                    }
                  >
                    {["USD", "EUR", "GBP", "PHP", "SGD"].map((currency) => (
                      <option key={currency} value={currency}>
                        {currency}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="form-label">Autopay</span>
                  <span className="form-helper">Enable to flag automatic renewals for this client.</span>
                  <div className="form-checkbox">
                    <input
                      type="checkbox"
                      checked={formState.revenue.autopay}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          revenue: { ...prev.revenue, autopay: event.target.checked }
                        }))
                      }
                    />
                    <span>Autopay enabled</span>
                  </div>
                </label>
                <label>
                  <span className="form-label">Next payment due</span>
                  <span className="form-helper">Optional. Helps surface upcoming renewals.</span>
                  <input
                    type="date"
                    value={formState.revenue.next_payment_due}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        revenue: { ...prev.revenue, next_payment_due: event.target.value }
                      }))
                    }
                  />
                </label>
                <label>
                  <span className="form-label">Payment count</span>
                  <span className="form-helper">For installment plans, capture the number of payments.</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={formState.revenue.payment_count}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        revenue: { ...prev.revenue, payment_count: event.target.value }
                      }))
                    }
                  />
                </label>
                <label>
                  <span className="form-label">Outstanding balance</span>
                  <span className="form-helper">Track remaining value still to be collected.</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formState.revenue.remaining_balance}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        revenue: { ...prev.revenue, remaining_balance: event.target.value }
                      }))
                    }
                  />
                </label>
              </div>
            </fieldset>

            <fieldset className="form-section">
              <legend>Initial project</legend>
                <div className="form-grid">
                  <label>
                    <span className="form-label">Project name</span>
                    <span className="form-helper">How the engagement will appear across dashboards.</span>
                    <input
                      type="text"
                      value={formState.project.name}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          project: { ...prev.project, name: event.target.value }
                        }))
                      }
                      placeholder="e.g. Midtown hotel launch"
                      required
                    />
                  </label>
                  <label>
                    <span className="form-label">Project type</span>
                    <span className="form-helper">Select the template that matches this kickoff.</span>
                    <select
                      value={formState.project.project_type}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          project: { ...prev.project, project_type: event.target.value }
                        }))
                      }
                    >
                      {projectTemplateOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="form-label">Start date</span>
                    <span className="form-helper">We’ll schedule milestones starting from this day.</span>
                    <input
                      type="date"
                      value={formState.project.start_date}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          project: { ...prev.project, start_date: event.target.value }
                        }))
                      }
                      required
                    />
                  </label>
                  <label>
                    <span className="form-label">Project manager ID</span>
                    <span className="form-helper">Assign the delivery lead responsible for execution.</span>
                    <input
                      type="text"
                      value={formState.project.manager_id}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          project: { ...prev.project, manager_id: event.target.value }
                        }))
                      }
                      placeholder="e.g. pm-104"
                      required
                    />
                  </label>
                  <label>
                    <span className="form-label">Budget</span>
                    <span className="form-helper">Accepted budget for the initial scope.</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formState.project.budget}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          project: { ...prev.project, budget: event.target.value }
                        }))
                      }
                      placeholder="e.g. 50000"
                      required
                    />
                  </label>
                  <label>
                    <span className="form-label">Currency</span>
                    <span className="form-helper">Optional. Defaults to USD.</span>
                    <input
                      type="text"
                      value={formState.project.currency}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          project: { ...prev.project, currency: event.target.value }
                        }))
                      }
                      placeholder="USD"
                    />
                  </label>
                  <label className="full-width">
                    <span className="form-label">Starts after (optional dependency)</span>
                    <span className="form-helper">Reference another project that must finish before this one.</span>
                    <input
                      type="text"
                      value={formState.project.start_after}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          project: { ...prev.project, start_after: event.target.value }
                        }))
                      }
                      placeholder="Name of prerequisite project"
                    />
                  </label>
                </div>
              </fieldset>

              {error && <p className="form-feedback error">{error}</p>}

              <div className="form-actions">
                <button className="button ghost" type="button" onClick={handleClose}>
                  Cancel
                </button>
                <button className="button primary" type="submit" disabled={!canSubmit || isSubmitting}>
                  {isSubmitting ? "Saving..." : "Create client"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
