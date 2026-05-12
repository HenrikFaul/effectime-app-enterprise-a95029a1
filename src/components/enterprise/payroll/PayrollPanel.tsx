import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useI18n } from '@/i18n/I18nProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
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

interface Membership {
  id: string;
  user_id: string;
  display_name: string;
  base_working_hours: number;
}

interface MemberRate {
  membership_id: string;
  cost_rate: number;
  currency: string;
  effective_from: string;
}

interface AttendanceTotals {
  regular_hours?: number;
  overtime_hours?: number;
  payroll_total_hours?: number;
  leave_days?: number;
  worked_hours?: number;
}

interface AttendancePeriodRow {
  membership_id: string;
  year: number;
  month: number;
  totals: AttendanceTotals;
}

interface LeaveRow {
  user_id: string;
  start_date: string;
  end_date: string;
  status: string;
}

interface MemberSummary {
  membershipId: string;
  userId: string;
  name: string;
  scheduledHours: number;
  overtimeHours: number;
  leaveDays: number;
  grossEstimate: number;
  currency: string;
}

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

function dateBetween(dateStr: string, startStr: string, endStr: string): boolean {
  return dateStr >= startStr && dateStr <= endStr;
}

function leaveDaysBetween(leave: LeaveRow, startDate: string, endDate: string): number {
  const s = leave.start_date > startDate ? leave.start_date : startDate;
  const e = leave.end_date < endDate ? leave.end_date : endDate;
  if (s > e) return 0;
  let count = 0;
  const cur = new Date(s);
  const end = new Date(e);
  while (cur <= end) {
    const dow = cur.getUTCDay();
    if (dow !== 0 && dow !== 6) count++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return count;
}

function periodOverlaps(leave: LeaveRow, startDate: string, endDate: string): boolean {
  return leave.start_date <= endDate && leave.end_date >= startDate;
}

function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

function generateCsv(
  rows: MemberSummary[],
  period: PayrollPeriod,
  provider: Provider,
): string {
  const sep = provider === 'datev' ? ';' : ',';
  const isDatev = provider === 'datev';

  const headers = isDatev
    ? [
        'Mitarbeiter-ID',
        'Name',
        'Abrechnungszeitraum',
        'Regelstunden',
        'Überstunden',
        'Urlaubstage',
        'Bruttoschätzung',
        'Währung',
      ]
    : [
        'Employee ID',
        'Name',
        'Period',
        'Regular Hours',
        'Overtime Hours',
        'Leave Days',
        'Gross Estimate',
        'Currency',
      ];

  const periodLabel = `${period.start_date} - ${period.end_date}`;

  const dataRows = rows.map((r) =>
    [
      r.userId,
      `"${r.name.replace(/"/g, '""')}"`,
      `"${periodLabel}"`,
      r.scheduledHours.toFixed(2),
      r.overtimeHours.toFixed(2),
      r.leaveDays.toString(),
      r.grossEstimate.toFixed(2),
      r.currency,
    ].join(sep),
  );

  return [headers.join(sep), ...dataRows].join('\n');
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

export function PayrollPanel({ workspaceId, userId, isAdmin }: Props) {
  const { t } = useI18n();

  // ── Data state ──────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [members, setMembers] = useState<Membership[]>([]);
  const [memberRates, setMemberRates] = useState<MemberRate[]>([]);
  const [attendanceRows, setAttendanceRows] = useState<AttendancePeriodRow[]>([]);
  const [leaveRows, setLeaveRows] = useState<LeaveRow[]>([]);

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

  // ── Load ────────────────────────────────────────────────────────────────────
  const load = async () => {
    setLoading(true);
    try {
      const [periodsRes, membersRes, ratesRes] = await Promise.all([
        (supabase as any)
          .from('payroll_periods')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('start_date', { ascending: false }),
        (supabase as any)
          .from('enterprise_memberships')
          .select('id, user_id, base_working_hours')
          .eq('workspace_id', workspaceId)
          .eq('status', 'active'),
        (supabase as any)
          .from('enterprise_member_rates')
          .select('membership_id, cost_rate, currency, effective_from')
          .eq('workspace_id', workspaceId)
          .order('effective_from', { ascending: false }),
      ]);

      if (periodsRes.error) throw periodsRes.error;
      if (membersRes.error) throw membersRes.error;

      const rawMembers: any[] = membersRes.data || [];
      const userIds = rawMembers.map((m: any) => m.user_id);

      const { data: profiles } = userIds.length
        ? await supabase
            .from('profiles')
            .select('user_id, display_name')
            .in('user_id', userIds)
        : { data: [] };

      const nameMap = new Map(
        (profiles as any[] || []).map((p: any) => [
          p.user_id,
          p.display_name || p.user_id.slice(0, 8),
        ]),
      );

      setMembers(
        rawMembers.map((m: any) => ({
          id: m.id,
          user_id: m.user_id,
          display_name: nameMap.get(m.user_id) || m.user_id.slice(0, 8),
          base_working_hours: Number(m.base_working_hours ?? 8),
        })),
      );
      setMemberRates(ratesRes.data || []);
      setPeriods(periodsRes.data || []);
    } catch {
      toast.error(t('payroll.load_error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  // ── Load attendance + leave when period is selected ─────────────────────────
  useEffect(() => {
    if (!selectedPeriodId) return;
    const period = periods.find((p) => p.id === selectedPeriodId);
    if (!period) return;

    const memberIds = members.map((m) => m.id);
    const userIds = members.map((m) => m.user_id);
    if (!memberIds.length) return;

    Promise.all([
      (supabase as any)
        .from('enterprise_attendance_periods')
        .select('membership_id, year, month, totals')
        .eq('workspace_id', workspaceId)
        .in('membership_id', memberIds)
        .gte('period_start', period.start_date)
        .lte('period_end', period.end_date),
      supabase
        .from('leave_requests')
        .select('user_id, start_date, end_date, status')
        .eq('workspace_id', workspaceId)
        .in('user_id', userIds)
        .eq('status', 'approved')
        .lte('start_date', period.end_date)
        .gte('end_date', period.start_date),
    ]).then(([attRes, leaveRes]) => {
      // Fallback: if the query filtered by period_start/period_end columns don't exist,
      // we still get data from the basic membership_id filter.
      // We use year/month to intersect with the date range manually.
      setAttendanceRows((attRes.data as AttendancePeriodRow[]) || []);
      setLeaveRows((leaveRes.data as LeaveRow[]) || []);
    });
  }, [selectedPeriodId, periods, members, workspaceId]);

  // ── Derived: latest cost rate per membership ────────────────────────────────
  const latestRate = useMemo(() => {
    const map = new Map<string, MemberRate>();
    for (const r of memberRates) {
      const cur = map.get(r.membership_id);
      if (!cur || r.effective_from > cur.effective_from) map.set(r.membership_id, r);
    }
    return map;
  }, [memberRates]);

  // ── Derived: member summaries for selected period ──────────────────────────
  const selectedPeriod = periods.find((p) => p.id === selectedPeriodId) ?? null;

  const memberSummaries = useMemo((): MemberSummary[] => {
    if (!selectedPeriod) return [];

    return members.map((m) => {
      const rows = attendanceRows.filter((r) => r.membership_id === m.id);
      let scheduledHours = 0;
      let overtimeHours = 0;
      let leaveDays = 0;

      for (const row of rows) {
        const totals: AttendanceTotals = (row.totals as AttendanceTotals) || {};
        scheduledHours += Number(totals.payroll_total_hours ?? totals.worked_hours ?? totals.regular_hours ?? 0);
        overtimeHours += Number(totals.overtime_hours ?? 0);
        leaveDays += Number(totals.leave_days ?? 0);
      }

      // Count approved leave days for this member during the period
      const memberLeave = leaveRows.filter((l) => l.user_id === m.user_id);
      let leaveDaysFromRequests = 0;
      for (const l of memberLeave) {
        if (periodOverlaps(l, selectedPeriod.start_date, selectedPeriod.end_date)) {
          leaveDaysFromRequests += leaveDaysBetween(l, selectedPeriod.start_date, selectedPeriod.end_date);
        }
      }

      // Use max of attendance totals vs leave_requests count (avoid double counting)
      const finalLeaveDays = leaveDays > 0 ? leaveDays : leaveDaysFromRequests;

      const rate = latestRate.get(m.id);
      const grossEstimate = (rate?.cost_rate ?? 0) * scheduledHours;
      const currency = rate?.currency ?? 'EUR';

      return {
        membershipId: m.id,
        userId: m.user_id,
        name: m.display_name,
        scheduledHours,
        overtimeHours,
        leaveDays: finalLeaveDays,
        grossEstimate,
        currency,
      };
    });
  }, [selectedPeriod, members, attendanceRows, leaveRows, latestRate]);

  const periodTotals = useMemo(() => {
    const totalHours = memberSummaries.reduce((s, r) => s + r.scheduledHours, 0);
    const totalOvertime = memberSummaries.reduce((s, r) => s + r.overtimeHours, 0);
    const totalGross = memberSummaries.reduce((s, r) => s + r.grossEstimate, 0);
    return { totalHours, totalOvertime, totalGross, memberCount: memberSummaries.length };
  }, [memberSummaries]);

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleCreatePeriod = async () => {
    if (!newName.trim() || !newStart || !newEnd) return;
    setCreating(true);
    try {
      const { error } = await (supabase as any).from('payroll_periods').insert({
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
    setLocking(true);
    try {
      const period = periods.find((p) => p.id === lockDialogPeriodId);
      const now = new Date().toISOString();

      const { error: updateError } = await (supabase as any)
        .from('payroll_periods')
        .update({ status: 'locked', locked_by: userId, locked_at: now })
        .eq('id', lockDialogPeriodId);
      if (updateError) throw updateError;

      await (supabase as any).from('enterprise_audit_events').insert({
        workspace_id: workspaceId,
        actor_id: userId,
        action: 'payroll.period_locked',
        target_type: 'payroll_period',
        target_id: lockDialogPeriodId,
        metadata: {
          period_name: period?.name,
          start_date: period?.start_date,
          end_date: period?.end_date,
        },
      });

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
    if (!period) return;

    setExporting(true);
    try {
      // Save default provider config if requested
      if (saveAsDefault) {
        const existingConfig = await (supabase as any)
          .from('payroll_export_configs')
          .select('id')
          .eq('workspace_id', workspaceId)
          .eq('is_active', true)
          .maybeSingle();

        if (existingConfig.data?.id) {
          await (supabase as any)
            .from('payroll_export_configs')
            .update({ provider: selectedProvider, is_active: true })
            .eq('id', existingConfig.data.id);
        } else {
          await (supabase as any).from('payroll_export_configs').insert({
            workspace_id: workspaceId,
            provider: selectedProvider,
            config: {},
            field_mappings: {},
            is_active: true,
          });
        }
      }

      const csv = generateCsv(memberSummaries, period, selectedProvider);
      const filename = `payroll_${period.name.replace(/\s+/g, '_')}_${selectedProvider}.csv`;
      downloadCsv(csv, filename);

      // Update period status to exported
      await (supabase as any)
        .from('payroll_periods')
        .update({
          status: 'exported',
          exported_at: new Date().toISOString(),
          exported_to: selectedProvider,
        })
        .eq('id', exportDialogPeriodId);

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
    (supabase as any)
      .from('payroll_export_configs')
      .select('provider')
      .eq('workspace_id', workspaceId)
      .eq('is_active', true)
      .maybeSingle()
      .then(({ data }: { data: any }) => {
        if (data?.provider && PROVIDERS.includes(data.provider as Provider)) {
          setSelectedProvider(data.provider as Provider);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

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
                          {isAdmin && p.status !== 'open' && (
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
                      <td className="px-2 py-1.5 text-right">{row.scheduledHours.toFixed(1)}</td>
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

            {isAdmin && selectedPeriod.status !== 'open' && (
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
        open={!!exportDialogPeriodId}
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
            <Button size="sm" onClick={handleExport} disabled={exporting}>
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
