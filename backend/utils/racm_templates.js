const { RACM_ASSERTION_CATALOG, RACM_ASSERTION_FIELD_KEYS } = require('./racm_assertion_catalog');

const RACM_TEMPLATE_SECTIONS = {
  PROCESS_AND_RISK: 'process_and_risk',
  ASSERTIONS: 'assertions',
  CONTROL_DETAILS: 'control_details',
  OTHERS: 'others',
};

const RACM_SECTION_LABELS = {
  process_and_risk: 'Process and Risk',
  assertions: 'Assertions',
  control_details: 'Control Details',
  others: 'Others',
};

const RESERVED_EXTRA_FIELD_KEYS = new Set([
  'form_id',
  'company_identifier',
  'unit_id',
  'control_number',
  'business_process',
  'financial_year',
  'control_frequency',
  'sample_size',
  'sample_required',
  'control_performer',
  'control_owner',
  'active',
  'status',
  'template_id',
  'sub_process',
  'risk_description',
  'risk_heat',
  'control_objective',
  'standard_control_description',
  'control_type_ma',
  'control_type_fo',
  'nature_of_control',
  'process_walkthrough',
  'key_control',
  'application_name',
  'audit_evidence_accuracy',
  'whether_fraud_risks_exist',
]);

const DEFAULT_EXCEL_KEYWORDS_BY_FIELD = {
  sub_process: ['sub process', 'sub-process', 'subprocess'],
  risk_description: ['risk description', 'risk desc'],
  risk_heat: ['risk heat', 'heat'],
  control_objective: ['control objective', 'objective'],
  standard_control_description: ['standard control description', 'control description'],
  control_type_ma: ['manual automated', 'type of control manual'],
  control_type_fo: ['financial operational', 'type of control financial'],
  nature_of_control: ['nature of control', 'preventive detective'],
  process_walkthrough: ['process activity', 'walkthrough', 'process walkthrough'],
  key_control: ['key control'],
  application_name: ['application name', 'application'],
  audit_evidence_accuracy: ['control evidence', 'audit evidence'],
  whether_fraud_risks_exist: ['fraud risk', 'whether fraud'],
};

const RACM_FIXED_TEMPLATE_FIELDS = [
  { fieldKey: 'sub_process', label: 'Sub-Process', sectionKey: 'process_and_risk', displayOrder: 1 },
  { fieldKey: 'risk_description', label: 'Risk Description', sectionKey: 'process_and_risk', displayOrder: 2 },
  { fieldKey: 'risk_heat', label: 'Risk Heat', sectionKey: 'process_and_risk', displayOrder: 3 },
  { fieldKey: 'control_objective', label: 'Control Objective', sectionKey: 'control_details', displayOrder: 4 },
  { fieldKey: 'standard_control_description', label: 'Standard Control Description', sectionKey: 'control_details', displayOrder: 5 },
  { fieldKey: 'control_type_ma', label: 'Control type (Manual/Automated)', sectionKey: 'control_details', displayOrder: 6 },
  { fieldKey: 'control_type_fo', label: 'Control type (Financial/Operational)', sectionKey: 'control_details', displayOrder: 7 },
  { fieldKey: 'nature_of_control', label: 'Nature of Control (Preventive/Detective)', sectionKey: 'control_details', displayOrder: 8 },
  { fieldKey: 'process_walkthrough', label: 'Process Activity and Walkthrough details', sectionKey: 'control_details', displayOrder: 9 },
  { fieldKey: 'key_control', label: 'Key Control', sectionKey: 'control_details', displayOrder: 10 },
  { fieldKey: 'application_name', label: 'Application name', sectionKey: 'control_details', displayOrder: 11 },
  { fieldKey: 'audit_evidence_accuracy', label: 'Control Evidence to be obtained', sectionKey: 'control_details', displayOrder: 12 },
  { fieldKey: 'whether_fraud_risks_exist', label: 'Whether fraud risk exists? (Yes/No)', sectionKey: 'control_details', displayOrder: 13 },
];

const MAX_EXTRA_FIELDS = Number.parseInt(process.env.RACM_MAX_EXTRA_FIELDS || '30', 10);

const EXTRA_FIELD_KEY_PATTERN = /^[a-z][a-z0-9_]{2,49}$/;

function getMaxExtraFields() {
  return Number.isFinite(MAX_EXTRA_FIELDS) && MAX_EXTRA_FIELDS > 0 ? MAX_EXTRA_FIELDS : 30;
}

function normalizeKeywords(keywords) {
  if (!Array.isArray(keywords)) return [];
  const seen = new Set();
  const normalized = [];
  for (const item of keywords) {
    const value = String(item || '').replace(/[^a-zA-Z0-9]/g, '').trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(value);
  }
  return normalized;
}

function deriveKeywordsFromLabel(label) {
  return String(label || '')
    .trim()
    .split(/\s+/)
    .map((word) => word.replace(/[^a-zA-Z0-9]/g, ''))
    .filter(Boolean);
}

function normalizeColumnLabelForComparison(label) {
  return String(label || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

const RACM_FIXED_FIELD_LABELS = RACM_FIXED_TEMPLATE_FIELDS.map((field) => field.label);

function resolveExtraFieldKeywords(field) {
  const explicit = normalizeKeywords(field?.excel_keywords);
  if (explicit.length > 0) return explicit;
  return deriveKeywordsFromLabel(field?.label);
}

function mapTemplateRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    company_identifier: row.company_identifier,
    unit_id: row.unit_id,
    template_name: row.template_name,
    version: row.version,
    status: row.status,
    is_default: row.is_default,
    copied_from_template_id: row.copied_from_template_id,
    linked_racm_count: row.linked_racm_count,
    created_by: row.created_by,
    created_at: row.created_at,
  };
}

function mapTemplateFieldRow(row) {
  if (!row) return null;
  let excelKeywords = row.excel_keywords;
  if (typeof excelKeywords === 'string') {
    try {
      excelKeywords = JSON.parse(excelKeywords);
    } catch {
      excelKeywords = [];
    }
  }
  return {
    id: row.id,
    template_id: row.template_id,
    field_key: row.field_key,
    label: row.label,
    section_key: row.section_key,
    section_label: RACM_SECTION_LABELS[row.section_key] || row.section_key,
    is_fixed: row.is_fixed,
    is_locked: row.is_locked,
    display_order: row.display_order,
    excel_keywords: normalizeKeywords(excelKeywords),
  };
}

async function insertFixedTemplateFields(client, templateId, { includeDefaultKeywords = true } = {}) {
  for (const field of RACM_FIXED_TEMPLATE_FIELDS) {
    const keywords = includeDefaultKeywords
      ? normalizeKeywords(DEFAULT_EXCEL_KEYWORDS_BY_FIELD[field.fieldKey] || [])
      : [];
    await client.query(
      `
        INSERT INTO racm_template_fields (
          template_id, field_key, label, section_key,
          is_fixed, is_locked, display_order, excel_keywords
        )
        VALUES ($1, $2, $3, $4, TRUE, TRUE, $5, $6::jsonb)
      `,
      [
        templateId,
        field.fieldKey,
        field.label,
        field.sectionKey,
        field.displayOrder,
        JSON.stringify(keywords),
      ]
    );
  }
}

async function cloneTemplateFields(client, sourceTemplateId, targetTemplateId) {
  const sourceFields = await client.query(
    `
      SELECT field_key, label, section_key, is_fixed, is_locked, display_order, excel_keywords
      FROM racm_template_fields
      WHERE template_id = $1
      ORDER BY display_order ASC, id ASC
    `,
    [sourceTemplateId]
  );

  for (const field of sourceFields.rows) {
    if (field.is_fixed) {
      const fixedDef = RACM_FIXED_TEMPLATE_FIELDS.find((item) => item.fieldKey === field.field_key);
      await client.query(
        `
          INSERT INTO racm_template_fields (
            template_id, field_key, label, section_key,
            is_fixed, is_locked, display_order, excel_keywords
          )
          VALUES ($1, $2, $3, $4, TRUE, TRUE, $5, $6::jsonb)
        `,
        [
          targetTemplateId,
          field.field_key,
          fixedDef?.label || field.label,
          fixedDef?.sectionKey || field.section_key,
          fixedDef?.displayOrder ?? field.display_order,
          JSON.stringify(normalizeKeywords(field.excel_keywords)),
        ]
      );
      continue;
    }

    await client.query(
      `
        INSERT INTO racm_template_fields (
          template_id, field_key, label, section_key,
          is_fixed, is_locked, display_order, excel_keywords
        )
        VALUES ($1, $2, $3, $4, FALSE, FALSE, $5, $6::jsonb)
      `,
      [
        targetTemplateId,
        field.field_key,
        field.label,
        field.section_key,
        field.display_order,
        JSON.stringify(normalizeKeywords(field.excel_keywords)),
      ]
    );
  }
}

async function getActiveTemplateRow(client, companyIdentifier, unitId) {
  const result = await client.query(
    `
      SELECT *
      FROM racm_templates
      WHERE company_identifier = $1
        AND unit_id = $2
        AND status = 'active'
      ORDER BY id DESC
      LIMIT 1
    `,
    [companyIdentifier, unitId]
  );
  return result.rows[0] || null;
}

async function getTemplateFields(client, templateId) {
  const result = await client.query(
    `
      SELECT *
      FROM racm_template_fields
      WHERE template_id = $1
      ORDER BY section_key ASC, display_order ASC, id ASC
    `,
    [templateId]
  );
  return result.rows.map(mapTemplateFieldRow);
}

async function ensureActiveTemplateForUnit(client, {
  companyIdentifier,
  unitId,
  createdBy = null,
}) {
  const companyId = String(companyIdentifier || '').trim();
  const unit = String(unitId || '').trim();
  if (!companyId || !unit) {
    return { ok: false, message: 'Company identifier and unit are required' };
  }

  const existing = await getActiveTemplateRow(client, companyId, unit);
  if (existing) {
    return { ok: true, template: mapTemplateRow(existing), created: false };
  }

  const insertResult = await client.query(
    `
      INSERT INTO racm_templates (
        company_identifier, unit_id, template_name, version,
        status, is_default, created_by
      )
      VALUES ($1, $2, 'Default', 1, 'active', TRUE, $3)
      RETURNING *
    `,
    [companyId, unit, createdBy]
  );
  const template = insertResult.rows[0];
  await insertFixedTemplateFields(client, template.id, { includeDefaultKeywords: true });

  return { ok: true, template: mapTemplateRow(template), created: true };
}

async function getActiveTemplateWithFields(client, companyIdentifier, unitId) {
  const ensured = await ensureActiveTemplateForUnit(client, {
    companyIdentifier,
    unitId,
  });
  if (!ensured.ok) return ensured;

  const fields = await getTemplateFields(client, ensured.template.id);
  const activeRow = await client.query(
    `SELECT * FROM racm_templates WHERE id = $1 LIMIT 1`,
    [ensured.template.id]
  );
  const templateWithCount = await enrichTemplateRowWithLinkedCount(client, activeRow.rows[0]);
  return {
    ok: true,
    template: templateWithCount,
    fields,
    extra_fields: fields.filter((field) => !field.is_fixed),
    fixed_fields: fields.filter((field) => field.is_fixed),
  };
}

async function getTemplateWithFieldsById(client, templateId) {
  const result = await client.query(
    `
      SELECT *
      FROM racm_templates
      WHERE id = $1
      LIMIT 1
    `,
    [templateId]
  );
  const template = result.rows[0];
  if (!template) {
    return { ok: false, message: 'Template not found' };
  }

  const fields = await getTemplateFields(client, template.id);
  const templateWithCount = await enrichTemplateRowWithLinkedCount(client, template);
  return {
    ok: true,
    template: templateWithCount,
    fields,
    extra_fields: fields.filter((field) => !field.is_fixed),
    fixed_fields: fields.filter((field) => field.is_fixed),
  };
}

function validateExtraFieldKey(fieldKey) {
  const key = String(fieldKey || '').trim().toLowerCase();
  if (!EXTRA_FIELD_KEY_PATTERN.test(key)) {
    return {
      ok: false,
      message: 'Field key must be 3–50 characters, start with a letter, and use lowercase letters, numbers, or underscores',
    };
  }
  if (RESERVED_EXTRA_FIELD_KEYS.has(key)) {
    return { ok: false, message: `Field key "${key}" is reserved` };
  }
  return { ok: true, fieldKey: key };
}

function validateExtraFieldDefinition(field, { existingKeys = new Set(), existingLabels = new Set() } = {}) {
  const keyValidation = validateExtraFieldKey(field?.field_key);
  if (!keyValidation.ok) return keyValidation;

  const label = String(field?.label || '').trim();
  if (!label) {
    return { ok: false, message: 'Field label is required' };
  }

  const labelKey = normalizeColumnLabelForComparison(label);
  if (!labelKey) {
    return { ok: false, message: 'Field label is required' };
  }

  for (const reservedLabel of RACM_FIXED_FIELD_LABELS) {
    if (normalizeColumnLabelForComparison(reservedLabel) === labelKey) {
      return {
        ok: false,
        message: `Label "${label}" conflicts with the fixed column "${reservedLabel}"`,
      };
    }
  }

  if (existingLabels.has(labelKey)) {
    return {
      ok: false,
      message: `A column with a similar label already exists (${label})`,
    };
  }

  const sectionKey = String(field?.section_key || RACM_TEMPLATE_SECTIONS.OTHERS).trim();
  if (!Object.values(RACM_TEMPLATE_SECTIONS).includes(sectionKey)) {
    return { ok: false, message: 'Invalid section' };
  }

  if (existingKeys.has(keyValidation.fieldKey)) {
    return { ok: false, message: `Duplicate field key "${keyValidation.fieldKey}"` };
  }

  return {
    ok: true,
    field: {
      field_key: keyValidation.fieldKey,
      label,
      section_key: sectionKey,
      display_order: Number.isFinite(Number(field?.display_order))
        ? Number(field.display_order)
        : 0,
      excel_keywords: normalizeKeywords(
        field?.excel_keywords?.length
          ? field.excel_keywords
          : deriveKeywordsFromLabel(label)
      ),
    },
  };
}

function normalizeExtraFieldPayload(extraFields) {
  if (!Array.isArray(extraFields)) {
    return { ok: false, message: 'extra_fields must be an array' };
  }

  if (extraFields.length > getMaxExtraFields()) {
    return {
      ok: false,
      message: `A maximum of ${getMaxExtraFields()} extra fields is allowed per unit template`,
    };
  }

  const normalized = [];
  const seenKeys = new Set();
  const seenLabels = new Set();
  for (const field of extraFields) {
    const validation = validateExtraFieldDefinition(field, {
      existingKeys: seenKeys,
      existingLabels: seenLabels,
    });
    if (!validation.ok) return validation;
    seenKeys.add(validation.field.field_key);
    seenLabels.add(normalizeColumnLabelForComparison(validation.field.label));
    normalized.push(validation.field);
  }

  return { ok: true, extraFields: normalized };
}

function buildStructuralSignature(extraFields) {
  return JSON.stringify(
    extraFields.map((field) => ({
      field_key: field.field_key,
      label: field.label,
      section_key: field.section_key,
      display_order: field.display_order,
    }))
  );
}

async function createTemplateVersion(client, {
  companyIdentifier,
  unitId,
  templateName,
  version,
  status = 'active',
  isDefault = false,
  copiedFromTemplateId = null,
  createdBy = null,
  extraFields = [],
  sourceTemplateId = null,
}) {
  const insertResult = await client.query(
    `
      INSERT INTO racm_templates (
        company_identifier, unit_id, template_name, version, status,
        is_default, copied_from_template_id, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `,
    [
      companyIdentifier,
      unitId,
      templateName,
      version,
      status,
      isDefault,
      copiedFromTemplateId,
      createdBy,
    ]
  );
  const template = insertResult.rows[0];

  if (sourceTemplateId) {
    await cloneTemplateFields(client, sourceTemplateId, template.id);
    const currentExtras = (await getTemplateFields(client, template.id)).filter((field) => !field.is_fixed);
    for (const existing of currentExtras) {
      await client.query(`DELETE FROM racm_template_fields WHERE id = $1`, [existing.id]);
    }
  } else {
    await insertFixedTemplateFields(client, template.id, { includeDefaultKeywords: true });
  }

  let order = 1;
  for (const field of extraFields) {
    await client.query(
      `
        INSERT INTO racm_template_fields (
          template_id, field_key, label, section_key,
          is_fixed, is_locked, display_order, excel_keywords
        )
        VALUES ($1, $2, $3, $4, FALSE, FALSE, $5, $6::jsonb)
      `,
      [
        template.id,
        field.field_key,
        field.label,
        field.section_key,
        field.display_order || order,
        JSON.stringify(field.excel_keywords || []),
      ]
    );
    order += 1;
  }

  return mapTemplateRow(template);
}

async function archiveActiveTemplatesForUnit(client, companyIdentifier, unitId) {
  await client.query(
    `
      UPDATE racm_templates
      SET status = 'archived'
      WHERE company_identifier = $1
        AND unit_id = $2
        AND status = 'active'
    `,
    [companyIdentifier, unitId]
  );
}

async function getNextVersionForTemplateName(client, companyIdentifier, unitId, templateName) {
  const result = await client.query(
    `
      SELECT COALESCE(MAX(version), 0) AS max_version
      FROM racm_templates
      WHERE company_identifier = $1
        AND unit_id = $2
        AND template_name = $3
    `,
    [companyIdentifier, unitId, templateName]
  );
  return Number(result.rows[0]?.max_version || 0) + 1;
}

async function syncTemplateExtraFields(client, templateId, extraFields, {
  allowRemove = true,
  allowAdd = true,
  allowLabelChange = true,
} = {}) {
  const currentResult = await client.query(
    `
      SELECT id, field_key, label
      FROM racm_template_fields
      WHERE template_id = $1
        AND is_fixed = FALSE
    `,
    [templateId]
  );
  const remainingByKey = new Map(currentResult.rows.map((row) => [row.field_key, row]));

  let order = 1;
  for (const field of extraFields) {
    const existing = remainingByKey.get(field.field_key);
    if (existing) {
      const currentLabel = String(existing.label || '').trim();
      const nextLabel = String(field.label || '').trim();
      if (!allowLabelChange && currentLabel !== nextLabel) {
        return {
          ok: false,
          message: 'Cannot rename custom columns while RACMs are linked to this template. Create a new version instead.',
        };
      }
      await client.query(
        `
          UPDATE racm_template_fields
          SET label = $2,
              section_key = $3,
              display_order = $4,
              excel_keywords = $5::jsonb
          WHERE id = $1
        `,
        [
          existing.id,
          field.label,
          field.section_key,
          field.display_order || order,
          JSON.stringify(field.excel_keywords || []),
        ]
      );
      remainingByKey.delete(field.field_key);
    } else if (!allowAdd) {
      return {
        ok: false,
        message: 'Cannot add custom columns in place while RACMs are linked. Create a new version instead.',
      };
    } else {
      await client.query(
        `
          INSERT INTO racm_template_fields (
            template_id, field_key, label, section_key,
            is_fixed, is_locked, display_order, excel_keywords
          )
          VALUES ($1, $2, $3, $4, FALSE, FALSE, $5, $6::jsonb)
        `,
        [
          templateId,
          field.field_key,
          field.label,
          field.section_key,
          field.display_order || order,
          JSON.stringify(field.excel_keywords || []),
        ]
      );
    }
    order += 1;
  }

  if (remainingByKey.size > 0) {
    if (!allowRemove) {
      return {
        ok: false,
        message: 'Cannot remove custom columns while RACMs are linked to this template.',
      };
    }
    for (const row of remainingByKey.values()) {
      await client.query(`DELETE FROM racm_template_fields WHERE id = $1`, [row.id]);
    }
  }

  return { ok: true };
}

function classifyExtraFieldChanges(currentExtras, mergedExtraFields) {
  const currentKeys = new Set(currentExtras.map((field) => field.field_key));
  const nextKeys = new Set(mergedExtraFields.map((field) => field.field_key));
  const hasRemovals = [...currentKeys].some((key) => !nextKeys.has(key));
  const hasAdditions = [...nextKeys].some((key) => !currentKeys.has(key));
  const currentByKey = new Map(currentExtras.map((field) => [field.field_key, field]));
  const hasLabelChanges = mergedExtraFields.some((field) => {
    const existing = currentByKey.get(field.field_key);
    if (!existing) return false;
    return String(existing.label || '').trim() !== String(field.label || '').trim();
  });
  return { hasRemovals, hasAdditions, hasLabelChanges };
}

async function replaceTemplateExtraFields(client, templateId, extraFields) {
  const syncResult = await syncTemplateExtraFields(client, templateId, extraFields, {
    allowRemove: true,
    allowAdd: true,
  });
  if (!syncResult.ok) {
    throw new Error(syncResult.message || 'Failed to sync template extra fields');
  }
}

async function updateActiveTemplateExtrasInPlace(client, activeTemplate, extraFields, options = {}) {
  const syncResult = await syncTemplateExtraFields(client, activeTemplate.id, extraFields, options);
  if (!syncResult.ok) return syncResult;

  const templateResult = await client.query(
    `
      SELECT *
      FROM racm_templates
      WHERE id = $1
      LIMIT 1
    `,
    [activeTemplate.id]
  );

  return {
    ok: true,
    template: mapTemplateRow(templateResult.rows[0]),
    fields: await getTemplateFields(client, activeTemplate.id),
    previous_template_id: activeTemplate.id,
    updated_in_place: true,
  };
}

async function structuralSaveTemplate(client, {
  companyIdentifier,
  unitId,
  createdBy,
  saveMode,
  templateName,
  extraFields,
}) {
  const normalizedExtras = normalizeExtraFieldPayload(extraFields);
  if (!normalizedExtras.ok) return normalizedExtras;

  const active = await getActiveTemplateRow(client, companyIdentifier, unitId);
  if (!active) {
    return { ok: false, message: 'Active template not found for unit' };
  }

  const currentFields = await getTemplateFields(client, active.id);
  const currentExtras = currentFields
    .filter((field) => !field.is_fixed)
    .map((field) => ({
      field_key: field.field_key,
      label: field.label,
      section_key: field.section_key,
      display_order: field.display_order,
      excel_keywords: field.excel_keywords,
    }));

  const mergedExtraFields = normalizedExtras.extraFields.map((field) => {
    const existing = currentExtras.find((item) => item.field_key === field.field_key);
    const keywords = field.excel_keywords?.length
      ? field.excel_keywords
      : existing?.excel_keywords?.length
        ? existing.excel_keywords
        : deriveKeywordsFromLabel(field.label);
    return {
      ...field,
      excel_keywords: normalizeKeywords(keywords),
    };
  });

  const nextSignature = buildStructuralSignature(
    mergedExtraFields.map((field) => ({
      field_key: field.field_key,
      label: field.label,
      section_key: field.section_key,
      display_order: field.display_order,
    }))
  );
  const currentSignature = buildStructuralSignature(
    currentExtras.map((field) => ({
      field_key: field.field_key,
      label: field.label,
      section_key: field.section_key,
      display_order: field.display_order,
    }))
  );
  if (nextSignature === currentSignature) {
    return { ok: false, message: 'No structural template changes to save' };
  }

  const linkedRacmCount = await getActualLinkedRacmCount(client, active.id);
  const mode = String(saveMode || 'update_version').trim();

  if (mode === 'update_in_place') {
    const changeKind = classifyExtraFieldChanges(currentExtras, mergedExtraFields);
    if (linkedRacmCount > 0) {
      if (changeKind.hasRemovals) {
        return {
          ok: false,
          message: 'Cannot remove custom columns while RACMs are linked to this template.',
        };
      }
      if (changeKind.hasAdditions) {
        return {
          ok: false,
          message: 'Cannot add custom columns in place while RACMs are linked. Create a new version instead.',
        };
      }
      if (changeKind.hasLabelChanges) {
        return {
          ok: false,
          message: 'Cannot rename custom columns while RACMs are linked to this template. Create a new version instead.',
        };
      }
      return updateActiveTemplateExtrasInPlace(client, active, mergedExtraFields, {
        allowRemove: false,
        allowAdd: false,
        allowLabelChange: false,
      });
    }
    return updateActiveTemplateExtrasInPlace(client, active, mergedExtraFields);
  }

  let targetTemplateName = String(templateName || active.template_name).trim();
  if (!targetTemplateName) {
    return { ok: false, message: 'Template name is required' };
  }

  if (mode === 'save_as_new_template' && targetTemplateName.toLowerCase() === String(active.template_name).toLowerCase()) {
    return { ok: false, message: 'Provide a new template name when saving as a new template' };
  }

  if (mode === 'update_version') {
    targetTemplateName = active.template_name;
  }

  const nextVersion = await getNextVersionForTemplateName(
    client,
    companyIdentifier,
    unitId,
    targetTemplateName
  );

  await archiveActiveTemplatesForUnit(client, companyIdentifier, unitId);

  const newTemplate = await createTemplateVersion(client, {
    companyIdentifier,
    unitId,
    templateName: targetTemplateName,
    version: nextVersion,
    status: 'active',
    isDefault: active.is_default,
    copiedFromTemplateId: null,
    createdBy,
    extraFields: mergedExtraFields,
    sourceTemplateId: active.id,
  });

  return {
    ok: true,
    template: newTemplate,
    fields: await getTemplateFields(client, newTemplate.id),
    previous_template_id: active.id,
  };
}

async function createFreshTemplate(client, {
  companyIdentifier,
  unitId,
  templateName,
  createdBy,
}) {
  const name = String(templateName || '').trim();
  if (!name) {
    return { ok: false, message: 'Template name is required' };
  }

  await ensureActiveTemplateForUnit(client, {
    companyIdentifier,
    unitId,
    createdBy,
  });

  const nextVersion = await getNextVersionForTemplateName(
    client,
    companyIdentifier,
    unitId,
    name
  );

  const newTemplate = await createTemplateVersion(client, {
    companyIdentifier,
    unitId,
    templateName: name,
    version: nextVersion,
    status: 'archived',
    isDefault: false,
    copiedFromTemplateId: null,
    createdBy,
    extraFields: [],
  });

  const rowResult = await client.query(
    `SELECT * FROM racm_templates WHERE id = $1 LIMIT 1`,
    [newTemplate.id]
  );
  const template = await enrichTemplateRowWithLinkedCount(client, rowResult.rows[0]);

  return {
    ok: true,
    template,
    fields: await getTemplateFields(client, newTemplate.id),
  };
}

async function updateActiveTemplateKeywords(client, {
  companyIdentifier,
  unitId,
  keywordUpdates,
}) {
  if (!keywordUpdates || typeof keywordUpdates !== 'object') {
    return { ok: false, message: 'keyword_updates object is required' };
  }

  const active = await getActiveTemplateRow(client, companyIdentifier, unitId);
  if (!active) {
    return { ok: false, message: 'Active template not found for unit' };
  }

  const fields = await getTemplateFields(client, active.id);
  const fieldByKey = new Map(fields.map((field) => [field.field_key, field]));
  const updatedKeys = [];

  for (const [fieldKey, keywords] of Object.entries(keywordUpdates)) {
    const key = String(fieldKey || '').trim();
    const field = fieldByKey.get(key);
    if (!field) {
      return { ok: false, message: `Unknown field key "${key}"` };
    }
    const normalized = normalizeKeywords(keywords);
    await client.query(
      `
        UPDATE racm_template_fields
        SET excel_keywords = $2::jsonb
        WHERE id = $1
      `,
      [field.id, JSON.stringify(normalized)]
    );
    updatedKeys.push(key);
  }

  return {
    ok: true,
    updated_field_keys: updatedKeys,
    fields: await getTemplateFields(client, active.id),
  };
}

async function copyTemplateFromUnit(client, {
  companyIdentifier,
  sourceUnitId,
  targetUnitId,
  createdBy,
  saveMode,
  templateName,
}) {
  const source = await getActiveTemplateRow(client, companyIdentifier, sourceUnitId);
  if (!source) {
    return { ok: false, message: 'Source unit does not have an active template' };
  }

  const sourceFields = await getTemplateFields(client, source.id);
  const extraFields = sourceFields
    .filter((field) => !field.is_fixed)
    .map((field) => ({
      field_key: field.field_key,
      label: field.label,
      section_key: field.section_key,
      display_order: field.display_order,
      excel_keywords: field.excel_keywords,
    }));

  const targetActive = await getActiveTemplateRow(client, companyIdentifier, targetUnitId);
  if (!targetActive) {
    await ensureActiveTemplateForUnit(client, {
      companyIdentifier,
      unitId: targetUnitId,
      createdBy,
    });
  }

  const mode = String(saveMode || 'update_version').trim();
  let targetTemplateName = String(templateName || '').trim();
  const activeTarget = await getActiveTemplateRow(client, companyIdentifier, targetUnitId);

  if (mode === 'save_as_new_template') {
    if (!targetTemplateName) {
      targetTemplateName = `Copy from ${sourceUnitId}`;
    }
  } else {
    targetTemplateName = activeTarget.template_name;
  }

  await archiveActiveTemplatesForUnit(client, companyIdentifier, targetUnitId);
  const nextVersion = await getNextVersionForTemplateName(
    client,
    companyIdentifier,
    targetUnitId,
    targetTemplateName
  );

  const newTemplate = await createTemplateVersion(client, {
    companyIdentifier,
    unitId: targetUnitId,
    templateName: targetTemplateName,
    version: nextVersion,
    status: 'active',
    isDefault: activeTarget?.is_default ?? false,
    copiedFromTemplateId: source.id,
    createdBy,
    extraFields,
    sourceTemplateId: source.id,
  });

  return {
    ok: true,
    template: newTemplate,
    fields: await getTemplateFields(client, newTemplate.id),
  };
}

async function getActualLinkedRacmCount(client, templateId) {
  const result = await client.query(
    `
      SELECT COUNT(*)::int AS count
      FROM control_forms
      WHERE template_id = $1
    `,
    [templateId]
  );
  return Number(result.rows[0]?.count || 0);
}

async function enrichTemplateRowWithLinkedCount(client, row) {
  if (!row) return null;
  const mapped = mapTemplateRow(row);
  mapped.linked_racm_count = await getActualLinkedRacmCount(client, row.id);
  return mapped;
}

async function listTemplateVersions(client, companyIdentifier, unitId) {
  const result = await client.query(
    `
      SELECT
        rt.*,
        COALESCE(cf_counts.linked_racm_count, 0) AS linked_racm_count
      FROM racm_templates rt
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS linked_racm_count
        FROM control_forms cf
        WHERE cf.template_id = rt.id
      ) cf_counts ON TRUE
      WHERE rt.company_identifier = $1
        AND rt.unit_id = $2
      ORDER BY rt.template_name ASC, rt.version DESC, rt.id DESC
    `,
    [companyIdentifier, unitId]
  );
  return result.rows.map(mapTemplateRow);
}

async function deleteTemplateVersion(client, templateId) {
  const templateResult = await client.query(
    `
      SELECT *
      FROM racm_templates
      WHERE id = $1
      LIMIT 1
    `,
    [templateId]
  );
  const template = templateResult.rows[0];
  if (!template) {
    return { ok: false, message: 'Template not found' };
  }

  const linkedRacmCount = await getActualLinkedRacmCount(client, templateId);
  if (linkedRacmCount > 0) {
    return {
      ok: false,
      message: `This template version is used by ${linkedRacmCount} RACM(s) and cannot be deleted`,
    };
  }

  const remainingResult = await client.query(
    `
      SELECT COUNT(*)::int AS count
      FROM racm_templates
      WHERE company_identifier = $1
        AND unit_id = $2
    `,
    [template.company_identifier, template.unit_id]
  );
  if (Number(remainingResult.rows[0]?.count || 0) <= 1) {
    return { ok: false, message: 'Cannot delete the last remaining template for this unit' };
  }

  if (template.status === 'active') {
    return { ok: false, message: 'Cannot delete the active template version' };
  }

  await client.query(`DELETE FROM racm_templates WHERE id = $1`, [templateId]);
  return { ok: true };
}

function sanitizeDynamicValues(dynamicValues) {
  const output = {};
  if (!dynamicValues || typeof dynamicValues !== 'object') {
    return output;
  }
  for (const [key, value] of Object.entries(dynamicValues)) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (!text) continue;
    output[String(key).trim()] = text;
  }
  return output;
}

function validateDynamicValuesAgainstTemplate(extraFields, dynamicValues) {
  const sanitized = sanitizeDynamicValues(dynamicValues);
  const allowedKeys = new Map(extraFields.map((field) => [field.field_key, field]));

  for (const key of Object.keys(sanitized)) {
    if (!allowedKeys.has(key)) {
      return { ok: false, message: `Unknown extra field "${key}"` };
    }
  }

  return { ok: true, dynamicValues: sanitized };
}

async function saveDynamicFieldValues(client, formId, templateId, dynamicValues) {
  const template = await getTemplateWithFieldsById(client, templateId);
  if (!template.ok) return template;

  const validation = validateDynamicValuesAgainstTemplate(template.extra_fields, dynamicValues);
  if (!validation.ok) return validation;

  const fieldByKey = new Map(template.extra_fields.map((field) => [field.field_key, field]));

  for (const [fieldKey, valueText] of Object.entries(validation.dynamicValues)) {
    const field = fieldByKey.get(fieldKey);
    if (!field) continue;
    await client.query(
      `
        INSERT INTO racm_field_values (form_id, template_field_id, value_text)
        VALUES ($1, $2, $3)
        ON CONFLICT (form_id, template_field_id)
        DO UPDATE SET value_text = EXCLUDED.value_text
      `,
      [formId, field.id, valueText]
    );
  }

  return { ok: true };
}

async function applyApprovedDynamicFieldChanges(client, formId, templateId, fieldChanges) {
  const template = await getTemplateWithFieldsById(client, templateId);
  if (!template.ok) return template;

  const fieldByKey = new Map(template.extra_fields.map((field) => [field.field_key, field]));

  for (const [fieldKey, rawValue] of Object.entries(fieldChanges || {})) {
    const normalizedKey = String(fieldKey || '').trim();
    if (!normalizedKey) continue;

    const field = fieldByKey.get(normalizedKey);
    if (!field) {
      return { ok: false, message: `Unknown extra field "${normalizedKey}"` };
    }

    const valueText = rawValue == null ? '' : String(rawValue).trim();
    if (!valueText) {
      await client.query(
        `
          DELETE FROM racm_field_values
          WHERE form_id = $1
            AND template_field_id = $2
        `,
        [formId, field.id]
      );
      continue;
    }

    await client.query(
      `
        INSERT INTO racm_field_values (form_id, template_field_id, value_text)
        VALUES ($1, $2, $3)
        ON CONFLICT (form_id, template_field_id)
        DO UPDATE SET value_text = EXCLUDED.value_text
      `,
      [formId, field.id, valueText]
    );
  }

  return { ok: true };
}

async function loadDynamicFieldValuesForForm(client, formId) {
  const result = await client.query(
    `
      SELECT
        rtf.field_key,
        rtf.label,
        rtf.section_key,
        rfv.value_text
      FROM racm_field_values rfv
      INNER JOIN racm_template_fields rtf ON rtf.id = rfv.template_field_id
      WHERE rfv.form_id = $1
      ORDER BY rtf.section_key ASC, rtf.display_order ASC, rtf.id ASC
    `,
    [formId]
  );

  const dynamicValues = {};
  const values = result.rows.map((row) => {
    dynamicValues[row.field_key] = row.value_text ?? '';
    return {
      field_key: row.field_key,
      label: row.label,
      section_key: row.section_key,
      value_text: row.value_text ?? '',
    };
  });

  return { dynamic_values: dynamicValues, dynamic_value_rows: values };
}

async function incrementTemplateLinkedRacmCount(client, templateId) {
  await client.query(
    `
      UPDATE racm_templates
      SET linked_racm_count = linked_racm_count + 1
      WHERE id = $1
    `,
    [templateId]
  );
}

async function decrementTemplateLinkedRacmCount(client, templateId) {
  if (!templateId) return;
  await client.query(
    `
      UPDATE racm_templates
      SET linked_racm_count = GREATEST(linked_racm_count - 1, 0)
      WHERE id = $1
    `,
    [templateId]
  );
}

async function activateTemplateVersion(client, companyIdentifier, unitId, templateId) {
  const templateResult = await client.query(
    `
      SELECT *
      FROM racm_templates
      WHERE id = $1
        AND company_identifier = $2
        AND unit_id = $3
      LIMIT 1
    `,
    [templateId, companyIdentifier, unitId]
  );
  const template = templateResult.rows[0];
  if (!template) {
    return { ok: false, message: 'Template not found for this unit' };
  }

  if (template.status === 'active') {
    const enriched = await enrichTemplateRowWithLinkedCount(client, template);
    return { ok: true, template: enriched, already_active: true };
  }

  await archiveActiveTemplatesForUnit(client, companyIdentifier, unitId);
  await client.query(
    `
      UPDATE racm_templates
      SET status = 'active'
      WHERE id = $1
    `,
    [templateId]
  );

  const updatedResult = await client.query(
    `
      SELECT *
      FROM racm_templates
      WHERE id = $1
      LIMIT 1
    `,
    [templateId]
  );
  const enriched = await enrichTemplateRowWithLinkedCount(client, updatedResult.rows[0]);
  return { ok: true, template: enriched };
}

async function seedDefaultTemplatesForAllUnits(client) {
  const unitsResult = await client.query(
    `
      SELECT company_identifier, unit_id
      FROM company_unit_master
      WHERE company_identifier IS NOT NULL
        AND unit_id IS NOT NULL
    `
  );

  let created = 0;
  for (const row of unitsResult.rows) {
    const ensured = await ensureActiveTemplateForUnit(client, {
      companyIdentifier: row.company_identifier,
      unitId: row.unit_id,
      createdBy: 'system',
    });
    if (ensured.created) created += 1;
  }

  return { scanned: unitsResult.rows.length, created };
}

async function isRacmTemplateSchemaReady(client) {
  const result = await client.query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'racm_templates'
    ) AS ready
  `);
  return Boolean(result.rows[0]?.ready);
}

module.exports = {
  RACM_TEMPLATE_SECTIONS,
  RACM_SECTION_LABELS,
  RACM_ASSERTION_CATALOG,
  RACM_ASSERTION_FIELD_KEYS,
  RACM_FIXED_TEMPLATE_FIELDS,
  RESERVED_EXTRA_FIELD_KEYS,
  getMaxExtraFields,
  mapTemplateRow,
  mapTemplateFieldRow,
  ensureActiveTemplateForUnit,
  getActiveTemplateWithFields,
  getTemplateWithFieldsById,
  structuralSaveTemplate,
  createFreshTemplate,
  updateActiveTemplateKeywords,
  copyTemplateFromUnit,
  listTemplateVersions,
  deleteTemplateVersion,
  validateExtraFieldKey,
  normalizeExtraFieldPayload,
  deriveKeywordsFromLabel,
  resolveExtraFieldKeywords,
  validateDynamicValuesAgainstTemplate,
  sanitizeDynamicValues,
  saveDynamicFieldValues,
  applyApprovedDynamicFieldChanges,
  loadDynamicFieldValuesForForm,
  classifyExtraFieldChanges,
  incrementTemplateLinkedRacmCount,
  decrementTemplateLinkedRacmCount,
  getActualLinkedRacmCount,
  activateTemplateVersion,
  seedDefaultTemplatesForAllUnits,
  isRacmTemplateSchemaReady,
};
