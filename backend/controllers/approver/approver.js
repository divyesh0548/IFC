const { pool } = require('../../utils/db');
const { logAuditEvent } = require('../../utils/auditLog');
const { sendEmail } = require('../../utils/send_email');
const { getCcEmailsForRacm } = require('../../utils/racm_cc_recipients');
const {
  attachControlFormDocuments,
} = require('../../utils/racm_documents');

/** Stored in audit_logs_racm.ref_data when approver flips Approved/Rejected within the allowed window. */
const DECISION_CHANGE_AUDIT_REF = 'Change of decision by approver';

const APPROVAL_DECISION_CHANGE_WINDOW_MS = 15 * 24 * 60 * 60 * 1000;

async function getApproverMappedUnits(approverEmail) {
  const result = await pool.query(
    `
      SELECT
        cum.company_identifier,
        c.company_name,
        c.registered_email,
        c.registered_address,
        c.unique_identification_number,
        c.gst,
        c.pan,
        c.number_of_corporate_offices,
        c.number_of_factory_units,
        cum.unit_id,
        cum.unit_name,
        cum.unit_address
      FROM company_unit_master cum
      LEFT JOIN companies c
        ON c.company_identifier = cum.company_identifier
      WHERE LOWER(TRIM(COALESCE(cum.approver_email_id, ''))) = LOWER(TRIM($1))
      ORDER BY c.company_name NULLS LAST, cum.unit_name NULLS LAST, cum.unit_id
    `,
    [approverEmail]
  );

  return result.rows;
}

function scopedApproverRacmJoin(alias = 'cf') {
  return `
    INNER JOIN company_unit_master approver_units
      ON approver_units.company_identifier = ${alias}.company_identifier
     AND approver_units.unit_id = ${alias}.unit_id
     AND LOWER(TRIM(COALESCE(approver_units.approver_email_id, ''))) = LOWER(TRIM($1))
  `;
}

/**
 * Notify process owner of RACM Approved/Rejected (same content as initial approve/reject flow).
 */
async function notifyProcessOwnerRacmDecision(processOwnerEmail, form_id, status, reason_by_approver, updatedForm) {
  if (!processOwnerEmail || !String(processOwnerEmail).trim()) {
    console.warn(`⚠️  No process owner email found for form ${form_id}, email not sent`);
    return;
  }

  const ownerTrim = String(processOwnerEmail).trim();
  const statusText = status === 'Approved' ? 'approved' : 'rejected';
  const emailSubject = `Internal Financial Controls - RACM ${status}`;

  let processOwnerName = 'Control Owner';
  try {
    const ownerQuery = `
      SELECT emp_name
      FROM ifc_users
      WHERE LOWER(TRIM(email_id)) = LOWER(TRIM($1))
      LIMIT 1
    `;
    const ownerResult = await pool.query(ownerQuery, [ownerTrim]);
    const rawName = ownerResult.rows[0]?.emp_name;
    if (rawName && String(rawName).trim() !== '') {
      processOwnerName = String(rawName).trim();
    }
  } catch (nameError) {
    console.error('Error fetching control owner name for email notification:', nameError);
  }

  let companyName = '';
  try {
    const companyQuery = `
      SELECT c.company_name
      FROM ifc_users u
      INNER JOIN companies c ON u.company_identifier = c.company_identifier
      WHERE LOWER(TRIM(u.email_id)) = LOWER(TRIM($1))
      LIMIT 1
    `;
    const companyResult = await pool.query(companyQuery, [ownerTrim]);
    const rawCompanyName = companyResult.rows[0]?.company_name;
    if (rawCompanyName && String(rawCompanyName).trim() !== '') {
      companyName = String(rawCompanyName).trim();
    }
  } catch (companyError) {
    console.error('Error fetching company name for email notification:', companyError);
  }

  let emailBody = `Dear ${processOwnerName},\n\n`;
  emailBody += `Your RACM has been ${statusText}.\n\n`;

  if (reason_by_approver) {
    emailBody += `Reason/Comments from Approver:\n${reason_by_approver}\n\n`;
  }

  emailBody += 'Form Details:\n';
  if (updatedForm.business_process) {
    emailBody += `- Business Process: ${updatedForm.business_process}\n`;
  }
  if (updatedForm.sub_process) {
    emailBody += `- Sub Process: ${updatedForm.sub_process}\n`;
  }
  if (updatedForm.standard_control_description) {
    emailBody += `- Description: ${updatedForm.standard_control_description}\n`;
  }

  emailBody += '\n';

  if (status === 'Rejected') {
    emailBody += 'You can review the feedback above, uploade the necessary documents for it, and resubmit the RACM for approval.\n\n';
  }

  emailBody += 'Thank you for using the IFC system.\n\n';
  emailBody += `Best regards,\n${companyName}`;

  try {
    const ccEmails = await getCcEmailsForRacm({
      companyIdentifier: updatedForm.company_identifier,
      businessProcess: updatedForm.business_process,
      unitId: updatedForm.unit_id,
      excludeEmail: ownerTrim,
    });
    const emailSent = await sendEmail(ownerTrim, emailSubject, emailBody, { cc: ccEmails });
    if (emailSent) {
      console.log(`✓ Email sent successfully to ${ownerTrim} for form ${form_id}`);
    } else {
      console.error(`⚠️  Failed to send email to ${ownerTrim} for form ${form_id}`);
    }
  } catch (emailError) {
    console.error(`Error sending email to ${ownerTrim}:`, emailError);
  }
}

async function getHomeStats(req, res) {
  try {
    const approverEmail = req.user.email_id;
    const requestedUnitId = req.query.unit_id ? String(req.query.unit_id).trim() : '';
    const unitFilterSql = requestedUnitId ? ' AND cum.unit_id = $2' : '';
    const racmUnitFilterSql = requestedUnitId ? ' WHERE cf.unit_id = $2' : '';
    const scopedParams = requestedUnitId ? [approverEmail, requestedUnitId] : [approverEmail];

    const [
      approverResult,
      companyResult,
      mappedUnits,
      usersResult,
      racmStatsResult,
    ] = await Promise.all([
      pool.query(
        `
          SELECT NULLIF(TRIM(emp_name), '') AS emp_name
          FROM ifc_users
          WHERE email_id = $1
          LIMIT 1
        `,
        [approverEmail]
      ),
      pool.query(
        `
          SELECT
            c.company_identifier,
            c.company_name,
            c.registered_email,
            c.registered_address,
            c.unique_identification_number,
            c.gst,
            c.pan,
            c.number_of_corporate_offices,
            c.number_of_factory_units
          FROM ifc_users u
          LEFT JOIN companies c ON c.company_identifier = u.company_identifier
          WHERE u.email_id = $1
          LIMIT 1
        `,
        [approverEmail]
      ),
      getApproverMappedUnits(approverEmail),
      pool.query(
        `
          SELECT COUNT(DISTINCT u.id)::int AS count
          FROM company_unit_master cum
          INNER JOIN ifc_users u
            ON u.company_identifier = cum.company_identifier
           AND u.unit_id = cum.unit_id
           AND u.role = 'user'
          WHERE LOWER(TRIM(COALESCE(cum.approver_email_id, ''))) = LOWER(TRIM($1))
          ${unitFilterSql}
        `,
        scopedParams
      ),
      pool.query(
        `
        SELECT
          COUNT(DISTINCT cf.id) FILTER (
            WHERE cf.active IS NOT NULL AND cf.active != '' AND cf.active != '0'
          )::int AS active_racms,
          COUNT(DISTINCT cf.id) FILTER (
            WHERE cf.active IS NOT NULL AND cf.active != '' AND cf.active != '0'
              AND cf.status = 'Approved'
          )::int AS approved_racms,
          COUNT(DISTINCT cf.id) FILTER (
            WHERE cf.active IS NOT NULL AND cf.active != '' AND cf.active != '0'
              AND cf.status = 'Rejected'
          )::int AS rejected_racms,
          COUNT(DISTINCT cf.id) FILTER (
            WHERE cf.active IS NOT NULL AND cf.active != '' AND cf.active != '0'
              AND cf.status = 'sent for approval'
          )::int AS pending_racms,
          COUNT(DISTINCT cf.id) FILTER (
            WHERE cf.active IS NOT NULL AND cf.active != '' AND cf.active != '0'
              AND cf.status IN ('Approved', 'Rejected', 'sent for approval')
          )::int AS total_racms
        FROM control_forms cf
        ${scopedApproverRacmJoin('cf')}
        ${racmUnitFilterSql}
      `,
        scopedParams
      ),
    ]);

    const companyRow = companyResult.rows[0] || {};
    const firstMappedUnit = mappedUnits[0] || {};
    const companyDetails = {
      company_name: companyRow.company_name || firstMappedUnit.company_name || null,
      registered_email: companyRow.registered_email || firstMappedUnit.registered_email || null,
      registered_address: companyRow.registered_address || firstMappedUnit.registered_address || null,
      unique_identification_number:
        companyRow.unique_identification_number || firstMappedUnit.unique_identification_number || null,
      gst: companyRow.gst || firstMappedUnit.gst || null,
      pan: companyRow.pan || firstMappedUnit.pan || null,
      number_of_corporate_offices:
        companyRow.number_of_corporate_offices || firstMappedUnit.number_of_corporate_offices || null,
      number_of_factory_units:
        companyRow.number_of_factory_units || firstMappedUnit.number_of_factory_units || null,
    };

    res.status(200).json({
      success: true,
      data: {
        approver_name: approverResult.rows[0]?.emp_name || '',
        company_name: companyDetails.company_name || '',
        company_identifier: companyRow.company_identifier || firstMappedUnit.company_identifier || '',
        company_details: companyDetails,
        mapped_units: mappedUnits,
        total_units: mappedUnits.length,
        total_users: usersResult.rows[0]?.count || 0,
        total_active_racms: racmStatsResult.rows[0]?.active_racms || 0,
        total_approved_racms: racmStatsResult.rows[0]?.approved_racms || 0,
        total_rejected_racms: racmStatsResult.rows[0]?.rejected_racms || 0,
        total_pending_racms: racmStatsResult.rows[0]?.pending_racms || 0,
        total_racms: racmStatsResult.rows[0]?.total_racms || 0,
      },
    });
  } catch (error) {
    console.error('Approver home stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch approver home stats',
    });
  }
}

async function getDashboard(req, res) {
  try {
    const approver = req.approver;

    res.status(200).json({
      success: true,
      message: 'Dashboard data retrieved successfully',
      approver: {
        id: approver.id,
        email_id: approver.email_id,
      },
      data: {},
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
}

async function getPendingApprovals(req, res) {
  try {
    const approverEmail = req.approver.email_id;
    const requestedUnitId = req.query.unit_id ? String(req.query.unit_id).trim() : '';
    const query = `
      SELECT cf.*
      FROM control_forms cf
      ${scopedApproverRacmJoin('cf')}
      WHERE cf.status = 'sent for approval'
      ${requestedUnitId ? 'AND cf.unit_id = $2' : ''}
      ORDER BY cf.created_at DESC
    `;

    const result = await pool.query(query, requestedUnitId ? [approverEmail, requestedUnitId] : [approverEmail]);
    await attachControlFormDocuments(pool, result.rows);

    res.status(200).json({
      success: true,
      message: 'Pending approvals retrieved successfully',
      data: result.rows,
    });
  } catch (error) {
    console.error('Pending approvals error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
}

async function approveForm(req, res) {
  try {
    const { form_id } = req.params;
    const {
      status,
      reason_by_approver,
      control_design_procs,
      control_design_conclusion,
      design_deficiency_desc,
    } = req.body;
    const approver = req.approver;

    if (!status || !['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'status must be either "Approved" or "Rejected"',
      });
    }

    const approverReason = reason_by_approver != null ? String(reason_by_approver).trim() : '';
    if (status === 'Rejected' && !approverReason) {
      return res.status(400).json({
        success: false,
        message: 'Reason is required when rejecting.',
      });
    }

    const client = await pool.connect();
    let updatedForm;
    try {
      await client.query('BEGIN');

      if (status === 'Rejected') {
        await client.query(
          `
            INSERT INTO control_form_history (form_id, reason_by_approver, rejection_timestamp)
            VALUES ($1, $2, CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')
          `,
          [form_id, approverReason || null]
        );
      }

      const updateFields = ['status = $1', 'reason_by_approver = $2'];
      const updateValues = [status, approverReason || null];
      let paramIndex = 3;

      updateFields.push(`control_design_procs = $${paramIndex}`);
      updateValues.push(control_design_procs !== undefined ? control_design_procs : null);
      paramIndex++;

      updateFields.push(`control_design_conclusion = $${paramIndex}`);
      updateValues.push(control_design_conclusion !== undefined ? control_design_conclusion : null);
      paramIndex++;

      updateFields.push(`design_deficiency_desc = $${paramIndex}`);
      updateValues.push(design_deficiency_desc !== undefined ? design_deficiency_desc : null);
      paramIndex++;

      updateFields.push(
        'approval_status_change_timestamp = (CURRENT_TIMESTAMP AT TIME ZONE \'Asia/Kolkata\')'
      );

      updateValues.push(form_id);
      updateValues.push(approver.email_id);

      const updateQuery = `
        UPDATE control_forms 
        SET ${updateFields.join(', ')}
        WHERE form_id = $${paramIndex}
          AND EXISTS (
            SELECT 1
            FROM company_unit_master approver_units
            WHERE approver_units.company_identifier = control_forms.company_identifier
              AND approver_units.unit_id = control_forms.unit_id
              AND LOWER(TRIM(COALESCE(approver_units.approver_email_id, ''))) = LOWER(TRIM($${paramIndex + 1}))
          )
        RETURNING *
      `;

      const result = await client.query(updateQuery, updateValues);

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          message: 'RACM not found or not assigned to this approver',
        });
      }

      await client.query('COMMIT');
      updatedForm = result.rows[0];
    } catch (dbErr) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        console.error('Approve form rollback error:', rollbackErr);
      }
      console.error('Approve form DB error:', dbErr);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    } finally {
      client.release();
    }

    await attachControlFormDocuments(pool, [updatedForm]);
    const processOwnerEmail = updatedForm.control_owner;

    await notifyProcessOwnerRacmDecision(
      processOwnerEmail,
      form_id,
      status,
      approverReason,
      updatedForm
    );

    const action = status === 'Approved' ? 'RACM Approved' : 'RACM Rejected';
    await logAuditEvent(action, approver.email_id, form_id);

    res.status(200).json({
      success: true,
      message: `RACM ${status.toLowerCase()} successfully`,
      data: updatedForm,
    });
  } catch (error) {
    console.error('Approve form error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
}

async function changeApprovalDecision(req, res) {
  try {
    const { form_id } = req.params;
    const { status, reason_by_approver } = req.body;
    const approver = req.approver;

    if (!status || !['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'status must be either "Approved" or "Rejected"',
      });
    }

    const currentResult = await pool.query(
      `
        SELECT cf.*
        FROM control_forms cf
        ${scopedApproverRacmJoin('cf')}
        WHERE cf.form_id = $2
      `,
      [approver.email_id, form_id]
    );
    if (currentResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'RACM not found or not assigned to this approver' });
    }

    const row = currentResult.rows[0];
    const curStatus = row.status;

    if (curStatus !== 'Approved' && curStatus !== 'Rejected') {
      return res.status(400).json({
        success: false,
        message: 'Decision can only be changed for forms that are already approved or rejected.',
      });
    }

    if (curStatus === status) {
      return res.status(400).json({
        success: false,
        message: 'The new status must differ from the current status.',
      });
    }

    const tsRaw = row.approval_status_change_timestamp;
    if (!tsRaw) {
      return res.status(400).json({
        success: false,
        message: 'Cannot change decision: approval timestamp is missing.',
      });
    }

    const changedAt = tsRaw instanceof Date ? tsRaw.getTime() : new Date(tsRaw).getTime();
    if (Number.isNaN(changedAt)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot change decision: invalid approval timestamp.',
      });
    }

    if (Date.now() - changedAt > APPROVAL_DECISION_CHANGE_WINDOW_MS) {
      return res.status(403).json({
        success: false,
        message: 'Decision can only be changed within 15 days of the last approval action.',
      });
    }

    if (status === 'Rejected') {
      const r = reason_by_approver != null ? String(reason_by_approver).trim() : '';
      if (!r) {
        return res.status(400).json({
          success: false,
          message: 'Reason is required when rejecting.',
        });
      }
    }

    const reasonFinal =
      status === 'Rejected'
        ? String(reason_by_approver).trim()
        : reason_by_approver != null && String(reason_by_approver).trim() !== ''
          ? String(reason_by_approver).trim()
          : null;

    const client = await pool.connect();
    let updatedForm;
    try {
      await client.query('BEGIN');

      if (status === 'Rejected') {
        await client.query(
          `
            INSERT INTO control_form_history (form_id, reason_by_approver, rejection_timestamp)
            VALUES ($1, $2, CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')
          `,
          [form_id, reasonFinal || null]
        );
      }

      const updateResult = await client.query(
        `UPDATE control_forms
         SET status = $1,
             reason_by_approver = $2,
             approval_status_change_timestamp = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')
         WHERE form_id = $3
           AND EXISTS (
             SELECT 1
             FROM company_unit_master approver_units
             WHERE approver_units.company_identifier = control_forms.company_identifier
               AND approver_units.unit_id = control_forms.unit_id
               AND LOWER(TRIM(COALESCE(approver_units.approver_email_id, ''))) = LOWER(TRIM($4))
           )
         RETURNING *`,
        [status, reasonFinal, form_id, approver.email_id]
      );

      if (updateResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, message: 'RACM not found or not assigned to this approver' });
      }

      await client.query('COMMIT');
      updatedForm = updateResult.rows[0];
      await attachControlFormDocuments(client, [updatedForm]);
    } catch (dbErr) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        console.error('Change approval decision rollback error:', rollbackErr);
      }
      console.error('Change approval decision DB error:', dbErr);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    } finally {
      client.release();
    }

    await notifyProcessOwnerRacmDecision(
      updatedForm.control_owner,
      form_id,
      status,
      reasonFinal || '',
      updatedForm
    );

    const action = status === 'Approved' ? 'RACM Approved' : 'RACM Rejected';
    await logAuditEvent(action, approver.email_id, form_id, DECISION_CHANGE_AUDIT_REF);

    res.status(200).json({
      success: true,
      message: `RACM ${status.toLowerCase()} successfully`,
      data: updatedForm,
    });
  } catch (error) {
    console.error('Change approval decision error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

async function getControlForms(req, res) {
  try {
    const { status, active } = req.query;
    const requestedUnitId = req.query.unit_id ? String(req.query.unit_id).trim() : '';
    const approverEmail = req.approver.email_id;

    let query = `
      SELECT 
        cf.*,
        c.company_name,
        NULLIF(TRIM(u.emp_name), '') AS control_owner_name,
        NULLIF(TRIM(approver_units.unit_name), '') AS unit_name
      FROM control_forms cf
      ${scopedApproverRacmJoin('cf')}
      LEFT JOIN companies c ON cf.company_identifier = c.company_identifier
      LEFT JOIN ifc_users u ON LOWER(TRIM(u.email_id)) = LOWER(TRIM(cf.control_owner))
      WHERE 1=1
    `;
    const queryParams = [approverEmail];
    let paramIndex = 2;

    const allowedStatuses = ['sent for approval', 'Approved', 'Rejected'];

    if (status) {
      if (allowedStatuses.includes(status)) {
        query += ` AND cf.status = $${paramIndex}`;
        queryParams.push(status);
        paramIndex++;
      } else {
        query += ' AND 1=0';
      }
    } else {
      query += ` AND cf.status IN ('sent for approval', 'Approved', 'Rejected')`;
    }

    if (active !== undefined) {
      if (active === 'true' || active === '1') {
        query += ` AND cf.active IS NOT NULL AND cf.active != '' AND cf.active != '0'`;
      } else if (active === 'false' || active === '0') {
        query += ` AND (cf.active IS NULL OR cf.active = '' OR cf.active = '0')`;
      }
    }

    if (requestedUnitId) {
      query += ` AND cf.unit_id = $${paramIndex}`;
      queryParams.push(requestedUnitId);
      paramIndex++;
    }

    query += ' ORDER BY cf.created_at DESC';

    const result = await pool.query(query, queryParams);
    await attachControlFormDocuments(pool, result.rows);

    res.status(200).json({
      success: true,
      message: 'RACMs retrieved successfully',
      data: result.rows,
    });
  } catch (error) {
    console.error('Get RACMs error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
}

async function getControlFormById(req, res) {
  try {
    const { form_id } = req.params;
    const approverEmail = req.approver.email_id;

    const query = `
      SELECT
        cf.*,
        c.company_name,
        NULLIF(TRIM(u.emp_name), '') AS control_owner_name,
        NULLIF(TRIM(approver_units.unit_name), '') AS unit_name
      FROM control_forms cf
      ${scopedApproverRacmJoin('cf')}
      LEFT JOIN companies c ON cf.company_identifier = c.company_identifier
      LEFT JOIN ifc_users u
        ON LOWER(TRIM(u.email_id)) = LOWER(TRIM(cf.control_owner))
      WHERE cf.form_id = $2
    `;
    const result = await pool.query(query, [approverEmail, form_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'RACM not found or not assigned to this approver',
      });
    }

    await attachControlFormDocuments(pool, [result.rows[0]]);

    res.status(200).json({
      success: true,
      message: 'RACM retrieved successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Get RACM error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
}

async function checkControlFormAccess(req, res) {
  try {
    const { form_id } = req.params;
    const approverEmail = req.approver.email_id;

    const result = await pool.query(
      `
        SELECT
          cf.form_id,
          cf.unit_id AS racm_unit_id,
          NULLIF(TRIM(approver_units.unit_id), '') AS approver_unit_id,
          NULLIF(TRIM(approver_units.unit_name), '') AS approver_unit_name
        FROM control_forms cf
        ${scopedApproverRacmJoin('cf')}
        WHERE cf.form_id = $2
        LIMIT 1
      `,
      [approverEmail, form_id]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to access this RACM',
        data: {
          allowed: false,
        },
      });
    }

    const row = result.rows[0];
    return res.status(200).json({
      success: true,
      message: 'Approver access verified',
      data: {
        allowed: true,
        form_id: row.form_id,
        racm_unit_id: row.racm_unit_id || null,
        approver_unit_id: row.approver_unit_id || null,
        approver_unit_name: row.approver_unit_name || null,
      },
    });
  } catch (error) {
    console.error('Check approver RACM access error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
}

async function getControlFormHistory(req, res) {
  try {
    const { form_id } = req.params;
    const approverEmail = req.approver.email_id;

    const exists = await pool.query(
      `
        SELECT 1
        FROM control_forms cf
        ${scopedApproverRacmJoin('cf')}
        WHERE cf.form_id = $2
        LIMIT 1
      `,
      [approverEmail, form_id]
    );
    if (exists.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'RACM not found or not assigned to this approver',
      });
    }

    const result = await pool.query(
      `
        SELECT id, reason_by_approver, rejection_timestamp
        FROM control_form_history
        WHERE form_id = $1
        ORDER BY rejection_timestamp ASC NULLS LAST, id ASC
      `,
      [form_id]
    );

    res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get control_form_history error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
}

async function getRacmAuditLogs(req, res) {
  try {
    const { form_id } = req.params;
    const approverEmail = req.approver.email_id;
    const exists = await pool.query(
      `
        SELECT 1
        FROM control_forms cf
        ${scopedApproverRacmJoin('cf')}
        WHERE cf.form_id = $2
        LIMIT 1
      `,
      [approverEmail, form_id]
    );
    if (exists.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'RACM not found or not assigned to this approver',
      });
    }

    const query = `
      SELECT id, timestamp, action, user_email_id, form_id, ref_data
      FROM audit_logs_racm
      WHERE form_id = $1
      ORDER BY timestamp ASC NULLS LAST, id ASC
    `;
    const result = await pool.query(query, [form_id]);
    res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get RACM audit logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
}

module.exports = {
  getHomeStats,
  getDashboard,
  getPendingApprovals,
  approveForm,
  changeApprovalDecision,
  getControlForms,
  checkControlFormAccess,
  getControlFormById,
  getControlFormHistory,
  getRacmAuditLogs,
};
