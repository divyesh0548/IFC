const { isDevelopment } = require('./node_env');

function isCompanyDeleteEnabled() {
  return isDevelopment();
}

/**
 * Remove one company and every row stored for it.
 * Control children are deleted explicitly because several foreign keys only set form_id to null.
 * Company-level rows with no foreign key, and rows that would only be nulled, are deleted here too.
 */
async function deleteCompanyAndRelatedRows(tx, companyIdentifier) {
  const companyId = String(companyIdentifier || '').trim();
  if (!companyId) return;

  await tx.$executeRaw`
    DELETE FROM deficiency_response_attachment
    WHERE submission_id IN (
      SELECT s.id
      FROM deficiency_response_submission s
      INNER JOIN deficiency_response r ON r.id = s.deficiency_response_id
      WHERE r.company_identifier = ${companyId}
         OR r.form_id IN (
           SELECT form_id FROM control_forms
           WHERE company_identifier = ${companyId} AND form_id IS NOT NULL
         )
    )
  `;
  await tx.$executeRaw`
    DELETE FROM deficiency_response_submission
    WHERE deficiency_response_id IN (
      SELECT id FROM deficiency_response
      WHERE company_identifier = ${companyId}
         OR form_id IN (
           SELECT form_id FROM control_forms
           WHERE company_identifier = ${companyId} AND form_id IS NOT NULL
         )
    )
  `;
  await tx.$executeRaw`
    DELETE FROM deficiency_response
    WHERE company_identifier = ${companyId}
       OR form_id IN (
         SELECT form_id FROM control_forms
         WHERE company_identifier = ${companyId} AND form_id IS NOT NULL
       )
  `;
  await tx.$executeRaw`
    DELETE FROM change_request_item
    WHERE change_request_id IN (
      SELECT id FROM change_request
      WHERE company_identifier = ${companyId}
         OR form_id IN (
           SELECT form_id FROM control_forms
           WHERE company_identifier = ${companyId} AND form_id IS NOT NULL
         )
    )
  `;
  await tx.$executeRaw`
    DELETE FROM change_request
    WHERE company_identifier = ${companyId}
       OR form_id IN (
         SELECT form_id FROM control_forms
         WHERE company_identifier = ${companyId} AND form_id IS NOT NULL
       )
  `;
  await tx.$executeRaw`
    DELETE FROM process_owner_declaration
    WHERE form_id IN (
      SELECT form_id FROM control_forms
      WHERE company_identifier = ${companyId} AND form_id IS NOT NULL
    )
  `;
  await tx.$executeRaw`
    DELETE FROM controls_reminder
    WHERE form_id IN (
      SELECT form_id FROM control_forms
      WHERE company_identifier = ${companyId} AND form_id IS NOT NULL
    )
  `;
  await tx.$executeRaw`DELETE FROM design_gap_insights WHERE company_identifier = ${companyId}`;
  await tx.$executeRaw`
    DELETE FROM racm_field_values
    WHERE form_id IN (
      SELECT form_id FROM control_forms
      WHERE company_identifier = ${companyId} AND form_id IS NOT NULL
    )
  `;
  await tx.$executeRaw`
    DELETE FROM sample_docs
    WHERE form_id IN (
      SELECT form_id FROM control_forms
      WHERE company_identifier = ${companyId} AND form_id IS NOT NULL
    )
  `;
  await tx.$executeRaw`
    DELETE FROM racm_docs
    WHERE form_id IN (
      SELECT form_id FROM control_forms
      WHERE company_identifier = ${companyId} AND form_id IS NOT NULL
    )
  `;
  await tx.$executeRaw`
    DELETE FROM control_form_history
    WHERE form_id IN (
      SELECT form_id FROM control_forms
      WHERE company_identifier = ${companyId} AND form_id IS NOT NULL
    )
  `;
  await tx.$executeRaw`
    DELETE FROM audit_logs_racm
    WHERE form_id IN (
      SELECT form_id FROM control_forms
      WHERE company_identifier = ${companyId} AND form_id IS NOT NULL
    )
       OR user_email_id IN (
         SELECT email_id FROM ifc_users WHERE company_identifier = ${companyId}
       )
  `;
  await tx.$executeRaw`
    DELETE FROM key_manual_ai_insights_row_data WHERE company_identifier = ${companyId}
  `;
  await tx.$executeRaw`
    DELETE FROM key_manual_ai_insights_run_table rt
    WHERE rt.company_identifier = ${companyId}
      AND NOT EXISTS (
        SELECT 1 FROM key_manual_ai_insights_row_data r WHERE r.run_id = rt.id
      )
  `;
  // Older databases may not yet have the optional automatic-analysis queue.
  const riskJobTable = await tx.$queryRaw`SELECT to_regclass('public.risk_analysis_jobs') AS name`;
  if (riskJobTable[0]?.name) {
    await tx.$executeRaw`DELETE FROM risk_analysis_jobs WHERE company_identifier = ${companyId}`;
  }
  await tx.$executeRaw`DELETE FROM risk_analysis WHERE company_identifier = ${companyId}`;
  await tx.$executeRaw`DELETE FROM risk_analysis_concise_lists WHERE company_identifier = ${companyId}`;
  await tx.$executeRaw`DELETE FROM risk_analysis_overall_missing_risks WHERE company_identifier = ${companyId}`;
  await tx.$executeRaw`DELETE FROM risk_analysis_business_process_overviews WHERE company_identifier = ${companyId}`;
  await tx.$executeRaw`DELETE FROM approver_assignments WHERE company_identifier = ${companyId}`;
  await tx.$executeRaw`DELETE FROM racm_cc_users WHERE company_identifier = ${companyId}`;
  await tx.$executeRaw`DELETE FROM company_email_templates WHERE company_identifier = ${companyId}`;
  await tx.$executeRaw`DELETE FROM company_frequency_sample_size WHERE company_identifier = ${companyId}`;
  await tx.$executeRaw`
    DELETE FROM audit_logs
    WHERE user_email_id IN (
      SELECT email_id FROM ifc_users WHERE company_identifier = ${companyId}
    )
  `;
  await tx.$executeRaw`
    DELETE FROM user_query
    WHERE LOWER(TRIM(user_email_id)) IN (
      SELECT LOWER(TRIM(email_id)) FROM ifc_users WHERE company_identifier = ${companyId}
    )
  `;
  await tx.$executeRaw`
    UPDATE control_forms
    SET template_id = NULL
    WHERE template_id IN (
      SELECT id FROM racm_templates WHERE company_identifier = ${companyId}
    )
      AND company_identifier IS DISTINCT FROM ${companyId}
  `;
  await tx.$executeRaw`
    UPDATE racm_templates
    SET copied_from_template_id = NULL
    WHERE copied_from_template_id IN (
      SELECT id FROM racm_templates WHERE company_identifier = ${companyId}
    )
  `;
  await tx.$executeRaw`DELETE FROM control_forms WHERE company_identifier = ${companyId}`;
  await tx.$executeRaw`
    DELETE FROM ifc_users
    WHERE company_identifier = ${companyId}
      AND LOWER(TRIM(COALESCE(role, ''))) <> 'siteadmin'
  `;
  await tx.$executeRaw`DELETE FROM business_process_master WHERE company_identifier = ${companyId}`;
  await tx.$executeRaw`DELETE FROM racm_excel_column_mappings WHERE company_identifier = ${companyId}`;
  await tx.$executeRaw`
    DELETE FROM racm_field_values
    WHERE template_field_id IN (
      SELECT f.id
      FROM racm_template_fields f
      INNER JOIN racm_templates t ON t.id = f.template_id
      WHERE t.company_identifier = ${companyId}
    )
  `;
  await tx.$executeRaw`
    DELETE FROM racm_template_fields
    WHERE template_id IN (
      SELECT id FROM racm_templates WHERE company_identifier = ${companyId}
    )
  `;
  await tx.$executeRaw`DELETE FROM racm_templates WHERE company_identifier = ${companyId}`;
  await tx.$executeRaw`DELETE FROM user_unit_memberships WHERE company_identifier = ${companyId}`;
  await tx.$executeRaw`DELETE FROM coordinator_unit_assignments WHERE company_identifier = ${companyId}`;
  await tx.$executeRaw`DELETE FROM company_unit_master WHERE company_identifier = ${companyId}`;
  await tx.$executeRaw`DELETE FROM companies WHERE company_identifier = ${companyId}`;
}

module.exports = {
  isCompanyDeleteEnabled,
  deleteCompanyAndRelatedRows,
};
