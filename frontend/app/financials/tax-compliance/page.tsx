"use client";

import Link from "next/link";
import { useState } from "react";

interface FormGuide {
  form: string;
  title: string;
  description: string;
  whenToUse: string;
  filingSchedule: string;
  dueDate: string;
  keyFields: string[];
  onlineFilingSteps: string[];
}

const formGuides: FormGuide[] = [
  {
    form: "1701",
    title: "BIR Form 1701 - Annual Income Tax Return for Individuals",
    description: "Comprehensive annual return for self-employed individuals and professionals with mixed income",
    whenToUse: "If you have income from both business/profession and compensation (employment)",
    filingSchedule: "Yearly",
    dueDate: "April 15 (for previous calendar year)",
    keyFields: [
      "Taxpayer Information (Name, TIN, RDO, Address)",
      "Gross Sales/Receipts and Other Income",
      "Cost of Sales/Services",
      "Deductions (including SSS, PhilHealth, Pag-IBIG contributions)",
      "Tax Computation (using graduated tax rates)",
      "Tax Credits and Payments",
      "Attachments: Financial Statements, Alphalist of Payees"
    ],
    onlineFilingSteps: [
      "Access eBIRForms at www.bir.gov.ph",
      "Download and install eBIRForms Package",
      "Launch eBIRForms application and select Form 1701",
      "Fill out all required fields with your income and expense data",
      "Generate the DAT file",
      "Upload DAT file through eBIRForms Submission Module or eFPS (Electronic Filing and Payment System)",
      "Print the filed return with Filing Reference Number (FRN)",
      "Pay taxes through authorized agent banks, GCash, or online banking"
    ]
  },
  {
    form: "1701A",
    title: "BIR Form 1701A - Annual Income Tax Return for Individuals with Pure Compensation",
    description: "Simplified annual return for individuals earning purely compensation income",
    whenToUse: "If you earn only salary/wages from employment (not applicable for your business activities)",
    filingSchedule: "Yearly",
    dueDate: "April 15 (for previous calendar year)",
    keyFields: [
      "Taxpayer Information",
      "Gross Compensation Income",
      "Deductions (premiums on health/hospitalization insurance)",
      "Tax Withheld by Employer",
      "Tax Due or Refundable"
    ],
    onlineFilingSteps: [
      "Access eBIRForms at www.bir.gov.ph",
      "Download and install eBIRForms Package",
      "Select Form 1701A",
      "Enter your compensation income details from BIR Form 2316 (Certificate of Compensation Payment)",
      "Generate and submit DAT file",
      "Pay any tax due or claim refund"
    ]
  },
  {
    form: "1701MS",
    title: "BIR Form 1701MS - Annual Income Tax Return for Mixed Income Earners (Simplified)",
    description: "Simplified annual return for professionals and self-employed with gross sales/receipts not exceeding ₱3M",
    whenToUse: "If your annual gross sales/receipts do not exceed ₱3,000,000 (recommended for your branding consultancy)",
    filingSchedule: "Yearly",
    dueDate: "April 15 (for previous calendar year)",
    keyFields: [
      "Taxpayer Information (Name, TIN, RDO, Line of Business, PSIC Code)",
      "Gross Sales/Receipts/Fees",
      "Cost of Sales/Services (optional, you can choose OSD or itemized)",
      "Business-related Expenses",
      "Other Non-Operating Income/Gains",
      "Deductions (SSS, PhilHealth, Pag-IBIG, PERA, health insurance premiums)",
      "Tax Computation",
      "Quarterly Income Tax Payments Made (from 1701Q)"
    ],
    onlineFilingSteps: [
      "Access eBIRForms at www.bir.gov.ph",
      "Download eBIRForms Package and select Form 1701MS",
      "Enter business information: PSIC Code 47913 or 82212, Line of Business: Branding Consultant",
      "Input gross sales/receipts from your branding services",
      "Choose deduction method: Optional Standard Deduction (40% of gross sales) or Itemized Deductions",
      "Enter allowable deductions (government contributions, health insurance)",
      "Review tax computation based on graduated tax rates",
      "Generate DAT file and submit online",
      "Pay balance due through authorized channels"
    ]
  },
  {
    form: "1701Q",
    title: "BIR Form 1701Q - Quarterly Income Tax Return for Individuals",
    description: "Quarterly income tax return for self-employed and professionals",
    whenToUse: "Filed every quarter to report income tax on your professional fees and business income",
    filingSchedule: "Quarterly",
    dueDate: "1st Quarter: On or before May 15, 2nd Quarter: On or before August 15, 3rd Quarter: On or before November 15",
    keyFields: [
      "Taxpayer Information (Name, TIN, RDO, PSIC Code)",
      "Gross Sales/Receipts for the Quarter",
      "Cost of Sales/Services",
      "Operating Expenses",
      "Taxable Income",
      "Income Tax Due (using graduated rates)",
      "Less: Tax Credits/Payments",
      "Tax Payable or Overpayment"
    ],
    onlineFilingSteps: [
      "Access eBIRForms at www.bir.gov.ph",
      "Select Form 1701Q for the applicable quarter",
      "Enter your business information and PSIC codes",
      "Input quarterly income from professional services (branding consultancy)",
      "Enter allowable expenses and deductions for the quarter",
      "System will compute tax due based on graduated rates",
      "Credit any tax payments already made (withholding taxes)",
      "Generate and submit DAT file",
      "Pay quarterly tax due through banks, GCash, or online banking",
      "Keep FRN and payment confirmation for annual reconciliation"
    ]
  }
];

interface ComplianceReminder {
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
}

const complianceReminders: ComplianceReminder[] = [
  {
    title: "November 15, 2025 - 3rd Quarter 1701Q Due",
    description: "File your 3rd quarter income tax return (1701Q) for the period July-September 2025",
    priority: "high"
  },
  {
    title: "Keep Receipts and Invoices",
    description: "Maintain all Official Receipts (OR) and invoices for at least 3 years for BIR audit purposes",
    priority: "medium"
  },
  {
    title: "Track Government Contributions",
    description: "Document SSS, PhilHealth, and Pag-IBIG contributions as they are deductible from taxable income",
    priority: "medium"
  },
  {
    title: "Annual Reconciliation",
    description: "In April 2026, reconcile your quarterly 1701Q payments against your annual return (1701/1701MS)",
    priority: "low"
  }
];

export default function TaxCompliancePage(): JSX.Element {
  const [selectedForm, setSelectedForm] = useState<string | null>(null);
  const [showOnlineGuide, setShowOnlineGuide] = useState<boolean>(false);

  const selectedFormData = formGuides.find((guide) => guide.form === selectedForm);

  return (
    <div>
      <Link href="/financials" style={{ color: "#8b3921", textDecoration: "none", fontWeight: 600 }}>
        ← Back to financial control
      </Link>
      <h2 className="section-title" style={{ marginTop: "1.5rem" }}>
        Philippines Tax Compliance Center
      </h2>
      <p className="text-muted" style={{ maxWidth: "820px" }}>
        Comprehensive tax compliance guide specifically configured for your branding consultancy business. File your BIR returns correctly and on time with step-by-step guidance.
      </p>

      {/* Business Information Card */}
      <div className="card" style={{ marginTop: "2rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
        <h3 style={{ margin: 0 }}>Your Business Information</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "1.5rem" }}>
          <div>
            <p className="text-muted" style={{ margin: 0, fontSize: "0.85rem" }}>Taxpayer Type</p>
            <p style={{ margin: "0.25rem 0", fontWeight: 600, fontSize: "1.1rem" }}>Professional - In General</p>
            <p className="text-muted" style={{ margin: 0, fontSize: "0.85rem" }}>Individual taxpayer engaged in professional services</p>
          </div>
          <div>
            <p className="text-muted" style={{ margin: 0, fontSize: "0.85rem" }}>Primary PSIC Code</p>
            <p style={{ margin: "0.25rem 0", fontWeight: 600, fontSize: "1.1rem" }}>47913</p>
            <p className="text-muted" style={{ margin: 0, fontSize: "0.85rem" }}>Retail sale via internet</p>
          </div>
          <div>
            <p className="text-muted" style={{ margin: 0, fontSize: "0.85rem" }}>Secondary PSIC Code</p>
            <p style={{ margin: "0.25rem 0", fontWeight: 600, fontSize: "1.1rem" }}>82212</p>
            <p className="text-muted" style={{ margin: 0, fontSize: "0.85rem" }}>Sales and marketing activities (including telemarketing)</p>
          </div>
          <div>
            <p className="text-muted" style={{ margin: 0, fontSize: "0.85rem" }}>Line of Business</p>
            <p style={{ margin: "0.25rem 0", fontWeight: 600, fontSize: "1.1rem" }}>Branding Consultant</p>
            <p className="text-muted" style={{ margin: 0, fontSize: "0.85rem" }}>Professional consulting services</p>
          </div>
        </div>
      </div>

      {/* Filing Calendar */}
      <div className="card" style={{ marginTop: "2rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
        <h3 style={{ margin: 0 }}>2025-2026 Filing Calendar</h3>
        <p className="text-muted" style={{ margin: 0 }}>Your upcoming tax filing obligations based on your business activities</p>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "0.5rem" }}>
          {/* Quarterly Filings */}
          <div style={{
            padding: "1rem",
            borderRadius: "0.75rem",
            background: "rgba(193, 97, 26, 0.08)",
            border: "1px solid rgba(193, 97, 26, 0.25)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <strong style={{ fontSize: "1.05rem", color: "#8b3921" }}>Form 1701Q - Quarterly Income Tax</strong>
              <span style={{
                padding: "0.25rem 0.75rem",
                borderRadius: "999px",
                background: "#c1611a",
                color: "#fff",
                fontSize: "0.75rem",
                fontWeight: 600
              }}>QUARTERLY</span>
            </div>
            <p className="text-muted" style={{ margin: "0.5rem 0", fontSize: "0.9rem" }}>Filing start date: August 27, 2025</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.75rem" }}>
              <div style={{ padding: "0.5rem", background: "rgba(255,255,255,0.6)", borderRadius: "0.5rem" }}>
                <strong>1st Quarter:</strong> On or before May 15
              </div>
              <div style={{ padding: "0.5rem", background: "rgba(255,255,255,0.6)", borderRadius: "0.5rem" }}>
                <strong>2nd Quarter:</strong> On or before August 15
              </div>
              <div style={{
                padding: "0.5rem",
                background: "rgba(179, 50, 27, 0.1)",
                borderRadius: "0.5rem",
                border: "2px solid rgba(179, 50, 27, 0.35)"
              }}>
                <strong style={{ color: "#b3321b" }}>3rd Quarter:</strong> <span style={{ color: "#b3321b", fontWeight: 600 }}>On or before November 15, 2025</span>
                <p style={{ margin: "0.25rem 0 0", fontSize: "0.85rem", color: "#b3321b" }}>⚠ UPCOMING DEADLINE</p>
              </div>
            </div>
          </div>

          {/* Annual Filing */}
          <div style={{
            padding: "1rem",
            borderRadius: "0.75rem",
            background: "rgba(47, 125, 79, 0.08)",
            border: "1px solid rgba(47, 125, 79, 0.25)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <strong style={{ fontSize: "1.05rem", color: "#2f7d4f" }}>Form 1701/1701A/1701MS - Annual Income Tax</strong>
              <span style={{
                padding: "0.25rem 0.75rem",
                borderRadius: "999px",
                background: "#2f7d4f",
                color: "#fff",
                fontSize: "0.75rem",
                fontWeight: 600
              }}>YEARLY</span>
            </div>
            <p className="text-muted" style={{ margin: "0.5rem 0", fontSize: "0.9rem" }}>Filing start date: January 1, 2026</p>
            <div style={{ padding: "0.5rem", background: "rgba(255,255,255,0.6)", borderRadius: "0.5rem", marginTop: "0.75rem" }}>
              <strong>Due Date:</strong> On or before April 15, 2026
              <p style={{ margin: "0.25rem 0 0", fontSize: "0.85rem" }}>For calendar year 2025 income</p>
            </div>
          </div>
        </div>
      </div>

      {/* Compliance Reminders */}
      <div className="card" style={{ marginTop: "2rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
        <h3 style={{ margin: 0 }}>Compliance Reminders</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {complianceReminders.map((reminder) => {
            const priorityColors = {
              high: { bg: "rgba(179, 50, 27, 0.12)", border: "rgba(179, 50, 27, 0.35)", text: "#b3321b" },
              medium: { bg: "rgba(212, 160, 23, 0.12)", border: "rgba(212, 160, 23, 0.35)", text: "#d4a017" },
              low: { bg: "rgba(139, 57, 33, 0.08)", border: "rgba(139, 57, 33, 0.25)", text: "#8b3921" }
            };
            const colors = priorityColors[reminder.priority];

            return (
              <div
                key={reminder.title}
                style={{
                  padding: "0.75rem 1rem",
                  borderRadius: "0.75rem",
                  background: colors.bg,
                  border: `1px solid ${colors.border}`
                }}
              >
                <strong style={{ color: colors.text }}>{reminder.title}</strong>
                <p style={{ margin: "0.25rem 0 0", fontSize: "0.9rem", color: "#6f4d3d" }}>{reminder.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Form Guides */}
      <div className="card" style={{ marginTop: "2rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
        <h3 style={{ margin: 0 }}>BIR Form Filing Guides</h3>
        <p className="text-muted" style={{ margin: 0 }}>
          Select a form below to view detailed field-by-field guidance and online filing instructions
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", marginTop: "0.5rem" }}>
          {formGuides.map((guide) => (
            <button
              key={guide.form}
              onClick={() => {
                setSelectedForm(guide.form);
                setShowOnlineGuide(false);
              }}
              style={{
                padding: "1rem",
                borderRadius: "0.75rem",
                border: selectedForm === guide.form ? "2px solid #8b3921" : "1px solid rgba(139,57,33,0.28)",
                background: selectedForm === guide.form ? "rgba(139, 57, 33, 0.12)" : "rgba(247,234,218,0.7)",
                color: "#3f2216",
                fontWeight: 600,
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.2s ease"
              }}
            >
              <div style={{ fontSize: "1.1rem", marginBottom: "0.25rem" }}>Form {guide.form}</div>
              <div style={{ fontSize: "0.85rem", fontWeight: 400, color: "#6f4d3d" }}>{guide.filingSchedule}</div>
            </button>
          ))}
        </div>

        {selectedFormData && (
          <div style={{ marginTop: "1rem", padding: "1.5rem", borderRadius: "0.75rem", background: "rgba(255,255,255,0.7)", border: "1px solid rgba(139,57,33,0.15)" }}>
            <h4 style={{ margin: "0 0 0.75rem", color: "#8b3921" }}>{selectedFormData.title}</h4>
            <p style={{ margin: "0 0 1rem", fontSize: "0.95rem", color: "#6f4d3d" }}>{selectedFormData.description}</p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
              <div>
                <p style={{ margin: "0 0 0.25rem", fontSize: "0.8rem", textTransform: "uppercase", color: "#8b3921", fontWeight: 600 }}>When to Use</p>
                <p style={{ margin: 0, fontSize: "0.9rem" }}>{selectedFormData.whenToUse}</p>
              </div>
              <div>
                <p style={{ margin: "0 0 0.25rem", fontSize: "0.8rem", textTransform: "uppercase", color: "#8b3921", fontWeight: 600 }}>Due Date</p>
                <p style={{ margin: 0, fontSize: "0.9rem", fontWeight: 600 }}>{selectedFormData.dueDate}</p>
              </div>
            </div>

            <div style={{ marginBottom: "1.5rem" }}>
              <p style={{ margin: "0 0 0.5rem", fontSize: "0.9rem", fontWeight: 600, color: "#8b3921" }}>Key Fields to Complete:</p>
              <ul style={{ margin: 0, paddingLeft: "1.5rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                {selectedFormData.keyFields.map((field, index) => (
                  <li key={index} style={{ fontSize: "0.9rem", color: "#6f4d3d" }}>{field}</li>
                ))}
              </ul>
            </div>

            <button
              onClick={() => setShowOnlineGuide(!showOnlineGuide)}
              style={{
                padding: "0.75rem 1.25rem",
                borderRadius: "0.75rem",
                border: "none",
                background: "linear-gradient(135deg, #8b3921, #c0694d)",
                color: "#fffaf5",
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 12px 24px rgba(139, 57, 33, 0.25)"
              }}
            >
              {showOnlineGuide ? "Hide" : "Show"} Online Filing Steps
            </button>

            {showOnlineGuide && (
              <div style={{ marginTop: "1.5rem", padding: "1rem", borderRadius: "0.75rem", background: "rgba(47, 125, 79, 0.08)", border: "1px solid rgba(47, 125, 79, 0.25)" }}>
                <h5 style={{ margin: "0 0 1rem", color: "#2f7d4f" }}>How to File {selectedFormData.form} Online</h5>
                <ol style={{ margin: 0, paddingLeft: "1.5rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {selectedFormData.onlineFilingSteps.map((step, index) => (
                    <li key={index} style={{ fontSize: "0.9rem", color: "#3f2216", lineHeight: 1.5 }}>{step}</li>
                  ))}
                </ol>

                <div style={{ marginTop: "1.5rem", padding: "1rem", borderRadius: "0.5rem", background: "rgba(139, 57, 33, 0.08)" }}>
                  <p style={{ margin: "0 0 0.5rem", fontWeight: 600, color: "#8b3921" }}>Online Filing Resources:</p>
                  <ul style={{ margin: 0, paddingLeft: "1.5rem" }}>
                    <li style={{ marginBottom: "0.25rem" }}>
                      <a href="https://www.bir.gov.ph" target="_blank" rel="noopener noreferrer" style={{ color: "#8b3921", fontWeight: 600 }}>
                        BIR Official Website
                      </a> - Download eBIRForms
                    </li>
                    <li style={{ marginBottom: "0.25rem" }}>
                      <strong>eFPS (Electronic Filing and Payment System)</strong> - For registered users
                    </li>
                    <li style={{ marginBottom: "0.25rem" }}>
                      <strong>Payment Channels:</strong> Authorized agent banks, GCash, PayMaya, online banking
                    </li>
                    <li>
                      <strong>Helpdesk:</strong> Call BIR Contact Center at 8538-3200 for technical support
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick Tips */}
      <div className="card" style={{ marginTop: "2rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
        <h3 style={{ margin: 0 }}>Quick Filing Tips</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
          <div style={{ padding: "1rem", borderRadius: "0.75rem", background: "rgba(247,234,218,0.7)" }}>
            <strong style={{ color: "#8b3921" }}>📝 Recommended Form for You</strong>
            <p style={{ margin: "0.5rem 0 0", fontSize: "0.9rem" }}>
              Use <strong>Form 1701MS</strong> for annual filing if your gross receipts are under ₱3M. It's simpler and allows you to use the Optional Standard Deduction (40% of gross).
            </p>
          </div>
          <div style={{ padding: "1rem", borderRadius: "0.75rem", background: "rgba(247,234,218,0.7)" }}>
            <strong style={{ color: "#8b3921" }}>💰 Deduction Strategy</strong>
            <p style={{ margin: "0.5rem 0 0", fontSize: "0.9rem" }}>
              Compare Optional Standard Deduction (40%) vs. Itemized Deductions. Track all expenses - if they exceed 40% of gross receipts, itemize for bigger tax savings.
            </p>
          </div>
          <div style={{ padding: "1rem", borderRadius: "0.75rem", background: "rgba(247,234,218,0.7)" }}>
            <strong style={{ color: "#8b3921" }}>🔐 Register for eFPS</strong>
            <p style={{ margin: "0.5rem 0 0", fontSize: "0.9rem" }}>
              Register at your RDO for eFPS access. It's faster than the regular eBIRForms system and provides instant Filing Reference Numbers.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
