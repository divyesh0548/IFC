const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../utils/racm_failure.js'), 'utf8');
function load(env = {}, rows = [], schemaReady = true) {
  const module = { exports: {} }; const calls = [];
  vm.runInNewContext(source, { module, process: { env }, require: () => ({
    pool: { query: async (...args) => { calls.push(args); return { rows: args[0].includes('pg_attribute') ? [{ ready: schemaReady }] : rows }; } },
  }) });
  return { ...module.exports, calls };
}

test('grace defaults to one full day and accepts configurable positive days', () => {
  assert.equal(load().getAutoFailGraceDays(), 1);
  assert.equal(load({ RACM_AUTO_FAIL_AFTER_FINAL_REMINDER_DAYS: '2' }).getAutoFailGraceDays(), 2);
  for (const value of ['0', '-1', '1.5', 'oops', '1day']) {
    assert.throws(() => load({ RACM_AUTO_FAIL_AFTER_FINAL_REMINDER_DAYS: value }).getAutoFailGraceDays(), /positive integer/);
  }
});

test('failed mutations are rejected before upload/controller side effects', async () => {
  const api = load({}, [{}]); let status, body; let next = false;
  await api.rejectFailedRacmMutation({ params: { form_id: 'F' }, user: { company_identifier: 'C' } }, {
    status(code) { status = code; return this; }, json(data) { body = data; },
  }, () => { next = true; });
  assert.equal(status, 409); assert.equal(body.success, false); assert.equal(next, false);
  assert.equal(api.calls[0][1][1], 'C');
});

test('nonfailed and read routes retain their existing behavior', async () => {
  const api = load(); let calls = 0;
  await api.rejectFailedRacmMutation({ params: { form_id: 'F' }, user: { company_identifier: 'C' } }, {}, () => { calls++; });
  await api.rejectFailedRacmMutation({ params: {}, body: {} }, {}, () => { calls++; });
  assert.equal(calls, 2); assert.equal(api.calls.length, 1);
});

test('failure scheduler supplies the configured grace to its atomic update', async () => {
  const api = load({ RACM_AUTO_FAIL_AFTER_FINAL_REMINDER_DAYS: '3' }, [{ form_id: 'F' }]);
  assert.equal(await api.runAutomaticRacmFailure(), 1);
  assert.equal(api.calls.at(-1)[1][0], 3);
});

test('automatic failure is dormant before the migration is installed', async () => {
  const api = load({}, [], false);
  assert.equal(await api.runAutomaticRacmFailure(), 0);
  assert.equal(api.calls.length, 1);
  assert.ok(api.calls[0][0].includes('pg_attribute'));
});
