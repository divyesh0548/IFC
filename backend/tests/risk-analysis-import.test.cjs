const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../controllers/control_form/control_form.js'), 'utf8');
const start = source.indexOf('async function bulkImportRows(');
const end = source.indexOf('\nasync function ', start + 30);

async function upload({ optIn = false, queueError = false, imported = 1, unitAllowed = true } = {}) {
  const queries = [];
  let queued = 0;
  const client = {
    release() {},
    async query(sql) {
      queries.push(sql);
      return { rows: sql.includes('coordinator_unit_assignments') && unitAllowed ? [{ unit_id: 'U' }] : [] };
    },
  };
  const handler = vm.runInNewContext(source.slice(start, end) + '\nbulkImportRows', {
    console: { error() {} }, MAX_BULK_IMPORT_ROWS: 5000,
    EXCEL_BULK_RACM_UPLOAD_ACTION: 'Import',
    pool: { connect: async () => client },
    getMissingRacmRequiredFields: () => [],
    isRacmTemplateSchemaReady: async () => false,
    transformExcelData: (rows) => rows,
    applyControlFrequencyValueMapping: (rows) => rows,
    validateBulkImportControlFrequencies: () => ({ ok: true }),
    prepareBulkImportRows: async (_, { transformedData }) => ({ preparedRows: transformedData, duplicateControlNumbersInUpload: [], duplicateExistingCompanyControlNumbers: [] }),
    insertRacmRowsFromTransformedData: async () => ({ insertedCount: imported, skippedCount: 0, duplicateCount: 0, errorCount: 0, createdAuditEvents: [] }),
    logAuditEvent: async () => {},
    formatBulkImportZeroInsertedMessage: () => 'Nothing imported',
    formatBulkImportSuccessMessage: () => 'Imported',
    enqueueRiskAnalysis: async (transaction, scope) => {
      queued += 1;
      assert.equal(transaction, client);
      assert.equal(scope.unitId, 'U'); assert.equal(scope.companyIdentifier, 'C');
      assert.ok(!queries.includes('COMMIT'), 'enqueue must precede commit');
      if (queueError) throw new Error('Queue unavailable');
      return { id: 'JOB', status: 'queued' };
    },
  });
  let status, response;
  await handler({ user: { role: 'company_co', company_identifier: 'C', email_id: 'co@example.test' },
    body: { businessProcess: 'P2P', financialYear: '2026-27', unit_id: 'U', rows: [{}], auto_generate_missing_risks: optIn },
  }, { status(code) { status = code; return this; }, json(data) { response = data; } });
  return { status, response, queued, queries };
}

test('successful opted-in import queues in the same transaction without calling the AI', async () => {
  const result = await upload({ optIn: true });
  assert.equal(result.status, 200); assert.equal(result.queued, 1);
  assert.equal(result.response.data.riskAnalysisJob.status, 'queued');
  assert.ok(result.queries.includes('COMMIT'));
});

test('declined automatic analysis preserves normal import behavior', async () => {
  const result = await upload();
  assert.equal(result.status, 200); assert.equal(result.queued, 0);
  assert.equal(result.response.data.riskAnalysisJob, null);
  assert.ok(!result.queries.some((query) => query.includes('SAVEPOINT')));
});

test('queue failure preserves imported controls and returns a visible warning', async () => {
  const result = await upload({ optIn: true, queueError: true });
  assert.equal(result.status, 200);
  assert.equal(result.response.data.insertedCount, 1);
  assert.match(result.response.data.riskAnalysisWarning, /could not be queued/);
  assert.ok(result.queries.includes('ROLLBACK TO SAVEPOINT risk_analysis_enqueue'));
  assert.ok(result.queries.includes('COMMIT'));
  assert.ok(!result.queries.includes('ROLLBACK'));
});

test('empty or unauthorized imports do not create a background job', async () => {
  for (const options of [{ imported: 0 }, { unitAllowed: false }]) {
    const result = await upload({ optIn: true, ...options });
    assert.equal(result.status, 400); assert.equal(result.queued, 0);
    assert.ok(result.queries.includes('ROLLBACK')); assert.ok(!result.queries.includes('COMMIT'));
  }
});
