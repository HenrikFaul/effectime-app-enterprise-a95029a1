import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EntityConfig } from '@/components/enterprise/import-export/config/entity-registry';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: mocks.rpc,
    from: mocks.from,
  },
}));

import {
  ENTITY_DATA_FETCH_ERROR_MESSAGE,
  EntityDataFetchError,
  fetchEntityRows,
  type EntityDataFetchErrorCode,
} from '@/components/enterprise/import-export/utils/data-fetcher';

const WORKSPACE_ID = 'workspace-1';
const MALICIOUS_PROVIDER_DETAIL = '<script>steal()</script> relation enterprise_secret missing';

function entity(key: string): EntityConfig {
  return { key } as EntityConfig;
}

interface QueryOptions {
  count?: 'exact';
  head?: boolean;
}

interface QueryInvocation {
  kind: 'rpc' | 'table';
  name: string;
  params?: Record<string, unknown>;
  rpcOptions?: QueryOptions;
  select?: { columns: string; options?: QueryOptions };
  filters: Array<{ column: string; value: string }>;
  orders: Array<{
    column: string;
    options?: { ascending?: boolean; nullsFirst?: boolean };
  }>;
  range?: { from: number; to: number };
}

interface SourceFixture {
  rows?: unknown[];
  initialCount?: number | null;
  finalCount?: number | null;
  error?: unknown;
  envelope?: unknown;
  reject?: unknown;
  pageRows?: (rows: unknown[], from: number, to: number) => unknown[];
}

const sourceFixtures = new Map<string, SourceFixture>();
const invocations: QueryInvocation[] = [];

function sourceKey(kind: QueryInvocation['kind'], name: string): string {
  return `${kind}:${name}`;
}

function setRpc(name: string, fixture: SourceFixture): void {
  sourceFixtures.set(sourceKey('rpc', name), fixture);
}

function setTable(name: string, fixture: SourceFixture): void {
  sourceFixtures.set(sourceKey('table', name), fixture);
}

function sourceCalls(kind: QueryInvocation['kind'], name: string): QueryInvocation[] {
  return invocations.filter((invocation) => invocation.kind === kind && invocation.name === name);
}

function executeQuery(invocation: QueryInvocation): unknown {
  const fixture = sourceFixtures.get(sourceKey(invocation.kind, invocation.name));
  if (!fixture) throw new Error(`Missing test fixture for ${invocation.kind}:${invocation.name}`);
  if (fixture.reject !== undefined) throw fixture.reject;
  if (Object.prototype.hasOwnProperty.call(fixture, 'envelope')) return fixture.envelope;

  const head = invocation.rpcOptions?.head === true || invocation.select?.options?.head === true;
  const countRequested = invocation.rpcOptions?.count === 'exact'
    || invocation.select?.options?.count === 'exact';
  const rpcFinalCountProbe = invocation.kind === 'rpc'
    && countRequested
    && invocation.range?.from === 0
    && invocation.range.to === 0;

  if (fixture.error !== undefined) {
    return { data: null, error: fixture.error, count: null };
  }

  const rows = fixture.rows ?? [];
  if (head || rpcFinalCountProbe) {
    return {
      data: head ? null : rows.slice(0, 1),
      error: null,
      count: fixture.finalCount === undefined ? rows.length : fixture.finalCount,
    };
  }

  const { from = 0, to = rows.length - 1 } = invocation.range ?? {};
  const page = fixture.pageRows
    ? fixture.pageRows(rows, from, to)
    : rows.slice(from, to + 1);
  return {
    data: page,
    error: null,
    count: countRequested
      ? (fixture.initialCount === undefined ? rows.length : fixture.initialCount)
      : null,
  };
}

function createBuilder(invocation: QueryInvocation) {
  invocations.push(invocation);
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
    then: <TResult1 = unknown, TResult2 = never>(
      onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) => Promise.resolve()
      .then(() => executeQuery(invocation))
      .then(onfulfilled, onrejected),
  };

  builder.select.mockImplementation((columns: string, options?: QueryOptions) => {
    invocation.select = { columns, options };
    return builder;
  });
  builder.eq.mockImplementation((column: string, value: string) => {
    invocation.filters.push({ column, value });
    return builder;
  });
  builder.order.mockImplementation((
    column: string,
    options?: { ascending?: boolean; nullsFirst?: boolean },
  ) => {
    invocation.orders.push({ column, options });
    return builder;
  });
  builder.range.mockImplementation((from: number, to: number) => {
    invocation.range = { from, to };
    return builder;
  });
  return builder;
}

function memberRow(
  index: number,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    membership_id: `membership-${String(index).padStart(4, '0')}`,
    user_id: `user-${index}`,
    email: `member-${index}@example.com`,
    display_name: `Member ${index}`,
    role: 'member',
    status: 'active',
    team: null,
    business_role: null,
    office_name: null,
    org_unit_name: null,
    city: null,
    location: null,
    base_working_hours: null,
    weekly_capacity_hours: null,
    joined_at: null,
    manager_email: null,
    subordinate_emails: null,
    seniority: null,
    leadership_level: null,
    leadership_category: null,
    contract_type: null,
    employer_rights: false,
    skills: null,
    ...overrides,
  };
}

function memberRows(count: number): Array<Record<string, unknown>> {
  return Array.from({ length: count }, (_, index) => memberRow(index));
}

function leaveRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    email: 'ada@example.com',
    display_name: 'Ada',
    team: null,
    start_date: '2026-08-01',
    end_date: '2026-08-02',
    leave_type: 'vacation',
    status: 'approved',
    is_half_day: false,
    half_day_period: null,
    comment: null,
    ...overrides,
  };
}

function officeRows(count: number): Array<Record<string, unknown>> {
  return Array.from({ length: count }, (_, index) => ({
    id: `office-${String(index).padStart(4, '0')}`,
    name: `Office ${String(index).padStart(4, '0')}`,
    city: `City ${index}`,
    address: `${index} Main Street`,
  }));
}

async function expectSafeFailure(
  request: Promise<unknown>,
  code: EntityDataFetchErrorCode
): Promise<void> {
  try {
    await request;
    throw new Error('Expected entity data fetch to fail');
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(EntityDataFetchError);
    expect(error).toMatchObject({
      name: 'EntityDataFetchError',
      message: ENTITY_DATA_FETCH_ERROR_MESSAGE,
      code,
    });
    expect(String(error)).not.toContain(MALICIOUS_PROVIDER_DETAIL);
  }
}

describe('fetchEntityRows complete-data safety boundary', () => {
  beforeEach(() => {
    sourceFixtures.clear();
    invocations.length = 0;
    mocks.rpc.mockReset().mockImplementation((
      name: string,
      params: Record<string, unknown>,
      options?: QueryOptions,
    ) => createBuilder({
      kind: 'rpc',
      name,
      params,
      rpcOptions: options,
      filters: [],
      orders: [],
    }));
    mocks.from.mockReset().mockImplementation((name: string) => createBuilder({
      kind: 'table',
      name,
      filters: [],
      orders: [],
    }));
  });

  it.each([
    ['members', 'MEMBERS_QUERY_FAILED', 'get_workspace_members_for_export'],
    ['leave', 'LEAVE_QUERY_FAILED', 'get_workspace_leave_for_export'],
  ] as const)(
    'sanitizes a failed %s RPC',
    async (entityKey, expectedCode, rpcName) => {
      setRpc(rpcName, { error: { message: MALICIOUS_PROVIDER_DETAIL } });

      await expectSafeFailure(fetchEntityRows(entity(entityKey), WORKSPACE_ID), expectedCode);
      expect(mocks.rpc).toHaveBeenCalledWith(rpcName, expect.objectContaining({
        p_workspace_id: WORKSPACE_ID,
      }), { count: 'exact' });
    }
  );

  it.each([
    ['members', 'MEMBERS_QUERY_FAILED', 'rpc', 'get_workspace_members_for_export'],
    ['leave', 'LEAVE_QUERY_FAILED', 'rpc', 'get_workspace_leave_for_export'],
    ['offices', 'OFFICES_QUERY_FAILED', 'table', 'enterprise_offices'],
    ['work_categories', 'WORK_CATEGORIES_QUERY_FAILED', 'table', 'enterprise_workspace_role_categories'],
    ['job_roles', 'JOB_ROLES_QUERY_FAILED', 'table', 'enterprise_workspace_roles'],
    ['positions', 'POSITIONS_QUERY_FAILED', 'table', 'enterprise_memberships'],
    ['skills', 'SKILLS_QUERY_FAILED', 'table', 'enterprise_skills'],
  ] as const)(
    'rejects a successful-but-null %s response instead of auditing an empty export',
    async (entityKey, expectedCode, source, name) => {
      const fixture = { envelope: { data: null, error: null, count: 0 } };
      if (source === 'rpc') setRpc(name, fixture);
      else setTable(name, fixture);

      await expectSafeFailure(fetchEntityRows(entity(entityKey), WORKSPACE_ID), expectedCode);
    },
  );

  it('sanitizes malformed and rejected query envelopes', async () => {
    setRpc('get_workspace_members_for_export', { envelope: { error: null } });
    await expectSafeFailure(
      fetchEntityRows(entity('members'), WORKSPACE_ID),
      'MEMBERS_QUERY_FAILED',
    );

    setTable('enterprise_offices', { reject: new Error(MALICIOUS_PROVIDER_DETAIL) });
    await expectSafeFailure(
      fetchEntityRows(entity('offices'), WORKSPACE_ID),
      'OFFICES_QUERY_FAILED',
    );

    mocks.from.mockImplementationOnce(() => {
      throw new Error(MALICIOUS_PROVIDER_DETAIL);
    });
    await expectSafeFailure(
      fetchEntityRows(entity('skills'), WORKSPACE_ID),
      'SKILLS_QUERY_FAILED',
    );
  });

  it('rejects missing, wrong-typed, and semantically invalid provider row fields', async () => {
    const missingEmail = memberRow(1);
    delete missingEmail.email;
    setRpc('get_workspace_members_for_export', { rows: [missingEmail] });
    await expectSafeFailure(
      fetchEntityRows(entity('members'), WORKSPACE_ID),
      'MEMBERS_QUERY_FAILED',
    );

    sourceFixtures.clear();
    invocations.length = 0;
    setRpc('get_workspace_leave_for_export', {
      rows: [leaveRow({ is_half_day: 'false' })],
    });
    await expectSafeFailure(
      fetchEntityRows(entity('leave'), WORKSPACE_ID),
      'LEAVE_QUERY_FAILED',
    );

    sourceFixtures.clear();
    invocations.length = 0;
    setRpc('get_workspace_leave_for_export', {
      rows: [leaveRow({ start_date: '2026-02-30' })],
    });
    await expectSafeFailure(
      fetchEntityRows(entity('leave'), WORKSPACE_ID),
      'LEAVE_QUERY_FAILED',
    );

    sourceFixtures.clear();
    invocations.length = 0;
    setRpc('get_workspace_leave_for_export', {
      rows: [leaveRow({ is_half_day: true, half_day_period: 'evening' })],
    });
    await expectSafeFailure(
      fetchEntityRows(entity('leave'), WORKSPACE_ID),
      'LEAVE_QUERY_FAILED',
    );

    for (const invalidMember of [
      memberRow(1, { role: null }),
      memberRow(1, { status: null }),
      memberRow(1, { employer_rights: null }),
    ]) {
      sourceFixtures.clear();
      invocations.length = 0;
      setRpc('get_workspace_members_for_export', { rows: [invalidMember] });
      await expectSafeFailure(
        fetchEntityRows(entity('members'), WORKSPACE_ID),
        'MEMBERS_QUERY_FAILED',
      );
    }

    sourceFixtures.clear();
    invocations.length = 0;
    setRpc('get_workspace_members_for_export', {
      rows: [memberRow(1, { joined_at: 'not-a-timestamp' })],
    });
    await expectSafeFailure(
      fetchEntityRows(entity('members'), WORKSPACE_ID),
      'MEMBERS_QUERY_FAILED',
    );

    sourceFixtures.clear();
    invocations.length = 0;
    setTable('enterprise_offices', {
      rows: [{ id: 'office-1', name: 'HQ', city: 7, address: null }],
    });
    await expectSafeFailure(
      fetchEntityRows(entity('offices'), WORKSPACE_ID),
      'OFFICES_QUERY_FAILED',
    );

    sourceFixtures.clear();
    invocations.length = 0;
    setTable('enterprise_offices', {
      rows: [{ id: 'office-1', name: null, city: null, address: null }],
    });
    await expectSafeFailure(
      fetchEntityRows(entity('offices'), WORKSPACE_ID),
      'OFFICES_QUERY_FAILED',
    );
  });

  it.each([
    ['offices', 'enterprise_offices', 'OFFICES_QUERY_FAILED'],
    ['work_categories', 'enterprise_workspace_role_categories', 'WORK_CATEGORIES_QUERY_FAILED'],
    ['job_roles', 'enterprise_workspace_roles', 'JOB_ROLES_QUERY_FAILED'],
    ['positions', 'enterprise_memberships', 'POSITIONS_QUERY_FAILED'],
    ['skills', 'enterprise_skills', 'SKILLS_QUERY_FAILED'],
  ] as const)(
    'sanitizes a failed %s table query',
    async (entityKey, table, expectedCode) => {
      setTable(table, { error: { message: MALICIOUS_PROVIDER_DETAIL } });

      await expectSafeFailure(fetchEntityRows(entity(entityKey), WORKSPACE_ID), expectedCode);
      expect(mocks.from).toHaveBeenCalledWith(table);
    }
  );

  it('fails closed when the secondary job-role category lookup fails or returns null data', async () => {
    setTable('enterprise_workspace_roles', {
      rows: [{ id: 'role-1', name: 'Engineer', is_active: true, category_id: 'category-1' }],
    });
    setTable('enterprise_workspace_role_categories', {
      error: { message: MALICIOUS_PROVIDER_DETAIL },
    });

    await expectSafeFailure(
      fetchEntityRows(entity('job_roles'), WORKSPACE_ID),
      'JOB_ROLE_CATEGORIES_QUERY_FAILED'
    );

    sourceFixtures.clear();
    invocations.length = 0;
    setTable('enterprise_workspace_roles', {
      rows: [{ id: 'role-1', name: 'Engineer', is_active: true, category_id: 'category-1' }],
    });
    setTable('enterprise_workspace_role_categories', {
      envelope: { data: null, error: null, count: 0 },
    });
    await expectSafeFailure(
      fetchEntityRows(entity('job_roles'), WORKSPACE_ID),
      'JOB_ROLE_CATEGORIES_QUERY_FAILED',
    );
  });

  it('preserves a legitimate empty result set without issuing a final count query', async () => {
    setRpc('get_workspace_members_for_export', { rows: [] });

    await expect(fetchEntityRows(entity('members'), WORKSPACE_ID)).resolves.toEqual([]);
    const calls = sourceCalls('rpc', 'get_workspace_members_for_export');
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      rpcOptions: { count: 'exact' },
      range: { from: 0, to: 499 },
    });
  });

  it('rejects an unsupported entity instead of reporting an empty successful export', async () => {
    await expectSafeFailure(
      fetchEntityRows(entity('future_entity'), WORKSPACE_ID),
      'UNSUPPORTED_ENTITY'
    );
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('preserves member export field normalization', async () => {
    setRpc('get_workspace_members_for_export', {
      rows: [memberRow(1, {
        membership_id: 'membership-1',
        user_id: 'user-1',
        email: 'ada@example.com',
        display_name: 'Ada',
        role: 'member',
        employer_rights: true,
        joined_at: '2026-07-21T08:30:00Z',
        weekly_capacity_hours: 40,
      })],
    });

    await expect(fetchEntityRows(entity('members'), WORKSPACE_ID)).resolves.toEqual([{
      email: 'ada@example.com',
      display_name: 'Ada',
      role: 'member',
      status: 'active',
      team: '',
      business_role: '',
      office_name: '',
      org_unit_name: '',
      city: '',
      location: '',
      base_working_hours: '',
      weekly_capacity_hours: '40',
      joined_at: '2026-07-21',
      manager_email: '',
      subordinate_emails: '',
      seniority: '',
      leadership_level: '',
      leadership_category: '',
      contract_type: '',
      employer_rights: 'true',
      skills: '',
      membership_id: 'membership-1',
      user_id: 'user-1',
    }]);
  });

  it('preserves persisted half-day enum/null compatibility without inventing a relationship', async () => {
    setRpc('get_workspace_leave_for_export', {
      rows: [
        leaveRow({ is_half_day: true, half_day_period: null }),
        leaveRow({
          email: 'second@example.com',
          is_half_day: false,
          half_day_period: 'morning',
        }),
      ],
    });

    await expect(fetchEntityRows(entity('leave'), WORKSPACE_ID)).resolves.toEqual([
      expect.objectContaining({
        email: 'ada@example.com',
        is_half_day: 'true',
        half_day_period: '',
      }),
      expect.objectContaining({
        email: 'second@example.com',
        is_half_day: 'false',
        half_day_period: 'morning',
      }),
    ]);
  });

  it('paginates a 501-row RPC with exact first and POST-probe final counts', async () => {
    setRpc('get_workspace_members_for_export', { rows: memberRows(501) });

    const rows = await fetchEntityRows(entity('members'), WORKSPACE_ID);

    expect(rows).toHaveLength(501);
    expect(rows[500]).toMatchObject({
      membership_id: 'membership-0500',
      email: 'member-500@example.com',
    });
    const calls = sourceCalls('rpc', 'get_workspace_members_for_export');
    expect(calls).toHaveLength(3);
    expect(calls.map((call) => ({ options: call.rpcOptions, range: call.range }))).toEqual([
      { options: { count: 'exact' }, range: { from: 0, to: 499 } },
      { options: undefined, range: { from: 500, to: 500 } },
      { options: { count: 'exact' }, range: { from: 0, to: 0 } },
    ]);
    expect(calls.every((call) => call.rpcOptions?.head !== true)).toBe(true);
    expect(calls.slice(0, 2).map((call) => call.orders)).toEqual([
      [{ column: 'membership_id', options: { ascending: true } }],
      [{ column: 'membership_id', options: { ascending: true } }],
    ]);
  });

  it('paginates a 501-row table with exact select/count/head and stable name/id ordering', async () => {
    setTable('enterprise_offices', { rows: officeRows(501) });

    const rows = await fetchEntityRows(entity('offices'), WORKSPACE_ID);

    expect(rows).toHaveLength(501);
    expect(rows[500]).toEqual({
      name: 'Office 0500',
      city: 'City 500',
      address: '500 Main Street',
      office_id: 'office-0500',
    });
    const calls = sourceCalls('table', 'enterprise_offices');
    expect(calls).toHaveLength(3);
    expect(calls.map((call) => ({ select: call.select, range: call.range }))).toEqual([
      {
        select: { columns: 'id, name, city, address', options: { count: 'exact' } },
        range: { from: 0, to: 499 },
      },
      {
        select: { columns: 'id, name, city, address', options: undefined },
        range: { from: 500, to: 500 },
      },
      {
        select: { columns: 'id', options: { count: 'exact', head: true } },
        range: undefined,
      },
    ]);
    expect(calls.slice(0, 2).map((call) => call.orders)).toEqual([
      [
        { column: 'name', options: { ascending: true, nullsFirst: false } },
        { column: 'id', options: { ascending: true } },
      ],
      [
        { column: 'name', options: { ascending: true, nullsFirst: false } },
        { column: 'id', options: { ascending: true } },
      ],
    ]);
    for (const call of calls) {
      expect(call.filters).toEqual([
        { column: 'workspace_id', value: WORKSPACE_ID },
      ]);
    }
  });

  it('uses the full explicit nulls-last tuple for leave pagination', async () => {
    setRpc('get_workspace_leave_for_export', {
      rows: [leaveRow()],
    });

    const rows = await fetchEntityRows(entity('leave'), WORKSPACE_ID, {
      startDate: '2026-08-01',
      endDate: '2026-08-31',
      statusFilter: 'approved',
    });

    const [call] = sourceCalls('rpc', 'get_workspace_leave_for_export');
    expect(call.params).toEqual({
      p_workspace_id: WORKSPACE_ID,
      p_start_date: '2026-08-01',
      p_end_date: '2026-08-31',
      p_status: 'approved',
    });
    const orderedColumns = [
      'start_date',
      'end_date',
      'email',
      'leave_type',
      'status',
      'is_half_day',
      'half_day_period',
      'comment',
      'display_name',
      'team',
    ];
    expect(call.orders).toEqual(orderedColumns.map((column) => ({
      column,
      options: { ascending: true, nullsFirst: false },
    })));
    expect(new Set(orderedColumns)).toEqual(new Set(Object.keys(rows[0])));
  });

  it('paginates job roles and their categories before joining them', async () => {
    const categories = Array.from({ length: 501 }, (_, index) => ({
      id: `category-${String(index).padStart(4, '0')}`,
      name: `Category ${index}`,
    }));
    const roles = Array.from({ length: 501 }, (_, index) => ({
      id: `role-${String(index).padStart(4, '0')}`,
      name: `Role ${String(index).padStart(4, '0')}`,
      is_active: index % 2 === 0,
      category_id: categories[index].id,
    }));
    setTable('enterprise_workspace_roles', { rows: roles });
    setTable('enterprise_workspace_role_categories', { rows: categories });

    const rows = await fetchEntityRows(entity('job_roles'), WORKSPACE_ID);

    expect(rows).toHaveLength(501);
    expect(rows[500]).toEqual({
      name: 'Role 0500',
      category_name: 'Category 500',
      is_active: 'true',
      role_id: 'role-0500',
    });
    expect(sourceCalls('table', 'enterprise_workspace_roles')).toHaveLength(3);
    const categoryCalls = sourceCalls('table', 'enterprise_workspace_role_categories');
    expect(categoryCalls).toHaveLength(3);
    expect(categoryCalls.slice(0, 2).map((call) => call.orders)).toEqual([
      [{ column: 'id', options: { ascending: true } }],
      [{ column: 'id', options: { ascending: true } }],
    ]);
  });

  it('paginates and aggregates 1001 position rows without leaking internal IDs', async () => {
    const rows = Array.from({ length: 1001 }, (_, index) => ({
      id: `membership-${String(index).padStart(4, '0')}`,
      business_role: index < 600 ? 'Engineer' : index < 1000 ? 'Designer' : null,
    }));
    setTable('enterprise_memberships', { rows });

    await expect(fetchEntityRows(entity('positions'), WORKSPACE_ID)).resolves.toEqual([
      { name: 'Designer', member_count: '400' },
      { name: 'Engineer', member_count: '600' },
    ]);
    const calls = sourceCalls('table', 'enterprise_memberships');
    expect(calls.map((call) => call.range)).toEqual([
      { from: 0, to: 499 },
      { from: 500, to: 999 },
      { from: 1000, to: 1000 },
      undefined,
    ]);
    expect(calls[0].select?.columns).toBe('id, business_role');
    expect(calls[0].orders).toEqual([
      { column: 'business_role', options: { ascending: true, nullsFirst: false } },
      { column: 'id', options: { ascending: true } },
    ]);
  });

  it('maps an incomplete page and a changed final count to stable entity-specific errors', async () => {
    setTable('enterprise_offices', {
      rows: officeRows(501),
      pageRows: (rows, from, to) => from === 500 ? [] : rows.slice(from, to + 1),
    });
    await expectSafeFailure(
      fetchEntityRows(entity('offices'), WORKSPACE_ID),
      'OFFICES_QUERY_FAILED',
    );

    sourceFixtures.clear();
    invocations.length = 0;
    setRpc('get_workspace_members_for_export', {
      rows: memberRows(501),
      finalCount: 500,
    });
    await expectSafeFailure(
      fetchEntityRows(entity('members'), WORKSPACE_ID),
      'MEMBERS_QUERY_FAILED',
    );
  });

  it('fails closed on duplicate or blank stable identities', async () => {
    setRpc('get_workspace_members_for_export', {
      rows: [
        memberRow(1, { membership_id: 'membership-1', email: 'one@example.com' }),
        memberRow(2, { membership_id: 'membership-1', email: 'two@example.com' }),
      ],
    });
    await expectSafeFailure(
      fetchEntityRows(entity('members'), WORKSPACE_ID),
      'MEMBERS_QUERY_FAILED',
    );

    sourceFixtures.clear();
    invocations.length = 0;
    setTable('enterprise_skills', {
      rows: [{ id: '', name: 'TypeScript', category: null, color: '#3178c6' }],
    });
    await expectSafeFailure(
      fetchEntityRows(entity('skills'), WORKSPACE_ID),
      'SKILLS_QUERY_FAILED',
    );
  });

  it('preserves category joins and position aggregation for a single page', async () => {
    setTable('enterprise_workspace_roles', {
      rows: [{ id: 'role-1', name: 'Engineer', is_active: true, category_id: 'category-1' }],
    });
    setTable('enterprise_workspace_role_categories', {
      rows: [{ id: 'category-1', name: 'Engineering' }],
    });

    await expect(fetchEntityRows(entity('job_roles'), WORKSPACE_ID)).resolves.toEqual([{
      name: 'Engineer',
      category_name: 'Engineering',
      is_active: 'true',
      role_id: 'role-1',
    }]);

    sourceFixtures.clear();
    invocations.length = 0;
    setTable('enterprise_memberships', {
      rows: [
        { id: 'membership-1', business_role: 'Designer' },
        { id: 'membership-2', business_role: 'Engineer' },
        { id: 'membership-3', business_role: 'Engineer' },
        { id: 'membership-4', business_role: '' },
      ],
    });

    await expect(fetchEntityRows(entity('positions'), WORKSPACE_ID)).resolves.toEqual([
      { name: 'Designer', member_count: '1' },
      { name: 'Engineer', member_count: '2' },
    ]);
  });
});
