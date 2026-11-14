Automatic risk analysis after bulk Excel import

Deploy migration `20261114120000_risk_analysis_jobs` using the normal Prisma migration workflow, then restart the Node backend. Do not reset the database. Resolve any older pending/failed migration first; the queue migration does not modify companies or existing risk results.

The coordinator explicitly selects Yes or No before import. Both automatic and custom column mapping carry the choice to `/api/control-forms/bulk-import-rows`. Only a successful import with Yes creates a job, inside the same transaction. A savepoint isolates queue errors from control creation and returns a warning if enqueueing fails.

The Node scheduler checks every five seconds. PostgreSQL's existing global AI advisory lock serializes jobs across backend instances and coordinates with manual AI operations. Each job holds that lock across the same shared operations used by the manual buttons: generate/store the concise list, then generate/store overall missing risks for the company, unit and business process. Imports and unrelated requests do not wait for the model. Manual AI requests retain their existing busy response while a background job owns the lock.

Eligible jobs run oldest first. Failures retry after 30 seconds, up to three attempts, allowing other eligible jobs to proceed. Interrupted running jobs resume on the next worker tick after the old database session releases its lock. Every attempt rechecks coordinator unit access and uses the current controls. An update to controls during generation causes regeneration rather than saving an outdated overall result. A browser can be closed without losing its queued request.

The upload and Risk Analysis pages poll authorized queue status every ten seconds. Completed results use the existing Risk Analysis → Overall missing risks section, scoped by unit and business process. Completion refreshes the concise and overall result sections when that page is open. Jobs that exhaust retries show a failure message and the manual recovery path; imported controls stay in place. AI dry-run mode produces a failed job explaining that real generation must be enabled, rather than a false success.

Validation: `node --test --test-isolation=none tests/risk-analysis-jobs.test.cjs tests/risk-analysis-import.test.cjs tests/risk-analysis-workflow.test.cjs tests/racm-bulk-import.test.cjs`.
