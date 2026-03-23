const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { pool } = require('../utils/db');
const { logAuditEvent } = require('../utils/auditLog');

const router = express.Router();

// Helper function to encrypt JWT token with an extra layer
function encryptToken(token) {
  const algorithm = 'aes-256-gcm';
  const encryptionKeyHex = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
  
  // Ensure the key is exactly 64 hex characters (32 bytes)
  const encryptionKey = Buffer.from(encryptionKeyHex.slice(0, 64), 'hex');
  const iv = crypto.randomBytes(16);
  
  const cipher = crypto.createCipheriv(algorithm, encryptionKey, iv);
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  
  // Combine IV, authTag, and encrypted data
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
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

// Helper function to generate temporary password
function generateTempPassword() {
  const length = 12;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

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

// ==================== SITE ADMIN AUTHENTICATION ROUTES ====================
// Login API endpoint
router.post('/siteadmin/login', async (req, res) => {
  const { email_id, password } = req.body;

  // Validate input
  if (!email_id || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email ID and password are required'
    });
  }

  try {
    // Query the siteadmin table
    const query = 'SELECT * FROM siteadmin WHERE email_id = $1 AND password = $2';
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

    // Generate JWT token with email_id
    const tokenPayload = {
      email_id: user.email_id,
      id: user.id,
      iat: Math.floor(Date.now() / 1000)
    };

    const jwtToken = jwt.sign(tokenPayload, jwtSecret, {
      expiresIn: '24h' // Token expires in 24 hours
    });

    // Add extra encryption layer to JWT token
    const encryptedToken = encryptToken(jwtToken);

    // Clear other auth tokens if exists (to prevent dual login)
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

    // Set httpOnly cookie with the encrypted token
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
        email_id: user.email_id
      }
    });

  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Verify token endpoint
router.get('/siteadmin/verify', async (req, res) => {
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
    
    // Token is valid
    res.status(200).json({
      success: true,
      user: {
        id: decoded.id,
        email_id: decoded.email_id
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

// Logout endpoint
router.post('/siteadmin/logout', async (req, res) => {
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

    // Clear the httpOnly cookie - must match the same options used when setting it
    res.clearCookie('authToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/' // Ensure cookie is cleared from all paths
    });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    // Still clear cookie and return success even if logging fails
    res.clearCookie('authToken', {
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




// ==================== AUDITOR AUTHENTICATION ROUTES ====================
// Auditor Login API endpoint
router.post('/auditor/login', async (req, res) => {
  const { email_id, password } = req.body;

  // Validate input
  if (!email_id || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email ID and password are required'
    });
  }

  try {
    // Query the auditors table
    const query = 'SELECT * FROM auditors WHERE email_id = $1 AND password = $2';
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

    // Generate JWT token with email_id
    const tokenPayload = {
      email_id: user.email_id,
      id: user.id,
      iat: Math.floor(Date.now() / 1000)
    };

    const jwtToken = jwt.sign(tokenPayload, jwtSecret, {
      expiresIn: '24h' // Token expires in 24 hours
    });

    // Add extra encryption layer to JWT token
    const encryptedToken = encryptToken(jwtToken);

    // Clear other auth tokens if exists (to prevent dual login)
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

    // Set httpOnly cookie with the encrypted token (using different cookie name for auditors)
    res.cookie('auditorAuthToken', encryptedToken, {
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
        email_id: user.email_id
      }
    });

  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Auditor Verify token endpoint
router.get('/auditor/verify', async (req, res) => {
  try {
    const token = req.cookies.auditorAuthToken;
    
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
    
    // Token is valid
    res.status(200).json({
      success: true,
      user: {
        id: decoded.id,
        email_id: decoded.email_id
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

// Auditor Logout endpoint
router.post('/auditor/logout', async (req, res) => {
  try {
    // Get user email from token before clearing cookie
    const token = req.cookies.auditorAuthToken;
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

    // Clear the httpOnly cookie - must match the same options used when setting it
    res.clearCookie('auditorAuthToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/' // Ensure cookie is cleared from all paths
    });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    // Still clear cookie and return success even if logging fails
    res.clearCookie('auditorAuthToken', {
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







// ==================== USER AUTHENTICATION ROUTES ====================
// User Login API endpoint (for ifc_users table)
router.post('/user/login', async (req, res) => {
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

    // Clear siteadmin auth token if exists (to prevent dual login)
    res.clearCookie('authToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });

    // Set httpOnly cookie with the encrypted token (using different cookie name for users)
    res.cookie('userAuthToken', encryptedToken, {
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

// User Verify token endpoint
router.get('/user/verify', async (req, res) => {
  try {
    const token = req.cookies.userAuthToken;
    
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
    
    // Get user details from database to include company_identifier
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

// User Logout endpoint
router.post('/user/logout', async (req, res) => {
  try {
    // Get user email from token before clearing cookie
    const token = req.cookies.userAuthToken;
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

    // Clear the httpOnly cookie - must match the same options used when setting it
    res.clearCookie('userAuthToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/' // Ensure cookie is cleared from all paths
    });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    // Still clear cookie and return success even if logging fails
    res.clearCookie('userAuthToken', {
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





// ==================== APPROVER AUTHENTICATION ROUTES ====================

// Approver Login API endpoint
router.post('/approver/login', async (req, res) => {
  const { email_id, password } = req.body;

  // Validate input
  if (!email_id || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email ID and password are required'
    });
  }

  try {
    // Query the appover table
    const query = 'SELECT * FROM appover WHERE email_id = $1 AND password = $2';
    const result = await pool.query(query, [email_id, password]);

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email ID or password'
      });
    }

    // Login successful - Generate JWT token
    const approver = result.rows[0];
    const jwtSecret = process.env.JWT_SECRET;
    
    if (!jwtSecret) {
      console.error('JWT_SECRET is not set in environment variables');
      return res.status(500).json({
        success: false,
        message: 'Server configuration error'
      });
    }

    // Generate JWT token with email_id and id
    const tokenPayload = {
      email_id: approver.email_id,
      id: approver.id,
      role: 'approver',
      iat: Math.floor(Date.now() / 1000)
    };

    const jwtToken = jwt.sign(tokenPayload, jwtSecret, {
      expiresIn: '24h' // Token expires in 24 hours
    });

    // Add extra encryption layer to JWT token
    const encryptedToken = encryptToken(jwtToken);

    // Clear other auth tokens if exists (to prevent dual login)
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

    // Set httpOnly cookie with the encrypted token (using different cookie name for approvers)
    res.cookie('approverAuthToken', encryptedToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Use secure cookies in production (HTTPS)
      sameSite: 'lax', // CSRF protection
      path: '/', // Available to all paths
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    // Log audit event for successful login
    await logAuditEvent('Logged In', approver.email_id);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      approver: {
        id: approver.id,
        email_id: approver.email_id
      }
    });

  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Approver Verify token endpoint
router.get('/approver/verify', async (req, res) => {
  try {
    const token = req.cookies.approverAuthToken;
    
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
    
    // Get approver details from database
    const approverQuery = 'SELECT id, email_id FROM appover WHERE email_id = $1';
    const approverResult = await pool.query(approverQuery, [decoded.email_id]);
    
    if (approverResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Approver not found'
      });
    }
    
    const approver = approverResult.rows[0];
    
    // Token is valid - return approver info
    res.status(200).json({
      success: true,
      approver: {
        id: approver.id,
        email_id: approver.email_id
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

// Approver Logout endpoint
router.post('/approver/logout', async (req, res) => {
  try {
    // Get user email from token before clearing cookie
    const token = req.cookies.approverAuthToken;
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

    // Clear the httpOnly cookie - must match the same options used when setting it
    res.clearCookie('approverAuthToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/' // Ensure cookie is cleared from all paths
    });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    // Still clear cookie and return success even if logging fails
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

// Approver Forgot Password endpoint
router.post('/approver/forgot-password', async (req, res) => {
  const { email_id } = req.body;

  if (!email_id) {
    return res.status(400).json({
      success: false,
      message: 'Email ID is required'
    });
  }

  try {
    // Check if approver exists
    const approverQuery = 'SELECT * FROM appover WHERE email_id = $1';
    const approverResult = await pool.query(approverQuery, [email_id]);

    if (approverResult.rows.length === 0) {
      // Don't reveal if email exists for security
      return res.status(200).json({
        success: true,
        message: 'If the email exists, a temporary password has been sent.'
      });
    }

    // Generate temporary password
    const tempPassword = generateTempPassword();

    // Update approver with temporary password
    const updateQuery = `
      UPDATE appover 
      SET password = $1 
      WHERE email_id = $2
    `;
    await pool.query(updateQuery, [tempPassword, email_id]);

    // Send email with temporary password
    const emailSubject = 'Temporary Password for IFC Approver Account';
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
    console.error('Approver forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Approver Update Password endpoint
router.post('/approver/update-password', async (req, res) => {
  const { email_id, currentPassword, newPassword } = req.body;

  if (!email_id || !newPassword) {
    return res.status(400).json({
      success: false,
      message: 'Email ID and new password are required'
    });
  }

  try {
    // Verify current password (or temp password)
    const verifyQuery = 'SELECT * FROM appover WHERE email_id = $1 AND password = $2';
    const verifyResult = await pool.query(verifyQuery, [email_id, currentPassword]);

    if (verifyResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid current password'
      });
    }

    // Update password
    const updateQuery = `
      UPDATE appover 
      SET password = $1 
      WHERE email_id = $2
    `;
    await pool.query(updateQuery, [newPassword, email_id]);

    res.status(200).json({
      success: true,
      message: 'Password updated successfully'
    });

  } catch (error) {
    console.error('Approver update password error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});






module.exports = router;

