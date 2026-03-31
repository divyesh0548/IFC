const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const { normalizeColumnName } = require('../utils/column_mapping');
const { uploadFileToS3, deleteFileFromS3 } = require('../utils/s3Upload');
const { logAuditEvent, EXCEL_BULK_RACM_UPLOAD_ACTION } = require('../utils/auditLog');
const { calculateSampleRequired, getSampleSizeByFrequency } = require('../utils/sample_required');

console.log('✅ control_forms.js module loaded successfully');

// Function to generate a random 15-character alphanumeric string
function generateFormId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 15; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Function to generate a unique form_id that doesn't exist in the database
async function generateUniqueFormId(client) {
  let formId;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 100; // Prevent infinite loop
  
  while (!isUnique && attempts < maxAttempts) {
    formId = generateFormId();
    
    // Check if form_id already exists
    const checkQuery = 'SELECT id FROM control_forms WHERE form_id = $1';
    const result = await client.query(checkQuery, [formId]);
    
    if (result.rows.length === 0) {
      isUnique = true;
    } else {
      attempts++;
    }
  }
  
  if (!isUnique) {
    // Fallback: use crypto random bytes if we can't find a unique one
    formId = crypto.randomBytes(8).toString('hex').toUpperCase().substring(0, 15);
    // Pad with random chars if needed
    while (formId.length < 15) {
      formId += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.charAt(Math.floor(Math.random() * 36));
    }
  }
  
  return formId;
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

function formatDueDateDisplay(dueDateRaw) {
  if (!dueDateRaw) return 'TBD';

  // Expecting YYYY-MM-DD, but be defensive
  let year, month, day;
  const str = String(dueDateRaw).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const parts = str.split('-');
    year = Number(parts[0]);
    month = Number(parts[1]); // 1–12
    day = Number(parts[2]);
  } else {
    const dt = new Date(str);
    if (Number.isNaN(dt.getTime())) return 'TBD';
    year = dt.getFullYear();
    month = dt.getMonth() + 1;
    day = dt.getDate();
  }

  if (!year || !month || !day) return 'TBD';

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const monthName = monthNames[month - 1] || '';

  const getOrdinal = (n) => {
    const v = n % 100;
    if (v >= 11 && v <= 13) return `${n}th`;
    switch (n % 10) {
      case 1: return `${n}st`;
      case 2: return `${n}nd`;
      case 3: return `${n}rd`;
      default: return `${n}th`;
    }
  };

  return `${getOrdinal(day)} ${monthName}, ${year}`;
}

function buildControlFormStatusEmail(status, businessProcess, processOwnerName, coordinatorName, coordinatorCompanyName, dueDate, formId) {
  const recipientName = processOwnerName || 'Process Owner';
  const coordinatorDisplayName = coordinatorName || 'Company Coordinator';
  const coordinatorCompanyDisplayName = coordinatorCompanyName || 'Company';
  const formattedDueDate = formatDueDateDisplay(dueDate);
  const formUrl = formId ? `${process.env.FRONTEND_URL}/user/form/${formId}` : null;
  switch (status) {
    case 'Active':
      return {
        shouldSend: true,
        subject: 'Your IFC testing for ' + businessProcess + ' is ready',
        text: `Hi ${recipientName},

Hope you're having a good week!

I'm reaching out because your Internal Financial Controls assignment for ${businessProcess} is now ready in the system. Nothing complicated; we just need your help to keep things moving.

Here's what we need from you:

1. You'll see the risk and control matrix from last year. Take a quick look through from here (View of the Risk & Control key issues) especially the risks we identified and the controls we put in place. You'll also spot the evidence that was submitted last year, which should give you a good sense of what we're looking for. (You will be able to download the evidence that was submitted last year.)

2. Upload the evidence for this year's testing against each control. The period and the amount of samples can be viewed in the RACM detail page. 

What happens next?

Once you submit your evidence, our tester will review it to check if the control is operating effectively. They'll either pass or fail the control based on what they see. So the clearer your evidence, the smoother that review goes!

Deadline: ${formattedDueDate}

${formUrl ? `Access your RACM: ${formUrl}\n\n` : ''}Portal: ${process.env.FRONTEND_URL}

Just shout if you hit any snags or have questions or you have any feedback on the performance of the controls or have noted any significant breaches; I'm happy to help.

Thanks for cooperating.

Regards,
${coordinatorDisplayName}
${coordinatorCompanyDisplayName}
        `
      };
    case 'Inactive':
      // Reserved for future inactive-specific email content.
      return {
        shouldSend: false
      };
    default:
      return {
        shouldSend: false
      };
  }
}

const router = express.Router();

// Test route to verify routes are working (no auth required)
router.get('/test-route', (req, res) => {
  console.log('🧪 TEST ROUTE HIT - Routes are working!');
  console.log('Request path:', req.path);
  console.log('Request method:', req.method);
  res.json({ success: true, message: 'Test route is working!', timestamp: new Date().toISOString() });
});

const { pool } = require('../utils/db');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '..', 'uploads', 'excel_files');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Create User_Docs directory if it doesn't exist
const userDocsDir = path.join(__dirname, '..', 'uploads', 'User_Docs');
if (!fs.existsSync(userDocsDir)) {
  fs.mkdirSync(userDocsDir, { recursive: true });
}

// Configure multer for Excel file uploads (memory storage for S3 upload)
const storage = multer.memoryStorage();

// Configure multer for user document uploads
const userDocsStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, userDocsDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename with timestamp and form_id
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const formId = req.params.form_id || 'unknown';
    cb(null, `form_${formId}_${uniqueSuffix}${ext}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv' // .csv
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only Excel files (.xlsx, .xls) and CSV files are allowed.'));
    }
  }
});

// Multer for user document uploads (memory storage for S3 upload)
const uploadUserDoc = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
});

// Helper function to decrypt JWT token
function decryptToken(encryptedToken) {
  try {
    const algorithm = 'aes-256-gcm';
    const encryptionKeyHex = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
    const encryptionKey = Buffer.from(encryptionKeyHex.slice(0, 64), 'hex');
    
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
    
    const jwtSecret = process.env.JWT_SECRET;
    const decoded = jwt.verify(decrypted, jwtSecret);
    return decoded;
  } catch (error) {
    throw new Error('Token decryption failed');
  }
}

// Middleware to verify authentication (unified authentication system)
async function verifyAuth(req, res, next) {
  try {
    // Use unified authToken (prioritize it, but fallback to old tokens for backward compatibility)
    const token = req.cookies.authToken || req.cookies.userAuthToken || req.cookies.approverAuthToken;
    
    if (!token) {
      console.error('❌ No token found in cookies');
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Decrypt and verify the token (decryptToken already verifies JWT)
    const decoded = decryptToken(token);
    
    // Get user details from database to include role and company_identifier
    const userQuery = 'SELECT id, email_id, role, company_identifier FROM ifc_users WHERE email_id = $1';
    const userResult = await pool.query(userQuery, [decoded.email_id]);
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const user = userResult.rows[0];
    
    // Attach user info to request object
    req.user = {
      id: user.id,
      email_id: user.email_id,
      role: user.role,
      company_identifier: user.company_identifier
    };
    
    console.log('✅ Token verified successfully, user:', user.email_id, 'role:', user.role);
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

// Function to parse Excel file and convert to JSON
function parseExcelFile(buffer) {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0]; // Get first sheet
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON with header row
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
      defval: null, // Use null for empty cells
      raw: false // Convert all values to strings
    });
    
    return jsonData;
  } catch (error) {
    throw new Error(`Error parsing Excel file: ${error.message}`);
  }
}

// Function to transform Excel data to database format
function transformExcelData(excelRows) {
  return excelRows.map(row => {
    const dbRow = {};
    
    // Map each Excel column to database column
    Object.keys(row).forEach(excelColumn => {
      const dbColumn = normalizeColumnName(excelColumn);
      if (dbColumn) {
        // Convert value to string or null
        const value = row[excelColumn];
        dbRow[dbColumn] = value !== null && value !== undefined && value !== '' 
          ? String(value).trim() 
          : null;
      }
    });
    
    return dbRow;
  });
}

// Bulk upload - Upload file to S3 and record in excel_files table (processed = 0)
router.post('/bulk-upload', verifyAuth, upload.single('excelFile'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No file uploaded'
    });
  }

  // Validate business_process is provided
  const businessProcess = req.body.businessProcess;
  if (!businessProcess || businessProcess.trim() === '') {
    return res.status(400).json({
      success: false,
      message: 'Business process is required'
    });
  }

  // Validate financial_year is provided
  const financialYear = req.body.financialYear;
  if (!financialYear || financialYear.trim() === '') {
    return res.status(400).json({
      success: false,
      message: 'Financial year is required'
    });
  }

  // Optional reminder settings (both-or-none)
  const dueDate = req.body.due_date ? String(req.body.due_date).trim() : '';
  const reminderFrequency = req.body.reminder_frequency ? String(req.body.reminder_frequency).trim() : '';

  if ((dueDate && !reminderFrequency) || (!dueDate && reminderFrequency)) {
    return res.status(400).json({
      success: false,
      message: 'Please provide both due_date and reminder_frequency (or keep both empty)'
    });
  }

  if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid due_date format. Expected YYYY-MM-DD'
    });
  }

  if (reminderFrequency) {
    const allowed = new Set(['Daily', 'Weekly', 'Monthly']);
    if (!allowed.has(reminderFrequency)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reminder_frequency. Allowed values: Daily, Weekly, Monthly'
      });
    }
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get user's company_identifier from the database
    const userEmail = req.user.email_id;
    const getUserQuery = 'SELECT company_identifier FROM ifc_users WHERE email_id = $1';
    const userResult = await client.query(getUserQuery, [userEmail]);
    
    let companyIdentifier = null;
    if (userResult.rows.length > 0 && userResult.rows[0].company_identifier) {
      companyIdentifier = userResult.rows[0].company_identifier;
    }

    const fileName = req.file.originalname;
    const fileBuffer = req.file.buffer;

    // Upload file to S3
    console.log(`Uploading file to S3: ${fileName}`);
    const s3Key = await uploadFileToS3(fileBuffer, fileName, 'IFC/control_form_excel_files');
    console.log(`File uploaded to S3 with key: ${s3Key}`);

    // Save S3 key to excel_files table with processed = 0, company_identifier, coordinator_email_id, business_process, and financial_year
    const insertFileQuery = `
      INSERT INTO excel_files (
        file_path, file_name, processed, company_identifier, coordinator_email_id, business_process, financial_year,
        due_date, reminder_frequency
      )
      VALUES ($1, $2, 0, $3, $4, $5, $6, $7, $8)
      RETURNING id;
    `;

    const fileResult = await client.query(insertFileQuery, [
      s3Key, // Store S3 key instead of local file path
      fileName,
      companyIdentifier,
      userEmail, // coordinator_email_id
      businessProcess, // business_process
      financialYear, // financial_year
      dueDate || null,
      reminderFrequency || null,
    ]);

    await client.query('COMMIT');

    await logAuditEvent(EXCEL_BULK_RACM_UPLOAD_ACTION, userEmail, null, s3Key);

    res.status(200).json({
      success: true,
      message: 'File uploaded successfully. It will be processed automatically within 1 minute.',
      fileId: fileResult.rows[0].id,
      fileName: fileName,
      s3Key: s3Key
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error uploading file to S3:', error);
    
    res.status(500).json({
      success: false,
      message: 'Error uploading file to S3',
      error: error.message
    });
  } finally {
    client.release();
  }
});

// Get all RACM forms (with optional company_identifier, process_owner, active, business_process, status, financial_year, and cycle filters)
router.get('/', verifyAuth, async (req, res) => {
  try {
    const { company_identifier, process_owner, active, business_process, status, financial_year, cycle } = req.query;
    
    // Debug logging
    console.log('RACM GET request filters:', {
      company_identifier,
      active,
      business_process,
      status,
      financial_year,
      cycle
    });
    
    let query = `
      SELECT
        cf.*,
        NULLIF(TRIM(u.emp_name), '') AS process_owner_name
      FROM control_forms cf
      LEFT JOIN ifc_users u
        ON LOWER(TRIM(u.email_id)) = LOWER(TRIM(cf.process_owner))
      WHERE 1=1
    `;
    const queryParams = [];
    let paramIndex = 1;

    // Company coordinator should only see forms for their own company identifier
    if (req.user.role === 'company_co') {
      const coordinatorCompanyIdentifier = req.user.company_identifier;
      if (coordinatorCompanyIdentifier) {
        query += ` AND cf.company_identifier = $${paramIndex}`;
        queryParams.push(coordinatorCompanyIdentifier);
        paramIndex++;
      }
    } else if (company_identifier) {
      query += ` AND cf.company_identifier = $${paramIndex}`;
      queryParams.push(company_identifier);
      paramIndex++;
    }
    
    // Filter by process_owner if provided
    if (process_owner) {
      query += ` AND LOWER(TRIM(cf.process_owner)) = LOWER(TRIM($${paramIndex}))`;
      queryParams.push(process_owner.trim());
      paramIndex++;
    }
    
    // Filter by business_process if provided
    if (business_process) {
      // Use case-insensitive comparison and handle NULL values
      query += ` AND cf.business_process IS NOT NULL AND LOWER(TRIM(cf.business_process)) = $${paramIndex}`;
      queryParams.push(business_process.trim().toLowerCase());
      paramIndex++;
    }
    
    // Filter by active status if provided
    if (active !== undefined) {
      if (active === 'true' || active === '1') {
        // Active: not null, not empty, and not '0'
        query += ` AND cf.active IS NOT NULL AND cf.active != '' AND cf.active != '0'`;
      } else if (active === 'false' || active === '0') {
        // Inactive: null, empty, or '0'
        query += ` AND (cf.active IS NULL OR cf.active = '' OR cf.active = '0')`;
      }
    }
    
    // Filter by status if provided
    if (status) {
      if (status === 'pending') {
        // Pending: status is null or empty
        query += ` AND (cf.status IS NULL OR cf.status = '' OR cf.status = 'null')`;
      } else if (status === 'sent for approval') {
        // Sent for approval: status is exactly 'sent for approval'
        query += ` AND cf.status = $${paramIndex}`;
        queryParams.push('sent for approval');
        paramIndex++;
      } else if (status === 'approved') {
        // Approved: status is exactly 'Approved'
        query += ` AND cf.status = $${paramIndex}`;
        queryParams.push('Approved');
        paramIndex++;
      } else if (status === 'rejected') {
        // Rejected: status is exactly 'Rejected'
        query += ` AND cf.status = $${paramIndex}`;
        queryParams.push('Rejected');
        paramIndex++;
      }
      // For 'all' or any other value, no status filter is applied
    }

    // Filter by financial_year if provided
    if (financial_year) {
      query += ` AND cf.financial_year IS NOT NULL AND TRIM(cf.financial_year) = $${paramIndex}`;
      queryParams.push(financial_year.trim());
      paramIndex++;
    }

    // Filter by cycle if provided
    if (cycle) {
      query += ` AND cf.cycle IS NOT NULL AND TRIM(cf.cycle) = $${paramIndex}`;
      queryParams.push(cycle.trim());
      paramIndex++;
    }
    
    query += ' ORDER BY cf.created_at DESC';
    
    const result = await pool.query(query, queryParams);
    
    res.status(200).json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching RACM records:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching RACM records'
    });
  }
});

// Download user uploaded document (for approver) - MUST be before /:form_id route
router.get('/download-document', verifyAuth, async (req, res) => {
  try {
    let { path: filePath } = req.query;

    if (!filePath) {
      return res.status(400).json({
        success: false,
        message: 'File path is required'
      });
    }

    // Decode the file path (in case it was encoded by the frontend)
    try {
      filePath = decodeURIComponent(filePath);
    } catch (decodeError) {
      // If decoding fails, use the original path
      console.warn('[Download Endpoint] Failed to decode file path, using original:', decodeError);
    }

    // Download from S3
    const { downloadFileFromS3 } = require('../utils/s3Upload');
    
    console.log(`[Download Endpoint] Request received - Path (raw): ${req.query.path}`);
    console.log(`[Download Endpoint] Request received - Path (decoded): ${filePath}`);
    
    try {
      console.log(`[Download Endpoint] Starting download from S3: ${filePath}`);
      const fileBuffer = await downloadFileFromS3(filePath);
      
      // Extract filename from S3 key
      const fileName = path.basename(filePath);
      
      console.log(`[Download Endpoint] File downloaded successfully, sending to client`);
      
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${fileName}"`
      );
      res.setHeader('Content-Type', 'application/octet-stream');
      
      res.send(fileBuffer);
    } catch (error) {
      console.error('[Download Endpoint] Error downloading from S3:', error);
      console.error('[Download Endpoint] Error message:', error.message);
      
      // Return 404 if file not found, otherwise 500
      const statusCode = error.message.includes('not found') || error.message.includes('NoSuchKey') ? 404 : 500;
      
      console.error(`[Download Endpoint] Returning status ${statusCode} with error: ${error.message}`);
      
      return res.status(statusCode).json({
        success: false,
        message: 'Error downloading document from S3',
        error: error.message
      });
    }

  } catch (error) {
    console.error('Download error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Error downloading document'
      });
    }
  }
});

// Get single RACM by form_id
router.get('/:form_id', verifyAuth, async (req, res) => {
  try {
    const { form_id } = req.params;
    const loggedInUserEmail = req.user.email_id;
    const loggedInUserRole = req.user.role;
    
    // SELECT * returns all columns including control_design_procs
    const query = 'SELECT * FROM control_forms WHERE form_id = $1';
    const result = await pool.query(query, [form_id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'RACM not found'
      });
    }
    
    const formData = result.rows[0];
    
    // Authorization check: For users with role 'user', verify they are the process_owner
    // company_co and approver roles can still access (existing behavior)
    if (loggedInUserRole === 'user') {
      const processOwnerEmail = (formData.process_owner || '').trim().toLowerCase();
      const userEmail = loggedInUserEmail.trim().toLowerCase();
      
      if (processOwnerEmail !== userEmail) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You are not authorized to view this form.'
        });
      }
    }
    
    // Verify control_design_procs is in the result (for debugging)
    if (!formData.hasOwnProperty('control_design_procs')) {
      console.warn(`Warning: control_design_procs column not found in result for form_id: ${form_id}`);
    }
    
    res.status(200).json({
      success: true,
      data: formData
    });
  } catch (error) {
    console.error('Error fetching RACM:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching RACM'
    });
  }
});

// Update single control form by form_id
router.put('/:form_id', verifyAuth, async (req, res) => {
  const { form_id } = req.params;
  const {
    standard_control_description, sub_process, risk_description,
    whether_fraud_risks_exist, control_objective, ipe_reference,
    nature_of_control, process_owner, control_frequency,
    control_number, account_balance_disclosure,
    risk_heat, process_walkthrough, control_relies_on_ipe,
    audit_evidence_accuracy, key_control, application_name,
    control_performer, control_owner, control_design_procs,
    control_design_conclusion, design_deficiency_desc,
    sample_size, control_type_fo, control_type_ma,
    completeness, existence_occurrence, rights_and_obligation,
    valuation_and_allocation, presentation_and_disclosure,
    due_date, reminder_frequency,
    doc_uploaded_by_user, active, status, reason_by_approver, remarks_by_user,
    modifiedFields, // Array of modified field names from frontend
    modifiedChanges // Array of { column_name, old_value, new_value } from frontend
  } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get current form data (for status/active change logic and history handling)
    const getCurrentFormQuery = `
      SELECT 
        active, 
        process_owner, 
        standard_control_description, 
        business_process,
        status AS current_status,
        doc_uploaded_by_user AS current_doc_uploaded_by_user,
        reason_by_approver AS current_reason_by_approver
      FROM control_forms 
      WHERE form_id = $1
    `;
    const currentFormResult = await client.query(getCurrentFormQuery, [form_id]);
    const currentForm = currentFormResult.rows.length > 0 ? currentFormResult.rows[0] : null;
    const currentActiveStatus = currentForm?.active && currentForm.active !== '' && currentForm.active !== '0' ? '1' : '0';

    // Check if user is an approver (only approvers can edit conclusion/procedures/deficiency fields)
    const isApprover = !!req.cookies.approverAuthToken;
    
    // Fields that only approvers can update
    const approverOnlyFields = ['control_design_procs', 'control_design_conclusion', 'design_deficiency_desc'];
    
    // If user is not an approver, remove approver-only fields from the update
    if (!isApprover) {
      // Check if user is trying to update approver-only fields
      const attemptedApproverFields = approverOnlyFields.filter(field => {
        const v = req.body[field]
        // Allow empty string / null / undefined to pass (often sent as defaults from UI),
        // but block meaningful non-empty values.
        return v !== undefined && v !== null && String(v).trim() !== ''
      })
      
      if (attemptedApproverFields.length > 0) {
        await client.query('ROLLBACK');
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to update these fields. Only approvers can update: control_design_procs, control_design_conclusion, design_deficiency_desc'
        });
      }
    }

    // Build dynamic update query - exclude created_at to preserve original timestamp
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    const derivedSampleSize = control_frequency !== undefined
      ? getSampleSizeByFrequency(control_frequency ? String(control_frequency).trim() : null)
      : undefined;
    const sampleSizeForUpdate = control_frequency !== undefined
      ? (derivedSampleSize !== null ? String(derivedSampleSize) : null)
      : undefined;

    const fieldsToUpdate = {
      standard_control_description, sub_process, risk_description,
      whether_fraud_risks_exist, control_objective, ipe_reference,
      nature_of_control, process_owner, control_frequency,
      control_number, account_balance_disclosure,
      risk_heat, process_walkthrough, control_relies_on_ipe,
      audit_evidence_accuracy, key_control, application_name,
      control_performer, control_owner, control_design_procs,
      control_design_conclusion, design_deficiency_desc,
      sample_size: sampleSizeForUpdate, control_type_fo, control_type_ma,
      completeness, existence_occurrence, rights_and_obligation,
      valuation_and_allocation, presentation_and_disclosure,
      due_date, reminder_frequency,
      doc_uploaded_by_user, active, status, reason_by_approver, remarks_by_user
    };

    Object.keys(fieldsToUpdate).forEach(field => {
      // Skip approver-only fields if user is not an approver
      if (!isApprover && approverOnlyFields.includes(field)) {
        return;
      }
      
      // Skip modifiedFields as it's metadata, not a database column
      if (field === 'modifiedFields') {
        return;
      }
      
      if (fieldsToUpdate[field] !== undefined) {
        updateFields.push(`${field} = $${paramIndex}`);
        updateValues.push(fieldsToUpdate[field]);
        paramIndex++;
      }
    });

    // Debug: Log the update query (before finalizing)
    console.log('Update query fields (pre-history):', updateFields);

    // If user is resubmitting after rejection with a new document, archive previous doc + reason
    const isResubmission = status === 'sent for approval'
      && currentForm
      && currentForm.current_status === 'Rejected'
      && doc_uploaded_by_user !== undefined
      && doc_uploaded_by_user !== null
      && String(doc_uploaded_by_user).trim() !== '';

    if (isResubmission) {
      const previousDoc = currentForm.current_doc_uploaded_by_user;
      const previousReason = currentForm.current_reason_by_approver;

      if (
        (previousDoc && String(previousDoc).trim() !== '') ||
        (previousReason && String(previousReason).trim() !== '')
      ) {
        try {
          const historyInsertQuery = `
            INSERT INTO control_form_history (form_id, doc_uploaded_by_user, reason_by_approver)
            VALUES ($1, $2, $3)
          `;
          await client.query(historyInsertQuery, [
            form_id,
            previousDoc || null,
            previousReason || null
          ]);

          // Ensure old approver reason is cleared from the live form row on resubmission;
          // doc_uploaded_by_user will be overwritten by the new value via updateFields.
          updateFields.push(`reason_by_approver = $${paramIndex}`);
          updateValues.push(null);
          paramIndex++;
        } catch (historyError) {
          await client.query('ROLLBACK');
          console.error('Error inserting into control_form_history:', historyError);
          return res.status(500).json({
            success: false,
            message: 'Error archiving previous RACM state',
            error: historyError.message
          });
        }
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    // Add form_id as the last parameter
    updateValues.push(form_id);

    const updateQuery = `
      UPDATE control_forms
      SET ${updateFields.join(', ')}
      WHERE form_id = $${paramIndex}
      RETURNING *;
    `;

    let result;
    try {
      result = await client.query(updateQuery, updateValues);
    } catch (dbError) {
      await client.query('ROLLBACK');
      console.error('Database error during update:', dbError);
      // Check if it's a column doesn't exist error
      if (dbError.message && dbError.message.includes('column') && dbError.message.includes('does not exist')) {
        return res.status(500).json({
          success: false,
          message: 'Database column error. Please ensure remarks_by_user column exists in control_forms table.',
          error: dbError.message
        });
      }
      return res.status(500).json({
        success: false,
        message: 'Database error during update',
        error: dbError.message
      });
    }

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'RACM not found'
      });
    }

    await client.query('COMMIT');

    // Log audit event if status is being set to 'sent for approval'
    if (status === 'sent for approval' && req.user && req.user.email_id) {
      await logAuditEvent('Sent for approval', req.user.email_id, form_id);
    }

    // Log audit event for RACM modifications (store JSON changes in ref_data as TEXT)
    if (req.user && req.user.email_id) {
      const hasChangesArray = Array.isArray(modifiedChanges) && modifiedChanges.length > 0;
      const hasFieldsArray = Array.isArray(modifiedFields) && modifiedFields.length > 0;

      if (hasChangesArray) {
        await logAuditEvent('RACM Modification', req.user.email_id, form_id, JSON.stringify(modifiedChanges));
      } else if (hasFieldsArray) {
        // Fallback for older clients
        const refData = JSON.stringify(modifiedFields.map((col) => ({ column_name: col })));
        await logAuditEvent('RACM Modification', req.user.email_id, form_id, refData);
      }
    }

    // Log audit when RACM active flag changes (only after successful commit, only on real transition)
    if (active !== undefined && currentForm && req.user && req.user.email_id) {
      const newActiveStatus = active === '1' || active === 1 || active === true ? '1' : '0';
      if (newActiveStatus !== currentActiveStatus) {
        const action = newActiveStatus === '1' ? 'Set RACM Active' : 'Set RACM Inactive';
        await logAuditEvent(action, req.user.email_id, form_id);
      }
    }

    // Send email to process_owner if active status changed
    if (active !== undefined && currentForm) {
      const newActiveStatus = active === '1' || active === 1 || active === true ? '1' : '0';
      if (newActiveStatus !== currentActiveStatus && currentForm.process_owner) {
        const processOwnerEmail = currentForm.process_owner.trim();
        const formDescription = currentForm.standard_control_description || 'RACM';
        const businessProcess = currentForm.business_process || '';
        const getProcessOwnerNameQuery = 'SELECT emp_name FROM ifc_users WHERE email_id = $1 LIMIT 1';
        const processOwnerResult = await client.query(getProcessOwnerNameQuery, [processOwnerEmail]);
        const processOwnerName = processOwnerResult.rows[0]?.emp_name?.trim() || '';
        const coordinatorEmail = req.user?.email_id || '';
        let coordinatorName = '';
        let coordinatorCompanyName = '';
        if (coordinatorEmail) {
          const getCoordinatorDetailsQuery = 'SELECT emp_name, company_identifier FROM ifc_users WHERE email_id = $1 LIMIT 1';
          const coordinatorResult = await client.query(getCoordinatorDetailsQuery, [coordinatorEmail]);
          coordinatorName = coordinatorResult.rows[0]?.emp_name?.trim() || '';
          const coordinatorCompanyIdentifier = coordinatorResult.rows[0]?.company_identifier || '';
          if (coordinatorCompanyIdentifier) {
            const getCompanyNameQuery = 'SELECT company_name FROM companies WHERE company_identifier = $1 LIMIT 1';
            const companyResult = await client.query(getCompanyNameQuery, [coordinatorCompanyIdentifier]);
            coordinatorCompanyName = companyResult.rows[0]?.company_name?.trim() || '';
          }
        }
        const statusLabel = newActiveStatus === '1' ? 'Active' : 'Inactive';
        const emailPayload = buildControlFormStatusEmail(
          statusLabel,
          businessProcess,
          processOwnerName,
          coordinatorName,
          coordinatorCompanyName,
          currentForm.due_date,
          form_id
        );

        if (emailPayload.shouldSend) {
          // Small delay to ensure user creation email (if user was just created) is sent first
          // This ensures proper sequencing: user creation email → form status update email
          await new Promise(resolve => setTimeout(resolve, 500));

          const emailSent = await sendEmail(processOwnerEmail, emailPayload.subject, emailPayload.text);
          if (!emailSent) {
            console.warn(`Warning: Failed to send status update email to ${processOwnerEmail}, but form was updated successfully.`);
          } else {
            console.log(`✓ Form status update email sent successfully to ${processOwnerEmail}`);
          }
        }
      }
    }

    res.status(200).json({
      success: true,
      message: 'RACM updated successfully',
      data: result.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating RACM:', error);
    
    res.status(500).json({
      success: false,
      message: 'Error updating RACM',
      error: error.message
    });
  } finally {
    client.release();
  }
});

// Bulk update forms to active based on filters
router.post('/bulk-set-active', verifyAuth, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { company_identifier, business_process, active } = req.body;
    
    // Get user's company_identifier if not provided
    let userCompanyIdentifier = company_identifier;
    if (!userCompanyIdentifier) {
      const userEmail = req.user.email_id;
      const getUserQuery = 'SELECT company_identifier FROM ifc_users WHERE email_id = $1';
      const userResult = await client.query(getUserQuery, [userEmail]);
      if (userResult.rows.length > 0 && userResult.rows[0].company_identifier) {
        userCompanyIdentifier = userResult.rows[0].company_identifier;
      }
    }
    
    // Build WHERE clause based on filters
    let query = 'UPDATE control_forms SET active = $1 WHERE 1=1';
    const queryParams = ['1'];
    let paramIndex = 2;
    
    // Filter by company_identifier (required for company_co)
    if (userCompanyIdentifier) {
      query += ` AND company_identifier = $${paramIndex}`;
      queryParams.push(userCompanyIdentifier);
      paramIndex++;
    }
    
    // Filter by business_process if provided
    if (business_process && business_process !== 'all') {
      query += ` AND business_process IS NOT NULL AND LOWER(TRIM(business_process)) = $${paramIndex}`;
      queryParams.push(business_process.trim().toLowerCase());
      paramIndex++;
    }
    
    // Filter by active status if provided (to only update inactive forms, for example)
    if (active !== undefined) {
      if (active === 'true' || active === '1') {
        // Only update forms that are currently active
        query += ` AND active IS NOT NULL AND active != '' AND active != '0'`;
      } else if (active === 'false' || active === '0') {
        // Only update forms that are currently inactive
        query += ` AND (active IS NULL OR active = '' OR active = '0')`;
      }
    }
    
    // Get forms that will be updated (before updating) to send emails
    // Build SELECT query with same WHERE conditions but correct parameter indices
    let getFormsQuery = 'SELECT form_id, process_owner, standard_control_description, active FROM control_forms WHERE 1=1';
    const getFormsParams = [];
    let getFormsParamIndex = 1;
    
    // Filter by company_identifier (required for company_co)
    if (userCompanyIdentifier) {
      getFormsQuery += ` AND company_identifier = $${getFormsParamIndex}`;
      getFormsParams.push(userCompanyIdentifier);
      getFormsParamIndex++;
    }
    
    // Filter by business_process if provided
    if (business_process && business_process !== 'all') {
      getFormsQuery += ` AND business_process IS NOT NULL AND LOWER(TRIM(business_process)) = $${getFormsParamIndex}`;
      getFormsParams.push(business_process.trim().toLowerCase());
      getFormsParamIndex++;
    }
    
    // Filter by active status if provided (to only update inactive forms, for example)
    if (active !== undefined) {
      if (active === 'true' || active === '1') {
        // Only update forms that are currently active
        getFormsQuery += ` AND active IS NOT NULL AND active != '' AND active != '0'`;
      } else if (active === 'false' || active === '0') {
        // Only update forms that are currently inactive
        getFormsQuery += ` AND (active IS NULL OR active = '' OR active = '0')`;
      }
    }
    
    const formsToUpdate = await client.query(getFormsQuery, getFormsParams);
    
    // Perform the update
    const result = await client.query(query, queryParams);
    
    await client.query('COMMIT');

    // Log audit event for each RACM transitioned to active='1' in bulk action
    if (req.user && req.user.email_id && formsToUpdate.rows.length > 0) {
      for (const form of formsToUpdate.rows) {
        const wasActive = form.active && form.active !== '' && form.active !== '0';
        if (!wasActive) {
          await logAuditEvent('Set RACM Active', req.user.email_id, form.form_id);
        }
      }
    }
    
    // Send emails to process owners
    if (formsToUpdate.rows.length > 0) {
      const emailPromises = [];
      const uniqueProcessOwners = new Map(); // Use Map to avoid duplicate emails
      
      for (const form of formsToUpdate.rows) {
        if (form.process_owner && form.process_owner.trim()) {
          const processOwnerEmail = form.process_owner.trim();
          const wasActive = form.active && form.active !== '' && form.active !== '0';
          
          // Only send email if status is actually changing (from inactive to active)
          if (!wasActive) {
            // Avoid sending duplicate emails to the same process owner
            if (!uniqueProcessOwners.has(processOwnerEmail)) {
              uniqueProcessOwners.set(processOwnerEmail, []);
            }
            uniqueProcessOwners.get(processOwnerEmail).push({
              form_id: form.form_id,
              description: form.standard_control_description || 'Control Form'
            });
          }
        }
      }
      
      // Small delay to ensure user creation emails (if users were just created) are sent first
      // This ensures proper sequencing: user creation emails → form status update emails
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Send emails to each unique process owner
      for (const [email, forms] of uniqueProcessOwners.entries()) {
        const formList = forms.map(f => `  - Form ID: ${f.form_id}\n    Description: ${f.description}`).join('\n');
        const emailSubject = `RACM Status Update - Set to Active`;
        const emailText = `
Dear Process Owner,

This is to inform you that the following RACM(s) have been set to Active:

${formList}

Total Forms: ${forms.length}

Please ensure all necessary actions are taken accordingly.

Best regards,
IFC System
        `;
        
        emailPromises.push(sendEmail(email, emailSubject, emailText));
      }
      
      // Send all emails (don't wait for them to complete)
      Promise.all(emailPromises).then(results => {
        const successCount = results.filter(r => r === true).length;
        const failCount = results.length - successCount;
        if (failCount > 0) {
          console.warn(`Warning: Failed to send ${failCount} status update email(s) out of ${results.length} total.`);
        }
      }).catch(error => {
        console.error('Error sending bulk status update emails:', error);
      });
    }
    
    res.status(200).json({
      success: true,
      message: `Successfully set ${result.rowCount} form(s) to active`,
      count: result.rowCount
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error bulk updating forms:', error);
    res.status(500).json({
      success: false,
      message: 'Error bulk updating forms',
      error: error.message
    });
  } finally {
    client.release();
  }
});

// Create single RACM
router.post('/', verifyAuth, async (req, res) => {
  const {
    standard_control_description, sub_process, risk_description,
    whether_fraud_risks_exist, control_objective, ipe_reference,
    nature_of_control, process_owner, control_frequency,
    control_number, account_balance_disclosure, risk_heat,
    process_walkthrough, control_relies_on_ipe, audit_evidence_accuracy,
    key_control, application_name, control_performer, control_owner,
    control_design_procs, control_design_conclusion, design_deficiency_desc,
    sample_size, control_type_fo, control_type_ma,
    company_identifier, business_process, financial_year,
    completeness, existence_occurrence, rights_and_obligation,
    valuation_and_allocation, presentation_and_disclosure
  } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get user's company_identifier if not provided in request body
    let userCompanyIdentifier = company_identifier;
    if (!userCompanyIdentifier) {
      const userEmail = req.user.email_id;
      const getUserQuery = 'SELECT company_identifier FROM ifc_users WHERE email_id = $1';
      const userResult = await client.query(getUserQuery, [userEmail]);
      
      if (userResult.rows.length > 0 && userResult.rows[0].company_identifier) {
        userCompanyIdentifier = userResult.rows[0].company_identifier;
      }
    }

    // Generate unique form_id
    const formId = await generateUniqueFormId(client);

    // Calculate sample_required based on control_frequency and current timestamp
    // We use current timestamp which will match the created_at value set by the database
    const currentTimestamp = new Date();
    // Ensure control_frequency is a string and handle null/undefined
    const controlFrequencyValue = control_frequency ? String(control_frequency).trim() : null;
    const sampleRequired = calculateSampleRequired(controlFrequencyValue, currentTimestamp);
    const sampleSize = getSampleSizeByFrequency(controlFrequencyValue);
    console.log('[control_forms POST] control_frequency:', control_frequency, 'normalized:', controlFrequencyValue, 'sample_required result:', sampleRequired);

    const insertQuery = `
      INSERT INTO control_forms (
        standard_control_description, sub_process, risk_description,
        whether_fraud_risks_exist, control_objective, ipe_reference,
        nature_of_control, process_owner, control_frequency,
        control_number, account_balance_disclosure, risk_heat,
        process_walkthrough, control_relies_on_ipe, audit_evidence_accuracy,
        key_control, application_name, control_performer, control_owner,
        control_design_procs, control_design_conclusion, design_deficiency_desc,
        sample_size, control_type_fo, control_type_ma,
        form_id, company_identifier, business_process, financial_year, sample_required,
        completeness, existence_occurrence, rights_and_obligation,
        valuation_and_allocation, presentation_and_disclosure
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35)
      RETURNING *;
    `;

    // Keep nullable values explicit for new schema columns.
    const controlDesignConclusionValue = control_design_conclusion !== undefined ? control_design_conclusion : null
    const designDeficiencyDescValue = design_deficiency_desc !== undefined ? design_deficiency_desc : null

    const result = await client.query(insertQuery, [
      standard_control_description, sub_process, risk_description,
      whether_fraud_risks_exist, control_objective, ipe_reference,
      nature_of_control, process_owner, control_frequency,
      control_number || null, account_balance_disclosure || null, risk_heat || null,
      process_walkthrough || null, control_relies_on_ipe || null, audit_evidence_accuracy || null,
      key_control || null, application_name || null, control_performer || null, control_owner || null,
      control_design_procs || null, controlDesignConclusionValue, designDeficiencyDescValue,
      sampleSize !== null ? String(sampleSize) : null, control_type_fo || null, control_type_ma || null,
      formId, userCompanyIdentifier, business_process, financial_year || null, sampleRequired,
      completeness || null, existence_occurrence || null, rights_and_obligation || null,
      valuation_and_allocation || null, presentation_and_disclosure || null
    ]);

    console.log('[control_forms POST] Inserted RACM - sample_required in DB:', result.rows[0]?.sample_required);

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'RACM created successfully',
      data: result.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating RACM:', error);
    
    res.status(500).json({
      success: false,
      message: 'Error creating RACM',
      error: error.message
    });
  } finally {
    client.release();
  }
});

// Replicate RACMs (bulk)
// Creates new control_forms rows copied from selected form_ids, excluding specific columns,
// generating a new form_id, and setting financial_year to the provided target.
router.post('/replicate', verifyAuth, async (req, res) => {
  const { form_ids, financial_year } = req.body || {};

  if (!Array.isArray(form_ids) || form_ids.length === 0) {
    return res.status(400).json({ success: false, message: 'form_ids is required' });
  }
  if (!financial_year || String(financial_year).trim() === '') {
    return res.status(400).json({ success: false, message: 'financial_year is required' });
  }

  const client = await pool.connect();
  try {
    // Check if user is company coordinator
    const userEmail = req.user.email_id;
    const getUserQuery = 'SELECT role, company_identifier FROM ifc_users WHERE email_id = $1';
    const userResult = await client.query(getUserQuery, [userEmail]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }
    const userRole = userResult.rows[0].role;
    const coordinatorCompany = userResult.rows[0].company_identifier;
    if (userRole !== 'company_co') {
      return res.status(403).json({ success: false, message: 'Access denied. Only company coordinators can replicate RACMs.' });
    }

    await client.query('BEGIN');

    // Fetch selected forms (ensure they belong to coordinator company)
    const placeholders = form_ids.map((_, idx) => `$${idx + 1}`).join(', ');
    const selectQuery = `SELECT * FROM control_forms WHERE form_id IN (${placeholders})`;
    const selectResult = await client.query(selectQuery, form_ids);

    if (selectResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'No RACMs found to replicate' });
    }

    // Ensure all belong to same company (coordinator company)
    if (coordinatorCompany) {
      const invalid = selectResult.rows.find(r => r.company_identifier !== coordinatorCompany);
      if (invalid) {
        await client.query('ROLLBACK');
        return res.status(403).json({ success: false, message: 'Access denied. You can only replicate RACMs from your own company.' });
      }
    }

    const excludedColumns = new Set([
      'id',
      'process_owner',
      'doc_uploaded_by_user',
      'active',
      'status',
      'reason_by_approver',
      'remarks_by_user',
      'sample_doc',
      'due_date',
      // Design / conclusion fields should not be carried over on replication
      'control_design_procs',
      'control_design_conclusion',
      'design_deficiency_desc',
      // created_at handled by DB default (current timestamp)
      'created_at',
    ]);

    const createdFormIds = [];

    // Helper: extract first 4-digit year from a FY string like "2025-26"
    const extractStartYear = (fy) => {
      if (!fy) return null;
      const match = String(fy).match(/(\d{4})/);
      return match ? Number(match[1]) : null;
    };

    for (const row of selectResult.rows) {
      // Build insert columns dynamically based on fetched row keys
      const insertObj = {};
      for (const [key, value] of Object.entries(row)) {
        if (excludedColumns.has(key)) continue;
        insertObj[key] = value;
      }

      // Override required fields
      insertObj.form_id = await generateUniqueFormId(client);
      insertObj.financial_year = String(financial_year).trim();

      // Adjust Sample Required text years based on FY shift, if possible
      try {
        const originalFY = row.financial_year ? String(row.financial_year).trim() : null;
        const targetFY = insertObj.financial_year;
        const sourceYear = extractStartYear(originalFY);
        const targetYear = extractStartYear(targetFY);

        if (
          typeof insertObj.sample_required === 'string' &&
          insertObj.sample_required.trim() !== '' &&
          sourceYear &&
          targetYear
        ) {
          const yearDelta = targetYear - sourceYear;
          if (yearDelta !== 0) {
            insertObj.sample_required = insertObj.sample_required.replace(/\d{4}/g, (match) => {
              const num = Number(match);
              if (Number.isNaN(num)) return match;
              return String(num + yearDelta);
            });
          }
        }
      } catch (e) {
        console.error('[control_forms replicate] sample_required year-shift error:', e);
      }

      // Recompute sample_size if it exists in schema (based on control_frequency)
      const currentTimestamp = new Date();
      const controlFrequencyValue = insertObj.control_frequency ? String(insertObj.control_frequency).trim() : null;
      try {
        if ('sample_size' in insertObj) {
          const sampleSize = getSampleSizeByFrequency(controlFrequencyValue);
          insertObj.sample_size = sampleSize !== null ? String(sampleSize) : null;
        }
      } catch (e) {
        // Don't fail replication if sample util fails; keep copied values
        console.error('[control_forms replicate] sample calc error:', e);
      }

      const columns = Object.keys(insertObj);
      const values = Object.values(insertObj);
      const insertPlaceholders = columns.map((_, idx) => `$${idx + 1}`).join(', ');
      const insertQuery = `INSERT INTO control_forms (${columns.join(', ')}) VALUES (${insertPlaceholders}) RETURNING form_id`;
      const insertResult = await client.query(insertQuery, values);
      createdFormIds.push(insertResult.rows[0].form_id);
    }

    await client.query('COMMIT');

    // Audit each created RACM individually so every new form_id is traceable.
    for (const createdFormId of createdFormIds) {
      await logAuditEvent('RACM created', userEmail, createdFormId);
    }

    res.status(201).json({
      success: true,
      message: 'RACMs replicated successfully',
      count: createdFormIds.length,
      data: { form_ids: createdFormIds },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error replicating RACMs:', error);
    res.status(500).json({ success: false, message: 'Error replicating RACMs', error: error.message });
  } finally {
    client.release();
  }
});

// Delete a RACM
router.delete('/:form_id', verifyAuth, async (req, res) => {
  const { form_id } = req.params;
  const client = await pool.connect();

  try {
    // Check if user is company coordinator
    const userEmail = req.user.email_id;
    const getUserQuery = 'SELECT role FROM ifc_users WHERE email_id = $1';
    const userResult = await client.query(getUserQuery, [userEmail]);
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    const userRole = userResult.rows[0].role;
    if (userRole !== 'company_co') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only company coordinators can delete RACM entries.'
      });
    }

    await client.query('BEGIN');

    // Check if form exists (and fetch document columns for cleanup)
    const checkQuery = `
      SELECT 
        id, 
        company_identifier,
        doc_uploaded_by_user,
        sample_doc
      FROM control_forms 
      WHERE form_id = $1
    `;
    const checkResult = await client.query(checkQuery, [form_id]);

    if (checkResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'RACM not found'
      });
    }

    const form = checkResult.rows[0];

    // Verify that the coordinator can only delete forms from their own company
    const coordinatorCompanyQuery = 'SELECT company_identifier FROM ifc_users WHERE email_id = $1';
    const coordinatorResult = await client.query(coordinatorCompanyQuery, [userEmail]);
    
    if (coordinatorResult.rows.length > 0) {
      const coordinatorCompany = coordinatorResult.rows[0].company_identifier;
      if (form.company_identifier !== coordinatorCompany) {
        await client.query('ROLLBACK');
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only delete forms from your own company.'
        });
      }
    }

    // Delete any associated documents from S3 before deleting the DB row
    const docUrlsToDelete = [];
    if (form.doc_uploaded_by_user && String(form.doc_uploaded_by_user).trim() !== '') {
      docUrlsToDelete.push(String(form.doc_uploaded_by_user).trim());
    }
    if (form.sample_doc && String(form.sample_doc).trim() !== '') {
      docUrlsToDelete.push(String(form.sample_doc).trim());
    }

    try {
      for (const s3Key of docUrlsToDelete) {
        await deleteFileFromS3(s3Key);
      }
    } catch (s3Error) {
      await client.query('ROLLBACK');
      console.error('Error deleting associated documents from S3 for RACM:', s3Error);
      return res.status(500).json({
        success: false,
        message: 'Error deleting associated documents from storage',
        error: s3Error.message
      });
    }

    // Delete the RACM
    const deleteQuery = 'DELETE FROM control_forms WHERE form_id = $1';
    await client.query(deleteQuery, [form_id]);

    await client.query('COMMIT');

    // Log audit event
    await logAuditEvent('RACM deleted', userEmail, form_id);

    res.status(200).json({
      success: true,
      message: 'RACM deleted successfully'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting RACM:', error);
    
    res.status(500).json({
      success: false,
      message: 'Error deleting RACM',
      error: error.message
    });
  } finally {
    client.release();
  }
});

// Upload user document for a specific form
// NOTE: This route now ONLY uploads to S3 and does NOT modify any table columns.
// The control_forms row is updated later when the user actually resubmits the form.
router.post('/:form_id/upload-document', verifyAuth, uploadUserDoc.single('document'), async (req, res) => {
  const { form_id } = req.params;
  
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No file uploaded'
    });
  }

  try {
    const fileName = req.file.originalname;
    const fileBuffer = req.file.buffer;

    // Upload file to S3
    console.log(`Uploading user document to S3: ${fileName}`);
    const s3Key = await uploadFileToS3(fileBuffer, fileName, 'IFC/user_docs');
    console.log(`User document uploaded to S3 with key: ${s3Key}`);

    // Do NOT update control_forms here; just return the S3 key to the frontend
    res.status(200).json({
      success: true,
      message: 'Document uploaded successfully',
      data: {
        form_id,
        doc_uploaded_by_user: s3Key,
        file_name: fileName
      }
    });
  } catch (error) {
    console.error('Error uploading document to S3:', error);
    
    res.status(500).json({
      success: false,
      message: 'Error uploading document to S3',
      error: error.message
    });
  }
});

// Check if sampling document exists for a form
router.get('/:form_id/check-sampling-exists', verifyAuth, async (req, res) => {
  const { form_id } = req.params;
  const client = await pool.connect();

  try {
    // Check sample_doc column in control_forms table
    const checkFormQuery = 'SELECT sample_doc FROM control_forms WHERE form_id = $1';
    const formResult = await client.query(checkFormQuery, [form_id]);
    
    let exists = false;
    if (formResult.rows.length > 0) {
      const samplingDoc = formResult.rows[0].sample_doc;
      exists = samplingDoc && samplingDoc.trim() !== '';
    }

    res.status(200).json({
      success: true,
      exists: exists
    });
  } catch (error) {
    console.error('Error checking sampling document:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking sampling document',
      error: error.message
    });
  } finally {
    client.release();
  }
});

// Upload sampling Excel file for a specific form
router.post('/:form_id/upload-sampling-excel', verifyAuth, upload.single('excelFile'), async (req, res) => {
  const { form_id } = req.params;
  
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No file uploaded'
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Verify form exists
    const formCheckQuery = 'SELECT form_id FROM control_forms WHERE form_id = $1';
    const formResult = await client.query(formCheckQuery, [form_id]);

    if (formResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Control form not found'
      });
    }

    const fileName = req.file.originalname;
    const fileBuffer = req.file.buffer;

    // Upload file to S3 in IFC/sample_docs path
    console.log(`Uploading sampling Excel file to S3: ${fileName}`);
    const s3Key = await uploadFileToS3(fileBuffer, fileName, 'IFC/sample_docs');
    console.log(`Sampling Excel file uploaded to S3 with key: ${s3Key}`);
    
    // Update sample_doc column in control_forms table
    const updateQuery = `
      UPDATE control_forms
      SET sample_doc = $1
      WHERE form_id = $2
      RETURNING form_id, sample_doc;
    `;

    const result = await client.query(updateQuery, [s3Key, form_id]);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Control form not found'
      });
    }

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: 'Sampling Excel file uploaded successfully',
      data: {
        form_id: result.rows[0].form_id,
        sample_doc: result.rows[0].sample_doc,
        file_name: fileName
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error uploading sampling Excel file to S3:', error);
    
    res.status(500).json({
      success: false,
      message: 'Error uploading sampling Excel file',
      error: error.message
    });
  } finally {
    client.release();
  }
});


module.exports = router;

