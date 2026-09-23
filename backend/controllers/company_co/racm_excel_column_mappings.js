const { pool } = require('../../utils/db');
const {
  listExcelColumnMappingsForActiveTemplate,
  upsertExcelColumnMapping,
  touchExcelColumnMappingLastUsed,
} = require('../../utils/racm_excel_column_mappings');

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
    [companyIdentifier, unitId, String(coordinatorEmail || '').trim().toLowerCase()]
  );
  return result.rows.length > 0;
}

async function listRacmExcelColumnMappings(req, res) {
  const client = await pool.connect();
  try {
    const companyIdentifier = String(req.user?.company_identifier || '').trim();
    const unitId = String(req.query?.unit_id || '').trim();
    const coordinatorEmail = String(req.user?.email_id || '').trim();

    if (!companyIdentifier) {
      return res.status(400).json({ success: false, message: 'Company identifier is required' });
    }
    if (!unitId) {
      return res.status(400).json({ success: false, message: 'unit_id is required' });
    }

    const hasAccess = await verifyCoordinatorUnitAccess(
      client,
      companyIdentifier,
      unitId,
      coordinatorEmail
    );
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'You do not have access to this unit' });
    }

    const result = await listExcelColumnMappingsForActiveTemplate(client, {
      companyIdentifier,
      unitId,
    });
    if (!result.ok) {
      return res.status(400).json({ success: false, message: result.message });
    }

    return res.status(200).json({
      success: true,
      data: {
        active_template: result.active_template,
        mappings: result.mappings,
      },
    });
  } catch (error) {
    console.error('List RACM excel column mappings error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to list saved column mappings',
    });
  } finally {
    client.release();
  }
}

async function upsertRacmExcelColumnMapping(req, res) {
  const client = await pool.connect();
  try {
    const companyIdentifier = String(req.user?.company_identifier || '').trim();
    const coordinatorEmail = String(req.user?.email_id || '').trim();
    const unitId = String(req.body?.unit_id || '').trim();
    const name = req.body?.name;
    const templateId = req.body?.template_id;
    const columnMapping = req.body?.column_mapping;
    const assertionYesNoMapping = req.body?.assertion_yes_no_mapping ?? null;
    const controlFrequencyValueMapping = req.body?.control_frequency_value_mapping ?? null;
    const excelHeaders = req.body?.excel_headers ?? null;
    const overwrite = Boolean(req.body?.overwrite);

    if (!companyIdentifier) {
      return res.status(400).json({ success: false, message: 'Company identifier is required' });
    }
    if (!unitId) {
      return res.status(400).json({ success: false, message: 'unit_id is required' });
    }

    const hasAccess = await verifyCoordinatorUnitAccess(
      client,
      companyIdentifier,
      unitId,
      coordinatorEmail
    );
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'You do not have access to this unit' });
    }

    await client.query('BEGIN');
    const result = await upsertExcelColumnMapping(client, {
      companyIdentifier,
      unitId,
      name,
      templateId,
      columnMapping,
      assertionYesNoMapping,
      controlFrequencyValueMapping,
      excelHeaders,
      actorEmail: coordinatorEmail,
      overwrite,
    });

    if (!result.ok) {
      await client.query('ROLLBACK');
      return res.status(result.statusCode || 400).json({
        success: false,
        message: result.message,
        code: result.code || undefined,
        existing_id: result.existing_id || undefined,
      });
    }

    await client.query('COMMIT');
    return res.status(result.overwritten ? 200 : 201).json({
      success: true,
      message: result.overwritten
        ? 'Column mapping updated successfully'
        : 'Column mapping saved successfully',
      data: result.mapping,
      overwritten: result.overwritten,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Upsert RACM excel column mapping error:', error);
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        code: 'NAME_EXISTS',
        message: 'A mapping with this name already exists for this unit. Confirm overwrite to replace it.',
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to save column mapping',
    });
  } finally {
    client.release();
  }
}

async function markRacmExcelColumnMappingUsed(req, res) {
  const client = await pool.connect();
  try {
    const companyIdentifier = String(req.user?.company_identifier || '').trim();
    const coordinatorEmail = String(req.user?.email_id || '').trim();
    const unitId = String(req.body?.unit_id || '').trim();
    const mappingId = Number(req.params?.id || req.body?.id);

    if (!companyIdentifier || !unitId || !Number.isInteger(mappingId) || mappingId <= 0) {
      return res.status(400).json({ success: false, message: 'unit_id and mapping id are required' });
    }

    const hasAccess = await verifyCoordinatorUnitAccess(
      client,
      companyIdentifier,
      unitId,
      coordinatorEmail
    );
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'You do not have access to this unit' });
    }

    await touchExcelColumnMappingLastUsed(client, {
      companyIdentifier,
      unitId,
      mappingId,
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Mark RACM excel column mapping used error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update mapping usage' });
  } finally {
    client.release();
  }
}

module.exports = {
  listRacmExcelColumnMappings,
  upsertRacmExcelColumnMapping,
  markRacmExcelColumnMappingUsed,
};
