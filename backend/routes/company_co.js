const express = require('express');
const { Pool } = require('pg');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');

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

// Helper function to decrypt JWT token (same as in auth.js)
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
    
    // Decrypt JWT
    const jwtSecret = process.env.JWT_SECRET;
    const decoded = jwt.verify(decrypted, jwtSecret);
    return decoded;
  } catch (error) {
    throw new Error('Token decryption failed');
  }
}

// Middleware to verify company coordinator authentication (unified authentication system)
async function verifyCompanyCoordinator(req, res, next) {
  try {
    // Use unified authToken (prioritize it, but fallback to old userAuthToken for backward compatibility)
    const token = req.cookies.authToken || req.cookies.userAuthToken;
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Decrypt and verify the token (decryptToken already verifies JWT)
    const decoded = decryptToken(token);
    
    // Verify user exists and is a company coordinator
    const userQuery = 'SELECT * FROM ifc_users WHERE email_id = $1';
    const userResult = await pool.query(userQuery, [decoded.email_id]);
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = userResult.rows[0];
    
    if (user.role !== 'company_co') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Company coordinator role required.'
      });
    }

    // Attach user info to request
    req.user = user;
    console.log('✅ Company coordinator verified successfully, user:', user.email_id, 'role:', user.role);
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      console.error('❌ Invalid or expired token:', error.message);
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }
    
    console.error('❌ Token verification failed:', error.message);
    return res.status(401).json({
      success: false,
      message: 'Token verification failed'
    });
  }
}

// Helper function to send email
async function sendEmail(to, subject, text) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false,
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

// Create User for Company API endpoint
router.post('/create-user', verifyCompanyCoordinator, async (req, res) => {
  const { 
    email_id, 
    emp_code, 
    emp_name, 
    designation, 
    department, 
    mobile 
  } = req.body;
  const coordinator = req.user; // Company coordinator info from middleware

  // Validate email
  if (!email_id) {
    return res.status(400).json({
      success: false,
      message: 'Email ID is required'
    });
  }

  // Validate email format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email_id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid email format'
    });
  }

  // Validate mobile format if provided
  if (mobile && !/^[0-9]{10}$/.test(mobile.trim())) {
    return res.status(400).json({
      success: false,
      message: 'Mobile number must be 10 digits'
    });
  }

  // Check if user already exists
  const checkUserQuery = 'SELECT * FROM ifc_users WHERE email_id = $1';
  const existingUser = await pool.query(checkUserQuery, [email_id]);

  if (existingUser.rows.length > 0) {
    return res.status(409).json({
      success: false,
      message: 'User with this email already exists'
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Generate temporary password
    const tempPassword = crypto.randomBytes(8).toString('hex');

    // Insert new user with same company_identifier as coordinator
    const insertUserQuery = `
      INSERT INTO ifc_users (
        email_id, 
        password, 
        role, 
        company_identifier, 
        temp_login,
        emp_code,
        emp_name,
        designation,
        department,
        mobile
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, email_id, company_identifier;
    `;

    // Ensure company_identifier is set from coordinator
    const companyIdentifier = coordinator.company_identifier || null;
    console.log(`Creating user ${email_id} with company_identifier: ${companyIdentifier}`);

    const userResult = await client.query(insertUserQuery, [
      email_id,
      tempPassword,
      'user', // Regular user role
      companyIdentifier, // Same company as coordinator
      1, // Set temp_login to 1 to force password update
      emp_code && emp_code.trim() ? emp_code.trim() : null,
      emp_name && emp_name.trim() ? emp_name.trim() : null,
      designation && designation.trim() ? designation.trim() : null,
      department && department.trim() ? department.trim() : null,
      mobile && mobile.trim() ? mobile.trim() : null
    ]);

    const newUser = userResult.rows[0];

    // Send email with temporary password
    const emailSubject = 'Welcome - Your Temporary Login Credentials';
    const emailText = `
Dear User,

Your account has been created successfully.

Your temporary login credentials:
Email: ${email_id}
Temporary Password: ${tempPassword}

IMPORTANT: Please login using these credentials and update your password immediately for security purposes.

Login URL: http://localhost:5173/user/login

After logging in, you will be prompted to update your temporary password to a permanent one.

Best regards,
IFC System
    `;

    // Send email with temporary password (wait for it to complete)
    const emailSent = await sendEmail(email_id, emailSubject, emailText);

    if (!emailSent) {
      console.warn(`Warning: Failed to send email to ${email_id}, but user was created successfully.`);
      // Don't fail the transaction if email fails, but log it
    } else {
      console.log(`✓ User creation email sent successfully to ${email_id}`);
    }

    await client.query('COMMIT');
    
    // Small delay to ensure email is fully processed before returning
    // This helps ensure proper sequencing: user creation email → form status update email
    await new Promise(resolve => setTimeout(resolve, 500));

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: {
        id: newUser.id,
        email_id: newUser.email_id,
        company_identifier: newUser.company_identifier
      },
      emailSent: emailSent
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating user:', error);

    if (error.code === '23505') { // Unique constraint violation
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  } finally {
    client.release();
  }
});

// Check if user exists API endpoint
router.get('/check-user/:email', verifyCompanyCoordinator, async (req, res) => {
  const { email } = req.params;

  // Validate email format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid email format',
      exists: false
    });
  }

  try {
    const checkUserQuery = 'SELECT * FROM ifc_users WHERE email_id = $1';
    const existingUser = await pool.query(checkUserQuery, [email]);

    res.status(200).json({
      success: true,
      exists: existingUser.rows.length > 0
    });
  } catch (error) {
    console.error('Error checking user:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking user existence',
      exists: false
    });
  }
});

module.exports = router;

