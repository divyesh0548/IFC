const express = require('express');
const { Pool } = require('pg');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Database connection pool
const pool = new Pool({
  user: process.env.DB_USER || 'divyesh',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'ifc_dev',
  password: String(process.env.DB_PASSWORD || '0548'),
  port: parseInt(process.env.DB_PORT || '5432', 10),
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

// Middleware to verify company coordinator authentication
async function verifyCompanyCoordinator(req, res, next) {
  try {
    const token = req.cookies.userAuthToken;
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

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
    next();
  } catch (error) {
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
  const { email_id } = req.body;
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
      INSERT INTO ifc_users (email_id, password, role, company_identifier, temp_login)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, email_id, company_identifier;
    `;

    const userResult = await client.query(insertUserQuery, [
      email_id,
      tempPassword,
      'user', // Regular user role
      coordinator.company_identifier, // Same company as coordinator
      1 // Set temp_login to 1 to force password update
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

    const emailSent = await sendEmail(email_id, emailSubject, emailText);

    if (!emailSent) {
      console.warn(`Warning: Failed to send email to ${email_id}, but user was created successfully.`);
      // Don't fail the transaction if email fails, but log it
    }

    await client.query('COMMIT');

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

module.exports = router;

