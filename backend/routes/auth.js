const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../utils/db');
const { logAuditEvent } = require('../utils/auditLog');
const { sendEmail } = require('../utils/send_email');
const { encryptToken, decryptToken, generateTempPassword } = require('../utils/auth_utility');
const { getEmailFromAuthCookies } = require('../modules/auth/auth.middleware');

const router = express.Router();

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
    // Query the ifc_users table
    const query = 'SELECT * FROM ifc_users WHERE email_id = $1 AND password = $2';
    const result = await pool.query(query, [email_id, password]);

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email ID or password'
      });
    }

    // Login successful - Generate JWT token
    const user = result.rows[0];
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

    // Generate JWT token with email_id, id, and role
    const tokenPayload = {
      email_id: user.email_id,
      id: user.id,
      role: user.role,
      iat: Math.floor(Date.now() / 1000)
    };

    const jwtToken = jwt.sign(tokenPayload, jwtSecret, {
      expiresIn: '24h' // Token expires in 24 hours
    });

    // Add extra encryption layer to JWT token
    const encryptedToken = encryptToken(jwtToken);

    // Clear all existing auth tokens (to prevent dual login)
    res.clearCookie('userAuthToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });
    res.clearCookie('authToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });
    res.clearCookie('auditorAuthToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });
    res.clearCookie('approverAuthToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });

    // Set httpOnly cookie with the encrypted token (unified cookie name)
    res.cookie('authToken', encryptedToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Use secure cookies in production (HTTPS)
      sameSite: 'lax', // CSRF protection
      path: '/', // Available to all paths
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    // Log audit event for successful login
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
      requiresPasswordUpdate: user.temp_login === 1 || user.temp_login === true
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
      return res.status(401).json({
        success: false,
        message: 'No token provided'
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
    
    // Get user details from database to include role and company_identifier
    const userQuery = 'SELECT id, email_id, role, company_identifier, emp_name FROM ifc_users WHERE email_id = $1';
    const userResult = await pool.query(userQuery, [decoded.email_id]);
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const user = userResult.rows[0];
    
    // Token is valid - return user info including role and company_identifier
    res.status(200).json({
      success: true,
      user: {
        id: user.id,
        email_id: user.email_id,
        role: user.role,
        company_identifier: user.company_identifier,
        emp_name: user.emp_name
      }
    });

  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }
    
    console.error('Token verification error:', error);
    res.status(401).json({
      success: false,
      message: 'Token verification failed'
    });
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
      return res.status(401).json({
        success: false,
        message: 'No token provided',
      });
    }

    const profileQuery = `
      SELECT
        u.emp_name,
        u.email_id,
        u.mobile AS phone,
        u.department,
        u.designation,
        u.company_identifier,
        c.company_name
      FROM ifc_users u
      LEFT JOIN companies c ON u.company_identifier = c.company_identifier
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
      return res.status(401).json({
        success: false,
        message: 'No token provided',
      });
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

    // Log audit event for logout
    if (userEmail) {
      await logAuditEvent('Logged Out', userEmail);
    }

    // Clear all auth cookies
    res.clearCookie('authToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });
    res.clearCookie('userAuthToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });
    res.clearCookie('auditorAuthToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });
    res.clearCookie('approverAuthToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    // Still clear cookies and return success even if logging fails
    res.clearCookie('authToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });
    res.clearCookie('userAuthToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });
    res.clearCookie('auditorAuthToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });
    res.clearCookie('approverAuthToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });
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

    // Update user with temporary password and set temp_login to 1
    const updateQuery = `
      UPDATE ifc_users 
      SET password = $1, temp_login = 1 
      WHERE email_id = $2
    `;
    await pool.query(updateQuery, [tempPassword, email_id]);

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

  if (!email_id || !newPassword) {
    return res.status(400).json({
      success: false,
      message: 'Email ID and new password are required'
    });
  }

  try {
    // Verify current password (or temp password)
    const verifyQuery = 'SELECT * FROM ifc_users WHERE email_id = $1 AND password = $2';
    const verifyResult = await pool.query(verifyQuery, [email_id, currentPassword]);

    if (verifyResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid current password'
      });
    }

    // Update password and set temp_login to 0
    const updateQuery = `
      UPDATE ifc_users 
      SET password = $1, temp_login = 0 
      WHERE email_id = $2
    `;
    await pool.query(updateQuery, [newPassword, email_id]);

    res.status(200).json({
      success: true,
      message: 'Password updated successfully'
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

