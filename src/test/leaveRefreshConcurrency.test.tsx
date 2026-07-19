import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  PropsWithChildren,
  TextareaHTMLAttributes,
} from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApprovalInbox } from '@/components/enterprise/ApprovalInbox';
import { LeaveRequestList } from '@/components/enterprise/LeaveRequestList';

const { from, rpc, translate } = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  translate: (key: string) => key,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from,
    rpc,
    functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: null }) },
  },
}));

vi.mock('@/i18n/I18nProvider', () => ({
  useI18n: () => ({ t: translate }),
  useDateLocale: () => undefined,
}));

vi.mock('@/hooks/useFeature', () => ({
  useFeature: () => ({ enabled: false }),
}));

vi.mock('@/lib/auditLog', () => ({ logAuditEvent: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/components/enterprise/DecisionMemoryEditor', () => ({ DecisionMemoryEditor: () => null }));
vi.mock('@/components/enterprise/LeaveRequestDialog', () => ({ LeaveRequestDialog: () => null }));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    variant: _variant,
    size: _size,
    asChild: _asChild,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: string;
    size?: string;
    asChild?: boolean;
  }) => <button {...props}>{children}</button>,
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) => <div {...props}>{children}</div>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({
    children,
    variant: _variant,
    ...props
  }: PropsWithChildren<HTMLAttributes<HTMLSpanElement> & { variant?: string }>) => <span {...props}>{children}</span>,
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: (props: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: PropsWithChildren) => <div>{children}</div>,
  SelectTrigger: ({ children }: PropsWithChildren) => <div>{children}</div>,
  SelectValue: () => null,
  SelectContent: ({ children }: PropsWithChildren) => <div>{children}</div>,
  SelectItem: ({ children }: PropsWithChildren) => <span>{children}</span>,
}));

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: PropsWithChildren) => <div>{children}</div>,
  PopoverTrigger: ({ children }: PropsWithChildren) => <>{children}</>,
  PopoverContent: ({ children }: PropsWithChildren) => <div>{children}</div>,
}));

vi.mock('@/components/ui/calendar', () => ({ Calendar: () => null }));
vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({ onCheckedChange, ...props }: InputHTMLAttributes<HTMLInputElement> & {
    onCheckedChange?: (checked: boolean) => void;
  }) => (
    <input
      type="checkbox"
      {...props}
      onChange={event => onCheckedChange?.(event.target.checked)}
    />
  ),
}));

interface LeaveRow {
  id: string;
  user_id: string;
  status: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  is_half_day: boolean;
  half_day_period: string | null;
  comment: string;
  review_comment: string | null;
}

interface QueryResult {
  data: LeaveRow[] | null;
  error: { message: string } | null;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(resolvePromise => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function thenableQuery<T>(promise: Promise<T>) {
  type Query = PromiseLike<T> & Record<'select' | 'eq' | 'order' | 'gte' | 'lte', ReturnType<typeof vi.fn>>;
  const query = { then: promise.then.bind(promise) } as Query;
  for (const method of ['select', 'eq', 'order', 'gte', 'lte'] as const) {
    query[method] = vi.fn(() => query);
  }
  return query;
}

function leaveRow(id: string, userId: string, comment: string): LeaveRow {
  return {
    id,
    user_id: userId,
    status: 'pending',
    leave_type: 'vacation',
    start_date: '2026-07-21',
    end_date: '2026-07-21',
    is_half_day: false,
    half_day_period: null,
    comment,
    review_comment: null,
  };
}

function installDirectoryQueries() {
  const profileQuery = {
    in: vi.fn((_column: string, userIds: string[]) => Promise.resolve({
      data: userIds.map(userId => ({ user_id: userId, display_name: `Name ${userId}` })),
      error: null,
    })),
  };
  const membershipQuery = {
    in: vi.fn((_column: string, userIds: string[]) => Promise.resolve({
      data: userIds.map(userId => ({ user_id: userId, team: `Team ${userId}`, business_role: 'Engineer' })),
      error: null,
    })),
  };
  return { membershipQuery, profileQuery };
}

beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockResolvedValue({ data: { ok: true }, error: null });
});

describe('leave list refresh ordering', () => {
  it('keeps the latest ApprovalInbox response when an older request resolves last', async () => {
    const first = deferred<QueryResult>();
    const second = deferred<QueryResult>();
    const { membershipQuery, profileQuery } = installDirectoryQueries();
    let leaveQueryCount = 0;
    from.mockImplementation((table: string) => {
      if (table === 'leave_requests') {
        leaveQueryCount += 1;
        return thenableQuery(leaveQueryCount === 1 ? first.promise : second.promise);
      }
      if (table === 'profiles') return { select: vi.fn(() => profileQuery) };
      if (table === 'enterprise_memberships') {
        return { select: vi.fn(() => ({ eq: vi.fn(() => membershipQuery) })) };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const view = render(
      <ApprovalInbox workspaceId="workspace-a" userId="admin-a" refreshKey={0} />,
    );
    view.rerender(<ApprovalInbox workspaceId="workspace-a" userId="admin-a" refreshKey={1} />);

    await act(async () => {
      second.resolve({ data: [leaveRow('request-new', 'user-new', 'current response')], error: null });
      await second.promise;
    });
    expect(await screen.findByText('Name user-new')).toBeInTheDocument();

    await act(async () => {
      first.resolve({ data: [leaveRow('request-old', 'user-old', 'obsolete response')], error: null });
      await first.promise;
    });
    expect(screen.queryByText('Name user-old')).not.toBeInTheDocument();
    expect(screen.getByText('Name user-new')).toBeInTheDocument();
  });

  it('keeps the latest LeaveRequestList response when an older request resolves last', async () => {
    const first = deferred<QueryResult>();
    const second = deferred<QueryResult>();
    const { profileQuery } = installDirectoryQueries();
    let leaveQueryCount = 0;
    from.mockImplementation((table: string) => {
      if (table === 'leave_requests') {
        leaveQueryCount += 1;
        return thenableQuery(leaveQueryCount === 1 ? first.promise : second.promise);
      }
      if (table === 'profiles') return { select: vi.fn(() => profileQuery) };
      throw new Error(`Unexpected table: ${table}`);
    });

    const view = render(
      <LeaveRequestList workspaceId="workspace-a" userId="admin-a" userRole="owner" refreshKey={0} />,
    );
    view.rerender(
      <LeaveRequestList workspaceId="workspace-a" userId="admin-a" userRole="owner" refreshKey={1} />,
    );

    await act(async () => {
      second.resolve({ data: [leaveRow('request-new', 'user-new', 'current response')], error: null });
      await second.promise;
    });
    expect(await screen.findByText('Name user-new')).toBeInTheDocument();

    await act(async () => {
      first.resolve({ data: [leaveRow('request-old', 'user-old', 'obsolete response')], error: null });
      await first.promise;
    });
    expect(screen.queryByText('Name user-old')).not.toBeInTheDocument();
    expect(screen.getByText('Name user-new')).toBeInTheDocument();
  });

  it('ignores obsolete ApprovalInbox enrichment that finishes after the latest refresh', async () => {
    const firstProfiles = deferred<{
      data: Array<{ user_id: string; display_name: string }>;
      error: null;
    }>();
    let leaveQueryCount = 0;
    let profileQueryCount = 0;
    from.mockImplementation((table: string) => {
      if (table === 'leave_requests') {
        leaveQueryCount += 1;
        const row = leaveQueryCount === 1
          ? leaveRow('request-old', 'user-old', 'obsolete response')
          : leaveRow('request-new', 'user-new', 'current response');
        return thenableQuery(Promise.resolve({ data: [row], error: null }));
      }
      if (table === 'profiles') {
        profileQueryCount += 1;
        return {
          select: vi.fn(() => ({
            in: vi.fn(() => profileQueryCount === 1
              ? firstProfiles.promise
              : Promise.resolve({
                data: [{ user_id: 'user-new', display_name: 'Name user-new' }],
                error: null,
              })),
          })),
        };
      }
      if (table === 'enterprise_memberships') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn((_column: string, userIds: string[]) => Promise.resolve({
                data: userIds.map(userId => ({ user_id: userId, team: 'Team', business_role: 'Engineer' })),
                error: null,
              })),
            })),
          })),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const view = render(<ApprovalInbox workspaceId="workspace-a" userId="admin-a" refreshKey={0} />);
    await waitFor(() => expect(profileQueryCount).toBe(1));
    view.rerender(<ApprovalInbox workspaceId="workspace-a" userId="admin-a" refreshKey={1} />);
    expect(await screen.findByText('Name user-new')).toBeInTheDocument();

    await act(async () => {
      firstProfiles.resolve({
        data: [{ user_id: 'user-old', display_name: 'Name user-old' }],
        error: null,
      });
      await firstProfiles.promise;
    });
    expect(screen.queryByText('Name user-old')).not.toBeInTheDocument();
    expect(screen.getByText('Name user-new')).toBeInTheDocument();
  });

  it('ignores obsolete LeaveRequestList profile enrichment that finishes last', async () => {
    const firstProfiles = deferred<{
      data: Array<{ user_id: string; display_name: string }>;
      error: null;
    }>();
    let leaveQueryCount = 0;
    let profileQueryCount = 0;
    from.mockImplementation((table: string) => {
      if (table === 'leave_requests') {
        leaveQueryCount += 1;
        const row = leaveQueryCount === 1
          ? leaveRow('request-old', 'user-old', 'obsolete response')
          : leaveRow('request-new', 'user-new', 'current response');
        return thenableQuery(Promise.resolve({ data: [row], error: null }));
      }
      if (table === 'profiles') {
        profileQueryCount += 1;
        return {
          select: vi.fn(() => ({
            in: vi.fn(() => profileQueryCount === 1
              ? firstProfiles.promise
              : Promise.resolve({
                data: [{ user_id: 'user-new', display_name: 'Name user-new' }],
                error: null,
              })),
          })),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const view = render(
      <LeaveRequestList workspaceId="workspace-a" userId="admin-a" userRole="owner" refreshKey={0} />,
    );
    await waitFor(() => expect(profileQueryCount).toBe(1));
    view.rerender(
      <LeaveRequestList workspaceId="workspace-a" userId="admin-a" userRole="owner" refreshKey={1} />,
    );
    expect(await screen.findByText('Name user-new')).toBeInTheDocument();

    await act(async () => {
      firstProfiles.resolve({
        data: [{ user_id: 'user-old', display_name: 'Name user-old' }],
        error: null,
      });
      await firstProfiles.promise;
    });
    expect(screen.queryByText('Name user-old')).not.toBeInTheDocument();
    expect(screen.getByText('Name user-new')).toBeInTheDocument();
  });

  it('refreshes the current workspace when an earlier workspace decision finishes later', async () => {
    const decision = deferred<{ data: { ok: boolean }; error: null }>();
    const workspaceBFirst = deferred<QueryResult>();
    const workspaceBRefresh = deferred<QueryResult>();
    const leaveQueries: Array<ReturnType<typeof thenableQuery<QueryResult>>> = [];
    let leaveQueryCount = 0;
    from.mockImplementation((table: string) => {
      if (table === 'leave_requests') {
        leaveQueryCount += 1;
        const result = leaveQueryCount === 1
          ? Promise.resolve({ data: [leaveRow('request-a', 'user-a', 'workspace A')], error: null })
          : leaveQueryCount === 2
            ? workspaceBFirst.promise
            : workspaceBRefresh.promise;
        const query = thenableQuery(result);
        leaveQueries.push(query);
        return query;
      }
      if (table === 'profiles') {
        const selectResult = {
          in: vi.fn((_column: string, userIds: string[]) => Promise.resolve({
            data: userIds.map(userId => ({ user_id: userId, display_name: `Name ${userId}` })),
            error: null,
          })),
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: { display_name: 'Name user-a' }, error: null }),
          })),
        };
        return { select: vi.fn(() => selectResult) };
      }
      if (table === 'enterprise_memberships') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn((_column: string, userIds: string[]) => Promise.resolve({
                data: userIds.map(userId => ({ user_id: userId, team: 'Team', business_role: 'Engineer' })),
                error: null,
              })),
            })),
          })),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });
    rpc.mockImplementationOnce(() => decision.promise);

    const view = render(
      <ApprovalInbox workspaceId="workspace-a" userId="admin-a" canApprove />,
    );
    expect(await screen.findByText('Name user-a')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'approval_inbox.approve' }));
    expect(rpc).toHaveBeenCalledWith('decide_leave_request', expect.objectContaining({
      _workspace_id: 'workspace-a',
      _request_id: 'request-a',
    }));

    view.rerender(
      <ApprovalInbox workspaceId="workspace-b" userId="admin-a" canApprove />,
    );
    expect(screen.queryByText('Name user-a')).not.toBeInTheDocument();

    await act(async () => {
      decision.resolve({ data: { ok: true }, error: null });
      await decision.promise;
    });
    await waitFor(() => expect(leaveQueries).toHaveLength(3));
    expect(leaveQueries[2].eq).toHaveBeenCalledWith('workspace_id', 'workspace-b');
    expect(leaveQueries[2].eq).not.toHaveBeenCalledWith('workspace_id', 'workspace-a');

    await act(async () => {
      workspaceBRefresh.resolve({
        data: [leaveRow('request-b-current', 'user-b', 'workspace B current')],
        error: null,
      });
      await workspaceBRefresh.promise;
    });
    expect(await screen.findByText('Name user-b')).toBeInTheDocument();

    await act(async () => {
      workspaceBFirst.resolve({
        data: [leaveRow('request-b-old', 'user-b-old', 'workspace B obsolete')],
        error: null,
      });
      await workspaceBFirst.promise;
    });
    expect(screen.queryByText('Name user-b-old')).not.toBeInTheDocument();
    expect(screen.getByText('Name user-b')).toBeInTheDocument();
  });

  it('invalidates a broad LeaveRequestList query when team access is removed', async () => {
    const broad = deferred<QueryResult>();
    const scoped = deferred<QueryResult>();
    const queries: Array<ReturnType<typeof thenableQuery<QueryResult>>> = [];
    const { profileQuery } = installDirectoryQueries();
    let leaveQueryCount = 0;
    from.mockImplementation((table: string) => {
      if (table === 'leave_requests') {
        leaveQueryCount += 1;
        const query = thenableQuery(leaveQueryCount === 1 ? broad.promise : scoped.promise);
        queries.push(query);
        return query;
      }
      if (table === 'profiles') return { select: vi.fn(() => profileQuery) };
      throw new Error(`Unexpected table: ${table}`);
    });

    const view = render(
      <LeaveRequestList
        workspaceId="workspace-a"
        userId="user-current"
        userRole="member"
        canViewTeam
      />,
    );
    view.rerender(
      <LeaveRequestList
        workspaceId="workspace-a"
        userId="user-current"
        userRole="member"
        canViewTeam={false}
      />,
    );
    expect(queries).toHaveLength(2);
    expect(queries[1].eq).toHaveBeenCalledWith('user_id', 'user-current');

    await act(async () => {
      scoped.resolve({ data: [leaveRow('request-current', 'user-current', 'scoped response')], error: null });
      await scoped.promise;
    });
    expect(await screen.findByText('Name user-current')).toBeInTheDocument();

    await act(async () => {
      broad.resolve({ data: [leaveRow('request-foreign', 'user-foreign', 'obsolete broad response')], error: null });
      await broad.promise;
    });
    expect(screen.queryByText('Name user-foreign')).not.toBeInTheDocument();
    expect(screen.getByText('Name user-current')).toBeInTheDocument();
  });

  it('hides an already committed broad list on the permission-downgrade render', async () => {
    const scoped = deferred<QueryResult>();
    const queries: Array<ReturnType<typeof thenableQuery<QueryResult>>> = [];
    const { profileQuery } = installDirectoryQueries();
    let leaveQueryCount = 0;
    from.mockImplementation((table: string) => {
      if (table === 'leave_requests') {
        leaveQueryCount += 1;
        const query = thenableQuery(leaveQueryCount === 1
          ? Promise.resolve({
            data: [leaveRow('request-foreign', 'user-foreign', 'broad committed response')],
            error: null,
          })
          : scoped.promise);
        queries.push(query);
        return query;
      }
      if (table === 'profiles') return { select: vi.fn(() => profileQuery) };
      throw new Error(`Unexpected table: ${table}`);
    });

    const view = render(
      <LeaveRequestList
        workspaceId="workspace-a"
        userId="user-current"
        userRole="member"
        canViewTeam
      />,
    );
    expect(await screen.findByText('Name user-foreign')).toBeInTheDocument();

    view.rerender(
      <LeaveRequestList
        workspaceId="workspace-a"
        userId="user-current"
        userRole="member"
        canViewTeam={false}
      />,
    );
    expect(screen.queryByText('Name user-foreign')).not.toBeInTheDocument();
    expect(queries).toHaveLength(2);
    expect(queries[1].eq).toHaveBeenCalledWith('user_id', 'user-current');

    await act(async () => {
      scoped.resolve({
        data: [leaveRow('request-current', 'user-current', 'scoped response')],
        error: null,
      });
      await scoped.promise;
    });
    expect(await screen.findByText('Name user-current')).toBeInTheDocument();
  });
});

describe('leave list loading, error, retry, and empty states', () => {
  it('announces the ApprovalInbox loading state accessibly', () => {
    const pending = deferred<QueryResult>();
    from.mockImplementation((table: string) => {
      if (table === 'leave_requests') return thenableQuery(pending.promise);
      throw new Error(`Unexpected table: ${table}`);
    });

    render(<ApprovalInbox workspaceId="workspace-a" userId="admin-a" />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status).toHaveAccessibleName('common.loading');
    expect(status.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it('announces the LeaveRequestList loading state accessibly', () => {
    const pending = deferred<QueryResult>();
    from.mockImplementation((table: string) => {
      if (table === 'leave_requests') return thenableQuery(pending.promise);
      throw new Error(`Unexpected table: ${table}`);
    });

    render(
      <LeaveRequestList workspaceId="workspace-a" userId="user-a" userRole="member" />,
    );

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status).toHaveAccessibleName('common.loading');
    expect(status.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it('shows an explicit ApprovalInbox error and recovers through a fresh retry request', async () => {
    const rawBackendMessage = 'permission denied for internal_tenant_secret';
    const { membershipQuery, profileQuery } = installDirectoryQueries();
    let leaveQueryCount = 0;
    from.mockImplementation((table: string) => {
      if (table === 'leave_requests') {
        leaveQueryCount += 1;
        return thenableQuery(Promise.resolve(leaveQueryCount === 1
          ? { data: null, error: { message: rawBackendMessage } }
          : {
              data: [leaveRow('request-recovered', 'user-recovered', 'recovered response')],
              error: null,
            }));
      }
      if (table === 'profiles') return { select: vi.fn(() => profileQuery) };
      if (table === 'enterprise_memberships') {
        return { select: vi.fn(() => ({ eq: vi.fn(() => membershipQuery) })) };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    render(<ApprovalInbox workspaceId="workspace-a" userId="admin-a" />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('approval_inbox.load_error');
    expect(screen.queryByText('approval_inbox.no_requests')).not.toBeInTheDocument();
    expect(screen.queryByText(rawBackendMessage)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'approval_inbox.retry' }));

    await waitFor(() => expect(leaveQueryCount).toBe(2));
    expect(await screen.findByText('Name user-recovered')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText(rawBackendMessage)).not.toBeInTheDocument();
  });

  it('shows an explicit LeaveRequestList enrichment error and recovers through retry', async () => {
    const rawBackendMessage = 'profiles query leaked-internal-endpoint.example';
    let leaveQueryCount = 0;
    let profileQueryCount = 0;
    from.mockImplementation((table: string) => {
      if (table === 'leave_requests') {
        leaveQueryCount += 1;
        return thenableQuery(Promise.resolve({
          data: [leaveRow('request-recovered', 'user-recovered', 'recovered response')],
          error: null,
        }));
      }
      if (table === 'profiles') {
        return {
          select: vi.fn(() => ({
            in: vi.fn(() => {
              profileQueryCount += 1;
              return Promise.resolve(profileQueryCount === 1
                ? { data: null, error: { message: rawBackendMessage } }
                : {
                    data: [{ user_id: 'user-recovered', display_name: 'Recovered User' }],
                    error: null,
                  });
            }),
          })),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    render(
      <LeaveRequestList workspaceId="workspace-a" userId="user-recovered" userRole="member" />,
    );

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('approval_inbox.load_error');
    expect(screen.queryByText('approval_inbox.no_own_requests')).not.toBeInTheDocument();
    expect(screen.queryByText(rawBackendMessage)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'approval_inbox.retry' }));

    await waitFor(() => {
      expect(leaveQueryCount).toBe(2);
      expect(profileQueryCount).toBe(2);
    });
    expect(await screen.findByText('Recovered User')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText(rawBackendMessage)).not.toBeInTheDocument();
  });

  it('does not let a stale ApprovalInbox error replace the latest successful result', async () => {
    const first = deferred<QueryResult>();
    const second = deferred<QueryResult>();
    const { membershipQuery, profileQuery } = installDirectoryQueries();
    let leaveQueryCount = 0;
    from.mockImplementation((table: string) => {
      if (table === 'leave_requests') {
        leaveQueryCount += 1;
        return thenableQuery(leaveQueryCount === 1 ? first.promise : second.promise);
      }
      if (table === 'profiles') return { select: vi.fn(() => profileQuery) };
      if (table === 'enterprise_memberships') {
        return { select: vi.fn(() => ({ eq: vi.fn(() => membershipQuery) })) };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const view = render(
      <ApprovalInbox workspaceId="workspace-a" userId="admin-a" refreshKey={0} />,
    );
    view.rerender(<ApprovalInbox workspaceId="workspace-a" userId="admin-a" refreshKey={1} />);

    await act(async () => {
      second.resolve({
        data: [leaveRow('request-current', 'user-current', 'current response')],
        error: null,
      });
      await second.promise;
    });
    expect(await screen.findByText('Name user-current')).toBeInTheDocument();

    await act(async () => {
      first.resolve({ data: null, error: { message: 'obsolete backend failure' } });
      await first.promise;
    });
    expect(screen.getByText('Name user-current')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText('obsolete backend failure')).not.toBeInTheDocument();
  });

  it('does not let a stale LeaveRequestList error replace the latest successful result', async () => {
    const first = deferred<QueryResult>();
    const second = deferred<QueryResult>();
    const { profileQuery } = installDirectoryQueries();
    let leaveQueryCount = 0;
    from.mockImplementation((table: string) => {
      if (table === 'leave_requests') {
        leaveQueryCount += 1;
        return thenableQuery(leaveQueryCount === 1 ? first.promise : second.promise);
      }
      if (table === 'profiles') return { select: vi.fn(() => profileQuery) };
      throw new Error(`Unexpected table: ${table}`);
    });

    const view = render(
      <LeaveRequestList
        workspaceId="workspace-a"
        userId="user-current"
        userRole="member"
        refreshKey={0}
      />,
    );
    view.rerender(
      <LeaveRequestList
        workspaceId="workspace-a"
        userId="user-current"
        userRole="member"
        refreshKey={1}
      />,
    );

    await act(async () => {
      second.resolve({
        data: [leaveRow('request-current', 'user-current', 'current response')],
        error: null,
      });
      await second.promise;
    });
    expect(await screen.findByText('Name user-current')).toBeInTheDocument();

    await act(async () => {
      first.resolve({ data: null, error: { message: 'obsolete backend failure' } });
      await first.promise;
    });
    expect(screen.getByText('Name user-current')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText('obsolete backend failure')).not.toBeInTheDocument();
  });

  it('announces a successful empty ApprovalInbox result as a status, not an error', async () => {
    from.mockImplementation((table: string) => {
      if (table === 'leave_requests') {
        return thenableQuery(Promise.resolve({ data: [], error: null }));
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    render(<ApprovalInbox workspaceId="workspace-a" userId="admin-a" />);

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('approval_inbox.no_requests');
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('announces a successful empty LeaveRequestList result as a status, not an error', async () => {
    from.mockImplementation((table: string) => {
      if (table === 'leave_requests') {
        return thenableQuery(Promise.resolve({ data: [], error: null }));
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    render(<LeaveRequestList workspaceId="workspace-a" userId="user-a" userRole="member" />);

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('approval_inbox.no_own_requests');
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
