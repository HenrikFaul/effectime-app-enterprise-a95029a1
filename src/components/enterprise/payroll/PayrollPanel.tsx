import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useI18n } from '@/i18n/I18nProvider';
import { useFeature } from '@/hooks/useFeature';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Clock, Users, TrendingUp, AlertCircle, Download, Lock, Plus, Eye } from 'lucide-react';
import { toast } from 'sonner';

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

interface Props {
  workspaceId: string;
  userId: string;
  isAdmin: boolean;
}

interface PayrollPeriod {
  id: string;
  workspace_id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: 'open' | 'locked' | 'exported';
  locked_by: string | null;
  locked_at: string | null;
  exported_at: string | null;
  exported_to: string | null;
  created_at: string;
}

interface MemberSummary {
  membershipId: string;
  name: string;
  regularHours: number;
  overtimeHours: number;
  totalHours: number;
  leaveDays: number;
  grossEstimate: number;
  currency: string;
}

interface PeriodTotals {
  totalHours: number;
  totalOvertime: number;
  totalGross: number;
  memberCount: number;
}

interface PayrollCalculation {
  members: MemberSummary[];
  totals: PeriodTotals;
}

interface PayrollExportPayload {
  csv: string;
  filename: string;
}

type PayrollFunctionBody =
  | { action: 'calculate-period'; workspaceId: string; periodId: string }
  | { action: 'lock-period'; workspaceId: string; periodId: string }
  | { action: 'export-csv'; workspaceId: string; periodId: string; provider: Provider };

export type PayrollFunctionInvoker = (
  body: PayrollFunctionBody,
) => Promise<{ data: unknown; error: unknown }>;

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

const PROVIDERS = [
  'datev',
  'bamboohr',
  'personio',
  'sap',
  'workday',
  'adp',
  'sage',
  'billingo',
  'szamlazz',
  'pohoda',
  'generic',
] as const;

type Provider = (typeof PROVIDERS)[number];

function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function parseMemberSummary(value: unknown): MemberSummary | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.membership_id !== 'string' ||
    typeof value.display_name !== 'string' ||
    !isFiniteNonNegativeNumber(value.regular_hours) ||
    !isFiniteNonNegativeNumber(value.overtime_hours) ||
    !isFiniteNonNegativeNumber(value.leave_days) ||
    !isFiniteNonNegativeNumber(value.gross_estimate) ||
    typeof value.currency !== 'string' ||
    value.currency.trim() === ''
  ) {
    return null;
  }

  return {
    membershipId: value.membership_id,
    name: value.display_name,
    regularHours: value.regular_hours,
    overtimeHours: value.overtime_hours,
    totalHours: value.regular_hours + value.overtime_hours,
    leaveDays: value.leave_days,
    grossEstimate: value.gross_estimate,
    currency: value.currency,
  };
}

// Contract parsers stay co-located with their only production consumer.
// eslint-disable-next-line react-refresh/only-export-components
export function parsePayrollCalculation(value: unknown): PayrollCalculation | null {
  if (!isRecord(value) || !Array.isArray(value.members) || !isRecord(value.totals)) return null;

  const members = value.members.map(parseMemberSummary);
  if (members.some((member) => member === null)) return null;

  const totals = value.totals;
  if (
    !isFiniteNonNegativeNumber(totals.total_hours) ||
    !isFiniteNonNegativeNumber(totals.total_overtime) ||
    !isFiniteNonNegativeNumber(totals.total_gross) ||
    !isFiniteNonNegativeNumber(totals.member_count) ||
    !Number.isInteger(totals.member_count) ||
    totals.member_count !== members.length
  ) {
    return null;
  }

  return {
    members: members as MemberSummary[],
    totals: {
      totalHours: totals.total_hours,
      totalOvertime: totals.total_overtime,
      totalGross: totals.total_gross,
      memberCount: totals.member_count,
    },
  };
}

function parsePayrollExport(value: unknown): PayrollExportPayload | null {
  if (!isRecord(value) || typeof value.csv !== 'string' || value.csv.length === 0) return null;
  if (
    typeof value.filename !== 'string' ||
    !/^[a-zA-Z0-9._-]+\.csv$/.test(value.filename)
  ) {
    return null;
  }
  return { csv: value.csv, filename: value.filename };
}

function asActionError(error: unknown, fallback: string): Error {
  return error instanceof Error ? error : new Error(fallback);
}

function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// eslint-disable-next-line react-refresh/only-export-components
export async function calculatePayrollPeriod(
  invoke: PayrollFunctionInvoker,
  workspaceId: string,
  periodId: string,
): Promise<PayrollCalculation> {
  const { data, error } = await invoke({ action: 'calculate-period', workspaceId, periodId });
  if (error) throw asActionError(error, 'Payroll calculation failed');
  const calculation = parsePayrollCalculation(data);
  if (!calculation) throw new Error('Payroll calculation returned an invalid response');
  return calculation;
}

// eslint-disable-next-line react-refresh/only-export-components
export async function lockPayrollPeriod(
  invoke: PayrollFunctionInvoker,
  workspaceId: string,
  periodId: string,
): Promise<void> {
  const { data, error } = await invoke({ action: 'lock-period', workspaceId, periodId });
  if (error) throw asActionError(error, 'Payroll period lock failed');
  if (!isRecord(data) || data.success !== true) {
    throw new Error('Payroll period lock returned an invalid response');
  }
}

// eslint-disable-next-line react-refresh/only-export-components
export async function exportPayrollCsv(
  invoke: PayrollFunctionInvoker,
  workspaceId: string,
  periodId: string,
  provider: Provider,
  download: (csv: string, filename: string) => void,
): Promise<void> {
  const { data, error } = await invoke({
    action: 'export-csv',
    workspaceId,
    periodId,
    provider,
  });
  if (error) throw asActionError(error, 'Payroll export failed');
  const payload = parsePayrollExport(data);
  if (!payload) throw new Error('Payroll export returned an invalid response');
  download(payload.csv, payload.filename);
}

// ──────────────────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────────────────

function KpiCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card className="flex-1 min-w-0">
      <CardContent className="px-4 py-3 flex items-center gap-3">
        <div className="shrink-0 text-muted-foreground">{icon}</div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className="text-lg font-semibold leading-tight truncate">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status, t }: { status: PayrollPeriod['status']; t: (k: string) => string }) {
  const map: Record<PayrollPeriod['status'], string> = {
    open: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    locked: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    exported: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  };
  const label: Record<PayrollPeriod['status'], string> = {
    open: t('payroll.status_open'),
    locked: t('payroll.status_locked'),
    exported: t('payroll.status_exported'),
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${map[status]}`}>
      {label[status]}
    </span>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────────────────────────────────────

export function PayrollPanel({ workspaceId, isAdmin }: Props) {
  const { t } = useI18n();
  const { enabled: payrollExportEnabled, isLoading: payrollExportLoading } = useFeature(
    workspaceId,
    'payroll_export',
  );

  // ── Data state ──────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [calculation, setCalculation] = useState<PayrollCalculation | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState(false);

  // ── UI state ────────────────────────────────────────────────────────────────
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [creating, setCreating] = useState(false);

  const [lockDialogPeriodId, setLockDialogPeriodId] = useState<string | null>(null);
  const [locking, setLocking] = useState(false);

  const [exportDialogPeriodId, setExportDialogPeriodId] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<Provider>('generic');
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const [exporting, setExporting] = useState(false);

  const invokePayroll: PayrollFunctionInvoker = async (body) => {
    const { data, error } = await supabase.functions.invoke('payroll-export', { body });
    return { data, error };
  };

  // ── Load ────────────────────────────────────────────────────────────────────
  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('payroll_periods')
        .select(
          'id, workspace_id, name, start_date, end_date, status, locked_by, locked_at, exported_at, exported_to, created_at',
        )
        .eq('workspace_id', workspaceId)
        .order('start_date', { ascending: false });

      if (error) throw error;
      const rows = data ?? [];
      if (rows.some((period) => !['open', 'locked', 'exported'].includes(period.status))) {
        throw new Error('Payroll period response contains an unsupported status');
      }
      const nextPeriods = rows as PayrollPeriod[];
      setPeriods(nextPeriods);
      setSelectedPeriodId((current) =>
        current && nextPeriods.some((period) => period.id === current) ? current : null,
      );
    } catch {
      toast.error(t('payroll.load_error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPeriods([]);
    setSelectedPeriodId(null);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  // The Edge Function owns the payroll calculation contract. Keeping this
  // server-side prevents schema drift and avoids duplicating payroll rules in UI.
  useEffect(() => {
    let cancelled = false;
    setCalculation(null);
    setSummaryError(false);

    if (!selectedPeriodId) {
      setSummaryLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setSummaryLoading(true);
    calculatePayrollPeriod(invokePayroll, workspaceId, selectedPeriodId)
      .then((result) => {
        if (!cancelled) setCalculation(result);
      })
      .catch(() => {
        if (cancelled) return;
        setSummaryError(true);
        toast.error(t('payroll.load_error'));
      })
      .finally(() => {
        if (!cancelled) setSummaryLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // invokePayroll is a thin wrapper around the stable Supabase singleton.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPeriodId, workspaceId]);

  const selectedPeriod = periods.find((period) => period.id === selectedPeriodId) ?? null;
  const memberSummaries = calculation?.members ?? [];
  const periodTotals = calculation?.totals ?? {
    totalHours: 0,
    totalOvertime: 0,
    totalGross: 0,
    memberCount: 0,
  };

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleCreatePeriod = async () => {
    if (!newName.trim() || !newStart || !newEnd) return;
    setCreating(true);
    try {
      const { error } = await supabase.from('payroll_periods').insert({
        workspace_id: workspaceId,
        name: newName.trim(),
        start_date: newStart,
        end_date: newEnd,
        status: 'open',
      });
      if (error) throw error;
      setShowNewForm(false);
      setNewName('');
      setNewStart('');
      setNewEnd('');
      await load();
    } catch {
      toast.error(t('payroll.load_error'));
    } finally {
      setCreating(false);
    }
  };

  const handleLock = async () => {
    if (!lockDialogPeriodId) return;
    const period = periods.find((item) => item.id === lockDialogPeriodId);
    if (!period || period.status !== 'open') {
      toast.error(t('payroll.load_error'));
      return;
    }
    setLocking(true);
    try {
      await lockPayrollPeriod(invokePayroll, workspaceId, lockDialogPeriodId);
      toast.success(t('payroll.lock_success'));
      setLockDialogPeriodId(null);
      await load();
    } catch {
      toast.error(t('payroll.load_error'));
    } finally {
      setLocking(false);
    }
  };

  const handleExport = async () => {
    if (!exportDialogPeriodId) return;
    const period = periods.find((p) => p.id === exportDialogPeriodId);
    if (
      payrollExportLoading ||
      !payrollExportEnabled ||
      !period ||
      (period.status !== 'locked' && period.status !== 'exported')
    ) {
      toast.error(t('payroll.load_error'));
      return;
    }

    setExporting(true);
    try {
      // Save default provider config if requested
      if (saveAsDefault) {
        const existingConfig = await supabase
          .from('payroll_export_configs')
          .select('id')
          .eq('workspace_id', workspaceId)
          .eq('is_active', true)
          .maybeSingle();
        if (existingConfig.error) throw existingConfig.error;

        if (existingConfig.data?.id) {
          const { error: saveError } = await supabase
            .from('payroll_export_configs')
            .update({ provider: selectedProvider, is_active: true })
            .eq('id', existingConfig.data.id);
          if (saveError) throw saveError;
        } else {
          const { error: saveError } = await supabase.from('payroll_export_configs').insert({
            workspace_id: workspaceId,
            provider: selectedProvider,
            config: {},
            field_mappings: {},
            is_active: true,
          });
          if (saveError) throw saveError;
        }
      }

      await exportPayrollCsv(
        invokePayroll,
        workspaceId,
        exportDialogPeriodId,
        selectedProvider,
        downloadCsv,
      );
      toast.success(t('payroll.export_success'));
      setExportDialogPeriodId(null);
      await load();
    } catch {
      toast.error(t('payroll.load_error'));
    } finally {
      setExporting(false);
    }
  };

  // ── Load default provider on mount ─────────────────────────────────────────
  useEffect(() => {
    if (payrollExportLoading || !payrollExportEnabled) {
      setSelectedProvider('generic');
      return;
    }

    let cancelled = false;
    supabase
      .from('payroll_export_configs')
      .select('provider')
      .eq('workspace_id', workspaceId)
      .eq('is_active', true)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setSelectedProvider('generic');
          toast.error(t('payroll.load_error'));
          return;
        }
        if (data?.provider && PROVIDERS.includes(data.provider as Provider)) {
          setSelectedProvider(data.provider as Provider);
        } else {
          setSelectedProvider('generic');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, payrollExportEnabled, payrollExportLoading, t]);

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="ml-3 text-sm text-muted-foreground">{t('payroll.loading')}</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Payroll periods list ────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">{t('payroll.periods_title')}</CardTitle>
          {isAdmin && (
            <Button size="sm" variant="outline" onClick={() => setShowNewForm((v) => !v)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              {t('payroll.new_period_btn')}
            </Button>
          )}
        </CardHeader>

        {showNewForm && (
          <CardContent className="px-4 pb-4 pt-0">
            <div className="border rounded-md p-3 bg-muted/30 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">{t('payroll.period_name_label')}</Label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="h-8 text-xs"
                    placeholder={t('payroll.period_name_label')}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t('payroll.period_start_label')}</Label>
                  <Input
                    type="date"
                    value={newStart}
                    onChange={(e) => setNewStart(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t('payroll.period_end_label')}</Label>
                  <Input
                    type="date"
                    value={newEnd}
                    onChange={(e) => setNewEnd(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowNewForm(false);
                    setNewName('');
                    setNewStart('');
                    setNewEnd('');
                  }}
                >
                  {t('payroll.cancel_btn')}
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreatePeriod}
                  disabled={creating || !newName.trim() || !newStart || !newEnd}
                >
                  {t('payroll.create_period_btn')}
                </Button>
              </div>
            </div>
          </CardContent>
        )}

        <CardContent className="px-4 pb-4 pt-0">
          {periods.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
              <AlertCircle className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">{t('payroll.no_periods')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="text-left px-2 py-1.5 font-medium">{t('payroll.col_name')}</th>
                    <th className="text-left px-2 py-1.5 font-medium">{t('payroll.col_start')}</th>
                    <th className="text-left px-2 py-1.5 font-medium">{t('payroll.col_end')}</th>
                    <th className="text-left px-2 py-1.5 font-medium">{t('payroll.col_status')}</th>
                    <th className="text-left px-2 py-1.5 font-medium">{t('payroll.col_actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {periods.map((p) => (
                    <tr
                      key={p.id}
                      className={`border-t transition-colors ${
                        selectedPeriodId === p.id ? 'bg-primary/5' : 'hover:bg-muted/20'
                      }`}
                    >
                      <td className="px-2 py-1.5 font-medium">{p.name}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{formatDate(p.start_date)}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{formatDate(p.end_date)}</td>
                      <td className="px-2 py-1.5">
                        <StatusBadge status={p.status} t={t} />
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex gap-1 flex-wrap">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-xs"
                            onClick={() =>
                              setSelectedPeriodId(selectedPeriodId === p.id ? null : p.id)
                            }
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            {t('payroll.col_actions')}
                          </Button>
                          {isAdmin && p.status === 'open' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                              onClick={() => setLockDialogPeriodId(p.id)}
                            >
                              <Lock className="h-3 w-3 mr-1" />
                              {t('payroll.lock_btn')}
                            </Button>
                          )}
                          {isAdmin &&
                            payrollExportEnabled &&
                            (p.status === 'locked' || p.status === 'exported') && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                              onClick={() => {
                                setSelectedPeriodId(p.id);
                                setExportDialogPeriodId(p.id);
                              }}
                            >
                              <Download className="h-3 w-3 mr-1" />
                              {t('payroll.export_btn')}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Period summary ──────────────────────────────────────────────────── */}
      {selectedPeriod ? (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm">
              {t('payroll.summary_title')} — {selectedPeriod.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0 space-y-4">
            {summaryLoading ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
                {t('payroll.loading')}
              </div>
            ) : summaryError || !calculation ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4 mr-2" />
                {t('payroll.load_error')}
              </div>
            ) : (
              <>
                {/* KPI cards */}
                <div className="flex gap-2 flex-wrap">
              <KpiCard
                icon={<Clock className="h-4 w-4" />}
                label={t('payroll.kpi_total_hours')}
                value={`${periodTotals.totalHours.toFixed(1)}h`}
              />
              <KpiCard
                icon={<TrendingUp className="h-4 w-4" />}
                label={t('payroll.kpi_overtime_hours')}
                value={`${periodTotals.totalOvertime.toFixed(1)}h`}
              />
              <KpiCard
                icon={<TrendingUp className="h-4 w-4" />}
                label={t('payroll.kpi_gross_estimate')}
                value={periodTotals.totalGross.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}
              />
              <KpiCard
                icon={<Users className="h-4 w-4" />}
                label={t('payroll.kpi_members')}
                value={String(periodTotals.memberCount)}
              />
                </div>

                {/* Member table */}
                <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="text-left px-2 py-1.5 font-medium">{t('payroll.col_member')}</th>
                    <th className="text-right px-2 py-1.5 font-medium">{t('payroll.col_hours')}</th>
                    <th className="text-right px-2 py-1.5 font-medium">{t('payroll.col_overtime')}</th>
                    <th className="text-right px-2 py-1.5 font-medium">{t('payroll.col_leave_days')}</th>
                    <th className="text-right px-2 py-1.5 font-medium">{t('payroll.col_gross')}</th>
                    <th className="text-right px-2 py-1.5 font-medium">{t('payroll.col_currency')}</th>
                  </tr>
                </thead>
                <tbody>
                  {memberSummaries.map((row) => (
                    <tr key={row.membershipId} className="border-t hover:bg-muted/10">
                      <td className="px-2 py-1.5 font-medium">{row.name}</td>
                      <td className="px-2 py-1.5 text-right">{row.totalHours.toFixed(1)}</td>
                      <td className="px-2 py-1.5 text-right">
                        {row.overtimeHours > 0 ? (
                          <span className="text-orange-600 font-medium">
                            {row.overtimeHours.toFixed(1)}
                          </span>
                        ) : (
                          '0.0'
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right">{row.leaveDays}</td>
                      <td className="px-2 py-1.5 text-right">
                        {row.grossEstimate.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                      <td className="px-2 py-1.5 text-right text-muted-foreground">{row.currency}</td>
                    </tr>
                  ))}
                  {memberSummaries.length > 0 && (
                    <tr className="border-t border-t-2 font-semibold bg-muted/20">
                      <td className="px-2 py-1.5">{t('payroll.total_row')}</td>
                      <td className="px-2 py-1.5 text-right">
                        {periodTotals.totalHours.toFixed(1)}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        {periodTotals.totalOvertime.toFixed(1)}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        {memberSummaries.reduce((s, r) => s + r.leaveDays, 0)}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        {periodTotals.totalGross.toLocaleString(undefined, {
                          maximumFractionDigits: 0,
                        })}
                      </td>
                      <td className="px-2 py-1.5 text-right" />
                    </tr>
                  )}
                </tbody>
              </table>
                </div>

                {isAdmin &&
                  payrollExportEnabled &&
                  (selectedPeriod.status === 'locked' || selectedPeriod.status === 'exported') && (
                    <div className="flex justify-end pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setExportDialogPeriodId(selectedPeriod.id)}
                      >
                        <Download className="h-3.5 w-3.5 mr-1.5" />
                        {t('payroll.export_btn')}
                      </Button>
                    </div>
                  )}
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
          {t('payroll.select_period_hint')}
        </div>
      )}

      {/* ── Lock confirmation dialog ────────────────────────────────────────── */}
      <Dialog open={!!lockDialogPeriodId} onOpenChange={(o) => !o && setLockDialogPeriodId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-orange-500" />
              {t('payroll.lock_confirm_title')}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t('payroll.lock_confirm_desc')}</p>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setLockDialogPeriodId(null)}>
              {t('payroll.cancel_btn')}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleLock}
              disabled={locking}
            >
              {locking ? (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-background border-t-transparent mr-1.5" />
              ) : (
                <Lock className="h-3.5 w-3.5 mr-1.5" />
              )}
              {t('payroll.lock_confirm_btn')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Export dialog ───────────────────────────────────────────────────── */}
      <Dialog
        open={!!exportDialogPeriodId && payrollExportEnabled && !payrollExportLoading}
        onOpenChange={(o) => !o && setExportDialogPeriodId(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-4 w-4 text-primary" />
              {t('payroll.export_title')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">{t('payroll.provider_label')}</Label>
              <Select
                value={selectedProvider}
                onValueChange={(v) => setSelectedProvider(v as Provider)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="datev">{t('payroll.provider_datev')}</SelectItem>
                  <SelectItem value="bamboohr">{t('payroll.provider_bamboohr')}</SelectItem>
                  <SelectItem value="personio">{t('payroll.provider_personio')}</SelectItem>
                  <SelectItem value="sap">{t('payroll.provider_sap')}</SelectItem>
                  <SelectItem value="workday">{t('payroll.provider_workday')}</SelectItem>
                  <SelectItem value="adp">{t('payroll.provider_adp')}</SelectItem>
                  <SelectItem value="sage">{t('payroll.provider_sage')}</SelectItem>
                  <SelectItem value="billingo">{t('payroll.provider_billingo')}</SelectItem>
                  <SelectItem value="szamlazz">{t('payroll.provider_szamlazz')}</SelectItem>
                  <SelectItem value="pohoda">{t('payroll.provider_pohoda')}</SelectItem>
                  <SelectItem value="generic">{t('payroll.provider_generic')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="save-default"
                checked={saveAsDefault}
                onCheckedChange={(v) => setSaveAsDefault(!!v)}
              />
              <Label htmlFor="save-default" className="text-xs cursor-pointer">
                {t('payroll.save_default_provider')}
              </Label>
            </div>

            {exportDialogPeriodId && (
              <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                {(() => {
                  const p = periods.find((x) => x.id === exportDialogPeriodId);
                  if (!p) return null;
                  return `${p.name} · ${formatDate(p.start_date)} – ${formatDate(p.end_date)} · ${memberSummaries.length} members`;
                })()}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setExportDialogPeriodId(null)}>
              {t('payroll.cancel_btn')}
            </Button>
            <Button
              size="sm"
              onClick={handleExport}
              disabled={exporting || payrollExportLoading || !payrollExportEnabled}
            >
              {exporting ? (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-background border-t-transparent mr-1.5" />
              ) : (
                <Download className="h-3.5 w-3.5 mr-1.5" />
              )}
              {t('payroll.export_btn')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
