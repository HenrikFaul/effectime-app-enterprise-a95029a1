import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EntitlementRecoveryPanel } from '@/components/enterprise/EntitlementRecoveryPanel';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

vi.mock('@/i18n/I18nProvider', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('@/components/enterprise/ICalTokenRevocationList', () => ({
  ICalTokenRevocationList: ({ workspaceId, userId }: { workspaceId: string; userId: string }) => (
    <div data-testid="revoke-only-list">{workspaceId}:{userId}</div>
  ),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('entitlement recovery panel', () => {
  it('shows a sanitized accessible recovery state and the current actor revoke-only list', () => {
    render(
      <EntitlementRecoveryPanel
        workspaceId="workspace-a"
        userId="user-a"
        isRetrying={false}
        onRetry={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('feature_gate.entitlement_unavailable_title');
    expect(screen.getByRole('alert')).toHaveTextContent('feature_gate.entitlement_unavailable_description');
    expect(screen.getByTestId('revoke-only-list')).toHaveTextContent('workspace-a:user-a');
    expect(document.body).not.toHaveTextContent('sensitive backend diagnostic');
  });

  it('deduplicates repeated retry clicks and exposes a busy state until completion', async () => {
    const retry = deferred<void>();
    const onRetry = vi.fn(() => retry.promise);
    render(
      <EntitlementRecoveryPanel
        workspaceId="workspace-a"
        userId="user-a"
        isRetrying={false}
        onRetry={onRetry}
      />,
    );

    const button = screen.getByRole('button', { name: 'feature_gate.retry_entitlements' });
    fireEvent.click(button);
    fireEvent.click(button);

    await waitFor(() => expect(onRetry).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: 'feature_gate.retrying_entitlements' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'feature_gate.retrying_entitlements' })).toHaveAttribute('aria-busy', 'true');

    retry.resolve(undefined);
    await waitFor(() => expect(screen.getByRole('button', { name: 'feature_gate.retry_entitlements' })).toBeEnabled());
  });

  it('keeps backend failure details out of the DOM and console', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    render(
      <EntitlementRecoveryPanel
        workspaceId="workspace-a"
        userId="user-a"
        isRetrying={false}
        onRetry={() => Promise.reject(new Error('tenant-id secret backend detail'))}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'feature_gate.retry_entitlements' }));
    await waitFor(() => expect(warning).toHaveBeenCalledWith('[EntitlementRecoveryPanel] feature access retry failed'));
    expect(document.body).not.toHaveTextContent('tenant-id secret backend detail');
    expect(String(warning.mock.calls)).not.toContain('tenant-id secret backend detail');
  });

  it('respects an externally active retry', () => {
    render(
      <EntitlementRecoveryPanel
        workspaceId="workspace-a"
        userId="user-a"
        isRetrying
        onRetry={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByRole('button', { name: 'feature_gate.retrying_entitlements' })).toBeDisabled();
  });
});
