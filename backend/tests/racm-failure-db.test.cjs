const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('real PostgreSQL deadlines, exclusions, terminal guard and audit rollback', { skip: process.env.RUN_DB_TESTS !== '1' }, async () => {
  require('dotenv').config({ quiet: true });
  const { pool } = require('../utils/db');
  const { AUTO_FAIL_SQL } = require('../utils/racm_failure');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Temporary tables shadow public tables on this connection only.
    await client.query(`
      CREATE TEMP TABLE control_forms (form_id text PRIMARY KEY, active boolean DEFAULT TRUE,
        status text DEFAULT '', control_design_conclusion text, deficiency_action_status boolean DEFAULT FALSE,
        deficiency_response_status text, updated_at timestamp);
      CREATE TEMP TABLE controls_reminder (form_id text PRIMARY KEY, final_reminder_sent_at timestamp);
      CREATE TEMP TABLE process_owner_declaration (form_id text, no_furthure_submission boolean);
      CREATE TEMP TABLE audit_logs_racm (form_id text, action text, ref_data text);
    `);
    const migration = fs.readFileSync(path.join(__dirname, '../prisma/migrations/20261114160000_racm_automatic_failure/migration.sql'), 'utf8')
      .replaceAll('prevent_failed_racm_update()', 'pg_temp.prevent_failed_racm_update()');
    await client.query(migration);
    const fixtures = [
      ['initial', '', null, true, false, null, 25],
      ['rejected', 'Rejected', null, true, false, null, 25],
      ['decision-rejected', 'Rejected', 'Not Effective', true, false, null, 25],
      ['ineffective', 'Approved', 'Not Effective', true, true, 'awaiting_owner_action', 25],
      ['ineffective-rejected', 'Approved', 'Not Effective', true, true, 'resubmission_required', 25],
      ['too-early', '', null, true, false, null, 23],
      ['submitted', 'sent for approval', null, true, false, null, 25],
      ['approved', 'Approved', 'Effective', true, false, null, 25],
      ['inactive', '', null, false, false, null, 25],
      ['declared', '', null, true, false, null, 25],
      ['response-submitted', 'Approved', 'Not Effective', true, true, 'submitted_for_review', 25],
      ['reset-cycle', 'Rejected', null, true, false, null, null],
      ['already-failed', '', 'Failed', true, false, null, 25],
    ];
    for (const [id, status, conclusion, active, action, responseStatus, hours] of fixtures) {
      await client.query('INSERT INTO control_forms(form_id,status,control_design_conclusion,active,deficiency_action_status,deficiency_response_status) VALUES ($1,$2,$3,$4,$5,$6)', [id,status,conclusion,active,action,responseStatus]);
      await client.query(`INSERT INTO controls_reminder(form_id,final_reminder_sent_at,ineffective_final_reminder_sent_at)
        VALUES ($1, (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') - make_interval(hours => $2),
          CASE WHEN $3::boolean THEN (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') - make_interval(hours => $2) END)`, [id,hours,action]);
    }
    await client.query("INSERT INTO process_owner_declaration VALUES ('declared', TRUE)");
    const result = await client.query(AUTO_FAIL_SQL, [1]);
    assert.deepEqual(result.rows.map((r) => r.form_id).sort(), ['decision-rejected', 'ineffective', 'ineffective-rejected', 'initial', 'rejected']);
    const audit = await client.query("SELECT ref_data FROM audit_logs_racm WHERE form_id='ineffective'");
    assert.equal(JSON.parse(audit.rows[0].ref_data).previous_conclusion, 'Not Effective');
    assert.equal((await client.query(AUTO_FAIL_SQL, [1])).rowCount, 0, 'repeated runs must not re-fail or duplicate audit');
    await client.query('SAVEPOINT terminal_test');
    await assert.rejects(client.query("UPDATE control_forms SET status='sent for approval' WHERE form_id='initial'"), /read-only/);
    await client.query('ROLLBACK TO SAVEPOINT terminal_test');
    assert.equal((await client.query("SELECT control_design_conclusion FROM control_forms WHERE form_id='initial'")).rows[0].control_design_conclusion, 'Failed');
  } finally {
    await client.query('ROLLBACK'); client.release(); await pool.end();
  }
});
