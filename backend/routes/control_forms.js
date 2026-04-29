const express = require('express');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { uploadFileToS3, deleteFileFromS3 } = require('../utils/s3Upload');
const { sendEmail } = require('../utils/send_email');
const { getCcEmailsForRacm } = require('../utils/racm_cc_recipients');
const { decryptToken } = require('../utils/auth_utility');
const { verifyUserAuth } = require('../modules/auth/auth.middleware');
const { logAuditEvent, EXCEL_BULK_RACM_UPLOAD_ACTION } = require('../utils/auditLog');
const { calculateSampleRequired, getSampleSizeByFrequency } = require('../utils/sample_required');
const {
  attachControlFormDocuments,
  getControlFormDocumentRows,
  insertSampleDocument,
  insertUserDocument,
} = require('../utils/racm_documents');
const {
  DUPLICATE_RACM_COMPANY_SCOPED_MESSAGE,
  formatBulkImportZeroInsertedMessage,
  formatBulkImportSuccessMessage,
} = require('../utils/racm_duplicate_key');
const {
  getMissingRacmRequiredFields,
  formatMissingRacmRequiredFields,
} = require('../utils/racm_required_fields');

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
  const recipientName = processOwnerName || 'Control Owner';
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

Portal: ${process.env.VITE_FRONTEND_URL}

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

function buildSentForApprovalEmail({
  approverName,
  userDisplayName,
  formId,
  businessProcess,
  unitName,
  controlNumber,
  financialYear,
  dueDate,
}) {
  const reviewerName = String(approverName || '').trim() || 'Approver';
  const submittedBy = String(userDisplayName || '').trim() || 'User';
  const bp = String(businessProcess || '').trim() || 'N/A';
  const unit = String(unitName || '').trim() || 'N/A';
  const cn = String(controlNumber || '').trim() || 'N/A';
  const fy = String(financialYear || '').trim() || 'N/A';
  const dueDateText = formatDueDateDisplay(dueDate);
  const portalUrl = process.env.VITE_FRONTEND_URL || process.env.FRONTEND_URL || '';

  return {
    subject: `RACM sent for approval - ${bp}`,
    text: `Dear ${reviewerName},

A RACM has been sent for approval.

Submitted by: ${submittedBy}
Financial Year: ${fy}
Business Process: ${bp}
Unit: ${unit}
Control Number: ${cn}

Please review the uploaded documents and Approve/Reject based on your judgement.
${portalUrl ? `\nPortal: ${portalUrl}` : ''}

Regards,
IFC System`,
  };
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
const {
  transformExcelData,
  transformExcelDataWithColumnMapping,
  insertRacmRowsFromTransformedData,
} = require('../utils/racm_bulk_import_from_rows');

const MAX_BULK_IMPORT_ROWS = 5000;

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

/** Design & Implementation block (process owner / user UI). Keep in sync with UserFormDetail groupedApproverFields. */
const DESIGN_IMPLEMENTATION_GROUP_FIELDS = [
  'control_design_procs',
  'control_design_conclusion',
  'design_deficiency_desc',
];

function designImplementationGroupHasAnyValue(row) {
  if (!row || typeof row !== 'object') return false;
  return DESIGN_IMPLEMENTATION_GROUP_FIELDS.some((key) => {
    const v = row[key];
    return v !== null && v !== undefined && v !== '' && String(v).trim() !== '';
  });
}

/** Shallow copy for JSON: omit all three when every value is empty; otherwise return full row. */
function shapeControlFormJsonForProcessOwner(row) {
  const copy = { ...row };
  if (!designImplementationGroupHasAnyValue(copy)) {
    DESIGN_IMPLEMENTATION_GROUP_FIELDS.forEach((k) => {
      delete copy[k];
    });
  }
  return copy;
}

function isDatabaseConnectionError(error) {
  return (
    error?.code === 'ECONNRESET' ||
    error?.code === 'ECONNREFUSED' ||
    error?.code === 'ETIMEDOUT' ||
    String(error?.message || '').includes('ECONNRESET')
  );
}

const INACTIVE_RACM_APPROVER_MESSAGE = 'Approver of this RACM is not active';
const MISSING_UNIT_APPROVER_MESSAGE = 'No approver is assigned for current company unit';
const MISSING_APPROVER_USER_MESSAGE = 'Approver of this RACM does not exist';

async function getControlFormApproverDetails(clientOrPool, formId) {
  const result = await clientOrPool.query(
    `
      SELECT
        cf.form_id,
        cf.control_owner,
        cf.company_identifier,
        cf.unit_id,
        cum.approver_email_id,
        approver.id AS approver_user_id,
        NULLIF(TRIM(approver.emp_name), '') AS approver_name,
        approver.temp_login AS approver_temp_login,
        COALESCE(NULLIF(TRIM(approver.emp_name), ''), NULLIF(TRIM(cum.approver_email_id), '')) AS approver_display_name
      FROM control_forms cf
      LEFT JOIN company_unit_master cum
        ON cum.company_identifier = cf.company_identifier
       AND cum.unit_id = cf.unit_id
      LEFT JOIN ifc_users approver
        ON LOWER(TRIM(approver.email_id)) = LOWER(TRIM(COALESCE(cum.approver_email_id, '')))
      WHERE cf.form_id = $1
      LIMIT 1
    `,
    [formId]
  );

  return result.rows[0] || null;
}

function isApproverTempLogin(details) {
  return Number(details?.approver_temp_login) === 1;
}

function isApproverAssigned(details) {
  return String(details?.approver_email_id || '').trim() !== '';
}

function doesApproverUserExist(details) {
  return details?.approver_user_id !== null && details?.approver_user_id !== undefined;
}

function getApproverSubmissionBlockMessage(details) {
  if (!isApproverAssigned(details)) return MISSING_UNIT_APPROVER_MESSAGE;
  if (!doesApproverUserExist(details)) return MISSING_APPROVER_USER_MESSAGE;
  if (isApproverTempLogin(details)) return INACTIVE_RACM_APPROVER_MESSAGE;
  return '';
}

async function queryAuthenticatedUser(emailId) {
  const userQuery = 'SELECT id, email_id, role, company_identifier FROM ifc_users WHERE email_id = $1';

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

    const jwtSecret = process.env.JWT_SECRET;
    let decoded;

    try {
      decoded = jwt.verify(decryptToken(token), jwtSecret);
    } catch (error) {
      console.error('❌ Invalid or expired token:', error.message);
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }
    
    // Get user details from database to include role and company_identifier
    const userResult = await queryAuthenticatedUser(decoded.email_id);
    
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
    
    console.error('❌ Authentication user lookup failed:', error.message);
    return res.status(isDatabaseConnectionError(error) ? 503 : 500).json({
      success: false,
      message: isDatabaseConnectionError(error)
        ? 'Authentication service temporarily unavailable'
        : 'Authentication lookup failed'
    });
  }
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

    await logAuditEvent(EXCEL_BULK_RACM_UPLOAD_ACTION, userEmail, null, null);

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

// Client-parsed Excel rows → immediate RACM insert (no S3 / excel_files queue)
router.post('/bulk-import-rows', verifyAuth, async (req, res) => {
  try {
    if (req.user.role !== 'company_co') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const companyIdentifier = req.user.company_identifier;
    if (!companyIdentifier || String(companyIdentifier).trim() === '') {
      return res.status(400).json({ success: false, message: 'Company identifier is required' });
    }

    const businessProcess = req.body.businessProcess;
    const financialYear = req.body.financialYear;
    const unitId = req.body.unit_id ? String(req.body.unit_id).trim() : '';
    const rows = req.body.rows;

    const missingRequiredFields = getMissingRacmRequiredFields({
      business_process: businessProcess,
      financial_year: financialYear,
      unit_id: unitId,
    });
    if (missingRequiredFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: formatMissingRacmRequiredFields(missingRequiredFields),
        missingFields: missingRequiredFields,
      });
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No data rows provided' });
    }
    if (rows.length > MAX_BULK_IMPORT_ROWS) {
      return res.status(400).json({
        success: false,
        message: `Too many rows (max ${MAX_BULK_IMPORT_ROWS} per request)`,
      });
    }

    const dueDate = req.body.due_date ? String(req.body.due_date).trim() : '';
    const reminderFrequency = req.body.reminder_frequency ? String(req.body.reminder_frequency).trim() : '';

    if ((dueDate && !reminderFrequency) || (!dueDate && reminderFrequency)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both due_date and reminder_frequency (or keep both empty)',
      });
    }

    if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid due_date format. Expected YYYY-MM-DD',
      });
    }

    if (reminderFrequency) {
      const allowed = new Set(['Daily', 'Weekly', 'Monthly']);
      if (!allowed.has(reminderFrequency)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid reminder_frequency. Allowed values: Daily, Weekly, Monthly',
        });
      }
    }

    const coordinatorEmailId = req.user.email_id;
    const columnMapping = req.body.column_mapping;
    const transformedData =
      columnMapping &&
      typeof columnMapping === 'object' &&
      !Array.isArray(columnMapping) &&
      Object.keys(columnMapping).length > 0
        ? transformExcelDataWithColumnMapping(rows, columnMapping)
        : transformExcelData(rows);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const unitResult = await client.query(
        `
          SELECT unit_id
          FROM company_unit_master
          WHERE company_identifier = $1
            AND unit_id = $2
            AND LOWER(TRIM(COALESCE(coordinator_email_id, ''))) = LOWER(TRIM($3))
          LIMIT 1
        `,
        [companyIdentifier, unitId, coordinatorEmailId]
      );

      if (unitResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: 'Invalid unit selected',
        });
      }

      const importStats = await insertRacmRowsFromTransformedData(client, {
        transformedData,
        companyIdentifier,
        coordinatorEmailId,
        unitId,
        businessProcess: String(businessProcess).trim(),
        financialYear: String(financialYear).trim(),
        fileDueDate: dueDate || null,
        fileReminderFrequency: reminderFrequency || null,
      });
      const {
        insertedCount,
        skippedCount,
        duplicateCount,
        errorCount,
        duplicateControlNumberSamples,
      } = importStats;

      if (insertedCount === 0) {
        await client.query('ROLLBACK');
        await logAuditEvent(EXCEL_BULK_RACM_UPLOAD_ACTION, coordinatorEmailId, null, null);
        return res.status(400).json({
          success: false,
          message: formatBulkImportZeroInsertedMessage(importStats),
          data: {
            insertedCount,
            skippedCount,
            duplicateCount,
            errorCount,
            duplicateControlNumberSamples,
          },
        });
      }

      await client.query('COMMIT');

      await logAuditEvent(EXCEL_BULK_RACM_UPLOAD_ACTION, coordinatorEmailId, null, null);

      return res.status(200).json({
        success: true,
        message: formatBulkImportSuccessMessage(insertedCount, {
          duplicateCount,
          skippedCount,
          errorCount,
        }),
        data: {
          insertedCount,
          skippedCount,
          duplicateCount,
          errorCount,
          duplicateControlNumberSamples,
        },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('bulk-import-rows error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error importing RACMs',
      error: error.message,
    });
  }
});

// Get all RACM forms (with optional company_identifier, control_owner, active, business_process, status, financial_year, sub_process, cycle, and unit filters)
router.get('/', verifyAuth, async (req, res) => {
  try {
    const { company_identifier, control_owner, active, business_process, status, financial_year, cycle, sub_process, unit_id } = req.query;
    
    // Debug logging
    console.log('RACM GET request filters:', {
      company_identifier,
      active,
      business_process,
      status,
      financial_year,
      cycle,
      sub_process,
      unit_id,
    });
    
    let query = `
      SELECT
        cf.*,
        NULLIF(TRIM(cum.unit_name), '') AS unit_name,
        NULLIF(TRIM(u.emp_name), '') AS control_owner_name
      FROM control_forms cf
      LEFT JOIN company_unit_master cum
        ON cum.company_identifier = cf.company_identifier
       AND cum.unit_id = cf.unit_id
      LEFT JOIN ifc_users u
        ON LOWER(TRIM(u.email_id)) = LOWER(TRIM(cf.control_owner))
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
      query += `
        AND EXISTS (
          SELECT 1
          FROM company_unit_master coordinator_units
          WHERE coordinator_units.company_identifier = cf.company_identifier
            AND coordinator_units.unit_id = cf.unit_id
            AND LOWER(TRIM(COALESCE(coordinator_units.coordinator_email_id, ''))) = LOWER(TRIM($${paramIndex}))
        )
      `;
      queryParams.push(req.user.email_id);
      paramIndex++;
    } else if (company_identifier) {
      query += ` AND cf.company_identifier = $${paramIndex}`;
      queryParams.push(company_identifier);
      paramIndex++;
    }

    if (unit_id) {
      query += ` AND cf.unit_id = $${paramIndex}`;
      queryParams.push(String(unit_id).trim());
      paramIndex++;
    }
    
    // Filter by control_owner if provided
    if (control_owner) {
      query += ` AND LOWER(TRIM(cf.control_owner)) = LOWER(TRIM($${paramIndex}))`;
      queryParams.push(control_owner.trim());
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

    // Filter by sub_process if provided (exact trim match)
    if (sub_process) {
      query += ` AND cf.sub_process IS NOT NULL AND TRIM(cf.sub_process) = $${paramIndex}`;
      queryParams.push(sub_process.trim());
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
    await attachControlFormDocuments(pool, result.rows);
    
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

// Get aggregated RACM stats (without loading full RACM rows)
router.get('/stats', verifyAuth, async (req, res) => {
  try {
    const { company_identifier } = req.query;

    let targetCompanyIdentifier = company_identifier;

    // Company coordinator should only see stats for their own company identifier
    if (req.user.role === 'company_co') {
      targetCompanyIdentifier = req.user.company_identifier;
    }

    let query = `
      SELECT
        COUNT(*)::int AS total_racms,
        COUNT(*) FILTER (
          WHERE LOWER(TRIM(COALESCE(status, ''))) = 'approved'
        )::int AS approved_racms,
        COUNT(*) FILTER (
          WHERE LOWER(TRIM(COALESCE(status, ''))) = 'rejected'
        )::int AS rejected_racms
      FROM control_forms
      WHERE 1=1
    `;
    const params = [];

    if (targetCompanyIdentifier) {
      query += ' AND company_identifier = $1';
      params.push(String(targetCompanyIdentifier).trim());
    }

    const result = await pool.query(query, params);
    const row = result.rows[0] || {};

    return res.status(200).json({
      success: true,
      data: {
        totalRacms: Number(row.total_racms || 0),
        approvedRacms: Number(row.approved_racms || 0),
        rejectedRacms: Number(row.rejected_racms || 0),
      },
    });
  } catch (error) {
    console.error('Error fetching RACM stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching RACM stats',
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
    
    // SELECT cf.* returns all RACM columns; unit and approver details are joined for display.
    const query = `
      SELECT
        cf.*,
        cum.unit_name,
        cum.approver_email_id,
        NULLIF(TRIM(approver.emp_name), '') AS approver_name,
        approver.temp_login AS approver_temp_login,
        COALESCE(NULLIF(TRIM(approver.emp_name), ''), NULLIF(TRIM(cum.approver_email_id), '')) AS approver_display_name
      FROM control_forms cf
      LEFT JOIN company_unit_master cum
        ON cum.unit_id = cf.unit_id
       AND cum.company_identifier = cf.company_identifier
      LEFT JOIN ifc_users approver
        ON LOWER(TRIM(approver.email_id)) = LOWER(TRIM(COALESCE(cum.approver_email_id, '')))
      WHERE cf.form_id = $1
    `;
    const result = await pool.query(query, [form_id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'RACM not found'
      });
    }
    
    const formData = result.rows[0];
    await attachControlFormDocuments(pool, [formData]);
    
    // Authorization check: For users with role 'user', verify they are the control_owner
    // company_co and approver roles can still access (existing behavior)
    if (loggedInUserRole === 'user') {
      const processOwnerEmail = (formData.control_owner || '').trim().toLowerCase();
      const userEmail = loggedInUserEmail.trim().toLowerCase();
      
      if (processOwnerEmail !== userEmail) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You are not authorized to view this form.'
        });
      }
    }
    
    const dataForClient =
      loggedInUserRole === 'user'
        ? shapeControlFormJsonForProcessOwner(formData)
        : formData;

    res.status(200).json({
      success: true,
      data: dataForClient
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
    nature_of_control, control_frequency,
    control_number, area,
    risk_heat, process_walkthrough, control_relies_on_ipe,
    audit_evidence_accuracy, key_control, application_name,
    control_performer, control_owner, control_design_procs,
    control_design_conclusion, design_deficiency_desc,
    sample_size, control_type_fo, control_type_ma,
    completeness, existence_occurrence, rights_and_obligation,
    valuation_and_allocation, presentation_and_disclosure,
    due_date, reminder_frequency,
    doc_uploaded_by_user, doc_uploaded_by_user_docs, replace_user_documents, active, status, reason_by_approver, remarks_by_user,
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
        control_owner, 
        standard_control_description, 
        business_process,
        financial_year,
        control_number,
        control_frequency,
        created_at,
        due_date,
        unit_id,
        company_identifier,
        status AS current_status,
        reason_by_approver AS current_reason_by_approver
      FROM control_forms 
      WHERE form_id = $1
    `;
    const currentFormResult = await client.query(getCurrentFormQuery, [form_id]);
    const currentForm = currentFormResult.rows.length > 0 ? currentFormResult.rows[0] : null;
    if (!currentForm) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'RACM not found',
      });
    }

    if (status === 'sent for approval' && req.user?.role === 'user') {
      const processOwnerEmail = String(currentForm.control_owner || '').trim().toLowerCase();
      const userEmail = String(req.user.email_id || '').trim().toLowerCase();

      if (processOwnerEmail !== userEmail) {
        await client.query('ROLLBACK');
        return res.status(403).json({
          success: false,
          message: 'Access denied. You are not authorized to update this form.',
        });
      }

      const approverDetails = await getControlFormApproverDetails(client, form_id);
      const approverBlockMessage = getApproverSubmissionBlockMessage(approverDetails);
      if (approverBlockMessage) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: approverBlockMessage,
        });
      }
    }

    const currentActiveStatus = currentForm?.active && currentForm.active !== '' && currentForm.active !== '0' ? '1' : '0';
    const hasChangesArray = Array.isArray(modifiedChanges) && modifiedChanges.length > 0;
    const hasFieldsArray = Array.isArray(modifiedFields) && modifiedFields.length > 0;
    const assignmentEmail = control_owner !== undefined && control_owner !== null
      ? String(control_owner).trim()
      : '';
    const normalizeAssignmentEmail = (value) =>
      value == null ? '' : String(value).trim().toLowerCase();
    const currentAssignmentEmail = normalizeAssignmentEmail(currentForm?.control_owner);
    const nextAssignmentEmail = normalizeAssignmentEmail(control_owner);
    const assignmentInChangesArray = hasChangesArray && modifiedChanges.some((item) => {
      const col = item?.column_name || item?.column || item?.field;
      return String(col || '').trim() === 'control_owner';
    });
    const assignmentInFieldsArray = hasFieldsArray && modifiedFields.some(
      (col) => String(col || '').trim() === 'control_owner'
    );
    const isControlOwnerChanged = control_owner !== undefined
      && nextAssignmentEmail !== ''
      && nextAssignmentEmail !== currentAssignmentEmail;
    const isAssignmentUpdate = Boolean(
      (assignmentInChangesArray || assignmentInFieldsArray || control_owner !== undefined)
      && isControlOwnerChanged
    );
    const isRacmAssignmentOperation = Boolean(isAssignmentUpdate && assignmentEmail);
    const requestedActiveStatus = active !== undefined
      ? (active === '1' || active === 1 || active === true ? '1' : '0')
      : null;
    const targetOwnerEmail = isRacmAssignmentOperation
      ? assignmentEmail
      : (control_owner !== undefined && control_owner !== null
          ? String(control_owner).trim()
          : String(currentForm?.control_owner || '').trim());
    const shouldValidateOwnerUnit = req.user?.role === 'company_co'
      && targetOwnerEmail
      && (isRacmAssignmentOperation || requestedActiveStatus === '1');

    if (shouldValidateOwnerUnit) {
      const formCompanyIdentifier = currentForm?.company_identifier
        ? String(currentForm.company_identifier).trim()
        : '';
      const formUnitId = currentForm?.unit_id ? String(currentForm.unit_id).trim() : '';

      if (!formUnitId) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: 'RACM unit is missing. Cannot assign a process owner.',
        });
      }

      const ownerUnitResult = await client.query(
        `
          SELECT unit_id
          FROM ifc_users
          WHERE company_identifier = $1
            AND role = 'user'
            AND LOWER(TRIM(email_id)) = LOWER(TRIM($2))
            AND unit_id = $3
          LIMIT 1
        `,
        [formCompanyIdentifier, targetOwnerEmail, formUnitId]
      );

      if (ownerUnitResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: 'Process Owner must be a user from the same unit as this RACM',
        });
      }
    }

    const normalizeUserDocumentUrl = (value) => {
      if (value && typeof value === 'object') {
        return value.doc_uploaded_by_user == null ? '' : String(value.doc_uploaded_by_user).trim();
      }
      return value == null ? '' : String(value).trim();
    };
    const uploadedUserDocumentUrls = Array.isArray(doc_uploaded_by_user_docs)
      ? doc_uploaded_by_user_docs
          .map(normalizeUserDocumentUrl)
          .filter(Boolean)
      : (
          doc_uploaded_by_user !== undefined && doc_uploaded_by_user !== null
            ? [normalizeUserDocumentUrl(doc_uploaded_by_user)].filter(Boolean)
            : []
        );
    const hasUserDocumentUpload = uploadedUserDocumentUrls.length > 0;

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

    const normalizeFrequencyForCompare = (value) =>
      value == null ? '' : String(value).trim().toLowerCase().replace(/&/g, 'and').replace(/[-_]/g, ' ').replace(/\s+/g, ' ');
    const nextControlFrequency = control_frequency !== undefined
      ? (control_frequency ? String(control_frequency).trim() : null)
      : undefined;
    const isControlFrequencyChange = control_frequency !== undefined
      && normalizeFrequencyForCompare(nextControlFrequency) !== normalizeFrequencyForCompare(currentForm?.control_frequency);
    const derivedSampleSize = control_frequency !== undefined
      ? getSampleSizeByFrequency(nextControlFrequency)
      : undefined;
    const sampleSizeForUpdate = control_frequency !== undefined
      ? (derivedSampleSize !== null ? String(derivedSampleSize) : null)
      : undefined;
    const sampleRequiredForUpdate = isControlFrequencyChange
      ? calculateSampleRequired(nextControlFrequency, currentForm?.created_at || new Date())
      : undefined;

    const fieldsToUpdate = {
      standard_control_description, sub_process, risk_description,
      whether_fraud_risks_exist, control_objective, ipe_reference,
      nature_of_control, control_frequency,
      control_number, area,
      risk_heat, process_walkthrough, control_relies_on_ipe,
      audit_evidence_accuracy, key_control, application_name,
      control_performer, control_design_procs,
      control_design_conclusion, design_deficiency_desc,
      sample_size: sampleSizeForUpdate, sample_required: sampleRequiredForUpdate, control_type_fo, control_type_ma,
      completeness, existence_occurrence, rights_and_obligation,
      valuation_and_allocation, presentation_and_disclosure,
      due_date, reminder_frequency,
      status, reason_by_approver, remarks_by_user
    };

    if (!isRacmAssignmentOperation && control_owner !== undefined && nextAssignmentEmail !== currentAssignmentEmail) {
      fieldsToUpdate.control_owner = control_owner;
    }
    if (!(isRacmAssignmentOperation && active !== undefined) && active !== undefined) {
      fieldsToUpdate.active = active;
    }

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

    // If user is resubmitting after rejection, only clear the previous live approver reason.
    const isResubmission = status === 'sent for approval'
      && currentForm
      && currentForm.current_status === 'Rejected';

    if (isResubmission) {
      const previousReason = currentForm.current_reason_by_approver;

      if (previousReason && String(previousReason).trim() !== '') {
        updateFields.push(`reason_by_approver = $${paramIndex}`);
        updateValues.push(null);
        paramIndex++;
      }
    }

    if (updateFields.length === 0 && !isRacmAssignmentOperation && active === undefined && !hasUserDocumentUpload) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    if (control_number !== undefined && currentForm) {
      const cid = currentForm.company_identifier ? String(currentForm.company_identifier).trim() : '';
      const nextBp =
        currentForm.business_process != null ? String(currentForm.business_process).trim() : '';
      const nextFy =
        currentForm.financial_year != null ? String(currentForm.financial_year).trim() : '';
      const nextCn = control_number != null ? String(control_number).trim() : '';
      if (cid && nextBp && nextFy && nextCn) {
        const dupUpdate = await client.query(
          `
            SELECT 1
            FROM control_forms
            WHERE company_identifier = $1
              AND LOWER(TRIM(business_process)) = LOWER(TRIM($2))
              AND TRIM(financial_year) = TRIM($3)
              AND TRIM(control_number) = TRIM($4)
              AND TRIM(form_id) <> TRIM($5)
            LIMIT 1
          `,
          [cid, nextBp, nextFy, nextCn, form_id]
        );
        if (dupUpdate.rows.length > 0) {
          await client.query('ROLLBACK');
          return res.status(409).json({
            success: false,
            message: DUPLICATE_RACM_COMPANY_SCOPED_MESSAGE,
          });
        }
      }
    }

    let result;
    try {
      if (updateFields.length > 0) {
        // Add form_id as the last parameter
        updateValues.push(form_id);

        const updateQuery = `
          UPDATE control_forms
          SET ${updateFields.join(', ')}
          WHERE form_id = $${paramIndex}
          RETURNING *;
        `;

        result = await client.query(updateQuery, updateValues);
      } else {
        // Ensure result is still available for pure assignment flows.
        result = await client.query(
          'SELECT * FROM control_forms WHERE form_id = $1',
          [form_id]
        );
      }

      // RACM Assignment operation must be two separate SQL updates:
      // 1) assign control_owner, 2) set active.
      if (isRacmAssignmentOperation) {
        const assignmentResult = await client.query(
          `
            UPDATE control_forms
            SET control_owner = $1
            WHERE form_id = $2
            RETURNING *;
          `,
          [assignmentEmail, form_id]
        );
        result = assignmentResult;

        if (active !== undefined) {
          const normalizedActive = active === '1' || active === 1 || active === true ? '1' : '0';
          if (normalizedActive !== currentActiveStatus) {
            const activeResult = await client.query(
              `
                UPDATE control_forms
                SET active = $1
                WHERE form_id = $2
                RETURNING *;
              `,
              [normalizedActive, form_id]
            );
            result = activeResult;
          }
        }
      }

      if (result.rows.length > 0) {
        if (replace_user_documents === true) {
          const existingUserDocsResult = await client.query(
            `
              SELECT id, doc_uploaded_by_user
              FROM doc_uploaded_by_user
              WHERE form_id = $1
              ORDER BY id ASC
            `,
            [form_id]
          );
          const replacementDocSet = new Set(uploadedUserDocumentUrls);
          const docsToDeleteFromS3 = existingUserDocsResult.rows
            .map((row) => row.doc_uploaded_by_user == null ? '' : String(row.doc_uploaded_by_user).trim())
            .filter((docUrl) => docUrl && !replacementDocSet.has(docUrl));

          for (const docUrl of docsToDeleteFromS3) {
            await deleteFileFromS3(docUrl);
          }

          await client.query(
            'DELETE FROM doc_uploaded_by_user WHERE form_id = $1',
            [form_id]
          );
        }

        for (const userDocUrl of uploadedUserDocumentUrls) {
          await insertUserDocument(client, form_id, userDocUrl);
        }
      }
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

    const updatedRow = result.rows[0];

    await client.query('COMMIT');

    // Log audit event when RACM is submitted for approval (e.g. user flow in UserFormDetail)
    if (status === 'sent for approval' && req.user && req.user.email_id) {
      await logAuditEvent('Sent RACM for approval', req.user.email_id, form_id, null);
    }

    // Log audit events for RACM assignment/modifications (store payload in ref_data as TEXT)
    if (req.user && req.user.email_id) {
      // Assignment-specific audit log: action + assigned user email in ref_data.
      if (isRacmAssignmentOperation) {
        await logAuditEvent('RACM Assignment', req.user.email_id, form_id, assignmentEmail);
        if (active !== undefined) {
          const newActiveStatus = active === '1' || active === 1 || active === true ? '1' : '0';
          if (newActiveStatus !== currentActiveStatus) {
            const action = newActiveStatus === '1' ? 'Set RACM Active' : 'Set RACM Inactive';
            await logAuditEvent(action, req.user.email_id, form_id);
          }
        }
      }

      if (hasChangesArray) {
        const nonAssignmentChanges = modifiedChanges.filter((item) => {
          const col = item?.column_name || item?.column || item?.field;
          const normalizedCol = String(col || '').trim()
          return (
            normalizedCol !== 'control_owner' &&
            normalizedCol !== 'due_date' &&
            normalizedCol !== 'reminder_frequency'
          );
        });
        if (nonAssignmentChanges.length > 0) {
          await logAuditEvent('RACM Modification', req.user.email_id, form_id, JSON.stringify(nonAssignmentChanges));
        }
      } else if (hasFieldsArray) {
        // Fallback for older clients
        const nonAssignmentFields = modifiedFields.filter(
          (col) => {
            const normalizedCol = String(col || '').trim()
            return (
              normalizedCol !== 'control_owner' &&
              normalizedCol !== 'due_date' &&
              normalizedCol !== 'reminder_frequency'
            )
          }
        );
        if (nonAssignmentFields.length > 0) {
          const refData = JSON.stringify(nonAssignmentFields.map((col) => ({ column_name: col })));
          await logAuditEvent('RACM Modification', req.user.email_id, form_id, refData);
        }
      }
    }

    // Log audit when RACM active flag changes (non-assignment flows only)
    if (!isRacmAssignmentOperation && active !== undefined && currentForm && req.user && req.user.email_id) {
      const newActiveStatus = active === '1' || active === 1 || active === true ? '1' : '0';
      if (newActiveStatus !== currentActiveStatus) {
        const action = newActiveStatus === '1' ? 'Set RACM Active' : 'Set RACM Inactive';
        await logAuditEvent(action, req.user.email_id, form_id);
      }
    }

    // Send email to control_owner if active status changed
    if (active !== undefined && currentForm) {
      const newActiveStatus = active === '1' || active === 1 || active === true ? '1' : '0';
      const processOwnerEmail = updatedRow?.control_owner ? String(updatedRow.control_owner).trim() : '';
      if (newActiveStatus !== currentActiveStatus && processOwnerEmail) {
        const businessProcess = currentForm.business_process || '';
        const formCompanyIdentifier = updatedRow?.company_identifier || currentForm.company_identifier || '';
        const getProcessOwnerNameQuery = `
          SELECT emp_name
          FROM ifc_users
          WHERE company_identifier = $1
            AND role = 'user'
            AND LOWER(TRIM(email_id)) = LOWER(TRIM($2))
          LIMIT 1
        `;
        const processOwnerResult = await client.query(getProcessOwnerNameQuery, [formCompanyIdentifier, processOwnerEmail]);
        if (processOwnerResult.rows.length === 0) {
          console.warn(
            `Skipping RACM status email for ${form_id}: recipient ${processOwnerEmail} does not exist as a user in company ${formCompanyIdentifier}.`
          );
        } else {
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
          const dueDateForEmail = updatedRow?.due_date || currentForm.due_date;
          const emailPayload = buildControlFormStatusEmail(
            statusLabel,
            businessProcess,
            processOwnerName,
            coordinatorName,
            coordinatorCompanyName,
            dueDateForEmail,
            form_id
          );

          if (emailPayload.shouldSend) {
            // Small delay to ensure user creation email (if user was just created) is sent first.
            await new Promise(resolve => setTimeout(resolve, 500));

            const ccEmails = await getCcEmailsForRacm({
              companyIdentifier: formCompanyIdentifier,
              businessProcess,
              unitId: updatedRow?.unit_id || currentForm.unit_id,
              excludeEmail: processOwnerEmail,
            });
            const emailSent = await sendEmail(processOwnerEmail, emailPayload.subject, emailPayload.text, {
              cc: ccEmails,
            });
            if (!emailSent) {
              console.warn(`Warning: Failed to send status update email to ${processOwnerEmail}, but form was updated successfully.`);
            } else {
              console.log(`✓ Form status update email sent successfully to ${processOwnerEmail}`);
            }
          }
        }
      }
    }

    // Notify intended approver when user submits RACM for approval.
    if (status === 'sent for approval' && req.user?.role === 'user') {
      try {
        const approverDetails = await getControlFormApproverDetails(client, form_id);
        const approverEmail = String(approverDetails?.approver_email_id || '').trim();
        if (approverEmail) {
          const unitNameResult = await client.query(
            `
              SELECT NULLIF(TRIM(unit_name), '') AS unit_name
              FROM company_unit_master
              WHERE company_identifier = $1
                AND unit_id = $2
              LIMIT 1
            `,
            [
              updatedRow?.company_identifier || currentForm?.company_identifier,
              updatedRow?.unit_id || currentForm?.unit_id,
            ]
          );
          const resolvedUnitName = unitNameResult.rows[0]?.unit_name || updatedRow?.unit_id || currentForm?.unit_id || '';

          const userDisplayNameResult = await client.query(
            `
              SELECT COALESCE(NULLIF(TRIM(emp_name), ''), LOWER(TRIM(email_id))) AS display_name
              FROM ifc_users
              WHERE LOWER(TRIM(email_id)) = LOWER(TRIM($1))
              LIMIT 1
            `,
            [req.user.email_id]
          );
          const userDisplayName = userDisplayNameResult.rows[0]?.display_name || req.user.email_id;

          const payload = buildSentForApprovalEmail({
            approverName: approverDetails?.approver_name,
            userDisplayName,
            formId: form_id,
            businessProcess: updatedRow?.business_process || currentForm?.business_process,
            unitName: resolvedUnitName,
            controlNumber: updatedRow?.control_number || currentForm?.control_number,
            financialYear: updatedRow?.financial_year || currentForm?.financial_year,
            dueDate: updatedRow?.due_date || currentForm?.due_date,
          });

          const ccEmails = await getCcEmailsForRacm({
            companyIdentifier: updatedRow?.company_identifier || currentForm?.company_identifier,
            businessProcess: updatedRow?.business_process || currentForm?.business_process,
            unitId: updatedRow?.unit_id || currentForm?.unit_id,
            excludeEmail: approverEmail,
          });

          const emailSent = await sendEmail(approverEmail, payload.subject, payload.text, { cc: ccEmails });
          if (!emailSent) {
            console.warn(`Warning: failed to send sent-for-approval email to approver for form ${form_id}`);
          }
        }
      } catch (notifyError) {
        console.error('Error sending sent-for-approval approver email:', notifyError);
      }
    }

    await attachControlFormDocuments(client, [updatedRow]);
    const dataForClient =
      req.user.role === 'user'
        ? shapeControlFormJsonForProcessOwner(updatedRow)
        : updatedRow;

    res.status(200).json({
      success: true,
      message: 'RACM updated successfully',
      data: dataForClient
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
    let getFormsQuery = 'SELECT form_id, control_owner, standard_control_description, active, company_identifier, business_process, unit_id FROM control_forms WHERE 1=1';
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
        if (form.control_owner && form.control_owner.trim()) {
          const processOwnerEmail = form.control_owner.trim();
          const wasActive = form.active && form.active !== '' && form.active !== '0';
          
          // Only send email if status is actually changing (from inactive to active)
          if (!wasActive) {
            // Avoid sending duplicate emails to the same process owner
            if (!uniqueProcessOwners.has(processOwnerEmail)) {
              uniqueProcessOwners.set(processOwnerEmail, []);
            }
            uniqueProcessOwners.get(processOwnerEmail).push({
              form_id: form.form_id,
              description: form.standard_control_description || 'Control Form',
              company_identifier: form.company_identifier || userCompanyIdentifier || '',
              business_process: form.business_process || '',
              unit_id: form.unit_id || '',
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
Dear Control Owner,

This is to inform you that the following RACM(s) have been set to Active:

${formList}

Total Forms: ${forms.length}

Please ensure all necessary actions are taken accordingly.

Best regards,
IFC System
        `;

        const ccSet = new Set();
        for (const form of forms) {
          const ccEmailsForForm = await getCcEmailsForRacm({
            companyIdentifier: form.company_identifier,
            businessProcess: form.business_process,
            unitId: form.unit_id,
            excludeEmail: email,
          });
          ccEmailsForForm.forEach((ccEmail) => ccSet.add(ccEmail));
        }

        emailPromises.push(sendEmail(email, emailSubject, emailText, { cc: Array.from(ccSet) }));
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

// Bulk set due_date and reminder_frequency for specific RACM(s)
router.post('/bulk-set-due-date', verifyAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const userRole = req.user?.role;
    if (userRole !== 'company_co') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const companyIdentifier = req.user?.company_identifier;
    if (!companyIdentifier) {
      return res.status(400).json({ success: false, message: 'Company identifier is required' });
    }

    const formIdsRaw = req.body?.form_ids;
    const dueDate = req.body?.due_date ? String(req.body.due_date).trim() : '';
    const reminderFrequency = req.body?.reminder_frequency ? String(req.body.reminder_frequency).trim() : '';

    if (!Array.isArray(formIdsRaw) || formIdsRaw.length === 0) {
      return res.status(400).json({ success: false, message: 'form_ids is required' });
    }

    // Require both inputs (same policy used in bulk upload)
    if (!dueDate || !reminderFrequency) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both due_date and reminder_frequency',
      });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid due_date format. Expected YYYY-MM-DD',
      });
    }

    const allowed = new Set(['Daily', 'Weekly', 'Monthly']);
    if (!allowed.has(reminderFrequency)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reminder_frequency. Allowed values: Daily, Weekly, Monthly',
      });
    }

    const formIds = [...new Set(formIdsRaw.map((v) => String(v).trim()).filter(Boolean))];
    if (formIds.length === 0) {
      return res.status(400).json({ success: false, message: 'form_ids is required' });
    }

    await client.query('BEGIN');

    // Only update RACMs that belong to the coordinator's company.
    const eligible = await client.query(
      `SELECT form_id FROM control_forms WHERE company_identifier = $1 AND form_id = ANY($2::text[])`,
      [companyIdentifier, formIds]
    );
    const eligibleFormIds = eligible.rows.map((r) => r.form_id);

    if (eligibleFormIds.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'No matching RACM(s) found' });
    }

    // Reset reminder_datetime so the reminder scheduler starts from the new due date/frequency.
    const update = await client.query(
      `
      UPDATE control_forms
      SET due_date = $1,
          reminder_frequency = $2,
          reminder_datetime = NULL
      WHERE company_identifier = $3
        AND form_id = ANY($4::text[])
      `,
      [dueDate, reminderFrequency, companyIdentifier, eligibleFormIds]
    );

    await client.query('COMMIT');

    // Audit: one row per RACM for traceability.
    if (req.user?.email_id) {
      for (const fid of eligibleFormIds) {
        await logAuditEvent('Set Due Date', req.user.email_id, fid);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Updated due date for ${eligibleFormIds.length} RACM(s)`,
      updatedCount: eligibleFormIds.length,
      skippedCount: formIds.length - eligibleFormIds.length,
    });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {}
    console.error('Error bulk setting due date:', error);
    return res.status(500).json({
      success: false,
      message: 'Error bulk setting due date',
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
    nature_of_control, control_frequency,
    control_number, area, risk_heat,
    process_walkthrough, control_relies_on_ipe, audit_evidence_accuracy,
    key_control, application_name, control_performer, control_owner,
    control_type_fo, control_type_ma,
    company_identifier, business_process, financial_year, unit_id,
    completeness, existence_occurrence, rights_and_obligation,
    valuation_and_allocation, presentation_and_disclosure
  } = req.body;

  const unitId = unit_id != null ? String(unit_id).trim() : '';
  const missingRequiredFields = getMissingRacmRequiredFields({
    business_process,
    financial_year,
    unit_id: unitId,
  });
  if (missingRequiredFields.length > 0) {
    return res.status(400).json({
      success: false,
      message: formatMissingRacmRequiredFields(missingRequiredFields),
      missingFields: missingRequiredFields,
    });
  }

  const dueDateRaw = req.body.due_date != null ? String(req.body.due_date).trim() : '';
  const reminderFrequencyRaw =
    req.body.reminder_frequency != null ? String(req.body.reminder_frequency).trim() : '';
  const hasDueDate = !!dueDateRaw;
  const hasReminderFrequency = !!reminderFrequencyRaw;
  if (hasDueDate !== hasReminderFrequency) {
    return res.status(400).json({
      success: false,
      message: 'Please provide both due_date and reminder_frequency, or keep both empty',
    });
  }
  if (hasDueDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDateRaw)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid due_date format. Expected YYYY-MM-DD',
      });
    }
    const allowedReminder = new Set(['Daily', 'Weekly', 'Monthly']);
    if (!allowedReminder.has(reminderFrequencyRaw)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reminder_frequency. Allowed values: Daily, Weekly, Monthly',
      });
    }
  }

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

    if (req.user.role === 'company_co') {
      const unitResult = await client.query(
        `
          SELECT unit_id
          FROM company_unit_master
          WHERE company_identifier = $1
            AND unit_id = $2
            AND LOWER(TRIM(COALESCE(coordinator_email_id, ''))) = LOWER(TRIM($3))
          LIMIT 1
        `,
        [userCompanyIdentifier, unitId, req.user.email_id]
      );

      if (unitResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: 'Invalid unit selected',
        });
      }
    }

    // Prevent duplicate RACM creation (company_identifier + business_process + financial_year + control_number)
    // Note: apply only when all key fields are present.
    const bpKey = business_process != null ? String(business_process).trim() : ''
    const fyKey = financial_year != null ? String(financial_year).trim() : ''
    const cnKey = control_number != null ? String(control_number).trim() : ''
    if (userCompanyIdentifier && bpKey && fyKey && cnKey) {
      const dup = await client.query(
        `
          SELECT 1
          FROM control_forms
          WHERE company_identifier = $1
            AND LOWER(TRIM(business_process)) = LOWER(TRIM($2))
            AND TRIM(financial_year) = TRIM($3)
            AND TRIM(control_number) = TRIM($4)
          LIMIT 1
        `,
        [userCompanyIdentifier, bpKey, fyKey, cnKey]
      )
      if (dup.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          success: false,
          message: DUPLICATE_RACM_COMPANY_SCOPED_MESSAGE,
        });
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
        nature_of_control, control_frequency,
        control_number, area, risk_heat,
        process_walkthrough, control_relies_on_ipe, audit_evidence_accuracy,
        key_control, application_name, control_performer, control_owner,
        sample_size, control_type_fo, control_type_ma,
        form_id, company_identifier, business_process, financial_year, unit_id, sample_required,
        due_date, reminder_frequency,
        completeness, existence_occurrence, rights_and_obligation,
        valuation_and_allocation, presentation_and_disclosure
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34)
      RETURNING *;
    `;

    const result = await client.query(insertQuery, [
      standard_control_description, sub_process, risk_description,
      whether_fraud_risks_exist, control_objective, ipe_reference,
      nature_of_control, control_frequency,
      control_number || null, area || null, risk_heat || null,
      process_walkthrough || null, control_relies_on_ipe || null, audit_evidence_accuracy || null,
      key_control || null, application_name || null, control_performer || null, control_owner || null,
      sampleSize !== null ? String(sampleSize) : null, control_type_fo || null, control_type_ma || null,
      formId, userCompanyIdentifier, business_process, financial_year || null, unitId, sampleRequired,
      hasDueDate ? dueDateRaw : null,
      hasReminderFrequency ? reminderFrequencyRaw : null,
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
      'control_owner',
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
    const skippedDuplicates = [];

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

      // Prevent duplicate RACM creation (same company + business_process + financial_year + control_number)
      try {
        const companyId = coordinatorCompany || insertObj.company_identifier || null
        const bpKey = insertObj.business_process != null ? String(insertObj.business_process).trim() : ''
        const fyKey = insertObj.financial_year != null ? String(insertObj.financial_year).trim() : ''
        const cnKey = insertObj.control_number != null ? String(insertObj.control_number).trim() : ''
        if (companyId && bpKey && fyKey && cnKey) {
          const dup = await client.query(
            `
              SELECT 1
              FROM control_forms
              WHERE company_identifier = $1
                AND LOWER(TRIM(business_process)) = LOWER(TRIM($2))
                AND TRIM(financial_year) = TRIM($3)
                AND TRIM(control_number) = TRIM($4)
              LIMIT 1
            `,
            [companyId, bpKey, fyKey, cnKey]
          )
          if (dup.rows.length > 0) {
            skippedDuplicates.push(row.form_id)
            continue
          }
        }
      } catch (e) {
        console.error('[control_forms replicate] duplicate check error:', e)
      }

      const currentTimestamp = new Date();
      const controlFrequencyValue = insertObj.control_frequency ? String(insertObj.control_frequency).trim() : null;

      // Recompute Sample Required from the RACM creation timestamp.
      try {
        if ('sample_required' in insertObj) {
          insertObj.sample_required = calculateSampleRequired(controlFrequencyValue, currentTimestamp);
        }
      } catch (e) {
        console.error('[control_forms replicate] sample_required recalculation error:', e);
      }

      // Recompute sample_size if it exists in schema (based on control_frequency)
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
      skipped_duplicates: skippedDuplicates.length,
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

    // Check if form exists.
    const checkQuery = `
      SELECT 
        id, 
        company_identifier
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

    // Delete all sample and user-uploaded documents from S3 before deleting DB rows.
    const { sampleDocsByFormId, userDocsByFormId } = await getControlFormDocumentRows(client, [form_id]);
    const sampleDocs = sampleDocsByFormId.get(form_id) || [];
    const userDocs = userDocsByFormId.get(form_id) || [];
    const docUrlsToDelete = Array.from(
      new Set(
        [
          ...userDocs.map((doc) => doc.doc_uploaded_by_user),
          ...sampleDocs.map((doc) => doc.sample_doc),
        ]
          .map((value) => (value == null ? '' : String(value).trim()))
          .filter(Boolean)
      )
    );

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

    const deletedUserDocsResult = await client.query(
      'DELETE FROM doc_uploaded_by_user WHERE form_id = $1',
      [form_id]
    );
    const deletedSampleDocsResult = await client.query(
      'DELETE FROM sample_docs WHERE form_id = $1',
      [form_id]
    );

    // Delete the RACM
    const deleteQuery = 'DELETE FROM control_forms WHERE form_id = $1';
    await client.query(deleteQuery, [form_id]);

    await client.query('COMMIT');

    // Log audit event
    await logAuditEvent('RACM deleted', userEmail, form_id);

    res.status(200).json({
      success: true,
      message: 'RACM deleted successfully',
      deleted_documents: {
        s3_objects: docUrlsToDelete.length,
        user_uploaded_rows: deletedUserDocsResult.rowCount,
        sample_doc_rows: deletedSampleDocsResult.rowCount,
      }
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

router.get('/:form_id/approver-status', verifyUserAuth, async (req, res) => {
  const { form_id } = req.params;

  try {
    const approverDetails = await getControlFormApproverDetails(pool, form_id);

    if (!approverDetails) {
      return res.status(404).json({
        success: false,
        message: 'RACM not found',
      });
    }

    const processOwnerEmail = String(approverDetails.control_owner || '').trim().toLowerCase();
    const userEmail = String(req.user?.email_id || '').trim().toLowerCase();

    if (processOwnerEmail !== userEmail) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not authorized to view this form.',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        approver_email_id: approverDetails.approver_email_id || null,
        approver_name: approverDetails.approver_name || null,
        approver_display_name: approverDetails.approver_display_name || approverDetails.approver_email_id || null,
        approver_user_id: approverDetails.approver_user_id || null,
        approver_temp_login: approverDetails.approver_temp_login,
        approver_assigned: isApproverAssigned(approverDetails),
        approver_exists: doesApproverUserExist(approverDetails),
        approver_active: doesApproverUserExist(approverDetails) && !isApproverTempLogin(approverDetails),
      },
    });
  } catch (error) {
    console.error('Error checking RACM approver status:', error);
    return res.status(500).json({
      success: false,
      message: 'Error checking RACM approver status',
      error: error.message,
    });
  }
});

// Upload user document for a specific form
// NOTE: This route now ONLY uploads to S3 and does NOT modify any table columns.
// The control_forms row is updated later when the user actually resubmits the form.
router.post(
  '/:form_id/upload-document',
  verifyUserAuth,
  uploadUserDoc.fields([
    { name: 'documents', maxCount: 20 },
    { name: 'document', maxCount: 1 },
  ]),
  async (req, res) => {
  const { form_id } = req.params;
  const files = [
    ...((req.files && req.files.documents) || []),
    ...((req.files && req.files.document) || []),
  ];
  
  if (files.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No files uploaded'
    });
  }

  try {
    const approverDetails = await getControlFormApproverDetails(pool, form_id);

    if (!approverDetails) {
      return res.status(404).json({
        success: false,
        message: 'RACM not found',
      });
    }

    const processOwnerEmail = String(approverDetails.control_owner || '').trim().toLowerCase();
    const userEmail = String(req.user?.email_id || '').trim().toLowerCase();

    if (processOwnerEmail !== userEmail) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not authorized to update this form.',
      });
    }

    const approverBlockMessage = getApproverSubmissionBlockMessage(approverDetails);
    if (approverBlockMessage) {
      return res.status(400).json({
        success: false,
        message: approverBlockMessage,
      });
    }

    const uploadedDocs = [];

    for (const file of files) {
      const fileName = file.originalname;
      const fileBuffer = file.buffer;

      // Upload file to S3
      console.log(`Uploading user document to S3: ${fileName}`);
      const s3Key = await uploadFileToS3(fileBuffer, fileName, `IFC/user_docs/${form_id}`, {
        preserveFileName: true,
      });
      console.log(`User document uploaded to S3 with key: ${s3Key}`);

      uploadedDocs.push({
        doc_uploaded_by_user: s3Key,
        file_name: fileName,
      });
    }

    const latestDoc = uploadedDocs[uploadedDocs.length - 1] || null;

    // Do NOT update control_forms here; just return the S3 key to the frontend
    res.status(200).json({
      success: true,
      message: uploadedDocs.length === 1
        ? 'Document uploaded successfully'
        : 'Documents uploaded successfully',
      data: {
        form_id,
        doc_uploaded_by_user: latestDoc?.doc_uploaded_by_user || null,
        doc_uploaded_by_user_docs: uploadedDocs,
        file_names: uploadedDocs.map((doc) => doc.file_name)
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
    const formResult = await client.query('SELECT 1 FROM control_forms WHERE form_id = $1 LIMIT 1', [form_id]);
    if (formResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'RACM not found',
      });
    }

    const sampleResult = await client.query(
      'SELECT 1 FROM sample_docs WHERE form_id = $1 AND NULLIF(TRIM(sample_doc), \'\') IS NOT NULL LIMIT 1',
      [form_id]
    );
    const exists = sampleResult.rows.length > 0;

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

// Delete one sample document for a RACM
router.delete('/:form_id/sample-docs/:sample_doc_id', verifyAuth, async (req, res) => {
  const { form_id, sample_doc_id } = req.params;
  const client = await pool.connect();

  try {
    if (!/^\d+$/.test(String(sample_doc_id || ''))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid sample document id',
      });
    }

    if (req.user?.role !== 'company_co') {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    await client.query('BEGIN');

    const docResult = await client.query(
      `
        SELECT sd.id, sd.form_id, sd.sample_doc, cf.company_identifier
        FROM sample_docs sd
        JOIN control_forms cf ON cf.form_id = sd.form_id
        WHERE sd.id = $1 AND sd.form_id = $2
        LIMIT 1
      `,
      [sample_doc_id, form_id]
    );

    if (docResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Sample document not found',
      });
    }

    const sampleDoc = docResult.rows[0];
    const userCompanyIdentifier = String(req.user?.company_identifier || '').trim();
    const formCompanyIdentifier = String(sampleDoc.company_identifier || '').trim();
    if (userCompanyIdentifier && formCompanyIdentifier && userCompanyIdentifier !== formCompanyIdentifier) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only delete sample documents from your own company.',
      });
    }

    const s3Key = String(sampleDoc.sample_doc || '').trim();
    if (s3Key) {
      await deleteFileFromS3(s3Key);
    }

    await client.query(
      'DELETE FROM sample_docs WHERE id = $1 AND form_id = $2',
      [sample_doc_id, form_id]
    );

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: 'Sample document deleted successfully',
      data: {
        id: sampleDoc.id,
        form_id,
        sample_doc: sampleDoc.sample_doc,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting sample document:', error);
    return res.status(500).json({
      success: false,
      message: 'Error deleting sample document',
      error: error.message,
    });
  } finally {
    client.release();
  }
});

// Upload one or more sampling Excel files for a specific form
router.post(
  '/:form_id/upload-sampling-excel',
  verifyAuth,
  upload.fields([
    { name: 'excelFiles', maxCount: 20 },
    { name: 'excelFile', maxCount: 1 },
  ]),
  async (req, res) => {
  const { form_id } = req.params;
  const files = [
    ...((req.files && req.files.excelFiles) || []),
    ...((req.files && req.files.excelFile) || []),
  ];
  
  if (files.length === 0) {
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

    const sampleDocs = [];
    for (const file of files) {
      const fileName = file.originalname;
      const fileBuffer = file.buffer;

      // Upload file to S3 in IFC/sample_docs path
      console.log(`Uploading sampling Excel file to S3: ${fileName}`);
      const s3Key = await uploadFileToS3(fileBuffer, fileName, `IFC/sample_docs/${form_id}`, {
        preserveFileName: true,
      });
      console.log(`Sampling Excel file uploaded to S3 with key: ${s3Key}`);

      const sampleDoc = await insertSampleDocument(client, form_id, s3Key);
      if (sampleDoc) {
        sampleDocs.push(sampleDoc);
      }
    }

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: 'Sampling Excel file(s) uploaded successfully',
      data: {
        form_id,
        sample_doc: sampleDocs[sampleDocs.length - 1]?.sample_doc || null,
        sample_docs: sampleDocs,
        file_names: files.map((file) => file.originalname)
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
