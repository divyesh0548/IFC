const express = require('express');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const { pool } = require('../utils/db');

const router = express.Router();

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
  // Check if SMTP credentials are configured
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error('SMTP credentials not configured. Please set SMTP_USER and SMTP_PASS environment variables.');
    return false;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    // Connection timeout settings (increased to handle slow connections)
    connectionTimeout: 20000, // 20 seconds
    greetingTimeout: 20000, // 20 seconds
    socketTimeout: 20000, // 20 seconds
    // TLS options
    tls: {
      rejectUnauthorized: false, // Allow self-signed certificates (set to true in production)
      ciphers: 'SSLv3'
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
    
    // Provide more detailed error information
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
      console.error(`SMTP Connection Error: Cannot connect to ${process.env.SMTP_HOST || 'smtp.gmail.com'}:${process.env.SMTP_PORT || 587}`);
      console.error('Possible causes:');
      console.error('1. SMTP server is not accessible (check firewall/network)');
      console.error('2. Incorrect SMTP_HOST or SMTP_PORT');
      console.error('3. SMTP server is down or unreachable');
      console.error('4. Network connectivity issues');
      console.error('5. For Gmail: Check if "Less secure app access" is enabled or use App Password');
    } else if (error.code === 'EAUTH') {
      console.error('SMTP Authentication Error: Invalid credentials');
      console.error('Please check SMTP_USER and SMTP_PASS environment variables');
      console.error('For Gmail: Use App Password instead of regular password');
    } else if (error.responseCode === 535) {
      console.error('SMTP Authentication Error: Invalid username or password');
      console.error('For Gmail: Make sure to use App Password, not your regular Gmail password');
    } else {
      console.error('SMTP Error Details:', {
        code: error.code,
        command: error.command,
        response: error.response,
        responseCode: error.responseCode
      });
    }
    
    return false;
  }
}

// Get users for current company coordinator's company
router.get('/users', verifyCompanyCoordinator, async (req, res) => {
  try {
    const companyIdentifier = req.user.company_identifier;

    if (!companyIdentifier) {
      return res.status(200).json({
        success: true,
        users: []
      });
    }

    const usersQuery = `
      SELECT email_id, role, emp_name, designation, department, mobile
      FROM ifc_users
      WHERE company_identifier = $1
      ORDER BY created_at DESC
    `;
    const usersResult = await pool.query(usersQuery, [companyIdentifier]);

    res.status(200).json({
      success: true,
      users: usersResult.rows
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users'
    });
  }
});

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

    // Fetch company coordinator name from ifc_users table using coordinator's id
    let company_coordinator_name = '';
    if (coordinator.id){
      const company_coordinator_name_query = `
        SELECT emp_name
        FROM ifc_users
        WHERE id = $1
      `;
      const company_coordinator_name_result = await client.query(company_coordinator_name_query, [coordinator.id]);
      company_coordinator_name = company_coordinator_name_result.rows[0]?.emp_name || '';
      console.log('Company coordinator id:', coordinator.id);
      console.log('Company coordinator name:', company_coordinator_name);
    }


    // Fetch company name from companies table using coordinator's company_identifier
    let companyName = '';
    if (companyIdentifier) {
      const companyQuery = `
        SELECT company_name
        FROM companies
        WHERE company_identifier = $1
        LIMIT 1
      `;
      const companyResult = await client.query(companyQuery, [companyIdentifier]);

      console.log('Company result:', companyResult.rows[0]);
      companyName = companyResult.rows[0]?.company_name || '';
    }
    const companyDisplayName = companyName || 'your company';

    // Send email with temporary password
    const emailSubject = 'Welcome to IFC - Let\'s get started';
    const emailText = `Hi ${emp_name},

Hope you're having a good week!

I am ${company_coordinator_name} at ${companyDisplayName} organization. We have been engaged to carry out an internal financial control review. This is a yearly exercise. If you have not participated before, we’ve put together a short introductory video (just a few minutes) to get you up to speed. You can watch it here: [Video Link]

Here is a brief overview of Internal Financial Controls.

Internal financial controls are the everyday steps we take to keep our financial information accurate and safe. IFC testing checks whether those steps are working.

The control flow is as follows: You upload evidence that you've performed the control. Our tester reviews it and passes or fails the control based on whether it is working effectively. That's it!

Your evidence is the proof that shows our controls are doing their job.

Here are your login credentials. (This is a temporary password, please change it after logging in.)

Email ID: ${email_id}
Password: ${tempPassword}
Portal: ${process.env.FRONTEND_URL}

Thanks & Regards,
${company_coordinator_name}
Sharp and Tannan Associates
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

// Check if user exists for the current coordinator's company with role = 'user'
router.get('/check-user/:email', verifyCompanyCoordinator, async (req, res) => {
  let { email } = req.params;

  // Decode URL-encoded email (e.g., %40 becomes @)
  try {
    email = decodeURIComponent(email);
  } catch (decodeError) {
    console.warn('Failed to decode email parameter, using as-is:', decodeError);
  }

  // Trim whitespace and convert to lowercase for comparison
  email = email.trim().toLowerCase();

  // Validate email format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid email format',
      exists: false
    });
  }

  try {
    const companyIdentifier = (req.user && req.user.company_identifier) || null;

    // If coordinator does not have a company_identifier, we cannot match any company users
    if (!companyIdentifier) {
      console.warn('Company coordinator does not have company_identifier');
      return res.status(200).json({
        success: true,
        exists: false
      });
    }

    // Only consider users:
    // - with the same company_identifier as the logged-in company coordinator
    // - and with role = 'user'
    // Use case-insensitive comparison and trim whitespace for email_id
    const checkUserQuery = `
      SELECT 1
      FROM ifc_users
      WHERE LOWER(TRIM(email_id)) = $1
        AND company_identifier = $2
        AND role = 'user'
      LIMIT 1
    `;

    const existingUser = await pool.query(checkUserQuery, [email, companyIdentifier]);

    console.log(`User check for ${email} in company ${companyIdentifier}: ${existingUser.rows.length > 0 ? 'FOUND' : 'NOT FOUND'}`);

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
