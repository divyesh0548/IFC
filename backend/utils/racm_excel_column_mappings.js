const { pool } = require('./db');
const { utcTs } = require('./sqlUtcTimestamps');

function normalizeMappingName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ');
}

function asPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value;
}

function mapMappingRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    company_identifier: row.company_identifier,
    unit_id: row.unit_id,
    name: row.name,
    template_id: row.template_id,
    template_name: row.template_name || null,
    template_version: row.template_version != null ? Number(row.template_version) : null,
    column_mapping: asPlainObject(row.column_mapping) || {},
    assertion_yes_no_mapping: asPlainObject(row.assertion_yes_no_mapping),
    control_frequency_value_mapping: asPlainObject(row.control_frequency_value_mapping),
    excel_headers: Array.isArray(row.excel_headers) ? row.excel_headers : null,
    created_by: row.created_by || null,
    updated_by: row.updated_by || null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
    last_used_at: row.last_used_at || null,
  };
}

const MAPPING_TIMESTAMP_SELECT = `
  ${utcTs('m.created_at', 'created_at')},
  ${utcTs('m.updated_at', 'updated_at')},
  ${utcTs('m.last_used_at', 'last_used_at')}
`;

const MAPPING_TIMESTAMP_RETURNING = `
  ${utcTs('created_at', 'created_at')},
  ${utcTs('updated_at', 'updated_at')},
  ${utcTs('last_used_at', 'last_used_at')}
`;

async function listExcelColumnMappingsForActiveTemplate(client, {
  companyIdentifier,
  unitId,
}) {
  const companyId = String(companyIdentifier || '').trim();
  const unit = String(unitId || '').trim();
  if (!companyId || !unit) {
    return { ok: false, message: 'company_identifier and unit_id are required' };
  }

  const activeResult = await client.query(
    `
      SELECT id, template_name, version
      FROM racm_templates
      WHERE company_identifier = $1
        AND unit_id = $2
        AND status = 'active'
      ORDER BY version DESC, id DESC
      LIMIT 1
    `,
    [companyId, unit]
  );

  const active = activeResult.rows[0];
  if (!active) {
    return { ok: true, active_template: null, mappings: [] };
  }

  const templateName = String(active.template_name || '').trim();
  const listResult = await client.query(
    `
      SELECT
        m.id,
        m.company_identifier,
        m.unit_id,
        m.name,
        m.template_id,
        m.column_mapping,
        m.assertion_yes_no_mapping,
        m.control_frequency_value_mapping,
        m.excel_headers,
        m.created_by,
        m.updated_by,
        ${MAPPING_TIMESTAMP_SELECT},
        t.template_name,
        t.version AS template_version
      FROM racm_excel_column_mappings m
      INNER JOIN racm_templates t
        ON t.id = m.template_id
      WHERE m.company_identifier = $1
        AND m.unit_id = $2
        AND LOWER(TRIM(t.template_name)) = LOWER(TRIM($3))
      ORDER BY
        COALESCE(m.last_used_at, m.updated_at, m.created_at) DESC NULLS LAST,
        LOWER(TRIM(m.name)) ASC,
        m.id DESC
    `,
    [companyId, unit, templateName]
  );

  return {
    ok: true,
    active_template: {
      id: active.id,
      template_name: active.template_name,
      version: active.version,
    },
    mappings: listResult.rows.map(mapMappingRow),
  };
}

async function upsertExcelColumnMapping(client, {
  companyIdentifier,
  unitId,
  name,
  templateId,
  columnMapping,
  assertionYesNoMapping = null,
  controlFrequencyValueMapping = null,
  excelHeaders = null,
  actorEmail = null,
  overwrite = false,
}) {
  const companyId = String(companyIdentifier || '').trim();
  const unit = String(unitId || '').trim();
  const mappingName = normalizeMappingName(name);
  const templateIdNum = Number(templateId);
  const actor = String(actorEmail || '').trim() || null;
  const mappingObj = asPlainObject(columnMapping);

  if (!companyId || !unit) {
    return { ok: false, statusCode: 400, message: 'company_identifier and unit_id are required' };
  }
  if (!mappingName) {
    return { ok: false, statusCode: 400, message: 'Mapping name is required' };
  }
  if (!Number.isInteger(templateIdNum) || templateIdNum <= 0) {
    return { ok: false, statusCode: 400, message: 'template_id is required' };
  }
  if (!mappingObj || Object.keys(mappingObj).length === 0) {
    return { ok: false, statusCode: 400, message: 'column_mapping is required' };
  }

  const templateResult = await client.query(
    `
      SELECT id, template_name, version, unit_id, company_identifier
      FROM racm_templates
      WHERE id = $1
        AND company_identifier = $2
        AND unit_id = $3
      LIMIT 1
    `,
    [templateIdNum, companyId, unit]
  );
  if (templateResult.rows.length === 0) {
    return { ok: false, statusCode: 400, message: 'Template not found for this unit' };
  }

  const existingResult = await client.query(
    `
      SELECT id
      FROM racm_excel_column_mappings
      WHERE company_identifier = $1
        AND unit_id = $2
        AND LOWER(TRIM(name)) = LOWER(TRIM($3))
      LIMIT 1
    `,
    [companyId, unit, mappingName]
  );

  if (existingResult.rows.length > 0 && !overwrite) {
    return {
      ok: false,
      statusCode: 409,
      code: 'NAME_EXISTS',
      message: 'A mapping with this name already exists for this unit. Confirm overwrite to replace it.',
      existing_id: existingResult.rows[0].id,
    };
  }

  const assertionObj = asPlainObject(assertionYesNoMapping);
  const frequencyObj = asPlainObject(controlFrequencyValueMapping);
  const headersJson = Array.isArray(excelHeaders)
    ? JSON.stringify(excelHeaders.map((h) => String(h)))
    : null;

  let row;
  if (existingResult.rows.length > 0) {
    const updateResult = await client.query(
      `
        UPDATE racm_excel_column_mappings
        SET
          name = $1,
          template_id = $2,
          column_mapping = $3::jsonb,
          assertion_yes_no_mapping = $4::jsonb,
          control_frequency_value_mapping = $5::jsonb,
          excel_headers = $6::jsonb,
          updated_by = $7,
          updated_at = CURRENT_TIMESTAMP AT TIME ZONE 'UTC',
          last_used_at = CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
        WHERE id = $8
        RETURNING
          id,
          company_identifier,
          unit_id,
          name,
          template_id,
          column_mapping,
          assertion_yes_no_mapping,
          control_frequency_value_mapping,
          excel_headers,
          created_by,
          updated_by,
          ${MAPPING_TIMESTAMP_RETURNING}
      `,
      [
        mappingName,
        templateIdNum,
        JSON.stringify(mappingObj),
        assertionObj ? JSON.stringify(assertionObj) : null,
        frequencyObj ? JSON.stringify(frequencyObj) : null,
        headersJson,
        actor,
        existingResult.rows[0].id,
      ]
    );
    row = updateResult.rows[0];
  } else {
    const insertResult = await client.query(
      `
        INSERT INTO racm_excel_column_mappings (
          company_identifier,
          unit_id,
          name,
          template_id,
          column_mapping,
          assertion_yes_no_mapping,
          control_frequency_value_mapping,
          excel_headers,
          created_by,
          updated_by,
          last_used_at
        )
        VALUES (
          $1, $2, $3, $4,
          $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb,
          $9, $9,
          CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
        )
        RETURNING
          id,
          company_identifier,
          unit_id,
          name,
          template_id,
          column_mapping,
          assertion_yes_no_mapping,
          control_frequency_value_mapping,
          excel_headers,
          created_by,
          updated_by,
          ${MAPPING_TIMESTAMP_RETURNING}
      `,
      [
        companyId,
        unit,
        mappingName,
        templateIdNum,
        JSON.stringify(mappingObj),
        assertionObj ? JSON.stringify(assertionObj) : null,
        frequencyObj ? JSON.stringify(frequencyObj) : null,
        headersJson,
        actor,
      ]
    );
    row = insertResult.rows[0];
  }

  const template = templateResult.rows[0];
  return {
    ok: true,
    overwritten: existingResult.rows.length > 0,
    mapping: mapMappingRow({
      ...row,
      template_name: template.template_name,
      template_version: template.version,
    }),
  };
}

async function touchExcelColumnMappingLastUsed(client, {
  companyIdentifier,
  unitId,
  mappingId,
}) {
  const id = Number(mappingId);
  if (!Number.isInteger(id) || id <= 0) return;
  await client.query(
    `
      UPDATE racm_excel_column_mappings
      SET last_used_at = CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
      WHERE id = $1
        AND company_identifier = $2
        AND unit_id = $3
    `,
    [id, String(companyIdentifier || '').trim(), String(unitId || '').trim()]
  );
}

module.exports = {
  listExcelColumnMappingsForActiveTemplate,
  upsertExcelColumnMapping,
  touchExcelColumnMappingLastUsed,
  normalizeMappingName,
};
