function sanitizeS3PathSegment(value, fallback = 'unknown') {
  const cleaned = String(value ?? '')
    .trim()
    .replace(/[/\\]+/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/[^a-zA-Z0-9._ -]/g, '')
    .trim();

  return cleaned || fallback;
}

function buildRacmS3BaseFolderPath({ companyName, unitName, businessProcess, formId }) {
  const companySegment = sanitizeS3PathSegment(companyName, 'unknown-company');
  const unitSegment = sanitizeS3PathSegment(unitName, 'unknown-unit');
  const processSegment = sanitizeS3PathSegment(businessProcess, 'unknown-process');
  const formSegment = sanitizeS3PathSegment(formId, 'unknown-form');

  return `${companySegment}/${unitSegment}/${processSegment}/${formSegment}`;
}

const SAMPLE_DOCUMENTS_S3_SUBFOLDER = 'Sample Docs';

function buildRacmDocumentSubfolderPath(baseFolderPath, subfolderName) {
  const normalizedBaseFolder = String(baseFolderPath || '').trim().replace(/[\/\\]+$/g, '');
  const sanitizedSubfolder = sanitizeS3PathSegment(subfolderName, 'documents');
  return `${normalizedBaseFolder}/${sanitizedSubfolder}`;
}

function buildUserDocumentS3FolderPath(context) {
  return buildRacmS3BaseFolderPath(context);
}

function buildSampleDocumentS3FolderPath(context) {
  return buildRacmDocumentSubfolderPath(buildRacmS3BaseFolderPath(context), SAMPLE_DOCUMENTS_S3_SUBFOLDER);
}

function formatDeficiencyResponseFolderName(responseType) {
  const normalizedType = String(responseType || '').trim().toLowerCase();
  if (normalizedType === 'compensatory_racm') {
    return 'Compensatory RACM';
  }
  return 'Mitigation Plan';
}

function buildDeficiencyResponseS3FolderPath(context, responseType) {
  return buildRacmDocumentSubfolderPath(
    buildRacmS3BaseFolderPath(context),
    formatDeficiencyResponseFolderName(responseType)
  );
}

async function getControlFormUserDocumentContext(db, formId) {
  const normalizedFormId = formId == null ? '' : String(formId).trim();
  if (!normalizedFormId) return null;

  const result = await db.query(
    `
      SELECT
        cf.form_id,
        cf.business_process,
        COALESCE(NULLIF(TRIM(c.company_name), ''), cf.company_identifier) AS company_name,
        COALESCE(NULLIF(TRIM(cum.unit_name), ''), cf.unit_id) AS unit_name
      FROM control_forms cf
      LEFT JOIN companies c
        ON c.company_identifier = cf.company_identifier
      LEFT JOIN company_unit_master cum
        ON cum.company_identifier = cf.company_identifier
       AND cum.unit_id = cf.unit_id
      WHERE cf.form_id = $1
      LIMIT 1
    `,
    [normalizedFormId]
  );

  return result.rows[0] || null;
}

async function getControlFormDocumentRows(db, formIds) {
  const ids = Array.from(
    new Set(
      (Array.isArray(formIds) ? formIds : [formIds])
        .map((id) => (id == null ? '' : String(id).trim()))
        .filter(Boolean)
    )
  );

  if (ids.length === 0) {
    return {
      sampleDocsByFormId: new Map(),
      userDocsByFormId: new Map(),
    };
  }

  const sampleResult = await db.query(
    `
      SELECT id, form_id, sample_doc, user_id, created_at
      FROM sample_docs
      WHERE form_id = ANY($1::text[])
      ORDER BY id ASC
    `,
    [ids]
  );
  const userResult = await db.query(
    `
      SELECT id, form_id, doc_uploaded_by_user, user_id, created_at
      FROM racm_docs
      WHERE form_id = ANY($1::text[])
      ORDER BY id ASC
    `,
    [ids]
  );

  const sampleDocsByFormId = new Map();
  for (const row of sampleResult.rows) {
    const formId = row.form_id;
    if (!sampleDocsByFormId.has(formId)) sampleDocsByFormId.set(formId, []);
    sampleDocsByFormId.get(formId).push(row);
  }

  const userDocsByFormId = new Map();
  for (const row of userResult.rows) {
    const formId = row.form_id;
    if (!userDocsByFormId.has(formId)) userDocsByFormId.set(formId, []);
    userDocsByFormId.get(formId).push(row);
  }

  return { sampleDocsByFormId, userDocsByFormId };
}

function latestUrl(rows, columnName) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const latest = rows[rows.length - 1];
  const value = latest ? latest[columnName] : null;
  return value == null || String(value).trim() === '' ? null : value;
}

async function attachControlFormDocuments(db, controlForms) {
  const rows = Array.isArray(controlForms) ? controlForms : [controlForms];
  const formIds = rows.map((row) => row && row.form_id).filter(Boolean);
  const { sampleDocsByFormId, userDocsByFormId } = await getControlFormDocumentRows(db, formIds);

  for (const row of rows) {
    if (!row || !row.form_id) continue;
    const sampleDocs = sampleDocsByFormId.get(row.form_id) || [];
    const userDocs = userDocsByFormId.get(row.form_id) || [];

    row.sample_docs = sampleDocs;
    row.doc_uploaded_by_user_docs = userDocs;

    // Compatibility for older callers that still expect one URL on the RACM object.
    row.sample_doc = latestUrl(sampleDocs, 'sample_doc');
    row.doc_uploaded_by_user = latestUrl(userDocs, 'doc_uploaded_by_user');
  }

  return controlForms;
}

async function getLatestUserDocument(db, formId) {
  const result = await db.query(
    `
      SELECT doc_uploaded_by_user
      FROM racm_docs
      WHERE form_id = $1
      ORDER BY id DESC
      LIMIT 1
    `,
    [formId]
  );

  const value = result.rows[0]?.doc_uploaded_by_user;
  return value == null || String(value).trim() === '' ? null : value;
}

async function insertUserDocument(db, formId, docUrl, userId = null) {
  const value = docUrl == null ? '' : String(docUrl).trim();
  if (!value) return null;
  const normalizedUserId = userId == null ? null : String(userId).trim() || null;

  const result = await db.query(
    `
      INSERT INTO racm_docs (form_id, doc_uploaded_by_user, user_id, created_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
      RETURNING id, form_id, doc_uploaded_by_user, user_id, created_at
    `,
    [formId, value, normalizedUserId]
  );

  return result.rows[0] || null;
}

async function insertSampleDocument(db, formId, docUrl, userId = null) {
  const value = docUrl == null ? '' : String(docUrl).trim();
  if (!value) return null;
  const uploaderEmail = userId == null ? null : String(userId).trim() || null;

  const result = await db.query(
    `
      INSERT INTO sample_docs (form_id, sample_doc, user_id, created_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
      RETURNING id, form_id, sample_doc, user_id, created_at
    `,
    [formId, value, uploaderEmail]
  );

  return result.rows[0] || null;
}

function normalizeS3DocumentKey(value) {
  if (value == null) return '';
  return String(value).trim();
}

function uniqueS3DocumentKeys(urls) {
  return Array.from(
    new Set(
      (Array.isArray(urls) ? urls : [])
        .map(normalizeS3DocumentKey)
        .filter(Boolean)
    )
  );
}

/**
 * Collect all S3 object keys linked to one or more RACMs (sample docs, user docs,
 * and deficiency response attachments).
 * @param {import('../generated/prisma').PrismaClient} prisma
 * @param {string|string[]} formIds
 */
async function collectRacmS3DocumentKeys(prisma, formIds) {
  const ids = Array.from(
    new Set(
      (Array.isArray(formIds) ? formIds : [formIds])
        .map((id) => (id == null ? '' : String(id).trim()))
        .filter(Boolean)
    )
  );
  if (ids.length === 0) return [];

  const [sampleDocs, userDocs, deficiencyAttachments] = await Promise.all([
    prisma.sampleDoc.findMany({
      where: { formId: { in: ids } },
      select: { sampleDoc: true },
    }),
    prisma.racmDoc.findMany({
      where: { formId: { in: ids } },
      select: { docUploadedByUser: true },
    }),
    prisma.deficiencyResponseAttachment.findMany({
      where: {
        submission: {
          deficiencyResponse: {
            formId: { in: ids },
          },
        },
      },
      select: { fileUrl: true },
    }),
  ]);

  return uniqueS3DocumentKeys([
    ...userDocs.map((doc) => doc.docUploadedByUser),
    ...sampleDocs.map((doc) => doc.sampleDoc),
    ...deficiencyAttachments.map((doc) => doc.fileUrl),
  ]);
}

module.exports = {
  attachControlFormDocuments,
  buildDeficiencyResponseS3FolderPath,
  buildRacmDocumentSubfolderPath,
  buildRacmS3BaseFolderPath,
  buildSampleDocumentS3FolderPath,
  buildUserDocumentS3FolderPath,
  collectRacmS3DocumentKeys,
  formatDeficiencyResponseFolderName,
  getControlFormDocumentRows,
  getControlFormUserDocumentContext,
  getLatestUserDocument,
  insertSampleDocument,
  insertUserDocument,
  sanitizeS3PathSegment,
};
