const express = require('express');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { logAuditEvent } = require('../utils/auditLog');

const router = express.Router();

// Database connection pool
const dbHost = process.env.DB_HOST || 'localhost';
const isLocalhost = dbHost === 'localhost' || dbHost === '127.0.0.1';

const pool = new Pool({
  user: process.env.DB_USER || 'divyesh',
  host: dbHost,
  database: process.env.DB_NAME || 'ifc_dev',
  password: String(process.env.DB_PASSWORD || '0548'),
  port: parseInt(process.env.DB_PORT || '5432', 10),
  // Enable SSL for remote connections (AWS RDS requires SSL)
  ssl: isLocalhost ? false : {
    rejectUnauthorized: false
  }
});

// Set timezone to IST for all connections
pool.on('connect', async (client) => {
  await client.query("SET timezone = 'Asia/Kolkata'");
});

// Helper function to send email
async function sendEmail(to, subject, text) {
  // Create transporter (configure with your email service)
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: to,
    subject: subject,
    text: text
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

// Helper function to decrypt JWT token
function decryptToken(encryptedToken) {
  try {
    const algorithm = 'aes-256-gcm';
    const encryptionKeyHex = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
    const encryptionKey = Buffer.from(encryptionKeyHex.slice(0, 64), 'hex');
    
    // Split the encrypted token
    const parts = encryptedToken.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const decipher = crypto.createDecipheriv(algorithm, encryptionKey, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new Error('Token decryption failed');
  }
}

// Middleware to verify approver authentication (unified authentication system)
async function verifyApproverAuth(req, res, next) {
  try {
    // Use unified authToken (prioritize it, but fallback to old approverAuthToken for backward compatibility)
    const token = req.cookies.authToken || req.cookies.approverAuthToken;
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Decrypt the token
    const decryptedToken = decryptToken(token);
    
    // Verify JWT token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return res.status(500).json({
        success: false,
        message: 'Server configuration error'
      });
    }

    const decoded = jwt.verify(decryptedToken, jwtSecret);
    
    // Get user details from database to verify role
    const userQuery = 'SELECT id, email_id, role, company_identifier FROM ifc_users WHERE email_id = $1';
    const userResult = await pool.query(userQuery, [decoded.email_id]);
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const user = userResult.rows[0];
    
    // Verify user is an approver
    if (user.role !== 'approver') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Approver role required.'
      });
    }
    
    // Attach approver info to request object (for backward compatibility)
    req.approver = {
      id: user.id,
      email_id: user.email_id
    };
    
    // Also attach as req.user for consistency
    req.user = {
      id: user.id,
      email_id: user.email_id,
      role: user.role,
      company_identifier: user.company_identifier
    };
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }
    
    console.error('Approver authentication error:', error);
    return res.status(401).json({
      success: false,
      message: 'Authentication failed'
    });
  }
}

// Protected route: Get approver dashboard data
router.get('/dashboard', verifyApproverAuth, async (req, res) => {
  try {
    // Get approver info from middleware
    const approver = req.approver;
    
    // You can add dashboard-specific queries here
    // For example, get pending approvals, statistics, etc.
    
    res.status(200).json({
      success: true,
      message: 'Dashboard data retrieved successfully',
      approver: {
        id: approver.id,
        email_id: approver.email_id
      },
      // Add dashboard data here
      data: {
        // Example: pendingApprovals: [],
        // Example: statistics: {}
      }
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Protected route: Get pending RACMs for approval
router.get('/pending-approvals', verifyApproverAuth, async (req, res) => {
  try {
    // Get RACMs that are pending approval
    const query = `
      SELECT * FROM control_forms 
      WHERE status IS NULL OR status = '' OR status = 'sent for approval'
      ORDER BY created_at DESC
    `;
    
    const result = await pool.query(query);
    
    res.status(200).json({
      success: true,
      message: 'Pending approvals retrieved successfully',
      data: result.rows
    });
  } catch (error) {
    console.error('Pending approvals error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Protected route: Approve or reject an RACM
router.post('/approve-form/:form_id', verifyApproverAuth, async (req, res) => {
  try {
    const { form_id } = req.params;
    const { 
      status, 
      reason_by_approver,
      control_design_procs,
      control_design_conclusion,
      design_deficiency_desc
    } = req.body;
    const approver = req.approver;

    if (!status || !['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'status must be either "Approved" or "Rejected"'
      });
    }

    // Log received data for debugging
    console.log('Approver form update - Received fields:', {
      form_id,
      status,
      control_design_procs,
      control_design_conclusion,
      design_deficiency_desc
    });

    // Build dynamic update query to include optional fields
    const updateFields = ['status = $1', 'reason_by_approver = $2'];
    const updateValues = [status, reason_by_approver || null];
    let paramIndex = 3;

    // Always include approver-editable fields (even if empty strings)
    // This ensures the fields are always updated when approver approves/rejects
    // Preserve empty strings as they are (don't convert to null)
    updateFields.push(`control_design_procs = $${paramIndex}`);
    updateValues.push(control_design_procs !== undefined ? control_design_procs : null);
    paramIndex++;

    updateFields.push(`control_design_conclusion = $${paramIndex}`);
    updateValues.push(control_design_conclusion !== undefined ? control_design_conclusion : null);
    paramIndex++;
    
    updateFields.push(`design_deficiency_desc = $${paramIndex}`);
    updateValues.push(design_deficiency_desc !== undefined ? design_deficiency_desc : null);
    paramIndex++;

    // Add form_id as the last parameter
    updateValues.push(form_id);

    // Update the RACM
    const updateQuery = `
      UPDATE control_forms 
      SET ${updateFields.join(', ')}
      WHERE form_id = $${paramIndex}
      RETURNING *
    `;
    
    console.log('Update query:', updateQuery);
    console.log('Update values:', updateValues);
    
    const result = await pool.query(updateQuery, updateValues);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'RACM not found'
      });
    }

    const updatedForm = result.rows[0];
    const processOwnerEmail = updatedForm.process_owner;

    // Send email to process owner if email exists
    if (processOwnerEmail) {
      const statusText = status === 'Approved' ? 'approved' : 'rejected';
      const emailSubject = `RACM ${status}`;

      // Look up process owner name from ifc_users for a personalized greeting
      let processOwnerName = 'Process Owner';
      try {
        const ownerQuery = `
          SELECT emp_name 
          FROM ifc_users 
          WHERE LOWER(TRIM(email_id)) = LOWER(TRIM($1))
          LIMIT 1
        `;
        const ownerResult = await pool.query(ownerQuery, [processOwnerEmail]);
        const rawName = ownerResult.rows[0]?.emp_name;
        if (rawName && String(rawName).trim() !== '') {
          processOwnerName = String(rawName).trim();
        }
      } catch (nameError) {
        console.error('Error fetching process owner name for email notification:', nameError);
        // Fallback to generic 'Process Owner' if lookup fails
      }

      // Look up company name from companies table using process owner's company_identifier
      let companyName = '';
      try {
        const companyQuery = `
          SELECT c.company_name
          FROM ifc_users u
          INNER JOIN companies c ON u.company_identifier = c.company_identifier
          WHERE LOWER(TRIM(u.email_id)) = LOWER(TRIM($1))
          LIMIT 1
        `;
        const companyResult = await pool.query(companyQuery, [processOwnerEmail]);
        const rawCompanyName = companyResult.rows[0]?.company_name;
        if (rawCompanyName && String(rawCompanyName).trim() !== '') {
          companyName = String(rawCompanyName).trim();
        }
      } catch (companyError) {
        console.error('Error fetching company name for email notification:', companyError);
        // Fallback to default company name if lookup fails
      }
      
      let emailBody = `Dear ${processOwnerName},\n\n`;
      emailBody += `Your RACM has been ${statusText}.\n\n`;
      
      if (reason_by_approver) {
        emailBody += `Reason/Comments from Approver:\n${reason_by_approver}\n\n`;
      }
      
      emailBody += `Form Details:\n`;
      if (updatedForm.business_process) {
        emailBody += `- BusinessProcess: ${updatedForm.business_process}\n`;
      }
      if (updatedForm.sub_process) {
        emailBody += `- SubProcess: ${updatedForm.sub_process}\n`;
      }
      if (updatedForm.standard_control_description) {
        emailBody += `- Description: ${updatedForm.standard_control_description}\n`;
      }
      
      emailBody += `\n`;
      
      if (status === 'Rejected') {
        emailBody += `You can review the feedback above, make necessary changes, and resubmit the RACM for approval.\n\n`;
      }
      
      emailBody += `Thank you for using the IFC system.\n\n`;
      emailBody += `Best regards,\n${companyName}`;

      try {
        const emailSent = await sendEmail(processOwnerEmail, emailSubject, emailBody);
        if (emailSent) {
          console.log(`✓ Email sent successfully to ${processOwnerEmail} for form ${form_id}`);
        } else {
          console.error(`⚠️  Failed to send email to ${processOwnerEmail} for form ${form_id}`);
        }
      } catch (emailError) {
        console.error(`Error sending email to ${processOwnerEmail}:`, emailError);
        // Don't fail the request if email fails
      }
    } else {
      console.warn(`⚠️  No process owner email found for form ${form_id}, email not sent`);
    }

    // Log audit event for form approval/rejection
    const action = status === 'Approved' ? 'RACM Approved' : 'RACM Rejected';
    await logAuditEvent(action, approver.email_id, form_id);

    res.status(200).json({
      success: true,
      message: `RACM ${status.toLowerCase()} successfully`,
      data: updatedForm
    });
  } catch (error) {
    console.error('Approve form error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Protected route: Get all RACMs (with filter options)
router.get('/control-forms', verifyApproverAuth, async (req, res) => {
  try {
    const { status, active } = req.query;
    
    // Join with companies table to get company_name and with ifc_users to get process_owner_name
    let query = `
      SELECT 
        cf.*,
        c.company_name,
        NULLIF(TRIM(u.emp_name), '') AS process_owner_name
      FROM control_forms cf
      LEFT JOIN companies c ON cf.company_identifier = c.company_identifier
      LEFT JOIN ifc_users u ON LOWER(TRIM(u.email_id)) = LOWER(TRIM(cf.process_owner))
      WHERE 1=1
    `;
    const queryParams = [];
    let paramIndex = 1;

    // Only fetch forms with status: "sent for approval", "Approved", or "Rejected"
    const allowedStatuses = ['sent for approval', 'Approved', 'Rejected'];
    
    if (status) {
      // Validate that the requested status is one of the allowed statuses
      if (allowedStatuses.includes(status)) {
        query += ` AND cf.status = $${paramIndex}`;
        queryParams.push(status);
        paramIndex++;
      } else {
        // If invalid status, return empty result
        query += ` AND 1=0`;
      }
    } else {
      // When no status filter is provided, show all allowed statuses
      query += ` AND cf.status IN ('sent for approval', 'Approved', 'Rejected')`;
    }

    if (active !== undefined) {
      if (active === 'true' || active === '1') {
        // Active: not null, not empty, and not '0'
        query += ` AND cf.active IS NOT NULL AND cf.active != '' AND cf.active != '0'`;
      } else if (active === 'false' || active === '0') {
        // Inactive: null, empty, or '0'
        query += ` AND (cf.active IS NULL OR cf.active = '' OR cf.active = '0')`;
      }
    }

    query += ' ORDER BY cf.created_at DESC';

    const result = await pool.query(query, queryParams);

    res.status(200).json({
      success: true,
      message: 'RACMs retrieved successfully',
      data: result.rows
    });
  } catch (error) {
    console.error('Get RACMs error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Protected route: Get a specific RACM by form_id
router.get('/control-forms/:form_id', verifyApproverAuth, async (req, res) => {
  try {
    const { form_id } = req.params;
    
    const query = `
      SELECT
        cf.*,
        NULLIF(TRIM(u.emp_name), '') AS process_owner_name
      FROM control_forms cf
      LEFT JOIN ifc_users u
        ON LOWER(TRIM(u.email_id)) = LOWER(TRIM(cf.process_owner))
      WHERE cf.form_id = $1
    `;
    const result = await pool.query(query, [form_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'RACM not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'RACM retrieved successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Get RACM error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;

