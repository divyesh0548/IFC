const crypto = require('crypto');
const { pool } = require('../../utils/db');
const { prisma } = require('../../lib/prisma');
const { hashPassword, getPasswordPepper } = require('../../utils/password');
const { encryptTempPassword, sendUserCreationEmail } = require('../../utils/login_email');
const { deleteFileFromS3 } = require('../../utils/s3Upload');
const { collectRacmS3DocumentKeys } = require('../../utils/racm_documents');
const { createBusinessProcessMasterEntry } = require('../../utils/business_process_master');
const { sendEmail } = require('../../utils/send_email');
const {
  getMobileValidationError,
  normalizeMobileDigits,
} = require('../../utils/mobile_validation');
const {
  UNIT_RESPONSIBILITY_TYPES,
  getUnitResponsibilityConfig,
} = require('../../utils/unit_responsibilities');

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

async function getCompanyName(companyIdentifier) {
  if (!companyIdentifier) return null;
  const company = await prisma.company.findUnique({
    where: { companyIdentifier },
    select: { companyName: true },
  });
  return company?.companyName || null;
}

function getUnitMappingRoleConfig(role) {
  return getUnitResponsibilityConfig(role);
}

function buildUnitAssignmentNotificationEmail({ roleLabel, unitName, companyName, assignedByText }) {
  const safeRoleLabel = String(roleLabel || 'User').trim();
  const safeUnitName = String(unitName || 'the specified').trim();
  const safeCompanyName = String(companyName || 'your').trim();
  const safeAssignedByText = String(assignedByText || 'A company coordinator has assigned').trim();

  return {
    subject: `Unit Assignment Notification - ${safeCompanyName}`,
    text: `Dear Sir/Madam,

${safeAssignedByText} you as a ${safeRoleLabel} to the ${safeUnitName} unit for the company ${safeCompanyName}.

You are requested to take note of this assignment and proceed with your responsibilities accordingly.

Regards,
${safeCompanyName}`,
  };
}

async function createCompanyPrivilegedUser(client, companyIdentifier, payload = {}, role) {
  getPasswordPepper();

  const config = getUnitMappingRoleConfig(role);
  if (!config) {
    const error = new Error('Invalid role');
    error.statusCode = 400;
    throw error;
  }

  const emailId = normalizeEmail(payload.email_id);

  if (!companyIdentifier) {
    const error = new Error('Company identifier is required');
    error.statusCode = 400;
    throw error;
  }

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
  const tempPasswordHash = await hashPassword(tempPassword);
  const tempPasswordEncrypted = encryptTempPassword(tempPassword);

  const createdUser = await prisma.ifcUser.create({
    data: {
      emailId,
      password: tempPasswordHash,
      role: config.role,
      companyIdentifier,
      tempLogin: true,
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

  return {
    user: {
      id: createdUser.id,
      email_id: createdUser.emailId,
      role: createdUser.role,
      company_identifier: createdUser.companyIdentifier,
    },
    loginEmailQueued: true,
    tempPassword,
  };
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

async function getCompanyUnitManagement(req, res) {
  try {
    const companyIdentifier = String(req.params.company_identifier || '').trim();

    if (!companyIdentifier) {
      return res.status(400).json({
        success: false,
        message: 'Company identifier is required',
      });
    }

    const companyResult = await pool.query(
      'SELECT company_identifier FROM companies WHERE company_identifier = $1 LIMIT 1',
      [companyIdentifier]
    );

    if (companyResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Company not found',
      });
    }

    const buildDistinctPeopleQuery = (responsibilityType) => `
      WITH distinct_people AS (
        SELECT DISTINCT LOWER(TRIM(user_email_id)) AS email_id
        FROM company_unit_responsibilities
        WHERE company_identifier = $1
          AND responsibility_type = '${responsibilityType}'
          AND COALESCE(TRIM(user_email_id), '') <> ''
      )
      SELECT
        dp.email_id,
        COALESCE(NULLIF(TRIM(u.emp_name), ''), dp.email_id) AS display_name
      FROM distinct_people dp
      LEFT JOIN ifc_users u
        ON LOWER(TRIM(u.email_id)) = dp.email_id
       AND u.company_identifier = $1
      ORDER BY display_name ASC, dp.email_id ASC
    `;

    const buildUnmappedUnitsQuery = (responsibilityType) => `
      SELECT cum.id, cum.unit_id, cum.unit_name
      FROM company_unit_master cum
      WHERE cum.company_identifier = $1
        AND NOT EXISTS (
          SELECT 1
          FROM company_unit_responsibilities cur
          WHERE cur.company_identifier = cum.company_identifier
            AND cur.unit_id = cum.unit_id
            AND cur.responsibility_type = '${responsibilityType}'
        )
      ORDER BY cum.unit_name ASC, cum.id ASC
    `;

    const [
      unitsRows,
      approversRows,
      coordinatorsRows,
      unmappedRoleUsersRows,
      unmappedCoordinatorUnitsRows,
      unmappedApproverUnitsRows,
      assignmentCoordinatorsRows,
      assignmentApproversRows,
    ] = await Promise.all([
      prisma.$queryRawUnsafe(
        `
          SELECT
            cum.id,
            cum.unit_id,
            cum.unit_name,
            cum.unit_address,
            COUNT(DISTINCT unit_users.id)::int AS total_users,
            coordinator_map.user_email_id AS coordinator_email_id,
            COALESCE(NULLIF(TRIM(coordinator.emp_name), ''), coordinator_map.user_email_id) AS coordinator_display_name,
            approver_map.user_email_id AS approver_email_id,
            COALESCE(NULLIF(TRIM(approver.emp_name), ''), approver_map.user_email_id) AS approver_display_name
          FROM company_unit_master cum
          LEFT JOIN company_unit_responsibilities coordinator_map
            ON coordinator_map.company_identifier = cum.company_identifier
           AND coordinator_map.unit_id = cum.unit_id
           AND coordinator_map.responsibility_type = '${UNIT_RESPONSIBILITY_TYPES.COORDINATOR}'
          LEFT JOIN company_unit_responsibilities approver_map
            ON approver_map.company_identifier = cum.company_identifier
           AND approver_map.unit_id = cum.unit_id
           AND approver_map.responsibility_type = '${UNIT_RESPONSIBILITY_TYPES.APPROVER}'
          LEFT JOIN ifc_users coordinator
            ON LOWER(TRIM(coordinator.email_id)) = LOWER(TRIM(COALESCE(coordinator_map.user_email_id, '')))
           AND coordinator.company_identifier = cum.company_identifier
          LEFT JOIN ifc_users approver
            ON LOWER(TRIM(approver.email_id)) = LOWER(TRIM(COALESCE(approver_map.user_email_id, '')))
           AND approver.company_identifier = cum.company_identifier
          LEFT JOIN ifc_users unit_users
            ON unit_users.company_identifier = cum.company_identifier
           AND LOWER(TRIM(COALESCE(unit_users.unit_id, ''))) = LOWER(TRIM(COALESCE(cum.unit_id, '')))
           AND unit_users.role = 'user'
          WHERE cum.company_identifier = $1
          GROUP BY
            cum.id,
            cum.unit_id,
            cum.unit_name,
            cum.unit_address,
            coordinator_map.user_email_id,
            coordinator.emp_name,
            approver_map.user_email_id,
            approver.emp_name
          ORDER BY cum.unit_name ASC, cum.id ASC
        `,
        companyIdentifier
      ),
      prisma.$queryRawUnsafe(buildDistinctPeopleQuery(UNIT_RESPONSIBILITY_TYPES.APPROVER), companyIdentifier),
      prisma.$queryRawUnsafe(buildDistinctPeopleQuery(UNIT_RESPONSIBILITY_TYPES.COORDINATOR), companyIdentifier),
      prisma.$queryRawUnsafe(
        `
          SELECT *
          FROM (
            SELECT
              LOWER(TRIM(u.email_id)) AS email_id,
              COALESCE(NULLIF(TRIM(u.emp_name), ''), LOWER(TRIM(u.email_id))) AS display_name,
              'company_co' AS role
            FROM ifc_users u
            WHERE u.company_identifier = $1
              AND u.role = 'company_co'
              AND COALESCE(TRIM(u.email_id), '') <> ''

            UNION ALL

            SELECT
              LOWER(TRIM(u.email_id)) AS email_id,
              COALESCE(NULLIF(TRIM(u.emp_name), ''), LOWER(TRIM(u.email_id))) AS display_name,
              'approver' AS role
            FROM ifc_users u
            WHERE u.company_identifier = $1
              AND u.role = 'approver'
              AND COALESCE(TRIM(u.email_id), '') <> ''
          ) role_users
          ORDER BY role ASC, display_name ASC, email_id ASC
        `,
        companyIdentifier
      ),
      prisma.$queryRawUnsafe(buildUnmappedUnitsQuery(UNIT_RESPONSIBILITY_TYPES.COORDINATOR), companyIdentifier),
      prisma.$queryRawUnsafe(buildUnmappedUnitsQuery(UNIT_RESPONSIBILITY_TYPES.APPROVER), companyIdentifier),
      prisma.$queryRawUnsafe(
        `
          SELECT
            LOWER(TRIM(email_id)) AS email_id,
            COALESCE(NULLIF(TRIM(emp_name), ''), LOWER(TRIM(email_id))) AS display_name
          FROM ifc_users
          WHERE company_identifier = $1
            AND role = 'company_co'
            AND COALESCE(TRIM(email_id), '') <> ''
          ORDER BY display_name ASC, email_id ASC
        `,
        companyIdentifier
      ),
      prisma.$queryRawUnsafe(
        `
          SELECT
            LOWER(TRIM(email_id)) AS email_id,
            COALESCE(NULLIF(TRIM(emp_name), ''), LOWER(TRIM(email_id))) AS display_name
          FROM ifc_users
          WHERE company_identifier = $1
            AND role = 'approver'
            AND COALESCE(TRIM(email_id), '') <> ''
          ORDER BY display_name ASC, email_id ASC
        `,
        companyIdentifier
      ),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        company_identifier: companyIdentifier,
        currentCoordinatorUnits: unitsRows,
        approvers: approversRows,
        coordinators: coordinatorsRows,
        unmappedRoleUsers: unmappedRoleUsersRows,
        unmappedCoordinatorUnits: unmappedCoordinatorUnitsRows,
        unmappedApproverUnits: unmappedApproverUnitsRows,
        assignmentCoordinators: assignmentCoordinatorsRows,
        assignmentApprovers: assignmentApproversRows,
        units: unitsRows,
      },
    });
  } catch (error) {
    console.error('Siteadmin company unit management error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch unit management data',
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

  try {
    const existingCompany = await prisma.company.findFirst({
      where: { companyIdentifier: company_identifier },
      select: { id: true, companyIdentifier: true, companyName: true },
    });

    if (!existingCompany) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    const formRows = await prisma.controlForm.findMany({
      where: { companyIdentifier: company_identifier },
      select: { formId: true },
    });
    const formIds = formRows
      .map((row) => (row.formId == null ? '' : String(row.formId).trim()))
      .filter(Boolean);

    let deletedS3Objects = 0;
    let deletedUserDocRows = 0;
    let deletedSampleDocRows = 0;
    let deletedRacmRows = 0;

    if (deleteRacms && formIds.length > 0) {
      const docUrlsToDelete = await collectRacmS3DocumentKeys(prisma, formIds);

      for (const s3Key of docUrlsToDelete) {
        try {
          await deleteFileFromS3(s3Key);
          deletedS3Objects += 1;
        } catch (s3Error) {
          console.error(`Error deleting company document from S3 (${s3Key}):`, s3Error);
        }
      }

      const racmDeleteCounts = await prisma.$transaction(async (tx) => {
        const deletedUserDocsResult = await tx.racmDoc.deleteMany({
          where: { formId: { in: formIds } },
        });
        const deletedSampleDocsResult = await tx.sampleDoc.deleteMany({
          where: { formId: { in: formIds } },
        });
        const deletedRacmsResult = await tx.controlForm.deleteMany({
          where: { companyIdentifier: company_identifier },
        });

        return {
          deletedUserDocRows: deletedUserDocsResult.count,
          deletedSampleDocRows: deletedSampleDocsResult.count,
          deletedRacmRows: deletedRacmsResult.count,
        };
      });

      deletedUserDocRows = racmDeleteCounts.deletedUserDocRows;
      deletedSampleDocRows = racmDeleteCounts.deletedSampleDocRows;
      deletedRacmRows = racmDeleteCounts.deletedRacmRows;
    }

    let deletedUserRows = 0;
    let detachedUserRows = 0;
    const finalDeleteCounts = await prisma.$transaction(async (tx) => {
      const deletedUnitResult = await tx.companyUnitMaster.deleteMany({
        where: { companyIdentifier: company_identifier },
      });

      let deletedUsersCount = 0;
      let detachedUsersCount = 0;
      if (deleteUsers) {
        const deletedUsersResult = await tx.ifcUser.deleteMany({
          where: { companyIdentifier: company_identifier },
        });
        deletedUsersCount = deletedUsersResult.count;
      } else {
        const detachedUsersResult = await tx.ifcUser.updateMany({
          where: { companyIdentifier: company_identifier },
          data: { companyIdentifier: null },
        });
        detachedUsersCount = detachedUsersResult.count;
      }

      const deletedCompanyResult = await tx.company.deleteMany({
        where: { companyIdentifier: company_identifier },
      });

      return {
        deletedUnitRows: deletedUnitResult.count,
        deletedCompanyRows: deletedCompanyResult.count,
        deletedUsersCount,
        detachedUsersCount,
      };
    });

    deletedUserRows = finalDeleteCounts.deletedUsersCount;
    detachedUserRows = finalDeleteCounts.detachedUsersCount;

    return res.status(200).json({
      success: true,
      message: 'Company deleted successfully',
      data: {
        company_identifier,
        delete_users: deleteUsers,
        delete_racms: deleteRacms,
        deleted_company_rows: finalDeleteCounts.deletedCompanyRows,
        deleted_unit_rows: finalDeleteCounts.deletedUnitRows,
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
    console.error('Error deleting company:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
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
        VALUES ($1, $2, 'auditor', TRUE, FALSE, $3)
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

async function createCompanyCoordinator(req, res) {
  const client = await pool.connect();

  try {
    const companyIdentifier = String(req.params.company_identifier || '').trim();
    if (!companyIdentifier) {
      return res.status(400).json({
        success: false,
        message: 'Company identifier is required',
      });
    }

    const companyName = await getCompanyName(companyIdentifier);
    const coordinatorName = String(req.user?.emp_name || '').trim() || 'Site Admin';

    await client.query('BEGIN');

    const { user, loginEmailQueued, tempPassword } = await createCompanyPrivilegedUser(
      client,
      companyIdentifier,
      req.body,
      'company_co'
    );

    await client.query('COMMIT');

    try {
      const emailSent = await sendUserCreationEmail(pool, {
        userId: user.id,
        emailId: user.email_id,
        role: user.role,
        coordinatorEmail: req.user?.email_id,
        coordinatorName,
        companyName,
        tempPassword,
      });
      if (!emailSent) {
        console.warn(`Warning: failed to send siteadmin coordinator creation email to ${user.email_id}`);
      }
    } catch (emailError) {
      console.error('Siteadmin coordinator creation email error:', emailError);
    }

    return res.status(201).json({
      success: true,
      message: 'Company coordinator created successfully',
      data: { user, loginEmailQueued },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create siteadmin company coordinator error:', error);

    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

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

async function createCompanyApprover(req, res) {
  const client = await pool.connect();

  try {
    const companyIdentifier = String(req.params.company_identifier || '').trim();
    if (!companyIdentifier) {
      return res.status(400).json({
        success: false,
        message: 'Company identifier is required',
      });
    }

    const companyName = await getCompanyName(companyIdentifier);
    const coordinatorName = String(req.user?.emp_name || '').trim() || 'Site Admin';

    await client.query('BEGIN');

    const { user, loginEmailQueued, tempPassword } = await createCompanyPrivilegedUser(
      client,
      companyIdentifier,
      req.body,
      'approver'
    );

    await client.query('COMMIT');

    try {
      const emailSent = await sendUserCreationEmail(pool, {
        userId: user.id,
        emailId: user.email_id,
        role: user.role,
        coordinatorEmail: req.user?.email_id,
        coordinatorName,
        companyName,
        tempPassword,
      });
      if (!emailSent) {
        console.warn(`Warning: failed to send siteadmin approver creation email to ${user.email_id}`);
      }
    } catch (emailError) {
      console.error('Siteadmin approver creation email error:', emailError);
    }

    return res.status(201).json({
      success: true,
      message: 'Approver created successfully',
      data: { user, loginEmailQueued },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create siteadmin approver error:', error);

    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

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

async function updateCompanyUnitAssignment(req, res) {
  const client = await pool.connect();

  try {
    const companyIdentifier = String(req.params.company_identifier || '').trim();
    const unitId = req.params.unit_id && String(req.params.unit_id).trim()
      ? String(req.params.unit_id).trim()
      : '';
    const role = req.body?.role && String(req.body.role).trim()
      ? String(req.body.role).trim()
      : '';
    const emailId = normalizeEmail(req.body?.email_id);
    const config = getUnitMappingRoleConfig(role);

    if (!companyIdentifier) {
      return res.status(400).json({
        success: false,
        message: 'Company identifier is required',
      });
    }

    if (!unitId) {
      return res.status(400).json({
        success: false,
        message: 'Unit is required',
      });
    }

    if (!config) {
      return res.status(400).json({
        success: false,
        message: 'Invalid assignment role',
      });
    }

    if (!emailId || !isValidEmail(emailId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid email ID is required',
      });
    }

    await client.query('BEGIN');

    const companyResult = await client.query(
      `
        SELECT company_name
        FROM companies
        WHERE company_identifier = $1
        LIMIT 1
      `,
      [companyIdentifier]
    );

    if (companyResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Company not found',
      });
    }

    const unitResult = await client.query(
      `
        SELECT cum.unit_name
        FROM company_unit_master cum
        WHERE cum.company_identifier = $1
          AND cum.unit_id = $2
        FOR UPDATE
      `,
      [companyIdentifier, unitId]
    );

    if (unitResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Unit not found',
      });
    }

    const userResult = await client.query(
      `
        SELECT email_id
        FROM ifc_users
        WHERE company_identifier = $1
          AND role = $2
          AND LOWER(TRIM(email_id)) = $3
        LIMIT 1
      `,
      [companyIdentifier, config.role, emailId]
    );

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `${config.roleLabel} email ID is not available for this company`,
      });
    }

    await client.query(
      `
        INSERT INTO company_unit_responsibilities (
          company_identifier,
          unit_id,
          user_email_id,
          responsibility_type
        )
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (company_identifier, unit_id, responsibility_type)
        DO UPDATE SET user_email_id = EXCLUDED.user_email_id
      `,
      [companyIdentifier, unitId, emailId, config.responsibilityType]
    );

    await client.query('COMMIT');

    try {
      const emailPayload = buildUnitAssignmentNotificationEmail({
        roleLabel: config.roleLabel,
        unitName: unitResult.rows[0]?.unit_name || unitId,
        companyName: companyResult.rows[0]?.company_name || companyIdentifier,
        assignedByText: 'Siteadmin has assigned',
      });

      const emailSent = await sendEmail(emailId, emailPayload.subject, emailPayload.text);
      if (!emailSent) {
        console.warn(`Warning: failed to send siteadmin unit assignment email to ${emailId}`);
      }
    } catch (emailError) {
      console.error('Siteadmin unit assignment notification email error:', emailError);
    }

    return res.status(200).json({
      success: true,
      message: `${config.roleLabel} assigned successfully`,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Siteadmin update unit assignment error:', error);
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
  getCompanyUnitManagement,
  createCompany,
  deleteCompany,
  getAuditors,
  createAuditor,
  createCompanyCoordinator,
  createCompanyApprover,
  updateCompanyUnitAssignment,
  createBusinessProcessManagementEntry,
};
