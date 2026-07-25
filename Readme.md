# IFC Prisma — Technical Documentation

## Purpose

This platform digitizes the **Internal Financial Controls (IFC)** process for organizations. It replaces fragmented spreadsheet- and paper-driven control work with a multi-tenant web system that supports:

- Centralized RACM (Risk and Control Matrix) lifecycle management
- Role-scoped ownership, review, and approval with a durable audit trail
- Transparent assignment of process owners, coordinators, and approvers by unit / business process / RACM
- Document and evidence storage against controls
- Deficiency response (mitigation / compensatory plan) workflows after ineffective conclusions
- Scheduled reminder emails for pending submissions and reviews
- Optional LLM-assisted control rationalisation and risk analysis

The goal is **central trail management**, **process transparency**, and **reduced paperwork** while keeping IFC work attributable to the correct people and units.

---

## High-Level Architecture

| Layer | Technology | Role |
|--------|------------|------|
| Frontend | React 19, Vite 7, MUI 7, Tailwind CSS 4, React Router 7 | Role-scoped SPA; cookie-authenticated API calls |
| Backend | Node.js, Express 5 | REST API under `/api`, static hosting of `frontend/dist` in production |
| ORM / DB access | Prisma 7 (`@prisma/adapter-pg`) + `pg` pool | Schema/migrations via Prisma; many handlers also use raw SQL |
| Database | PostgreSQL | Multi-tenant data keyed primarily by `company_identifier` |
| Object storage | AWS S3 (`@aws-sdk/client-s3`) | RACM documents, samples, deficiency attachments, Excel uploads |
| Email | Nodemailer (SMTP) | Login, reminders, assignment, approval, deficiency notifications |
| LLM | Ollama HTTP chat API | Key-manual AI insights and risk analysis |
| Auth crypto | JWT + AES-256-GCM cookie wrapper, bcryptjs + pepper | Session tokens and password hashing |

Monorepo layout:

- `frontend/` — Vite React application
- `backend/` — Express API, Prisma schema/migrations, AI scripts, scheduled jobs
- `backend/generated/prisma/` — generated Prisma client output

---

## Technology Stack (Detail)

### Frontend

- **React 19** + **Vite 7** for SPA build and HMR
- **MUI 7** (+ Icons, X Charts, X Date Pickers) for UI components
- **Tailwind CSS 4** for utility styling alongside MUI
- **React Router 7** for nested, role-prefixed routes with lazy-loaded pages
- **dayjs** for date handling with MUI LocalizationProvider
- **react-hot-toast** for notifications
- **xlsx** for Excel export / sample-required downloads in the UI

API access uses native `fetch` with `credentials: 'include'` and `apiUrl()` from `frontend/src/config/api.js` (`VITE_BACKEND_URL`).

### Backend

- **Express 5** mounts routers under `/api` (`backend/app.js` → `backend/routes/index.js`)
- **Prisma 7** models PostgreSQL tables; client generated to `backend/generated/prisma`
- **`pg` Pool** (`backend/utils/db.js`) shared with Prisma adapter for transactional and raw-SQL paths
- **multer** for multipart uploads (memory) before S3 persistence
- **jsonwebtoken**, **bcryptjs**, custom AES token encryption (`backend/utils/auth_utility.js`)

### Integrations

- **AWS S3** — documents organized by company / unit / process / form paths
- **SMTP** — Gmail-compatible or other SMTP via env
- **Ollama** — local or remote LLM chat endpoint for structured JSON outputs

---

## Multi-Tenancy and Domain Model

Tenancy is company-scoped via `companies.company_identifier`. Users (`ifc_users`) belong to a company and have a `role`. Operational structure:

| Concept | Storage | Notes |
|---------|---------|--------|
| Company | `companies` | Tenant root |
| Unit | `company_unit_master` | Factory / office units under a company |
| Process owner membership | `user_unit_memberships` | Links `role=user` emails to units |
| Coordinator ↔ unit | `coordinator_unit_assignments` | Required for `company_co` login and unit access |
| Approver ↔ scope | `approver_assignments` | Scope: `UNIT`, `BUSINESS_PROCESS`, or `RACM` (form-specific) |
| RACM / control | `control_forms` | Unique `(company_identifier, control_number)` |
| Reminder state | `controls_reminder` | Last-sent timestamps + form due-date columns |
| Deficiency response | `deficiency_response*` | Mitigation / compensatory plans and review |
| Templates | `racm_templates`, fields, values | Dynamic RACM schemas per unit |
| Audit | `audit_logs`, `audit_logs_racm` | App/session vs per-RACM trail |
| AI runs | `key_manual_ai_insights_*`, `risk_analysis` | LLM outputs |

Core RACM fields include status (`Pending`, `sent for approval`, `Approved`, `Rejected`), design conclusion, due dates (`due_date`, `approver_due_date`, `ineffective_due_date`, `deficiency_review_due_date`), deficiency flags, and coordinator self-assignment markers.

---

## Authentication

### Login (`POST /api/auth/login`)

Implemented in `backend/routes/auth.js`:

1. Resolve user by `email_id` in `ifc_users`.
2. Verify password with `verifyPassword` (`backend/utils/password.js`): bcrypt hash of `password + PASSWORD_HASH_PEPPER`. Legacy plaintext passwords are upgraded to hashed form on successful login.
3. Enforce allowed roles: `user`, `company_admin`, `company_co`, `approver`, `siteadmin`, `auditor`.
4. **Assignment gate:** `company_co` must have at least one `coordinator_unit_assignments` row; `approver` must have at least one `approver_assignments` row. Otherwise login fails with 403 (account exists but is not yet assigned).
5. Issue JWT (`JWT_SECRET`) with payload `{ email_id, id, role, iat }` and expiry from `AUTH_SESSION_DURATION_HOURS` (default 4 hours).
6. Encrypt JWT with AES-256-GCM (`ENCRYPTION_KEY`, 64-char hex) via `encryptToken`.
7. Set httpOnly cookie `authToken` (`secure` in production, `sameSite: 'lax'`).
8. Write audit event for login.

Related endpoints: `/api/auth/verify`, `/profile`, `/logout`, `/forgot-password` (temp password + email), `/update-password`.

### Password hashing

- `PASSWORD_HASH_PEPPER` + `BCRYPT_ROUNDS` (default 12)
- Temp passwords can be stored encrypted for resend / bootstrap flows

### Frontend session behavior

- Login uses `credentials: 'include'`; JWT is **not** stored in `localStorage`.
- `localStorage` only caches non-secret UI context (company name/id, display name, profile cache).
- `frontend/src/utils/authSession.js` patches `window.fetch` so API **401** responses clear client auth state and redirect to `/login` (except login / forgot-password / verify).
- Logout calls `/api/auth/logout`, clears caches, and navigates to login.

---

## Authorization and Route Isolation

### Backend: role-mounted routers

`backend/routes/index.js` mounts APIs with dedicated middleware from `backend/modules/auth/auth.middleware.js`:

| Mount | Middleware | Role |
|-------|------------|------|
| `/api/siteadmin` | `verifySiteadminAuth` | `siteadmin` |
| `/api/company-admin` | `verifyCompanyAdmin` | `company_admin` |
| `/api/company-co` | `verifyCompanyCoordinator` | `company_co` (+ unit assignment) |
| `/api/approver` | `verifyApproverAuth` | `approver` (+ assignment) |
| `/api/auditor` | `verifyAuditorAuth` | `auditor` |
| `/api/control-forms` | Shared cookie verify; **handler-level** role/unit checks | Mixed |
| `/api/business-processes`, `/api/user-queries` | `verifyAuthenticatedUser` | Any authenticated role |
| `/api/stats` | `verifySiteadminAuth` | `siteadmin` |

Middleware decrypts and verifies the JWT from cookies (`authToken` and role-specific legacy names). Wrong role → **403**. Missing/invalid token → clear cookies → **401**.

Cross-role API access is primarily blocked by **not mounting** another role’s router under a different middleware. Shared RACM operations live under `/api/control-forms` and enforce company / unit / ownership / coordinator-map checks inside individual handlers (e.g. bulk import restricted to coordinators, owner-only deficiency submit, approver-scoped reviews).

### Frontend: role-prefixed trees

`frontend/src/App.jsx`:

- Each role area is a nested route under a path prefix (`/company_co`, `/company_admin`, `/user`, `/approver`, `/auditor`, `/siteadmin`).
- Parent route wraps children in `RoleBasedProtectedRoute` with `allowedRoles={[...]}` and shared `DashboardLayout`.
- Guard calls `GET /api/auth/verify` with cookies. Wrong role redirects to that user’s role home; unauthenticated users go to `/login`; `requiresPasswordUpdate` goes to `/update-password`.
- Pages are `React.lazy`-loaded; unknown subpaths redirect to the role home.

Role home map:

| Role | Home |
|------|------|
| `user` | `/user/home` |
| `company_co` | `/company_co/home` |
| `company_admin` | `/company_admin/home` |
| `approver` | `/approver/home` |
| `auditor` | `/auditor/home` |
| `siteadmin` | `/siteadmin/dashboard` |

This combination (cookie JWT + role middleware + frontend route guard) prevents users from loading another role’s SPA subtree or calling another role’s dedicated API namespace with a valid session of a different role.

---

## User Roles and Responsibilities (System View)

| Role | Purpose in the digital IFC process |
|------|-------------------------------------|
| **siteadmin** | Platform administration: companies, global business-process master, auditors, user queries, aggregate stats |
| **company_admin** | Company setup: units, coordinators/approvers, company BPs, company-wide RACM visibility and IFC reporting |
| **company_co** | Operational IFC owner: upload/create RACMs, templates, assign process owners/approvers, activate controls, documents, reminders config, AI insights, risk analysis, unit-scoped reports |
| **user** (process owner) | Execute assigned controls: remarks, evidence upload, send for approval, deficiency responses, change requests |
| **approver** | Review submitted RACMs and deficiency responses; approve/reject with design conclusions |
| **auditor** | Read-oriented visibility across companies, users, and RACMs/evidence for assurance |

Access to a specific RACM is further constrained by unit mapping (coordinator), assignment scope (approver), or `control_owner` / coordinator self-assign (process owner path).

---

## RACM Lifecycle (Technical)

Illustrative state machine (simplified):

1. **Create / import** — bulk Excel (`racm_bulk_import_from_rows.js`, column mapping) or manual create; optional dynamic template fields.
2. **Assign** — process owner (`control_owner` + unit membership) or coordinator self-assign; approver via `approver_assignments` (RACM / process / unit precedence).
3. **Activate** — `active` flag; reminder schedule (`due_date`, `reminder_frequency`).
4. **Submit for approval** — status `sent for approval`; seeds `approver_due_date` and clears last-sent approver reminder timestamp.
5. **Approve / Reject** — approver sets status and design conclusion; may open deficiency path when **Not Effective**.
6. **Deficiency** — owner submits mitigation/compensatory plan; status `submitted_for_review`; seeds deficiency-review due date; approver reviews.
7. **Reassignment locks** — blocked when sent for approval, Effective / Accepted Under Deviation, deficiency response pending review, or “no further submission” declared; allowed for Rejected and Not Effective (when resubmission is required / awaiting owner).

Supporting subsystems:

- **Change requests** — owner proposes field corrections; coordinator/approver review path
- **Process owner declaration** — no further submission; freezes further deficiency / resubmit actions in UI and backend
- **Sample required / sample size** — frequency-based config via `company_frequency_sample_size` and resolvers
- **Documents** — user uploads, sample docs, deficiency attachments in S3 with DB metadata

---

## Reminder and Notification Jobs

`backend/app.js` starts several **1-minute** `setInterval` jobs (poll cadence is fixed; due/interval logic is env-driven):

| Job | Script | Intent |
|-----|--------|--------|
| Owner submission reminders | `scripts/reminder_emails/reminder_emails.js` | Active RACMs pending owner action per `reminder_frequency` |
| Approver reminders | `approver_reminder_emails.js` | After `approver_due_date`, every `APPROVER_REMINDER_INTERVAL_DAYS` |
| Ineffective reminders | `ineffective_reminder_emails.js` | After `ineffective_due_date`, every `INEFFECTIVE_REMINDER_INTERVAL_DAYS` |
| Deficiency review reminders | `deficiency_review_reminder_emails.js` | After `deficiency_review_due_date`, every `DEFICIENCY_REVIEW_*` interval |
| Login emails | `login_email_sender.js` | New / pending user credentials |
| Active / inactive RACM mails | `racm_active_user_email_sender.js`, `racm_inactive_user_email_sender.js` | Assignment lifecycle |
| User queries | `user_query_email_sender.js` | Notify siteadmin |

**Design pattern for approver / ineffective / deficiency-review reminders:**

- Fixed **due date** column on `control_forms` (IST calendar date + `*_DUE_DAYS`)
- `controls_reminder.*_datetime` stores **last sent at** (UTC), not next trigger
- Eligibility: current IST date ≥ due date **and** (never sent **or** now ≥ last_sent + interval days)

Env knobs: `APPROVER_DUE_DAYS`, `APPROVER_REMINDER_INTERVAL_DAYS`, `INEFFECTIVE_DUE_DAYS`, `INEFFECTIVE_REMINDER_INTERVAL_DAYS`, `DEFICIENCY_REVIEW_DUE_DAYS`, `DEFICIENCY_REVIEW_REMINDER_INTERVAL_DAYS`.

---

## LLM Features

### Shared infrastructure

- Chat endpoint: `OLLAMA_CHAT_URL` (e.g. `http://localhost:11434/api/chat`)
- Model: `OLLAMA_MODEL`
- Optional: `OLLAMA_REQUEST_TIMEOUT_MS`, `OLLAMA_THINK`
- **Global AI lock:** PostgreSQL advisory lock (`backend/utils/ai_model_lock.js`) so only one heavy generation job runs at a time; concurrent requests receive **409** when busy

### Key Manual AI Insights

- Coordinator routes under `/api/company-co/ai-insights/key-manual-summary/*`
- Selects **Key + Manual** controls; **Entity Level Controls** are excluded from generation (count may be reported to the UI)
- Per-control call via `backend/ai_summary/key_manual_summary/ollama_client.js` producing structured rationalisation JSON
- Persisted as a run (`key_manual_ai_insights_run_table`) plus per-control rows (`key_manual_ai_insights_row_data`)
- UI: `frontend/src/pages/company_co/KeyManualAiInsightsSummary.jsx`

### Risk Analysis

- Coordinator routes under `/api/company-co/risk-analysis/*`
- Control access restricted to units in `coordinator_unit_assignments`
- Master risk catalog loaded from business-process-specific base data (e.g. CapEx JSON via `risk_analysis_master.js`)
- Ollama client matches sub-process / identifies missing risks (`backend/ai_summary/risk_analysis/ollama_client.js`)
- Results upserted into `risk_analysis` keyed by company + form
- UI: `frontend/src/pages/company_co/RiskAnalysis.jsx` (single and batch generate)

LLM outputs are **advisory**; they do not replace formal approval or audit sign-off in the RACM workflow.

---

## Document Storage (S3)

`backend/utils/s3Upload.js` provides upload, download, delete, and presigned access.

Typical layout (conceptual):

`{company}/{unit}/{business_process}/{form_id}/…`

with segregations for user evidence, sample documents, mitigation plans, and compensatory RACM attachments. Metadata is stored in tables such as `racm_docs`, `sample_docs`, and deficiency attachment tables.

Env: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_S3_BUCKET_NAME`.

---

## Email (SMTP)

`backend/utils/send_email.js` uses Nodemailer with `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, optional `SMTP_FROM`.

Used for authentication flows, RACM lifecycle notifications, reminders, and siteadmin user-query alerts. Frontend base links for deep links often use `VITE_FRONTEND_URL` / `FRONTEND_URL`.

---

## Frontend Application Structure

- Entry: `frontend/src/main.jsx` — ThemeProvider, LocalizationProvider, BrowserRouter
- Shell: `DashboardLayout` — AppBar, profile menu, theme toggle, logout confirmation, `<Outlet />`
- Theme: light/dark (`ThemeContext`), MUI palette and typography in `theme.js`
- Global loading: ref-counted `GlobalLoadingContext` + top progress strip while dashboards are busy
- Shared styling tokens: `uiConstants.js`

Pages are organized under `frontend/src/pages/{role}/…`. Large RACM editors (`FormDetail.jsx`, `UserFormDetail.jsx`, `ApproverFormDetail.jsx`, `AuditorFormDetail.jsx`) share field catalogs and helpers from `racmFormDetailFields.js`.

---

## Backend Application Structure

| Path | Responsibility |
|------|----------------|
| `backend/app.js` | Express bootstrap, CORS, cookies, `/api`, static SPA, schedulers |
| `backend/routes/` | HTTP routers per domain / role |
| `backend/controllers/` | Business logic per role |
| `backend/modules/auth/` | Cookie helpers + role middleware |
| `backend/utils/` | DB, auth, S3, email, RACM helpers, reminders, AI lock |
| `backend/ai_summary/` | Ollama clients + risk master data |
| `backend/scripts/` | Reminder / login / query email jobs |
| `backend/prisma/` | `schema.prisma` + SQL migrations |
| `backend/config/` | Bootstrap (admin seed, default BPs/templates), DB ensure |

Data access is **hybrid**: Prisma for many newer or transactional paths; raw `pool.query` / `$executeRaw` for complex joins and jobs.

---

## Audit Trail

- `utils/auditLog.js` writes application events (login, bulk upload, etc.) and RACM-scoped events
- Tables: `audit_logs`, `audit_logs_racm`
- Optional verbose / file fallback behavior controlled by env / util defaults

This supports the product goal of a **central, queryable trail** of who did what on which control.

---

## Environment Configuration (Names Only)

Common variables (see `backend/.env`; do not commit secrets):

**Database:** `DATABASE_URL`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`  
**Auth:** `JWT_SECRET`, `ENCRYPTION_KEY`, `AUTH_SESSION_DURATION_HOURS`, `PASSWORD_HASH_PEPPER`, `BCRYPT_ROUNDS`  
**Admin bootstrap:** `ADMIN_EMAIL_ID`, `ADMIN_PASSWORD`  
**AWS / SMTP / Ollama:** as listed above  
**Reminders:** `APPROVER_*`, `INEFFECTIVE_*`, `DEFICIENCY_REVIEW_*`  
**Frontend:** `VITE_BACKEND_URL`, `VITE_FRONTEND_URL`  
**Runtime:** `NODE_ENV`, `PORT`

---

## Local Development (Overview)

Typical flow:

1. Configure PostgreSQL and `backend/.env`
2. `npx prisma migrate deploy` / `prisma generate` in `backend/`
3. Start backend (`npm run dev` / `start`) — serves API and runs reminder timers
4. Start frontend Vite (`frontend/` → `npm run dev`) against `VITE_BACKEND_URL`
5. Optionally run Ollama locally if using AI features

Production mode can serve the built SPA from `frontend/dist` via Express.

---

## Design Principles Reflected in Code

1. **Tenant isolation** by `company_identifier` on virtually all business queries  
2. **Least privilege** via role routers + unit/assignment scoping  
3. **Durable evidence** in S3 + relational metadata  
4. **Lifecycle enforcement** in both API validators and UI disablement (reassignment locks, declaration, approval states)  
5. **Configurable reminder cadence** without rewriting next-fire timestamps when intervals change  
6. **Optional AI assist** behind a global lock, with human approval remaining authoritative  

---

## Repository Notes

- Prisma migrations live under `backend/prisma/migrations/`
- Some legacy or unused frontend files may exist outside the active `App.jsx` route tree; the wired protection path is `RoleBasedProtectedRoute` + `DashboardLayout`
- Dual cookie name support in middleware exists for historical role-specific cookies; primary session cookie is `authToken`
