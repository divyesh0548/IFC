const express = require('express');
const { Pool } = require('pg');
const multer = require('multer');
const XLSX = require('xlsx');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { normalizeColumnName } = require('../utils/column_mapping');

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

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '..', 'uploads', 'excel_files');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads (disk storage)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
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

// Middleware to verify authentication
async function verifyAuth(req, res, next) {
  try {
    const token = req.cookies.userAuthToken || req.cookies.authToken;
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const decoded = decryptToken(token);
    req.user = decoded;
    next();
  } catch (error) {
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

// Bulk upload - Save file and record in excel_files table (processed = 0)
router.post('/bulk-upload', verifyAuth, upload.single('excelFile'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No file uploaded'
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

    // Save file info to excel_files table with processed = 0 and company_identifier
    const filePath = req.file.path;
    const fileName = req.file.originalname;

    const insertFileQuery = `
      INSERT INTO excel_files (file_path, file_name, processed, company_identifier)
      VALUES ($1, $2, 0, $3)
      RETURNING id;
    `;

    const fileResult = await client.query(insertFileQuery, [
      filePath,
      fileName,
      companyIdentifier
    ]);

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: 'File uploaded successfully. It will be processed automatically within 1 minute.',
      fileId: fileResult.rows[0].id,
      fileName: fileName
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error saving file:', error);
    
    // Delete uploaded file if database insert fails
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting file:', unlinkError);
      }
    }
    
    res.status(500).json({
      success: false,
      message: 'Error saving file information',
      error: error.message
    });
  } finally {
    client.release();
  }
});

// Get all control forms (with optional company_identifier, process_owner, and active filters)
router.get('/', verifyAuth, async (req, res) => {
  try {
    const { company_identifier, process_owner, active } = req.query;
    
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
    doc_uploaded_by_user, active, approved_rejected, reason_by_approver
  } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

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
      doc_uploaded_by_user, active, approved_rejected, reason_by_approver
    };

    Object.keys(fieldsToUpdate).forEach(field => {
      if (fieldsToUpdate[field] !== undefined) {
        updateFields.push(`${field} = $${paramIndex}`);
        updateValues.push(fieldsToUpdate[field]);
        paramIndex++;
      }
    });

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

    const result = await client.query(updateQuery, updateValues);

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

module.exports = router;

