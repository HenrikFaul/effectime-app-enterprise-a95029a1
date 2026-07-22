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

interface QueryResult {
  data: unknown[] | null;
  error: unknown;
}

function query(result: QueryResult | PromiseLike<QueryResult>) {
  const promise = Promise.resolve(result);
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    then: promise.then.bind(promise),
  };

  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.order.mockReturnValue(promise);
  return builder;
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

describe('fetchEntityRows data safety boundary', () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
    mocks.from.mockReset();
  });

  it.each([
    ['members', 'MEMBERS_QUERY_FAILED', 'get_workspace_members_for_export'],
    ['leave', 'LEAVE_QUERY_FAILED', 'get_workspace_leave_for_export'],
  ] as const)(
    'sanitizes a failed %s RPC',
    async (entityKey, expectedCode, rpcName) => {
      mocks.rpc.mockResolvedValue({
        data: null,
        error: { message: MALICIOUS_PROVIDER_DETAIL },
      });

      await expectSafeFailure(fetchEntityRows(entity(entityKey), WORKSPACE_ID), expectedCode);
      expect(mocks.rpc).toHaveBeenCalledWith(rpcName, expect.objectContaining({
        p_workspace_id: WORKSPACE_ID,
      }));
    }
  );

  it.each([
    ['members', 'MEMBERS_QUERY_FAILED', 'rpc'],
    ['leave', 'LEAVE_QUERY_FAILED', 'rpc'],
    ['offices', 'OFFICES_QUERY_FAILED', 'table'],
    ['work_categories', 'WORK_CATEGORIES_QUERY_FAILED', 'table'],
    ['job_roles', 'JOB_ROLES_QUERY_FAILED', 'table'],
    ['positions', 'POSITIONS_QUERY_FAILED', 'table'],
    ['skills', 'SKILLS_QUERY_FAILED', 'table'],
  ] as const)(
    'rejects a successful-but-null %s response instead of auditing an empty export',
    async (entityKey, expectedCode, source) => {
      const result = { data: null, error: null };
      if (source === 'rpc') mocks.rpc.mockResolvedValue(result);
      else mocks.from.mockReturnValue(query(result));

      await expectSafeFailure(fetchEntityRows(entity(entityKey), WORKSPACE_ID), expectedCode);
    },
  );

  it('sanitizes malformed and rejected query envelopes', async () => {
    mocks.rpc.mockResolvedValue({ error: null });
    await expectSafeFailure(
      fetchEntityRows(entity('members'), WORKSPACE_ID),
      'MEMBERS_QUERY_FAILED',
    );

    mocks.from.mockReturnValue(query(Promise.reject(new Error(MALICIOUS_PROVIDER_DETAIL))));
    await expectSafeFailure(
      fetchEntityRows(entity('offices'), WORKSPACE_ID),
      'OFFICES_QUERY_FAILED',
    );

    mocks.from.mockImplementation(() => {
      throw new Error(MALICIOUS_PROVIDER_DETAIL);
    });
    await expectSafeFailure(
      fetchEntityRows(entity('skills'), WORKSPACE_ID),
      'SKILLS_QUERY_FAILED',
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
      mocks.from.mockImplementation((requestedTable: string) => {
        expect(requestedTable).toBe(table);
        return query({
          data: null,
          error: { message: MALICIOUS_PROVIDER_DETAIL },
        });
      });

      await expectSafeFailure(fetchEntityRows(entity(entityKey), WORKSPACE_ID), expectedCode);
    }
  );

  it('fails closed when the secondary job-role category lookup fails', async () => {
    const roleQuery = query({
      data: [{ id: 'role-1', name: 'Engineer', is_active: true, category_id: 'category-1' }],
      error: null,
    });
    const categoryQuery = query({
      data: null,
      error: { message: MALICIOUS_PROVIDER_DETAIL },
    });
    mocks.from
      .mockReturnValueOnce(roleQuery)
      .mockReturnValueOnce(categoryQuery);

    await expectSafeFailure(
      fetchEntityRows(entity('job_roles'), WORKSPACE_ID),
      'JOB_ROLE_CATEGORIES_QUERY_FAILED'
    );
    expect(mocks.from).toHaveBeenNthCalledWith(1, 'enterprise_workspace_roles');
    expect(mocks.from).toHaveBeenNthCalledWith(2, 'enterprise_workspace_role_categories');
  });

  it('fails closed when the secondary job-role category lookup returns null data', async () => {
    mocks.from
      .mockReturnValueOnce(query({
        data: [{ id: 'role-1', name: 'Engineer', is_active: true, category_id: 'category-1' }],
        error: null,
      }))
      .mockReturnValueOnce(query({ data: null, error: null }));

    await expectSafeFailure(
      fetchEntityRows(entity('job_roles'), WORKSPACE_ID),
      'JOB_ROLE_CATEGORIES_QUERY_FAILED',
    );
  });

  it('preserves a legitimate empty result set', async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });

    await expect(fetchEntityRows(entity('members'), WORKSPACE_ID)).resolves.toEqual([]);
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
    mocks.rpc.mockResolvedValue({
      data: [{
        email: 'ada@example.com',
        display_name: 'Ada',
        role: null,
        employer_rights: true,
        joined_at: '2026-07-21T08:30:00Z',
        weekly_capacity_hours: 40,
      }],
      error: null,
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
      membership_id: '',
      user_id: '',
    }]);
  });

  it('preserves category joins and position aggregation', async () => {
    const roleQuery = query({
      data: [{ id: 'role-1', name: 'Engineer', is_active: true, category_id: 'category-1' }],
      error: null,
    });
    const categoryQuery = query({
      data: [{ id: 'category-1', name: 'Engineering' }],
      error: null,
    });
    mocks.from
      .mockReturnValueOnce(roleQuery)
      .mockReturnValueOnce(categoryQuery);

    await expect(fetchEntityRows(entity('job_roles'), WORKSPACE_ID)).resolves.toEqual([{
      name: 'Engineer',
      category_name: 'Engineering',
      is_active: 'true',
      role_id: 'role-1',
    }]);

    mocks.from.mockReset().mockReturnValue(query({
      data: [
        { business_role: 'Designer' },
        { business_role: 'Engineer' },
        { business_role: 'Engineer' },
        { business_role: '' },
      ],
      error: null,
    }));

    await expect(fetchEntityRows(entity('positions'), WORKSPACE_ID)).resolves.toEqual([
      { name: 'Designer', member_count: '1' },
      { name: 'Engineer', member_count: '2' },
    ]);
  });
});
