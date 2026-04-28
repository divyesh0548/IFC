const { pool } = require('../utils/db');

const IST_TIMESTAMP_DEFAULT =
  "timestamp without time zone NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata'::text)";

const REQUIRED_TABLES = {
  audit_logs: {
    columns: {
      id: 'serial',
      timestamp:
        "timestamp without time zone NULL DEFAULT ((CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text) AT TIME ZONE 'Asia/Kolkata'::text)",
      action: 'character varying(255) NULL',
      user_email_id: 'character varying(255) NULL',
      ref_data: 'text NULL',
    },
    primaryKey: 'id',
  },
  audit_logs_racm: {
    columns: {
      id: 'serial',
      timestamp:
        "timestamp without time zone NULL DEFAULT ((CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text) AT TIME ZONE 'Asia/Kolkata'::text)",
      action: 'character varying(255) NULL',
      user_email_id: 'character varying(255) NULL',
      form_id: 'character varying(255) NULL',
      ref_data: 'text NULL',
    },
    primaryKey: 'id',
  },
  sample_docs: {
    columns: {
      id: 'serial',
      form_id: 'character varying(255) NULL',
      sample_doc: 'character varying(255) NULL',
      created_at: IST_TIMESTAMP_DEFAULT,
    },
    primaryKey: 'id',
  },
  doc_uploaded_by_user: {
    columns: {
      id: 'serial',
      form_id: 'character varying(255) NULL',
      doc_uploaded_by_user: 'character varying(255) NULL',
      created_at: IST_TIMESTAMP_DEFAULT,
    },
    primaryKey: 'id',
  },
  companies: {
    columns: {
      id: 'serial',
      company_identifier: 'character varying(255) NULL',
      company_name: 'character varying(255) NULL',
      registered_email: 'character varying(255) NULL',
      registered_address: 'text NULL',
      unique_identification_number: 'character varying(255) NULL',
      gst: 'character varying(255) NULL',
      pan: 'character varying(255) NULL',
      number_of_corporate_offices: 'character varying(255) NULL',
      number_of_factory_units: 'character varying(255) NULL',
      created_at:
        "timestamp without time zone NULL DEFAULT ((CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text) AT TIME ZONE 'Asia/Kolkata'::text)",
    },
    primaryKey: 'id',
    unique: ['company_identifier'],
  },
  company_unit_master: {
    columns: {
      id: 'serial',
      company_identifier: 'character varying(255) NULL',
      unit_name: 'character varying(255) NULL',
      unit_address: 'text NULL',
      unit_id: 'character varying(255) NULL',
      coordinator_email_id: 'character varying(255) NULL',
      approver_email_id: 'character varying(255) NULL',
    },
    primaryKey: 'id',
    unique: ['unit_id'],
  },
  control_form_history: {
    columns: {
      id: 'serial',
      form_id: 'character varying(255) NULL',
      reason_by_approver: 'text NULL',
      rejection_timestamp: 'timestamp without time zone NULL',
    },
    primaryKey: 'id',
  },
  control_forms: {
    columns: {
      id: 'serial',
      standard_control_description: 'text NULL',
      sub_process: 'character varying(255) NULL',
      risk_description: 'text NULL',
      whether_fraud_risks_exist: 'character varying(255) NULL',
      control_objective: 'text NULL',
      ipe_reference: 'text NULL',
      nature_of_control: 'character varying(255) NULL',
      control_frequency: 'character varying(255) NULL',
      active: 'character varying(255) NULL',
      status: 'character varying(255) NULL',
      reason_by_approver: 'text NULL',
      created_at: "timestamp without time zone NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata'::text)",
      company_identifier: 'character varying(255) NULL',
      form_id: 'character varying(255) NULL',
      unit_id: 'character varying(255) NULL',
      remarks_by_user: 'text NULL',
      business_process: 'character varying(255) NULL',
      financial_year: 'character varying(255) NULL',
      sample_required: 'text NULL',
      completeness: 'boolean NULL',
      existence_occurrence: 'boolean NULL',
      rights_and_obligation: 'boolean NULL',
      valuation_and_allocation: 'boolean NULL',
      presentation_and_disclosure: 'boolean NULL',
      control_number: 'character varying(255) NULL',
      area: 'text NULL',
      risk_heat: 'character varying(255) NULL',
      process_walkthrough: 'text NULL',
      control_relies_on_ipe: 'character varying(255) NULL',
      audit_evidence_accuracy: 'character varying(255) NULL',
      key_control: 'character varying(255) NULL',
      application_name: 'character varying(255) NULL',
      control_performer: 'text NULL',
      control_owner: 'text NULL',
      control_design_procs: 'text NULL',
      control_design_conclusion: 'character varying(255) NULL',
      design_deficiency_desc: 'character varying(255) NULL',
      sample_size: 'character varying(255) NULL',
      control_type_fo: 'character varying(255) NULL',
      control_type_ma: 'character varying(255) NULL',
      due_date: 'date NULL',
      reminder_frequency: 'character varying(50) NULL',
      reminder_datetime: 'timestamp without time zone NULL',
      approval_status_change_timestamp: 'timestamp without time zone NULL',
    },
    primaryKey: 'id',
    unique: ['form_id'],
  },
  ifc_users: {
    columns: {
      id: 'serial',
      email_id: 'character varying(255) NOT NULL',
      password: 'character varying(255) NOT NULL',
      role: 'character varying(50) NOT NULL',
      created_at:
        "timestamp without time zone NULL DEFAULT ((CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text) AT TIME ZONE 'Asia/Kolkata'::text)",
      temp_login: 'integer NULL DEFAULT 0',
      company_identifier: 'character varying(255) NULL',
      emp_code: 'character varying(255) NULL',
      emp_name: 'character varying(255) NULL',
      designation: 'character varying(255) NULL',
      department: 'character varying(255) NULL',
      mobile: 'character varying(255) NULL',
      unit_id: 'character varying(255) NULL',
      login_email_sent: 'boolean NULL DEFAULT FALSE',
      temp_password_encrypted: 'text NULL',
    },
    primaryKey: 'id',
    unique: ['email_id'],
  },
};

function quoteIdentifier(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

function fqTable(tableName) {
  return `public.${quoteIdentifier(tableName)}`;
}

async function tableExists(client, tableName) {
  const result = await client.query(
    `
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = $1
      LIMIT 1
    `,
    [tableName]
  );
  return result.rows.length > 0;
}

async function getExistingColumns(client, tableName) {
  const result = await client.query(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
    `,
    [tableName]
  );
  return new Set(result.rows.map((r) => r.column_name));
}

async function ensurePrimaryKey(client, tableName, primaryKey) {
  const constraintName = `${tableName}_pkey`;
  const pkOnTable = await client.query(
    `
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = $1
        AND c.contype = 'p'
      LIMIT 1
    `,
    [tableName]
  );
  if (pkOnTable.rows.length > 0) return;

  const sameNameElsewhere = await client.query(
    `
      SELECT 1
      FROM pg_constraint
      WHERE conname = $1
      LIMIT 1
    `,
    [constraintName]
  );

  const finalConstraintName =
    sameNameElsewhere.rows.length > 0 ? `${constraintName}_public` : constraintName;

  await client.query(
    `ALTER TABLE ${fqTable(tableName)} ADD CONSTRAINT ${quoteIdentifier(finalConstraintName)} PRIMARY KEY (${quoteIdentifier(primaryKey)})`
  );
  console.log(`[db-init] Added PK ${finalConstraintName}`);
}

async function ensureUniqueConstraint(client, tableName, columnName) {
  const uniqueOnColumn = await client.query(
    `
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN unnest(c.conkey) WITH ORDINALITY AS keys(attnum, ord) ON true
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = keys.attnum
      WHERE n.nspname = 'public'
        AND t.relname = $1
        AND c.contype = 'u'
      GROUP BY c.oid
      HAVING array_agg(a.attname::text ORDER BY keys.ord) = ARRAY[$2]::text[]
      LIMIT 1
    `,
    [tableName, columnName]
  );
  if (uniqueOnColumn.rows.length > 0) return;

  const duplicates = await client.query(
    `
      SELECT ${quoteIdentifier(columnName)} AS value, COUNT(*) AS count
      FROM ${fqTable(tableName)}
      WHERE ${quoteIdentifier(columnName)} IS NOT NULL
      GROUP BY ${quoteIdentifier(columnName)}
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
      LIMIT 5
    `
  );
  if (duplicates.rows.length > 0) {
    const sampleValues = duplicates.rows
      .map((row) => `${row.value} (${row.count})`)
      .join(', ');
    throw new Error(
      `[db-init] Cannot add unique constraint on ${tableName}.${columnName}; duplicate values found: ${sampleValues}`
    );
  }

  const constraintName = `${tableName}_${columnName}_key`;
  const sameNameElsewhere = await client.query(
    `
      SELECT 1
      FROM pg_constraint
      WHERE conname = $1
      LIMIT 1
    `,
    [constraintName]
  );

  const finalConstraintName =
    sameNameElsewhere.rows.length > 0 ? `${constraintName}_public` : constraintName;

  await client.query(
    `ALTER TABLE ${fqTable(tableName)} ADD CONSTRAINT ${quoteIdentifier(finalConstraintName)} UNIQUE (${quoteIdentifier(columnName)})`
  );
  console.log(`[db-init] Added unique constraint ${finalConstraintName}`);
}

async function ensureTable(client, tableName, spec) {
  const exists = await tableExists(client, tableName);
  const columns = Object.entries(spec.columns);

  if (!exists) {
    const columnSql = columns
      .map(([name, typeSql]) => `${quoteIdentifier(name)} ${typeSql}`)
      .join(',\n        ');
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${fqTable(tableName)} (
        ${columnSql}
      )
    `);
    console.log(`[db-init] Created table ${tableName}`);
  }

  const existingColumns = await getExistingColumns(client, tableName);
  for (const [columnName, typeSql] of columns) {
    if (existingColumns.has(columnName)) continue;
    await client.query(
      `ALTER TABLE ${fqTable(tableName)} ADD COLUMN ${quoteIdentifier(columnName)} ${typeSql}`
    );
    console.log(`[db-init] Added column ${tableName}.${columnName}`);
  }

  if (spec.primaryKey) {
    await ensurePrimaryKey(client, tableName, spec.primaryKey);
  }

  if (Array.isArray(spec.unique)) {
    for (const columnName of spec.unique) {
      await ensureUniqueConstraint(client, tableName, columnName);
    }
  }
}

async function ensureDocumentCreatedAtDefaults(client) {
  const tables = ['sample_docs', 'doc_uploaded_by_user'];
  for (const tableName of tables) {
    const exists = await tableExists(client, tableName);
    if (!exists) continue;

    const existingColumns = await getExistingColumns(client, tableName);
    if (!existingColumns.has('created_at')) continue;

    await client.query(
      `ALTER TABLE ${fqTable(tableName)}
       ALTER COLUMN "created_at" SET DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata'::text)`
    );
    console.log(`[db-init] Ensured IST default for ${tableName}.created_at`);
  }
}

async function ensureRequiredTablesAndColumns() {
  const client = await pool.connect();
  try {
    for (const [tableName, spec] of Object.entries(REQUIRED_TABLES)) {
      await ensureTable(client, tableName, spec);
    }
    await ensureDocumentCreatedAtDefaults(client);
  } finally {
    client.release();
  }
}

module.exports = {
  ensureRequiredTablesAndColumns,
};

