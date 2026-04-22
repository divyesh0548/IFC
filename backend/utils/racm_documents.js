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
      SELECT id, form_id, sample_doc, created_at
      FROM sample_docs
      WHERE form_id = ANY($1::text[])
      ORDER BY id ASC
    `,
    [ids]
  );
  const userResult = await db.query(
    `
      SELECT id, form_id, doc_uploaded_by_user, created_at
      FROM doc_uploaded_by_user
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
      FROM doc_uploaded_by_user
      WHERE form_id = $1
      ORDER BY id DESC
      LIMIT 1
    `,
    [formId]
  );

  const value = result.rows[0]?.doc_uploaded_by_user;
  return value == null || String(value).trim() === '' ? null : value;
}

async function insertUserDocument(db, formId, docUrl) {
  const value = docUrl == null ? '' : String(docUrl).trim();
  if (!value) return null;

  const result = await db.query(
    `
      INSERT INTO doc_uploaded_by_user (form_id, doc_uploaded_by_user, created_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')
      RETURNING id, form_id, doc_uploaded_by_user, created_at
    `,
    [formId, value]
  );

  return result.rows[0] || null;
}

async function insertSampleDocument(db, formId, docUrl) {
  const value = docUrl == null ? '' : String(docUrl).trim();
  if (!value) return null;

  const result = await db.query(
    `
      INSERT INTO sample_docs (form_id, sample_doc, created_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')
      RETURNING id, form_id, sample_doc, created_at
    `,
    [formId, value]
  );

  return result.rows[0] || null;
}

module.exports = {
  attachControlFormDocuments,
  getControlFormDocumentRows,
  getLatestUserDocument,
  insertSampleDocument,
  insertUserDocument,
};
