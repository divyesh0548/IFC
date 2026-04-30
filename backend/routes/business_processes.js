const express = require('express');
const { verifyAuthenticatedUser } = require('../modules/auth/auth.middleware');
const { pool } = require('../utils/db');

const router = express.Router();

async function listBusinessProcesses(client) {
  const result = await client.query(
    `
      SELECT
        id,
        TRIM(business_process) AS business_process,
        TRIM(business_process_code) AS business_process_code,
        created_at
      FROM businees_process_code
      WHERE NULLIF(TRIM(COALESCE(business_process, '')), '') IS NOT NULL
        AND NULLIF(TRIM(COALESCE(business_process_code, '')), '') IS NOT NULL
      ORDER BY TRIM(business_process) ASC, TRIM(business_process_code) ASC
    `
  );

  return result.rows.map((row) => ({
    ...row,
    business_process: String(row.business_process || '').trim(),
    business_process_code: String(row.business_process_code || '').trim(),
  }));
}

router.get('/', verifyAuthenticatedUser, async (req, res) => {
  try {
    const data = await listBusinessProcesses(pool);
    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Get business processes error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch business processes',
    });
  }
});

module.exports = router;
