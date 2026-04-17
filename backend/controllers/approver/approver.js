const { pool } = require('../../utils/db');
const { logAuditEvent } = require('../../utils/auditLog');
const { sendEmail } = require('../../utils/send_email');

/** Stored in audit_logs_racm.ref_data when approver flips Approved/Rejected within the allowed window. */
const DECISION_CHANGE_AUDIT_REF = 'Change of decision by approver';

const APPROVAL_DECISION_CHANGE_WINDOW_MS = 15 * 24 * 60 * 60 * 1000;

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
    emailBody += `- BusinessProcess: ${updatedForm.business_process}\n`;
  }
  if (updatedForm.sub_process) {
    emailBody += `- SubProcess: ${updatedForm.sub_process}\n`;
  }
  if (updatedForm.standard_control_description) {
    emailBody += `- Description: ${updatedForm.standard_control_description}\n`;
  }

  emailBody += '\n';

  if (status === 'Rejected') {
    emailBody += 'You can review the feedback above, make necessary changes, and resubmit the RACM for approval.\n\n';
  }

  emailBody += 'Thank you for using the IFC system.\n\n';
  emailBody += `Best regards,\n${companyName}`;

  try {
    const emailSent = await sendEmail(ownerTrim, emailSubject, emailBody);
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

    const [
      approverResult,
      companiesResult,
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
      pool.query('SELECT COUNT(*)::int AS count FROM companies'),
      pool.query(
        `
          SELECT COUNT(*)::int AS count
          FROM ifc_users
          WHERE role NOT IN ('approver', 'siteadmin', 'company_co', 'auditor')
        `
      ),
      pool.query(`
        SELECT
          COUNT(*) FILTER (
            WHERE active IS NOT NULL AND active != '' AND active != '0'
          )::int AS active_racms,
          COUNT(*) FILTER (
            WHERE active IS NOT NULL AND active != '' AND active != '0'
              AND status = 'Approved'
          )::int AS approved_racms,
          COUNT(*) FILTER (
            WHERE active IS NOT NULL AND active != '' AND active != '0'
              AND status = 'Rejected'
          )::int AS rejected_racms,
          COUNT(*) FILTER (
            WHERE active IS NOT NULL AND active != '' AND active != '0'
              AND status = 'sent for approval'
          )::int AS pending_racms,
          COUNT(*) FILTER (
            WHERE active IS NOT NULL AND active != '' AND active != '0'
              AND status IN ('Approved', 'Rejected', 'sent for approval')
          )::int AS total_racms
        FROM control_forms
      `),
    ]);

    res.status(200).json({
      success: true,
      data: {
        approver_name: approverResult.rows[0]?.emp_name || '',
        total_companies: companiesResult.rows[0]?.count || 0,
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
    const query = `
      SELECT * FROM control_forms 
      WHERE status = 'sent for approval'
      ORDER BY created_at DESC
    `;

    const result = await pool.query(query);

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

    const updateFields = ['status = $1', 'reason_by_approver = $2'];
    const updateValues = [status, reason_by_approver || null];
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

    const updateQuery = `
      UPDATE control_forms 
      SET ${updateFields.join(', ')}
      WHERE form_id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(updateQuery, updateValues);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'RACM not found',
      });
    }

    const updatedForm = result.rows[0];
    const processOwnerEmail = updatedForm.control_owner;

    await notifyProcessOwnerRacmDecision(
      processOwnerEmail,
      form_id,
      status,
      reason_by_approver || '',
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

    const currentResult = await pool.query('SELECT * FROM control_forms WHERE form_id = $1', [form_id]);
    if (currentResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'RACM not found' });
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

      if (curStatus === 'Rejected' && status === 'Approved') {
        const prevDoc =
          row.doc_uploaded_by_user != null ? String(row.doc_uploaded_by_user).trim() : '';
        const prevReason =
          row.reason_by_approver != null ? String(row.reason_by_approver).trim() : '';
        if (prevDoc || prevReason) {
          await client.query(
            `INSERT INTO control_form_history (form_id, doc_uploaded_by_user, reason_by_approver)
             VALUES ($1, $2, $3)`,
            [form_id, prevDoc || null, prevReason || null]
          );
        }
      }

      const updateResult = await client.query(
        `UPDATE control_forms
         SET status = $1,
             reason_by_approver = $2,
             approval_status_change_timestamp = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')
         WHERE form_id = $3
         RETURNING *`,
        [status, reasonFinal, form_id]
      );

      if (updateResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, message: 'RACM not found' });
      }

      await client.query('COMMIT');
      updatedForm = updateResult.rows[0];
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

    let query = `
      SELECT 
        cf.*,
        c.company_name,
        NULLIF(TRIM(u.emp_name), '') AS control_owner_name
      FROM control_forms cf
      LEFT JOIN companies c ON cf.company_identifier = c.company_identifier
      LEFT JOIN ifc_users u ON LOWER(TRIM(u.email_id)) = LOWER(TRIM(cf.control_owner))
      WHERE 1=1
    `;
    const queryParams = [];
    let paramIndex = 1;

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

    query += ' ORDER BY cf.created_at DESC';

    const result = await pool.query(query, queryParams);

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

    const query = `
      SELECT
        cf.*,
        c.company_name,
        NULLIF(TRIM(u.emp_name), '') AS control_owner_name
      FROM control_forms cf
      LEFT JOIN companies c ON cf.company_identifier = c.company_identifier
      LEFT JOIN ifc_users u
        ON LOWER(TRIM(u.email_id)) = LOWER(TRIM(cf.control_owner))
      WHERE cf.form_id = $1
    `;
    const result = await pool.query(query, [form_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'RACM not found',
      });
    }

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

async function getControlFormHistory(req, res) {
  try {
    const { form_id } = req.params;

    const exists = await pool.query('SELECT 1 FROM control_forms WHERE form_id = $1 LIMIT 1', [form_id]);
    if (exists.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'RACM not found',
      });
    }

    const result = await pool.query(
      `
        SELECT id, doc_uploaded_by_user, reason_by_approver
        FROM control_form_history
        WHERE form_id = $1
        ORDER BY id ASC
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
  getControlFormById,
  getControlFormHistory,
  getRacmAuditLogs,
};
