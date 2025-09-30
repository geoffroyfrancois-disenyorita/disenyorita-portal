# Disenyorita & Isla Unified Operations Platform

## Executive Summary
This repository now ships with a working proof-of-concept. The FastAPI backend exposes a unified operations snapshot (cash runway, delivery risks, capacity alerts, monitoring incidents) and the Next.js front-end renders a control tower dashboard for both the studio and hospitality consulting teams. Below is a comprehensive product and technical specification for an all-in-one platform serving both Disenyorita (web/branding) and Isla (hospitality consulting). This blueprint is structured so ChatGPT Codex—or any development team—can translate it into production-grade code while emphasizing usability, modularity, and security.

## Core Product Modules

### 1. Identity & Access
- **Roles**: Super Admin, Business Admin (per brand), Project Manager, Consultant, Marketing Specialist, Finance Officer, Client.
- **Authentication**: Email/password with MFA, OAuth (Google/Microsoft), passwordless magic links.
- **Authorization**: RBAC with organization and client scoping; granular permissions per module.
- **Session Management**: JWTs with short-lived access tokens, refresh tokens stored httpOnly; SSO session revocation.

### 2. Client 360 & CRM
- Unified client records (contact data, segmentation, industry, communication preferences).
- Interaction timeline aggregating emails, portal messages, social DMs, support tickets.
- Document vault (contracts, proposals) with versioning and e-signature integration.
- Client portal: project dashboards, invoice viewing, ticket submission, knowledge base.

### 3. Project & Workflow Management
- Multi-template projects (web design, branding, hotel audit, restaurant rollout).
- Task hierarchies, dependencies, sprint/Kanban and Gantt views.
- Resource scheduling, capacity heatmaps, billable vs. non-billable hours.
- Automated workflows (onboarding sequences, deliverable approvals, QA checklists).
- Time tracking (manual entry, timers) tied to tasks and billing.

### 4. Support Desk & Communications
- Omni-channel inbox (email via IMAP/SMTP, integrated social APIs, in-portal chat).
- Ticket triage, SLA timers, canned responses, escalation paths.
- AI-assisted summarization and draft replies with human-in-the-loop validation.
- Knowledge base authoring, tagging, and client-facing search.

### 5. Financial Suite
- Estimates, proposals, contracts with e-sign.
- Invoice lifecycle, recurring billing, partial payments, credit notes.
- Expense capture, receipt OCR, project profitability, revenue forecasting.
- Sync with accounting systems (QuickBooks/Xero via webhooks & polling).
- Payment gateway integration (Stripe, PayPal) with PCI compliance delegation.
- **Quarterly tax maintenance**: update the TRAIN-law bracket table (`PH_TAX_BRACKETS`) and percentage/VAT logic in
  `backend/app/services/data.py` every quarter, then trigger a fresh automation digest snapshot to compare against archived
  filings.

### 6. HR & Resource Management
- Employee/contractor profiles, skills matrix, certifications, onboarding flows.
- Time-off requests, approval workflows, calendar sync.
- Performance notes, training assignments, document storage (NDAs, contracts).

### 7. Marketing & Campaign Operations
- Editorial calendar across channels (email, social, ads, events).
- Asset library with tagging, rights management, brand guideline enforcement.
- Social scheduling, performance analytics, sentiment tracking.
- UTM builder, integration with GA4/Meta/LinkedIn for attribution.

### 8. Monitoring & Automation
- Website uptime, SSL, domain expiry, core web vitals, SEO health checks.
- Alerting (email, SMS, in-app) with runbooks attached.
- Automated daily reports and anomaly detection on performance metrics.
- Integration hooks for RPA/scripts (e.g., push metrics into slides).

### 9. Analytics & Reporting
- Role-based dashboards (executive, PM, finance, marketing).
- Custom report builder with saved filters, scheduled exports (CSV, PDF).
- Embedded BI (Metabase/Looker) for advanced analytics.
- Predictive insights (churn risk, revenue forecasts, resource planning).

## System Architecture

### Frontend
- React/Next.js with TypeScript, modular design system, accessibility-first.
- State management (Redux Toolkit or Zustand), React Query/SWR for data fetching.
- SSR/ISR for SEO-sensitive pages; SPA behavior for app sections.
- Internationalization and theme support (brand-specific styling).
- Client portal isolated route with simplified UX.

### Backend
- Primary stack: Node.js (NestJS) or Python (Django/FastAPI) with TypeScript/Python typing.
- Modular domains: `auth`, `crm`, `projects`, `support`, `finance`, `marketing`, `monitoring`.
- REST + GraphQL hybrid API (GraphQL for dashboards, REST for integrations).
- WebSocket layer for real-time notifications, chat, live dashboards.
- Background workers (BullMQ/Celery) for email sync, monitoring jobs, report generation.

### Data Layer
- PostgreSQL for transactional data (schema per module, strict FK and constraints).
- Redis for caching, session blacklisting, rate limits, job queues.
- Elasticsearch/OpenSearch for full-text search across communications and knowledge base.
- Object storage (S3-compatible) for files, with signed URLs and antivirus scanning.
- Data warehouse (BigQuery/Redshift) fed via CDC for advanced analytics.

### Integrations & Middleware
- Integration microservices or adapters: email (Gmail/M365), social APIs, accounting, payment, monitoring services (UptimeRobot, Pingdom).
- Event bus (Kafka/SNS+SQS) to decouple ingestion and downstream processing.
- API gateway to enforce auth, throttling, logging.

## Data Model Highlights

| Domain | Key Entities |
|--------|--------------|
| Identity | `User`, `Role`, `Permission`, `Organization`, `Brand` |
| CRM | `Client`, `Contact`, `Interaction`, `Document`, `Segment` |
| Projects | `Project`, `Phase`, `Task`, `Subtask`, `TimeEntry`, `ResourceAllocation` |
| Support | `Ticket`, `Message`, `Channel`, `SLA`, `KnowledgeArticle` |
| Financials | `Estimate`, `Invoice`, `Payment`, `Expense`, `Budget`, `LedgerEntry` |
| HR | `Employee`, `Contractor`, `TimeOffRequest`, `Skill`, `TrainingModule` |
| Marketing | `Campaign`, `ContentItem`, `SocialPost`, `Asset`, `Metric` |
| Monitoring | `Site`, `Check`, `Alert`, `MetricSnapshot` |

Use UUID primary keys, soft deletion fields, auditing columns (`created_by`, `updated_by`, `deleted_at`).

## API Blueprint
- Versioned base path `/api/v1`.
- Authentication endpoints: `/auth/register`, `/auth/login`, `/auth/token/refresh`, `/auth/mfa`.
- CRUD endpoints per module with filtering, pagination, sorting.
- Bulk operations (e.g., `/projects/bulk-update-status`).
- Webhooks for external events (`/webhooks/email`, `/webhooks/accounting`, `/webhooks/monitoring`).
- GraphQL schema for dashboards: queries (`projectsByStatus`, `financialSummary`), subscriptions (`ticketUpdates`, `siteAlerts`).
- Rate limiting per token and IP; API keys for clients if exposing data.

## Automation & AI Assistance
- Intake automation: parse forms/emails to create structured client briefs.
- Task suggestions: template-based tasks auto-generated from project type.
- Support triage: classify tickets, suggest responders, auto-tag sentiment.
- Financial anomaly detection: flag invoices/payouts deviating from baseline.
- Marketing optimization: recommend publish times, repurpose high-performing content.
- Monitoring intelligence: root-cause hints, recommended playbooks.

## Security & Compliance Strategy

### Application Security
- Strict input validation, centralized error handling.
- CSP, XSS/CSRF protection, rate limiting, secure headers.
- Dependency scanning (Snyk, Dependabot) and SAST/DAST pipelines.

### Data Protection
- TLS 1.2+, HSTS, encryption at rest (database TDE, S3 SSE-KMS).
- Field-level encryption for sensitive PII.
- Secrets management (HashiCorp Vault/AWS Secrets Manager).
- Regular automated backups with retention policies and DR tests.

### Access Governance
- RBAC/ABAC enforcement, admin approval workflows for elevated permissions.
- Audit logging of sensitive actions (exports, permission changes, financial edits).
- Session anomaly detection (geo-velocity, failed login heuristics).

### Compliance
- GDPR-ready (consent logs, data subject requests workflow).
- SOC 2-style controls (change management, incident response).
- PCI DSS scope reduction by delegating payments to third parties.

### Operational Security
- Vulnerability management (monthly scans, annual pen tests).
- Incident response runbooks, on-call rotations.
- Secure SDLC: threat modeling, code reviews, security gates in CI/CD.

## DevOps & Quality
- **Infrastructure**: Terraform for IaC, Kubernetes (EKS/GKE) or ECS for deployment, load balancing, auto-scaling.
- **CI/CD**: GitHub Actions/GitLab CI with stages (lint, unit tests, integration, e2e, security scans). Canary releases with feature flags.
- **Observability**: Centralized logging (ELK/Datadog), metrics (Prometheus/Grafana), tracing (OpenTelemetry).
- **Testing Strategy**:
  - Unit tests (≥80% coverage on critical modules).
  - Contract tests for integrations.
  - End-to-end tests (Playwright/Cypress) covering portal flows.
  - Load testing for comms/monitoring spikes.
- **Documentation**: OpenAPI/GraphQL schema docs, architectural decision records, runbooks, onboarding guides.

## Implementation Roadmap

### Foundation (Sprint 0-2)
- Establish repo, CI/CD, IaC baseline.
- Implement auth, RBAC, tenant model, basic UX scaffolding.
- Set up monitoring/alerting for the platform itself.

### Core CRM & Projects (Sprint 3-6)
- Client records, project templates, task management, time tracking.
- Client portal MVP with ticket submission and project overview.

### Communications Hub (Sprint 7-10)
- Email/social integrations, unified inbox, knowledge base.
- Support ticket workflows, SLA automation.

### Financial Suite (Sprint 11-14)
- Estimates, invoices, expenses, accounting integration.
- Payment processing, financial dashboards.

### HR & Marketing Modules (Sprint 15-18)
- Resource management, time-off, skills tracking.
- Campaign planner, social scheduling, analytics.

### Monitoring & Automation Enhancements (Sprint 19-22)
- Website health checks, alerting, automated reports.
- AI-assisted features across tickets, marketing, operations.

### Hardening & Launch (Sprint 23-26)
- Performance optimization, security audits, compliance validation.
- User acceptance testing, documentation completion, go-live plan.

## Post-Launch Governance
- Quarterly security reviews and penetration tests.
- Monthly stakeholder roadmap reviews.
- Dedicated support SLA tiers for clients.
- Continuous improvement backlog (AI enhancements, marketplace integrations).

## Repository Structure

| Path | Description |
| --- | --- |
| `backend/` | FastAPI service exposing the REST endpoints described in this document. The current implementation uses an in-memory store to model the domain entities and can be swapped for a persistent database. |
| `frontend/` | Next.js 14 dashboard that consumes the backend API to render role-based workspaces for projects, CRM, finance, support, HR, marketing, and monitoring. |

Both applications ship with linting/tests and environment examples so the platform can be launched locally with:

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload

cd ../frontend
npm install
npm run dev
```

The frontend expects `NEXT_PUBLIC_API_BASE` (default `http://localhost:8000/api/v1`) and the backend reads `.env` values for secrets and CORS configuration. Replace the in-memory seed data with your production database of choice as the next milestone.

### Launch helper scripts

For convenience the repository provides wrapper scripts that set up dependencies and start both services together:

```bash
# macOS/Linux
./launch.sh

# Windows (PowerShell)
pwsh -File launch.ps1
```

Both scripts automatically create the backend virtual environment, install/update dependencies, load environment variables from any available `.env` files, and then run the FastAPI and Next.js development servers. When you are finished, press <kbd>Ctrl</kbd>+<kbd>C</kbd> in the same terminal and the scripts will shut down both processes cleanly.

## Testing
⚠️ Tests not run (planning document only).
