const { test } = require('node:test');
const assert = require('node:assert/strict');
const { partitionUniqueCompanyControlNumbers } = require('../utils/racm_duplicate_key');

test('replication control numbers are unique across units within a company', () => {
  const rows = [
    { company_identifier: 'ACME', unit_id: 'NORTH', control_number: 'AP1', form_id: 'source-1' },
    { company_identifier: 'ACME', unit_id: 'SOUTH', control_number: 'AP1', form_id: 'source-2' },
    { company_identifier: 'OTHER', unit_id: 'NORTH', control_number: 'AP1', form_id: 'source-3' },
  ];

  const result = partitionUniqueCompanyControlNumbers(rows);

  assert.deepEqual(result.uniqueRows.map((row) => row.form_id), ['source-1', 'source-3']);
  assert.deepEqual(result.duplicateRows.map((row) => row.form_id), ['source-2']);
});

test('replication control numbers already in the company are excluded before insertion', () => {
  const rows = [
    { company_identifier: 'ACME', unit_id: 'SOUTH', control_number: ' AP1 ', form_id: 'source-1' },
    { company_identifier: 'ACME', unit_id: 'NORTH', control_number: 'AP2', form_id: 'source-2' },
  ];
  const existingByCompany = new Map([['ACME', new Set(['AP1'])]]);

  const result = partitionUniqueCompanyControlNumbers(rows, existingByCompany);

  assert.deepEqual(result.uniqueRows.map((row) => row.form_id), ['source-2']);
  assert.deepEqual(result.duplicateRows.map((row) => row.form_id), ['source-1']);
});
