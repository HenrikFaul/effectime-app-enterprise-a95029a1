import { StrictMode, type ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useEntitlementRetryController } from '@/components/enterprise/WorkspaceDashboard';

function StrictModeWrapper({ children }: { children: ReactNode }) {
  return <StrictMode>{children}</StrictMode>;
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('workspace entitlement retry ownership', () => {
  it('does not let an old A retry clear the active A2 retry after A to B to A', async () => {
    const retryA1 = deferred<void>();
    const retryB = deferred<void>();
    const retryA2 = deferred<void>();
    const refetchA1 = vi.fn(() => retryA1.promise);
    const refetchB = vi.fn(() => retryB.promise);
    const refetchA2 = vi.fn(() => retryA2.promise);

    const view = renderHook(
      ({ contextKey, refetch }) => useEntitlementRetryController(contextKey, refetch),
      {
        initialProps: { contextKey: 'workspace-a:user-a', refetch: refetchA1 },
        wrapper: StrictModeWrapper,
      },
    );

    let pendingA1!: Promise<void>;
    act(() => {
      pendingA1 = view.result.current.retry();
    });
    expect(view.result.current.isRetrying).toBe(true);

    view.rerender({ contextKey: 'workspace-b:user-a', refetch: refetchB });
    let pendingB!: Promise<void>;
    act(() => {
      pendingB = view.result.current.retry();
    });
    expect(view.result.current.isRetrying).toBe(true);

    view.rerender({ contextKey: 'workspace-a:user-a', refetch: refetchA2 });
    let pendingA2!: Promise<void>;
    act(() => {
      pendingA2 = view.result.current.retry();
    });
    expect(view.result.current.isRetrying).toBe(true);

    await act(async () => {
      retryA1.resolve();
      await pendingA1;
    });
    expect(view.result.current.isRetrying).toBe(true);

    await act(async () => {
      retryB.resolve();
      await pendingB;
    });
    expect(view.result.current.isRetrying).toBe(true);

    await act(async () => {
      retryA2.resolve();
      await pendingA2;
    });
    expect(view.result.current.isRetrying).toBe(false);
    expect(refetchA1).toHaveBeenCalledTimes(1);
    expect(refetchB).toHaveBeenCalledTimes(1);
    expect(refetchA2).toHaveBeenCalledTimes(1);
  });
});
