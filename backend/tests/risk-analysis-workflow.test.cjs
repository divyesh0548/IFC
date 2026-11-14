const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../controllers/company_co/company_co.js'), 'utf8');
function load(name, dependencies) {
  const start = source.indexOf(`async function ${name}(`);
  const end = source.indexOf('\nasync function ', start + 30);
  return vm.runInNewContext(source.slice(start, end) + `\n${name}`, dependencies);
}
const scope = ['C', 'co@example.test', 'U', 'P2P'];
const controls = [{ control_number: 'P2P1', sub_process: 'Invoices', risk_description: 'Duplicate payment' }];
const risks = [{ subProcess: 'Invoices', risk: 'Duplicate payment' }];

test('shared concise operation reads the scoped controls, calls the AI and persists its output', async () => {
  let stored;
  const execute = load('executeConciseRiskList', {
    listUnitBusinessProcessControls: async (...args) => { assert.deepEqual(args, scope); return controls; },
    condenseRiskList: async (bp, input) => {
      assert.equal(bp, 'P2P'); assert.equal(input[0].riskDescription, 'Duplicate payment');
      return { risks, model_name: 'test-model' };
    },
    riskListControlFingerprint: () => 'fingerprint', readStoredConciseList: async () => null,
    createdAtUpdatedAtUtcSql: () => 'updated_at',
    pool: { query: async (sql, args) => { assert.match(sql, /INSERT INTO risk_analysis_concise_lists/); stored = args; return { rows: [{}] }; } },
  });
  const result = await execute(...scope);
  assert.equal(result.data.exists, true); assert.equal(result.data.stale, false);
  assert.deepEqual(Array.from(stored).slice(0, 3), ['C', 'U', 'P2P']);
  assert.equal(JSON.parse(stored[6])[0].risk, 'Duplicate payment');
});

test('shared overall operation uses the fresh concise list and saves in the existing results table', async () => {
  let saved;
  const execute = load('executeOverallMissingRisks', {
    requireFreshConciseList: async (...args) => { assert.deepEqual(args, scope); return { stored: { source_fingerprint: 'current' }, risks }; },
    analyzeOverallMissingRisks: async (bp, input) => {
      assert.equal(bp, 'P2P'); assert.equal(input.conciseRisks, risks);
      return { analysis: { risks: [] }, model_name: 'test-model' };
    },
    listUnitBusinessProcessControls: async () => controls,
    riskListControlFingerprint: () => 'current', createdAtUpdatedAtUtcSql: () => 'updated_at',
    pool: { query: async (sql, args) => { assert.match(sql, /INSERT INTO risk_analysis_overall_missing_risks/); saved = args; return { rows: [{}] }; } },
    serializeOverallMissingRiskAnalysis: () => ({ exists: true }),
  });
  const result = await execute(...scope);
  assert.equal(result.data.exists, true);
  assert.deepEqual(Array.from(saved).slice(0, 3), ['C', 'U', 'P2P']);
  assert.equal(saved[4], 'current');
});

test('controls changed during generation are rejected before saving outdated overall results', async () => {
  const execute = load('executeOverallMissingRisks', {
    requireFreshConciseList: async () => ({ stored: { source_fingerprint: 'old' }, risks }),
    analyzeOverallMissingRisks: async () => ({ analysis: { risks: [] } }),
    listUnitBusinessProcessControls: async () => controls,
    riskListControlFingerprint: () => 'changed',
    pool: { query: async () => assert.fail('outdated results must not be saved') },
  });
  await assert.rejects(execute(...scope), (error) => error.statusCode === 409);
});

test('queue status is scoped to the current company and mapped units', async () => {
  let args;
  const handler = load('getRiskAnalysisJobs', {
    normalizeEmail: (email) => email.toLowerCase(),
    getCoordinatorMappedUnits: async () => [{ unit_id: 'U', unit_name: 'Unit' }],
    pool: { query: async (_, values) => { args = values; return { rows: [{ unit_id: 'U', status: 'queued' }] }; } },
    console,
  });
  let body;
  await handler({ user: { company_identifier: 'C', email_id: 'co@example.test' } }, {
    json(value) { body = value; }, status() { return this; },
  });
  assert.equal(args[0], 'C'); assert.equal(args[1][0], 'U');
  assert.equal(body.data[0].unit_name, 'Unit');
});
