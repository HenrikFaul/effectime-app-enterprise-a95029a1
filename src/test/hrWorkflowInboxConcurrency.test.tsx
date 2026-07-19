import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HRWorkflowInbox } from '@/components/enterprise/workflows/HRWorkflowInbox';

interface QueryResult {
  data: Array<Record<string, unknown>> | null;
  error: { message: string } | null;
}

interface DeferredQuery {
  promise: Promise<QueryResult>;
  resolve: (result: QueryResult) => void;
}

const { rpc, from, t, toastError, toastSuccess } = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  t: (key: string) => key,
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc, from },
}));

vi.mock('@/i18n/I18nProvider', () => ({
  useDateLocale: () => undefined,
  useT: () => t,
}));

vi.mock('sonner', () => ({
  toast: { error: toastError, success: toastSuccess },
}));

let taskQueries: DeferredQuery[];

function createDeferredQuery(): DeferredQuery {
  let resolve!: (result: QueryResult) => void;
  const promise = new Promise<QueryResult>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

function task(id: string, title: string): Record<string, unknown> {
  return {
    id,
    instance_id: 'instance-a',
    title,
    description: null,
    due_date: null,
    status: 'pending',
  };
}

beforeEach(() => {
  taskQueries = [];
  rpc.mockImplementation(async (name: string, args?: Record<string, string | null>) => {
    if (name === 'hr_workflow_list_instances') {
      const isWorkspaceB = args?.p_workspace_id === 'workspace-b';
      return {
        data: [{
          id: 'instance-a',
          template_id: null,
          membership_id: 'membership-a',
          title: isWorkspaceB ? 'Workflow B' : 'Workflow A',
          category: 'custom',
          status: 'open',
          priority: 'normal',
          due_date: null,
          started_at: '2026-07-19T00:00:00.000Z',
          completed_at: null,
          notes: null,
          member_name: isWorkspaceB ? 'Member B' : 'Member A',
          total_tasks: 1,
          done_tasks: 0,
        }],
        error: null,
      };
    }
    return { data: null, error: null };
  });

  from.mockImplementation(() => {
    const query = { select: vi.fn(), eq: vi.fn(), order: vi.fn() };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.order.mockImplementation(() => {
      const deferred = createDeferredQuery();
      taskQueries.push(deferred);
      return deferred.promise;
    });
    return query;
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('HR workflow inbox task request ordering', () => {
  it('deduplicates a pending task request when an instance is closed and reopened', async () => {
    render(<HRWorkflowInbox workspaceId="workspace-a" isAdmin userId="owner-a" />);

    const workflowTrigger = await screen.findByRole('button', { name: 'Workflow A' });
    fireEvent.click(workflowTrigger);
    await waitFor(() => expect(taskQueries).toHaveLength(1));

    fireEvent.click(workflowTrigger);
    fireEvent.click(workflowTrigger);
    await waitFor(() => expect(taskQueries).toHaveLength(1));

    await act(async () => {
      taskQueries[0].resolve({ data: [task('task-current', 'Current task')], error: null });
      await taskQueries[0].promise;
    });
    expect(await screen.findByText('Current task')).toBeInTheDocument();
  });

  it('ignores a previous workspace task response that finishes last', async () => {
    const { rerender } = render(
      <HRWorkflowInbox workspaceId="workspace-a" isAdmin userId="owner-a" />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Workflow A' }));
    await waitFor(() => expect(taskQueries).toHaveLength(1));

    rerender(<HRWorkflowInbox workspaceId="workspace-b" isAdmin userId="owner-a" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Workflow B' }));
    await waitFor(() => expect(taskQueries).toHaveLength(2));

    await act(async () => {
      taskQueries[1].resolve({ data: [task('task-current', 'Workspace B task')], error: null });
      await taskQueries[1].promise;
    });
    expect(await screen.findByText('Workspace B task')).toBeInTheDocument();

    await act(async () => {
      taskQueries[0].resolve({ data: [task('task-stale', 'Workspace A stale task')], error: null });
      await taskQueries[0].promise;
    });

    await waitFor(() => {
      expect(screen.getByText('Workspace B task')).toBeInTheDocument();
      expect(screen.queryByText('Workspace A stale task')).not.toBeInTheDocument();
    });
  });

  it('ignores a stale task error after the next workspace succeeds', async () => {
    const { rerender } = render(
      <HRWorkflowInbox workspaceId="workspace-a" isAdmin userId="owner-a" />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Workflow A' }));
    await waitFor(() => expect(taskQueries).toHaveLength(1));

    rerender(<HRWorkflowInbox workspaceId="workspace-b" isAdmin userId="owner-a" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Workflow B' }));
    await waitFor(() => expect(taskQueries).toHaveLength(2));

    await act(async () => {
      taskQueries[1].resolve({ data: [task('task-current', 'Workspace B task')], error: null });
      await taskQueries[1].promise;
    });
    expect(await screen.findByText('Workspace B task')).toBeInTheDocument();

    await act(async () => {
      taskQueries[0].resolve({ data: null, error: { message: 'Workspace A request failed' } });
      await taskQueries[0].promise;
    });

    await waitFor(() => {
      expect(screen.getByText('Workspace B task')).toBeInTheDocument();
      expect(screen.queryByText('hr_workflow.task_load_error')).not.toBeInTheDocument();
      expect(toastError).not.toHaveBeenCalled();
    });
  });

  it('does not surface a pending task error after unmount', async () => {
    const { unmount } = render(
      <HRWorkflowInbox workspaceId="workspace-a" isAdmin userId="owner-a" />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Workflow A' }));
    await waitFor(() => expect(taskQueries).toHaveLength(1));
    unmount();

    await act(async () => {
      taskQueries[0].resolve({ data: null, error: { message: 'Unmounted request failed' } });
      await taskQueries[0].promise;
    });

    expect(toastError).not.toHaveBeenCalled();
  });
});
