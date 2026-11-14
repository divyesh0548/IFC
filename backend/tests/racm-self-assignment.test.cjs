const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../controllers/control_form/control_form.js'), 'utf8');
const start = source.indexOf('async function selfAssignRacm(');
const end = source.indexOf('\nasync function ', start + 30);
async function assign(overrides = {}, hasAccess = true, role = 'company_co') {
 const form = { company_identifier: 'TEST', unit_id: 'UNIT', active: false, ...overrides };
 let saved;
 const events = [];
 const handler = vm.runInNewContext(source.slice(start, end) + '\nselfAssignRacm', {
  pool: {}, console,
  getControlFormCoordinatorContext: async () => form,
  isCoordinatorAssignedRacm: (row) => Boolean(row.assigned_to_coordinator),
  hasValidProcessOwnerAssignment: async () => Boolean(form.control_owner),
  hasCoordinatorScheduleConfigured: (row) => Boolean(row.due_date && row.reminder_frequency),
  hasProcessOwnerDeclaration: async () => false,
  coordinatorHasUnitAccess: async () => hasAccess,
  isTruthyFlag: Boolean,
  prisma: { controlForm: { update: async ({ data }) => { saved = data; return { formId: 'TEST', ...data }; } } },
  logAuditEvent: async (action) => events.push(action),
 });
 let status, response;
 await handler({ params: { form_id: 'TEST' }, user: { role, email_id: 'test@example.test' } }, {
  status(code) { status = code; return this; }, json(body) { response = body; return body; },
 });
 return { status, response, saved, events };
}
test('self-assignment without a due date succeeds and stays inactive', async () => {
 const result = await assign({ reminder_frequency: 'Daily' });
 assert.equal(result.status, 200); assert.equal(result.saved.active, false);
 assert.equal(result.saved.assignedToCoordinator, true); assert.ok(!result.events.includes('Set RACM Active'));
});
test('self-assignment with a complete schedule activates without a sample document', async () => {
 const result = await assign({ due_date: '2026-12-01', reminder_frequency: 'Daily' });
 assert.equal(result.status, 200); assert.equal(result.saved.active, true);
 assert.ok(result.events.includes('Set RACM Active'));
});
test('missing reminder frequency also keeps self-assignment inactive', async () => {
 assert.equal((await assign({ due_date: '2026-12-01' })).saved.active, false);
});
test('unit access and approval locks still block self-assignment', async () => {
 const denied = await assign({}, false); assert.equal(denied.status, 403); assert.equal(denied.saved, undefined);
 const locked = await assign({ status: 'sent for approval' }); assert.equal(locked.status, 400); assert.equal(locked.saved, undefined);
});
