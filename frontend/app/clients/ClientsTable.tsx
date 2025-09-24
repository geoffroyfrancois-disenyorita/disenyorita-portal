"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  api,
  Client,
  ClientCreateRequest,
  ClientSegment,
  ContactInput,
  Industry,
  InteractionChannel
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

  const canSubmit = useMemo(() => {
    const { organization_name, billing_email, project } = formState;
    return Boolean(
      organization_name &&
      billing_email &&
      project.name &&
      project.project_type &&
      project.start_date &&
      project.manager_id &&
      project.budget
    );
  }, [formState]);

  const handleClose = () => {
    setIsModalOpen(false);
    setFormState(initialFormState());
    setError(null);
  };

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
        ]
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
        <button className="button primary" onClick={() => setIsModalOpen(true)}>
          + Add Client
        </button>
        {successMessage && <span className="form-feedback success">{successMessage}</span>}
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Organization</th>
            <th>Industry</th>
            <th>Segment</th>
            <th>Billing Email</th>
            <th>Timezone</th>
          </tr>
        </thead>
        <tbody>
          {clients.map((client) => (
            <tr
              key={client.id}
              className="clickable-row"
              onClick={() => router.push(`/clients/${client.id}`)}
            >
              <td>
                <Link href={`/clients/${client.id}`} onClick={(event) => event.stopPropagation()}>
                  {client.organization_name}
                </Link>
              </td>
              <td style={{ textTransform: "capitalize" }}>{client.industry}</td>
              <td>
                <span
                  className={`badge ${client.segment === "retainer" ? "success" : client.segment === "vip" ? "warning" : ""}`}
                  style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}
                >
                  {client.segment}
                </span>
              </td>
              <td>{client.billing_email}</td>
              <td>{client.timezone}</td>
            </tr>
          ))}
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
            <form className="form" onSubmit={handleSubmit}>
              <fieldset className="form-section">
                <legend>Organization</legend>
                <div className="form-grid">
                  <label>
                    <span>Organization name</span>
                    <input
                      type="text"
                      value={formState.organization_name}
                      onChange={(event) =>
                        setFormState((prev) => ({ ...prev, organization_name: event.target.value }))
                      }
                      required
                    />
                  </label>
                  <label>
                    <span>Billing email</span>
                    <input
                      type="email"
                      value={formState.billing_email}
                      onChange={(event) =>
                        setFormState((prev) => ({ ...prev, billing_email: event.target.value }))
                      }
                      required
                    />
                  </label>
                  <label>
                    <span>Industry</span>
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
                    <span>Segment</span>
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
                    <span>Preferred channel</span>
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
                    <span>Timezone</span>
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
                    <span>First name</span>
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
                    <span>Last name</span>
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
                    <span>Email</span>
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
                    <span>Phone</span>
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
                    <span>Title</span>
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
                <legend>Initial project</legend>
                <div className="form-grid">
                  <label>
                    <span>Project name</span>
                    <input
                      type="text"
                      value={formState.project.name}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          project: { ...prev.project, name: event.target.value }
                        }))
                      }
                      required
                    />
                  </label>
                  <label>
                    <span>Project type</span>
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
                    <span>Start date</span>
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
                    <span>Project manager ID</span>
                    <input
                      type="text"
                      value={formState.project.manager_id}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          project: { ...prev.project, manager_id: event.target.value }
                        }))
                      }
                      required
                    />
                  </label>
                  <label>
                    <span>Budget (USD)</span>
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
                      required
                    />
                  </label>
                  <label>
                    <span>Currency</span>
                    <input
                      type="text"
                      value={formState.project.currency}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          project: { ...prev.project, currency: event.target.value }
                        }))
                      }
                    />
                  </label>
                  <label>
                    <span>Starts after (optional dependency)</span>
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
