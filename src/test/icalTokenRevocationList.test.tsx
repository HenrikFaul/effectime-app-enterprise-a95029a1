import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ICalTokenRevocationList } from '@/components/enterprise/ICalTokenRevocationList';

type LoadResult = {
  data: unknown;
  error: { message: string } | null;
};

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

const {
  deleteEqCalls,
  deleteOptions,
  deleteResults,
  from,
  loadResults,
  selectColumns,
  toastError,
  toastSuccess,
} = vi.hoisted(() => ({
  deleteEqCalls: [] as Array<[string, string]>,
  deleteOptions: [] as unknown[],
  deleteResults: [] as Array<Promise<{ error: { message: string } | null; count: number | null }>>,
  from: vi.fn(),
  loadResults: [] as Array<Promise<LoadResult>>,
  selectColumns: [] as string[],
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from },
}));

vi.mock('@/i18n/I18nProvider', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('sonner', () => ({
  toast: { error: toastError, success: toastSuccess },
}));

function queueLoad(result: LoadResult) {
  loadResults.push(Promise.resolve(result));
}

function queueDelete(result: { error: { message: string } | null; count: number | null }) {
  deleteResults.push(Promise.resolve(result));
}

beforeEach(() => {
  deleteEqCalls.length = 0;
  deleteOptions.length = 0;
  deleteResults.length = 0;
  loadResults.length = 0;
  selectColumns.length = 0;
  from.mockImplementation(() => ({
    select: vi.fn((columns: string) => {
      selectColumns.push(columns);
      const result = loadResults.shift();
      if (!result) throw new Error('Missing queued summary load');
      let equalityCount = 0;
      const query = {
        eq: vi.fn(() => {
          equalityCount += 1;
          return equalityCount === 2 ? result : query;
        }),
      };
      return query;
    }),
    delete: vi.fn((options: unknown) => {
      deleteOptions.push(options);
      const result = deleteResults.shift();
      if (!result) throw new Error('Missing queued revoke result');
      let equalityCount = 0;
      const query = {
        eq: vi.fn((column: string, value: string) => {
          deleteEqCalls.push([column, value]);
          equalityCount += 1;
          return equalityCount === 3 ? result : query;
        }),
      };
      return query;
    }),
  }));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('iCal token revocation-only recovery', () => {
  it('loads only token-free summaries and never renders an unexpected bearer field', async () => {
    queueLoad({
      data: [{ id: 'token-a', scope: 'own', token: 'must-never-render' }],
      error: null,
    });
    render(<ICalTokenRevocationList workspaceId="workspace-a" userId="user-a" />);

    expect(await screen.findByRole('button', { name: 'ical_subscription.delete_feed' })).toBeInTheDocument();
    expect(selectColumns).toEqual(['id, scope']);
    expect(document.body).not.toHaveTextContent('must-never-render');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('keeps an unknown legacy scope generic and revokes by exact actor, workspace and token id', async () => {
    queueLoad({ data: [{ id: 'legacy-token', scope: 'legacy' }], error: null });
    queueDelete({ error: null, count: 1 });
    render(<ICalTokenRevocationList workspaceId="workspace-a" userId="user-a" />);

    expect(await screen.findByText('ical_subscription.scope_unknown')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'ical_subscription.delete_feed' }));

    await waitFor(() => expect(deleteEqCalls).toEqual([
      ['id', 'legacy-token'],
      ['workspace_id', 'workspace-a'],
      ['user_id', 'user-a'],
    ]));
    expect(deleteOptions).toEqual([{ count: 'exact' }]);
    await waitFor(() => expect(screen.queryByText('ical_subscription.scope_unknown')).not.toBeInTheDocument());
    expect(toastSuccess).toHaveBeenCalledWith('ical_subscription.feed_revoked');
  });

  it('shows a sanitized load error and supports an explicit non-destructive retry', async () => {
    queueLoad({ data: null, error: { message: 'database tenant diagnostic' } });
    queueLoad({ data: [], error: null });
    render(<ICalTokenRevocationList workspaceId="workspace-a" userId="user-a" />);

    expect(await screen.findByRole('alert')).toHaveTextContent('ical_subscription.summary_load_failed');
    expect(document.body).not.toHaveTextContent('database tenant diagnostic');
    fireEvent.click(screen.getByRole('button', { name: 'ical_subscription.retry_summary_load' }));

    expect(await screen.findByText('ical_subscription.no_revocable_feeds')).toBeInTheDocument();
    expect(selectColumns).toEqual(['id, scope', 'id, scope']);
  });

  it('fails visibly when the token-free recovery projection is malformed', async () => {
    queueLoad({ data: [{ id: 'valid-token', scope: 'own' }, null], error: null });
    render(<ICalTokenRevocationList workspaceId="workspace-a" userId="user-a" />);

    expect(await screen.findByRole('alert')).toHaveTextContent('ical_subscription.summary_load_failed');
    expect(screen.queryByText('ical_subscription.scope_own')).not.toBeInTheDocument();
    expect(screen.queryByText('ical_subscription.no_revocable_feeds')).not.toBeInTheDocument();
  });

  it('treats a zero-row delete as a fail-visible uncertain outcome without retrying it', async () => {
    queueLoad({ data: [{ id: 'token-a', scope: 'team' }], error: null });
    queueDelete({ error: null, count: 0 });
    render(<ICalTokenRevocationList workspaceId="workspace-a" userId="user-a" />);

    fireEvent.click(await screen.findByRole('button', { name: 'ical_subscription.delete_feed' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('ical_subscription.revoke_failed');
    expect(screen.getByText('ical_subscription.scope_team')).toBeInTheDocument();
    expect(deleteOptions).toHaveLength(1);
    expect(toastError).toHaveBeenCalledWith('ical_subscription.revoke_failed');
  });

  it('keeps one token revoke failure visible when another token revoke later succeeds', async () => {
    const firstDelete = deferred<{ error: { message: string } | null; count: number | null }>();
    const secondDelete = deferred<{ error: { message: string } | null; count: number | null }>();
    queueLoad({
      data: [
        { id: 'token-a', scope: 'own' },
        { id: 'token-b', scope: 'team' },
      ],
      error: null,
    });
    deleteResults.push(firstDelete.promise, secondDelete.promise);
    render(<ICalTokenRevocationList workspaceId="workspace-a" userId="user-a" />);

    const revokeButtons = await screen.findAllByRole('button', { name: 'ical_subscription.delete_feed' });
    fireEvent.click(revokeButtons[0]);
    fireEvent.click(revokeButtons[1]);

    firstDelete.resolve({ error: null, count: 0 });
    expect(await screen.findByRole('alert')).toHaveTextContent('ical_subscription.revoke_failed');

    secondDelete.resolve({ error: null, count: 1 });
    await waitFor(() => expect(screen.queryByText('ical_subscription.scope_team')).not.toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent('ical_subscription.revoke_failed');
    expect(screen.getByText('ical_subscription.scope_own')).toBeInTheDocument();
  });

  it('ignores a prior workspace summary that resolves after the active workspace', async () => {
    const oldLoad = deferred<LoadResult>();
    const currentLoad = deferred<LoadResult>();
    loadResults.push(oldLoad.promise, currentLoad.promise);
    const view = render(<ICalTokenRevocationList workspaceId="workspace-old" userId="user-a" />);
    view.rerender(<ICalTokenRevocationList workspaceId="workspace-current" userId="user-a" />);

    currentLoad.resolve({ data: [{ id: 'current-token', scope: 'team' }], error: null });
    expect(await screen.findByText('ical_subscription.scope_team')).toBeInTheDocument();

    oldLoad.resolve({ data: [{ id: 'old-token', scope: 'legacy' }], error: null });
    await waitFor(() => expect(screen.queryByText('ical_subscription.scope_unknown')).not.toBeInTheDocument());
    expect(screen.getByText('ical_subscription.scope_team')).toBeInTheDocument();
  });
});
