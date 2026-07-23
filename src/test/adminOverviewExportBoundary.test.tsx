import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AdminPeriodRow,
  AttendancePeriodStatus,
} from '@/components/enterprise/time-attendance/types';

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  listWorkspacePeriods: vi.fn(),
  transitionPeriod: vi.fn(),
  fetchPayrollExport: vi.fn(),
  recordPayrollExport: vi.fn(),
  generateCSV: vi.fn(),
  generateExcelXML: vi.fn(),
  downloadFile: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  useFeature: vi.fn(),
  featureState: {
    enabled: true,
    isLoading: false,
    isError: false,
  },
  translate: (key: string, values?: Record<string, string | number>) => {
    if (typeof values?.count === 'number') return `${key}:${values.count}`;
    if (typeof values?.recordId === 'string' && typeof values?.period === 'string') {
      return `${key}:${values.period}:${values.recordId}`;
    }
    return key;
  },
}));

vi.mock('@/components/enterprise/time-attendance/api', () => ({
  listWorkspacePeriods: mocks.listWorkspacePeriods,
  transitionPeriod: mocks.transitionPeriod,
  fetchPayrollExport: mocks.fetchPayrollExport,
  recordPayrollExport: mocks.recordPayrollExport,
}));

vi.mock('@/components/enterprise/import-export/utils/file-parser', () => ({
  generateCSV: mocks.generateCSV,
  generateExcelXML: mocks.generateExcelXML,
  downloadFile: mocks.downloadFile,
}));

vi.mock('@/hooks/useFeature', () => ({
  useFeature: (workspaceId: string, featureKey: string) => {
    mocks.useFeature(workspaceId, featureKey);
    return { ...mocks.featureState };
  },
}));

vi.mock('@/i18n/I18nProvider', () => ({
  useI18n: () => ({ t: mocks.translate }),
  useDateLocale: () => undefined,
}));

vi.mock('sonner', () => ({
  toast: {
    success: mocks.success,
    error: mocks.error,
  },
}));

vi.mock('@/components/enterprise/time-attendance/payroll-export', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('@/components/enterprise/time-attendance/payroll-export')
  >();
  return {
    ...actual,
    executePayrollExport: mocks.execute,
  };
});

import { AdminOverview } from '@/components/enterprise/time-attendance/AdminOverview';
import {
  PayrollExportError,
  type PayrollExportRecoveryMetadata,
  type PayrollExportRequest,
} from '@/components/enterprise/time-attendance/payroll-export';

const WORKSPACE_A = '11111111-1111-4111-8111-111111111111';
const WORKSPACE_B = '22222222-2222-4222-8222-222222222222';

const exportResult = {
  artifact: {
    content: 'artifact',
    fileName: 'attendance_payroll_2026_07.xls',
    mimeType: 'application/vnd.ms-excel',
  },
  rowCount: 2,
  recordId: '33333333-3333-4333-8333-333333333333',
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function periodRow(
  displayName: string,
  workspaceSuffix: string,
  status: AttendancePeriodStatus = 'locked',
): AdminPeriodRow {
  return {
    period_id: `period-${workspaceSuffix}`,
    membership_id: `membership-${workspaceSuffix}`,
    user_id: `user-${workspaceSuffix}`,
    display_name: displayName,
    email: `${workspaceSuffix}@example.test`,
    status,
    totals: null,
    submitted_at: null,
    approved_at: null,
    locked_at: null,
    exported_at: null,
  };
}

function recoveryMetadata(request: PayrollExportRequest): PayrollExportRecoveryMetadata {
  const period = `${request.year}_${String(request.month).padStart(2, '0')}`;
  return {
    recordId: '33333333-3333-4333-8333-333333333333',
    workspaceId: request.workspaceId,
    year: request.year,
    month: request.month,
    fileName: `attendance_payroll_${period}.${request.format === 'xlsx' ? 'xls' : 'csv'}`,
    rowCount: 2,
  };
}

async function renderLoaded(workspaceId = WORKSPACE_A) {
  const view = render(<AdminOverview workspaceId={workspaceId} />);
  await screen.findByRole('group', { name: 'attendance.export_controls' });
  return view;
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(mocks.featureState, {
    enabled: true,
    isLoading: false,
    isError: false,
  });
  mocks.listWorkspacePeriods.mockResolvedValue([]);
  mocks.execute.mockResolvedValue(exportResult);
  mocks.transitionPeriod.mockResolvedValue(undefined);
});

afterEach(cleanup);

describe('AdminOverview payroll export boundary', () => {
  it('fails closed while entitlement access is loading or unavailable', async () => {
    Object.assign(mocks.featureState, {
      enabled: false,
      isLoading: true,
      isError: false,
    });
    const view = await renderLoaded();

    expect(mocks.useFeature).toHaveBeenCalledWith(WORKSPACE_A, 'payroll_export');
    const group = screen.getByRole('group', { name: 'attendance.export_controls' });
    const xlsx = screen.getByRole('button', { name: 'attendance.export_xlsx' });
    const csv = screen.getByRole('button', { name: 'attendance.export_csv' });
    expect(group).toHaveAttribute('aria-busy', 'true');
    expect(group).toHaveTextContent('attendance.export_access_checking');
    expect(xlsx).toBeDisabled();
    expect(csv).toBeDisabled();
    fireEvent.click(xlsx);
    expect(mocks.execute).not.toHaveBeenCalled();

    Object.assign(mocks.featureState, {
      enabled: false,
      isLoading: false,
      isError: true,
    });
    view.rerender(<AdminOverview workspaceId={WORKSPACE_A} />);
    expect(group).toHaveTextContent('feature_gate.entitlement_unavailable_title');
    expect(xlsx).toBeDisabled();

    Object.assign(mocks.featureState, {
      enabled: false,
      isLoading: false,
      isError: false,
    });
    view.rerender(<AdminOverview workspaceId={WORKSPACE_A} />);
    expect(group).toHaveTextContent('feature_gate.locked_title');
    expect(csv).toBeDisabled();
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it('uses a synchronous single-flight guard and exposes localized busy state', async () => {
    const operation = deferred<typeof exportResult>();
    mocks.execute.mockReturnValue(operation.promise);
    await renderLoaded();

    const xlsx = screen.getByRole('button', { name: 'attendance.export_xlsx' });
    act(() => {
      xlsx.click();
      xlsx.click();
    });

    expect(mocks.execute).toHaveBeenCalledOnce();
    expect(mocks.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: WORKSPACE_A,
        onlyLocked: true,
        format: 'xlsx',
      }),
      expect.objectContaining({
        fetchPayrollExport: mocks.fetchPayrollExport,
        recordPayrollExport: mocks.recordPayrollExport,
      }),
      expect.any(Function),
    );
    expect(screen.getByRole('group', { name: 'attendance.export_controls' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: 'attendance.exporting' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'attendance.export_csv' })).toBeDisabled();

    await act(async () => operation.resolve(exportResult));

    expect(mocks.success).toHaveBeenCalledOnce();
    expect(mocks.success).toHaveBeenCalledWith('attendance.export_done:2');
    await waitFor(() => expect(mocks.listWorkspacePeriods).toHaveBeenCalledTimes(2));
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it('blocks every period mutation synchronously while an export is active', async () => {
    const operation = deferred<typeof exportResult>();
    mocks.execute.mockReturnValue(operation.promise);
    mocks.listWorkspacePeriods.mockResolvedValue([
      periodRow('Submitted Member', 'submitted', 'submitted'),
      periodRow('Approved Member', 'approved', 'approved'),
      periodRow('Locked Member', 'locked', 'locked'),
    ]);
    await renderLoaded();

    const exportButton = screen.getByRole('button', { name: 'attendance.export_xlsx' });
    const approveButton = screen.getByRole('button', { name: 'attendance.action_approve' });
    act(() => {
      exportButton.click();
      approveButton.click();
    });

    expect(mocks.transitionPeriod).not.toHaveBeenCalled();
    expect(approveButton).toBeDisabled();
    expect(screen.getByRole('button', { name: 'attendance.action_return' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'attendance.action_lock' })).toBeDisabled();
    for (const reopenButton of screen.getAllByRole('button', { name: 'attendance.action_reopen' })) {
      expect(reopenButton).toBeDisabled();
    }

    await act(async () => operation.resolve(exportResult));
  });

  it('blocks export and navigation synchronously while a period mutation is active', async () => {
    const transition = deferred<void>();
    mocks.transitionPeriod.mockReturnValueOnce(transition.promise);
    mocks.listWorkspacePeriods.mockResolvedValue([
      periodRow('Approved Member', 'approved', 'approved'),
    ]);
    await renderLoaded();

    const lockButton = screen.getByRole('button', { name: 'attendance.action_lock' });
    const exportButton = screen.getByRole('button', { name: 'attendance.export_xlsx' });
    const previousMonth = screen.getByRole('button', { name: 'attendance.previous_month' });
    act(() => {
      lockButton.click();
      exportButton.click();
      previousMonth.click();
    });

    expect(mocks.transitionPeriod).toHaveBeenCalledOnce();
    expect(mocks.execute).not.toHaveBeenCalled();
    expect(lockButton).toBeDisabled();
    expect(exportButton).toBeDisabled();
    expect(previousMonth).toBeDisabled();
    expect(screen.getByRole('group', { name: 'attendance.export_controls' })).toHaveAttribute('aria-busy', 'true');

    await act(async () => transition.resolve());
    await waitFor(() => expect(exportButton).toBeEnabled());
    expect(mocks.success).toHaveBeenCalledWith('attendance.status_updated');
  });

  it('invalidates a pending export immediately when the workspace changes', async () => {
    const operation = deferred<typeof exportResult>();
    mocks.execute.mockReturnValue(operation.promise);
    const view = await renderLoaded(WORKSPACE_A);
    fireEvent.click(screen.getByRole('button', { name: 'attendance.export_xlsx' }));

    const isCurrent = mocks.execute.mock.calls[0][2] as () => boolean;
    expect(isCurrent()).toBe(true);
    view.rerender(<AdminOverview workspaceId={WORKSPACE_B} />);
    expect(isCurrent()).toBe(false);
    await screen.findByRole('group', { name: 'attendance.export_controls' });

    await act(async () => operation.resolve(exportResult));

    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.error).not.toHaveBeenCalled();
    expect(mocks.listWorkspacePeriods).toHaveBeenCalledTimes(2);
  });

  it('keeps one global export flight across scope changes and disables month navigation', async () => {
    const first = deferred<typeof exportResult>();
    const second = deferred<typeof exportResult>();
    mocks.execute
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const view = await renderLoaded(WORKSPACE_A);

    const exportButton = screen.getByRole('button', { name: 'attendance.export_xlsx' });
    const previousMonth = screen.getByRole('button', { name: 'attendance.previous_month' });
    const nextMonth = screen.getByRole('button', { name: 'attendance.next_month' });
    act(() => {
      exportButton.click();
      previousMonth.click();
      nextMonth.click();
    });
    const firstIsCurrent = mocks.execute.mock.calls[0][2] as () => boolean;
    expect(previousMonth).toBeDisabled();
    expect(nextMonth).toBeDisabled();
    expect(mocks.listWorkspacePeriods).toHaveBeenCalledOnce();

    view.rerender(<AdminOverview workspaceId={WORKSPACE_B} />);
    expect(firstIsCurrent()).toBe(false);
    await screen.findByRole('group', { name: 'attendance.export_controls' });
    const csvWhileFirstRuns = screen.getByRole('button', { name: 'attendance.export_csv' });
    expect(csvWhileFirstRuns).toBeDisabled();
    fireEvent.click(csvWhileFirstRuns);
    expect(mocks.execute).toHaveBeenCalledOnce();

    await act(async () => first.resolve(exportResult));
    expect(mocks.success).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole('button', { name: 'attendance.export_csv' })).toBeEnabled());

    fireEvent.click(screen.getByRole('button', { name: 'attendance.export_csv' }));
    expect(mocks.execute).toHaveBeenCalledTimes(2);
    await act(async () => second.resolve(exportResult));
    expect(mocks.success).toHaveBeenCalledOnce();
    await waitFor(() => expect(mocks.listWorkspacePeriods).toHaveBeenCalledTimes(3));
  });

  it('keeps old tenant list results out of the new workspace UI', async () => {
    const firstList = deferred<AdminPeriodRow[]>();
    mocks.listWorkspacePeriods
      .mockReturnValueOnce(firstList.promise)
      .mockResolvedValueOnce([periodRow('Workspace B Member', 'b')]);
    const view = render(<AdminOverview workspaceId={WORKSPACE_A} />);
    await waitFor(() => expect(mocks.listWorkspacePeriods).toHaveBeenCalledOnce());

    view.rerender(<AdminOverview workspaceId={WORKSPACE_B} />);
    expect(await screen.findByText('Workspace B Member')).toBeInTheDocument();
    await act(async () => firstList.resolve([periodRow('Workspace A Secret', 'a')]));

    expect(screen.queryByText('Workspace A Secret')).not.toBeInTheDocument();
    expect(screen.getByText('Workspace B Member')).toBeInTheDocument();
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it.each([
    ['xlsx', true, 'attendance.export_empty_locked'],
    ['csv', false, 'attendance.export_empty'],
  ] as const)('maps an empty %s export to its stable localized toast', async (format, onlyLocked, expectedKey) => {
    mocks.execute.mockRejectedValue(new PayrollExportError('EMPTY_EXPORT'));
    await renderLoaded();

    fireEvent.click(screen.getByRole('button', {
      name: format === 'xlsx' ? 'attendance.export_xlsx' : 'attendance.export_csv',
    }));

    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(expectedKey));
    expect(mocks.execute).toHaveBeenCalledWith(
      expect.objectContaining({ format, onlyLocked }),
      expect.any(Object),
      expect.any(Function),
    );
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it('surfaces and reconciles a recorded export even after its scope becomes stale', async () => {
    const operation = deferred<typeof exportResult>();
    mocks.execute.mockReturnValue(operation.promise);
    const view = await renderLoaded(WORKSPACE_A);
    fireEvent.click(screen.getByRole('button', { name: 'attendance.export_xlsx' }));
    const isCurrent = mocks.execute.mock.calls[0][2] as () => boolean;

    view.rerender(<AdminOverview workspaceId={WORKSPACE_B} />);
    expect(isCurrent()).toBe(false);
    await waitFor(() => expect(mocks.listWorkspacePeriods).toHaveBeenCalledTimes(2));
    const request = mocks.execute.mock.calls[0][0] as PayrollExportRequest;
    await act(async () => operation.reject(new PayrollExportError(
      'RECORDED_NOT_DELIVERED',
      new Error('private record detail'),
      recoveryMetadata(request),
    )));

    await waitFor(() => {
      expect(mocks.error).toHaveBeenCalledWith(
        `attendance.export_recorded_not_delivered:${request.year}-${String(request.month).padStart(2, '0')}:33333333-3333-4333-8333-333333333333`,
      );
    });
    expect(mocks.listWorkspacePeriods).toHaveBeenCalledTimes(2);
    expect(String(mocks.error.mock.calls)).not.toContain('private record detail');
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it('reports a post-record download failure distinctly and refreshes current status', async () => {
    mocks.execute.mockImplementation(async (request: PayrollExportRequest) => {
      throw new PayrollExportError(
        'DOWNLOAD_FAILED_AFTER_RECORD',
        new Error('private browser detail'),
        recoveryMetadata(request),
      );
    });
    await renderLoaded();
    fireEvent.click(screen.getByRole('button', { name: 'attendance.export_xlsx' }));

    await waitFor(() => {
      expect(mocks.listWorkspacePeriods).toHaveBeenCalledTimes(2);
    });
    const request = mocks.execute.mock.calls[0][0] as PayrollExportRequest;
    expect(mocks.error).toHaveBeenCalledWith(
      `attendance.export_download_failed_after_record:${request.year}-${String(request.month).padStart(2, '0')}:33333333-3333-4333-8333-333333333333`,
    );
    expect(String(mocks.error.mock.calls)).not.toContain('private browser detail');
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it('never exposes provider details from a current-scope failure', async () => {
    mocks.execute.mockRejectedValue(new Error('<script>tenant private detail</script>'));
    await renderLoaded();
    fireEvent.click(screen.getByRole('button', { name: 'attendance.export_csv' }));

    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith('attendance.export_failed'));
    expect(String(mocks.error.mock.calls)).not.toContain('tenant private detail');
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it('provides names for month navigation and the icon-only reopen action', async () => {
    mocks.listWorkspacePeriods.mockResolvedValue([periodRow('Locked Member', 'locked')]);
    await renderLoaded();

    expect(screen.getByRole('button', { name: 'attendance.previous_month' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'attendance.next_month' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'attendance.action_reopen' })).toBeEnabled();
  });
});
