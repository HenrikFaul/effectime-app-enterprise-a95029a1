import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PluginMarketplacePanel } from '@/components/marketplace/PluginMarketplacePanel';

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
    plugin: {
      id: 'plugin-a',
      slug: 'plugin-a',
      name: 'Plugin A',
      version: '1.0.0',
      description: 'A contract plugin',
      icon_url: null,
      category: 'integration' as const,
      author_name: 'Effectime',
      manifest: {},
      status: 'published' as const,
      install_count: 3,
      pricing_model: 'free' as const,
    },
    installPlugin: vi.fn(),
    uninstallPlugin: vi.fn(),
    refetchInstalled: vi.fn(),
    toastError: vi.fn(),
    toastSuccess: vi.fn(),
  };
});

vi.mock('@/hooks/usePluginMarketplace', () => ({
  PluginMarketplaceMutationError: mocks.MutationError,
  useMarketplacePlugins: () => ({ data: [mocks.plugin], isLoading: false }),
  useInstalledPlugins: () => ({ data: [], refetch: mocks.refetchInstalled }),
  installPlugin: mocks.installPlugin,
  uninstallPlugin: mocks.uninstallPlugin,
}));

vi.mock('@/i18n/I18nProvider', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('sonner', () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.refetchInstalled.mockResolvedValue(undefined);
});

describe('PluginMarketplacePanel bounded lock-conflict UX', () => {
  it('shows a sanitized manual retry and commits only after a fresh click', async () => {
    mocks.installPlugin
      .mockRejectedValueOnce(new mocks.MutationError('retryable-conflict'))
      .mockResolvedValueOnce('installation-a');

    render(<PluginMarketplacePanel workspaceId="workspace-a" />);
    fireEvent.click(screen.getByRole('button', { name: 'marketplace.install' }));

    expect(await screen.findByRole('button', { name: 'marketplace.retry_install' })).toBeEnabled();
    expect(mocks.toastError).toHaveBeenCalledWith('marketplace.install_retryable');
    expect(mocks.toastError).not.toHaveBeenCalledWith(expect.stringContaining('55P03'));
    expect(mocks.installPlugin).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'marketplace.retry_install' }));
    await waitFor(() => expect(mocks.installPlugin).toHaveBeenCalledTimes(2));
    expect(mocks.installPlugin).toHaveBeenLastCalledWith('workspace-a', 'plugin-a');
    await waitFor(() => expect(mocks.refetchInstalled).toHaveBeenCalledTimes(1));
    expect(mocks.toastSuccess).toHaveBeenCalledWith('marketplace.install_success');
    expect(screen.getByRole('button', { name: 'marketplace.install' })).toBeEnabled();
  });

  it('never exposes a non-retryable backend failure', async () => {
    mocks.installPlugin.mockRejectedValueOnce(new mocks.MutationError('request-failed'));
    render(<PluginMarketplacePanel workspaceId="workspace-a" />);

    fireEvent.click(screen.getByRole('button', { name: 'marketplace.install' }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('marketplace.install_error'));
    expect(screen.queryByRole('button', { name: 'marketplace.retry_install' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'marketplace.install' })).toBeEnabled();
  });

  it('drops a stale lock error after the workspace changes', async () => {
    const pending = deferred<string>();
    mocks.installPlugin.mockReturnValueOnce(pending.promise);
    const view = render(<PluginMarketplacePanel workspaceId="workspace-old" />);

    fireEvent.click(screen.getByRole('button', { name: 'marketplace.install' }));
    expect(mocks.installPlugin).toHaveBeenCalledWith('workspace-old', 'plugin-a');
    view.rerender(<PluginMarketplacePanel workspaceId="workspace-current" />);

    await act(async () => {
      pending.reject(new mocks.MutationError('retryable-conflict'));
      await pending.promise.catch(() => undefined);
    });

    expect(mocks.toastError).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'marketplace.retry_install' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'marketplace.install' })).toBeEnabled();
  });

  it('drops a stale successful install after the workspace changes', async () => {
    const pending = deferred<string>();
    mocks.installPlugin.mockReturnValueOnce(pending.promise);
    const view = render(<PluginMarketplacePanel workspaceId="workspace-old" />);

    fireEvent.click(screen.getByRole('button', { name: 'marketplace.install' }));
    view.rerender(<PluginMarketplacePanel workspaceId="workspace-current" />);

    await act(async () => {
      pending.resolve('installation-old');
      await pending.promise;
    });

    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.refetchInstalled).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'marketplace.install' })).toBeEnabled();
  });

  it('drops a lock error after the keyed workspace panel unmounts', async () => {
    const pending = deferred<string>();
    mocks.installPlugin.mockReturnValueOnce(pending.promise);
    const view = render(<PluginMarketplacePanel workspaceId="workspace-old" />);

    fireEvent.click(screen.getByRole('button', { name: 'marketplace.install' }));
    view.unmount();

    await act(async () => {
      pending.reject(new mocks.MutationError('retryable-conflict'));
      await pending.promise.catch(() => undefined);
    });

    expect(mocks.toastError).not.toHaveBeenCalled();
    expect(mocks.refetchInstalled).not.toHaveBeenCalled();
  });

  it('drops a successful install after the keyed workspace panel unmounts', async () => {
    const pending = deferred<string>();
    mocks.installPlugin.mockReturnValueOnce(pending.promise);
    const view = render(<PluginMarketplacePanel workspaceId="workspace-old" />);

    fireEvent.click(screen.getByRole('button', { name: 'marketplace.install' }));
    view.unmount();

    await act(async () => {
      pending.resolve('installation-old');
      await pending.promise;
    });

    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.refetchInstalled).not.toHaveBeenCalled();
  });

  it('suppresses a same-plugin double click while the first request is pending', () => {
    const pending = deferred<string>();
    mocks.installPlugin.mockReturnValueOnce(pending.promise);
    render(<PluginMarketplacePanel workspaceId="workspace-a" />);
    const install = screen.getByRole('button', { name: 'marketplace.install' });

    fireEvent.click(install);
    fireEvent.click(install);

    expect(mocks.installPlugin).toHaveBeenCalledTimes(1);
  });
});
