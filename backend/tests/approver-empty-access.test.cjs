const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
for (const [file, name] of [['routes/auth.js', 'hasAssignmentForPrivilegedUser'], ['modules/auth/auth.middleware.js', 'ensurePrivilegedUserHasAssignment']]) {
 function load(rows) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const start = source.indexOf('async function ' + name);
  const end = source.indexOf('\n}', start) + 2;
  let queries = 0;
  const check = vm.runInNewContext(source.slice(start, end) + '\n' + name, {
   normalizeEmail: (email) => String(email || '').trim().toLowerCase(),
   pool: { query: async () => { queries++; return { rows }; } },
  });
  return { check, queries: () => queries };
 }
 test(file + ': approvers do not require assignments', async () => {
  const stub = load([]);
  assert.equal(await stub.check({ role: 'approver', company_identifier: 'TEST', email_id: 'approver@example.test' }), true);
  assert.equal(stub.queries(), 0);
 });
 test(file + ': coordinator assignment requirement is preserved', async () => {
  const user = { role: 'company_co', company_identifier: 'TEST', email_id: 'coordinator@example.test' };
  assert.equal(await load([]).check(user), false);
  assert.equal(await load([{ exists: 1 }]).check(user), true);
 });
}
