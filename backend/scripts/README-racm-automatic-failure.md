# Automatic terminal RACM failure

`RACM_AUTO_FAIL_AFTER_FINAL_REMINDER_DAYS=1` in `backend/.env` controls the grace
period. One day means 24 hours after the recorded successful final reminder.
Use a positive integer and restart the Node backend after changing it. Invalid
values stop the failure check rather than failing controls early.

Both initial/rejected submission and Not Effective owner follow-up use
`REMINDER_FINAL_AFTER` normal reminders (currently 3), then one final reminder
at the next interval. Submission uses the RACM reminder frequency; Not Effective
uses `INEFFECTIVE_REMINDER_INTERVAL_DAYS`. Invalid recipients and failed sends
never count as sent reminders. Reminder senders hold separate PostgreSQL
advisory locks to avoid duplicate sends from overlapping schedulers/instances.

Rejection starts a new submission reminder cycle. Reassignment and submission schedule changes reset their cycle atomically with the control update. A new Not Effective decision
or rejected deficiency response starts a new ineffective cycle. Changing a
submission due date resets its submission cycle. Previously sent ineffective
reminders had no count, so their new capped cycles start counting from zero.

Every minute the worker atomically locks and checks eligible active RACMs,
marks their `control_design_conclusion` as `Failed`, clears deficiency action,
and records the previous conclusion, stage, final reminder time, grace period
and reason in the RACM audit log. Approval status and documents are preserved.
Submitted RACMs, submitted deficiency responses, no-further-submission
declarations, inactive RACMs and closed conclusions are excluded. Repeated
runs do not repeat the transition or audit entry. Existing submission final
timestamps remain valid; an already-expired qualifying cycle can fail on the
first scheduler run after deployment.

Failed is terminal: authenticated mutation routes reject writes, uploads,
declarations, reassignment and bulk changes. A database trigger also prevents
any update to an already-Failed control, protecting against racing requests.
There is intentionally no reopening or late-submission path. Failure is
displayed as a separate conclusion in the shared badges and IFC reports;
filters/exports which read database conclusions include it automatically.

Deploy `20261114160000_racm_automatic_failure`, regenerate Prisma, and restart
the backend. The migration adds two ineffective reminder tracking fields and
the terminal-update trigger. The conclusion column remains text. Before the migration is installed, the automatic-failure worker stays dormant and the existing uncapped ineffective reminders continue without claiming that failure is enabled.

Tests:

```powershell
node --test --test-isolation=none tests/racm-failure.test.cjs tests/racm-reminder-failure.test.cjs
$env:RUN_DB_TESTS='1'
node --test --test-isolation=none tests/racm-failure-db.test.cjs
```

The database test shadows public tables with temporary fixtures and rolls back
all test schema and data; it does not send emails or change real RACMs.
