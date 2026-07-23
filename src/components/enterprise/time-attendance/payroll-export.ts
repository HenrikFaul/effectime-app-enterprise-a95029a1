import { maxExportArtifactDataRows } from '@/lib/exportArtifactLimits';
import type { PayrollExportRow } from './types';

export type PayrollExportFormat = 'csv' | 'xlsx';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export const PAYROLL_COLUMNS = [
  { key: 'email', label: 'Email' },
  { key: 'display_name', label: 'Name' },
  { key: 'team', label: 'Team' },
  { key: 'business_role', label: 'Role' },
  { key: 'office_name', label: 'Site' },
  { key: 'period_label', label: 'Period' },
  { key: 'status', label: 'Status' },
  { key: 'regular_hours', label: 'Regular h' },
  { key: 'overtime_hours', label: 'OT h' },
  { key: 'weekend_overtime_hours', label: 'WE OT h' },
  { key: 'night_hours', label: 'Night h' },
  { key: 'oncall_intervention_hours', label: 'Callout h' },
  { key: 'oncall_standby_hours', label: 'Standby h' },
  { key: 'oncall_standby_compensated_hours', label: 'Standby comp h (×0.20)' },
  { key: 'expected_hours', label: 'Expected h' },
  { key: 'leave_days', label: 'Leave days' },
  { key: 'leave_hours', label: 'Leave h' },
  { key: 'expected_after_leave', label: 'Expected after leave' },
  { key: 'worked_hours', label: 'Worked h' },
  { key: 'payroll_total_hours', label: 'Payroll total h' },
  { key: 'submitted_at', label: 'Submitted at' },
  { key: 'approved_at', label: 'Approved at' },
  { key: 'locked_at', label: 'Locked at' },
] as const satisfies readonly {
  key: keyof PayrollExportRow;
  label: string;
}[];

export type PayrollExportErrorCode =
  | 'INVALID_EXPORT_REQUEST'
  | 'STALE_SCOPE'
  | 'FETCH_FAILED'
  | 'EMPTY_EXPORT'
  | 'ARTIFACT_ROW_LIMIT_EXCEEDED'
  | 'ARTIFACT_GENERATION_FAILED'
  | 'RECORD_FAILED'
  | 'RECORDED_NOT_DELIVERED'
  | 'DOWNLOAD_FAILED_AFTER_RECORD';

export interface PayrollExportRecoveryMetadata {
  recordId: string;
  workspaceId: string;
  year: number;
  month: number;
  fileName: string;
  rowCount: number;
}

export class PayrollExportError extends Error {
  readonly code: PayrollExportErrorCode;
  readonly cause: unknown;
  readonly metadata: PayrollExportRecoveryMetadata | null;

  constructor(
    code: PayrollExportErrorCode,
    cause?: unknown,
    metadata: PayrollExportRecoveryMetadata | null = null,
  ) {
    super('Unable to complete payroll export.');
    this.name = 'PayrollExportError';
    this.code = code;
    this.cause = cause;
    this.metadata = metadata;
  }
}

export interface PayrollExportRequest {
  workspaceId: string;
  year: number;
  month: number;
  onlyLocked: boolean;
  format: PayrollExportFormat;
}

export interface PayrollExportArtifact {
  content: string;
  fileName: string;
  mimeType: string;
}

export interface PayrollExportDependencies {
  fetchPayrollExport(
    workspaceId: string,
    year: number,
    month: number,
    onlyLocked: boolean,
  ): Promise<PayrollExportRow[]>;
  generateCSV(headers: string[], rows: string[][]): string;
  generateExcelXML(
    headers: string[],
    rows: string[][],
    options: { sheetName: string },
  ): string;
  recordPayrollExport(
    workspaceId: string,
    year: number,
    month: number,
    variant: 'summary',
    format: PayrollExportFormat,
    rows: PayrollExportRow[],
  ): Promise<string>;
  downloadFile(content: string, fileName: string, mimeType: string): void | Promise<void>;
}

export interface PayrollExportResult {
  artifact: PayrollExportArtifact;
  rowCount: number;
  recordId: string;
}

function isValidRequest(request: unknown): request is PayrollExportRequest {
  if (typeof request !== 'object' || request === null) return false;
  const value = request as Record<string, unknown>;
  return (
    typeof value.workspaceId === 'string'
    && UUID_PATTERN.test(value.workspaceId)
    && typeof value.year === 'number'
    && Number.isInteger(value.year)
    && value.year >= 1
    && value.year <= 9_999
    && typeof value.month === 'number'
    && Number.isInteger(value.month)
    && value.month >= 1
    && value.month <= 12
    && typeof value.onlyLocked === 'boolean'
    && (value.format === 'csv' || value.format === 'xlsx')
  );
}

function artifactDataRowLimit(format: PayrollExportFormat): number {
  return maxExportArtifactDataRows(format === 'xlsx' ? 'xls' : 'csv');
}

function throwIfStale(isCurrent: () => boolean): void {
  if (!isCurrent()) throw new PayrollExportError('STALE_SCOPE');
}

function payrollCellValue(value: PayrollExportRow[keyof PayrollExportRow]): string {
  return value === null || value === undefined ? '' : String(value);
}

function generateArtifact(
  request: PayrollExportRequest,
  rows: PayrollExportRow[],
  dependencies: PayrollExportDependencies,
): PayrollExportArtifact {
  if (rows.length > artifactDataRowLimit(request.format)) {
    throw new PayrollExportError('ARTIFACT_ROW_LIMIT_EXCEEDED');
  }

  try {
    const headers = PAYROLL_COLUMNS.map((column) => column.label);
    const dataRows = rows.map((row) => (
      PAYROLL_COLUMNS.map((column) => payrollCellValue(row[column.key]))
    ));
    const periodLabel = `${request.year}_${String(request.month).padStart(2, '0')}`;

    if (request.format === 'xlsx') {
      return {
        content: dependencies.generateExcelXML(headers, dataRows, { sheetName: 'Payroll' }),
        fileName: `attendance_payroll_${periodLabel}.xls`,
        mimeType: 'application/vnd.ms-excel',
      };
    }

    return {
      content: dependencies.generateCSV(headers, dataRows),
      fileName: `attendance_payroll_${periodLabel}.csv`,
      mimeType: 'text/csv;charset=utf-8',
    };
  } catch (error) {
    if (error instanceof PayrollExportError) throw error;
    throw new PayrollExportError('ARTIFACT_GENERATION_FAILED', error);
  }
}

/**
 * Executes the payroll export transaction boundary without depending on React.
 * The snapshot is recorded exactly once in this invocation before browser
 * download initiation. Post-record failures retain the safe receipt metadata
 * so callers cannot mistake them for an uncommitted export.
 */
export async function executePayrollExport(
  request: unknown,
  dependencies: PayrollExportDependencies,
  isCurrent: () => boolean = () => true,
): Promise<PayrollExportResult> {
  if (!isValidRequest(request)) {
    throw new PayrollExportError('INVALID_EXPORT_REQUEST');
  }
  throwIfStale(isCurrent);

  let rows: PayrollExportRow[];
  try {
    rows = await dependencies.fetchPayrollExport(
      request.workspaceId,
      request.year,
      request.month,
      request.onlyLocked,
    );
    if (!Array.isArray(rows)) throw new Error('Invalid payroll export response.');
  } catch (error) {
    throw new PayrollExportError('FETCH_FAILED', error);
  }
  throwIfStale(isCurrent);

  if (rows.length === 0) {
    throw new PayrollExportError('EMPTY_EXPORT');
  }

  const artifact = generateArtifact(request, rows, dependencies);
  throwIfStale(isCurrent);

  let recordId: string;
  try {
    recordId = await dependencies.recordPayrollExport(
      request.workspaceId,
      request.year,
      request.month,
      'summary',
      request.format,
      rows,
    );
    if (typeof recordId !== 'string' || !UUID_PATTERN.test(recordId)) {
      throw new Error('Invalid payroll export record id.');
    }
  } catch (error) {
    throw new PayrollExportError('RECORD_FAILED', error);
  }
  const recoveryMetadata: PayrollExportRecoveryMetadata = {
    recordId,
    workspaceId: request.workspaceId,
    year: request.year,
    month: request.month,
    fileName: artifact.fileName,
    rowCount: rows.length,
  };
  if (!isCurrent()) {
    throw new PayrollExportError('RECORDED_NOT_DELIVERED', undefined, recoveryMetadata);
  }

  try {
    await dependencies.downloadFile(artifact.content, artifact.fileName, artifact.mimeType);
  } catch (error) {
    throw new PayrollExportError('DOWNLOAD_FAILED_AFTER_RECORD', error, recoveryMetadata);
  }

  return { artifact, rowCount: rows.length, recordId };
}
