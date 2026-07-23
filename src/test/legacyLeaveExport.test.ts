import { describe, expect, it, vi } from 'vitest';
import { addDays, format } from 'date-fns';
import {
  executeLegacyLeaveExport,
  LegacyLeaveExportError,
  loadLegacyLeaveExportFilterOptions,
  type LegacyLeaveExportClient,
  type LegacyLeaveExportFormat,
  type LegacyLeaveExportLabels,
  type LegacyLeaveExportRequest,
} from '@/lib/legacyLeaveExport';
import { maxExportArtifactDataRows } from '@/lib/exportArtifactLimits';

interface PlannedResult {
  data: unknown[] | null;
  error: unknown;
  reject?: unknown;
  count?: number | null;
  finalCount?: number | null;
  finalError?: unknown;
  finalReject?: unknown;
  pageOverrides?: Record<number, PlannedResponseOverride>;
  inBatchOverrides?: Record<string, unknown[]>;
  rawInsertResult?: unknown;
}

interface PlannedResponseOverride {
  data?: unknown[] | null;
  error?: unknown;
  reject?: unknown;
  count?: number | null;
}

interface QueryOperation {
  table: string;
  method: string;
  args: unknown[];
}

function createClient(plans: Record<string, PlannedResult[]>) {
  const operations: QueryOperation[] = [];
  const events: string[] = [];
  const readCache = new Map<string, unknown[]>();
  const from = vi.fn((table: string) => {
    const result = plans[table]?.[0] ?? { data: [], error: null };
    const filters: Array<{ method: 'eq' | 'gte' | 'lte' | 'in'; column: string; value: unknown }> = [];
    const orders: Array<{ column: string; ascending: boolean }> = [];
    let selectOptions: { count?: 'exact'; head?: boolean } | undefined;
    let range: { from: number; to: number } | undefined;

    const hasOwn = (value: object, key: string) =>
      Object.prototype.hasOwnProperty.call(value, key);
    const applyFiltersAndOrder = (
      source: unknown[],
      bypassFilters = false
    ): unknown[] => {
      const filtered = bypassFilters ? source : source.filter((rawRow) => {
        if (typeof rawRow !== 'object' || rawRow === null) return true;
        const row = rawRow as Record<string, unknown>;
        return filters.every((filter) => {
          if (!(filter.column in row)) return true;
          const actual = row[filter.column];
          switch (filter.method) {
            case 'eq': return actual === filter.value;
            case 'gte': return String(actual) >= String(filter.value);
            case 'lte': return String(actual) <= String(filter.value);
            case 'in': return Array.isArray(filter.value) && filter.value.includes(actual);
          }
        });
      });
      return [...filtered].sort((left, right) => {
        if (
          typeof left !== 'object'
          || left === null
          || typeof right !== 'object'
          || right === null
        ) return 0;
        for (const order of orders) {
          const leftValue = (left as Record<string, unknown>)[order.column];
          const rightValue = (right as Record<string, unknown>)[order.column];
          const compared = String(leftValue ?? '').localeCompare(String(rightValue ?? ''));
          if (compared !== 0) return order.ascending ? compared : -compared;
        }
        return 0;
      });
    };
    const settleRead = () => {
      const inFilter = filters.find((filter) => filter.method === 'in');
      const inValues = Array.isArray(inFilter?.value) ? inFilter.value : [];
      const inBatchOverride = typeof inValues[0] === 'string'
        ? result.inBatchOverrides?.[inValues[0]]
        : undefined;
      const cacheKey = JSON.stringify({ table, filters, orders });
      let source: unknown[] | null;
      const sourceRows = inBatchOverride ?? result.data;
      if (Array.isArray(sourceRows)) {
        const cached = readCache.get(cacheKey);
        source = cached ?? applyFiltersAndOrder(sourceRows, inBatchOverride !== undefined);
        if (!cached) readCache.set(cacheKey, source);
      } else {
        source = sourceRows;
      }
      if (selectOptions?.head) {
        if (result.finalReject !== undefined) return Promise.reject(result.finalReject);
        if (result.reject !== undefined) return Promise.reject(result.reject);
        const count = hasOwn(result, 'finalCount')
          ? result.finalCount
          : Array.isArray(source) ? source.length : null;
        return Promise.resolve({
          data: null,
          error: hasOwn(result, 'finalError') ? result.finalError : result.error,
          count,
        });
      }

      const fromOffset = range?.from ?? 0;
      const override = result.pageOverrides?.[fromOffset];
      if (override?.reject !== undefined) return Promise.reject(override.reject);
      if (result.reject !== undefined) return Promise.reject(result.reject);
      const pageData = override && hasOwn(override, 'data')
        ? override.data
        : Array.isArray(source) && range
          ? source.slice(range.from, range.to + 1)
          : source;
      const count = override && hasOwn(override, 'count')
        ? override.count
        : hasOwn(result, 'count')
          ? result.count
          : Array.isArray(source) ? source.length : null;
      return Promise.resolve({
        data: pageData,
        error: override && hasOwn(override, 'error') ? override.error : result.error,
        ...(selectOptions?.count === 'exact' ? { count } : {}),
      });
    };
    const settleInsert = () => result.reject === undefined
      ? Promise.resolve(
        hasOwn(result, 'rawInsertResult') ? result.rawInsertResult : result
      )
      : Promise.reject(result.reject);
    const query = {
      select: (...args: unknown[]) => {
        operations.push({ table, method: 'select', args });
        selectOptions = args[1] as typeof selectOptions;
        return query;
      },
      eq: (...args: unknown[]) => {
        operations.push({ table, method: 'eq', args });
        filters.push({ method: 'eq', column: String(args[0]), value: args[1] });
        return query;
      },
      gte: (...args: unknown[]) => {
        operations.push({ table, method: 'gte', args });
        filters.push({ method: 'gte', column: String(args[0]), value: args[1] });
        return query;
      },
      lte: (...args: unknown[]) => {
        operations.push({ table, method: 'lte', args });
        filters.push({ method: 'lte', column: String(args[0]), value: args[1] });
        return query;
      },
      in: (...args: unknown[]) => {
        operations.push({ table, method: 'in', args });
        filters.push({ method: 'in', column: String(args[0]), value: args[1] });
        return query;
      },
      order: (...args: unknown[]) => {
        operations.push({ table, method: 'order', args });
        const options = args[1] as { ascending?: boolean } | undefined;
        orders.push({ column: String(args[0]), ascending: options?.ascending !== false });
        return query;
      },
      range: (...args: unknown[]) => {
        operations.push({ table, method: 'range', args });
        range = { from: Number(args[0]), to: Number(args[1]) };
        return query;
      },
      insert: (...args: unknown[]) => {
        operations.push({ table, method: 'insert', args });
        events.push('audit');
        return settleInsert();
      },
      then: <TResult1 = PlannedResult, TResult2 = never>(
        onfulfilled?: ((value: PlannedResult) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
      ) => settleRead().then(
        onfulfilled as ((value: Awaited<ReturnType<typeof settleRead>>) => TResult1 | PromiseLike<TResult1>) | null | undefined,
        onrejected
      ),
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
      data: [{ id: 'membership-1', user_id: MEMBER_ID, team: 'Engineering', business_role: 'Developer' }],
      error: null,
    }],
    enterprise_holidays: [{ data: [{ id: 'holiday-1', holiday_date: '2026-07-14', name: 'Holiday' }], error: null }],
    enterprise_company_leave_days: [{ data: [], error: null }],
    enterprise_audit_events: [{ data: null, error: null }],
  };
}

function paginatedSuccessfulPlans(rowCount = 501): Record<string, PlannedResult[]> {
  const suffixes = Array.from(
    { length: rowCount },
    (_, index) => String(index).padStart(4, '0')
  );
  return {
    leave_requests: [{
      data: suffixes.map((suffix) => ({
        id: `leave-${suffix}`,
        user_id: `user-${suffix}`,
        start_date: '2026-07-13',
        end_date: '2026-07-13',
        leave_type: 'vacation',
        status: 'approved',
        is_half_day: false,
        half_day_period: null,
        comment: '',
      })).reverse(),
      error: null,
    }],
    profiles: [{
      data: suffixes.map((suffix) => ({
        user_id: `user-${suffix}`,
        display_name: `Person ${suffix}`,
      })).reverse(),
      error: null,
    }],
    enterprise_memberships: [{
      data: suffixes.map((suffix) => ({
        id: `membership-${suffix}`,
        user_id: `user-${suffix}`,
        team: 'Engineering',
        business_role: 'Developer',
      })).reverse(),
      error: null,
    }],
    enterprise_holidays: [{ data: [], error: null }],
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

  it('matches the naive interval result and stable start-date/id order across mixed overlaps', async () => {
    const plans = successfulPlans();
    const baseLeave = plans.leave_requests[0].data?.[0] as Record<string, unknown>;
    plans.leave_requests[0].data = [
      { ...baseLeave, id: 'leave-z', start_date: '2026-07-13', end_date: '2026-07-15', comment: 'start13-z' },
      { ...baseLeave, id: 'leave-a', start_date: '2026-07-13', end_date: '2026-07-14', comment: 'start13-a' },
      { ...baseLeave, id: 'leave-b', start_date: '2026-07-14', end_date: '2026-07-15', comment: 'start14-b' },
      { ...baseLeave, id: 'leave-c', start_date: '2026-07-15', end_date: '2026-07-15', comment: 'start15-c' },
    ];
    const bounded = request();
    bounded.endDate = new Date(2026, 6, 15, 12);
    const { client } = createClient(plans);

    const result = await executeLegacyLeaveExport(client, bounded, labels, vi.fn());
    const dateAndComment = result.artifact.content
      .split('\r\n')
      .slice(1)
      .map((line) => {
        const cells = line.split(',');
        return [cells[0], cells[10]];
      });

    expect(dateAndComment).toEqual([
      ['2026-07-13', 'start13-a'],
      ['2026-07-13', 'start13-z'],
      ['2026-07-14', 'start13-a'],
      ['2026-07-14', 'start13-z'],
      ['2026-07-14', 'start14-b'],
      ['2026-07-15', 'start13-z'],
      ['2026-07-15', 'start14-b'],
      ['2026-07-15', 'start15-c'],
    ]);
  });

  it('does not fabricate a half-day period for compatible persisted null/mismatched shapes', async () => {
    const plans = successfulPlans();
    const baseLeave = plans.leave_requests[0].data?.[0] as Record<string, unknown>;
    plans.leave_requests[0].data = [
      { ...baseLeave, id: 'leave-null-period', is_half_day: true, half_day_period: null, comment: 'null-period' },
      { ...baseLeave, id: 'leave-flag-false', is_half_day: false, half_day_period: 'morning', comment: 'flag-false' },
    ];
    const { client } = createClient(plans);

    const result = await executeLegacyLeaveExport(client, request(), labels, vi.fn());
    const halfDayCells = result.artifact.content
      .split('\r\n')
      .slice(1)
      .map((line) => line.split(',')[7]);

    expect(halfDayCells).toEqual(['', '', '', '']);
    expect(result.artifact.content).not.toContain(labels.halfDayMorning);
    expect(result.artifact.content).not.toContain(labels.halfDayAfternoon);
  });

  it('loads every page and batches profile and membership enrichment by 200 user IDs', async () => {
    const { client, operations, events } = createClient(paginatedSuccessfulPlans());
    const download = vi.fn(() => events.push('download'));

    const result = await executeLegacyLeaveExport(client, request(), labels, download);

    expect(result.rowCount).toBe(502);
    expect(events).toEqual(['audit', 'download']);
    expect(result.artifact.content.indexOf('Person 0000')).toBeLessThan(
      result.artifact.content.indexOf('Person 0500')
    );
    expect(result.artifact.content).not.toContain('leave-0000');
    expect(result.artifact.content).not.toContain('user-0000');
    expect(result.artifact.content).not.toContain('membership-0000');

    const leaveRanges = operations.filter(
      (operation) => operation.table === 'leave_requests' && operation.method === 'range'
    );
    expect(leaveRanges.map((operation) => operation.args)).toEqual([
      [0, 499],
      [500, 500],
    ]);
    expect(operations).toContainEqual({
      table: 'leave_requests',
      method: 'select',
      args: ['id', { count: 'exact', head: true }],
    });

    const profileBatches = operations
      .filter((operation) => operation.table === 'profiles' && operation.method === 'in')
      .map((operation) => operation.args[1] as string[]);
    const membershipBatches = operations
      .filter(
        (operation) => operation.table === 'enterprise_memberships' && operation.method === 'in'
      )
      .map((operation) => operation.args[1] as string[]);
    expect(profileBatches.map((batch) => batch.length)).toEqual([200, 200, 101]);
    expect(membershipBatches.map((batch) => batch.length)).toEqual([200, 200, 101]);
    expect(profileBatches.flat()).toHaveLength(501);
    expect(new Set(profileBatches.flat()).size).toBe(501);
  });

  it('paginates the active-membership filter source and verifies its final count', async () => {
    const plans = paginatedSuccessfulPlans();
    const { client, operations } = createClient({
      enterprise_memberships: plans.enterprise_memberships,
    });

    await expect(loadLegacyLeaveExportFilterOptions(client, WORKSPACE_ID)).resolves.toEqual({
      teams: ['Engineering'],
      roles: ['Developer'],
    });

    expect(operations.filter(
      (operation) => operation.table === 'enterprise_memberships' && operation.method === 'range'
    ).map((operation) => operation.args)).toEqual([
      [0, 499],
      [500, 500],
    ]);
    expect(operations).toContainEqual({
      table: 'enterprise_memberships',
      method: 'select',
      args: ['id', { count: 'exact', head: true }],
    });
  });

  it.each([
    ['short second page', { pageOverrides: { 500: { data: [] } } }],
    ['changed final count', { finalCount: 502 }],
    ['failed second page', {
      pageOverrides: {
        500: { data: null, error: { message: 'SECRET provider detail' } },
      },
    }],
  ] as const)('blocks audit and download on a %s', async (_caseName, override) => {
    const plans = paginatedSuccessfulPlans();
    Object.assign(plans.leave_requests[0], override);
    const { client, operations } = createClient(plans);
    const download = vi.fn();

    await expectCode(
      executeLegacyLeaveExport(client, request(), labels, download),
      'LEAVE_QUERY_FAILED'
    );
    expect(operations.some((operation) => operation.table === 'enterprise_audit_events')).toBe(false);
    expect(download).not.toHaveBeenCalled();
  });

  it('rejects trim-equivalent profile user IDs that repeat across enrichment batches', async () => {
    const plans = paginatedSuccessfulPlans(201);
    plans.profiles[0].inBatchOverrides = {
      'user-0200': [{ user_id: ' user-0000 ', display_name: 'Duplicate' }],
    };
    const { client, operations } = createClient(plans);
    const download = vi.fn();

    await expectCode(
      executeLegacyLeaveExport(client, request(), labels, download),
      'PROFILE_QUERY_FAILED'
    );
    expect(operations.some((operation) => operation.table === 'enterprise_audit_events')).toBe(false);
    expect(download).not.toHaveBeenCalled();
  });

  it('enforces the global source-row cap across enrichment batches', async () => {
    const plans = paginatedSuccessfulPlans(201);
    plans.profiles[0].inBatchOverrides = {
      'user-0000': Array.from({ length: 100_000 }, (_, index) => ({
        user_id: `provider-user-${String(index).padStart(6, '0')}`,
        display_name: `Person ${index}`,
      })),
      'user-0200': [{
        user_id: 'provider-user-over-limit',
        display_name: 'Over limit',
      }],
    };
    const { client, operations } = createClient(plans);
    const download = vi.fn();

    await expectCode(
      executeLegacyLeaveExport(client, request(), labels, download),
      'PROFILE_QUERY_FAILED'
    );
    expect(operations.some((operation) => operation.table === 'enterprise_audit_events')).toBe(false);
    expect(download).not.toHaveBeenCalled();
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

  it.each([
    ['leave request missing user_id', 'LEAVE_QUERY_FAILED', (plans: Record<string, PlannedResult[]>) => {
      delete (plans.leave_requests[0].data?.[0] as Record<string, unknown>).user_id;
    }],
    ['leave request with an invalid calendar date', 'LEAVE_QUERY_FAILED', (plans: Record<string, PlannedResult[]>) => {
      (plans.leave_requests[0].data?.[0] as Record<string, unknown>).start_date = '2026-02-30';
    }],
    ['leave request with an invalid half-day period', 'LEAVE_QUERY_FAILED', (plans: Record<string, PlannedResult[]>) => {
      (plans.leave_requests[0].data?.[0] as Record<string, unknown>).half_day_period = 'evening';
    }],
    ['profile with a wrong-typed display name', 'PROFILE_QUERY_FAILED', (plans: Record<string, PlannedResult[]>) => {
      (plans.profiles[0].data?.[0] as Record<string, unknown>).display_name = 7;
    }],
    ['membership missing its team projection', 'MEMBERSHIP_QUERY_FAILED', (plans: Record<string, PlannedResult[]>) => {
      delete (plans.enterprise_memberships[0].data?.[0] as Record<string, unknown>).team;
    }],
    ['holiday with an invalid date', 'HOLIDAY_QUERY_FAILED', (plans: Record<string, PlannedResult[]>) => {
      (plans.enterprise_holidays[0].data?.[0] as Record<string, unknown>).holiday_date = '2026-07-13x';
    }],
    ['company day missing its name projection', 'COMPANY_DAY_QUERY_FAILED', (plans: Record<string, PlannedResult[]>) => {
      plans.enterprise_company_leave_days[0].data = [{
        id: 'company-day-1',
        leave_date: '2026-07-13',
      }];
    }],
  ] as const)('rejects a malformed provider row: %s', async (_name, code, mutate) => {
    const plans = successfulPlans();
    mutate(plans);
    const { client, operations } = createClient(plans);
    const download = vi.fn();

    await expectCode(executeLegacyLeaveExport(client, request(), labels, download), code);
    expect(operations.some((operation) => operation.table === 'enterprise_audit_events')).toBe(false);
    expect(download).not.toHaveBeenCalled();
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

  it.each([
    ['missing error field', {} as PlannedResult],
    ['undefined error field', { data: null, error: undefined }],
    ['false error field', { data: null, error: false }],
    ['null response envelope', { data: null, error: null, rawInsertResult: null }],
  ] as const)('rejects a malformed audit response with %s before download', async (_caseName, auditResult) => {
    const plans = successfulPlans();
    plans.enterprise_audit_events[0] = auditResult as PlannedResult;
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

  it('rejects an unknown runtime format before any read or download', async () => {
    const { client, operations } = createClient({});
    const invalid = request();
    invalid.format = 'xlsx' as LegacyLeaveExportFormat;
    const download = vi.fn();

    await expectCode(
      executeLegacyLeaveExport(client, invalid, labels, download),
      'UNSUPPORTED_FORMAT',
    );
    expect(operations).toHaveLength(0);
    expect(download).not.toHaveBeenCalled();
  });

  it('rejects a zero-source date range beyond the artifact budget before any read', async () => {
    const { client, operations } = createClient({});
    const oversized = request('xls');
    oversized.startDate = new Date(2026, 0, 1, 12);
    oversized.endDate = addDays(
      oversized.startDate,
      maxExportArtifactDataRows('xls'),
    );
    const download = vi.fn();

    await expectCode(
      executeLegacyLeaveExport(client, oversized, labels, download),
      'ARTIFACT_ROW_LIMIT_EXCEEDED',
    );
    expect(operations).toHaveLength(0);
    expect(download).not.toHaveBeenCalled();
  });

  it('rejects overlapping leave expansion beyond the XLS budget before audit', async () => {
    const maxRows = maxExportArtifactDataRows('xls');
    const overlapDays = Math.floor(maxRows / 2) + 1;
    const bounded = request('xls');
    bounded.startDate = new Date(2026, 0, 1, 12);
    bounded.endDate = addDays(bounded.startDate, overlapDays - 1);
    const startDate = format(bounded.startDate, 'yyyy-MM-dd');
    const endDate = format(bounded.endDate, 'yyyy-MM-dd');
    const plans = successfulPlans();
    const baseLeave = plans.leave_requests[0].data?.[0] as Record<string, unknown>;
    plans.leave_requests[0].data = [
      { ...baseLeave, id: 'leave-1', start_date: startDate, end_date: endDate },
      { ...baseLeave, id: 'leave-2', start_date: startDate, end_date: endDate },
    ];
    const { client, operations } = createClient(plans);
    const download = vi.fn();

    await expectCode(
      executeLegacyLeaveExport(client, bounded, labels, download),
      'ARTIFACT_ROW_LIMIT_EXCEEDED',
    );
    expect(operations.some((operation) => operation.table === 'enterprise_audit_events')).toBe(false);
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
          { id: 'membership-2', user_id: '2', team: 'Zeta', business_role: 'Developer' },
          { id: 'membership-1', user_id: '1', team: 'Alpha', business_role: 'Developer' },
          { id: 'membership-3', user_id: '3', team: 'Alpha', business_role: 'Architect' },
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
