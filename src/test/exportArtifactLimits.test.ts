import { describe, expect, it } from 'vitest';
import {
  EXCEL_XML_MAX_SHEET_ROWS,
  maxExportArtifactDataRows,
} from '@/lib/exportArtifactLimits';
import { MAX_EXPORT_SOURCE_ROWS } from '@/lib/exportPagination';
import { generateExcelXML } from '@/components/enterprise/import-export/utils/file-parser';

describe('export artifact row budgets', () => {
  it('counts the XLS header and optional guidance row inside the sheet limit', () => {
    expect(EXCEL_XML_MAX_SHEET_ROWS).toBe(65_536);
    expect(maxExportArtifactDataRows('xls', false)).toBe(65_535);
    expect(maxExportArtifactDataRows('xls', true)).toBe(65_534);
  });

  it.each(['csv', 'xml', 'html'] as const)(
    'keeps the %s artifact data budget at the source ceiling',
    (format) => {
      expect(maxExportArtifactDataRows(format)).toBe(MAX_EXPORT_SOURCE_ROWS);
    },
  );

  it.each([
    ['without guidance', undefined],
    ['with guidance', ['example']],
  ] as const)(
    'enforces the exact SpreadsheetML worksheet boundary %s',
    (_caseName, guidanceRow) => {
      const maxDataRows = maxExportArtifactDataRows(
        'xls',
        guidanceRow !== undefined,
      );
      const options = guidanceRow === undefined
        ? { sheetName: 'Boundary' }
        : { guidanceRow: [...guidanceRow], sheetName: 'Boundary' };
      const exactRows = new Array<string[]>(maxDataRows).fill([]);

      const xml = generateExcelXML(['value'], exactRows, options);

      expect(xml.match(/<Row>/g)).toHaveLength(EXCEL_XML_MAX_SHEET_ROWS);
      expect(() => generateExcelXML(
        ['value'],
        new Array<string[]>(maxDataRows + 1).fill([]),
        options,
      )).toThrow(new RangeError('Excel XML worksheet row limit exceeded.'));
    },
  );
});
