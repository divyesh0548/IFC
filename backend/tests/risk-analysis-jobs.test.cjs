const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRiskAnalysisWorker, enqueueRiskAnalysis } = require('../utils/risk_analysis_jobs');

function database(jobs) {
  let lockOwner;
  let releases = 0;
  const pool = {
    async connect() {
      const client = {
        release() { releases += 1; },
        async query(sql, args = []) {
          if (sql.includes('pg_try_advisory_lock')) {
            if (lockOwner) return { rows: [{ locked: false }] };
            lockOwner = client;
            return { rows: [{ locked: true }] };
          }
          if (sql.includes('pg_advisory_unlock')) {
            assert.equal(lockOwner, client);
            lockOwner = null;
            return { rows: [] };
          }
          if (sql.includes('SELECT *')) {
            const job = jobs.find((item) => ['queued', 'generating_concise', 'generating_missing'].includes(item.status) && !item.delayed);
            return { rows: job ? [{ ...job }] : [] };
          }
          if (sql.includes('INSERT INTO')) {
            jobs.push({ id: args[0], company_identifier: args[1], unit_id: args[2], business_process: args[3], requested_by_email: args[4], status: 'queued', attempts: 0 });
            return { rows: [] };
          }
          const job = jobs.find((item) => item.id === args[0]);
          assert.ok(job, 'updates must target an existing job');
          if (sql.includes('status = $2')) {
            job.status = args[1]; job.error_message = args[2]; job.delayed = true;
          } else if (sql.includes("status = 'generating_concise'")) {
            job.status = 'generating_concise'; job.attempts += 1;
          } else if (sql.includes("status = 'generating_missing'")) job.status = 'generating_missing';
          else if (sql.includes("status = 'completed'")) job.status = 'completed';
          else if (sql.includes("status = 'failed'")) job.status = 'failed';
          else assert.fail(`Unexpected SQL: ${sql}`);
          return { rows: [] };
        },
      };
      return client;
    },
  };
  return { pool, get releases() { return releases; } };
}

const job = (id, company = 'C1') => ({ id, company_identifier: company, unit_id: 'U1', business_process: 'Purchase to Pay', requested_by_email: 'co@example.test', status: 'queued', attempts: 0 });
const logger = { warn() {}, error(error) { assert.fail(String(error)); } };
const success = async () => ({ data: {} });

test('two uploads on separate workers serialize the two-stage workflow with company isolation', async () => {
  const jobs = [job('one'), job('two', 'C2')];
  const db = database(jobs);
  const steps = [];
  let continueFirst;
  let enteredFirst;
  const entered = new Promise((resolve) => { enteredFirst = resolve; });
  const blocked = new Promise((resolve) => { continueFirst = resolve; });
  const opts = {
    pool: db.pool, logger,
    executeConcise: async (company) => { steps.push(`concise:${company}`); if (company === 'C1') { enteredFirst(); await blocked; } return { data: {} }; },
    executeMissing: async (company) => { steps.push(`missing:${company}`); return { data: {} }; },
  };
  const first = createRiskAnalysisWorker(opts);
  const second = createRiskAnalysisWorker(opts);
  const run = first();
  await entered;
  await second();
  assert.equal(jobs[1].status, 'queued');
  assert.deepEqual(steps, ['concise:C1']);
  continueFirst(); await run;
  await second();
  assert.deepEqual(steps, ['concise:C1', 'missing:C1', 'concise:C2', 'missing:C2']);
  assert.ok(jobs.every((item) => item.status === 'completed'));
  assert.equal(db.releases, 3);
});

test('failure in concise stage never calls missing stage; later jobs can finish', async () => {
  const jobs = [job('one'), job('two', 'C2')]; const db = database(jobs);
  let missingCount = 0;
  const worker = createRiskAnalysisWorker({ pool: db.pool, logger,
    executeConcise: async (company) => { if (company === 'C1') throw new Error('Model unavailable'); return { data: {} }; },
    executeMissing: async () => { missingCount += 1; return { data: {} }; },
  });
  await worker();
  assert.equal(jobs[0].status, 'queued'); assert.equal(jobs[0].attempts, 1);
  assert.equal(missingCount, 0);
  await worker(); assert.equal(jobs[1].status, 'completed'); assert.equal(missingCount, 1);
});

test('interrupted running job is recovered and recomputes both stages', async () => {
  const jobs = [{ ...job('one'), status: 'generating_missing', attempts: 1 }]; const db = database(jobs);
  const steps = [];
  await createRiskAnalysisWorker({ pool: db.pool, logger,
    executeConcise: async () => { steps.push('concise'); return { data: {} }; },
    executeMissing: async () => { steps.push('missing'); return { data: {} }; },
  })();
  assert.deepEqual(steps, ['concise', 'missing']); assert.equal(jobs[0].status, 'completed');
  assert.equal(jobs[0].attempts, 2);
});

test('exhausted retries and lost coordinator access become failed jobs', async () => {
  for (const failure of [{ attempts: 2, statusCode: 503 }, { attempts: 0, statusCode: 403 }]) {
    const jobs = [{ ...job('one'), attempts: failure.attempts }]; const db = database(jobs);
    await createRiskAnalysisWorker({ pool: db.pool, logger,
      executeConcise: async () => { throw Object.assign(new Error('Cannot analyze'), { statusCode: failure.statusCode }); },
      executeMissing: async () => assert.fail('must not run'),
    })();
    assert.equal(jobs[0].status, 'failed');
  }
});

test('dry-run is never reported as completed or passed to missing stage', async () => {
  const jobs = [job('one')]; const db = database(jobs);
  await createRiskAnalysisWorker({ pool: db.pool, logger,
    executeConcise: async () => ({ data: { dry_run: true } }),
    executeMissing: async () => assert.fail('must not run'),
  })();
  assert.equal(jobs[0].status, 'failed');
});

test('enqueue records scope and requesting coordinator on the supplied transaction', async () => {
  const jobs = []; const db = database(jobs); const client = await db.pool.connect();
  const result = await enqueueRiskAnalysis(client, { companyIdentifier: 'C1', unitId: 'U2', businessProcess: ' P2P ', coordinatorEmail: 'co@example.test' });
  assert.equal(result.status, 'queued'); assert.equal(jobs[0].id, result.id);
  assert.equal(jobs[0].unit_id, 'U2'); assert.equal(jobs[0].business_process, 'P2P');
  assert.equal(jobs[0].requested_by_email, 'co@example.test');
});
