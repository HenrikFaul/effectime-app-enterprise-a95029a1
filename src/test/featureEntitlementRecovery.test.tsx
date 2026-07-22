import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEnabledFeatures } from '@/hooks/useFeature';

const { authState, rpc } = vi.hoisted(() => ({
  authState: {
    user: { id: 'user-a' } as { id: string } | null,
    loading: false,
  },
  rpc: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => authState,
}));

function createHarness() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

beforeEach(() => {
  authState.user = { id: 'user-a' };
  authState.loading = false;
  rpc.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('feature entitlement recovery', () => {
  it.each([
    ['null payload', null],
    ['object payload', { feature_key: 'members_list', source: 'tier' }],
    ['string payload', 'members_list'],
  ])('fails closed for a malformed non-array RPC %s', async (_label, payload) => {
    rpc.mockResolvedValueOnce({ data: payload, error: null });
    const { wrapper } = createHarness();
    const view = renderHook(() => useEnabledFeatures('workspace-a'), { wrapper });

    await waitFor(() => expect(view.result.current.isError).toBe(true));
    expect(view.result.current.features).toEqual([]);
    expect(view.result.current.isEnabled('members_list')).toBe(false);
    expect(view.result.current.error).toEqual(
      new Error('Feature entitlement lookup returned an invalid response'),
    );
  });

  it.each([
    ['null row', [null]],
    ['missing feature key', [{ source: 'tier' }]],
    ['empty feature key', [{ feature_key: '  ', source: 'tier' }]],
    ['unknown source', [{ feature_key: 'members_list', source: 'backend-secret-source' }]],
  ])('fails closed for a malformed RPC row: %s', async (_label, payload) => {
    rpc.mockResolvedValueOnce({ data: payload, error: null });
    const { wrapper } = createHarness();
    const view = renderHook(() => useEnabledFeatures('workspace-a'), { wrapper });

    await waitFor(() => expect(view.result.current.isError).toBe(true));
    expect(view.result.current.features).toEqual([]);
    expect(view.result.current.isEnabled('members_list')).toBe(false);
    expect(view.result.current.error).toEqual(
      new Error('Feature entitlement lookup returned an invalid response'),
    );
    expect(String(view.result.current.error)).not.toContain('backend-secret-source');
  });

  it('fails closed after a refetch error even though TanStack retains stale enabled data', async () => {
    rpc
      .mockResolvedValueOnce({
        data: [{ feature_key: 'payroll_export', source: 'tier' }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'sensitive backend diagnostic' },
      });
    const { queryClient, wrapper } = createHarness();
    const view = renderHook(() => useEnabledFeatures('workspace-a'), { wrapper });

    await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
    expect(view.result.current.isEnabled('payroll_export')).toBe(true);

    await act(async () => {
      await view.result.current.refetch();
    });

    await waitFor(() => expect(view.result.current.isError).toBe(true));
    expect(queryClient.getQueryData(['enabled-features', 'user-a', 'workspace-a'])).toEqual([
      { feature_key: 'payroll_export', source: 'tier' },
    ]);
    expect(view.result.current.data).toEqual([]);
    expect(view.result.current.features).toEqual([]);
    expect(view.result.current.isEnabled('payroll_export')).toBe(false);
  });

  it('fails closed after a malformed refetch without publishing the retained stale feature', async () => {
    rpc
      .mockResolvedValueOnce({
        data: [{ feature_key: 'payroll_export', source: 'tier' }],
        error: null,
      })
      .mockResolvedValueOnce({ data: [null], error: null });
    const { queryClient, wrapper } = createHarness();
    const view = renderHook(() => useEnabledFeatures('workspace-a'), { wrapper });

    await waitFor(() => expect(view.result.current.isEnabled('payroll_export')).toBe(true));

    await act(async () => {
      await view.result.current.refetch();
    });

    await waitFor(() => expect(view.result.current.isError).toBe(true));
    expect(queryClient.getQueryData(['enabled-features', 'user-a', 'workspace-a'])).toEqual([
      { feature_key: 'payroll_export', source: 'tier' },
    ]);
    expect(view.result.current.features).toEqual([]);
    expect(view.result.current.isEnabled('payroll_export')).toBe(false);
    expect(view.result.current.error).toEqual(
      new Error('Feature entitlement lookup returned an invalid response'),
    );
  });

  it('restores only entitlements returned by a later successful retry', async () => {
    rpc
      .mockResolvedValueOnce({ data: null, error: { message: 'temporary failure' } })
      .mockResolvedValueOnce({
        data: [{ feature_key: 'members_list', source: 'addon' }],
        error: null,
      });
    const { wrapper } = createHarness();
    const view = renderHook(() => useEnabledFeatures('workspace-a'), { wrapper });

    await waitFor(() => expect(view.result.current.isError).toBe(true));
    expect(view.result.current.isEnabled('members_list')).toBe(false);

    await act(async () => {
      await view.result.current.refetch();
    });

    await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
    expect(view.result.current.isEnabled('members_list')).toBe(true);
    expect(view.result.current.isEnabled('payroll_export')).toBe(false);
  });

  it('does not reuse one authenticated actor cache entry for another actor', async () => {
    rpc
      .mockResolvedValueOnce({
        data: [{ feature_key: 'security_center', source: 'tier' }],
        error: null,
      })
      .mockResolvedValueOnce({ data: [], error: null });
    const { queryClient, wrapper } = createHarness();
    const view = renderHook(() => useEnabledFeatures('workspace-a'), { wrapper });

    await waitFor(() => expect(view.result.current.isEnabled('security_center')).toBe(true));

    authState.user = { id: 'user-b' };
    view.rerender();
    expect(view.result.current.isEnabled('security_center')).toBe(false);
    await waitFor(() => expect(view.result.current.isSuccess).toBe(true));

    expect(view.result.current.features).toEqual([]);
    expect(queryClient.getQueryData(['enabled-features', 'user-a', 'workspace-a'])).toHaveLength(1);
    expect(queryClient.getQueryData(['enabled-features', 'user-b', 'workspace-a'])).toEqual([]);
  });

  it('does not query or enable a feature without an authenticated actor', async () => {
    authState.user = null;
    const { wrapper } = createHarness();
    const view = renderHook(() => useEnabledFeatures('workspace-a'), { wrapper });

    expect(view.result.current.fetchStatus).toBe('idle');
    expect(view.result.current.features).toEqual([]);
    expect(view.result.current.isEnabled('members_list')).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
});
