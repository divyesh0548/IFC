const crypto = require('crypto');

function generateDeficiencyResponseId() {
  const randomPart = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `DR${Date.now()}${randomPart}`.slice(0, 30);
}

function normalizeNullableText(value) {
  if (value == null) return null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
}

function normalizeDateOnly(value) {
  if (value == null) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;
  const datePart = normalized.length >= 10 ? normalized.slice(0, 10) : normalized;
  return /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : null;
}

function isPastDateOnly(value) {
  const datePart = normalizeDateOnly(value);
  if (!datePart) return false;
  const todayPart = new Date().toISOString().slice(0, 10);
  return datePart < todayPart;
}

function validateMitigationPlanDueDate(dueDate) {
  const normalizedDueDate = normalizeDateOnly(dueDate);
  if (!normalizedDueDate) {
    return { ok: false, message: 'Due date is required for mitigation plan' };
  }
  if (isPastDateOnly(normalizedDueDate)) {
    return { ok: false, message: 'Due date must be today or a future date' };
  }
  return { ok: true, normalizedDueDate };
}

async function getDeficiencyResponseByFormId(clientOrPool, formId) {
  const parentResult = await clientOrPool.query(
    `
      SELECT *
      FROM deficiency_response
      WHERE form_id = $1
      LIMIT 1
    `,
    [formId]
  );

  if (parentResult.rows.length === 0) {
    return null;
  }

  const parent = parentResult.rows[0];
  const submissionsResult = await clientOrPool.query(
    `
      SELECT *
      FROM deficiency_response_submission
      WHERE deficiency_response_id = $1
      ORDER BY version_no DESC, id DESC
    `,
    [parent.id]
  );

  const submissions = submissionsResult.rows;
  const submissionIds = submissions.map((row) => row.id);
  let attachmentsBySubmissionId = new Map();

  if (submissionIds.length > 0) {
    const attachmentsResult = await clientOrPool.query(
      `
        SELECT *
        FROM deficiency_response_attachment
        WHERE submission_id = ANY($1::int[])
        ORDER BY id ASC
      `,
      [submissionIds]
    );

    attachmentsBySubmissionId = attachmentsResult.rows.reduce((map, row) => {
      const key = row.submission_id;
      const current = map.get(key) || [];
      current.push({
        id: row.id,
        submission_id: row.submission_id,
        file_url: row.file_url,
        original_name: row.original_name,
        uploaded_by_email: row.uploaded_by_email,
        created_at: row.created_at,
      });
      map.set(key, current);
      return map;
    }, new Map());
  }

  const normalizedSubmissions = submissions.map((row) => ({
    id: row.id,
    deficiency_response_id: row.deficiency_response_id,
    version_no: row.version_no,
    submission_type: row.submission_type,
    status: row.status,
    submitted_by_email: row.submitted_by_email,
    submitted_at: row.submitted_at,
    reviewed_by_email: row.reviewed_by_email,
    reviewed_at: row.reviewed_at,
    review_decision: row.review_decision,
    review_comment: row.review_comment,
    explaination: row.explaination,
    due_date: row.due_date,
    concerned_person: row.concerned_person,
    created_at: row.created_at,
    attachments: attachmentsBySubmissionId.get(row.id) || [],
  }));

  const currentSubmission =
    normalizedSubmissions.find((row) => Number(row.version_no) === Number(parent.current_version))
    || normalizedSubmissions[0]
    || null;

  return {
    id: parent.id,
    response_id: parent.response_id,
    form_id: parent.form_id,
    company_identifier: parent.company_identifier,
    unit_id: parent.unit_id,
    response_type: parent.response_type,
    status: parent.status,
    submitted_by_email: parent.submitted_by_email,
    submitted_at: parent.submitted_at,
    reviewed_by_email: parent.reviewed_by_email,
    reviewed_at: parent.reviewed_at,
    review_decision: parent.review_decision,
    review_comment: parent.review_comment,
    current_version: parent.current_version,
    explaination: parent.explaination,
    due_date: parent.due_date,
    concerned_person: parent.concerned_person,
    created_at: parent.created_at,
    updated_at: parent.updated_at,
    current_submission: currentSubmission,
    submissions: normalizedSubmissions,
  };
}

async function createOrResubmitDeficiencyResponse(client, payload) {
  const {
    formId,
    companyIdentifier,
    unitId,
    responseType,
    explaination,
    dueDate,
    concernedPerson,
    submittedByEmail,
    attachments,
  } = payload;

  const normalizedExplaination = normalizeNullableText(explaination);
  const normalizedDueDate = normalizeDateOnly(dueDate);
  const normalizedConcernedPerson = normalizeNullableText(concernedPerson);
  const normalizedAttachments = Array.isArray(attachments)
    ? attachments
      .map((item) => ({
        file_url: normalizeNullableText(item?.file_url),
        original_name: normalizeNullableText(item?.original_name),
      }))
      .filter((item) => item.file_url)
    : [];

  const existingResult = await client.query(
    `
      SELECT *
      FROM deficiency_response
      WHERE form_id = $1
      LIMIT 1
      FOR UPDATE
    `,
    [formId]
  );

  let deficiencyResponseId;
  let currentVersion = 1;
  let responseId;

  if (existingResult.rows.length === 0) {
    responseId = generateDeficiencyResponseId();
    const insertParentResult = await client.query(
      `
        INSERT INTO deficiency_response (
          response_id,
          form_id,
          company_identifier,
          unit_id,
          response_type,
          status,
          submitted_by_email,
          submitted_at,
          current_version,
          explaination,
          due_date,
          concerned_person,
          created_at,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, 'submitted', $6,
          (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
          1, $7, $8, $9,
          (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
          (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
        )
        RETURNING id, response_id
      `,
      [
        responseId,
        formId,
        companyIdentifier || null,
        unitId || null,
        responseType,
        submittedByEmail,
        normalizedExplaination,
        normalizedDueDate,
        normalizedConcernedPerson,
      ]
    );
    deficiencyResponseId = insertParentResult.rows[0].id;
    responseId = insertParentResult.rows[0].response_id;
  } else {
    const current = existingResult.rows[0];
    deficiencyResponseId = current.id;
    responseId = current.response_id;
    currentVersion = Number(current.current_version || 0) + 1;
    await client.query(
      `
        UPDATE deficiency_response
        SET response_type = $2,
            status = 'submitted',
            submitted_by_email = $3,
            submitted_at = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
            reviewed_by_email = NULL,
            reviewed_at = NULL,
            review_decision = NULL,
            review_comment = NULL,
            current_version = $4,
            explaination = $5,
            due_date = $6,
            concerned_person = $7,
            updated_at = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
        WHERE id = $1
      `,
      [
        deficiencyResponseId,
        responseType,
        submittedByEmail,
        currentVersion,
        normalizedExplaination,
        normalizedDueDate,
        normalizedConcernedPerson,
      ]
    );
  }

  const submissionVersion = currentVersion;
  const submissionResult = await client.query(
    `
      INSERT INTO deficiency_response_submission (
        deficiency_response_id,
        version_no,
        submission_type,
        status,
        submitted_by_email,
        submitted_at,
        explaination,
        due_date,
        concerned_person,
        created_at
      )
      VALUES (
        $1, $2, $3, 'submitted', $4,
        (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
        $5, $6, $7,
        (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
      )
      RETURNING id
    `,
    [
      deficiencyResponseId,
      submissionVersion,
      responseType,
      submittedByEmail,
      normalizedExplaination,
      normalizedDueDate,
      normalizedConcernedPerson,
    ]
  );

  const submissionId = submissionResult.rows[0].id;

  for (const attachment of normalizedAttachments) {
    await client.query(
      `
        INSERT INTO deficiency_response_attachment (
          submission_id,
          file_url,
          original_name,
          uploaded_by_email,
          created_at
        )
        VALUES (
          $1, $2, $3, $4,
          (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
        )
      `,
      [submissionId, attachment.file_url, attachment.original_name, submittedByEmail]
    );
  }

  return {
    id: deficiencyResponseId,
    response_id: responseId,
    submission_id: submissionId,
    version_no: submissionVersion,
  };
}

module.exports = {
  createOrResubmitDeficiencyResponse,
  generateDeficiencyResponseId,
  getDeficiencyResponseByFormId,
  normalizeDateOnly,
  normalizeNullableText,
  isPastDateOnly,
  validateMitigationPlanDueDate,
};
