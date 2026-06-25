function normalizeText(value) {
  return String(value || '').trim();
}

const APPROVER_ASSIGNMENT_PRECEDENCE_SQL = `
  CASE aa.assignment_scope
    WHEN 'RACM' THEN 1
    WHEN 'BUSINESS_PROCESS' THEN 2
    WHEN 'UNIT' THEN 3
    ELSE 4
  END
`;

function buildResolvedApproverLateralSubquery(formAlias = 'cf') {
  return `
    SELECT
      aa.approver_email_id,
      aa.assignment_scope
    FROM approver_assignments aa
    WHERE aa.company_identifier = ${formAlias}.company_identifier
      AND (
        (aa.assignment_scope = 'RACM' AND aa.form_id = ${formAlias}.form_id)
        OR (
          aa.assignment_scope = 'BUSINESS_PROCESS'
          AND aa.unit_id = ${formAlias}.unit_id
          AND LOWER(TRIM(COALESCE(aa.business_process, ''))) = LOWER(TRIM(COALESCE(${formAlias}.business_process, '')))
        )
        OR (aa.assignment_scope = 'UNIT' AND aa.unit_id = ${formAlias}.unit_id)
      )
    ORDER BY
      ${APPROVER_ASSIGNMENT_PRECEDENCE_SQL},
      aa.created_at DESC,
      aa.id DESC
    LIMIT 1
  `;
}

function buildScopedApproverJoinSql(formAlias = 'cf', emailParam = '$1', resolvedAlias = 'resolved_approver') {
  return `
    INNER JOIN LATERAL (
      ${buildResolvedApproverLateralSubquery(formAlias)}
    ) ${resolvedAlias}
      ON LOWER(TRIM(${resolvedAlias}.approver_email_id)) = LOWER(TRIM(${emailParam}))
  `;
}

async function resolveApproverForRacm(clientOrPool, {
  companyIdentifier,
  unitId,
  businessProcess,
  formId,
}) {
  const result = await clientOrPool.query(
    `
      SELECT
        aa.approver_email_id AS approver_email_id,
        aa.assignment_scope,
        approver.id AS approver_user_id,
        NULLIF(TRIM(approver.emp_name), '') AS approver_name,
        approver.temp_login AS approver_temp_login,
        COALESCE(NULLIF(TRIM(approver.emp_name), ''), aa.approver_email_id) AS approver_display_name
      FROM approver_assignments aa
      LEFT JOIN ifc_users approver
        ON LOWER(TRIM(approver.email_id)) = LOWER(TRIM(aa.approver_email_id))
       AND approver.company_identifier = aa.company_identifier
      WHERE aa.company_identifier = $1
        AND (
          (aa.assignment_scope = 'RACM' AND aa.form_id = $2)
          OR (
            aa.assignment_scope = 'BUSINESS_PROCESS'
            AND aa.unit_id = $4
            AND LOWER(TRIM(aa.business_process)) = LOWER(TRIM($3))
          )
          OR (aa.assignment_scope = 'UNIT' AND aa.unit_id = $4)
        )
      ORDER BY
        ${APPROVER_ASSIGNMENT_PRECEDENCE_SQL},
        aa.created_at DESC,
        aa.id DESC
      LIMIT 1
    `,
    [
      normalizeText(companyIdentifier),
      normalizeText(formId),
      normalizeText(businessProcess),
      normalizeText(unitId),
    ]
  );

  return result.rows[0] || null;
}

async function getControlFormApproverDetails(clientOrPool, formId) {
  const formResult = await clientOrPool.query(
    `
      SELECT form_id, control_owner, company_identifier, unit_id, business_process
      FROM control_forms
      WHERE form_id = $1
      LIMIT 1
    `,
    [formId]
  );

  const form = formResult.rows[0] || null;
  if (!form) return null;

  const approver = await resolveApproverForRacm(clientOrPool, {
    companyIdentifier: form.company_identifier,
    unitId: form.unit_id,
    businessProcess: form.business_process,
    formId: form.form_id,
  });

  return {
    ...form,
    approver_email_id: approver?.approver_email_id || null,
    approver_user_id: approver?.approver_user_id || null,
    approver_name: approver?.approver_name || null,
    approver_temp_login: approver?.approver_temp_login || null,
    approver_display_name: approver?.approver_display_name || approver?.approver_email_id || null,
    approver_assignment_scope: approver?.assignment_scope || null,
  };
}

module.exports = {
  buildResolvedApproverLateralSubquery,
  buildScopedApproverJoinSql,
  resolveApproverForRacm,
  getControlFormApproverDetails,
};
