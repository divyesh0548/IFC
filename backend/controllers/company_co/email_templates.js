const { queryWithRetry } = require('../../utils/db');
const { utcTs } = require('../../utils/sqlUtcTimestamps');

async function getEmailTemplates(req, res) {
  try {
    const companyIdentifier = req.user?.company_identifier;
    if (!companyIdentifier) {
      return res.status(400).json({ success: false, message: 'Missing company identifier.' });
    }

    const unitsResult = await queryWithRetry(
      `SELECT cua.unit_id, cum.unit_name
       FROM coordinator_unit_assignments cua
       LEFT JOIN company_unit_master cum
         ON cum.company_identifier = cua.company_identifier AND cum.unit_id = cua.unit_id
       WHERE cua.company_identifier = $1
         AND LOWER(TRIM(cua.coordinator_email_id)) = LOWER(TRIM($2))
       ORDER BY cum.unit_name ASC NULLS LAST`,
      [companyIdentifier, req.user.email_id]
    );

    const unitIds = unitsResult.rows.map((r) => r.unit_id);
    let templates = [];
    if (unitIds.length > 0) {
      const templatesResult = await queryWithRetry(
        `SELECT
           id,
           company_identifier,
           unit_id,
           email_subject,
           email_body,
           ${utcTs('created_at')},
           ${utcTs('updated_at')}
         FROM company_email_templates
         WHERE company_identifier = $1 AND unit_id = ANY($2)
         ORDER BY updated_at DESC NULLS LAST`,
        [companyIdentifier, unitIds]
      );
      templates = templatesResult.rows;
    }

    return res.json({
      success: true,
      data: {
        units: unitsResult.rows,
        templates,
      },
    });
  } catch (error) {
    console.error('[email-templates] getEmailTemplates error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch email templates.' });
  }
}

async function upsertEmailTemplate(req, res) {
  try {
    const companyIdentifier = req.user?.company_identifier;
    if (!companyIdentifier) {
      return res.status(400).json({ success: false, message: 'Missing company identifier.' });
    }

    const { unit_id, email_subject, email_body } = req.body || {};
    const normalizedUnitId = String(unit_id || '').trim();
    if (!normalizedUnitId) {
      return res.status(400).json({ success: false, message: 'Unit is required.' });
    }

    const accessCheck = await queryWithRetry(
      `SELECT 1 FROM coordinator_unit_assignments
       WHERE company_identifier = $1
         AND LOWER(TRIM(coordinator_email_id)) = LOWER(TRIM($2))
         AND unit_id = $3
       LIMIT 1`,
      [companyIdentifier, req.user.email_id, normalizedUnitId]
    );
    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'You do not have access to this unit.' });
    }

    const result = await queryWithRetry(
      `INSERT INTO company_email_templates (company_identifier, unit_id, email_subject, email_body, created_at, updated_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP AT TIME ZONE 'UTC', CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
       ON CONFLICT (company_identifier, unit_id)
       DO UPDATE SET email_subject = EXCLUDED.email_subject,
                     email_body = EXCLUDED.email_body,
                     updated_at = CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
       RETURNING
         id,
         company_identifier,
         unit_id,
         email_subject,
         email_body,
         ${utcTs('created_at')},
         ${utcTs('updated_at')}`,
      [companyIdentifier, normalizedUnitId, email_subject ?? null, email_body ?? null]
    );

    return res.json({
      success: true,
      message: 'Email template saved successfully.',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('[email-templates] upsertEmailTemplate error:', error);
    return res.status(500).json({ success: false, message: 'Failed to save email template.' });
  }
}

async function deleteEmailTemplate(req, res) {
  try {
    const companyIdentifier = req.user?.company_identifier;
    if (!companyIdentifier) {
      return res.status(400).json({ success: false, message: 'Missing company identifier.' });
    }

    const unitId = String(req.params.unit_id || '').trim();
    if (!unitId) {
      return res.status(400).json({ success: false, message: 'Unit is required.' });
    }

    await queryWithRetry(
      `DELETE FROM company_email_templates
       WHERE company_identifier = $1 AND unit_id = $2`,
      [companyIdentifier, unitId]
    );

    return res.json({ success: true, message: 'Email template reset to default.' });
  } catch (error) {
    console.error('[email-templates] deleteEmailTemplate error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete email template.' });
  }
}

module.exports = { getEmailTemplates, upsertEmailTemplate, deleteEmailTemplate };
