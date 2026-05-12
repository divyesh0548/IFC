const crypto = require('crypto');
const { pool } = require('../../utils/db');
const { prisma } = require('../../lib/prisma');
const { hashPassword, getPasswordPepper } = require('../../utils/password');
const { encryptTempPassword } = require('../../utils/login_email');
const { deleteFileFromS3 } = require('../../utils/s3Upload');

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

async function createBusinessProcess(payload = {}) {
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

  const existing = await prisma.busineesProcessCode.findFirst({
    where: {
      OR: [
        {
          businessProcess: {
            equals: businessProcess,
            mode: 'insensitive',
          },
        },
        {
          businessProcessCode: {
            equals: businessProcessCode,
            mode: 'insensitive',
          },
        },
      ],
    },
    select: {
      id: true,
      businessProcess: true,
      businessProcessCode: true,
    },
  });

  if (existing) {
    const sameProcess =
      normalizeBusinessProcessValue(existing.businessProcess).toLowerCase() === businessProcess.toLowerCase();
    const sameCode =
      normalizeBusinessProcessValue(existing.businessProcessCode).toLowerCase() === businessProcessCode.toLowerCase();

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

  const created = await prisma.busineesProcessCode.create({
    data: {
      businessProcess,
      businessProcessCode,
    },
    select: {
      id: true,
      businessProcess: true,
      businessProcessCode: true,
      createdAt: true,
    },
  });

  return {
    id: created.id,
    business_process: created.businessProcess,
    business_process_code: created.businessProcessCode,
    created_at: created.createdAt,
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

  try {
    getPasswordPepper();

    // Generate company identifier
    const company_identifier = generateCompanyIdentifier(company_name);

    const tempPassword = crypto.randomBytes(8).toString('hex');
    const tempPasswordHash = await hashPassword(tempPassword);
    const tempPasswordEncrypted = encryptTempPassword(tempPassword);

    const { company, companyUnits } = await prisma.$transaction(async (tx) => {
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

      const createdUnits = [];
      for (const [index, unit] of normalizedCompanyUnits.entries()) {
        let insertedUnit = null;
        let attempts = 0;

        while (!insertedUnit && attempts < 5) {
          attempts += 1;
          const unitId = generateUnitIdentifier(unit.unit_name);

          try {
            insertedUnit = await tx.companyUnitMaster.create({
              data: {
                companyIdentifier: company_identifier,
                unitName: unit.unit_name,
                unitAddress: unit.unit_address || null,
                unitId,
                coordinatorEmailId: coordinatorUnitIndexSet.has(index) ? coordinatorEmail : null,
              },
              select: {
                id: true,
                unitId: true,
                unitName: true,
                unitAddress: true,
                coordinatorEmailId: true,
              },
            });
          } catch (unitError) {
            const uniqueViolation =
              unitError?.code === 'P2002' ||
              String(unitError?.meta?.target || '').includes('unit_id');
            if (uniqueViolation && attempts < 5) {
              continue;
            }
            throw unitError;
          }
        }

        createdUnits.push({
          id: insertedUnit.id,
          unit_id: insertedUnit.unitId,
          unit_name: insertedUnit.unitName,
          unit_address: insertedUnit.unitAddress,
          coordinator_email_id: insertedUnit.coordinatorEmailId,
        });
      }

      if (coordinatorEmail) {
        const existingUser = await tx.ifcUser.findFirst({
          where: {
            emailId: {
              equals: coordinatorEmail,
              mode: 'insensitive',
            },
          },
          select: { id: true },
        });

        if (existingUser) {
          await tx.ifcUser.update({
            where: { id: existingUser.id },
            data: { companyIdentifier: company_identifier },
          });
        } else {
          await tx.ifcUser.create({
            data: {
              emailId: coordinatorEmail,
              password: tempPasswordHash,
              role: 'company_co',
              companyIdentifier: company_identifier,
              tempLogin: true,
              loginEmailSent: false,
              tempPasswordEncrypted,
            },
          });
        }
      }

      return {
        company: {
          id: createdCompany.id,
          company_identifier: createdCompany.companyIdentifier,
        },
        companyUnits: createdUnits,
      };
    }, {
      maxWait: 10000,
      timeout: 30000,
    });

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
    console.error('Error creating company:', error);

    if (error.code === 'P2002') {
      if (String(error.meta?.target || '').includes('unit_id')) {
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
      const [sampleDocs, userDocs] = await Promise.all([
        prisma.sampleDoc.findMany({
          where: { formId: { in: formIds } },
          select: { formId: true, sampleDoc: true },
          orderBy: { id: 'asc' },
        }),
        prisma.docUploadedByUser.findMany({
          where: { formId: { in: formIds } },
          select: { formId: true, docUploadedByUser: true },
          orderBy: { id: 'asc' },
        }),
      ]);

      const docUrlsToDelete = Array.from(
        new Set(
          [
            ...userDocs.map((doc) => doc.docUploadedByUser),
            ...sampleDocs.map((doc) => doc.sampleDoc),
          ]
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

      const racmDeleteCounts = await prisma.$transaction(async (tx) => {
        const deletedUserDocsResult = await tx.docUploadedByUser.deleteMany({
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

async function createBusinessProcessManagementEntry(req, res) {
  try {
    const created = await createBusinessProcess(req.body || {});
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
  deleteCompany,
  getAuditors,
  createAuditor,
  createBusinessProcessManagementEntry,
};
