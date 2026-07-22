import { describe, expect, it } from 'vitest';

import {
  generateCSV,
  neutralizeSpreadsheetFormula,
} from '@/components/enterprise/import-export/utils/file-parser';

describe('import/export CSV spreadsheet safety', () => {
  it.each([
    '=HYPERLINK("https://attacker.example")',
    '+cmd|calc',
    '-2+3',
    '@SUM(1,2)',
    '\t=1+1',
    '\r=1+1',
    '   =1+1',
  ])('forces a dangerous cell to text: %s', (value) => {
    expect(neutralizeSpreadsheetFormula(value)).toBe(`'${value}`);
  });

  it.each(['42', '0', 'plain text', "'already-safe", 'user@example.com'])(
    'preserves a non-formula cell byte-for-byte: %s',
    (value) => {
      expect(neutralizeSpreadsheetFormula(value)).toBe(value);
    },
  );

  it('neutralizes before RFC 4180 quoting without losing content', () => {
    expect(generateCSV(['value'], [['=SUM(1,2)']]))
      .toBe('\uFEFFvalue\r\n"\'=SUM(1,2)"');
  });
});
