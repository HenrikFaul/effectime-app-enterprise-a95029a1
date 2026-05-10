import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ChevronLeft, ChevronRight, Download, FileSpreadsheet, FileText,
  CheckCircle2, RotateCcw, Lock, Loader2, Send, AlertTriangle,
} from 'lucide-react';
import { format, getYear, getMonth, addMonths, subMonths } from 'date-fns';
import { hu } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  listWorkspacePeriods, transitionPeriod, fetchPayrollExport, recordPayrollExport,
} from './api';
import { generateCSV, generateExcelXML, downloadFile } from '../import-export/utils/file-parser';
import { STATUS_LABELS, STATUS_BADGE_VARIANT, type AdminPeriodRow } from './types';

interface Props {
  workspaceId: string;
}

const PAYROLL_COLUMNS = [
  { key: 'email', label: 'Email' },
  { key: 'display_name', label: 'Név' },
  { key: 'team', label: 'Csapat' },
  { key: 'business_role', label: 'Munkakör' },
  { key: 'office_name', label: 'Telephely' },
  { key: 'period_label', label: 'Időszak' },
  { key: 'status', label: 'Státusz' },
  { key: 'regular_hours', label: 'Normál óra' },
  { key: 'overtime_hours', label: 'Túlóra' },
  { key: 'weekend_overtime_hours', label: 'Hétvégi túlóra' },
  { key: 'night_hours', label: 'Éjszakai óra' },
  { key: 'oncall_intervention_hours', label: 'Készenléti behívás óra' },
  { key: 'oncall_standby_hours', label: 'Készenlét nyers óra' },
  { key: 'oncall_standby_compensated_hours', label: 'Készenlét bér-óra (×0.20)' },
  { key: 'expected_hours', label: 'Elvárt óra' },
  { key: 'leave_days', label: 'Szabadság nap' },
  { key: 'leave_hours', label: 'Szabadság óra' },
  { key: 'expected_after_leave', label: 'Elvárt szab. után' },
  { key: 'worked_hours', label: 'Ledolgozott óra' },
  { key: 'payroll_total_hours', label: 'Bér-össz óra' },
  { key: 'submitted_at', label: 'Benyújtva' },
  { key: 'approved_at', label: 'Jóváhagyva' },
  { key: 'locked_at', label: 'Zárolva' },
] as const;

export function AdminOverview({ workspaceId }: Props) {
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
      toast.error(e?.message || 'Lista betöltése sikertelen');
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
      toast.success('Státusz frissítve');
      reload();
    } catch (e: any) {
      toast.error(e?.message || 'Művelet sikertelen');
    }
  };

  const handleExport = async (format: 'xlsx' | 'csv', onlyLocked: boolean) => {
    setExporting(true);
    try {
      const exportRows = await fetchPayrollExport(workspaceId, year, month, onlyLocked);
      if (exportRows.length === 0) {
        toast.error(onlyLocked ? 'Nincs zárolt időszak — előbb hagyj jóvá és zárolj.' : 'Nincs adat erre az időszakra.');
        return;
      }
      const headers = PAYROLL_COLUMNS.map(c => c.label);
      const dataRows = exportRows.map(r => PAYROLL_COLUMNS.map(c => {
        const v = (r as any)[c.key];
        if (v === null || v === undefined) return '';
        if (typeof v === 'number') return String(v);
        return String(v);
      }));
      const periodLabel = `${year}_${String(month).padStart(2, '0')}`;
      if (format === 'xlsx') {
        const xml = generateExcelXML(headers, dataRows, { sheetName: 'Bérelőkészítés' });
        downloadFile(xml, `attendance_payroll_${periodLabel}.xls`, 'application/vnd.ms-excel');
      } else {
        const csv = generateCSV(headers, dataRows);
        downloadFile(csv, `attendance_payroll_${periodLabel}.csv`, 'text/csv;charset=utf-8');
      }
      // Record export and advance locked → exported
      await recordPayrollExport(workspaceId, year, month, 'summary', format, exportRows);
      toast.success(`Export kész: ${exportRows.length} sor`);
      reload();
    } catch (e: any) {
      toast.error(e?.message || 'Export sikertelen');
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center p-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin mr-2" /> Betöltés...</div>;

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
                <FileSpreadsheet className="h-3 w-3 mr-1" /> Bérelőkészítés export (XLSX, csak zárolt)
              </Button>
              <Button size="sm" variant="ghost" disabled={exporting} onClick={() => handleExport('csv', false)}>
                <FileText className="h-3 w-3 mr-1" /> Teljes (CSV, minden státusz)
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mt-3 text-xs">
            <SummaryStat label="Tagok" value={summary.members} />
            <SummaryStat label="Benyújtva" value={summary.submitted} tone="warning" />
            <SummaryStat label="Jóváhagyva" value={summary.approved} tone="primary" />
            <SummaryStat label="Zárolva" value={summary.locked} tone="primary" />
            <SummaryStat label="Hiányzó" value={summary.no_period + summary.draft} tone={summary.no_period > 0 ? 'destructive' : 'muted'} />
            <SummaryStat label="Bér-össz" value={`${summary.total_payroll.toFixed(1)}h`} tone="primary" />
          </div>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          <div className="flex items-center gap-2 mb-2">
            <Input placeholder="Keresés (név vagy email)…" value={search} onChange={e => setSearch(e.target.value)} className="h-8 max-w-sm" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-[170px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Minden státusz</SelectItem>
                <SelectItem value="draft">Vázlat</SelectItem>
                <SelectItem value="submitted">Benyújtva</SelectItem>
                <SelectItem value="returned">Visszaküldve</SelectItem>
                <SelectItem value="approved">Jóváhagyva</SelectItem>
                <SelectItem value="locked">Zárolva</SelectItem>
                <SelectItem value="exported">Exportálva</SelectItem>
                <SelectItem value="no_period">Hiányzik</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-wide text-muted-foreground border-b">
                <tr>
                  <th className="text-left px-2 py-2">Tag</th>
                  <th className="text-left px-2 py-2">Státusz</th>
                  <th className="text-right px-2 py-2 tabular-nums">Ledolg.</th>
                  <th className="text-right px-2 py-2 tabular-nums">Túlóra</th>
                  <th className="text-right px-2 py-2 tabular-nums">HV túl.</th>
                  <th className="text-right px-2 py-2 tabular-nums">Éjsz.</th>
                  <th className="text-right px-2 py-2 tabular-nums">Készenlét</th>
                  <th className="text-right px-2 py-2 tabular-nums">Behívás</th>
                  <th className="text-right px-2 py-2 tabular-nums">Bér-össz</th>
                  <th className="text-right px-2 py-2">Művelet</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={10} className="text-center py-6 text-muted-foreground">Nincs találat.</td></tr>
                )}
                {filtered.map(r => {
                  const t = r.totals;
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
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">Hiányzik</Badge>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{t?.worked_hours ?? '—'}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{t?.overtime_hours ?? '—'}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{t?.weekend_overtime_hours ?? '—'}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{t?.night_hours ?? '—'}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {t ? `${t.oncall_standby_hours} (${t.oncall_standby_compensated_hours})` : '—'}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{t?.oncall_intervention_hours ?? '—'}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{t?.payroll_total_hours ?? '—'}</td>
                      <td className="px-2 py-1.5 text-right">
                        {r.period_id && r.status === 'submitted' && (
                          <div className="flex items-center gap-1 justify-end">
                            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => doTransition(r.period_id!, 'approved')}>
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Jóváhagy
                            </Button>
                            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-destructive" onClick={() => {
                              const reason = prompt('Visszaküldés indoka:');
                              if (reason) doTransition(r.period_id!, 'returned', reason);
                            }}>
                              <RotateCcw className="h-3 w-3 mr-1" /> Vissza
                            </Button>
                          </div>
                        )}
                        {r.period_id && r.status === 'approved' && (
                          <Button size="sm" variant="default" className="h-6 px-2 text-xs" onClick={() => doTransition(r.period_id!, 'locked')}>
                            <Lock className="h-3 w-3 mr-1" /> Zárol
                          </Button>
                        )}
                        {r.period_id && (r.status === 'locked' || r.status === 'approved' || r.status === 'returned') && (
                          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => {
                            if (confirm('Újranyitod az időszakot? A tag ismét tudja szerkeszteni.')) {
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
