const { pool } = require('../../utils/db');
const {
  RACM_SECTION_LABELS,
  RACM_ASSERTION_CATALOG,
  ensureActiveTemplateForUnit,
  getActiveTemplateWithFields,
  getTemplateWithFieldsById,
  structuralSaveTemplate,
  createFreshTemplate,
  updateActiveTemplateKeywords,
  copyTemplateFromUnit,
  listCompanyTemplatesForImport,
  importTemplateToUnit,
  listTemplateVersions,
  deleteTemplateVersion,
  activateTemplateVersion,
  isRacmTemplateSchemaReady,
} = require('../../utils/racm_templates');

async function verifyCoordinatorUnitAccess(client, companyIdentifier, unitId, coordinatorEmail) {
  const result = await client.query(
    `
      SELECT 1
      FROM coordinator_unit_assignments
      WHERE company_identifier = $1
        AND unit_id = $2
        AND LOWER(TRIM(coordinator_email_id)) = LOWER(TRIM($3))
      LIMIT 1
    `,
    [companyIdentifier, unitId, coordinatorEmail]
  );
  return result.rows.length > 0;
}

async function getActiveRacmTemplate(req, res) {
  const client = await pool.connect();
  try {
    const companyIdentifier = req.user.company_identifier;
    const unitId = String(req.query.unit_id || '').trim();

    if (!companyIdentifier) {
      return res.status(400).json({ success: false, message: 'Company identifier is required' });
    }
    if (!unitId) {
      return res.status(400).json({ success: false, message: 'unit_id is required' });
    }

    if (!(await isRacmTemplateSchemaReady(client))) {
      return res.status(503).json({
        success: false,
        message: 'RACM template tables are not installed yet. Run backend/sql/racm_templates_manual.sql',
      });
    }

    const hasAccess = await verifyCoordinatorUnitAccess(
      client,
      companyIdentifier,
      unitId,
      req.user.email_id
    );
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'You do not have access to this unit' });
    }

    const payload = await getActiveTemplateWithFields(client, companyIdentifier, unitId);
    if (!payload.ok) {
      return res.status(400).json({ success: false, message: payload.message });
    }

    return res.status(200).json({
      success: true,
      data: {
        template: payload.template,
        fields: payload.fields,
        fixed_fields: payload.fixed_fields,
        extra_fields: payload.extra_fields,
        section_labels: RACM_SECTION_LABELS,
        assertion_catalog: RACM_ASSERTION_CATALOG,
      },
    });
  } catch (error) {
    console.error('getActiveRacmTemplate error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load RACM template' });
  } finally {
    client.release();
  }
}

async function listRacmTemplateVersions(req, res) {
  const client = await pool.connect();
  try {
    const companyIdentifier = req.user.company_identifier;
    const unitId = String(req.query.unit_id || '').trim();

    if (!companyIdentifier || !unitId) {
      return res.status(400).json({ success: false, message: 'unit_id is required' });
    }

    if (!(await isRacmTemplateSchemaReady(client))) {
      return res.status(503).json({
        success: false,
        message: 'RACM template tables are not installed yet. Run backend/sql/racm_templates_manual.sql',
      });
    }

    const hasAccess = await verifyCoordinatorUnitAccess(
      client,
      companyIdentifier,
      unitId,
      req.user.email_id
    );
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'You do not have access to this unit' });
    }

    const versions = await listTemplateVersions(client, companyIdentifier, unitId);
    return res.status(200).json({ success: true, data: { versions } });
  } catch (error) {
    console.error('listRacmTemplateVersions error:', error);
    return res.status(500).json({ success: false, message: 'Failed to list template versions' });
  } finally {
    client.release();
  }
}

async function getRacmTemplateById(req, res) {
  const client = await pool.connect();
  try {
    const companyIdentifier = req.user.company_identifier;
    const templateId = Number.parseInt(String(req.params.template_id || ''), 10);

    if (!companyIdentifier || !Number.isFinite(templateId)) {
      return res.status(400).json({ success: false, message: 'template_id is required' });
    }

    if (!(await isRacmTemplateSchemaReady(client))) {
      return res.status(503).json({
        success: false,
        message: 'RACM template tables are not installed yet. Run backend/sql/racm_templates_manual.sql',
      });
    }

    const templatePayload = await getTemplateWithFieldsById(client, templateId);
    if (!templatePayload.ok || templatePayload.template.company_identifier !== companyIdentifier) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    const hasAccess = await verifyCoordinatorUnitAccess(
      client,
      companyIdentifier,
      templatePayload.template.unit_id,
      req.user.email_id
    );
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'You do not have access to this unit' });
    }

    return res.status(200).json({
      success: true,
      data: {
        template: templatePayload.template,
        fields: templatePayload.fields,
        fixed_fields: templatePayload.fixed_fields,
        extra_fields: templatePayload.extra_fields,
        section_labels: RACM_SECTION_LABELS,
        assertion_catalog: RACM_ASSERTION_CATALOG,
      },
    });
  } catch (error) {
    console.error('getRacmTemplateById error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load template details' });
  } finally {
    client.release();
  }
}

async function saveRacmTemplateStructure(req, res) {
  const client = await pool.connect();
  try {
    const companyIdentifier = req.user.company_identifier;
    const unitId = String(req.body?.unit_id || '').trim();
    const saveMode = String(req.body?.save_mode || 'update_version').trim();
    const templateName = String(req.body?.template_name || '').trim();
    const extraFields = req.body?.extra_fields;

    if (!companyIdentifier || !unitId) {
      return res.status(400).json({ success: false, message: 'unit_id is required' });
    }

    if (!(await isRacmTemplateSchemaReady(client))) {
      return res.status(503).json({
        success: false,
        message: 'RACM template tables are not installed yet. Run backend/sql/racm_templates_manual.sql',
      });
    }

    const hasAccess = await verifyCoordinatorUnitAccess(
      client,
      companyIdentifier,
      unitId,
      req.user.email_id
    );
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'You do not have access to this unit' });
    }

    await client.query('BEGIN');
    const result = await structuralSaveTemplate(client, {
      companyIdentifier,
      unitId,
      createdBy: req.user.email_id,
      saveMode,
      templateName,
      extraFields: Array.isArray(extraFields) ? extraFields : [],
    });

    if (!result.ok) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: result.message });
    }

    await client.query('COMMIT');
    return res.status(200).json({
      success: true,
      message: result.updated_in_place
        ? 'Template updated successfully.'
        : 'Template saved as a new version. Existing RACMs are unchanged.',
      data: {
        template: result.template,
        fields: result.fields,
        previous_template_id: result.previous_template_id,
        updated_in_place: Boolean(result.updated_in_place),
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('saveRacmTemplateStructure error:', error);
    return res.status(500).json({ success: false, message: 'Failed to save template structure' });
  } finally {
    client.release();
  }
}

async function createFreshRacmTemplate(req, res) {
  const client = await pool.connect();
  try {
    const companyIdentifier = req.user.company_identifier;
    const unitId = String(req.body?.unit_id || '').trim();
    const templateName = String(req.body?.template_name || '').trim();

    if (!companyIdentifier || !unitId) {
      return res.status(400).json({ success: false, message: 'unit_id is required' });
    }
    if (!templateName) {
      return res.status(400).json({ success: false, message: 'template_name is required' });
    }

    if (!(await isRacmTemplateSchemaReady(client))) {
      return res.status(503).json({
        success: false,
        message: 'RACM template tables are not installed yet. Run backend/sql/racm_templates_manual.sql',
      });
    }

    const hasAccess = await verifyCoordinatorUnitAccess(
      client,
      companyIdentifier,
      unitId,
      req.user.email_id
    );
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'You do not have access to this unit' });
    }

    await client.query('BEGIN');
    const result = await createFreshTemplate(client, {
      companyIdentifier,
      unitId,
      templateName,
      createdBy: req.user.email_id,
    });

    if (!result.ok) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: result.message });
    }

    await client.query('COMMIT');
    return res.status(201).json({
      success: true,
      message: 'Template created and set as active. You can start editing it now.',
      data: {
        template: result.template,
        fields: result.fields,
        fixed_fields: result.fields.filter((field) => field.is_fixed),
        extra_fields: result.fields.filter((field) => !field.is_fixed),
        section_labels: RACM_SECTION_LABELS,
        assertion_catalog: RACM_ASSERTION_CATALOG,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('createFreshRacmTemplate error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create template' });
  } finally {
    client.release();
  }
}

async function patchRacmTemplateKeywords(req, res) {
  const client = await pool.connect();
  try {
    const companyIdentifier = req.user.company_identifier;
    const unitId = String(req.body?.unit_id || '').trim();
    const keywordUpdates = req.body?.keyword_updates;

    if (!companyIdentifier || !unitId) {
      return res.status(400).json({ success: false, message: 'unit_id is required' });
    }

    if (!(await isRacmTemplateSchemaReady(client))) {
      return res.status(503).json({
        success: false,
        message: 'RACM template tables are not installed yet. Run backend/sql/racm_templates_manual.sql',
      });
    }

    const hasAccess = await verifyCoordinatorUnitAccess(
      client,
      companyIdentifier,
      unitId,
      req.user.email_id
    );
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'You do not have access to this unit' });
    }

    await client.query('BEGIN');
    const result = await updateActiveTemplateKeywords(client, {
      companyIdentifier,
      unitId,
      keywordUpdates,
    });

    if (!result.ok) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: result.message });
    }

    await client.query('COMMIT');
    return res.status(200).json({
      success: true,
      message: 'Keywords updated',
      data: {
        updated_field_keys: result.updated_field_keys,
        fields: result.fields,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('patchRacmTemplateKeywords error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update keywords' });
  } finally {
    client.release();
  }
}

async function listRacmTemplatesImportCatalog(req, res) {
  const client = await pool.connect();
  try {
    const companyIdentifier = req.user.company_identifier;

    if (!companyIdentifier) {
      return res.status(400).json({ success: false, message: 'Company identifier is required' });
    }

    if (!(await isRacmTemplateSchemaReady(client))) {
      return res.status(503).json({
        success: false,
        message: 'RACM template tables are not installed yet. Run backend/sql/racm_templates_manual.sql',
      });
    }

    const units = await listCompanyTemplatesForImport(client, companyIdentifier);
    return res.status(200).json({
      success: true,
      data: { units },
    });
  } catch (error) {
    console.error('listRacmTemplatesImportCatalog error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load import catalog' });
  } finally {
    client.release();
  }
}

async function getRacmTemplateImportPreview(req, res) {
  const client = await pool.connect();
  try {
    const companyIdentifier = req.user.company_identifier;
    const templateId = Number.parseInt(String(req.params.template_id || ''), 10);

    if (!companyIdentifier || !Number.isFinite(templateId)) {
      return res.status(400).json({ success: false, message: 'template_id is required' });
    }

    if (!(await isRacmTemplateSchemaReady(client))) {
      return res.status(503).json({
        success: false,
        message: 'RACM template tables are not installed yet. Run backend/sql/racm_templates_manual.sql',
      });
    }

    const templatePayload = await getTemplateWithFieldsById(client, templateId);
    if (!templatePayload.ok || templatePayload.template.company_identifier !== companyIdentifier) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    return res.status(200).json({
      success: true,
      data: {
        template: templatePayload.template,
        fields: templatePayload.fields,
        fixed_fields: templatePayload.fixed_fields,
        extra_fields: templatePayload.extra_fields,
        section_labels: RACM_SECTION_LABELS,
        assertion_catalog: RACM_ASSERTION_CATALOG,
      },
    });
  } catch (error) {
    console.error('getRacmTemplateImportPreview error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load template preview' });
  } finally {
    client.release();
  }
}

async function importRacmTemplate(req, res) {
  const client = await pool.connect();
  try {
    const companyIdentifier = req.user.company_identifier;
    const targetUnitId = String(req.body?.target_unit_id || '').trim();
    const sourceTemplateId = Number.parseInt(String(req.body?.source_template_id || ''), 10);
    const templateName = String(req.body?.template_name || '').trim();

    if (!companyIdentifier || !targetUnitId) {
      return res.status(400).json({ success: false, message: 'target_unit_id is required' });
    }
    if (!Number.isFinite(sourceTemplateId)) {
      return res.status(400).json({ success: false, message: 'source_template_id is required' });
    }
    if (!templateName) {
      return res.status(400).json({ success: false, message: 'template_name is required' });
    }

    if (!(await isRacmTemplateSchemaReady(client))) {
      return res.status(503).json({
        success: false,
        message: 'RACM template tables are not installed yet. Run backend/sql/racm_templates_manual.sql',
      });
    }

    const hasAccess = await verifyCoordinatorUnitAccess(
      client,
      companyIdentifier,
      targetUnitId,
      req.user.email_id
    );
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'You do not have access to the target unit' });
    }

    await client.query('BEGIN');
    const result = await importTemplateToUnit(client, {
      companyIdentifier,
      sourceTemplateId,
      targetUnitId,
      templateName,
      createdBy: req.user.email_id,
    });

    if (!result.ok) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: result.message });
    }

    await client.query('COMMIT');
    return res.status(201).json({
      success: true,
      message: 'Template imported successfully and set as active for this unit.',
      data: {
        template: result.template,
        fields: result.fields,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('importRacmTemplate error:', error);
    return res.status(500).json({ success: false, message: 'Failed to import template' });
  } finally {
    client.release();
  }
}

async function copyRacmTemplate(req, res) {
  const client = await pool.connect();
  try {
    const companyIdentifier = req.user.company_identifier;
    const sourceUnitId = String(req.body?.source_unit_id || '').trim();
    const targetUnitId = String(req.body?.target_unit_id || '').trim();
    const saveMode = String(req.body?.save_mode || 'update_version').trim();
    const templateName = String(req.body?.template_name || '').trim();

    if (!companyIdentifier || !sourceUnitId || !targetUnitId) {
      return res.status(400).json({
        success: false,
        message: 'source_unit_id and target_unit_id are required',
      });
    }

    if (!(await isRacmTemplateSchemaReady(client))) {
      return res.status(503).json({
        success: false,
        message: 'RACM template tables are not installed yet. Run backend/sql/racm_templates_manual.sql',
      });
    }

    const canAccessSource = await verifyCoordinatorUnitAccess(
      client,
      companyIdentifier,
      sourceUnitId,
      req.user.email_id
    );
    const canAccessTarget = await verifyCoordinatorUnitAccess(
      client,
      companyIdentifier,
      targetUnitId,
      req.user.email_id
    );
    if (!canAccessSource || !canAccessTarget) {
      return res.status(403).json({ success: false, message: 'You do not have access to one or both units' });
    }

    await client.query('BEGIN');
    const result = await copyTemplateFromUnit(client, {
      companyIdentifier,
      sourceUnitId,
      targetUnitId,
      createdBy: req.user.email_id,
      saveMode,
      templateName,
    });

    if (!result.ok) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: result.message });
    }

    await client.query('COMMIT');
    return res.status(200).json({
      success: true,
      message: 'Template copied successfully',
      data: {
        template: result.template,
        fields: result.fields,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('copyRacmTemplate error:', error);
    return res.status(500).json({ success: false, message: 'Failed to copy template' });
  } finally {
    client.release();
  }
}

async function activateRacmTemplateVersion(req, res) {
  const client = await pool.connect();
  try {
    const companyIdentifier = req.user.company_identifier;
    const unitId = String(req.body?.unit_id || '').trim();
    const templateId = Number.parseInt(String(req.params.template_id || ''), 10);

    if (!companyIdentifier || !unitId || !Number.isFinite(templateId)) {
      return res.status(400).json({ success: false, message: 'unit_id and template_id are required' });
    }

    if (!(await isRacmTemplateSchemaReady(client))) {
      return res.status(503).json({
        success: false,
        message: 'RACM template tables are not installed yet. Run backend/sql/racm_templates_manual.sql',
      });
    }

    const hasAccess = await verifyCoordinatorUnitAccess(
      client,
      companyIdentifier,
      unitId,
      req.user.email_id
    );
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'You do not have access to this unit' });
    }

    await client.query('BEGIN');
    const result = await activateTemplateVersion(client, companyIdentifier, unitId, templateId);
    if (!result.ok) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: result.message });
    }

    await client.query('COMMIT');
    return res.status(200).json({
      success: true,
      message: result.already_active
        ? 'This template is already active.'
        : 'Template activated successfully.',
      data: {
        template: result.template,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('activateRacmTemplateVersion error:', error);
    return res.status(500).json({ success: false, message: 'Failed to activate template' });
  } finally {
    client.release();
  }
}

async function removeRacmTemplateVersion(req, res) {
  const client = await pool.connect();
  try {
    const companyIdentifier = req.user.company_identifier;
    const templateId = Number.parseInt(String(req.params.template_id || ''), 10);

    if (!companyIdentifier || !Number.isFinite(templateId)) {
      return res.status(400).json({ success: false, message: 'template_id is required' });
    }

    if (!(await isRacmTemplateSchemaReady(client))) {
      return res.status(503).json({
        success: false,
        message: 'RACM template tables are not installed yet. Run backend/sql/racm_templates_manual.sql',
      });
    }

    const templateResult = await client.query(
      `
        SELECT company_identifier, unit_id
        FROM racm_templates
        WHERE id = $1
        LIMIT 1
      `,
      [templateId]
    );
    const template = templateResult.rows[0];
    if (!template || template.company_identifier !== companyIdentifier) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    const hasAccess = await verifyCoordinatorUnitAccess(
      client,
      companyIdentifier,
      template.unit_id,
      req.user.email_id
    );
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'You do not have access to this unit' });
    }

    await client.query('BEGIN');
    const result = await deleteTemplateVersion(client, templateId);
    if (!result.ok) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: result.message });
    }

    await client.query('COMMIT');
    return res.status(200).json({ success: true, message: 'Template version deleted' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('removeRacmTemplateVersion error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete template version' });
  } finally {
    client.release();
  }
}

module.exports = {
  getActiveRacmTemplate,
  getRacmTemplateById,
  listRacmTemplateVersions,
  saveRacmTemplateStructure,
  createFreshRacmTemplate,
  patchRacmTemplateKeywords,
  copyRacmTemplate,
  listRacmTemplatesImportCatalog,
  getRacmTemplateImportPreview,
  importRacmTemplate,
  activateRacmTemplateVersion,
  removeRacmTemplateVersion,
  ensureActiveTemplateForUnit,
};
