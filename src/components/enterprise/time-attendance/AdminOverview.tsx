import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ChevronLeft, ChevronRight, Download, FileSpreadsheet, FileText,
  CheckCircle2, RotateCcw, Lock, Loader2, Send, AlertTriangle,
  XCircle, ChevronDown,
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { format, getYear, getMonth, addMonths, subMonths } from 'date-fns';
import { hu } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  listWorkspacePeriods, transitionPeriod, fetchPayrollExport, recordPayrollExport,
} from './api';
import { generateCSV, generateExcelXML, downloadFile } from '../import-export/utils/file-parser';
import { STATUS_LABELS, STATUS_BADGE_VARIANT, type AdminPeriodRow } from './types';
import { useI18n } from '@/i18n/I18nProvider';

interface Props {
  workspaceId: string;
}

const PAYROLL_COLUMNS = [
  { key: 'email', label: 'Email' },
  { key: 'display_name', label: 'Name' },
  { key: 'team', label: 'Team' },
  { key: 'business_role', label: 'Role' },
  { key: 'office_name', label: 'Site' },
  { key: 'period_label', label: 'Period' },
  { key: 'status', label: 'Status' },
  { key: 'regular_hours', label: 'Regular h' },
  { key: 'overtime_hours', label: 'OT h' },
  { key: 'weekend_overtime_hours', label: 'WE OT h' },
  { key: 'night_hours', label: 'Night h' },
  { key: 'oncall_intervention_hours', label: 'Callout h' },
  { key: 'oncall_standby_hours', label: 'Standby h' },
  { key: 'oncall_standby_compensated_hours', label: 'Standby comp h (×0.20)' },
  { key: 'expected_hours', label: 'Expected h' },
  { key: 'leave_days', label: 'Leave days' },
  { key: 'leave_hours', label: 'Leave h' },
  { key: 'expected_after_leave', label: 'Expected after leave' },
  { key: 'worked_hours', label: 'Worked h' },
  { key: 'payroll_total_hours', label: 'Payroll total h' },
  { key: 'submitted_at', label: 'Submitted at' },
  { key: 'approved_at', label: 'Approved at' },
  { key: 'locked_at', label: 'Locked at' },
] as const;

export function AdminOverview({ workspaceId }: Props) {
  const { t } = useI18n();
  const today = new Date();
  const [year, setYear] = useState(getYear(today));
  const [month, setMonth] = useState(getMonth(today) + 1);
  const [rows, setRows] = useState<AdminPeriodRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [exporting, setExporting] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const data = await listWorkspacePeriods(workspaceId, year, month);
      setRows(data);
    } catch (e: any) {
      toast.error(e?.message || t('attendance.list_load_failed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); /* eslint-disable-line */ }, [workspaceId, year, month]);

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    return rows.filter(r => {
      if (s && !`${r.display_name} ${r.email}`.toLowerCase().includes(s)) return false;
      if (statusFilter !== 'all') {
        if (statusFilter === 'no_period' && r.status !== null) return false;
        if (statusFilter !== 'no_period' && r.status !== statusFilter) return false;
      }
      return true;
    });
  }, [rows, search, statusFilter]);

  const summary = useMemo(() => {
    const acc = {
      members: rows.length,
      submitted: 0, approved: 0, locked: 0, exported: 0, draft: 0, returned: 0, no_period: 0,
      total_payroll: 0, total_overtime: 0, total_oncall: 0,
    };
    for (const r of rows) {
      if (!r.status) acc.no_period++;
      else acc[r.status]++;
      if (r.totals) {
        acc.total_payroll += r.totals.payroll_total_hours || 0;
        acc.total_overtime += (r.totals.overtime_hours || 0) + (r.totals.weekend_overtime_hours || 0);
        acc.total_oncall += r.totals.oncall_standby_hours || 0;
      }
    }
    return acc;
  }, [rows]);

  const handlePrev = () => { const d = subMonths(new Date(year, month - 1), 1); setYear(getYear(d)); setMonth(getMonth(d) + 1); };
  const handleNext = () => { const d = addMonths(new Date(year, month - 1), 1); setYear(getYear(d)); setMonth(getMonth(d) + 1); };

  const doTransition = async (periodId: string, target: any, reason?: string) => {
    try {
      await transitionPeriod(periodId, target, reason);
      toast.success(t('attendance.status_updated'));
      reload();
    } catch (e: any) {
      toast.error(e?.message || t('attendance.action_failed'));
    }
  };

  const handleExport = async (fmt: 'xlsx' | 'csv', onlyLocked: boolean) => {
    setExporting(true);
    try {
      const exportRows = await fetchPayrollExport(workspaceId, year, month, onlyLocked);
      if (exportRows.length === 0) {
        toast.error(onlyLocked ? t('attendance.export_empty_locked') : t('attendance.export_empty'));
        return;
      }
      const headers = PAYROLL_COLUMNS.map(c => c.label);
      const dataRows = exportRows.map(r => PAYROLL_COLUMNS.map(c => {
        const v = (r as any)[c.key];
        if (v === null || v === undefined) return '';
        return String(v);
      }));
      const periodLabel = `${year}_${String(month).padStart(2, '0')}`;
      if (fmt === 'xlsx') {
        const xml = generateExcelXML(headers, dataRows, { sheetName: 'Payroll' });
        downloadFile(xml, `attendance_payroll_${periodLabel}.xls`, 'application/vnd.ms-excel');
      } else {
        const csv = generateCSV(headers, dataRows);
        downloadFile(csv, `attendance_payroll_${periodLabel}.csv`, 'text/csv;charset=utf-8');
      }
      await recordPayrollExport(workspaceId, year, month, 'summary', fmt, exportRows);
      toast.success(t('attendance.export_done', { count: exportRows.length }));
      reload();
    } catch (e: any) {
      toast.error(e?.message || t('attendance.export_failed'));
    } finally {
      setExporting(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center p-8 text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin mr-2" /> {t('common.loading')}
    </div>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="ghost" onClick={handlePrev}><ChevronLeft className="h-4 w-4" /></Button>
            <CardTitle className="text-base tabular-nums">
              {format(new Date(year, month - 1, 1), 'yyyy. MMMM', { locale: hu })}
            </CardTitle>
            <Button size="sm" variant="ghost" onClick={handleNext}><ChevronRight className="h-4 w-4" /></Button>
            <div className="ml-auto flex items-center gap-2 flex-wrap">
              <Button size="sm" variant="outline" disabled={exporting} onClick={() => handleExport('xlsx', true)}>
                <FileSpreadsheet className="h-3 w-3 mr-1" /> {t('attendance.export_xlsx')}
              </Button>
              <Button size="sm" variant="ghost" disabled={exporting} onClick={() => handleExport('csv', false)}>
                <FileText className="h-3 w-3 mr-1" /> {t('attendance.export_csv')}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mt-3 text-xs">
            <SummaryStat label={t('attendance.summary_members')} value={summary.members} />
            <SummaryStat label={t('attendance.summary_submitted')} value={summary.submitted} tone="warning" />
            <SummaryStat label={t('attendance.summary_approved')} value={summary.approved} tone="primary" />
            <SummaryStat label={t('attendance.summary_locked')} value={summary.locked} tone="primary" />
            <SummaryStat label={t('attendance.summary_missing')} value={summary.no_period + summary.draft} tone={summary.no_period > 0 ? 'destructive' : 'muted'} />
            <SummaryStat label={t('attendance.summary_payroll_total')} value={`${summary.total_payroll.toFixed(1)}h`} tone="primary" />
          </div>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          <div className="flex items-center gap-2 mb-2">
            <Input placeholder={t('attendance.search_placeholder')} value={search} onChange={e => setSearch(e.target.value)} className="h-8 max-w-sm" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-[170px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('attendance.all_statuses')}</SelectItem>
                <SelectItem value="draft">{t('attendance.status_draft')}</SelectItem>
                <SelectItem value="submitted">{t('attendance.status_submitted')}</SelectItem>
                <SelectItem value="returned">{t('attendance.status_returned')}</SelectItem>
                <SelectItem value="approved">{t('attendance.status_approved')}</SelectItem>
                <SelectItem value="locked">{t('attendance.status_locked')}</SelectItem>
                <SelectItem value="exported">{t('attendance.status_exported')}</SelectItem>
                <SelectItem value="no_period">{t('attendance.status_missing')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <PayrollReadinessPanel rows={rows} t={t} />

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-wide text-muted-foreground border-b">
                <tr>
                  <th className="text-left px-2 py-2">{t('attendance.col_member')}</th>
                  <th className="text-left px-2 py-2">{t('attendance.col_status')}</th>
                  <th className="text-right px-2 py-2 tabular-nums">{t('attendance.col_worked')}</th>
                  <th className="text-right px-2 py-2 tabular-nums">{t('attendance.col_overtime')}</th>
                  <th className="text-right px-2 py-2 tabular-nums">{t('attendance.col_weekend_ot')}</th>
                  <th className="text-right px-2 py-2 tabular-nums">{t('attendance.col_night')}</th>
                  <th className="text-right px-2 py-2 tabular-nums">{t('attendance.col_standby')}</th>
                  <th className="text-right px-2 py-2 tabular-nums">{t('attendance.col_callout')}</th>
                  <th className="text-right px-2 py-2 tabular-nums">{t('attendance.col_payroll_total')}</th>
                  <th className="text-right px-2 py-2">{t('attendance.col_action')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={10} className="text-center py-6 text-muted-foreground">{t('attendance.no_results')}</td></tr>
                )}
                {filtered.map(r => {
                  const totals = r.totals;
                  return (
                    <tr key={r.membership_id} className="border-b hover:bg-muted/30">
                      <td className="px-2 py-1.5 min-w-0">
                        <div className="font-medium truncate">{r.display_name || '—'}</div>
                        <div className="text-xs text-muted-foreground truncate">{r.email}</div>
                      </td>
                      <td className="px-2 py-1.5">
                        {r.status ? (
                          <Badge variant={STATUS_BADGE_VARIANT[r.status]} className="text-[10px]">
                            {STATUS_LABELS[r.status]}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">{t('attendance.status_missing')}</Badge>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{totals?.worked_hours ?? '—'}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{totals?.overtime_hours ?? '—'}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{totals?.weekend_overtime_hours ?? '—'}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{totals?.night_hours ?? '—'}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {totals ? `${totals.oncall_standby_hours} (${totals.oncall_standby_compensated_hours})` : '—'}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{totals?.oncall_intervention_hours ?? '—'}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{totals?.payroll_total_hours ?? '—'}</td>
                      <td className="px-2 py-1.5 text-right">
                        {r.period_id && r.status === 'submitted' && (
                          <div className="flex items-center gap-1 justify-end">
                            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => doTransition(r.period_id!, 'approved')}>
                              <CheckCircle2 className="h-3 w-3 mr-1" /> {t('attendance.action_approve')}
                            </Button>
                            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-destructive" onClick={() => {
                              const reason = prompt(t('attendance.action_return_reason'));
                              if (reason) doTransition(r.period_id!, 'returned', reason);
                            }}>
                              <RotateCcw className="h-3 w-3 mr-1" /> {t('attendance.action_return')}
                            </Button>
                          </div>
                        )}
                        {r.period_id && r.status === 'approved' && (
                          <Button size="sm" variant="default" className="h-6 px-2 text-xs" onClick={() => doTransition(r.period_id!, 'locked')}>
                            <Lock className="h-3 w-3 mr-1" /> {t('attendance.action_lock')}
                          </Button>
                        )}
                        {r.period_id && (r.status === 'locked' || r.status === 'approved' || r.status === 'returned') && (
                          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => {
                            if (confirm(t('attendance.action_reopen_confirm'))) {
                              doTransition(r.period_id!, 'draft');
                            }
                          }}>
                            <RotateCcw className="h-3 w-3" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PayrollReadinessPanel({ rows, t }: { rows: AdminPeriodRow[]; t: (k: string, v?: Record<string, string | number>) => string }) {
  const [open, setOpen] = useState(false);

  if (rows.length === 0) return null;

  const total = rows.length;
  const noPeriod  = rows.filter(r => !r.status).length;
  const draft     = rows.filter(r => r.status === 'draft').length;
  const returned  = rows.filter(r => r.status === 'returned').length;
  const submitted = rows.filter(r => r.status === 'submitted').length;
  const approved  = rows.filter(r => r.status === 'approved').length;
  const locked    = rows.filter(r => r.status === 'locked').length;
  const exported  = rows.filter(r => r.status === 'exported').length;

  const checks: { label: string; ok: boolean; detail: string }[] = [
    {
      label: t('attendance.check_all_have_period'),
      ok: noPeriod === 0,
      detail: noPeriod > 0 ? t('attendance.check_no_period_detail', { count: noPeriod }) : '',
    },
    {
      label: t('attendance.check_no_draft'),
      ok: draft === 0,
      detail: draft > 0 ? t('attendance.check_no_draft_detail', { count: draft }) : '',
    },
    {
      label: t('attendance.check_no_returned'),
      ok: returned === 0,
      detail: returned > 0 ? t('attendance.check_no_returned_detail', { count: returned }) : '',
    },
    {
      label: t('attendance.check_submitted_approved'),
      ok: submitted === 0,
      detail: submitted > 0 ? t('attendance.check_submitted_detail', { count: submitted }) : '',
    },
    {
      label: t('attendance.check_approved_locked'),
      ok: approved === 0,
      detail: approved > 0 ? t('attendance.check_approved_detail', { count: approved }) : '',
    },
    {
      label: t('attendance.check_has_locked'),
      ok: locked > 0 || exported > 0,
      detail: locked === 0 && exported === 0 ? t('attendance.check_no_locked_detail') : '',
    },
  ];

  const failCount = checks.filter(c => !c.ok).length;
  const allGreen = failCount === 0;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mb-3">
      <CollapsibleTrigger className="w-full">
        <div className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm border ${
          allGreen ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900' :
          failCount <= 2 ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800' :
          'bg-destructive/5 border-destructive/20'
        }`}>
          {allGreen
            ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
            : <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
          }
          <span className="flex-1 text-left font-medium">
            {allGreen
              ? t('attendance.payroll_ready')
              : t('attendance.payroll_warnings', { count: failCount })
            }
          </span>
          <span className="text-xs text-muted-foreground">
            {t('attendance.payroll_stats', { total, locked, exported })}
          </span>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 rounded-md border bg-card px-3 py-2 space-y-1.5">
          {checks.map((c, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              {c.ok
                ? <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                : <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              }
              <div className="flex-1 min-w-0">
                <span className={c.ok ? 'text-muted-foreground' : ''}>{c.label}</span>
                {!c.ok && c.detail && (
                  <p className="text-xs text-destructive">{c.detail}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function SummaryStat({ label, value, tone = 'default' }: { label: string; value: string | number; tone?: 'default' | 'primary' | 'warning' | 'destructive' | 'muted' }) {
  const cls = tone === 'primary' ? 'bg-primary/5 border-primary/20'
    : tone === 'warning' ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
    : tone === 'destructive' ? 'bg-destructive/10 border-destructive/30'
    : tone === 'muted' ? 'bg-muted/40 border-muted'
    : 'bg-card';
  return (
    <div className={`p-2 rounded-md border ${cls}`}>
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="text-base font-semibold tabular-nums">{value}</div>
    </div>
  );
}
