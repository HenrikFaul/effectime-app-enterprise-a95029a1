import { MAX_EXPORT_SOURCE_ROWS } from '@/lib/exportPagination';

/** Excel 97-2003 / XML Spreadsheet 2003 rows per worksheet, including headers. */
export const EXCEL_XML_MAX_SHEET_ROWS = 65_536;

export type BoundedExportArtifactFormat = 'csv' | 'xls' | 'xml' | 'html';

export function maxExportArtifactDataRows(
  format: BoundedExportArtifactFormat,
  hasGuidanceRow = false,
): number {
  if (format === 'xls') {
    return EXCEL_XML_MAX_SHEET_ROWS - 1 - (hasGuidanceRow ? 1 : 0);
  }
  return MAX_EXPORT_SOURCE_ROWS;
}
