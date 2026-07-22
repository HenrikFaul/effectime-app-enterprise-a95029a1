import { describe, expect, it, vi } from 'vitest';
import {
  executeLegacyLeaveExport,
  LegacyLeaveExportError,
  loadLegacyLeaveExportFilterOptions,
  type LegacyLeaveExportClient,
  type LegacyLeaveExportFormat,
  type LegacyLeaveExportLabels,
  type LegacyLeaveExportRequest,
} from '@/lib/legacyLeaveExport';

interface PlannedResult {
  data: unknown[] | null;
  error: unknown;
  reject?: unknown;
}

interface QueryOperation {
  table: string;
  method: string;
  args: unknown[];
}

function createClient(plans: Record<string, PlannedResult[]>) {
  const operations: QueryOperation[] = [];
  const events: string[] = [];
  const from = vi.fn((table: string) => {
    const result = plans[table]?.shift() ?? { data: [], error: null };
    const settle = () => result.reject === undefined
      ? Promise.resolve(result)
      : Promise.reject(result.reject);
    const query = {
      select: (...args: unknown[]) => {
        operations.push({ table, method: 'select', args });
        return query;
      },
      eq: (...args: unknown[]) => {
        operations.push({ table, method: 'eq', args });
        return query;
      },
      gte: (...args: unknown[]) => {
        operations.push({ table, method: 'gte', args });
        return query;
      },
      lte: (...args: unknown[]) => {
        operations.push({ table, method: 'lte', args });
        return query;
      },
      in: (...args: unknown[]) => {
        operations.push({ table, method: 'in', args });
        return query;
      },
      order: (...args: unknown[]) => {
        operations.push({ table, method: 'order', args });
        return query;
      },
      insert: (...args: unknown[]) => {
        operations.push({ table, method: 'insert', args });
        events.push('audit');
        return settle();
      },
      then: <TResult1 = PlannedResult, TResult2 = never>(
        onfulfilled?: ((value: PlannedResult) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
      ) => settle().then(onfulfilled, onrejected),
    };
    return query;
  });
  return {
    client: { from } as unknown as LegacyLeaveExportClient,
    operations,
    events,
  };
}

const WORKSPACE_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';
const MEMBER_ID = '33333333-3333-4333-8333-333333333333';

const labels: LegacyLeaveExportLabels = {
  dayNames: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  headers: ['date', 'day', 'name', 'team', 'position', 'type', 'status', 'half_day', 'holiday', 'company_day', 'comment'],
  unknownPerson: 'Unknown',
  leaveType: { vacation: 'Vacation' },
  leaveStatus: { approved: 'Approved' },
  halfDayMorning: 'Morning',
  halfDayAfternoon: 'Afternoon',
  htmlTitle: 'Effectime — Leave export',
  htmlDateRows: (start, end, rowCount) => `${start}-${end}:${rowCount}`,
};

function request(format: LegacyLeaveExportFormat = 'csv'): LegacyLeaveExportRequest {
  return {
    workspaceId: WORKSPACE_ID,
    userId: USER_ID,
    startDate: new Date(2026, 6, 13, 12),
    endDate: new Date(2026, 6, 14, 12),
    statusFilter: 'all',
    teamFilter: 'all',
    roleFilter: 'all',
    format,
  };
}

function successfulPlans(): Record<string, PlannedResult[]> {
  return {
    leave_requests: [{
      data: [{
        id: 'leave-1',
        user_id: MEMBER_ID,
        start_date: '2026-07-12',
        end_date: '2026-07-15',
        leave_type: 'vacation',
        status: 'approved',
        is_half_day: false,
        half_day_period: null,
        comment: '=HYPERLINK("https://example.invalid")',
      }],
      error: null,
    }],
    profiles: [{ data: [{ user_id: MEMBER_ID, display_name: 'Ada' }], error: null }],
    enterprise_memberships: [{
      data: [{ user_id: MEMBER_ID, team: 'Engineering', business_role: 'Developer' }],
      error: null,
    }],
    enterprise_holidays: [{ data: [{ holiday_date: '2026-07-14', name: 'Holiday' }], error: null }],
    enterprise_company_leave_days: [{ data: [], error: null }],
    enterprise_audit_events: [{ data: null, error: null }],
  };
}

async function expectCode(
  promise: Promise<unknown>,
  code: LegacyLeaveExportError['code']
): Promise<void> {
  await expect(promise).rejects.toMatchObject({
    name: 'LegacyLeaveExportError',
    message: 'Unable to create leave export.',
    code,
  });
}

describe('legacy leave export integrity boundary', () => {
  it('loads overlapping leave, audits before download, and neutralizes CSV formulas', async () => {
    const { client, operations, events } = createClient(successfulPlans());
    const download = vi.fn(() => events.push('download'));

    const result = await executeLegacyLeaveExport(client, request(), labels, download);

    expect(result.rowCount).toBe(2);
    expect(result.artifact.fileName).toBe('effectime_export_20260713_20260714.csv');
    expect(result.artifact.content).toContain('\'=HYPERLINK(""https://example.invalid"")');
    expect(events).toEqual(['audit', 'download']);
    expect(download).toHaveBeenCalledOnce();
    expect(operations).toContainEqual({
      table: 'leave_requests',
      method: 'lte',
      args: ['start_date', '2026-07-14'],
    });
    expect(operations).toContainEqual({
      table: 'leave_requests',
      method: 'gte',
      args: ['end_date', '2026-07-13'],
    });
    const audit = operations.find((operation) => operation.table === 'enterprise_audit_events');
    expect(audit?.args[0]).toMatchObject({
      workspace_id: WORKSPACE_ID,
      actor_id: USER_ID,
      action: 'export.created',
      metadata: {
        start_date: '2026-07-13',
        end_date: '2026-07-14',
        row_count: 2,
        format: 'csv',
        delivery: 'browser_download_pending',
      },
    });
  });

  it('uses truthful .xls naming and metadata for Excel XML', async () => {
    const { client, operations } = createClient(successfulPlans());
    const result = await executeLegacyLeaveExport(client, request('xls'), labels, vi.fn());

    expect(result.artifact.fileName).toMatch(/\.xls$/);
    expect(result.artifact.content).toContain('urn:schemas-microsoft-com:office:spreadsheet');
    const audit = operations.find((operation) => operation.table === 'enterprise_audit_events');
    expect(audit?.args[0]).toMatchObject({ metadata: { format: 'xls' } });
  });

  it.each(['xml', 'xls'] as const)(
    'replaces XML 1.0-forbidden control characters in %s output',
    async (format) => {
      const plans = successfulPlans();
      const leave = plans.leave_requests[0].data?.[0] as { comment: string };
      leave.comment = 'before\u0001after';
      const { client } = createClient(plans);

      const result = await executeLegacyLeaveExport(client, request(format), labels, vi.fn());

      expect(result.artifact.content).not.toContain('\u0001');
      expect(result.artifact.content).toContain('before\uFFFDafter');
    }
  );

  it.each([
    ['leave_requests', 'LEAVE_QUERY_FAILED'],
    ['profiles', 'PROFILE_QUERY_FAILED'],
    ['enterprise_memberships', 'MEMBERSHIP_QUERY_FAILED'],
    ['enterprise_holidays', 'HOLIDAY_QUERY_FAILED'],
    ['enterprise_company_leave_days', 'COMPANY_DAY_QUERY_FAILED'],
    ['enterprise_audit_events', 'AUDIT_QUERY_FAILED'],
  ] as const)('fails closed on %s provider failure', async (table, code) => {
    const plans = successfulPlans();
    plans[table][0] = { data: null, error: { message: 'SECRET provider detail' } };
    const { client, operations } = createClient(plans);
    const download = vi.fn();

    await expectCode(executeLegacyLeaveExport(client, request(), labels, download), code);
    expect(download).not.toHaveBeenCalled();
    if (table !== 'enterprise_audit_events') {
      expect(operations.some((operation) => operation.table === 'enterprise_audit_events')).toBe(false);
    }
  });

  it('rejects a successful-but-null read instead of auditing an empty export', async () => {
    const plans = successfulPlans();
    plans.leave_requests[0] = { data: null, error: null };
    const { client, operations } = createClient(plans);
    const download = vi.fn();

    await expectCode(
      executeLegacyLeaveExport(client, request(), labels, download),
      'LEAVE_QUERY_FAILED'
    );
    expect(operations.some((operation) => operation.table === 'enterprise_audit_events')).toBe(false);
    expect(download).not.toHaveBeenCalled();
  });

  it('rejects a malformed audit response before download', async () => {
    const plans = successfulPlans();
    plans.enterprise_audit_events[0] = {} as PlannedResult;
    const { client } = createClient(plans);
    const download = vi.fn();

    await expectCode(
      executeLegacyLeaveExport(client, request(), labels, download),
      'AUDIT_QUERY_FAILED'
    );
    expect(download).not.toHaveBeenCalled();
  });

  it.each([
    ['leave_requests', 'LEAVE_QUERY_FAILED'],
    ['enterprise_audit_events', 'AUDIT_QUERY_FAILED'],
  ] as const)('normalizes a rejected %s request to %s', async (table, code) => {
    const plans = successfulPlans();
    plans[table][0] = {
      data: null,
      error: null,
      reject: new Error('SECRET transport detail'),
    };
    const { client } = createClient(plans);
    const download = vi.fn();

    await expectCode(executeLegacyLeaveExport(client, request(), labels, download), code);
    expect(download).not.toHaveBeenCalled();
  });

  it('normalizes a rejected filter request without retaining transport detail', async () => {
    const { client } = createClient({
      enterprise_memberships: [{
        data: null,
        error: null,
        reject: new Error('SECRET transport detail'),
      }],
    });

    await expectCode(
      loadLegacyLeaveExportFilterOptions(client, WORKSPACE_ID),
      'FILTER_OPTIONS_QUERY_FAILED'
    );
  });

  it('rejects an invalid date range before any read or download', async () => {
    const { client, operations } = createClient({});
    const invalid = request();
    invalid.startDate = new Date(2026, 6, 15, 12);
    invalid.endDate = new Date(2026, 6, 14, 12);
    const download = vi.fn();

    await expectCode(
      executeLegacyLeaveExport(client, invalid, labels, download),
      'INVALID_DATE_RANGE'
    );
    expect(operations).toHaveLength(0);
    expect(download).not.toHaveBeenCalled();
  });

  it('invalidates a stale workspace result before audit or download', async () => {
    const { client, operations } = createClient(successfulPlans());
    const download = vi.fn();

    await expectCode(
      executeLegacyLeaveExport(client, request(), labels, download, () => false),
      'STALE_SCOPE'
    );
    expect(operations.some((operation) => operation.table === 'enterprise_audit_events')).toBe(false);
    expect(download).not.toHaveBeenCalled();
  });

  it('fails with a stable code when artifact generation throws', async () => {
    const { client, operations } = createClient(successfulPlans());
    const brokenLabels = {
      ...labels,
      htmlDateRows: () => {
        throw new Error('SECRET rendering detail');
      },
    };
    const download = vi.fn();

    await expectCode(
      executeLegacyLeaveExport(client, request('html'), brokenLabels, download),
      'ARTIFACT_GENERATION_FAILED'
    );
    expect(operations.some((operation) => operation.table === 'enterprise_audit_events')).toBe(false);
    expect(download).not.toHaveBeenCalled();
  });

  it('fails with a stable code when the browser download cannot start', async () => {
    const { client, events } = createClient(successfulPlans());
    const download = vi.fn(() => {
      events.push('download');
      throw new Error('SECRET browser detail');
    });

    await expectCode(
      executeLegacyLeaveExport(client, request(), labels, download),
      'DOWNLOAD_FAILED'
    );
    expect(events).toEqual(['audit', 'download']);
    expect(download).toHaveBeenCalledOnce();
  });

  it('fails filter option loading closed without retaining provider detail', async () => {
    const { client } = createClient({
      enterprise_memberships: [{ data: null, error: { message: 'SECRET provider detail' } }],
    });

    await expectCode(
      loadLegacyLeaveExportFilterOptions(client, WORKSPACE_ID),
      'FILTER_OPTIONS_QUERY_FAILED'
    );
  });

  it('deduplicates and sorts filter options after a successful read', async () => {
    const { client } = createClient({
      enterprise_memberships: [{
        data: [
          { user_id: '2', team: 'Zeta', business_role: 'Developer' },
          { user_id: '1', team: 'Alpha', business_role: 'Developer' },
          { user_id: '3', team: 'Alpha', business_role: 'Architect' },
        ],
        error: null,
      }],
    });

    await expect(loadLegacyLeaveExportFilterOptions(client, WORKSPACE_ID)).resolves.toEqual({
      teams: ['Alpha', 'Zeta'],
      roles: ['Architect', 'Developer'],
    });
  });
});
