import { describe, it, expect } from 'vitest';
import {
  flatten,
  parseCsv,
  buildI18nCsv,
  parseI18nCsv,
  bundleStats,
} from '@/lib/i18n/csv';

describe('flatten', () => {
  it('flattens nested object to dotted keys', () => {
    const bundle = { common: { save: 'Save', cancel: 'Cancel' } };
    const result = flatten(bundle);
    expect(result.get('common.save')).toBe('Save');
    expect(result.get('common.cancel')).toBe('Cancel');
  });

  it('handles deeply nested keys', () => {
    const bundle = { a: { b: { c: 'deep' } } };
    expect(flatten(bundle).get('a.b.c')).toBe('deep');
  });

  it('converts numbers and booleans to strings', () => {
    const bundle = { count: 42, flag: true };
    const result = flatten(bundle as any);
    expect(result.get('count')).toBe('42');
    expect(result.get('flag')).toBe('true');
  });

  it('returns empty map for null/undefined input', () => {
    expect(flatten(null).size).toBe(0);
    expect(flatten(undefined).size).toBe(0);
  });

  it('ignores non-string, non-number, non-boolean leaf values', () => {
    const bundle = { key: null, other: 'ok' };
    const result = flatten(bundle as any);
    expect(result.has('key')).toBe(false);
    expect(result.get('other')).toBe('ok');
  });
});

describe('parseCsv', () => {
  it('parses simple CSV', () => {
    const csv = 'key,en,hu\ncommon.save,Save,Mentés';
    const rows = parseCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(['key', 'en', 'hu']);
    expect(rows[1]).toEqual(['common.save', 'Save', 'Mentés']);
  });

  it('handles quoted fields with commas', () => {
    const csv = 'key,en\n"some,key","Hello, world"';
    const rows = parseCsv(csv);
    expect(rows[1][0]).toBe('some,key');
    expect(rows[1][1]).toBe('Hello, world');
  });

  it('handles escaped double-quotes inside quoted fields', () => {
    const csv = 'key,en\ngreet,"Say ""hi"""';
    const rows = parseCsv(csv);
    expect(rows[1][1]).toBe('Say "hi"');
  });

  it('handles CRLF line endings', () => {
    const csv = 'key,en\r\nfoo,bar\r\nbaz,qux';
    const rows = parseCsv(csv);
    expect(rows).toHaveLength(3);
    expect(rows[1]).toEqual(['foo', 'bar']);
  });

  it('returns empty array for empty string', () => {
    expect(parseCsv('')).toEqual([]);
  });

  it('returns empty array for whitespace-only string', () => {
    expect(parseCsv('\n\n').filter(r => r.length > 0)).toEqual([]);
  });
});

describe('buildI18nCsv', () => {
  it('produces a string starting with the header row', () => {
    const csv = buildI18nCsv();
    expect(csv.startsWith('key,en,hu')).toBe(true);
  });

  it('contains more than just the header', () => {
    const csv = buildI18nCsv();
    const lines = csv.split('\n').filter(Boolean);
    expect(lines.length).toBeGreaterThan(1);
  });

  it('all data rows have exactly 3 columns', () => {
    const csv = buildI18nCsv();
    const rows = parseCsv(csv);
    // skip the header row
    for (const row of rows.slice(1)) {
      expect(row.length).toBe(3);
    }
  });

  it('rows are sorted alphabetically by key', () => {
    const csv = buildI18nCsv();
    const rows = parseCsv(csv).slice(1);
    const keys = rows.map(r => r[0]);
    const sorted = [...keys].sort();
    expect(keys).toEqual(sorted);
  });
});

describe('parseI18nCsv', () => {
  it('throws when key column is missing', () => {
    const csv = 'en,hu\nSave,Mentés';
    expect(() => parseI18nCsv(csv)).toThrow(/key/i);
  });

  it('returns zeroes for empty CSV', () => {
    const result = parseI18nCsv('');
    expect(result.total).toBe(0);
    expect(result.added).toBe(0);
  });

  it('counts an added key that did not exist in the bundle', () => {
    const csv = 'key,en,hu\nnew.nonexistent.key.abc,New Value,Új érték';
    const result = parseI18nCsv(csv);
    expect(result.added).toBeGreaterThan(0);
  });

  it('counts an updated key when value differs from bundle', () => {
    // 'common.save' exists in both bundles; override with different value
    const csv = 'key,en\ncommon.save,Persist';
    const result = parseI18nCsv(csv);
    // 'Save' !== 'Persist' → updated
    expect(result.updated).toBeGreaterThan(0);
  });

  it('skips rows with empty keys', () => {
    const csv = 'key,en\n,SomeValue\ncommon.save,Save';
    const result = parseI18nCsv(csv);
    expect(result.skipped).toBe(1);
  });

  it('returns override maps keyed by locale', () => {
    const csv = 'key,en,hu\nnew.key,New,Új';
    const result = parseI18nCsv(csv);
    expect(result.overrides.en.get('new.key')).toBe('New');
    expect(result.overrides.hu.get('new.key')).toBe('Új');
  });
});

describe('bundleStats', () => {
  it('returns totalKeys > 0', () => {
    const stats = bundleStats();
    expect(stats.totalKeys).toBeGreaterThan(0);
  });

  it('missingHu and missingEn are non-negative integers', () => {
    const stats = bundleStats();
    expect(stats.missingHu).toBeGreaterThanOrEqual(0);
    expect(stats.missingEn).toBeGreaterThanOrEqual(0);
  });

  it('totalKeys >= max(missingHu, missingEn)', () => {
    const stats = bundleStats();
    expect(stats.totalKeys).toBeGreaterThanOrEqual(stats.missingHu);
    expect(stats.totalKeys).toBeGreaterThanOrEqual(stats.missingEn);
  });
});
