import type { InputHTMLAttributes } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { ICalSubscription } from '@/components/enterprise/ICalSubscription';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

const { from, loadEqCalls, pendingLoads, renderedInputValues, t, toastError } = vi.hoisted(() => ({
  from: vi.fn(),
  loadEqCalls: [] as Array<[string, string]>,
  pendingLoads: [] as Array<Promise<{ data: unknown[] | null; error: { message: string } | null }>>,
  renderedInputValues: [] as string[],
  t: (key: string) => key,
  toastError: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from },
}));

vi.mock('@/i18n/I18nProvider', () => ({
  useI18n: () => ({ t }),
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({ value, ...props }: InputHTMLAttributes<HTMLInputElement>) => {
    renderedInputValues.push(String(value ?? ''));
    return <input value={value} {...props} />;
  },
}));

vi.mock('sonner', () => ({
  toast: { error: toastError, success: vi.fn() },
}));

afterEach(() => {
  cleanup();
  loadEqCalls.length = 0;
  pendingLoads.length = 0;
  renderedInputValues.length = 0;
  vi.clearAllMocks();
});

function queueLoad(result: Promise<{ data: unknown[] | null; error: { message: string } | null }>) {
  pendingLoads.push(result);
}

function installLoadMock() {
  from.mockImplementation(() => ({
    select: vi.fn(() => {
      const result = pendingLoads.shift();
      if (!result) throw new Error('Missing queued iCal load result');
      let equalityCount = 0;
      const query = {
        eq: vi.fn((column: string, value: string) => {
          loadEqCalls.push([column, value]);
          equalityCount += 1;
          return equalityCount === 2 ? result : query;
        }),
      };
      return query;
    }),
  }));
}

describe('iCal subscription request lifecycle', () => {
  it('ignores a prior workspace response that resolves after the current workspace', async () => {
    const oldLoad = deferred<{ data: unknown[]; error: null }>();
    const currentLoad = deferred<{ data: unknown[]; error: null }>();
    queueLoad(oldLoad.promise);
    queueLoad(currentLoad.promise);
    installLoadMock();

    const view = render(
      <ICalSubscription workspaceId="workspace-old" userId="user-a" canUseIcalFeed canCreateTeamFeed={false} />,
    );
    view.rerender(
      <ICalSubscription workspaceId="workspace-current" userId="user-a" canUseIcalFeed canCreateTeamFeed={false} />,
    );
    expect(loadEqCalls).toEqual([
      ['workspace_id', 'workspace-old'],
      ['user_id', 'user-a'],
      ['workspace_id', 'workspace-current'],
      ['user_id', 'user-a'],
    ]);

    currentLoad.resolve({
      data: [{ id: 'current', token: 'current-secret', scope: 'own' }],
      error: null,
    });
    expect(await screen.findByDisplayValue(/current-secret/)).toBeInTheDocument();

    oldLoad.resolve({
      data: [{ id: 'old', token: 'old-secret', scope: 'own' }],
      error: null,
    });
    await waitFor(() => expect(screen.queryByDisplayValue(/old-secret/)).not.toBeInTheDocument());
    expect(screen.getByDisplayValue(/current-secret/)).toBeInTheDocument();
  });

  it('clears old bearer data immediately and ignores a stale load error', async () => {
    const firstLoad = deferred<{ data: unknown[]; error: null }>();
    const nextLoad = deferred<{ data: null; error: { message: string } }>();
    queueLoad(firstLoad.promise);
    queueLoad(nextLoad.promise);
    installLoadMock();

    const view = render(
      <ICalSubscription workspaceId="workspace-a" userId="user-a" canUseIcalFeed canCreateTeamFeed={false} />,
    );
    firstLoad.resolve({
      data: [{ id: 'token-a', token: 'workspace-a-secret', scope: 'own' }],
      error: null,
    });
    expect(await screen.findByDisplayValue(/workspace-a-secret/)).toBeInTheDocument();

    renderedInputValues.length = 0;
    view.rerender(
      <ICalSubscription workspaceId="workspace-b" userId="user-a" canUseIcalFeed canCreateTeamFeed={false} />,
    );
    expect(renderedInputValues).not.toContain(expect.stringContaining('workspace-a-secret'));
    await waitFor(() => expect(screen.queryByDisplayValue(/workspace-a-secret/)).not.toBeInTheDocument());

    queueLoad(Promise.resolve({ data: [], error: null }));
    view.rerender(
      <ICalSubscription workspaceId="workspace-c" userId="user-a" canUseIcalFeed canCreateTeamFeed={false} />,
    );
    nextLoad.resolve({ data: null, error: { message: 'stale workspace failure' } });
    await waitFor(() => expect(toastError).not.toHaveBeenCalled());
  });

  it('does not render the previous user bearer while loading the next user', async () => {
    const firstLoad = deferred<{ data: unknown[]; error: null }>();
    const nextLoad = deferred<{ data: unknown[]; error: null }>();
    queueLoad(firstLoad.promise);
    queueLoad(nextLoad.promise);
    installLoadMock();

    const view = render(
      <ICalSubscription workspaceId="workspace-a" userId="user-old" canUseIcalFeed canCreateTeamFeed={false} />,
    );
    firstLoad.resolve({
      data: [{ id: 'old-user-token', token: 'old-user-secret', scope: 'own' }],
      error: null,
    });
    expect(await screen.findByDisplayValue(/old-user-secret/)).toBeInTheDocument();

    renderedInputValues.length = 0;
    view.rerender(
      <ICalSubscription workspaceId="workspace-a" userId="user-current" canUseIcalFeed canCreateTeamFeed={false} />,
    );
    expect(renderedInputValues).not.toContain(expect.stringContaining('old-user-secret'));
    expect(loadEqCalls.slice(-2)).toEqual([
      ['workspace_id', 'workspace-a'],
      ['user_id', 'user-current'],
    ]);

    nextLoad.resolve({ data: [], error: null });
    await waitFor(() => expect(screen.queryByDisplayValue(/old-user-secret/)).not.toBeInTheDocument());
  });

  it('does not surface a late error after unmount', async () => {
    const lateLoad = deferred<{ data: null; error: { message: string } }>();
    queueLoad(lateLoad.promise);
    installLoadMock();

    const view = render(
      <ICalSubscription workspaceId="workspace-a" userId="user-a" canUseIcalFeed canCreateTeamFeed={false} />,
    );
    view.unmount();
    lateLoad.resolve({ data: null, error: { message: 'late failure' } });

    await waitFor(() => expect(toastError).not.toHaveBeenCalled());
  });
});
