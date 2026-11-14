const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../controllers/company_co/racm_templates.js'), 'utf8');
const start = source.indexOf('async function getActiveRacmTemplateSummary(');
const end = source.indexOf('\nasync function ', start + 30);

async function summary(rows, unitId = 'UNIT') {
  const queries = [];
  const handler = vm.runInNewContext(source.slice(start, end) + '\ngetActiveRacmTemplateSummary', {
    pool: { query: async (sql, args) => { queries.push({ sql, args }); return { rows }; } }, console,
  });
  let status = 200, body;
  await handler({ user: { company_identifier: 'COMPANY', email_id: 'co@example.test' }, query: { unit_id: unitId } }, {
    status(code) { status = code; return this; }, json(value) { body = value; },
  });
  return { status, body, queries };
}

test('template notice uses one scoped read without hydrating or modifying templates', async () => {
  const result = await summary([{ template_name: 'Custom', version: 3, extra_field_count: 2 }]);
  assert.equal(result.status, 200);
  assert.equal(result.body.data.templateName, 'Custom');
  assert.equal(result.body.data.extraFieldCount, 2);
  assert.equal(result.queries.length, 1);
  assert.deepEqual(Array.from(result.queries[0].args), ['COMPANY', 'UNIT', 'co@example.test']);
  assert.match(result.queries[0].sql, /coordinator_unit_assignments/);
  assert.doesNotMatch(result.queries[0].sql, /INSERT|UPDATE|control_forms/i);
});

test('unauthorized unit returns forbidden without template data', async () => {
  const result = await summary([]);
  assert.equal(result.status, 403);
  assert.equal(result.body.data, undefined);
});

test('authorized uninitialized unit describes the default without creating it', async () => {
  const result = await summary([{ template_name: null, version: null, extra_field_count: 0 }]);
  assert.equal(result.body.data.templateName, 'Default');
  assert.equal(result.body.data.version, 1);
  assert.equal(result.body.data.extraFieldCount, 0);
});

test('missing unit is rejected before querying the database', async () => {
  const result = await summary([], '');
  assert.equal(result.status, 400);
  assert.equal(result.queries.length, 0);
});
