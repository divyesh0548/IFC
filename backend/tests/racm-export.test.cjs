const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getRacmExportData } = require('../utils/racm_export');

function createExportClient() {
  const queries = [];
  return {
    queries,
    async query(sql, params) {
      queries.push({ sql, params });
      if (sql.includes('INNER JOIN racm_template_fields rtf')) {
        return {
          rows: [{
            field_id: 14,
            field_key: 'custom_note',
            label: 'Custom Note',
            section_key: 'others',
          }],
        };
      }
      if (sql.includes('FROM control_forms cf')) {
        return {
          rows: [
            {
              _form_id: 'F1',
              _template_id: 7,
              _company_identifier: 'ACME',
              _unit_id: 'UNIT-1',
              company_name: 'ACME Ltd',
              unit_name: 'North Unit',
              status: 'Approved',
              control_number: 'C1',
              created_at: new Date(),
              pending_changes: true,
            },
            {
              _form_id: 'F2',
              _template_id: 7,
              _company_identifier: 'ACME',
              _unit_id: 'UNIT-1',
              company_name: 'ACME Ltd',
              unit_name: 'North Unit',
              status: 'Approved',
              control_number: 'C2',
            },
          ],
        };
      }
      if (sql.includes('FROM racm_field_values')) {
        return {
          rows: [{ form_id: 'F1', field_id: 14, value_text: 'Value 1' }],
        };
      }
      throw new Error('Unexpected export query');
    },
  };
}

test('RACM export defaults to approved cycles and includes custom field values', async () => {
  const client = createExportClient();

  const result = await getRacmExportData(client, {
    whereSql: 'cf.company_identifier = $1',
    queryParams: ['ACME'],
  });

  assert.match(client.queries[0].sql, /LOWER\(TRIM\(COALESCE\(cf\.status, ''\)\)\) = 'approved'/);
  assert.deepEqual(client.queries[0].params, ['ACME']);
  assert.deepEqual(result.records.map((record) => record.custom_values), [
    { 14: 'Value 1' },
    {},
  ]);
  assert.equal(result.customFields[0].field_key, 'custom_note');
  assert.equal(result.records[0].unit_name, 'North Unit');
  assert.equal('unit_id' in result.records[0], false);
  assert.equal('created_at' in result.records[0], false);
  assert.equal('pending_changes' in result.records[0], false);
  assert.ok(result.columns.some((column) => column.label === 'Unit Name'));
  assert.ok(!result.columns.some((column) => column.key === 'unit_id'));
});

test('RACM export omits the approved-only filter when all RACMs are requested', async () => {
  const client = createExportClient();

  await getRacmExportData(client, {
    whereSql: '1 = 1',
    includeAll: true,
  });

  assert.doesNotMatch(
    client.queries[0].sql,
    /AND LOWER\(TRIM\(COALESCE\(cf\.status, ''\)\)\) = 'approved'/
  );
});
