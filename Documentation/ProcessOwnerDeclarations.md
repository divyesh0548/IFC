# Process-owner declarations

## Types and stages

- **No Submission Available** (`no_submission_available`): Before a RACM is submitted, when no transaction/event occurred. The RACM must be active and have no pending change request.
- **No Further Submission** (`no_further_submission`): For a Rejected or Not Effective RACM when the owner cannot submit more. It is not limited to the final-reminder stage.

Both declarations are sent to the approver for a conclusion. The approver cannot reject a declaration.

## Database and reminder behavior

The declaration row stores `form_id`, `no_furthure_submission = TRUE`, `declaration_type`, `declaration_confirmed`, `owner_comment`, `process_owner_email`, and `timestamp`. The RACM is set to `status = 'sent for approval'`; `sent_for_approval_timestamp`, `approver_due_date`, and `updated_at` are updated, and deficiency-action fields are cleared. `controls_reminder.reminder_to_approver_datetime` is reset; ineffective and deficiency-review reminder dates are cleared.

The submission and ineffective-owner reminder jobs, and the automatic-failure task, exclude declarations using `no_furthure_submission`. The regular reminder timestamps/count are not cleared by the declaration itself; the flag and `sent for approval` status prevent it being treated as pending owner work. The approver reminder job handles it while it awaits a conclusion.
