import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.hoisted(() => vi.fn());

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc },
}));

import {
  installPlugin,
  PluginMarketplaceMutationError,
  uninstallPlugin,
} from '@/hooks/usePluginMarketplace';

describe('plugin marketplace mutation API', () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it('preserves the install RPC contract and successful return value', async () => {
    const config = { channel: 'stable', nested: { enabled: true } };
    rpc.mockResolvedValue({ data: 'installed-id', error: null });

    await expect(installPlugin('workspace-id', 'plugin-id', config)).resolves.toBe('installed-id');
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('marketplace_install_plugin', {
      _workspace_id: 'workspace-id',
      _plugin_id: 'plugin-id',
      _config: config,
    });
  });

  it('preserves the uninstall RPC contract and successful return value', async () => {
    const result = { ok: true };
    rpc.mockResolvedValue({ data: result, error: null });

    await expect(uninstallPlugin('installed-id')).resolves.toBe(result);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('marketplace_uninstall_plugin', {
      _installed_id: 'installed-id',
    });
  });

  it.each(['40001', '40P01', '55P03'])(
    'maps install SQLSTATE %s to a sanitized retryable conflict',
    async (code) => {
      rpc.mockResolvedValue({
        data: null,
        error: {
          code,
          message: 'raw database message',
          details: 'raw database details',
          hint: 'raw database hint',
        },
      });

      const request = installPlugin('workspace-id', 'plugin-id');
      await expect(request).rejects.toMatchObject({
        name: 'PluginMarketplaceMutationError',
        code: 'retryable-conflict',
        message: 'Plugin marketplace mutation failed',
      });
      await expect(request).rejects.not.toHaveProperty('details');
    },
  );

  it.each(['40001', '40P01', '55P03'])(
    'maps uninstall SQLSTATE %s to a sanitized retryable conflict',
    async (code) => {
      rpc.mockRejectedValue({
        code,
        message: 'raw transport message',
        details: 'raw transport details',
        hint: 'raw transport hint',
      });

      await expect(uninstallPlugin('installed-id')).rejects.toEqual(
        new PluginMarketplaceMutationError('retryable-conflict'),
      );
    },
  );

  it.each([
    ['non-retryable SQLSTATE', { code: '42501', message: 'permission denied' }],
    ['missing code', { message: 'backend unavailable', details: 'internal host' }],
    ['primitive rejection', 'network failed'],
    ['Error instance with a code field', Object.assign(new Error('lock conflict'), { code: '55P03' })],
  ])('maps install %s to a bounded request failure', async (_label, backendError) => {
    rpc.mockResolvedValue({ data: null, error: backendError });

    const request = installPlugin('workspace-id', 'plugin-id');
    await expect(request).rejects.toMatchObject({
      code: 'request-failed',
      message: 'Plugin marketplace mutation failed',
    });
  });

  it('sanitizes an unexpected uninstall transport failure', async () => {
    rpc.mockRejectedValue(new Error('https://internal.example.invalid failed with secret details'));

    await expect(uninstallPlugin('installed-id')).rejects.toMatchObject({
      code: 'request-failed',
      message: 'Plugin marketplace mutation failed',
    });
  });

  it('fails closed when a rejected object cannot be inspected safely', async () => {
    const revoked = Proxy.revocable({ code: '55P03' }, {});
    revoked.revoke();
    rpc.mockRejectedValue(revoked.proxy);

    await expect(uninstallPlugin('installed-id')).rejects.toMatchObject({
      code: 'request-failed',
      message: 'Plugin marketplace mutation failed',
    });
  });
});
