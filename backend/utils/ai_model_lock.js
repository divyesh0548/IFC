const GLOBAL_AI_MODEL_LOCK_ID = 9043101;

async function tryAcquireGlobalAiModelLock(client) {
  const result = await client.query(
    'SELECT pg_try_advisory_lock($1) AS locked',
    [GLOBAL_AI_MODEL_LOCK_ID]
  );

  return result.rows[0]?.locked === true;
}

async function releaseGlobalAiModelLock(client) {
  await client.query('SELECT pg_advisory_unlock($1)', [GLOBAL_AI_MODEL_LOCK_ID]);
}

module.exports = {
  GLOBAL_AI_MODEL_LOCK_ID,
  tryAcquireGlobalAiModelLock,
  releaseGlobalAiModelLock,
};
