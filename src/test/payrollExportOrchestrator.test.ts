import { describe, expect, it, vi } from 'vitest';
import { maxExportArtifactDataRows } from '@/lib/exportArtifactLimits';
import {
  executePayrollExport,
  PAYROLL_COLUMNS,
  PayrollExportError,
  type PayrollExportDependencies,
  type PayrollExportRequest,
} from '@/components/enterprise/time-attendance/payroll-export';
import type { PayrollExportRow } from '@/components/enterprise/time-attendance/types';

const WORKSPACE_ID = '11111111-1111-4111-8111-111111111111';
const RECORD_ID = '22222222-2222-4222-8222-222222222222';

function payrollRow(overrides: Partial<PayrollExportRow> = {}): PayrollExportRow {
  return {
    membership_id: 'membership-1',
    user_id: 'user-1',
    email: 'member@example.test',
    display_name: 'Example Member',
    team: 'Platform',
    business_role: 'Engineer',
    office_name: 'Budapest',
    period_label: '2026-07',
    status: 'locked',
    regular_hours: 160,
    overtime_hours: 4,
    weekend_overtime_hours: 2,
    night_hours: 1,
    oncall_intervention_hours: 3,
    oncall_standby_hours: 10,
    oncall_standby_compensated_hours: 2,
    expected_hours: 168,
    leave_days: 1,
    leave_hours: 8,
    expected_after_leave: 160,
    worked_hours: 169,
    payroll_total_hours: 171,
    submitted_at: '2026-07-31T12:00:00Z',
    approved_at: '2026-07-31T13:00:00Z',
    locked_at: '2026-07-31T14:00:00Z',
    ...overrides,
  };
}

function request(overrides: Partial<PayrollExportRequest> = {}): PayrollExportRequest {
  return {
    workspaceId: WORKSPACE_ID,
    year: 2026,
    month: 7,
    onlyLocked: true,
    format: 'xlsx',
    ...overrides,
  };
}

function dependencies(events: string[] = []): PayrollExportDependencies {
  return {
    fetchPayrollExport: vi.fn(async () => {
      events.push('fetch');
      return [payrollRow()];
    }),
    generateCSV: vi.fn(() => {
      events.push('generate-csv');
      return 'csv-content';
    }),
    generateExcelXML: vi.fn(() => {
      events.push('generate-xlsx');
      return 'xls-content';
    }),
    recordPayrollExport: vi.fn(async () => {
      events.push('record');
      return RECORD_ID;
    }),
    downloadFile: vi.fn(() => {
      events.push('download');
    }),
  };
}

async function expectPayrollError(
  operation: Promise<unknown>,
  code: PayrollExportError['code'],
): Promise<void> {
  await expect(operation).rejects.toMatchObject({
    name: 'PayrollExportError',
    code,
    message: 'Unable to complete payroll export.',
  });
}

describe('payroll export orchestrator', () => {
  it('preserves the 23-column English payroll contract', () => {
    expect(PAYROLL_COLUMNS).toHaveLength(23);
    expect(PAYROLL_COLUMNS.map((column) => column.label)).toEqual([
      'Email',
      'Name',
      'Team',
      'Role',
      'Site',
      'Period',
      'Status',
      'Regular h',
      'OT h',
      'WE OT h',
      'Night h',
      'Callout h',
      'Standby h',
      'Standby comp h (×0.20)',
      'Expected h',
      'Leave days',
      'Leave h',
      'Expected after leave',
      'Worked h',
      'Payroll total h',
      'Submitted at',
      'Approved at',
      'Locked at',
    ]);
  });

  it('executes xlsx as fetch, SpreadsheetML generation, record, then download', async () => {
    const events: string[] = [];
    const deps = dependencies(events);
    const result = await executePayrollExport(request(), deps);

    expect(events).toEqual(['fetch', 'generate-xlsx', 'record', 'download']);
    expect(deps.generateExcelXML).toHaveBeenCalledWith(
      PAYROLL_COLUMNS.map((column) => column.label),
      [[
        'member@example.test', 'Example Member', 'Platform', 'Engineer', 'Budapest',
        '2026-07', 'locked', '160', '4', '2', '1', '3', '10', '2', '168', '1',
        '8', '160', '169', '171', '2026-07-31T12:00:00Z',
        '2026-07-31T13:00:00Z', '2026-07-31T14:00:00Z',
      ]],
      { sheetName: 'Payroll' },
    );
    expect(deps.recordPayrollExport).toHaveBeenCalledWith(
      WORKSPACE_ID, 2026, 7, 'summary', 'xlsx', expect.any(Array),
    );
    expect(deps.downloadFile).toHaveBeenCalledWith(
      'xls-content',
      'attendance_payroll_2026_07.xls',
      'application/vnd.ms-excel',
    );
    expect(result).toEqual({
      artifact: {
        content: 'xls-content',
        fileName: 'attendance_payroll_2026_07.xls',
        mimeType: 'application/vnd.ms-excel',
      },
      rowCount: 1,
      recordId: RECORD_ID,
    });
  });

  it('preserves csv generation, filename, MIME type and logical DB format', async () => {
    const events: string[] = [];
    const deps = dependencies(events);

    await executePayrollExport(request({ format: 'csv', onlyLocked: false }), deps);

    expect(events).toEqual(['fetch', 'generate-csv', 'record', 'download']);
    expect(deps.generateCSV).toHaveBeenCalledOnce();
    expect(deps.generateExcelXML).not.toHaveBeenCalled();
    expect(deps.recordPayrollExport).toHaveBeenCalledWith(
      WORKSPACE_ID, 2026, 7, 'summary', 'csv', expect.any(Array),
    );
    expect(deps.downloadFile).toHaveBeenCalledWith(
      'csv-content',
      'attendance_payroll_2026_07.csv',
      'text/csv;charset=utf-8',
    );
  });

  it.each([
    null,
    {},
    request({ workspaceId: ' ' }),
    request({ workspaceId: 'not-a-uuid' }),
    request({ year: 2026.5 }),
    request({ year: 0 }),
    request({ month: 0 }),
    request({ month: 13 }),
    { ...request(), onlyLocked: 'yes' },
    { ...request(), format: 'xls' },
  ])('rejects an invalid runtime request before every side effect', async (invalidRequest) => {
    const events: string[] = [];
    const deps = dependencies(events);

    await expectPayrollError(
      executePayrollExport(invalidRequest, deps),
      'INVALID_EXPORT_REQUEST',
    );

    expect(events).toEqual([]);
  });

  it('checks the artifact budget before reading any of the 23 row values', async () => {
    let propertyReads = 0;
    const row = new Proxy(payrollRow(), {
      get(target, property, receiver) {
        propertyReads += 1;
        return Reflect.get(target, property, receiver);
      },
    });
    const rows = new Array<PayrollExportRow>(maxExportArtifactDataRows('xls') + 1).fill(row);
    const deps = dependencies();
    vi.mocked(deps.fetchPayrollExport).mockResolvedValue(rows);

    await expectPayrollError(
      executePayrollExport(request(), deps),
      'ARTIFACT_ROW_LIMIT_EXCEEDED',
    );

    expect(propertyReads).toBe(0);
    expect(deps.generateExcelXML).not.toHaveBeenCalled();
    expect(deps.recordPayrollExport).not.toHaveBeenCalled();
    expect(deps.downloadFile).not.toHaveBeenCalled();
  });

  it('stops after fetch failure', async () => {
    const events: string[] = [];
    const deps = dependencies(events);
    vi.mocked(deps.fetchPayrollExport).mockImplementation(async () => {
      events.push('fetch');
      throw new Error('network detail');
    });

    await expectPayrollError(executePayrollExport(request(), deps), 'FETCH_FAILED');

    expect(events).toEqual(['fetch']);
    expect(deps.generateExcelXML).not.toHaveBeenCalled();
    expect(deps.recordPayrollExport).not.toHaveBeenCalled();
    expect(deps.downloadFile).not.toHaveBeenCalled();
  });

  it('stops after an empty fetch result without manufacturing an artifact', async () => {
    const events: string[] = [];
    const deps = dependencies(events);
    vi.mocked(deps.fetchPayrollExport).mockImplementation(async () => {
      events.push('fetch');
      return [];
    });

    await expectPayrollError(executePayrollExport(request(), deps), 'EMPTY_EXPORT');

    expect(events).toEqual(['fetch']);
    expect(deps.generateExcelXML).not.toHaveBeenCalled();
    expect(deps.recordPayrollExport).not.toHaveBeenCalled();
    expect(deps.downloadFile).not.toHaveBeenCalled();
  });

  it('stops a stale scope before recording or delivering its generated artifact', async () => {
    const events: string[] = [];
    const deps = dependencies(events);
    let checks = 0;

    await expectPayrollError(
      executePayrollExport(request(), deps, () => {
        checks += 1;
        return checks < 3;
      }),
      'STALE_SCOPE',
    );

    expect(events).toEqual(['fetch', 'generate-xlsx']);
    expect(deps.recordPayrollExport).not.toHaveBeenCalled();
    expect(deps.downloadFile).not.toHaveBeenCalled();
  });

  it('reports a recorded-but-not-delivered outcome if the scope becomes stale after recording', async () => {
    const events: string[] = [];
    const deps = dependencies(events);
    let checks = 0;
    const operation = executePayrollExport(request(), deps, () => {
      checks += 1;
      return checks < 4;
    });

    await expectPayrollError(
      operation,
      'RECORDED_NOT_DELIVERED',
    );
    await expect(operation).rejects.toMatchObject({
      metadata: {
        recordId: RECORD_ID,
        workspaceId: WORKSPACE_ID,
        year: 2026,
        month: 7,
        fileName: 'attendance_payroll_2026_07.xls',
        rowCount: 1,
      },
    });

    expect(events).toEqual(['fetch', 'generate-xlsx', 'record']);
    expect(deps.recordPayrollExport).toHaveBeenCalledOnce();
    expect(deps.downloadFile).not.toHaveBeenCalled();
  });

  it('stops after artifact generation failure', async () => {
    const events: string[] = [];
    const deps = dependencies(events);
    vi.mocked(deps.generateExcelXML).mockImplementation(() => {
      events.push('generate-xlsx');
      throw new Error('generator detail');
    });

    await expectPayrollError(
      executePayrollExport(request(), deps),
      'ARTIFACT_GENERATION_FAILED',
    );

    expect(events).toEqual(['fetch', 'generate-xlsx']);
    expect(deps.recordPayrollExport).not.toHaveBeenCalled();
    expect(deps.downloadFile).not.toHaveBeenCalled();
  });

  it('stops after record failure and does not deliver an unrecorded artifact', async () => {
    const events: string[] = [];
    const deps = dependencies(events);
    vi.mocked(deps.recordPayrollExport).mockImplementation(async () => {
      events.push('record');
      throw new Error('record detail');
    });

    await expectPayrollError(executePayrollExport(request(), deps), 'RECORD_FAILED');

    expect(events).toEqual(['fetch', 'generate-xlsx', 'record']);
    expect(deps.recordPayrollExport).toHaveBeenCalledOnce();
    expect(deps.downloadFile).not.toHaveBeenCalled();
  });

  it('rejects a malformed record receipt before download', async () => {
    const events: string[] = [];
    const deps = dependencies(events);
    vi.mocked(deps.recordPayrollExport).mockImplementation(async () => {
      events.push('record');
      return 'not-a-uuid';
    });

    await expectPayrollError(executePayrollExport(request(), deps), 'RECORD_FAILED');

    expect(events).toEqual(['fetch', 'generate-xlsx', 'record']);
    expect(deps.downloadFile).not.toHaveBeenCalled();
  });

  it('reports a stable download code after exactly one successful record', async () => {
    const events: string[] = [];
    const deps = dependencies(events);
    vi.mocked(deps.downloadFile).mockImplementation(() => {
      events.push('download');
      throw new Error('browser detail');
    });

    const operation = executePayrollExport(request(), deps);
    await expectPayrollError(operation, 'DOWNLOAD_FAILED_AFTER_RECORD');
    await expect(operation).rejects.toMatchObject({
      metadata: {
        recordId: RECORD_ID,
        workspaceId: WORKSPACE_ID,
        year: 2026,
        month: 7,
        fileName: 'attendance_payroll_2026_07.xls',
        rowCount: 1,
      },
    });

    expect(events).toEqual(['fetch', 'generate-xlsx', 'record', 'download']);
    expect(deps.recordPayrollExport).toHaveBeenCalledOnce();
    expect(deps.downloadFile).toHaveBeenCalledOnce();
  });

  it('awaits an asynchronous delivery adapter and maps its rejection after recording', async () => {
    const events: string[] = [];
    const deps = dependencies(events);
    vi.mocked(deps.downloadFile).mockImplementation(async () => {
      events.push('download');
      throw new Error('native adapter detail');
    });

    const operation = executePayrollExport(request(), deps);
    await expectPayrollError(operation, 'DOWNLOAD_FAILED_AFTER_RECORD');
    await expect(operation).rejects.toMatchObject({
      metadata: expect.objectContaining({ recordId: RECORD_ID }),
    });
    expect(events).toEqual(['fetch', 'generate-xlsx', 'record', 'download']);
    expect(deps.recordPayrollExport).toHaveBeenCalledOnce();
  });
});
