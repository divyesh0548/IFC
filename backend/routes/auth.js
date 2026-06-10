const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../utils/db');
const { logAuditEvent } = require('../utils/auditLog');
const { sendEmail } = require('../utils/send_email');
const { encryptToken, decryptToken, generateTempPassword } = require('../utils/auth_utility');
const {
  clearCookiesAndRespondAuthError,
  getEmailFromAuthCookies,
} = require('../modules/auth/auth.middleware');
const {
  clearAuthCookies,
  getAuthCookieOptions,
  getAuthSessionDurationHours,
  getAuthSessionMaxAgeMs,
} = require('../modules/auth/auth.cookies');
const { hashPassword, verifyPassword, isPasswordHash, getPasswordPepper } = require('../utils/password');

const router = express.Router();

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

const AUTH_SESSION_DURATION_HOURS = getAuthSessionDurationHours();
const AUTH_SESSION_MAX_AGE_MS = getAuthSessionMaxAgeMs();

function isDatabaseConnectionError(error) {
  return (
    error?.code === 'ECONNRESET' ||
    error?.code === 'ECONNREFUSED' ||
    error?.code === 'ETIMEDOUT' ||
    String(error?.message || '').includes('ECONNRESET')
  );
}

async function queryUserByEmailForAuth(emailId, columns = 'id, email_id, role, company_identifier, emp_name, temp_login') {
  const userQuery = `SELECT ${columns} FROM ifc_users WHERE email_id = $1`;

  try {
    return await pool.query(userQuery, [emailId]);
  } catch (error) {
    if (!isDatabaseConnectionError(error)) {
      throw error;
    }

    console.warn('Auth user lookup connection reset; retrying once:', error.message);
    return pool.query(userQuery, [emailId]);
  }
}

async function hasUnitAssignmentForPrivilegedUser(user) {
  const normalizedRole = String(user?.role || '').trim().toLowerCase();
  const companyIdentifier = user?.company_identifier || null;
  const emailId = normalizeEmail(user?.email_id);

  if (!companyIdentifier || !emailId || !['company_co', 'approver'].includes(normalizedRole)) {
    return true;
  }

  const columnName = normalizedRole === 'company_co' ? 'coordinator_email_id' : 'approver_email_id';
  const result = await pool.query(
    `
      SELECT 1
      FROM company_unit_master
      WHERE company_identifier = $1
        AND LOWER(TRIM(COALESCE(${columnName}, ''))) = $2
      LIMIT 1
    `,
    [companyIdentifier, emailId]
  );

  return result.rows.length > 0;
}

// ==================== UNIFIED LOGIN ENDPOINT ====================
// Unified Login API endpoint (checks ifc_users table for all roles)
router.post('/login', async (req, res) => {
  const { email_id, password } = req.body;

  // Validate input
  if (!email_id || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email ID and password are required'
    });
  }

  try {
    getPasswordPepper();

    // Query the ifc_users table
    const query = 'SELECT * FROM ifc_users WHERE email_id = $1';
    const result = await pool.query(query, [email_id]);

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email ID or password'
      });
    }

    // Login successful - Generate JWT token
    const user = result.rows[0];
    const passwordMatches = await verifyPassword(password, user.password);

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email ID or password'
      });
    }

    if (!isPasswordHash(user.password)) {
      const upgradedPasswordHash = await hashPassword(password);
      await pool.query(
        'UPDATE ifc_users SET password = $1 WHERE id = $2',
        [upgradedPasswordHash, user.id]
      );
      user.password = upgradedPasswordHash;
    }

    const jwtSecret = process.env.JWT_SECRET;
    
    if (!jwtSecret) {
      console.error('JWT_SECRET is not set in environment variables');
      return res.status(500).json({
        success: false,
        message: 'Server configuration error'
      });
    }

    // Validate role
    const validRoles = ['user', 'company_co', 'approver', 'siteadmin', 'auditor'];
    if (!validRoles.includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Invalid user role'
      });
    }

    if (!(await hasUnitAssignmentForPrivilegedUser(user))) {
      return res.status(403).json({
        success: false,
        message: 'Your account is not yet assigned to any Company Unit'
      });
    }

    // Generate JWT token with email_id, id, and role
    const tokenPayload = {
      email_id: user.email_id,
      id: user.id,
      role: user.role,
      iat: Math.floor(Date.now() / 1000)
    };

    const jwtToken = jwt.sign(tokenPayload, jwtSecret, {
      expiresIn: `${AUTH_SESSION_DURATION_HOURS}h`
    });

    // Add extra encryption layer to JWT token
    const encryptedToken = encryptToken(jwtToken);

    clearAuthCookies(res);

    // Set httpOnly cookie with the encrypted token (unified cookie name)
    res.cookie('authToken', encryptedToken, {
      ...getAuthCookieOptions(),
      maxAge: AUTH_SESSION_MAX_AGE_MS,
      expires: new Date(Date.now() + AUTH_SESSION_MAX_AGE_MS),
    });

    await logAuditEvent('Logged In', user.email_id);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        email_id: user.email_id,
        role: user.role,
        company_identifier: user.company_identifier,
        emp_name: user.emp_name
      },
      requiresPasswordUpdate: Boolean(user.temp_login)
    });

  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Unified Verify token endpoint
router.get('/verify', async (req, res) => {
  try {
    const token = req.cookies.authToken;
    
    if (!token) {
      return clearCookiesAndRespondAuthError(res, 401, 'No token provided');
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
    
    // Get user details from database to include role and company_identifier
    const userResult = await queryUserByEmailForAuth(decoded.email_id);
    
    if (userResult.rows.length === 0) {
      return clearCookiesAndRespondAuthError(res, 401, 'User not found');
    }
    
    const user = userResult.rows[0];

    if (!(await hasUnitAssignmentForPrivilegedUser(user))) {
      return res.status(403).json({
        success: false,
        message: 'Your account is not yet assigned to any Company Unit'
      });
    }
    
    // Token is valid - return user info including role and company_identifier
    res.status(200).json({
      success: true,
      user: {
        id: user.id,
        email_id: user.email_id,
        role: user.role,
        company_identifier: user.company_identifier,
        emp_name: user.emp_name
      },
      requiresPasswordUpdate: Boolean(user.temp_login)
    });

  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      console.error('Auth verification database error:', error.message);
      return res.status(503).json({
        success: false,
        message: 'Authentication service temporarily unavailable'
      });
    }

    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return clearCookiesAndRespondAuthError(res, 401, 'Invalid or expired token');
    }
    
    console.error('Token verification error:', error);
    return clearCookiesAndRespondAuthError(res, 401, 'Token verification failed');
  }
});

async function lookupCompanyNameByIdentifier(companyIdentifier) {
  if (!companyIdentifier) {
    return null;
  }
  const r = await pool.query(
    'SELECT company_name FROM companies WHERE company_identifier = $1 LIMIT 1',
    [companyIdentifier],
  );
  return r.rows[0]?.company_name ?? null;
}

function buildProfilePayload(row, companyNameFallback) {
  const companyName =
    companyNameFallback !== undefined && companyNameFallback !== null
      ? companyNameFallback
      : row.company_name ?? null;
  return {
    emp_name: row.emp_name ?? null,
    email_id: row.email_id ?? null,
    phone: row.phone ?? row.mobile ?? null,
    company_name: companyName ?? null,
    company_identifier: row.company_identifier ?? null,
    unit_id: row.unit_id ?? null,
    unit_name: row.unit_name ?? null,
    company_details: {
      company_name: companyName ?? null,
      registered_email: row.registered_email ?? null,
      registered_address: row.registered_address ?? null,
      unique_identification_number: row.unique_identification_number ?? null,
      gst: row.gst ?? null,
      pan: row.pan ?? null,
      number_of_corporate_offices: row.number_of_corporate_offices ?? null,
      number_of_factory_units: row.number_of_factory_units ?? null,
    },
    department: row.department ?? null,
    designation: row.designation ?? null,
  };
}

// Current user profile (ifc_users + company name)
router.get('/profile', async (req, res) => {
  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return res.status(500).json({
        success: false,
        message: 'Server configuration error',
      });
    }

    const emailId = getEmailFromAuthCookies(req);
    if (!emailId) {
      return clearCookiesAndRespondAuthError(res, 401, 'No token provided');
    }

    const profileQuery = `
      SELECT
        u.emp_name,
        u.email_id,
        u.mobile AS phone,
        u.department,
        u.designation,
        u.unit_id,
        u.company_identifier,
        c.company_name,
        c.registered_email,
        c.registered_address,
        c.unique_identification_number,
        c.gst,
        c.pan,
        c.number_of_corporate_offices,
        c.number_of_factory_units,
        cum.unit_name
      FROM ifc_users u
      LEFT JOIN companies c ON u.company_identifier = c.company_identifier
      LEFT JOIN company_unit_master cum
        ON cum.company_identifier = u.company_identifier
       AND cum.unit_id = u.unit_id
      WHERE u.email_id = $1
      LIMIT 1
    `;
    const result = await pool.query(profileQuery, [emailId]);

    if (result.rows.length > 0) {
      const row = result.rows[0];
      return res.status(200).json({
        success: true,
        profile: buildProfilePayload(row),
      });
    }

    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load profile',
    });
  }
});

// Update current user profile fields (ifc_users only)
router.put('/profile', async (req, res) => {
  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return res.status(500).json({
        success: false,
        message: 'Server configuration error',
      });
    }

    const emailId = getEmailFromAuthCookies(req);
    if (!emailId) {
      return clearCookiesAndRespondAuthError(res, 401, 'No token provided');
    }

    const empNameRaw = req.body?.emp_name;
    const designationRaw = req.body?.designation;
    const departmentRaw = req.body?.department;
    const mobileRaw = req.body?.mobile;

    const emp_name = empNameRaw !== undefined ? String(empNameRaw).trim() : null;
    const designation = designationRaw !== undefined ? String(designationRaw).trim() : null;
    const department = departmentRaw !== undefined ? String(departmentRaw).trim() : null;
    const mobile = mobileRaw !== undefined ? String(mobileRaw).trim() : null;

    if (emp_name !== null && emp_name.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Employee name is required',
      });
    }

    if (mobile !== null && mobile.length > 0 && !/^[0-9]{10}$/.test(mobile)) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number must be 10 digits',
      });
    }

    const updateQuery = `
      UPDATE ifc_users
      SET
        emp_name = $1,
        designation = $2,
        department = $3,
        mobile = $4
      WHERE email_id = $5
      RETURNING emp_name, email_id, mobile AS phone, department, designation, company_identifier
    `;

    const result = await pool.query(updateQuery, [
      emp_name,
      designation && designation.length > 0 ? designation : null,
      department && department.length > 0 ? department : null,
      mobile && mobile.length > 0 ? mobile : null,
      emailId,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const row = result.rows[0];
    const companyName = await lookupCompanyNameByIdentifier(row.company_identifier);
    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      profile: buildProfilePayload(row, companyName),
    });
  } catch (error) {
    console.error('Profile update error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update profile',
    });
  }
});

// Unified Logout endpoint
router.post('/logout', async (req, res) => {
  try {
    // Get user email from token before clearing cookie
    const token = req.cookies.authToken;
    let userEmail = null;
    
    if (token) {
      try {
        const decryptedToken = decryptToken(token);
        const jwtSecret = process.env.JWT_SECRET;
        if (jwtSecret) {
          const decoded = jwt.verify(decryptedToken, jwtSecret);
          userEmail = decoded.email_id;
        }
      } catch (error) {
        // Token might be invalid/expired, but we still want to log logout attempt
        console.warn('Could not decode token during logout:', error.message);
      }
    }

    // Ensure logout audit is persisted (Prisma -> DB fallback -> file fallback).
    if (userEmail) {
      await logAuditEvent('Logged Out', userEmail);
    }

    clearAuthCookies(res);

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    // Still clear cookies and return success even if logging fails
    clearAuthCookies(res);
    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  }
});

// Forgot Password endpoint
router.post('/forgot-password', async (req, res) => {
  const { email_id } = req.body;

  if (!email_id) {
    return res.status(400).json({
      success: false,
      message: 'Email ID is required'
    });
  }

  try {
    getPasswordPepper();

    // Check if user exists
    const userQuery = 'SELECT * FROM ifc_users WHERE email_id = $1';
    const userResult = await pool.query(userQuery, [email_id]);

    if (userResult.rows.length === 0) {
      // Don't reveal if email exists for security
      return res.status(200).json({
        success: true,
        message: 'If the email exists, a temporary password has been sent.'
      });
    }

    // Generate temporary password
    const tempPassword = generateTempPassword();
    const tempPasswordHash = await hashPassword(tempPassword);

    // Update user with temporary password and set temp_login true (must change password)
    const updateQuery = `
      UPDATE ifc_users 
      SET password = $1, temp_login = TRUE 
      WHERE email_id = $2
    `;
    await pool.query(updateQuery, [tempPasswordHash, email_id]);

    // Send email with temporary password
    const emailSubject = 'Temporary Password for IFC Account';
    const emailText = `Your temporary password is: ${tempPassword}\n\nPlease login and update your password immediately.`;

    const emailSent = await sendEmail(email_id, emailSubject, emailText);

    if (!emailSent) {
      console.error('Failed to send email, but password was updated');
      // Still return success to user, but log the error
    }

    res.status(200).json({
      success: true,
      message: 'If the email exists, a temporary password has been sent.'
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update Password endpoint
router.post('/update-password', async (req, res) => {
  const { email_id, currentPassword, newPassword } = req.body;

  if (!email_id || !currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      message: 'Email ID, current password, and new password are required'
    });
  }

  try {
    getPasswordPepper();

    const sessionEmail = getEmailFromAuthCookies(req);
    if (!sessionEmail) {
      return clearCookiesAndRespondAuthError(res, 401, 'Authentication required');
    }

    if (normalizeEmail(sessionEmail) !== normalizeEmail(email_id)) {
      return clearCookiesAndRespondAuthError(res, 401, 'Authentication session does not match this user');
    }

    // Verify current password (or temp password)
    const verifyQuery = 'SELECT * FROM ifc_users WHERE LOWER(TRIM(email_id)) = $1';
    const verifyResult = await pool.query(verifyQuery, [normalizeEmail(sessionEmail)]);

    if (verifyResult.rows.length === 0) {
      return clearCookiesAndRespondAuthError(res, 401, 'Invalid current password');
    }

    const user = verifyResult.rows[0];
    const passwordMatches = await verifyPassword(currentPassword, user.password);

    if (!passwordMatches) {
      return res.status(400).json({
        success: false,
        message: 'Invalid current password'
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password cannot be the same as your temporary password'
      });
    }

    const newPasswordHash = await hashPassword(newPassword);

    // Update password and clear temp_login
    const updateQuery = `
      UPDATE ifc_users 
      SET password = $1, temp_login = FALSE 
      WHERE LOWER(TRIM(email_id)) = $2
      RETURNING id, email_id, role, company_identifier, emp_name, temp_login
    `;
    const updateResult = await pool.query(updateQuery, [newPasswordHash, normalizeEmail(sessionEmail)]);
    const updatedUser = updateResult.rows[0];

    res.status(200).json({
      success: true,
      message: 'Password updated successfully',
      user: updatedUser ? {
        id: updatedUser.id,
        email_id: updatedUser.email_id,
        role: updatedUser.role,
        company_identifier: updatedUser.company_identifier,
        emp_name: updatedUser.emp_name
      } : null,
      requiresPasswordUpdate: false
    });

  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;

