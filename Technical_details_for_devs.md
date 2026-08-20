# Technical details for developers

## Due dates vs timestamps

Most event timestamps in the app are stored and compared in **UTC**.

**Why not UTC for soting due dates?**  
A pure UTC date can shift the calendar day near midnight relative to India (~5:30 hour offset). Using IST keeps “business day” due dates aligned with Indian operations.

## Important columns on `control_forms`

### 1. `approval_status_change_timestamp`

- **Purpose:** UTC timestamp of the last approval-status change.
- **Updated when:** Approver **Approves** or **Rejects** (approver flows).

### 2. `user_mail_sent`

- **Purpose:** Whether the process-owner “RACM Active / assignment ready” email was already sent.
- **Updated when:**
  - Set to `false` on process-owner assign/reassign, activate, or transfer from self-assignment.
  - Set to `true` after the active-user email background script sends successfully.
- **Note:** Email also requires other conditions (e.g. Active, valid owner, not coordinator self-assigned).

### 3. `inactive_mail_pending`

- **Purpose:** Queue flag for the “RACM set Inactive” email to the process owner.
- **Updated when:**
  - Set to `true` when an Active RACM with a real process owner is set **Inactive** (not for coordinator self-assigned RACMs).
  - Set to `false` after the inactive email is sent, or when the RACM is set Active again / self-assigned.

### 4. `deficiency_action_status`

- **Purpose:** Whether the process owner (or coordinator) still needs to act on a deficiency (`boolean`).
- **Updated when:**
  - `true` — Approved as **Not Effective**, or deficiency review requests **resubmission**.
  - `false` — Owner submits a response, declares no further submission, or review closes the action.

### 5. `deficiency_response_status`

- **Purpose:** Text stage of the deficiency workflow (`VARCHAR`).
- **Typical values:** `awaiting_owner_action`, `submitted_for_review`, `resubmission_required`, `not_required`, or `null`.
- **Updated when:** Same deficiency lifecycle as `deficiency_action_status`.

### 6. `approver_due_date`

- **Purpose:** Calendar date after which approver reminder emails may start.
- **Set to:** IST today + `APPROVER_DUE_DAYS`.
- **Updated when:** RACM is **Sent for Approval** (seeded); cleared when that reminder cycle is reset.

### 7. `deficiency_review_due_date`

- **Purpose:** Calendar date after which reminder emails to the approver for reviewing a deficiency response may start.
- **Set to:** IST today + `DEFICIENCY_REVIEW_DUE_DAYS`.
- **Updated when:** Owner submits a deficiency response (`submitted_for_review`); cleared after that review finishes / reset.

### 8. `ineffective_due_date`

- **Purpose:** Calendar date after which reminder emails for an ineffective / deficiency-open RACM may start.
- **Set to:** IST today + `INEFFECTIVE_DUE_DAYS`.
- **Updated when:** Approved as **Not Effective** (or resubmission required); cleared when the deficiency action is closed / reset.







# Control dispersion dashboard

This dashboard provides statistical info of controls all over the company not unit. 
