import { describe, expect, it, vi } from 'vitest';
import {
  fetchHRWorkflowInstances,
  fetchHRWorkflowTasks,
} from '@/components/enterprise/workflows/hrWorkflowInboxData';

function createQuery(result: { data: unknown[] | null; error: { message: string } | null }) {
  const query = { select: vi.fn(), eq: vi.fn(), order: vi.fn() };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockResolvedValue(result);
  return query;
}

describe('HR workflow inbox data routing', () => {
  it('uses the admin RPC with a null all-status filter and no member fallback', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'backend unavailable' } });
    const from = vi.fn();

    const result = await fetchHRWorkflowInstances({ rpc, from }, 'workspace-a', true, 'all');

    expect(rpc).toHaveBeenCalledWith('hr_workflow_list_instances', {
      p_workspace_id: 'workspace-a',
      p_status: null,
    });
    expect(from).not.toHaveBeenCalled();
    expect(result.error?.message).toBe('backend unavailable');
  });

  it('omits the status predicate for a member all-status query', async () => {
    const query = createQuery({ data: [], error: null });
    const from = vi.fn().mockReturnValue(query);

    await fetchHRWorkflowInstances({ rpc: vi.fn(), from }, 'workspace-a', false, 'all');

    expect(from).toHaveBeenCalledWith('enterprise_hr_workflow_instances');
    expect(query.eq).toHaveBeenCalledTimes(1);
    expect(query.eq).toHaveBeenCalledWith('workspace_id', 'workspace-a');
    expect(query.eq).not.toHaveBeenCalledWith('status', undefined);
  });

  it('adds an explicit member status predicate when selected', async () => {
    const query = createQuery({ data: [], error: null });

    await fetchHRWorkflowInstances(
      { rpc: vi.fn(), from: () => query },
      'workspace-a',
      false,
      'open',
    );

    expect(query.eq).toHaveBeenNthCalledWith(1, 'workspace_id', 'workspace-a');
    expect(query.eq).toHaveBeenNthCalledWith(2, 'status', 'open');
  });

  it('returns member-query failures instead of converting them to an empty state', async () => {
    const query = createQuery({ data: null, error: { message: 'rls request failed' } });

    const result = await fetchHRWorkflowInstances(
      { rpc: vi.fn(), from: () => query },
      'workspace-a',
      false,
      'open',
    );

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe('rls request failed');
  });

  it('returns task-query failures for fail-visible UI handling', async () => {
    const query = createQuery({ data: null, error: { message: 'task request failed' } });

    const result = await fetchHRWorkflowTasks(
      { rpc: vi.fn(), from: () => query },
      'instance-a',
    );

    expect(query.eq).toHaveBeenCalledWith('instance_id', 'instance-a');
    expect(result.data).toBeNull();
    expect(result.error?.message).toBe('task request failed');
  });
});
