import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  calculatePayrollPeriod,
  exportPayrollCsv,
  lockPayrollPeriod,
  parsePayrollCalculation,
  type PayrollFunctionInvoker,
} from '@/components/enterprise/payroll/PayrollPanel';

const validCalculation = {
  members: [
    {
      membership_id: 'membership-1',
      display_name: 'Ada Lovelace',
      regular_hours: 152,
      overtime_hours: 4,
      leave_days: 2,
      gross_estimate: 7800,
      currency: 'EUR',
    },
  ],
  totals: {
    total_hours: 156,
    total_overtime: 4,
    total_gross: 7800,
    member_count: 1,
  },
};

function invokerResult(data: unknown, error: unknown = null): PayrollFunctionInvoker {
  return vi.fn().mockResolvedValue({ data, error });
}

describe('PayrollPanel Edge response contracts', () => {
  it('maps a valid calculate-period response without client-side recomputation', async () => {
    const invoke = invokerResult(validCalculation);

    await expect(calculatePayrollPeriod(invoke, 'workspace-1', 'period-1')).resolves.toEqual({
      members: [
        {
          membershipId: 'membership-1',
          name: 'Ada Lovelace',
          regularHours: 152,
          overtimeHours: 4,
          totalHours: 156,
          leaveDays: 2,
          grossEstimate: 7800,
          currency: 'EUR',
        },
      ],
      totals: {
        totalHours: 156,
        totalOvertime: 4,
        totalGross: 7800,
        memberCount: 1,
      },
    });
    expect(invoke).toHaveBeenCalledWith({
      action: 'calculate-period',
      workspaceId: 'workspace-1',
      periodId: 'period-1',
    });
  });

  it('rejects malformed calculate-period payloads', () => {
    expect(parsePayrollCalculation({ ...validCalculation, totals: { total_hours: '156' } }))
      .toBeNull();
    expect(parsePayrollCalculation({ ...validCalculation, members: [{ membership_id: 'x' }] }))
      .toBeNull();
    expect(parsePayrollCalculation(null)).toBeNull();
  });

  it('rejects negative metrics and inconsistent or fractional member counts', () => {
    expect(parsePayrollCalculation({
      ...validCalculation,
      members: [{ ...validCalculation.members[0], overtime_hours: -1 }],
    })).toBeNull();
    expect(parsePayrollCalculation({
      ...validCalculation,
      totals: { ...validCalculation.totals, total_gross: Number.POSITIVE_INFINITY },
    })).toBeNull();
    expect(parsePayrollCalculation({
      ...validCalculation,
      totals: { ...validCalculation.totals, member_count: 2 },
    })).toBeNull();
    expect(parsePayrollCalculation({
      ...validCalculation,
      totals: { ...validCalculation.totals, member_count: 1.5 },
    })).toBeNull();
  });

  it('accepts a lock only after an explicit success response', async () => {
    await expect(lockPayrollPeriod(invokerResult({ success: true }), 'workspace-1', 'period-1'))
      .resolves.toBeUndefined();
    await expect(lockPayrollPeriod(invokerResult({ success: false }), 'workspace-1', 'period-1'))
      .rejects.toThrow('invalid response');
  });

  it.each([403, 409, 500])(
    'does not download a CSV when export-csv fails with HTTP %s',
    async (status) => {
      const error = Object.assign(new Error(`HTTP ${status}`), { status });
      const download = vi.fn();

      await expect(
        exportPayrollCsv(
          invokerResult({ csv: 'sensitive-data', filename: 'payroll.csv' }, error),
          'workspace-1',
          'period-1',
          'generic',
          download,
        ),
      ).rejects.toThrow(`HTTP ${status}`);
      expect(download).not.toHaveBeenCalled();
    },
  );

  it('does not download malformed or path-traversing export responses', async () => {
    const download = vi.fn();

    await expect(
      exportPayrollCsv(
        invokerResult({ csv: 'payload', filename: '../payroll.csv' }),
        'workspace-1',
        'period-1',
        'generic',
        download,
      ),
    ).rejects.toThrow('invalid response');
    expect(download).not.toHaveBeenCalled();
  });

  it('downloads exactly the validated Edge CSV after a successful response', async () => {
    const download = vi.fn();
    const invoke = invokerResult({ csv: 'ID,Name\n1,Ada', filename: 'payroll_july_generic.csv' });

    await exportPayrollCsv(
      invoke,
      'workspace-1',
      'period-1',
      'generic',
      download,
    );

    expect(invoke).toHaveBeenCalledWith({
      action: 'export-csv',
      workspaceId: 'workspace-1',
      periodId: 'period-1',
      provider: 'generic',
    });
    expect(download).toHaveBeenCalledOnce();
    expect(download).toHaveBeenCalledWith('ID,Name\n1,Ada', 'payroll_july_generic.csv');
  });
});

describe('PayrollPanel privileged-operation integration invariants', () => {
  const source = readFileSync(
    join(process.cwd(), 'src', 'components', 'enterprise', 'payroll', 'PayrollPanel.tsx'),
    'utf8',
  );

  it('keeps payroll export fail-closed behind the dedicated entitlement', () => {
    expect(source).toMatch(/useFeature\(\s*workspaceId,\s*'payroll_export'/);
    expect(source).toContain('!payrollExportEnabled');
    expect(source).toContain("period.status !== 'locked' && period.status !== 'exported'");
  });

  it('loads a saved provider only after payroll_export resolves enabled', () => {
    const providerEffect = source.slice(source.indexOf('// ── Load default provider'));
    expect(providerEffect).toContain('if (payrollExportLoading || !payrollExportEnabled)');
    expect(providerEffect).toContain("setSelectedProvider('generic')");
    expect(providerEffect.indexOf('if (payrollExportLoading || !payrollExportEnabled)'))
      .toBeLessThan(providerEffect.indexOf(".from('payroll_export_configs')"));
    expect(providerEffect).toContain(
      '[workspaceId, payrollExportEnabled, payrollExportLoading, t]',
    );
  });

  it('renders row hours with the same regular-plus-overtime contract as total_hours', () => {
    expect(source).toContain('totalHours: value.regular_hours + value.overtime_hours');
    expect(source).toContain('{row.totalHours.toFixed(1)}');
  });

  it('routes calculation, lock and export exclusively through payroll-export', () => {
    expect(source).toContain("supabase.functions.invoke('payroll-export'");
    expect(source).toContain("action: 'calculate-period'");
    expect(source).toContain("action: 'lock-period'");
    expect(source).toContain("action: 'export-csv'");
    expect(source).not.toContain(".from('enterprise_attendance_periods')");
    expect(source).not.toContain(".from('enterprise_audit_events')");
    expect(source).not.toContain('generateCsv');
    expect(source).not.toMatch(/\.from\('payroll_periods'\)[\s\S]{0,120}\.update\(/);
  });

  it('checks every provider-config read and write error before exporting', () => {
    expect(source).toContain('if (existingConfig.error) throw existingConfig.error');
    expect(source.match(/if \(saveError\) throw saveError/g)).toHaveLength(2);
    expect(source.indexOf('if (saveError) throw saveError')).toBeLessThan(
      source.indexOf('await exportPayrollCsv('),
    );
  });

  it('emits success feedback only after the privileged Edge action resolves', () => {
    expect(source.indexOf('await lockPayrollPeriod(')).toBeLessThan(
      source.indexOf("toast.success(t('payroll.lock_success'))"),
    );
    expect(source.indexOf('await exportPayrollCsv(')).toBeLessThan(
      source.indexOf("toast.success(t('payroll.export_success'))"),
    );
  });
});

describe('payroll Edge immutable-snapshot source invariants', () => {
  const edgeSource = readFileSync(
    join(process.cwd(), 'supabase', 'functions', 'payroll-export', 'index.ts'),
    'utf8',
  );
  const migrationSource = readFileSync(
    join(
      process.cwd(),
      'supabase',
      'migrations',
      '20260717134000_payroll_immutable_snapshots.sql',
    ),
    'utf8',
  );

  it('locks and exports exclusively through atomic service-side RPCs', () => {
    expect(edgeSource).toContain("admin.rpc('lock_payroll_period_snapshot'");
    expect(edgeSource).toContain("admin.rpc('mark_payroll_period_exported'");
    expect(edgeSource).not.toMatch(/\.from\('payroll_periods'\)[\s\S]{0,180}\.update\(/);
    expect(migrationSource).toContain('FOR UPDATE;');
    expect(migrationSource).toContain('TO service_role;');
    expect(migrationSource).toContain('FROM PUBLIC, anon, authenticated, service_role;');
    expect(edgeSource).toContain('_canonical_payload: payrollSnapshotCanonicalPayload(snapshot)');
    expect(migrationSource).toContain("extensions.digest(convert_to(_canonical_payload, 'UTF8'), 'sha256')");
    expect(migrationSource).toContain("v_canonical_json IS DISTINCT FROM (_snapshot - 'hash')");
  });

  it('exports stored snapshots and never recalculates locked legacy rows', () => {
    expect(edgeSource).toContain('const calculation = await storedCalculation(period)');
    expect(edgeSource).toContain("error.code === 'PAYROLL_SNAPSHOT_MISSING'");
    expect(edgeSource).toContain("code: 'PAYROLL_PERIOD_NOT_LOCKED'");
  });

  it('paginates every multi-row payroll source with deterministic ordering', () => {
    expect(edgeSource.match(/fetchAllPayrollRows</g)).toHaveLength(4);
    expect(edgeSource).toContain(".order('membership_id', { ascending: true })");
    expect(edgeSource).toContain(".order('effective_from', { ascending: false })");
    expect(edgeSource).toContain(".order('id', { ascending: true })");
  });

  it('allows service-role rollback only when every protected field is cleared', () => {
    expect(migrationSource).toContain("current_user = 'service_role'");
    expect(migrationSource).toContain("OLD.status IN ('locked', 'exported')");
    expect(migrationSource).toContain("NEW.status = 'open'");
    expect(migrationSource).toContain('NEW.calculation_snapshot IS NULL');
    expect(migrationSource).toContain(
      "v_is_direct_role boolean := current_user IN ('anon', 'authenticated', 'service_role')",
    );
  });

  it('revalidates exact member shapes, ordering and the active membership set', () => {
    expect(migrationSource).toContain('Payroll snapshot contains an invalid member shape');
    expect(migrationSource).toContain('Payroll snapshot membership ids must be unique and sorted');
    expect(migrationSource).toContain('Active workspace membership changed during payroll locking');
    expect(migrationSource).toContain('Payroll snapshot totals do not match member calculations');
  });
});
