import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ExportPaginationError,
  MAX_EXPORT_SOURCE_ROWS,
} from '@/lib/exportPagination';
import type { PayrollExportRow } from '@/components/enterprise/time-attendance/types';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: mocks.rpc,
  },
}));

import {
  fetchPayrollExport,
  recordPayrollExport,
} from '@/components/enterprise/time-attendance/api';

interface QueryOptions {
  count?: 'exact';
}

interface QueryInvocation {
  name: string;
  params: Record<string, unknown>;
  options?: QueryOptions;
  orders: Array<{ column: string; options?: { ascending?: boolean } }>;
  range?: { from: number; to: number };
}

interface PayrollFixture {
  rows: unknown[];
  initialCount?: number | null;
  finalCount?: number | null;
  error?: unknown;
  envelope?: unknown;
}

const invocations: QueryInvocation[] = [];
let payrollFixture: PayrollFixture;
let recordResponse: unknown;

function executePayrollQuery(invocation: QueryInvocation): unknown {
  if (payrollFixture.envelope !== undefined) return payrollFixture.envelope;
  if (payrollFixture.error !== undefined) {
    return { data: null, error: payrollFixture.error, count: null };
  }

  const { from = 0, to = payrollFixture.rows.length - 1 } = invocation.range ?? {};
  const exactCountRequested = invocation.options?.count === 'exact';
  const finalCountProbe = exactCountRequested && from === 0 && to === 0;
  return {
    data: payrollFixture.rows.slice(from, to + 1),
    error: null,
    count: exactCountRequested
      ? (finalCountProbe
        ? (payrollFixture.finalCount ?? payrollFixture.rows.length)
        : (payrollFixture.initialCount ?? payrollFixture.rows.length))
      : null,
  };
}

function createPayrollBuilder(invocation: QueryInvocation) {
  invocations.push(invocation);
  const builder = {
    order: vi.fn(),
    range: vi.fn(),
    then: <TResult1 = unknown, TResult2 = never>(
      onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) => Promise.resolve()
      .then(() => executePayrollQuery(invocation))
      .then(onfulfilled, onrejected),
  };
  builder.order.mockImplementation((column: string, options?: { ascending?: boolean }) => {
    invocation.orders.push({ column, options });
    return builder;
  });
  builder.range.mockImplementation((from: number, to: number) => {
    invocation.range = { from, to };
    return builder;
  });
  return builder;
}

function membershipId(index: number): string {
  return `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`;
}

function userId(index: number): string {
  return `10000000-0000-4000-9000-${index.toString(16).padStart(12, '0')}`;
}

function row(index = 0, overrides: Partial<PayrollExportRow> = {}): PayrollExportRow {
  return {
    membership_id: membershipId(index),
    user_id: userId(index),
    email: `member-${index}@example.test`,
    display_name: `Member ${index}`,
    team: 'Payroll',
    business_role: 'Specialist',
    office_name: 'Budapest',
    period_label: '2026-07',
    status: 'locked',
    regular_hours: 160,
    overtime_hours: 4,
    weekend_overtime_hours: 0,
    night_hours: 0,
    oncall_intervention_hours: 0,
    oncall_standby_hours: 0,
    oncall_standby_compensated_hours: 0,
    expected_hours: 160,
    leave_days: 0,
    leave_hours: 0,
    expected_after_leave: 160,
    worked_hours: 164,
    payroll_total_hours: 164,
    submitted_at: '2026-07-31T10:00:00.000Z',
    approved_at: '2026-07-31T11:00:00.000Z',
    locked_at: '2026-07-31T12:00:00.000Z',
    ...overrides,
  };
}

function paginationCode(error: unknown): string | undefined {
  return error instanceof ExportPaginationError ? error.code : undefined;
}

beforeEach(() => {
  invocations.length = 0;
  payrollFixture = { rows: [] };
  recordResponse = { data: '8c43f742-72c3-4dc1-9790-a8dc427bac51', error: null };
  mocks.rpc.mockReset();
  mocks.rpc.mockImplementation((
    name: string,
    params: Record<string, unknown>,
    options?: QueryOptions,
  ) => {
    if (name === 'attendance_record_export') return Promise.resolve(recordResponse);
    if (name !== 'attendance_payroll_export') throw new Error(`Unexpected RPC: ${name}`);
    return createPayrollBuilder({ name, params, options, orders: [] });
  });
});

describe('fetchPayrollExport', () => {
  it.each([
    { count: 0, ranges: [[0, 499]] },
    { count: 500, ranges: [[0, 499]] },
    { count: 501, ranges: [[0, 499], [500, 500], [0, 0]] },
    { count: 1001, ranges: [[0, 499], [500, 999], [1000, 1000], [0, 0]] },
  ])('returns all $count rows through exact 500-row pages', async ({ count, ranges }) => {
    payrollFixture.rows = Array.from({ length: count }, (_, index) => row(index));

    const result = await fetchPayrollExport('workspace-1', 2026, 7, true);

    expect(result).toHaveLength(count);
    expect(invocations.map((call) => [call.range?.from, call.range?.to])).toEqual(ranges);
    for (const call of invocations.filter((item) => item.range?.to !== 0)) {
      expect(call.orders).toEqual([
        { column: 'membership_id', options: { ascending: true } },
        { column: 'period_label', options: { ascending: true } },
      ]);
    }
    expect(invocations[0]?.params).toEqual({
      p_workspace_id: 'workspace-1',
      p_year: 2026,
      p_month: 7,
      p_only_locked: true,
    });
    expect(invocations[0]?.options).toEqual({ count: 'exact' });
  });

  it('fails closed before collecting a source above the 100k hard cap', async () => {
    payrollFixture.initialCount = MAX_EXPORT_SOURCE_ROWS + 1;

    await expect(fetchPayrollExport('workspace-1', 2026, 7, true))
      .rejects.toMatchObject({ code: 'ROW_LIMIT_EXCEEDED' });
    expect(invocations).toHaveLength(1);
  });

  it('fails closed when the exact count changes between page reads', async () => {
    payrollFixture.rows = Array.from({ length: 501 }, (_, index) => row(index));
    payrollFixture.finalCount = 502;

    await expect(fetchPayrollExport('workspace-1', 2026, 7, true))
      .rejects.toMatchObject({ code: 'COUNT_CHANGED' });
  });

  const invalidBusinessFields: Array<[keyof PayrollExportRow, unknown]> = [
    ['email', null],
    ['display_name', null],
    ['team', null],
    ['business_role', null],
    ['office_name', null],
    ['period_label', null],
    ['status', null],
    ['regular_hours', 'not-a-number'],
    ['overtime_hours', 'not-a-number'],
    ['weekend_overtime_hours', 'not-a-number'],
    ['night_hours', 'not-a-number'],
    ['oncall_intervention_hours', 'not-a-number'],
    ['oncall_standby_hours', 'not-a-number'],
    ['oncall_standby_compensated_hours', 'not-a-number'],
    ['expected_hours', 'not-a-number'],
    ['leave_days', 'not-a-number'],
    ['leave_hours', 'not-a-number'],
    ['expected_after_leave', 'not-a-number'],
    ['worked_hours', 'not-a-number'],
    ['payroll_total_hours', 'not-a-number'],
    ['submitted_at', 42],
    ['approved_at', 42],
    ['locked_at', 42],
  ];

  it('keeps the runtime schema aligned to all 23 exported business fields', () => {
    expect(invalidBusinessFields).toHaveLength(23);
  });

  it.each(invalidBusinessFields)('rejects an invalid %s provider field', async (field, invalidValue) => {
    payrollFixture.rows = [{ ...row(), [field]: invalidValue }];

    await expect(fetchPayrollExport('workspace-1', 2026, 7, true))
      .rejects.toSatisfy((error: unknown) => paginationCode(error) === 'INVALID_ROW');
  });

  it.each(['membership_id', 'user_id'] as const)('rejects a blank %s provider identity', async (field) => {
    payrollFixture.rows = [row(0, { [field]: '   ' })];

    await expect(fetchPayrollExport('workspace-1', 2026, 7, true))
      .rejects.toMatchObject({ code: 'INVALID_ROW' });
  });

  it.each(['membership_id', 'user_id'] as const)('rejects a non-UUID %s provider identity', async (field) => {
    payrollFixture.rows = [row(0, { [field]: 'membership-1' })];

    await expect(fetchPayrollExport('workspace-1', 2026, 7, true))
      .rejects.toMatchObject({ code: 'INVALID_ROW' });
  });

  it('rejects a row outside the requested YYYY-MM period', async () => {
    payrollFixture.rows = [row(0, { period_label: '2026-06' })];

    await expect(fetchPayrollExport('workspace-1', 2026, 7, true))
      .rejects.toMatchObject({ code: 'INVALID_ROW' });
  });

  it('enforces locked/exported rows when onlyLocked is requested', async () => {
    payrollFixture.rows = [row(0, { status: 'approved' })];

    await expect(fetchPayrollExport('workspace-1', 2026, 7, true))
      .rejects.toMatchObject({ code: 'INVALID_ROW' });

    invocations.length = 0;
    payrollFixture.rows = [row(0, { status: 'approved' })];
    await expect(fetchPayrollExport('workspace-1', 2026, 7, false))
      .resolves.toHaveLength(1);
  });

  it('rejects a status outside the attendance state machine in full exports', async () => {
    payrollFixture.rows = [row(0, { status: 'deleted' })];

    await expect(fetchPayrollExport('workspace-1', 2026, 7, false))
      .rejects.toMatchObject({ code: 'INVALID_ROW' });
  });

  it('rejects malformed timestamps instead of snapshotting them', async () => {
    payrollFixture.rows = [row(0, { locked_at: '2026-99-99T00:00:00Z' })];

    await expect(fetchPayrollExport('workspace-1', 2026, 7, true))
      .rejects.toMatchObject({ code: 'INVALID_ROW' });
  });

  it.each([
    ['submitted', 'submitted_at'],
    ['returned', 'submitted_at'],
    ['approved', 'approved_at'],
    ['locked', 'locked_at'],
    ['exported', 'locked_at'],
  ] as const)('rejects %s rows without their required %s state timestamp', async (status, field) => {
    payrollFixture.rows = [row(0, { status, [field]: null })];

    await expect(fetchPayrollExport('workspace-1', 2026, 7, false))
      .rejects.toMatchObject({ code: 'INVALID_ROW' });
  });

  it('rejects numeric strings instead of returning them under a number type', async () => {
    payrollFixture.rows = [{ ...row(), regular_hours: '160' }];

    await expect(fetchPayrollExport('workspace-1', 2026, 7, true))
      .rejects.toMatchObject({ code: 'INVALID_ROW' });
  });

  it('rejects a blank payroll email identifier', async () => {
    payrollFixture.rows = [row(0, { email: '   ' })];

    await expect(fetchPayrollExport('workspace-1', 2026, 7, true))
      .rejects.toMatchObject({ code: 'INVALID_ROW' });
  });

  it('rejects negative payroll values', async () => {
    payrollFixture.rows = [row(0, { regular_hours: -1, worked_hours: 3, payroll_total_hours: 3 })];

    await expect(fetchPayrollExport('workspace-1', 2026, 7, true))
      .rejects.toMatchObject({ code: 'INVALID_ROW' });
  });

  it.each([
    { worked_hours: 165, payroll_total_hours: 165 },
    { expected_after_leave: 159 },
    { payroll_total_hours: 165 },
  ] as const)('rejects inconsistent documented payroll arithmetic (%o)', async (overrides) => {
    payrollFixture.rows = [row(0, overrides)];

    await expect(fetchPayrollExport('workspace-1', 2026, 7, true))
      .rejects.toMatchObject({ code: 'INVALID_ROW' });
  });

  it('projects additive provider fields out of the canonical payroll payload', async () => {
    payrollFixture.rows = [{ ...row(), secret_extra: 'must-not-persist' }];

    const result = await fetchPayrollExport('workspace-1', 2026, 7, true);

    expect(result).toEqual([row()]);
    expect(result[0]).not.toHaveProperty('secret_extra');
    await recordPayrollExport('workspace-1', 2026, 7, 'summary', 'xlsx', result);
    expect(mocks.rpc).toHaveBeenLastCalledWith('attendance_record_export', expect.objectContaining({
      p_payload: [row()],
    }));
  });

  it('rejects duplicate stable membership/period identities', async () => {
    payrollFixture.rows = [row(0), row(0)];

    await expect(fetchPayrollExport('workspace-1', 2026, 7, true))
      .rejects.toMatchObject({ code: 'DUPLICATE_ROW_ID' });
  });

  it('rejects duplicate normalized payroll email identifiers', async () => {
    payrollFixture.rows = [
      row(0, { email: 'Payroll.Member@example.test' }),
      row(1, { email: ' payroll.member@EXAMPLE.TEST ' }),
    ];

    await expect(fetchPayrollExport('workspace-1', 2026, 7, true))
      .rejects.toMatchObject({ code: 'DUPLICATE_ROW_ID' });
  });

  it('preserves strict provider errors', async () => {
    payrollFixture.error = new Error('provider detail');

    await expect(fetchPayrollExport('workspace-1', 2026, 7, true))
      .rejects.toMatchObject({ code: 'QUERY_FAILED' });
  });
});

describe('recordPayrollExport', () => {
  it('returns a validated export UUID and records exact row/member counts', async () => {
    const rows = [row(0), row(1), row(2, { membership_id: membershipId(1) })];

    await expect(recordPayrollExport('workspace-1', 2026, 7, 'summary', 'csv', rows))
      .resolves.toBe('8c43f742-72c3-4dc1-9790-a8dc427bac51');
    expect(mocks.rpc).toHaveBeenCalledWith('attendance_record_export', {
      p_workspace_id: 'workspace-1',
      p_year: 2026,
      p_month: 7,
      p_variant: 'summary',
      p_format: 'csv',
      p_member_count: 2,
      p_total_periods: 3,
      p_payload: rows,
    });
  });

  it.each([null, '', '   ', 'not-a-uuid', '00000000-0000-0000-0000-000000000000'])(
    'rejects malformed record identifiers (%s)',
    async (data) => {
      recordResponse = { data, error: null };

      await expect(recordPayrollExport('workspace-1', 2026, 7, 'summary', 'xlsx', [row()]))
        .rejects.toThrow('Unable to record payroll export.');
    },
  );

  it('preserves an attendance_record_export provider failure', async () => {
    const providerError = new Error('denied');
    recordResponse = { data: null, error: providerError };

    await expect(recordPayrollExport('workspace-1', 2026, 7, 'summary', 'xlsx', [row()]))
      .rejects.toBe(providerError);
  });
});
