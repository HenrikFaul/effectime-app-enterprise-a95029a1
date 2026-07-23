import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ChevronLeft, ChevronRight, FileSpreadsheet, FileText,
  CheckCircle2, RotateCcw, Lock, Loader2, Send, AlertTriangle,
  XCircle, ChevronDown,
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { format, getYear, getMonth, addMonths, subMonths } from 'date-fns';
import { toast } from 'sonner';
import {
  listWorkspacePeriods, transitionPeriod, fetchPayrollExport, recordPayrollExport,
} from './api';
import { generateCSV, generateExcelXML, downloadFile } from '../import-export/utils/file-parser';
import {
  STATUS_BADGE_VARIANT,
  type AdminPeriodRow,
  type AttendancePeriodStatus,
} from './types';
import { useI18n, useDateLocale } from '@/i18n/I18nProvider';
import { useFeature } from '@/hooks/useFeature';
import {
  executePayrollExport,
  PayrollExportError,
  type PayrollExportDependencies,
  type PayrollExportFormat,
} from './payroll-export';

interface Props {
  workspaceId: string;
}

const payrollExportDependencies: PayrollExportDependencies = {
  fetchPayrollExport,
  generateCSV,
  generateExcelXML,
  recordPayrollExport,
  downloadFile,
};

interface PeriodListState {
  scopeKey: string | null;
  rows: AdminPeriodRow[];
  loading: boolean;
}

const EMPTY_PERIOD_ROWS: AdminPeriodRow[] = [];

export function AdminOverview({ workspaceId }: Props) {
  const { t } = useI18n();
  const dateFnsLocale = useDateLocale();
  const {
    enabled: payrollExportEnabled,
    isLoading: payrollExportAccessLoading,
    isError: payrollExportAccessError,
  } = useFeature(workspaceId, 'payroll_export');
  const today = new Date();
  const [year, setYear] = useState(getYear(today));
  const [month, setMonth] = useState(getMonth(today) + 1);
  const requestScopeKey = `${workspaceId}:${year}:${month}`;
  const [periodList, setPeriodList] = useState<PeriodListState>({
    scopeKey: null,
    rows: [],
    loading: true,
  });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [exportingFormat, setExportingFormat] = useState<PayrollExportFormat | null>(null);
  const [transitioningPeriodId, setTransitioningPeriodId] = useState<string | null>(null);
  const exportStatusId = useId();
  const mountedRef = useRef(false);
  const latestScopeRef = useRef(requestScopeKey);
  const listOperationRef = useRef<symbol | null>(null);
  const exportOperationRef = useRef<symbol | null>(null);
  const transitionOperationRef = useRef<symbol | null>(null);
  const canExport = payrollExportEnabled
    && !payrollExportAccessLoading
    && !payrollExportAccessError;
  const latestCanExportRef = useRef(canExport);
  const operationBusy = exportingFormat !== null || transitioningPeriodId !== null;
  latestScopeRef.current = requestScopeKey;
  latestCanExportRef.current = canExport;

  const rows = periodList.scopeKey === requestScopeKey ? periodList.rows : EMPTY_PERIOD_ROWS;
  const loading = periodList.scopeKey !== requestScopeKey || periodList.loading;

  const reload = useCallback(async () => {
    const requestedScopeKey = requestScopeKey;
    if (!mountedRef.current || latestScopeRef.current !== requestedScopeKey) return;
    const operationToken = Symbol('attendance-period-list');
    listOperationRef.current = operationToken;
    setPeriodList({ scopeKey: requestedScopeKey, rows: [], loading: true });
    try {
      const data = await listWorkspacePeriods(workspaceId, year, month);
      if (
        mountedRef.current
        && latestScopeRef.current === requestedScopeKey
        && listOperationRef.current === operationToken
      ) {
        setPeriodList({ scopeKey: requestedScopeKey, rows: data, loading: false });
      }
    } catch {
      if (
        mountedRef.current
        && latestScopeRef.current === requestedScopeKey
        && listOperationRef.current === operationToken
      ) {
        setPeriodList({ scopeKey: requestedScopeKey, rows: [], loading: false });
        toast.error(t('attendance.list_load_failed'));
      }
    }
  }, [month, requestScopeKey, t, workspaceId, year]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      listOperationRef.current = null;
      exportOperationRef.current = null;
      transitionOperationRef.current = null;
    };
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

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

  const handlePrev = () => {
    if (exportOperationRef.current || transitionOperationRef.current) return;
    const d = subMonths(new Date(year, month - 1), 1);
    setYear(getYear(d));
    setMonth(getMonth(d) + 1);
  };
  const handleNext = () => {
    if (exportOperationRef.current || transitionOperationRef.current) return;
    const d = addMonths(new Date(year, month - 1), 1);
    setYear(getYear(d));
    setMonth(getMonth(d) + 1);
  };

  const doTransition = async (
    periodId: string,
    target: AttendancePeriodStatus,
    reason?: string,
  ) => {
    if (exportOperationRef.current || transitionOperationRef.current) return;
    const operationToken = Symbol('attendance-period-transition');
    const operationScopeKey = requestScopeKey;
    transitionOperationRef.current = operationToken;
    setTransitioningPeriodId(periodId);
    const isCurrent = () => (
      mountedRef.current
      && transitionOperationRef.current === operationToken
      && latestScopeRef.current === operationScopeKey
    );
    try {
      await transitionPeriod(periodId, target, reason);
      if (isCurrent()) {
        toast.success(t('attendance.status_updated'));
        void reload();
      }
    } catch {
      if (isCurrent()) toast.error(t('attendance.action_failed'));
    } finally {
      if (transitionOperationRef.current === operationToken) {
        transitionOperationRef.current = null;
        if (mountedRef.current) setTransitioningPeriodId(null);
      }
    }
  };

  const handleExport = async (format: PayrollExportFormat, onlyLocked: boolean) => {
    if (!canExport || exportOperationRef.current || transitionOperationRef.current) return;
    const operationToken = Symbol('attendance-payroll-export');
    const operationScopeKey = requestScopeKey;
    exportOperationRef.current = operationToken;
    setExportingFormat(format);
    const isCurrent = () => (
      mountedRef.current
      && exportOperationRef.current === operationToken
      && latestScopeRef.current === operationScopeKey
      && latestCanExportRef.current
    );

    try {
      const result = await executePayrollExport({
        workspaceId,
        year,
        month,
        onlyLocked,
        format,
      }, payrollExportDependencies, isCurrent);
      if (!isCurrent()) return;
      toast.success(t('attendance.export_done', { count: result.rowCount }));
      void reload();
    } catch (error) {
      const isPostRecordFailure = error instanceof PayrollExportError
        && (
          error.code === 'RECORDED_NOT_DELIVERED'
          || error.code === 'DOWNLOAD_FAILED_AFTER_RECORD'
        );
      const metadata = isPostRecordFailure ? error.metadata : null;
      const metadataMatchesRequest = metadata !== null
        && metadata.workspaceId === workspaceId
        && metadata.year === year
        && metadata.month === month;
      if (isPostRecordFailure && metadataMatchesRequest) {
        const toastKey = error.code === 'RECORDED_NOT_DELIVERED'
          ? 'attendance.export_recorded_not_delivered'
          : 'attendance.export_download_failed_after_record';
        toast.error(t(toastKey, {
          period: `${metadata.year}-${String(metadata.month).padStart(2, '0')}`,
          recordId: metadata.recordId,
        }));
        if (mountedRef.current && latestScopeRef.current === operationScopeKey) {
          void reload();
        }
      } else if (isPostRecordFailure) {
        toast.error(t('attendance.export_failed'));
      } else if (
        error instanceof PayrollExportError
        && error.code === 'EMPTY_EXPORT'
        && isCurrent()
      ) {
        toast.error(onlyLocked ? t('attendance.export_empty_locked') : t('attendance.export_empty'));
      } else if (!isCurrent()) {
        return;
      } else {
        toast.error(t('attendance.export_failed'));
      }
    } finally {
      if (exportOperationRef.current === operationToken) {
        exportOperationRef.current = null;
        if (mountedRef.current) setExportingFormat(null);
      }
    }
  };

  const exportAccessStatus = payrollExportAccessLoading
    ? t('attendance.export_access_checking')
    : payrollExportAccessError
      ? t('feature_gate.entitlement_unavailable_title')
      : !payrollExportEnabled
        ? t('feature_gate.locked_title')
        : transitioningPeriodId
          ? t('common.saving')
          : exportingFormat
            ? t('attendance.exporting')
            : '';

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
            <Button type="button" size="sm" variant="ghost" disabled={operationBusy} aria-label={t('attendance.previous_month')} onClick={handlePrev}><ChevronLeft className="h-4 w-4" aria-hidden="true" /></Button>
            <CardTitle className="text-base tabular-nums">
              {format(new Date(year, month - 1, 1), 'yyyy. MMMM', { locale: dateFnsLocale })}
            </CardTitle>
            <Button type="button" size="sm" variant="ghost" disabled={operationBusy} aria-label={t('attendance.next_month')} onClick={handleNext}><ChevronRight className="h-4 w-4" aria-hidden="true" /></Button>
            <div
              className="ml-auto flex items-center gap-2 flex-wrap"
              role="group"
              aria-label={t('attendance.export_controls')}
              aria-busy={payrollExportAccessLoading || operationBusy}
            >
              <span id={exportStatusId} role="status" aria-live="polite" className="sr-only">
                {exportAccessStatus}
              </span>
              {!canExport && exportAccessStatus && (
                <span className="text-xs text-muted-foreground" aria-hidden="true">
                  {exportAccessStatus}
                </span>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!canExport || operationBusy}
                aria-busy={payrollExportAccessLoading || exportingFormat === 'xlsx'}
                aria-describedby={exportAccessStatus ? exportStatusId : undefined}
                onClick={() => void handleExport('xlsx', true)}
              >
                {exportingFormat === 'xlsx'
                  ? <Loader2 className="h-3 w-3 mr-1 animate-spin" aria-hidden="true" />
                  : <FileSpreadsheet className="h-3 w-3 mr-1" aria-hidden="true" />}
                {exportingFormat === 'xlsx' ? t('attendance.exporting') : t('attendance.export_xlsx')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={!canExport || operationBusy}
                aria-busy={payrollExportAccessLoading || exportingFormat === 'csv'}
                aria-describedby={exportAccessStatus ? exportStatusId : undefined}
                onClick={() => void handleExport('csv', false)}
              >
                {exportingFormat === 'csv'
                  ? <Loader2 className="h-3 w-3 mr-1 animate-spin" aria-hidden="true" />
                  : <FileText className="h-3 w-3 mr-1" aria-hidden="true" />}
                {exportingFormat === 'csv' ? t('attendance.exporting') : t('attendance.export_csv')}
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
                            {t(`attendance.status_${r.status}`)}
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
                            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" disabled={operationBusy} onClick={() => doTransition(r.period_id!, 'approved')}>
                              <CheckCircle2 className="h-3 w-3 mr-1" /> {t('attendance.action_approve')}
                            </Button>
                            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-destructive" disabled={operationBusy} onClick={() => {
                              const reason = prompt(t('attendance.action_return_reason'));
                              if (reason) doTransition(r.period_id!, 'returned', reason);
                            }}>
                              <RotateCcw className="h-3 w-3 mr-1" /> {t('attendance.action_return')}
                            </Button>
                          </div>
                        )}
                        {r.period_id && r.status === 'approved' && (
                          <Button size="sm" variant="default" className="h-6 px-2 text-xs" disabled={operationBusy} onClick={() => doTransition(r.period_id!, 'locked')}>
                            <Lock className="h-3 w-3 mr-1" /> {t('attendance.action_lock')}
                          </Button>
                        )}
                        {r.period_id && (r.status === 'locked' || r.status === 'approved' || r.status === 'returned') && (
                          <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs" disabled={operationBusy} aria-label={t('attendance.action_reopen')} onClick={() => {
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
