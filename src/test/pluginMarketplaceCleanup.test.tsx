import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { InstalledPluginCleanupPanel } from '@/components/marketplace/InstalledPluginCleanupPanel';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

const mocks = vi.hoisted(() => {
  class MutationError extends Error {
    readonly code: 'retryable-conflict' | 'request-failed';

    constructor(code: 'retryable-conflict' | 'request-failed') {
      super('Plugin marketplace mutation failed');
      this.name = 'PluginMarketplaceMutationError';
      this.code = code;
    }
  }

  return {
    MutationError,
    query: {
      data: [] as Array<{
        id: string;
        workspace_id: string;
        plugin_id: string;
        enabled: boolean;
        installed_at: string;
      }>,
      isLoading: false,
      isError: false,
      isFetching: false,
    },
    workspaceIds: [] as string[],
    uninstallPlugin: vi.fn(),
    refetchInstalled: vi.fn(),
    toastError: vi.fn(),
    toastSuccess: vi.fn(),
  };
});

vi.mock('@/hooks/usePluginMarketplace', () => ({
  PluginMarketplaceMutationError: mocks.MutationError,
  useInstalledPlugins: (workspaceId: string) => {
    mocks.workspaceIds.push(workspaceId);
    return { ...mocks.query, refetch: mocks.refetchInstalled };
  },
  uninstallPlugin: mocks.uninstallPlugin,
}));

vi.mock('@/i18n/I18nProvider', () => ({
  useI18n: () => ({
    locale: 'en',
    t: (key: string, params?: { count?: number }) => (
      key === 'marketplace.cleanup_toggle'
        ? `${key}:${params?.count ?? 'unknown'}`
        : key
    ),
  }),
}));

vi.mock('sonner', () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}));

const installation = {
  id: 'installation-exact-id',
  workspace_id: 'workspace-a',
  plugin_id: 'archived-plugin-id',
  enabled: true,
  installed_at: '2026-07-22T08:30:00.000Z',
};

function openPanel(workspaceId = 'workspace-a') {
  const view = render(<InstalledPluginCleanupPanel workspaceId={workspaceId} />);
  fireEvent.click(screen.getByRole('button', { name: /^marketplace\.cleanup_toggle:/ }));
  return view;
}

function openRemovalDialog(buttonName = 'marketplace.cleanup_remove') {
  const trigger = screen.getByRole('button', { name: buttonName });
  fireEvent.click(trigger);
  expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  return trigger;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.query.data = [installation];
  mocks.query.isLoading = false;
  mocks.query.isError = false;
  mocks.query.isFetching = false;
  mocks.refetchInstalled.mockResolvedValue({ isError: false });
});

afterEach(() => {
  cleanup();
});

describe('InstalledPluginCleanupPanel', () => {
  it('renders a collapsed, accessible loading state', () => {
    mocks.query.isLoading = true;
    render(<InstalledPluginCleanupPanel workspaceId="workspace-a" />);

    expect(screen.queryByText('marketplace.cleanup_loading')).not.toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: 'marketplace.cleanup_title' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveClass('whitespace-normal');
    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('marketplace.cleanup_loading');
  });

  it('shows an empty state without consulting marketplace catalog data', () => {
    mocks.query.data = [];
    openPanel();

    expect(screen.getByRole('status')).toHaveTextContent('marketplace.cleanup_empty');
    expect(mocks.workspaceIds).toContain('workspace-a');
  });

  it('shows a fail-visible inventory error with an explicit retry', () => {
    mocks.query.isError = true;
    render(<InstalledPluginCleanupPanel workspaceId="workspace-a" />);
    fireEvent.click(screen.getByRole('button', { name: 'marketplace.cleanup_title' }));

    expect(screen.getByRole('button', { name: 'marketplace.cleanup_title' })).toBeInTheDocument();
    expect(screen.queryByText('1')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('marketplace.cleanup_load_error');
    fireEvent.click(screen.getByRole('button', { name: 'marketplace.cleanup_retry_load' }));
    expect(mocks.refetchInstalled).toHaveBeenCalledTimes(1);
  });

  it('renders catalog-independent identity, state and installation time', () => {
    mocks.query.data = [installation, {
      ...installation,
      id: 'disabled-installation',
      plugin_id: 'missing-from-catalog',
      enabled: false,
    }];
    openPanel();

    expect(screen.getByRole('list', { name: 'marketplace.cleanup_list_label' })).toBeInTheDocument();
    expect(screen.getByText('archived-plugin-id')).toBeInTheDocument();
    expect(screen.getByText('missing-from-catalog')).toBeInTheDocument();
    expect(screen.getByText('marketplace.cleanup_enabled')).toBeInTheDocument();
    expect(screen.getByText('marketplace.cleanup_disabled')).toBeInTheDocument();
    expect(screen.getAllByText('marketplace.cleanup_installed_at')).toHaveLength(2);
  });

  it('cancels without a mutation and returns focus to the row action', async () => {
    openPanel();
    const trigger = openRemovalDialog();

    fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(mocks.uninstallPlugin).not.toHaveBeenCalled();
  });

  it('supports Escape dismissal and restores focus', async () => {
    openPanel();
    const trigger = openRemovalDialog();

    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(mocks.uninstallPlugin).not.toHaveBeenCalled();
  });

  it('uses the exact installation id, suppresses double confirm and succeeds only after refetch', async () => {
    const pending = deferred<{ ok: boolean }>();
    mocks.uninstallPlugin.mockReturnValueOnce(pending.promise);
    openPanel();
    openRemovalDialog();
    const confirm = screen.getByRole('button', { name: 'marketplace.cleanup_confirm' });

    fireEvent.click(confirm);
    fireEvent.click(confirm);

    expect(mocks.uninstallPlugin).toHaveBeenCalledTimes(1);
    expect(mocks.uninstallPlugin).toHaveBeenCalledWith('installation-exact-id');
    expect(mocks.toastSuccess).not.toHaveBeenCalled();

    await act(async () => {
      pending.resolve({ ok: true });
      await pending.promise;
    });

    await waitFor(() => expect(mocks.refetchInstalled).toHaveBeenCalledTimes(1));
    expect(mocks.toastSuccess).toHaveBeenCalledWith('marketplace.cleanup_success');
  });

  it('keeps cleanup locked until the post-removal inventory refresh settles', async () => {
    const refresh = deferred<{ isError: boolean }>();
    mocks.uninstallPlugin.mockResolvedValueOnce({ ok: true });
    mocks.refetchInstalled.mockReturnValueOnce(refresh.promise);
    openPanel();
    openRemovalDialog();
    fireEvent.click(screen.getByRole('button', { name: 'marketplace.cleanup_confirm' }));

    await waitFor(() => expect(mocks.refetchInstalled).toHaveBeenCalledTimes(1));
    const remove = screen.getByRole('button', { name: 'marketplace.cleanup_remove' });
    expect(remove).toBeDisabled();
    fireEvent.click(remove);
    expect(mocks.uninstallPlugin).toHaveBeenCalledTimes(1);

    await act(async () => {
      refresh.resolve({ isError: false });
      await refresh.promise;
    });

    await waitFor(() => expect(remove).toBeEnabled());
    expect(mocks.toastSuccess).toHaveBeenCalledWith('marketplace.cleanup_success');
  });

  it('moves focus to the panel toggle while the confirmed row action is locked', async () => {
    const pending = deferred<{ ok: boolean }>();
    mocks.uninstallPlugin.mockReturnValueOnce(pending.promise);
    openPanel();
    openRemovalDialog();
    fireEvent.click(screen.getByRole('button', { name: 'marketplace.cleanup_confirm' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'marketplace.cleanup_toggle:1' })).toHaveFocus();

    await act(async () => {
      pending.resolve({ ok: true });
      await pending.promise;
    });
  });

  it('fails closed on a malformed success receipt', async () => {
    mocks.uninstallPlugin.mockResolvedValueOnce({ ok: false });
    openPanel();
    openRemovalDialog();
    fireEvent.click(screen.getByRole('button', { name: 'marketplace.cleanup_confirm' }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('marketplace.cleanup_error'));
    expect(mocks.refetchInstalled).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });

  it('requires a fresh user-confirmed retry after a retryable conflict', async () => {
    mocks.uninstallPlugin
      .mockRejectedValueOnce(new mocks.MutationError('retryable-conflict'))
      .mockResolvedValueOnce({ ok: true });
    openPanel();
    openRemovalDialog();
    fireEvent.click(screen.getByRole('button', { name: 'marketplace.cleanup_confirm' }));

    expect(await screen.findByRole('button', { name: 'marketplace.cleanup_retry_remove' })).toBeEnabled();
    expect(mocks.toastError).toHaveBeenCalledWith('marketplace.cleanup_retryable');
    expect(mocks.uninstallPlugin).toHaveBeenCalledTimes(1);

    openRemovalDialog('marketplace.cleanup_retry_remove');
    fireEvent.click(screen.getByRole('button', { name: 'marketplace.cleanup_confirm' }));

    await waitFor(() => expect(mocks.uninstallPlugin).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalledWith('marketplace.cleanup_success'));
  });

  it('never exposes an unexpected backend failure', async () => {
    mocks.uninstallPlugin.mockRejectedValueOnce(
      new Error('raw secret: postgresql://internal-host/workspace-a'),
    );
    openPanel();
    openRemovalDialog();
    fireEvent.click(screen.getByRole('button', { name: 'marketplace.cleanup_confirm' }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('marketplace.cleanup_error'));
    expect(document.body).not.toHaveTextContent('postgresql://internal-host');
    expect(mocks.toastError).not.toHaveBeenCalledWith(expect.stringContaining('workspace-a'));
  });

  it('distinguishes a confirmed removal from a failed inventory refresh', async () => {
    mocks.uninstallPlugin.mockResolvedValueOnce({ ok: true });
    mocks.refetchInstalled.mockResolvedValueOnce({ isError: true });
    openPanel();
    openRemovalDialog();
    fireEvent.click(screen.getByRole('button', { name: 'marketplace.cleanup_confirm' }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('marketplace.cleanup_refresh_error'));
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });

  it('drops a stale successful removal after the workspace changes', async () => {
    const pending = deferred<{ ok: boolean }>();
    mocks.uninstallPlugin.mockReturnValueOnce(pending.promise);
    const view = openPanel('workspace-old');
    openRemovalDialog();
    fireEvent.click(screen.getByRole('button', { name: 'marketplace.cleanup_confirm' }));
    view.rerender(<InstalledPluginCleanupPanel workspaceId="workspace-current" />);

    await act(async () => {
      pending.resolve({ ok: true });
      await pending.promise;
    });

    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.toastError).not.toHaveBeenCalled();
    expect(mocks.refetchInstalled).not.toHaveBeenCalled();
  });

  it('keeps a new operation locked when an A-to-B-to-A stale operation settles', async () => {
    const staleOperation = deferred<{ ok: boolean }>();
    const currentOperation = deferred<{ ok: boolean }>();
    mocks.uninstallPlugin
      .mockReturnValueOnce(staleOperation.promise)
      .mockReturnValueOnce(currentOperation.promise);
    const view = openPanel('workspace-a');
    openRemovalDialog();
    fireEvent.click(screen.getByRole('button', { name: 'marketplace.cleanup_confirm' }));

    view.rerender(<InstalledPluginCleanupPanel workspaceId="workspace-b" />);
    view.rerender(<InstalledPluginCleanupPanel workspaceId="workspace-a" />);
    fireEvent.click(screen.getByRole('button', { name: 'marketplace.cleanup_toggle:1' }));
    openRemovalDialog();
    fireEvent.click(screen.getByRole('button', { name: 'marketplace.cleanup_confirm' }));
    expect(mocks.uninstallPlugin).toHaveBeenCalledTimes(2);

    await act(async () => {
      staleOperation.resolve({ ok: true });
      await staleOperation.promise;
    });

    expect(mocks.refetchInstalled).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'marketplace.cleanup_remove' })).toBeDisabled();

    await act(async () => {
      currentOperation.resolve({ ok: true });
      await currentOperation.promise;
    });

    await waitFor(() => expect(mocks.refetchInstalled).toHaveBeenCalledTimes(1));
    expect(mocks.toastSuccess).toHaveBeenCalledWith('marketplace.cleanup_success');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'marketplace.cleanup_remove' })).toBeEnabled();
    });
  });

  it('drops a stale error after a keyed workspace panel unmounts', async () => {
    const pending = deferred<{ ok: boolean }>();
    mocks.uninstallPlugin.mockReturnValueOnce(pending.promise);
    const view = openPanel('workspace-old');
    openRemovalDialog();
    fireEvent.click(screen.getByRole('button', { name: 'marketplace.cleanup_confirm' }));
    view.unmount();

    await act(async () => {
      pending.reject(new mocks.MutationError('retryable-conflict'));
      await pending.promise.catch(() => undefined);
    });

    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.toastError).not.toHaveBeenCalled();
    expect(mocks.refetchInstalled).not.toHaveBeenCalled();
  });
});
