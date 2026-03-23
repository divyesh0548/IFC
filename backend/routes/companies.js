const express = require('express');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { pool } = require('../utils/db');

const router = express.Router();

// Helper function to generate company identifier
function generateCompanyIdentifier(companyName) {
  // Take first 6 characters of company name (uppercase, remove spaces/special chars)
  const namePart = companyName
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .substring(0, 6)
    .padEnd(6, 'X'); // Pad with X if less than 6 chars
  
  // Generate 4 random alphanumeric characters (numbers and uppercase letters)
  const randomPart = crypto.randomBytes(2).toString('hex').toUpperCase().substring(0, 4);
  
  // Combine to make 10 characters total
  return (namePart + randomPart).substring(0, 10);
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

// Get all companies API endpoint
router.get('/', async (req, res) => {
  try {
    const query = 'SELECT * FROM companies ORDER BY created_at DESC';
    const result = await pool.query(query);

    res.status(200).json({
      success: true,
      message: 'Companies retrieved successfully',
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching companies'
    });
  }
});

// Get single company by company_identifier API endpoint
router.get('/:company_identifier', async (req, res) => {
  try {
    const { company_identifier } = req.params;
    
    const query = 'SELECT * FROM companies WHERE company_identifier = $1';
    const result = await pool.query(query, [company_identifier]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Company retrieved successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching company:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching company'
    });
  }
});

// Create Company API endpoint
router.post('/create', async (req, res) => {
  const {
    company_name,
    registered_email,
    registered_address,
    unique_identification_number,
    gst,
    pan,
    number_of_corporate_offices,
    number_of_factory_units,
    company_coordinator_email
  } = req.body;

  // Validate required fields
  if (!company_name || !registered_email || !registered_address || 
      !unique_identification_number || !gst || !pan || 
      !number_of_corporate_offices || !number_of_factory_units) {
    return res.status(400).json({
      success: false,
      message: 'All required fields must be provided'
    });
  }

  // Validate company coordinator email if provided
  if (company_coordinator_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(company_coordinator_email)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid company coordinator email format'
    });
  }

  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Generate company identifier
    const company_identifier = generateCompanyIdentifier(company_name);

    // Insert company into companies table
    const insertCompanyQuery = `
      INSERT INTO companies (
        company_identifier, company_name, registered_email, registered_address,
        unique_identification_number, gst, pan, number_of_corporate_offices,
        number_of_factory_units
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, company_identifier;
    `;

    const companyResult = await client.query(insertCompanyQuery, [
      company_identifier,
      company_name,
      registered_email,
      registered_address,
      unique_identification_number,
      gst,
      pan,
      number_of_corporate_offices,
      number_of_factory_units
    ]);

    const company = companyResult.rows[0];

    // If company coordinator email is provided, create/update user in ifc_users table
    if (company_coordinator_email) {
      // Check if user already exists
      const checkUserQuery = 'SELECT * FROM ifc_users WHERE email_id = $1';
      const userCheck = await client.query(checkUserQuery, [company_coordinator_email]);

      if (userCheck.rows.length > 0) {
        // Update existing user with company_identifier
        const updateUserQuery = `
          UPDATE ifc_users 
          SET company_identifier = $1 
          WHERE email_id = $2
        `;
        await client.query(updateUserQuery, [company_identifier, company_coordinator_email]);
      } else {
        // Create new user with company_identifier
        // Generate a temporary password (user will need to reset it)
        const tempPassword = crypto.randomBytes(8).toString('hex');
        
        const insertUserQuery = `
          INSERT INTO ifc_users (email_id, password, role, company_identifier, temp_login)
          VALUES ($1, $2, $3, $4, $5)
        `;
        await client.query(insertUserQuery, [
          company_coordinator_email,
          tempPassword,
          'company_co',
          company_identifier,
          1 // Set temp_login to 1 to force password update on first login
        ]);

        // Send email with temporary password
        const emailSubject = `Welcome to ${company_name} - Your Temporary Login Credentials`;
        const emailText = `
Dear Company Coordinator,

Your company account has been created successfully.

Company: ${company_name}
Company Identifier: ${company_identifier}

Your temporary login credentials:
Email: ${company_coordinator_email}
Temporary Password: ${tempPassword}

IMPORTANT: Please login using these credentials and update your password immediately for security purposes.

Login URL: http://localhost:5173/user/login

After logging in, you will be prompted to update your temporary password to a permanent one.

Best regards,
IFC System
        `;

        const emailSent = await sendEmail(company_coordinator_email, emailSubject, emailText);
        
        if (!emailSent) {
          console.warn(`Warning: Failed to send email to ${company_coordinator_email}, but user was created successfully.`);
          // Don't fail the transaction if email fails, but log it
        }
      }
    }

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Company created successfully',
      company: {
        id: company.id,
        company_identifier: company.company_identifier,
        company_name: company_name
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating company:', error);
    
    if (error.code === '23505') { // Unique constraint violation
      return res.status(409).json({
        success: false,
        message: 'Company with this identifier already exists'
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

