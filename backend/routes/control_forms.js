const express = require('express');
const { Pool } = require('pg');
const multer = require('multer');
const XLSX = require('xlsx');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { normalizeColumnName } = require('../utils/column_mapping');
const { uploadFileToS3 } = require('../utils/s3Upload');
const { logAuditEvent } = require('../utils/auditLog');

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

const router = express.Router();

// Test route to verify routes are working (no auth required)
router.get('/test-route', (req, res) => {
  console.log('🧪 TEST ROUTE HIT - Routes are working!');
  console.log('Request path:', req.path);
  console.log('Request method:', req.method);
  res.json({ success: true, message: 'Test route is working!', timestamp: new Date().toISOString() });
});

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

    // Save S3 key to excel_files table with processed = 0, company_identifier, coordinator_email_id, and business_process
    const insertFileQuery = `
      INSERT INTO excel_files (file_path, file_name, processed, company_identifier, coordinator_email_id, business_process)
      VALUES ($1, $2, 0, $3, $4, $5)
      RETURNING id;
    `;

    const fileResult = await client.query(insertFileQuery, [
      s3Key, // Store S3 key instead of local file path
      fileName,
      companyIdentifier,
      userEmail, // coordinator_email_id
      businessProcess // business_process
    ]);

    await client.query('COMMIT');

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

// Get all control forms (with optional company_identifier, process_owner, active, and business_process filters)
router.get('/', verifyAuth, async (req, res) => {
  try {
    const { company_identifier, process_owner, active, business_process } = req.query;
    
    let query = 'SELECT * FROM control_forms WHERE 1=1';
    const queryParams = [];
    let paramIndex = 1;
    
    // Filter by company_identifier if provided
    if (company_identifier) {
      query += ` AND company_identifier = $${paramIndex}`;
      queryParams.push(company_identifier);
      paramIndex++;
    }
    
    // Filter by process_owner if provided
    if (process_owner) {
      query += ` AND process_owner = $${paramIndex}`;
      queryParams.push(process_owner);
      paramIndex++;
    }
    
    // Filter by business_process if provided
    if (business_process) {
      // Use case-insensitive comparison and handle NULL values
      query += ` AND business_process IS NOT NULL AND LOWER(TRIM(business_process)) = $${paramIndex}`;
      queryParams.push(business_process.trim().toLowerCase());
      paramIndex++;
    }
    
    // Filter by active status if provided
    if (active !== undefined) {
      if (active === 'true' || active === '1') {
        // Active: not null, not empty, and not '0'
        query += ` AND active IS NOT NULL AND active != '' AND active != '0'`;
      } else if (active === 'false' || active === '0') {
        // Inactive: null, empty, or '0'
        query += ` AND (active IS NULL OR active = '' OR active = '0')`;
      }
    }
    
    query += ' ORDER BY created_at DESC';
    
    const result = await pool.query(query, queryParams);
    
    res.status(200).json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching control forms:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching control forms'
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

// Get single control form by form_id
router.get('/:form_id', verifyAuth, async (req, res) => {
  try {
    const { form_id } = req.params;
    
    const query = 'SELECT * FROM control_forms WHERE form_id = $1';
    const result = await pool.query(query, [form_id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Control form not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching control form:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching control form'
    });
  }
});

// Update single control form by form_id
router.put('/:form_id', verifyAuth, async (req, res) => {
  const { form_id } = req.params;
const {
    description_of_control, process, sub_process, risk_description,
    whether_fraud_risks_exist, control_objective, control_to_address,
    mrc_or_not, source_data_report_logic_report_parameters,
    relevant_data_elements_of_ipe, type_of_control, nature_of_control,
    type_of_risk_mitigation_method, process_owner, reviewer_process_supervisor,
    control_frequency, basis_of_sampling, docs_to_review_for_dms_audit,
    type_of_risk_associated, financial_reporting, checks_performed,
    effective_or_not_effective, done, findings, gap_description_resolution,
    doc_uploaded_by_user, active, status, reason_by_approver, remarks_by_user
  } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Check if user is an approver (only approvers can edit checks_performed, effective_or_not_effective, done, findings)
    const isApprover = !!req.cookies.approverAuthToken;
    
    // Fields that only approvers can update
    const approverOnlyFields = ['checks_performed', 'effective_or_not_effective', 'done', 'findings'];
    
    // If user is not an approver, remove approver-only fields from the update
    if (!isApprover) {
      // Check if user is trying to update approver-only fields
      const attemptedApproverFields = approverOnlyFields.filter(field => 
        req.body[field] !== undefined
      );
      
      if (attemptedApproverFields.length > 0) {
        await client.query('ROLLBACK');
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to update these fields. Only approvers can update: checks_performed, effective_or_not_effective, done, findings'
        });
      }
    }

    // Build dynamic update query - exclude created_at to preserve original timestamp
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    const fieldsToUpdate = {
      description_of_control, process, sub_process, risk_description,
      whether_fraud_risks_exist, control_objective, control_to_address,
      mrc_or_not, source_data_report_logic_report_parameters,
      relevant_data_elements_of_ipe, type_of_control, nature_of_control,
      type_of_risk_mitigation_method, process_owner, reviewer_process_supervisor,
      control_frequency, basis_of_sampling, docs_to_review_for_dms_audit,
      type_of_risk_associated, financial_reporting, checks_performed,
      effective_or_not_effective, done, findings, gap_description_resolution,
      doc_uploaded_by_user, active, status, reason_by_approver, remarks_by_user
    };

    Object.keys(fieldsToUpdate).forEach(field => {
      // Skip approver-only fields if user is not an approver
      if (!isApprover && approverOnlyFields.includes(field)) {
        return;
      }
      
      if (fieldsToUpdate[field] !== undefined) {
        updateFields.push(`${field} = $${paramIndex}`);
        updateValues.push(fieldsToUpdate[field]);
        paramIndex++;
      }
    });

    // Debug: Log the update query
    console.log('Update query fields:', updateFields);

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
        message: 'Control form not found'
      });
    }

    await client.query('COMMIT');

    // Log audit event if status is being set to 'sent for approval'
    if (status === 'sent for approval' && req.user && req.user.email_id) {
      await logAuditEvent('Sent for approval', req.user.email_id, form_id);
    }

    res.status(200).json({
      success: true,
      message: 'Control form updated successfully',
      data: result.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating control form:', error);
    
    res.status(500).json({
      success: false,
      message: 'Error updating control form',
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
    
    const result = await client.query(query, queryParams);
    
    await client.query('COMMIT');
    
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

// Create single control form
router.post('/', verifyAuth, async (req, res) => {
  const {
    description_of_control, process, sub_process, risk_description,
    whether_fraud_risks_exist, control_objective, control_to_address,
    mrc_or_not, source_data_report_logic_report_parameters,
    relevant_data_elements_of_ipe, type_of_control, nature_of_control,
    type_of_risk_mitigation_method, process_owner, reviewer_process_supervisor,
    control_frequency, basis_of_sampling, docs_to_review_for_dms_audit,
    type_of_risk_associated, financial_reporting, checks_performed,
    effective_or_not_effective, done, findings, gap_description_resolution
  } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Generate unique form_id
    const formId = await generateUniqueFormId(client);

    const insertQuery = `
      INSERT INTO control_forms (
        description_of_control, process, sub_process, risk_description,
        whether_fraud_risks_exist, control_objective, control_to_address,
        mrc_or_not, source_data_report_logic_report_parameters,
        relevant_data_elements_of_ipe, type_of_control, nature_of_control,
        type_of_risk_mitigation_method, process_owner, reviewer_process_supervisor,
        control_frequency, basis_of_sampling, docs_to_review_for_dms_audit,
        type_of_risk_associated, financial_reporting, checks_performed,
        effective_or_not_effective, done, findings, gap_description_resolution,
        form_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
      RETURNING *;
    `;

    const result = await client.query(insertQuery, [
      description_of_control, process, sub_process, risk_description,
      whether_fraud_risks_exist, control_objective, control_to_address,
      mrc_or_not, source_data_report_logic_report_parameters,
      relevant_data_elements_of_ipe, type_of_control, nature_of_control,
      type_of_risk_mitigation_method, process_owner, reviewer_process_supervisor,
      control_frequency, basis_of_sampling, docs_to_review_for_dms_audit,
      type_of_risk_associated, financial_reporting, checks_performed,
      effective_or_not_effective, done, findings, gap_description_resolution,
      formId
    ]);

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Control form created successfully',
      data: result.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating control form:', error);
    
    res.status(500).json({
      success: false,
      message: 'Error creating control form',
      error: error.message
    });
  } finally {
    client.release();
  }
});

// Upload user document for a specific form
router.post('/:form_id/upload-document', verifyAuth, uploadUserDoc.single('document'), async (req, res) => {
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

    const fileName = req.file.originalname;
    const fileBuffer = req.file.buffer;

    // Upload file to S3
    console.log(`Uploading user document to S3: ${fileName}`);
    const s3Key = await uploadFileToS3(fileBuffer, fileName, 'IFC/user_docs');
    console.log(`User document uploaded to S3 with key: ${s3Key}`);
    
    // Update the form with the S3 key
    const updateQuery = `
      UPDATE control_forms
      SET doc_uploaded_by_user = $1
      WHERE form_id = $2
      RETURNING *;
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
      message: 'Document uploaded successfully',
      data: {
        form_id: result.rows[0].form_id,
        doc_uploaded_by_user: result.rows[0].doc_uploaded_by_user,
        file_name: fileName
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error uploading document to S3:', error);
    
    res.status(500).json({
      success: false,
      message: 'Error uploading document to S3',
      error: error.message
    });
  } finally {
    client.release();
  }
});


module.exports = router;

