const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const read = (name) => fs.readFileSync(path.join(__dirname, name), 'utf8');
const savedSource = read('../../frontend/src/utils/racmSavedColumnMapping.js')
  .replace(/^import .*\r?\n/gm, '').replace(/export /g, '');
const applySaved = vm.runInNewContext(savedSource + '\nsoftApplySavedColumnMapping', {
  BULK_IMPORT_SKIP: '__skip__', BULK_IMPORT_AUTO: '__auto__',
});
const importerSource = read('../utils/racm_bulk_import_from_rows.js');
const moduleStub = { exports: {} };
vm.runInNewContext(importerSource, {
  module: moduleStub, exports: moduleStub.exports, console,
  require: (name) => name === 'crypto' ? require('crypto') : name === './column_mapping'
    ? { normalizeColumnName: () => 'risk_description' } : {},
});
const transform = moduleStub.exports.transformExcelDataWithColumnMapping;

test('saved null is skipped while Major Process remains explicitly mapped', () => {
  const result = applySaved({
    savedColumnMapping: { 'Major \nProcess No.': null, 'Major Process': 'extra:major_process' },
    headers: ['Major \nProcess No.', 'Major Process', 'New header'],
    mappableSet: new Set(['extra:major_process']),
  });
  assert.equal(result.overrides['Major \nProcess No.'], '__skip__');
  assert.equal(result.overrides['Major Process'], 'extra:major_process');
  assert.equal(result.overrides['New header'], '__skip__');
  assert.equal(result.duplicateTargets.length, 0);
});

test('saved mappings with duplicate targets are flagged before applying', () => {
  const result = applySaved({ savedColumnMapping: { A: 'extra:process', B: 'extra:process' },
    headers: ['A', 'B'], mappableSet: new Set(['extra:process']) });
  assert.equal(result.duplicateTargets.length, 1);
});

test('removed template targets stay skipped instead of being auto-detected', () => {
  const result = applySaved({ savedColumnMapping: { A: 'extra:removed' }, headers: ['A'], mappableSet: new Set() });
  assert.equal(result.overrides.A, '__skip__');
});

test('backend preserves null and omitted columns without keyword fallback', () => {
  const rows = transform([{ 'Major \nProcess No.': '3', 'Major Process': 'Procurement', Other: 'Must not import' }],
    { 'Major \nProcess No.': null, 'Major Process': 'extra:major_process' });
  assert.equal(rows[0].dynamic_values.major_process, 'Procurement');
  assert.equal(rows[0].risk_description, undefined);
});

test('empty explicit mapping imports no source columns', () => {
  assert.equal(Object.keys(transform([{ A: 'value' }], {})[0]).length, 0);
});

test('backend rejects repeated fixed and custom targets', () => {
  for (const target of ['risk_description', 'extra:major_process']) {
    assert.throws(() => transform([{ A: 'one', B: 'two' }], { A: target, B: target }),
      (error) => error.statusCode === 400 && error.message.includes('cannot map to more than one'));
  }
});

test('keyword matching remains available when no explicit mapping is supplied', () => {
  assert.equal(transform([{ A: 'risk' }], undefined)[0].risk_description, 'risk');
});

test('auto-detection intentionally skipped by uniqueness logic cannot be reapplied', () => {
  const source = read('../../frontend/src/utils/racmBulkImportColumnMapping.js');
  const start = source.indexOf('export function getEffectiveMappedField(');
  const end = source.indexOf('\nexport function ', start + 30);
  const resolve = vm.runInNewContext(source.slice(start, end).replace('export ', '') + '\ngetEffectiveMappedField', {
    BULK_IMPORT_SKIP: '__skip__', BULK_IMPORT_AUTO: '__auto__',
    isMappableFieldValue: (value, set) => set.has(value),
    detectDbColumnFromHeader: () => 'extra:major_process',
  });
  assert.equal(resolve('A', { A: '__auto__' }, { A: null }, {}, new Set(['extra:major_process'])), null);
});
