const { pool } = require('./db');
const { sendEmail } = require('./send_email');
const { getCoordinatorEmailForUnit } = require('./deficiency_response_notifications');
const { buildRacmDetailsSection } = require('./racm_email_details');
const { buildCoordinatorFormDetailUrl } = require('./racm_coordinator_assignment');
const { buildUserFormDetailUrl } = require('./racm_status_user_email');

const CHANGE_REQUEST_EMAIL_LOCK_KEY = 9043310;
const CHANGE_REQUEST_REVIEW_EMAIL_LOCK_KEY = 9043311;

let schemaReadyPromise = null;

async function ensureChangeRequestCoordinatorEmailSchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = pool.query(`
      ALTER TABLE change_request
        ADD COLUMN IF NOT EXISTS coordinator_email_sent BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS coordinator_email_sent_at TIMESTAMP(6),
        ADD COLUMN IF NOT EXISTS requester_review_email_sent BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS requester_review_email_sent_at TIMESTAMP(6)
    `).catch((error) => {
      schemaReadyPromise = null;
      throw error;
    });
  }

  await schemaReadyPromise;
}

function buildChangeRequestCoordinatorEmail(changeRequest) {
  const controlNumber = String(changeRequest.control_number || '').trim()
    || String(changeRequest.form_id || '').trim()
    || 'N/A';
  const businessProcess = String(changeRequest.business_process || '').trim() || 'Business Process';
  const requester = String(changeRequest.requested_by_email || '').trim() || 'Process Owner';
  const reason = String(changeRequest.request_reason || '').trim();
  const coordinatorUrl = buildCoordinatorFormDetailUrl(changeRequest.form_id);

  const requestLines = [
    'Change Request Details:',
    `- Request ID: ${String(changeRequest.request_id || '').trim() || 'N/A'}`,
    `- Requested By: ${requester}`,
    `- Fields Requested for Change: ${Number(changeRequest.change_item_count || 0)}`,
  ];
  if (reason) requestLines.push(`- Reason: ${reason}`);

  let text = 'Dear Coordinator,\n\n';
  text += 'A process owner has requested changes to a RACM. Please review the request.\n\n';
  text += `${buildRacmDetailsSection(changeRequest, [
    ['Control Number', controlNumber],
    ['Unit', changeRequest.unit_id],
  ])}\n\n`;
  text += `${requestLines.join('\n')}\n\n`;
  text += 'Please review the requested field changes on Strata.\n\n';
  if (coordinatorUrl) text += `RACM Link : ${coordinatorUrl}\n\n`;
  text += 'Best regards,\nStrata';

  return {
    subject: `RACM change request: Control ${controlNumber} - ${businessProcess}`,
    text,
  };
}

function buildChangeRequestReviewEmail(changeRequest) {
  const controlNumber = String(changeRequest.control_number || '').trim()
    || String(changeRequest.form_id || '').trim()
    || 'N/A';
  const businessProcess = String(changeRequest.business_process || '').trim() || 'Business Process';
  const status = String(changeRequest.status || '').trim() || 'Reviewed';
  const reviewerComment = String(changeRequest.reviewer_comment || '').trim();
  const userUrl = buildUserFormDetailUrl(changeRequest.form_id);

  const reviewLines = [
    'Review Summary:',
    `- Request ID: ${String(changeRequest.request_id || '').trim() || 'N/A'}`,
    `- Outcome: ${status}`,
    `- Approved Fields: ${Number(changeRequest.approved_item_count || 0)}`,
    `- Rejected Fields: ${Number(changeRequest.rejected_item_count || 0)}`,
  ];
  if (reviewerComment) reviewLines.push(`- Coordinator Comment: ${reviewerComment}`);

  let text = 'Dear Process Owner,\n\n';
  text += 'Your RACM change request has been reviewed by the coordinator.\n\n';
  text += `${buildRacmDetailsSection(changeRequest, [
    ['Control Number', controlNumber],
    ['Unit', changeRequest.unit_id],
  ])}\n\n`;
  text += `${reviewLines.join('\n')}\n\n`;
  text += 'Please review the completed request on Strata.\n\n';
  if (userUrl) text += `RACM Link : ${userUrl}\n\n`;
  text += 'Best regards,\nStrata';

  return {
    subject: `RACM change request ${status.toLowerCase()}: Control ${controlNumber} - ${businessProcess}`,
    text,
  };
}

async function getPendingChangeRequestCoordinatorEmails(requestId = null) {
  const params = [];
  const requestFilter = requestId ? 'AND cr.request_id = $1' : '';
  if (requestId) params.push(String(requestId).trim());

  const result = await pool.query(
    `
      SELECT
        cr.id,
        cr.request_id,
        cr.form_id,
        cr.company_identifier,
        cr.unit_id,
        cr.requested_by_email,
        cr.request_reason,
        cf.control_number,
        cf.business_process,
        cf.financial_year,
        COALESCE(item_counts.change_item_count, 0)::int AS change_item_count
      FROM change_request cr
      INNER JOIN control_forms cf
        ON cf.form_id = cr.form_id
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS change_item_count
        FROM change_request_item
        WHERE change_request_id = cr.id
      ) item_counts ON TRUE
      WHERE cr.status = 'Review Pending'
        AND COALESCE(cr.coordinator_email_sent, FALSE) = FALSE
        ${requestFilter}
      ORDER BY cr.requested_at ASC NULLS LAST, cr.id ASC
    `,
    params
  );

  return result.rows;
}

async function runPendingChangeRequestCoordinatorEmails({ requestId = null } = {}) {
  await ensureChangeRequestCoordinatorEmailSchema();

  const client = await pool.connect();
  let hasJobLock = false;
  try {
    const lock = await client.query('SELECT pg_try_advisory_lock($1) AS locked', [CHANGE_REQUEST_EMAIL_LOCK_KEY]);
    hasJobLock = lock.rows[0]?.locked === true;
    if (!hasJobLock) return { sent: 0, skipped: true };

    const pendingRequests = await getPendingChangeRequestCoordinatorEmails(requestId);
    let sent = 0;

    for (const changeRequest of pendingRequests) {
      const coordinatorEmail = await getCoordinatorEmailForUnit(
        changeRequest.company_identifier,
        changeRequest.unit_id
      );
      if (!coordinatorEmail) {
        console.warn(`[change-request-email] No coordinator assigned for request ${changeRequest.request_id}; notification remains pending.`);
        continue;
      }

      const payload = buildChangeRequestCoordinatorEmail(changeRequest);
      const emailSent = await sendEmail(coordinatorEmail, payload.subject, payload.text);
      if (!emailSent) {
        console.warn(`[change-request-email] Failed notification for request ${changeRequest.request_id}; it will retry.`);
        continue;
      }

      const updated = await client.query(
        `
          UPDATE change_request
          SET coordinator_email_sent = TRUE,
              coordinator_email_sent_at = CURRENT_TIMESTAMP AT TIME ZONE 'UTC',
              updated_at = CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
          WHERE id = $1
            AND COALESCE(coordinator_email_sent, FALSE) = FALSE
          RETURNING id
        `,
        [changeRequest.id]
      );
      if (updated.rows.length > 0) {
        sent += 1;
        console.log(`[change-request-email] Coordinator notification sent for request ${changeRequest.request_id}.`);
      }
    }

    return { sent, skipped: false };
  } finally {
    if (hasJobLock) {
      try {
        await client.query('SELECT pg_advisory_unlock($1)', [CHANGE_REQUEST_EMAIL_LOCK_KEY]);
      } catch (error) {
        client.release(error);
        return;
      }
    }
    client.release();
  }
}

async function getPendingChangeRequestReviewEmails(requestId = null) {
  const params = [];
  const requestFilter = requestId ? 'AND cr.request_id = $1' : '';
  if (requestId) params.push(String(requestId).trim());

  const result = await pool.query(
    `
      SELECT
        cr.id,
        cr.request_id,
        cr.form_id,
        cr.unit_id,
        cr.requested_by_email,
        cr.status,
        cr.reviewer_comment,
        cf.control_number,
        cf.business_process,
        cf.financial_year,
        COALESCE(item_counts.approved_item_count, 0)::int AS approved_item_count,
        COALESCE(item_counts.rejected_item_count, 0)::int AS rejected_item_count
      FROM change_request cr
      INNER JOIN control_forms cf
        ON cf.form_id = cr.form_id
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (WHERE status = 'Approved')::int AS approved_item_count,
          COUNT(*) FILTER (WHERE status = 'Rejected')::int AS rejected_item_count
        FROM change_request_item
        WHERE change_request_id = cr.id
      ) item_counts ON TRUE
      WHERE cr.status IN ('Approved', 'Rejected', 'Partially approved')
        AND COALESCE(cr.requester_review_email_sent, FALSE) = FALSE
        ${requestFilter}
      ORDER BY cr.reviewed_at ASC NULLS LAST, cr.id ASC
    `,
    params
  );

  return result.rows;
}

async function runPendingChangeRequestReviewEmails({ requestId = null } = {}) {
  await ensureChangeRequestCoordinatorEmailSchema();

  const client = await pool.connect();
  let hasJobLock = false;
  try {
    const lock = await client.query('SELECT pg_try_advisory_lock($1) AS locked', [CHANGE_REQUEST_REVIEW_EMAIL_LOCK_KEY]);
    hasJobLock = lock.rows[0]?.locked === true;
    if (!hasJobLock) return { sent: 0, skipped: true };

    const pendingRequests = await getPendingChangeRequestReviewEmails(requestId);
    let sent = 0;

    for (const changeRequest of pendingRequests) {
      const requesterEmail = String(changeRequest.requested_by_email || '').trim();
      if (!requesterEmail) {
        console.warn(`[change-request-review-email] No requester email for request ${changeRequest.request_id}; notification remains pending.`);
        continue;
      }

      const payload = buildChangeRequestReviewEmail(changeRequest);
      const emailSent = await sendEmail(requesterEmail, payload.subject, payload.text);
      if (!emailSent) {
        console.warn(`[change-request-review-email] Failed notification for request ${changeRequest.request_id}; it will retry.`);
        continue;
      }

      const updated = await client.query(
        `
          UPDATE change_request
          SET requester_review_email_sent = TRUE,
              requester_review_email_sent_at = CURRENT_TIMESTAMP AT TIME ZONE 'UTC',
              updated_at = CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
          WHERE id = $1
            AND COALESCE(requester_review_email_sent, FALSE) = FALSE
          RETURNING id
        `,
        [changeRequest.id]
      );
      if (updated.rows.length > 0) {
        sent += 1;
        console.log(`[change-request-review-email] Process owner notification sent for request ${changeRequest.request_id}.`);
      }
    }

    return { sent, skipped: false };
  } finally {
    if (hasJobLock) {
      try {
        await client.query('SELECT pg_advisory_unlock($1)', [CHANGE_REQUEST_REVIEW_EMAIL_LOCK_KEY]);
      } catch (error) {
        client.release(error);
        return;
      }
    }
    client.release();
  }
}

module.exports = {
  ensureChangeRequestCoordinatorEmailSchema,
  runPendingChangeRequestCoordinatorEmails,
  runPendingChangeRequestReviewEmails,
  buildChangeRequestCoordinatorEmail,
  buildChangeRequestReviewEmail,
};
