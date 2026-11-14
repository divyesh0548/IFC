const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../scripts/reminder_emails/ineffective_reminder_emails.js'), 'utf8');

async function run({ count = 0, sent = true, email = 'owner@example.test', busy = false, schemaReady = true } = {}) {
  const events = []; let message;
  const form = { form_id: 'F', control_number: 'P2P1', control_owner: email, ineffective_reminder_sent_count: count };
  const client = {
    async query(sql) {
      if (sql.includes('pg_try_advisory_lock')) return { rows: [{ locked: !busy }] };
      if (sql.includes('pg_advisory_unlock')) return { rows: [] };
      return { rows: [form] };
    }, release() { events.push('release'); },
  };
  const module = { exports: {} };
  vm.runInNewContext(source, { module, console: { log() {}, warn() {}, error(error) { assert.fail(String(error)); } },
    require(name) {
      if (name.endsWith('/db')) return { pool: { connect: async () => client } };
      if (name.endsWith('/racm_failure')) return { getAutoFailGraceDays: () => 2, hasAutomaticFailureSchema: async () => schemaReady };
      if (name.endsWith('/send_email')) return { sendEmail: async (_, subject, text) => { message = { subject, text }; events.push('send'); return sent; } };
      if (name.endsWith('/racm_cc_recipients')) return { getCcEmailsForRacm: async () => [] };
      if (name.endsWith('/deficiency_response_notifications')) return { getCoordinatorEmailForUnit: async () => null };
      if (name.endsWith('/controls_reminder')) return {
        updateIneffectiveReminderDatetime: async () => { events.push('normal'); },
        recordFinalIneffectiveReminder: async () => { events.push('final'); },
        getReminderFinalAfter: () => 3, buildIneffectiveReminderDatetimeDueSql: () => 'TRUE',
        getIneffectiveReminderIntervalDays: () => 2, formatReminderTimestampForLog: () => '',
      };
      if (name.endsWith('/racm_email_details')) return { buildRacmDetailsSection: () => '' };
      if (name.endsWith('/racm_status_user_email')) return { buildUserFormDetailUrl: () => '' };
      return {};
    },
  });
  await module.exports.runIneffectiveReminderEmails();
  return { events, message };
}

test('Not Effective stage sends normal reminders up to the configured count', async () => {
  for (const count of [0, 1, 2]) {
    const result = await run({ count });
    assert.deepEqual(result.events, ['send', 'normal', 'release']);
    assert.ok(!result.message.subject.includes('Final'));
  }
});

test('next reminder is final and explains the configured deadline and Failed result', async () => {
  const result = await run({ count: 3 });
  assert.deepEqual(result.events, ['send', 'final', 'release']);
  assert.match(result.message.subject, /Final reminder/);
  assert.match(result.message.text, /within 2 day\(s\)/);
  assert.match(result.message.text, /Failed/);
});

test('failed email, invalid address, or busy scheduler never closes the reminder cycle', async () => {
  for (const options of [{ count: 3, sent: false }, { count: 3, email: '' }, { busy: true }]) {
    const result = await run(options);
    assert.ok(!result.events.includes('final')); assert.ok(!result.events.includes('normal'));
    assert.equal(result.events.at(-1), 'release');
  }
});

test('before migration, existing ineffective reminders continue without final/failure claims', async () => {
  const result = await run({ count: 3, schemaReady: false });
  assert.deepEqual(result.events, ['send', 'normal', 'release']);
  assert.ok(!result.message.text.includes('Failed'));
});

test('ineffective reset helpers remain compatible before migration and reset tracking afterward', async () => {
  const helperSource = fs.readFileSync(path.join(__dirname, '../utils/controls_reminder.js'), 'utf8');
  for (const ready of [false, true]) {
    for (const name of ['seedIneffectiveReminderDatetime', 'resetIneffectiveReminderDatetime']) {
      const start = helperSource.indexOf(`async function ${name}(`);
      const end = helperSource.indexOf('\nasync function ', start + 30);
      const calls = [];
      const helper = vm.runInNewContext(helperSource.slice(start, end) + `\n${name}`, {
        hasAutomaticFailureSchema: async () => ready, getIneffectiveDueDays: () => 2,
        controlsReminderUtcReturningSql: () => 'ineffective_reminder_datetime',
      });
      await helper({ query: async (sql) => { calls.push(sql); return { rows: [] }; } }, 'F');
      const sql = calls.find((statement) => statement.includes('INSERT INTO controls_reminder'));
      assert.equal(sql.includes('ineffective_reminder_sent_count = 0'), ready);
      assert.equal(sql.includes('ineffective_final_reminder_sent_at = NULL'), ready);
      assert.equal((sql.match(/ineffective_reminder_datetime = NULL/g) || []).length, 1);
    }
  }
});
