const crypto = require('crypto');
const { pool } = require('../../utils/db');
const { hashPassword, getPasswordPepper } = require('../../utils/password');
const { encryptTempPassword } = require('../../utils/login_email');
const { deleteFileFromS3 } = require('../../utils/s3Upload');
const { getControlFormDocumentRows } = require('../../utils/racm_documents');

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

function generateUnitIdentifier(unitName) {
  const namePart = String(unitName || 'UNIT')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .substring(0, 6)
    .padEnd(6, 'X');

  const randomPart = crypto.randomBytes(2).toString('hex').toUpperCase().substring(0, 4);

  return (namePart + randomPart).substring(0, 10);
}

function normalizeCompanyUnits(companyUnits) {
  const units = Array.isArray(companyUnits) && companyUnits.length > 0
    ? companyUnits
    : [{ unit_name: 'Main Unit', unit_address: '' }];

  return units
    .map((unit) => ({
      unit_name: String(unit?.unit_name ?? unit?.unit ?? '').trim(),
      unit_address: String(unit?.unit_address ?? '').trim(),
    }));
}

function normalizeCoordinatorUnitIndexes(coordinatorUnitIndexes, unitCount) {
  if (!Array.isArray(coordinatorUnitIndexes)) {
    return [];
  }

  return [...new Set(
    coordinatorUnitIndexes
      .map((index) => Number(index))
      .filter((index) => Number.isInteger(index) && index >= 0 && index < unitCount)
  )];
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

function normalizeBusinessProcessValue(value) {
  return String(value || '').trim();
}

async function createBusinessProcess(client, payload = {}) {
  const businessProcess = normalizeBusinessProcessValue(payload.business_process);
  const businessProcessCode = normalizeBusinessProcessValue(payload.business_process_code);

  if (!businessProcess) {
    const error = new Error('Business Process is required');
    error.statusCode = 400;
    throw error;
  }

  if (!businessProcessCode) {
    const error = new Error('Business Process code is required');
    error.statusCode = 400;
    throw error;
  }

  const duplicateResult = await client.query(
    `
      SELECT
        id,
        TRIM(business_process) AS business_process,
        TRIM(business_process_code) AS business_process_code
      FROM businees_process_code
      WHERE LOWER(TRIM(business_process)) = LOWER(TRIM($1))
         OR LOWER(TRIM(business_process_code)) = LOWER(TRIM($2))
      LIMIT 1
    `,
    [businessProcess, businessProcessCode]
  );

  if (duplicateResult.rows.length > 0) {
    const existing = duplicateResult.rows[0];
    const sameProcess =
      normalizeBusinessProcessValue(existing.business_process).toLowerCase() === businessProcess.toLowerCase();
    const sameCode =
      normalizeBusinessProcessValue(existing.business_process_code).toLowerCase() === businessProcessCode.toLowerCase();

    const error = new Error(
      sameProcess
        ? 'Business Process already exists'
        : sameCode
          ? 'Business Process code already exists'
          : 'Business Process already exists'
    );
    error.statusCode = 409;
    throw error;
  }

  const insertResult = await client.query(
    `
      INSERT INTO businees_process_code (business_process, business_process_code)
      VALUES ($1, $2)
      RETURNING
        id,
        TRIM(business_process) AS business_process,
        TRIM(business_process_code) AS business_process_code,
        created_at
    `,
    [businessProcess, businessProcessCode]
  );

  return insertResult.rows[0];
}

// Get all companies API endpoint
async function getCompanies(req, res) {
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
}

// Get single company by company_identifier API endpoint
async function getCompanyByIdentifier(req, res) {
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

    const unitsResult = await pool.query(
      `
        SELECT id, unit_id, unit_name, unit_address, coordinator_email_id
        FROM company_unit_master
        WHERE company_identifier = $1
        ORDER BY id ASC
      `,
      [company_identifier]
    );

    res.status(200).json({
      success: true,
      message: 'Company retrieved successfully',
      data: {
        ...result.rows[0],
        company_units: unitsResult.rows,
      }
    });
  } catch (error) {
    console.error('Error fetching company:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching company'
    });
  }
}

// Create Company API endpoint
async function createCompany(req, res) {
  const {
    company_name,
    registered_email,
    registered_address,
    unique_identification_number,
    gst,
    pan,
    number_of_corporate_offices,
    number_of_factory_units,
    company_coordinator_email,
    company_units,
    company_coordinator_unit_indexes
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

  const coordinatorEmail = String(company_coordinator_email || '').trim();

  if (!coordinatorEmail) {
    return res.status(400).json({
      success: false,
      message: 'Company coordinator email is required'
    });
  }

  // Validate company coordinator email
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(coordinatorEmail)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid company coordinator email format'
    });
  }

  const normalizedCompanyUnits = normalizeCompanyUnits(company_units);
  if (normalizedCompanyUnits.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'At least one company unit must be provided'
    });
  }
  if (normalizedCompanyUnits.some((unit) => unit.unit_name === '')) {
    return res.status(400).json({
      success: false,
      message: 'Unit name is required for every company unit'
    });
  }

  const coordinatorUnitIndexes = normalizeCoordinatorUnitIndexes(
    company_coordinator_unit_indexes,
    normalizedCompanyUnits.length
  );
  if (coordinatorUnitIndexes.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Company coordinator must be mapped with at least one company unit'
    });
  }
  const coordinatorUnitIndexSet = new Set(coordinatorUnitIndexes);

  const client = await pool.connect();

  try {
    getPasswordPepper();
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

    const insertUnitQuery = `
      INSERT INTO company_unit_master (
        company_identifier, unit_name, unit_address, unit_id, coordinator_email_id
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, unit_id, unit_name, unit_address, coordinator_email_id;
    `;
    const companyUnits = [];
    for (const [index, unit] of normalizedCompanyUnits.entries()) {
      let insertedUnit = null;
      let attempts = 0;

      while (!insertedUnit && attempts < 5) {
        attempts += 1;
        const unitId = generateUnitIdentifier(unit.unit_name);

        try {
          const unitResult = await client.query(insertUnitQuery, [
            company_identifier,
            unit.unit_name,
            unit.unit_address || null,
            unitId,
            coordinatorUnitIndexSet.has(index) ? coordinatorEmail : null
          ]);
          insertedUnit = unitResult.rows[0];
        } catch (unitError) {
          if (unitError.code === '23505' && attempts < 5) {
            continue;
          }
          throw unitError;
        }
      }

      companyUnits.push(insertedUnit);
    }

    // If company coordinator email is provided, create/update user in ifc_users table
    if (coordinatorEmail) {
      // Check if user already exists
      const checkUserQuery = 'SELECT * FROM ifc_users WHERE email_id = $1';
      const userCheck = await client.query(checkUserQuery, [coordinatorEmail]);

      if (userCheck.rows.length > 0) {
        // Update existing user with company_identifier
        const updateUserQuery = `
          UPDATE ifc_users
          SET company_identifier = $1
          WHERE email_id = $2
        `;
        await client.query(updateUserQuery, [company_identifier, coordinatorEmail]);
      } else {
        // Create new user with company_identifier
        // Generate a temporary password (user will need to reset it)
        const tempPassword = crypto.randomBytes(8).toString('hex');
        const tempPasswordHash = await hashPassword(tempPassword);
        const tempPasswordEncrypted = encryptTempPassword(tempPassword);

        const insertUserQuery = `
          INSERT INTO ifc_users (
            email_id,
            password,
            role,
            company_identifier,
            temp_login,
            login_email_sent,
            temp_password_encrypted
          )
          VALUES ($1, $2, $3, $4, $5, FALSE, $6)
        `;
        await client.query(insertUserQuery, [
          coordinatorEmail,
          tempPasswordHash,
          'company_co',
          company_identifier,
          1, // Set temp_login to 1 to force password update on first login
          tempPasswordEncrypted
        ]);
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
      },
      company_units: companyUnits
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating company:', error);

    if (error.code === '23505') { // Unique constraint violation
      if (String(error.constraint || '').includes('company_unit_master')) {
        return res.status(409).json({
          success: false,
          message: 'Company unit identifier already exists. Please try again.'
        });
      }

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
}

// Delete Company API endpoint
async function deleteCompany(req, res) {
  const { company_identifier } = req.params;
  const deleteRacms = req.body?.deleteRacms === true || req.body?.delete_racms === true;
  const deleteUsers = req.body?.deleteUsers === true || req.body?.delete_users === true;

  if (!company_identifier || String(company_identifier).trim() === '') {
    return res.status(400).json({
      success: false,
      message: 'Company identifier is required'
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const companyResult = await client.query(
      'SELECT id, company_identifier, company_name FROM companies WHERE company_identifier = $1 LIMIT 1',
      [company_identifier]
    );

    if (companyResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    const formsResult = await client.query(
      'SELECT form_id FROM control_forms WHERE company_identifier = $1',
      [company_identifier]
    );
    const formIds = formsResult.rows
      .map((row) => (row.form_id == null ? '' : String(row.form_id).trim()))
      .filter(Boolean);

    let deletedS3Objects = 0;
    let deletedUserDocRows = 0;
    let deletedSampleDocRows = 0;
    let deletedRacmRows = 0;

    if (deleteRacms && formIds.length > 0) {
      const { sampleDocsByFormId, userDocsByFormId } = await getControlFormDocumentRows(client, formIds);
      const docUrlsToDelete = Array.from(
        new Set(
          formIds
            .flatMap((formId) => [
              ...(userDocsByFormId.get(formId) || []).map((doc) => doc.doc_uploaded_by_user),
              ...(sampleDocsByFormId.get(formId) || []).map((doc) => doc.sample_doc),
            ])
            .map((value) => (value == null ? '' : String(value).trim()))
            .filter(Boolean)
        )
      );

      for (const s3Key of docUrlsToDelete) {
        try {
          await deleteFileFromS3(s3Key);
          deletedS3Objects += 1;
        } catch (s3Error) {
          console.error(`Error deleting company document from S3 (${s3Key}):`, s3Error);
        }
      }

      const deletedUserDocsResult = await client.query(
        'DELETE FROM doc_uploaded_by_user WHERE form_id = ANY($1::text[])',
        [formIds]
      );
      deletedUserDocRows = deletedUserDocsResult.rowCount;

      const deletedSampleDocsResult = await client.query(
        'DELETE FROM sample_docs WHERE form_id = ANY($1::text[])',
        [formIds]
      );
      deletedSampleDocRows = deletedSampleDocsResult.rowCount;

      const deletedRacmsResult = await client.query(
        'DELETE FROM control_forms WHERE company_identifier = $1',
        [company_identifier]
      );
      deletedRacmRows = deletedRacmsResult.rowCount;
    }

    const deletedUnitResult = await client.query(
      'DELETE FROM company_unit_master WHERE company_identifier = $1',
      [company_identifier]
    );

    let deletedUserRows = 0;
    let detachedUserRows = 0;
    if (deleteUsers) {
      const deletedUsersResult = await client.query(
        'DELETE FROM ifc_users WHERE company_identifier = $1',
        [company_identifier]
      );
      deletedUserRows = deletedUsersResult.rowCount;
    } else {
      const detachedUsersResult = await client.query(
        'UPDATE ifc_users SET company_identifier = NULL WHERE company_identifier = $1',
        [company_identifier]
      );
      detachedUserRows = detachedUsersResult.rowCount;
    }

    const deletedCompanyResult = await client.query(
      'DELETE FROM companies WHERE company_identifier = $1',
      [company_identifier]
    );

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: 'Company deleted successfully',
      data: {
        company_identifier,
        delete_users: deleteUsers,
        delete_racms: deleteRacms,
        deleted_company_rows: deletedCompanyResult.rowCount,
        deleted_unit_rows: deletedUnitResult.rowCount,
        deleted_user_rows: deletedUserRows,
        detached_user_rows: detachedUserRows,
        deleted_racm_rows: deletedRacmRows,
        deleted_documents: {
          s3_objects: deletedS3Objects,
          user_uploaded_rows: deletedUserDocRows,
          sample_doc_rows: deletedSampleDocRows,
        },
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting company:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  } finally {
    client.release();
  }
}

async function getAuditors(req, res) {
  try {
    const result = await pool.query(
      `
        SELECT id, email_id, role, created_at, temp_login, login_email_sent
        FROM ifc_users
        WHERE role = 'auditor'
        ORDER BY created_at DESC NULLS LAST, id DESC
      `
    );

    return res.status(200).json({
      success: true,
      message: 'Auditors retrieved successfully',
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching auditors:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch auditors',
    });
  }
}

async function createAuditor(req, res) {
  const emailId = normalizeEmail(req.body?.email_id);

  if (!emailId) {
    return res.status(400).json({
      success: false,
      message: 'Email ID is required',
    });
  }

  if (!isValidEmail(emailId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid email format',
    });
  }

  const client = await pool.connect();
  try {
    getPasswordPepper();
    await client.query('BEGIN');

    const existingUser = await client.query(
      'SELECT id FROM ifc_users WHERE LOWER(TRIM(email_id)) = $1 LIMIT 1',
      [emailId]
    );

    if (existingUser.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists',
      });
    }

    const tempPassword = crypto.randomBytes(8).toString('hex');
    const tempPasswordHash = await hashPassword(tempPassword);
    const tempPasswordEncrypted = encryptTempPassword(tempPassword);

    const auditorResult = await client.query(
      `
        INSERT INTO ifc_users (
          email_id,
          password,
          role,
          temp_login,
          login_email_sent,
          temp_password_encrypted
        )
        VALUES ($1, $2, 'auditor', 1, FALSE, $3)
        RETURNING id, email_id, role, created_at, temp_login, login_email_sent
      `,
      [emailId, tempPasswordHash, tempPasswordEncrypted]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: 'Auditor created successfully',
      data: {
        auditor: auditorResult.rows[0],
        loginEmailQueued: true,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating auditor:', error);

    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  } finally {
    client.release();
  }
}

async function createBusinessProcessManagementEntry(req, res) {
  const client = await pool.connect();
  try {
    const created = await createBusinessProcess(client, req.body || {});
    return res.status(201).json({
      success: true,
      message: 'Business Process created successfully',
      data: created,
    });
  } catch (error) {
    const statusCode = Number(error.statusCode || 500);
    if (statusCode >= 500) {
      console.error('Create siteadmin business process error:', error);
    }
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to create business process',
    });
  } finally {
    client.release();
  }
}

module.exports = {
  getCompanies,
  getCompanyByIdentifier,
  createCompany,
  deleteCompany,
  getAuditors,
  createAuditor,
  createBusinessProcessManagementEntry,
};
