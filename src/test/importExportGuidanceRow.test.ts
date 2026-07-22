import { describe, expect, it } from 'vitest';

import {
  ENTITY_REGISTRY,
  getEntityConfig,
} from '@/components/enterprise/import-export/config/entity-registry';
import {
  autoMapColumns,
  buildTemplateGuidanceRow,
  detectGuidanceRow,
  getDuplicateMappedFieldKeys,
  getImportHeaderIssue,
  validateRows,
} from '@/components/enterprise/import-export/utils/validator';

function rowFrom(headers: readonly string[], values: readonly string[]): Record<string, string> {
  return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
}

describe('import/export guidance row contract', () => {
  it('rejects empty and normalized duplicate source headers', () => {
    expect(getImportHeaderIssue(['name', '  '])).toBe('empty');
    expect(getImportHeaderIssue(['Name *', ' name'])).toBe('duplicate');
    expect(getImportHeaderIssue(['name', 'category'])).toBeNull();
  });

  it('detects multiple source columns mapped to one target field', () => {
    expect(getDuplicateMappedFieldKeys({ Name: 'name', Alias: 'name', Color: 'color' }))
      .toEqual(['name']);
    expect(getDuplicateMappedFieldKeys({ Name: 'name', Alias: '__ignore__' })).toEqual([]);
  });

  it('stores reserved source headers as ordinary own keys', () => {
    const entity = getEntityConfig('skills');
    expect(entity).toBeDefined();
    const mapping = autoMapColumns(entity!, ['__proto__']);

    expect(Object.prototype.hasOwnProperty.call(mapping, '__proto__')).toBe(true);
    expect(mapping.__proto__).toBe('__ignore__');
  });

  it.each(ENTITY_REGISTRY.filter((entity) => entity.importEnabled).map((entity) => [entity.key, entity] as const))(
    'round-trips the version-marked %s template guidance signature',
    (_key, entity) => {
      const fields = entity.fields.filter((field) => field.importable);
      const headers = fields.map((field) => field.key);
      const mapping = autoMapColumns(entity, headers);
      const values = buildTemplateGuidanceRow(fields);

      expect(detectGuidanceRow(entity, mapping, rowFrom(headers, values))).toBe(true);
    },
  );

  it('accepts the complete legacy skill-template signature without the marker', () => {
    const entity = getEntityConfig('skills');
    expect(entity).toBeDefined();
    const fields = entity!.fields.filter((field) => field.importable);
    const headers = fields.map((field) => field.key);
    const mapping = autoMapColumns(entity!, headers);
    const legacyValues = fields.map((field) => field.templateExample ?? '');

    expect(detectGuidanceRow(entity!, mapping, rowFrom(headers, legacyValues))).toBe(true);
  });

  it('never treats an invalid first member row as guidance merely because its email is invalid', () => {
    const entity = getEntityConfig('members');
    expect(entity).toBeDefined();
    const fields = entity!.fields.filter((field) => field.importable);
    const headers = fields.map((field) => field.key);
    const mapping = autoMapColumns(entity!, headers);
    const values = fields.map((field) => field.templateExample ?? '');
    values[headers.indexOf('email')] = 'not-an-email';

    expect(detectGuidanceRow(entity!, mapping, rowFrom(headers, values))).toBe(false);
  });

  it('does not discard a real one-column first row that matches an old example value', () => {
    const entity = getEntityConfig('skills');
    expect(entity).toBeDefined();

    expect(detectGuidanceRow(
      entity!,
      { name: 'name' },
      { name: 'TypeScript' },
    )).toBe(false);
  });

  it('does not discard a partial file matching a non-marker guidance value', () => {
    const entity = getEntityConfig('skills');
    expect(entity).toBeDefined();

    expect(detectGuidanceRow(
      entity!,
      { category: 'category' },
      { category: 'Programming language' },
    )).toBe(false);
  });

  it('recognizes a marked guidance row after whole columns are reordered', () => {
    const entity = getEntityConfig('skills');
    expect(entity).toBeDefined();
    const fields = entity!.fields.filter((field) => field.importable);
    const valuesByKey = new Map(
      fields.map((field, index) => [field.key, buildTemplateGuidanceRow(fields)[index]]),
    );
    const headers = ['category', 'name', 'color'];
    const mapping = autoMapColumns(entity!, headers);
    const values = headers.map((header) => valuesByKey.get(header) ?? '');

    expect(detectGuidanceRow(entity!, mapping, rowFrom(headers, values))).toBe(true);
  });

  it('uses the original source row in duplicate diagnostics after guidance removal', () => {
    const entity = getEntityConfig('skills');
    expect(entity).toBeDefined();
    const validation = validateRows(
      entity!,
      [{ name: 'Alpha' }, { name: 'Alpha' }],
      { name: 'name' },
      1,
    );

    expect(validation.errors).toEqual([
      expect.objectContaining({
        rowIndex: 1,
        code: 'DUPLICATE_IN_FILE',
        message: 'Duplicate row in file (other row: 2)',
      }),
    ]);
  });
});
