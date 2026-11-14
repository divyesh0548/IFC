const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function loadImporter() {
  const module = { exports: {} };
  const stubs = {
    './column_mapping': {}, './auditLog': {}, './sample_required': {}, './business_process_master': {},
    './sample_size_resolver': {
      loadUnitFrequencySampleSizeMap: async () => new Map(),
      resolveUnitDefaultSampleSize: () => 1,
      buildSampleSizeForFrequency: (frequency) => frequency === 'invalid'
        ? { ok: false, message: 'Invalid frequency' }
        : { ok: true, sampleSize: 1, sampleRequired: 'Yes' },
    },
    './racm_templates': {
      isRacmTemplateSchemaReady: async () => true,
      ensureActiveTemplateForUnit: async () => ({ ok: true, template: { id: 7 } }),
      getTemplateWithFieldsById: async () => ({ ok: true, extra_fields: [{ id: 9, field_key: 'note' }] }),
      validateDynamicValuesAgainstTemplate: (_, values) => ({ ok: true, dynamicValues: values }),
      RACM_TEMPLATE_SECTIONS: { DESIGN_IMPLEMENTATION: 'design' },
    },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../utils/racm_bulk_import_from_rows.js'), 'utf8'), {
    module, exports: module.exports, require: (name) => name === 'crypto' ? require('crypto') : stubs[name], console,
  });
  return module.exports.insertRacmRowsFromTransformedData;
}
const options = {
  companyIdentifier: 'TEST', coordinatorEmailId: 'test@example.test', unitId: 'UNIT',
  businessProcess: 'Process', financialYear: '2026-27',
};
test('501 controls use bounded batches, one custom-field batch, and one template count update', async () => {
  const calls = [];
  const client = { query: async (sql, values) => { calls.push({ sql, values }); return { rows: [] }; } };
  const result = await loadImporter()(client, { ...options, transformedData: Array.from({ length: 501 }, (_, index) => ({ control_number: String(index), control_frequency: 'Daily', dynamic_values: { note: 'value' } })) });
  assert.equal(result.insertedCount, 501);
  assert.equal(result.createdAuditEvents.length, 501);
  assert.equal(new Set(result.createdAuditEvents.map((event) => event.formId)).size, 501);
  const inserts = calls.filter((call) => call.sql.startsWith('INSERT INTO control_forms'));
  assert.equal(inserts.length, 3);
  assert.ok(inserts.every((call) => call.values.length < 65535));
  const dynamic = calls.find((call) => call.sql.includes('INSERT INTO racm_field_values'));
  assert.equal(JSON.parse(dynamic.values[0]).length, 501);
  const update = calls.find((call) => call.sql.startsWith('UPDATE racm_templates'));
  assert.equal(update.values[1], 501);
});
test('invalid later row fails validation before any control insert', async () => {
  const calls = [];
  const client = { query: async (sql) => { calls.push(sql); return { rows: [] }; } };
  await assert.rejects(loadImporter()(client, { ...options, transformedData: [{ control_frequency: 'Daily' }, { control_frequency: 'invalid' }] }), /Row 2/);
  assert.ok(!calls.some((sql) => sql.includes('INSERT INTO control_forms')));
});
test('database insert errors propagate so the caller can roll back', async () => {
  const client = { query: async (sql) => {
    if (sql.startsWith('INSERT INTO control_forms')) throw Object.assign(new Error('duplicate'), { code: '23505' });
    return { rows: [] };
  } };
  await assert.rejects(loadImporter()(client, { ...options, transformedData: [{ control_frequency: 'Daily' }] }), (error) => error.statusCode === 409);
});
