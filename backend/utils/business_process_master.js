const { prisma } = require('../lib/prisma');
const { pool } = require('./db');

function normalizeBusinessProcessValue(value) {
  return String(value || '').trim();
}

function normalizeBusinessProcessScope(companyIdentifier) {
  const normalized = String(companyIdentifier || '').trim();
  return normalized || null;
}

function normalizeBusinessProcessRow(row) {
  return {
    id: row.id,
    business_process: String(row.business_process || row.businessProcess || '').trim(),
    business_process_code: String(row.business_process_code || row.businessProcessCode || '').trim(),
    company_identifier: String(row.company_identifier || row.companyIdentifier || '').trim() || null,
    is_default: row.is_default != null ? Boolean(row.is_default) : Boolean(row.isDefault),
    is_active: row.is_active != null ? Boolean(row.is_active) : Boolean(row.isActive),
    created_by_email: String(row.created_by_email || row.createdByEmail || '').trim() || null,
    updated_by_email: String(row.updated_by_email || row.updatedByEmail || '').trim() || null,
    created_at: row.created_at || row.createdAt || null,
    updated_at: row.updated_at || row.updatedAt || null,
  };
}

function toCaseInsensitiveWhere(field, value) {
  return {
    [field]: {
      equals: value,
      mode: 'insensitive',
    },
  };
}

async function listBusinessProcessesForCompany(clientOrPool = pool, companyIdentifier = null) {
  const normalizedCompanyIdentifier = normalizeBusinessProcessScope(companyIdentifier);
  const params = [];
  let scopeSql = 'bp.company_identifier IS NULL';

  if (normalizedCompanyIdentifier) {
    params.push(normalizedCompanyIdentifier);
    scopeSql = '(bp.company_identifier IS NULL OR bp.company_identifier = $1)';
  }

  const result = await clientOrPool.query(
    `
      SELECT
        bp.id,
        TRIM(bp.business_process) AS business_process,
        TRIM(bp.business_process_code) AS business_process_code,
        bp.company_identifier,
        bp.is_default,
        bp.is_active,
        bp.created_by_email,
        bp.updated_by_email,
        bp.created_at,
        bp.updated_at
      FROM business_process_master bp
      WHERE bp.is_active = TRUE
        AND NULLIF(TRIM(COALESCE(bp.business_process, '')), '') IS NOT NULL
        AND NULLIF(TRIM(COALESCE(bp.business_process_code, '')), '') IS NOT NULL
        AND ${scopeSql}
      ORDER BY bp.is_default DESC, TRIM(bp.business_process) ASC, TRIM(bp.business_process_code) ASC
    `,
    params
  );

  return result.rows.map(normalizeBusinessProcessRow);
}

async function getBusinessProcessCodeForCompany(clientOrPool = pool, companyIdentifier, businessProcess) {
  const normalizedBusinessProcess = normalizeBusinessProcessValue(businessProcess);
  const normalizedCompanyIdentifier = normalizeBusinessProcessScope(companyIdentifier);

  if (!normalizedBusinessProcess) return '';

  const params = [normalizedBusinessProcess];
  let scopeSql = 'bp.company_identifier IS NULL';

  if (normalizedCompanyIdentifier) {
    params.push(normalizedCompanyIdentifier);
    scopeSql = '(bp.company_identifier IS NULL OR bp.company_identifier = $2)';
  }

  const result = await clientOrPool.query(
    `
      SELECT TRIM(bp.business_process_code) AS business_process_code
      FROM business_process_master bp
      WHERE bp.is_active = TRUE
        AND LOWER(TRIM(bp.business_process)) = LOWER(TRIM($1))
        AND ${scopeSql}
      ORDER BY
        CASE
          WHEN ${normalizedCompanyIdentifier ? 'bp.company_identifier = $2' : 'FALSE'} THEN 0
          ELSE 1
        END,
        bp.is_default DESC,
        bp.id ASC
      LIMIT 1
    `,
    params
  );

  return String(result.rows[0]?.business_process_code || '').trim();
}

async function createBusinessProcessMasterEntry(payload = {}) {
  const businessProcess = normalizeBusinessProcessValue(payload.business_process);
  const businessProcessCode = normalizeBusinessProcessValue(payload.business_process_code);
  const companyIdentifier = normalizeBusinessProcessScope(payload.company_identifier);
  const isDefault = companyIdentifier == null;
  const createdByEmail = normalizeBusinessProcessValue(payload.created_by_email) || null;

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

  const sameScopeWhere = companyIdentifier == null
    ? { companyIdentifier: null }
    : { companyIdentifier };

  const sameScopeDuplicate = await prisma.businessProcessMaster.findFirst({
    where: {
      OR: [
        { AND: [sameScopeWhere, toCaseInsensitiveWhere('businessProcess', businessProcess)] },
        { AND: [sameScopeWhere, toCaseInsensitiveWhere('businessProcessCode', businessProcessCode)] },
      ],
    },
    select: {
      businessProcess: true,
      businessProcessCode: true,
    },
  });

  if (sameScopeDuplicate) {
    const sameProcess =
      normalizeBusinessProcessValue(sameScopeDuplicate.businessProcess).toLowerCase() === businessProcess.toLowerCase();
    const error = new Error(sameProcess ? 'Business Process already exists' : 'Business Process code already exists');
    error.statusCode = 409;
    throw error;
  }

  const crossScopeWhere = companyIdentifier == null
    ? { NOT: { companyIdentifier: null } }
    : { companyIdentifier: null };

  const crossScopeDuplicate = await prisma.businessProcessMaster.findFirst({
    where: {
      AND: [
        crossScopeWhere,
        {
          OR: [
            toCaseInsensitiveWhere('businessProcess', businessProcess),
            toCaseInsensitiveWhere('businessProcessCode', businessProcessCode),
          ],
        },
      ],
    },
    select: {
      businessProcess: true,
      businessProcessCode: true,
      companyIdentifier: true,
    },
  });

  if (crossScopeDuplicate) {
    const sameProcess =
      normalizeBusinessProcessValue(crossScopeDuplicate.businessProcess).toLowerCase() === businessProcess.toLowerCase();
    const error = new Error(
      sameProcess
        ? (companyIdentifier == null
          ? 'Business Process conflicts with an existing company specific business process'
          : 'Business Process conflicts with common business process list')
        : (companyIdentifier == null
          ? 'Business Process code conflicts with an existing company specific business process'
          : 'Business Process code conflicts with common business process list')
    );
    error.statusCode = 409;
    throw error;
  }

  const created = await prisma.businessProcessMaster.create({
    data: {
      companyIdentifier,
      businessProcess,
      businessProcessCode,
      isDefault,
      isActive: true,
      createdByEmail,
      updatedByEmail: createdByEmail,
    },
  });

  return normalizeBusinessProcessRow(created);
}

async function seedDefaultBusinessProcesses(defaultRows = []) {
  const normalizedRows = Array.isArray(defaultRows)
    ? defaultRows
      .map((row) => ({
        businessProcess: normalizeBusinessProcessValue(row?.businessProcess || row?.business_process),
        businessProcessCode: normalizeBusinessProcessValue(row?.businessProcessCode || row?.business_process_code),
      }))
      .filter((row) => row.businessProcess && row.businessProcessCode)
    : [];

  if (normalizedRows.length === 0) {
    return { inserted: 0, updated: 0 };
  }

  let inserted = 0;
  let updated = 0;

  for (const row of normalizedRows) {
    const existing = await prisma.businessProcessMaster.findFirst({
      where: {
        companyIdentifier: null,
        OR: [
          toCaseInsensitiveWhere('businessProcess', row.businessProcess),
          toCaseInsensitiveWhere('businessProcessCode', row.businessProcessCode),
        ],
      },
    });

    if (!existing) {
      await prisma.businessProcessMaster.create({
        data: {
          companyIdentifier: null,
          businessProcess: row.businessProcess,
          businessProcessCode: row.businessProcessCode,
          isDefault: true,
          isActive: true,
        },
      });
      inserted += 1;
      continue;
    }

    const shouldUpdate =
      normalizeBusinessProcessValue(existing.businessProcess) !== row.businessProcess
      || normalizeBusinessProcessValue(existing.businessProcessCode) !== row.businessProcessCode
      || existing.isDefault !== true
      || existing.isActive !== true;

    if (shouldUpdate) {
      await prisma.businessProcessMaster.update({
        where: { id: existing.id },
        data: {
          businessProcess: row.businessProcess,
          businessProcessCode: row.businessProcessCode,
          isDefault: true,
          isActive: true,
        },
      });
      updated += 1;
    }
  }

  return { inserted, updated };
}

module.exports = {
  createBusinessProcessMasterEntry,
  getBusinessProcessCodeForCompany,
  listBusinessProcessesForCompany,
  normalizeBusinessProcessRow,
  normalizeBusinessProcessScope,
  normalizeBusinessProcessValue,
  seedDefaultBusinessProcesses,
};
