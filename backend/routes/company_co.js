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

function normalizeEmail(email) {
  return (email || '').trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

function buildFallbackName(email) {
  const localPart = normalizeEmail(email).split('@')[0] || 'User';
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'User';
}

async function getCoordinatorAndCompanyDetails(client, coordinator) {
  const companyIdentifier = coordinator.company_identifier || null;
  let companyCoordinatorName = '';
  let companyName = '';

  if (coordinator.id) {
    const coordinatorResult = await client.query(
      `
        SELECT emp_name
        FROM ifc_users
        WHERE id = $1
      `,
      [coordinator.id]
    );
    companyCoordinatorName = coordinatorResult.rows[0]?.emp_name || '';
  }

  if (companyIdentifier) {
    const companyResult = await client.query(
      `
        SELECT company_name
        FROM companies
        WHERE company_identifier = $1
        LIMIT 1
      `,
      [companyIdentifier]
    );
    companyName = companyResult.rows[0]?.company_name || '';
  }

  return {
    companyIdentifier,
    companyCoordinatorName,
    companyDisplayName: companyName || 'your company',
  };
}

async function createCompanyUser(client, coordinator, payload = {}) {
  const emailId = normalizeEmail(payload.email_id);
  const empCode = payload.emp_code && payload.emp_code.trim() ? payload.emp_code.trim() : null;
  const empName = payload.emp_name && payload.emp_name.trim() ? payload.emp_name.trim() : buildFallbackName(emailId);
  const designation = payload.designation && payload.designation.trim() ? payload.designation.trim() : null;
  const department = payload.department && payload.department.trim() ? payload.department.trim() : null;
  const mobile = payload.mobile && payload.mobile.trim() ? payload.mobile.trim() : null;

  if (!emailId) {
    const error = new Error('Email ID is required');
    error.statusCode = 400;
    throw error;
  }

  if (!isValidEmail(emailId)) {
    const error = new Error('Invalid email format');
    error.statusCode = 400;
    throw error;
  }

  if (mobile && !/^[0-9]{10}$/.test(mobile)) {
    const error = new Error('Mobile number must be 10 digits');
    error.statusCode = 400;
    throw error;
  }

  const existingUser = await client.query(
    'SELECT id FROM ifc_users WHERE LOWER(TRIM(email_id)) = $1 LIMIT 1',
    [emailId]
  );

  if (existingUser.rows.length > 0) {
    const error = new Error('User with this email already exists');
    error.statusCode = 409;
    throw error;
  }

  const tempPassword = crypto.randomBytes(8).toString('hex');
  const { companyIdentifier, companyCoordinatorName, companyDisplayName } =
    await getCoordinatorAndCompanyDetails(client, coordinator);

  const userResult = await client.query(
    `
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
      RETURNING id, email_id, company_identifier
    `,
    [
      emailId,
      tempPassword,
      'user',
      companyIdentifier,
      1,
      empCode,
      empName,
      designation,
      department,
      mobile
    ]
  );

  const emailSubject = 'Welcome to IFC - Let\'s get started';
  const emailText = `Hi ${empName},

Hope you're having a good week!

I am ${companyCoordinatorName} at ${companyDisplayName} organization. We have been engaged to carry out an internal financial control review. This is a yearly exercise. If you have not participated before, we’ve put together a short introductory video (just a few minutes) to get you up to speed. You can watch it here: [Video Link]

Here is a brief overview of Internal Financial Controls.

Internal financial controls are the everyday steps we take to keep our financial information accurate and safe. IFC testing checks whether those steps are working.

The control flow is as follows: You upload evidence that you've performed the control. Our tester reviews it and passes or fails the control based on whether it is working effectively. That's it!

Your evidence is the proof that shows our controls are doing their job.

Here are your login credentials. (This is a temporary password, please change it after logging in.)

Email ID: ${emailId}
Password: ${tempPassword}
Portal: ${process.env.FRONTEND_URL}

Thanks & Regards,
${companyCoordinatorName}
Sharp and Tannan Associates
    `;

  const emailSent = await sendEmail(emailId, emailSubject, emailText);

  return {
    user: userResult.rows[0],
    emailSent,
  };
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

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const { user: newUser, emailSent } = await createCompanyUser(client, coordinator, {
      email_id,
      emp_code,
      emp_name,
      designation,
      department,
      mobile,
    });

    if (!emailSent) {
      console.warn(`Warning: Failed to send email to ${newUser.email_id}, but user was created successfully.`);
      // Don't fail the transaction if email fails, but log it
    } else {
      console.log(`✓ User creation email sent successfully to ${newUser.email_id}`);
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

    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    }

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

router.post('/create-users-bulk', verifyCompanyCoordinator, async (req, res) => {
  const coordinator = req.user;
  const inputEmails = Array.isArray(req.body?.email_ids) ? req.body.email_ids : [];
  const normalizedEmails = [...new Set(inputEmails.map(normalizeEmail).filter(Boolean))];
  const invalidEmails = normalizedEmails.filter((email) => !isValidEmail(email));
  const emailIds = normalizedEmails.filter((email) => isValidEmail(email));

  if (emailIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: invalidEmails.length > 0
        ? 'No valid email IDs found for user creation'
        : 'At least one email ID is required',
      invalidEmails,
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const createdUsers = [];
    const skippedEmails = [];

    for (const emailId of emailIds) {
      try {
        const { user, emailSent } = await createCompanyUser(client, coordinator, { email_id: emailId });
        createdUsers.push({
          id: user.id,
          email_id: user.email_id,
          company_identifier: user.company_identifier,
          emailSent,
        });
      } catch (error) {
        if (error.statusCode === 409) {
          skippedEmails.push(emailId);
          continue;
        }
        throw error;
      }
    }

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: `Created ${createdUsers.length} user(s) successfully`,
      createdUsers,
      skippedEmails,
      invalidEmails,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating users in bulk:', error);

    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  } finally {
    client.release();
  }
});

// Delete users for current coordinator's company.
// Side effect:
// - Any RACMs in control_forms assigned to these users (control_forms.process_owner) are made inactive:
//   process_owner = NULL and active = '0'
// - Then the selected users are removed from ifc_users
router.post('/delete-users', verifyCompanyCoordinator, async (req, res) => {
  const coordinator = req.user;
  const companyIdentifier = coordinator.company_identifier;

  const emailIdsInput = Array.isArray(req.body?.email_ids) ? req.body.email_ids : []
  const normalizedEmails = [...new Set(emailIdsInput.map(normalizeEmail).filter(Boolean))]
  const invalidEmails = normalizedEmails.filter((email) => !isValidEmail(email))

  if (!companyIdentifier) {
    return res.status(400).json({
      success: false,
      message: 'Company identifier is missing for coordinator',
    })
  }

  if (normalizedEmails.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No valid user emails provided for deletion',
    })
  }

  if (invalidEmails.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Invalid email format',
      invalidEmails,
    })
  }

  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const deactivatedRacmsQuery = `
      UPDATE control_forms
      SET process_owner = NULL,
          active = '0'
      WHERE company_identifier = $1
        AND LOWER(TRIM(process_owner)) = ANY($2::text[])
    `

    const deactivatedRacmsResult = await client.query(deactivatedRacmsQuery, [companyIdentifier, normalizedEmails])

    const deletedUsersQuery = `
      DELETE FROM ifc_users
      WHERE company_identifier = $1
        AND role = 'user'
        AND LOWER(TRIM(email_id)) = ANY($2::text[])
      RETURNING email_id
    `

    const deletedUsersResult = await client.query(deletedUsersQuery, [companyIdentifier, normalizedEmails])

    await client.query('COMMIT')

    return res.status(200).json({
      success: true,
      message: `Deleted ${deletedUsersResult.rowCount} user(s) successfully`,
      deleted_users: deletedUsersResult.rows.map((r) => r.email_id),
      deactivated_racms: deactivatedRacmsResult.rowCount,
    })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Error deleting users:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to delete user(s)',
    })
  } finally {
    client.release()
  }
})

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

// Check user existence + role for the current coordinator's company.
// Returns the actual role so the frontend can block non-"user" roles.
router.get('/check-user-role/:email', verifyCompanyCoordinator, async (req, res) => {
  let { email } = req.params;

  // Decode URL-encoded email (e.g., %40 becomes @)
  try {
    email = decodeURIComponent(email);
  } catch (decodeError) {
    console.warn('Failed to decode email parameter, using as-is:', decodeError);
  }

  // Trim whitespace and convert to lowercase for comparison
  email = email.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid email format',
      exists: false,
      role: null,
    });
  }

  try {
    const companyIdentifier = (req.user && req.user.company_identifier) || null;

    if (!companyIdentifier) {
      return res.status(200).json({
        success: true,
        exists: false,
        role: null,
      });
    }

    const checkUserQuery = `
      SELECT role
      FROM ifc_users
      WHERE LOWER(TRIM(email_id)) = $1
        AND company_identifier = $2
      LIMIT 1
    `;

    const existingUser = await pool.query(checkUserQuery, [email, companyIdentifier]);

    if (!existingUser.rows.length) {
      return res.status(200).json({
        success: true,
        exists: false,
        role: null,
      });
    }

    return res.status(200).json({
      success: true,
      exists: true,
      role: existingUser.rows[0]?.role || null,
    });
  } catch (error) {
    console.error('Error checking user role:', error);
    return res.status(500).json({
      success: false,
      message: 'Error checking user role',
      exists: false,
      role: null,
    });
  }
});

module.exports = router;
