const crypto = require('crypto');
const { pool } = require('../../utils/db');
const { prisma } = require('../../lib/prisma');
const { hashPassword, getPasswordPepper } = require('../../utils/password');
const { encryptTempPassword, sendUserCreationEmail } = require('../../utils/login_email');
const { createBusinessProcessMasterEntry } = require('../../utils/business_process_master');
const {
  getMobileValidationError,
  normalizeMobileDigits,
} = require('../../utils/mobile_validation');

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

function normalizeCompanyAdminEmails(companyAdminEmails, fallbackEmail) {
  const rawEmails = Array.isArray(companyAdminEmails) && companyAdminEmails.length > 0
    ? companyAdminEmails
    : [fallbackEmail];

  return [...new Set(
    rawEmails
      .map((email) => normalizeEmail(email))
      .filter(Boolean)
  )];
}

function normalizeCompanyAdminEntries(companyAdminEntries, companyAdminEmails, fallbackEmail) {
  const rawEntries = Array.isArray(companyAdminEntries) && companyAdminEntries.length > 0
    ? companyAdminEntries
    : normalizeCompanyAdminEmails(companyAdminEmails, fallbackEmail).map((emailId) => ({ email_id: emailId }));

  const normalizedEntries = rawEntries
    .map((entry) => {
      if (typeof entry === 'string') {
        return {
          email_id: normalizeEmail(entry),
          mobile: null,
        };
      }

      return {
        email_id: normalizeEmail(entry?.email_id),
        mobile: normalizeMobileDigits(entry?.mobile) || null,
      };
    })
    .filter((entry) => entry.email_id);

  const entriesByEmail = new Map();
  normalizedEntries.forEach((entry) => {
    if (!entriesByEmail.has(entry.email_id)) {
      entriesByEmail.set(entry.email_id, entry);
    }
  });

  return Array.from(entriesByEmail.values());
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
        SELECT
          cum.id,
          cum.unit_id,
          cum.unit_name,
          cum.unit_address,
          COALESCE(
            array_agg(cua.coordinator_email_id ORDER BY cua.coordinator_email_id)
              FILTER (WHERE cua.coordinator_email_id IS NOT NULL),
            ARRAY[]::varchar[]
          ) AS coordinator_email_ids
        FROM company_unit_master cum
        LEFT JOIN coordinator_unit_assignments cua
          ON cua.company_identifier = cum.company_identifier
         AND cua.unit_id = cum.unit_id
        WHERE cum.company_identifier = $1
        GROUP BY cum.id, cum.unit_id, cum.unit_name, cum.unit_address
        ORDER BY cum.id ASC
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
    company_admins,
    company_admin_emails,
    company_admin_email,
  } = req.body;
  const companyAdminEntries = normalizeCompanyAdminEntries(company_admins, company_admin_emails, company_admin_email);
  const companyAdminEmails = companyAdminEntries.map((entry) => entry.email_id);

  // Validate required fields
  if (!company_name || !registered_email || !registered_address ||
      !unique_identification_number || !gst || !pan ||
      !number_of_corporate_offices || !number_of_factory_units || companyAdminEmails.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'All required fields must be provided, including at least one company admin email'
    });
  }

  if (companyAdminEmails.some((email) => !isValidEmail(email))) {
    return res.status(400).json({
      success: false,
      message: 'One or more company admin emails are invalid'
    });
  }

  const missingAdminMobile = companyAdminEntries.some((entry) => !entry.mobile);
  if (missingAdminMobile) {
    return res.status(400).json({
      success: false,
      message: 'Mobile number is required for every company admin',
    });
  }

  const invalidAdminMobile = companyAdminEntries
    .map((entry) => getMobileValidationError(entry.mobile))
    .find(Boolean);
  if (invalidAdminMobile) {
    return res.status(400).json({
      success: false,
      message: invalidAdminMobile,
    });
  }

  try {
    getPasswordPepper();

    // Generate company identifier
    const company_identifier = generateCompanyIdentifier(company_name);
    const { company, companyAdmins } = await prisma.$transaction(async (tx) => {
      const existingAdmins = await tx.ifcUser.findMany({
        where: {
          emailId: {
            in: companyAdminEmails,
          },
        },
        select: { emailId: true },
      });

      if (existingAdmins.length > 0) {
        const existingEmails = existingAdmins.map((admin) => admin.emailId).join(', ');
        const error = new Error(`User with this company admin email already exists: ${existingEmails}`);
        error.code = 'P2002';
        throw error;
      }

      const createdCompany = await tx.company.create({
        data: {
          companyIdentifier: company_identifier,
          companyName: company_name,
          registeredEmail: registered_email,
          registeredAddress: registered_address,
          uniqueIdentificationNumber: unique_identification_number,
          gst,
          pan,
          numberOfCorporateOffices: number_of_corporate_offices,
          numberOfFactoryUnits: number_of_factory_units,
          createdAt: new Date(),
        },
        select: {
          id: true,
          companyIdentifier: true,
        },
      });

      const createdCompanyAdmins = [];
      for (const companyAdminEntry of companyAdminEntries) {
        const emailId = companyAdminEntry.email_id;
        const tempPassword = crypto.randomBytes(8).toString('hex');
        const tempPasswordHash = await hashPassword(tempPassword);
        const tempPasswordEncrypted = encryptTempPassword(tempPassword);
        const createdCompanyAdmin = await tx.ifcUser.create({
          data: {
            emailId,
            password: tempPasswordHash,
            role: 'company_admin',
            companyIdentifier: company_identifier,
            tempLogin: true,
            mobile: companyAdminEntry.mobile,
            loginEmailSent: false,
            tempPasswordEncrypted,
          },
          select: {
            id: true,
            emailId: true,
            role: true,
            companyIdentifier: true,
          },
        });
        createdCompanyAdmins.push({
          id: createdCompanyAdmin.id,
          email_id: createdCompanyAdmin.emailId,
          role: createdCompanyAdmin.role,
          company_identifier: createdCompanyAdmin.companyIdentifier,
          tempPassword,
        });
      }

      return {
        company: {
          id: createdCompany.id,
          company_identifier: createdCompany.companyIdentifier,
        },
        companyAdmins: createdCompanyAdmins,
      };
    }, {
      maxWait: 10000,
      timeout: 30000,
    });

    for (const companyAdmin of companyAdmins) {
      try {
        const emailSent = await sendUserCreationEmail(pool, {
          userId: companyAdmin.id,
          emailId: companyAdmin.email_id,
          role: companyAdmin.role,
          userName: 'Company Admin',
          coordinatorName: req.user?.emp_name || 'Site Admin',
          coordinatorEmail: req.user?.email_id,
          companyName: company_name,
          tempPassword: companyAdmin.tempPassword,
        });
        if (!emailSent) {
          console.warn(`Warning: failed to send company admin creation email to ${companyAdmin.email_id}`);
        }
      } catch (emailError) {
        console.error(`Company admin creation email error for ${companyAdmin.email_id}:`, emailError);
      }
    }

    const responseCompanyAdmins = companyAdmins.map(({ tempPassword: _tempPassword, ...companyAdmin }) => companyAdmin);

    res.status(201).json({
      success: true,
      message: 'Company created successfully',
      company: {
        id: company.id,
        company_identifier: company.company_identifier,
        company_name: company_name
      },
      company_admins: responseCompanyAdmins
    });

  } catch (error) {
    console.error('Error creating company:', error);

    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: error.message || 'Company with this identifier already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}

async function getAuditors(req, res) {
  try {
    const result = await pool.query(
      `
        SELECT id, email_id, emp_name, mobile, role, created_at, temp_login, login_email_sent
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
  const empName = String(req.body?.emp_name || '').trim();
  const userMobile = normalizeMobileDigits(req.body?.mobile);

  if (!empName) {
    return res.status(400).json({
      success: false,
      message: 'Name is required',
    });
  }

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

  if (!userMobile) {
    return res.status(400).json({
      success: false,
      message: 'Mobile number is required',
    });
  }

  const mobileError = getMobileValidationError(userMobile);
  if (mobileError) {
    return res.status(400).json({
      success: false,
      message: mobileError,
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
          emp_name,
          mobile,
          password,
          role,
          temp_login,
          login_email_sent,
          temp_password_encrypted
        )
        VALUES ($1, $2, $3, $4, 'auditor', TRUE, FALSE, $5)
        RETURNING id, email_id, emp_name, mobile, role, created_at, temp_login, login_email_sent
      `,
      [emailId, empName, userMobile, tempPasswordHash, tempPasswordEncrypted]
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
  try {
    const created = await createBusinessProcessMasterEntry({
      ...(req.body || {}),
      company_identifier: null,
      created_by_email: req.user?.email_id || null,
    });
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
  }
}

module.exports = {
  getCompanies,
  getCompanyByIdentifier,
  createCompany,
  getAuditors,
  createAuditor,
  createBusinessProcessManagementEntry,
};
