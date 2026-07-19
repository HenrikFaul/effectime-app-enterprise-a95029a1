import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { HRWorkflowInbox } from '@/components/enterprise/workflows/HRWorkflowInbox';

const { rpc, from, t } = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  t: (key: string, values?: Record<string, unknown>) => {
    if (key === 'hr_workflow.task_mark_done') return `Mark task done: ${values?.title}`;
    if (key === 'hr_workflow.task_mark_pending') return `Reopen task: ${values?.title}`;
    return key;
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc, from },
}));

vi.mock('@/i18n/I18nProvider', () => ({
  useDateLocale: () => undefined,
  useT: () => t,
}));

beforeEach(() => {
  rpc.mockImplementation(async (name: string) => {
    if (name === 'hr_workflow_list_instances') {
      return {
        data: [{
          id: 'instance-a',
          template_id: null,
          membership_id: 'membership-a',
          title: 'Workflow A',
          category: 'custom',
          status: 'open',
          priority: 'normal',
          due_date: null,
          started_at: '2026-07-19T00:00:00.000Z',
          completed_at: null,
          notes: null,
          member_name: 'Member A',
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
    query.order.mockResolvedValue({
      data: [{
        id: 'task-a',
        instance_id: 'instance-a',
        title: 'Verify documents',
        description: null,
        due_date: null,
        status: 'pending',
      }],
      error: null,
    });
    return query;
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('HR workflow inbox accessibility', () => {
  it('gives the task toggle a localized accessible name and pressed state', async () => {
    render(<HRWorkflowInbox workspaceId="workspace-a" isAdmin userId="owner-a" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Workflow A' }));

    const markDone = await screen.findByRole('button', {
      name: 'Mark task done: Verify documents',
    });
    expect(markDone).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(markDone);

    const reopen = await screen.findByRole('button', {
      name: 'Reopen task: Verify documents',
    });
    expect(reopen).toHaveAttribute('aria-pressed', 'true');
    expect(rpc).toHaveBeenCalledWith('hr_workflow_update_task', {
      p_task_id: 'task-a',
      p_status: 'done',
    });
  }, 10_000);
});
