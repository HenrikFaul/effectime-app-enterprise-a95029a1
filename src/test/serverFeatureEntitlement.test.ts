import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  checkWorkspaceFeature,
  type FeatureRpcClient,
} from '../../supabase/functions/_shared/feature-entitlement';
import { requiredPayrollFeature } from '../../supabase/functions/payroll-export/security';

type RpcResult = {
  data: unknown;
  error: { message?: string } | null;
};

function fakeRpcClient(...results: RpcResult[]) {
  const rpc = vi.fn(async () => results.shift() ?? { data: null, error: null });
  return {
    client: { rpc } as FeatureRpcClient,
    rpc,
  };
}

describe('server-side workspace feature resolution', () => {
  it('resolves the workspace tenant and allows an explicitly enabled feature', async () => {
    const { client, rpc } = fakeRpcClient(
      { data: 'tenant-1', error: null },
      { data: [{ feature_key: 'run_report', source: 'tier' }], error: null },
    );

    await expect(checkWorkspaceFeature(client, 'workspace-1', 'run_report')).resolves.toEqual({
      enabled: true,
      tenantId: 'tenant-1',
    });
    expect(rpc).toHaveBeenNthCalledWith(1, 'tenant_id_for_workspace', {
      _workspace_id: 'workspace-1',
    });
    expect(rpc).toHaveBeenNthCalledWith(2, 'tenant_enabled_features', {
      _tenant_id: 'tenant-1',
    });
  });

  it('fails closed when the feature is absent or the workspace is unmapped', async () => {
    const disabled = fakeRpcClient(
      { data: 'tenant-1', error: null },
      { data: [{ feature_key: 'another_feature', source: 'tier' }], error: null },
    );
    await expect(checkWorkspaceFeature(disabled.client, 'workspace-1', 'run_report'))
      .resolves.toEqual({ enabled: false, reason: 'feature_disabled', tenantId: 'tenant-1' });

    const unmapped = fakeRpcClient({ data: null, error: null });
    await expect(checkWorkspaceFeature(unmapped.client, 'workspace-1', 'run_report'))
      .resolves.toEqual({ enabled: false, reason: 'workspace_unmapped' });
    expect(unmapped.rpc).toHaveBeenCalledTimes(1);
  });

  it('distinguishes database/contract failures from a disabled entitlement', async () => {
    const tenantFailure = fakeRpcClient({ data: null, error: { message: 'tenant rpc failed' } });
    await expect(checkWorkspaceFeature(tenantFailure.client, 'workspace-1', 'run_report'))
      .resolves.toMatchObject({
        enabled: false,
        reason: 'lookup_error',
        step: 'tenant_lookup',
        error: 'tenant rpc failed',
      });

    const featureFailure = fakeRpcClient(
      { data: 'tenant-1', error: null },
      { data: null, error: { message: 'feature rpc failed' } },
    );
    await expect(checkWorkspaceFeature(featureFailure.client, 'workspace-1', 'run_report'))
      .resolves.toMatchObject({ enabled: false, reason: 'lookup_error', step: 'feature_lookup' });

    const malformed = fakeRpcClient(
      { data: 'tenant-1', error: null },
      { data: { feature_key: 'run_report' }, error: null },
    );
    await expect(checkWorkspaceFeature(malformed.client, 'workspace-1', 'run_report'))
      .resolves.toMatchObject({ enabled: false, reason: 'lookup_error', step: 'feature_response' });
  });

  it('converts rejected RPC requests into fail-closed lookup errors', async () => {
    const tenantRpc = vi.fn().mockRejectedValue(new Error('network unavailable'));
    await expect(checkWorkspaceFeature({ rpc: tenantRpc }, 'workspace-1', 'run_report'))
      .resolves.toMatchObject({
        enabled: false,
        reason: 'lookup_error',
        step: 'tenant_lookup',
        error: 'network unavailable',
      });

    const featureRpc = vi.fn()
      .mockResolvedValueOnce({ data: 'tenant-1', error: null })
      .mockRejectedValueOnce(new Error('feature network unavailable'));
    await expect(checkWorkspaceFeature({ rpc: featureRpc }, 'workspace-1', 'run_report'))
      .resolves.toMatchObject({
        enabled: false,
        reason: 'lookup_error',
        step: 'feature_lookup',
        error: 'feature network unavailable',
      });
  });
});

describe('payroll action entitlement mapping', () => {
  it.each([
    ['calculate-period', 'payroll_engine'],
    ['lock-period', 'payroll_engine'],
    ['export-csv', 'payroll_export'],
    ['export-api', 'payroll_export'],
  ])('maps %s to %s', (action, feature) => {
    expect(requiredPayrollFeature(action)).toBe(feature);
  });

  it('rejects unknown or malformed actions', () => {
    expect(requiredPayrollFeature('delete-period')).toBeNull();
    expect(requiredPayrollFeature(null)).toBeNull();
  });
});

describe('Edge Function entitlement integration invariants', () => {
  const root = join(__dirname, '..', '..');
  const runReport = readFileSync(join(root, 'supabase', 'functions', 'run-report', 'index.ts'), 'utf8');
  const scheduled = readFileSync(
    join(root, 'supabase', 'functions', 'send-scheduled-reports', 'index.ts'),
    'utf8',
  );
  const payroll = readFileSync(join(root, 'supabase', 'functions', 'payroll-export', 'index.ts'), 'utf8');

  it('enforces run_report for user and service-role report execution', () => {
    const authBoundary = runReport.indexOf("if (!internalServiceCall)");
    const entitlementBoundary = runReport.indexOf(
      "checkWorkspaceFeature(admin, workspace_id, 'run_report')",
    );
    const executionBoundary = runReport.indexOf('// SQL mode');

    expect(authBoundary).toBeGreaterThan(-1);
    expect(entitlementBoundary).toBeGreaterThan(authBoundary);
    expect(entitlementBoundary).toBeLessThan(executionBoundary);
    expect(runReport).toContain("reason === 'lookup_error'");
    expect(runReport).toContain('}, 503)');
  });

  it('checks scheduled_reports per due schedule before preserving and executing report.config', () => {
    const scheduleLoop = scheduled.indexOf('for (const sch of schedules)');
    const entitlementBoundary = scheduled.indexOf(
      "checkWorkspaceFeature(admin, sch.workspace_id, 'scheduled_reports')",
    );
    const runBoundary = scheduled.indexOf('/functions/v1/run-report');

    expect(scheduleLoop).toBeGreaterThan(-1);
    expect(entitlementBoundary).toBeGreaterThan(scheduleLoop);
    expect(entitlementBoundary).toBeLessThan(runBoundary);
    expect(scheduled).toContain('config: report.config');
    expect(scheduled).toContain("markRun(admin, sch.id, 'skipped', context)");
  });

  it('checks the mapped payroll entitlement after membership authorization', () => {
    const membershipBoundary = payroll.indexOf(".from('enterprise_memberships')");
    const entitlementBoundary = payroll.indexOf(
      'checkWorkspaceFeature(admin, workspaceId, requiredFeature)',
    );
    const calculateBoundary = payroll.indexOf("if (action === 'calculate-period')");

    expect(membershipBoundary).toBeGreaterThan(-1);
    expect(entitlementBoundary).toBeGreaterThan(membershipBoundary);
    expect(entitlementBoundary).toBeLessThan(calculateBoundary);
    expect(payroll).toContain('Workspace authorization is temporarily unavailable');
    expect(payroll).toContain('Feature entitlement is temporarily unavailable');
  });
});
