const { pool } = require('../../utils/db');
const { attachControlFormDocuments } = require('../../utils/racm_documents');
const {
  controlFormsUtcOverridesSql,
  createdAtUtcSql,
} = require('../../utils/sqlUtcTimestamps');

async function getHomeStats(req, res) {
  try {
    const [auditorResult, companyResult, userResult, racmResult] = await Promise.all([
      pool.query(
        `
          SELECT NULLIF(TRIM(emp_name), '') AS emp_name, email_id
          FROM ifc_users
          WHERE id = $1
          LIMIT 1
        `,
        [req.user.id]
      ),
      pool.query('SELECT COUNT(*)::int AS count FROM companies'),
      pool.query("SELECT COUNT(*)::int AS count FROM ifc_users WHERE role = 'user'"),
      pool.query('SELECT COUNT(*)::int AS count FROM control_forms'),
    ]);

    const auditor = auditorResult.rows[0] || {};
    return res.status(200).json({
      success: true,
      data: {
        auditor_name: auditor.emp_name || auditor.email_id || req.user.email_id || 'Auditor',
        total_companies: Number(companyResult.rows[0]?.count || 0),
        total_users: Number(userResult.rows[0]?.count || 0),
        total_racms: Number(racmResult.rows[0]?.count || 0),
      },
    });
  } catch (error) {
    console.error('Auditor home stats error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch auditor home stats',
    });
  }
}

async function getCompanies(req, res) {
  try {
    const [companiesResult, unitsResult, statsResult] = await Promise.all([
      pool.query(
        `
          SELECT c.*, ${createdAtUtcSql('c.created_at')}
          FROM companies c
          ORDER BY c.created_at DESC NULLS LAST, c.id DESC
        `
      ),
      pool.query(
        `
          SELECT
            cum.id,
            cum.company_identifier,
            cum.unit_id,
            cum.unit_name,
            cum.unit_address,
            coordinator_map.user_email_id AS coordinator_email_id,
            COALESCE(NULLIF(TRIM(coordinator.emp_name), ''), NULLIF(TRIM(coordinator_map.user_email_id), '')) AS coordinator_display_name,
            approver_map.user_email_id AS approver_email_id,
            COALESCE(NULLIF(TRIM(approver.emp_name), ''), NULLIF(TRIM(approver_map.user_email_id), '')) AS approver_display_name
          FROM company_unit_master cum
          LEFT JOIN LATERAL (
            SELECT STRING_AGG(DISTINCT a.coordinator_email_id, ', ' ORDER BY a.coordinator_email_id) AS user_email_id
            FROM coordinator_unit_assignments a
            WHERE a.company_identifier = cum.company_identifier AND a.unit_id = cum.unit_id
          ) coordinator_map ON TRUE
          LEFT JOIN LATERAL (
            SELECT STRING_AGG(DISTINCT COALESCE(NULLIF(TRIM(u.emp_name), ''), a.coordinator_email_id), ', ') AS emp_name
            FROM coordinator_unit_assignments a
            LEFT JOIN ifc_users u ON LOWER(TRIM(u.email_id)) = LOWER(TRIM(a.coordinator_email_id))
            WHERE a.company_identifier = cum.company_identifier AND a.unit_id = cum.unit_id
          ) coordinator ON TRUE
          LEFT JOIN LATERAL (
            SELECT STRING_AGG(DISTINCT a.approver_email_id, ', ' ORDER BY a.approver_email_id) AS user_email_id
            FROM approver_assignments a
            WHERE a.company_identifier = cum.company_identifier
              AND a.unit_id = cum.unit_id
          ) approver_map ON TRUE
          LEFT JOIN LATERAL (
            SELECT STRING_AGG(DISTINCT COALESCE(NULLIF(TRIM(u.emp_name), ''), a.approver_email_id), ', ') AS emp_name
            FROM approver_assignments a
            LEFT JOIN ifc_users u ON LOWER(TRIM(u.email_id)) = LOWER(TRIM(a.approver_email_id))
            WHERE a.company_identifier = cum.company_identifier
              AND a.unit_id = cum.unit_id
          ) approver ON TRUE
          ORDER BY cum.company_identifier ASC, cum.id ASC
        `
      ),
      pool.query(
        `
          SELECT
            c.company_identifier,
            COUNT(DISTINCT CASE WHEN u.role = 'user' THEN u.id END)::int AS total_users,
            COUNT(DISTINCT cf.id)::int AS total_racms
          FROM companies c
          LEFT JOIN ifc_users u
            ON u.company_identifier = c.company_identifier
          LEFT JOIN control_forms cf
            ON cf.company_identifier = c.company_identifier
          GROUP BY c.company_identifier
        `
      ),
    ]);

    const unitsByCompany = unitsResult.rows.reduce((acc, unit) => {
      if (!acc[unit.company_identifier]) {
        acc[unit.company_identifier] = [];
      }

      acc[unit.company_identifier].push(unit);
      return acc;
    }, {});

    const statsByCompany = statsResult.rows.reduce((acc, row) => {
      acc[row.company_identifier] = {
        total_users: Number(row.total_users || 0),
        total_racms: Number(row.total_racms || 0),
      };
      return acc;
    }, {});

    const data = companiesResult.rows.map((company) => {
      const companyUnits = unitsByCompany[company.company_identifier] || [];
      const companyStats = statsByCompany[company.company_identifier] || {
        total_users: 0,
        total_racms: 0,
      };

      return {
        ...company,
        total_users: companyStats.total_users,
        total_racms: companyStats.total_racms,
        total_units: companyUnits.length,
        company_units: companyUnits,
      };
    });

    return res.status(200).json({
      success: true,
      data,
      count: data.length,
    });
  } catch (error) {
    console.error('Auditor companies error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch companies',
    });
  }
}

async function getUsers(req, res) {
  try {
    const result = await pool.query(
      `
        SELECT
          u.id,
          u.email_id,
          u.role,
          ${createdAtUtcSql('u.created_at')},
          u.company_identifier,
          u.emp_code,
          u.emp_name,
          u.designation,
          u.department,
          u.mobile,
          memberships.unit_id,
          c.company_name,
          memberships.unit_name
        FROM ifc_users u
        LEFT JOIN companies c
          ON c.company_identifier = u.company_identifier
        LEFT JOIN LATERAL (
          SELECT STRING_AGG(DISTINCT m.unit_id, ', ') AS unit_id,
                 STRING_AGG(DISTINCT NULLIF(TRIM(cum.unit_name), ''), ', ') AS unit_name
          FROM user_unit_memberships m
          LEFT JOIN company_unit_master cum
            ON cum.company_identifier = m.company_identifier AND cum.unit_id = m.unit_id
          WHERE m.company_identifier = u.company_identifier
            AND LOWER(TRIM(m.user_email_id)) = LOWER(TRIM(u.email_id))
        ) memberships ON TRUE
        WHERE u.role <> 'siteadmin'
        ORDER BY u.created_at DESC NULLS LAST, u.id DESC
      `
    );

    return res.status(200).json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('Auditor users error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
    });
  }
}

async function getRacms(req, res) {
  try {
    const result = await pool.query(
      `
        SELECT
          cf.*,
          ${controlFormsUtcOverridesSql('cf')},
          c.company_name,
          NULLIF(TRIM(cum.unit_name), '') AS unit_name,
          NULLIF(TRIM(owner.emp_name), '') AS control_owner_name
        FROM control_forms cf
        LEFT JOIN companies c
          ON c.company_identifier = cf.company_identifier
        LEFT JOIN company_unit_master cum
          ON cum.company_identifier = cf.company_identifier
         AND cum.unit_id = cf.unit_id
        LEFT JOIN ifc_users owner
          ON LOWER(TRIM(owner.email_id)) = LOWER(TRIM(cf.control_owner))
        ORDER BY cf.created_at DESC NULLS LAST, cf.id DESC
      `
    );

    await attachControlFormDocuments(pool, result.rows);

    return res.status(200).json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('Auditor RACMs error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch RACMs',
    });
  }
}

module.exports = {
  getHomeStats,
  getCompanies,
  getUsers,
  getRacms,
};
