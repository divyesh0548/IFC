const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { getActiveRacmDeleteError } = require('../utils/racm_delete');
const source = fs.readFileSync(path.join(__dirname, '../controllers/control_form/control_form.js'), 'utf8');
const start = source.indexOf('async function deleteControlForm(');
const end = source.indexOf('\nasync function ', start + 30);

async function remove({ active = false, denied = false, cleanupFails = false } = {}) {
  const events = [];
  const tx = {};
  let transactionOpen = false;
  const handler = vm.runInNewContext(source.slice(start, end) + '\ndeleteControlForm', {
    console: { error() {} }, pool: {},
    prisma: {
      ifcUser: { findFirst: async () => ({ role: 'company_co', companyIdentifier: 'C' }) },
      controlForm: { findFirst: async () => ({ companyIdentifier: 'C', unitId: 'U', active }) },
      async $transaction(callback, options = {}) {
        // Simulate the reported remote cleanup duration without a wall-clock wait.
        if ((options.timeout || 5000) < 6144) throw new Error('Transaction expired');
        transactionOpen = true; events.push('begin');
        try { await callback(tx); events.push('commit'); }
        catch (error) { events.push('rollback'); throw error; }
        finally { transactionOpen = false; }
      },
    },
    isRacmDeleteEnabled: () => true,
    getCoordinatorUnitAccessError: async () => denied ? { status: 403, message: 'Denied' } : null,
    getActiveRacmDeleteError,
    collectRacmS3DocumentKeys: async () => ['document'],
    deleteFileFromS3: async () => { assert.equal(transactionOpen, false); events.push('storage'); },
    deleteAllFormScopedRows: async (client, id) => {
      assert.equal(client, tx); assert.equal(id, 'FORM'); assert.ok(transactionOpen);
      events.push('cleanup'); if (cleanupFails) throw new Error('Cleanup failed');
    },
  });
  let status, body;
  await handler({ params: { form_id: 'FORM' }, user: { email_id: 'co@example.test' } }, {
    status(code) { status = code; return this; }, json(data) { body = data; },
  });
  return { status, body, events };
}

test('cleanup taking longer than the five-second default can complete', async () => {
  const result = await remove();
  assert.equal(result.status, 200);
  assert.deepEqual(result.events, ['storage', 'begin', 'cleanup', 'commit']);
});

test('active controls and units outside coordinator access remain protected', async () => {
  for (const options of [{ active: true }, { denied: true }]) {
    const result = await remove(options);
    assert.ok([400, 403].includes(result.status)); assert.deepEqual(result.events, []);
  }
});

test('database cleanup failure rolls back instead of reporting success', async () => {
  const result = await remove({ cleanupFails: true });
  assert.equal(result.status, 500); assert.equal(result.body.success, false);
  assert.ok(result.events.includes('rollback')); assert.ok(!result.events.includes('commit'));
});
