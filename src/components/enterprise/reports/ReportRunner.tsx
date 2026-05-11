import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useI18n } from '@/i18n/I18nProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ArrowLeft, Pencil, Download, RefreshCw, AlertCircle, Search } from 'lucide-react';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { getDataSourceLabels } from './reportTemplates';
import type { SavedReport } from './ReportLibrary';

const normalizeGroupBy = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

interface Props {
  report: SavedReport;
  workspaceId: string;
  onBack: () => void;
  onEdit?: () => void;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted-foreground))', 'hsl(var(--destructive))', 'hsl(var(--ring))'];

export function ReportRunner({ report, workspaceId, onBack, onEdit }: Props) {
  const { t } = useI18n();
  const DATA_SOURCE_LABELS = getDataSourceLabels(t);
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drillRow, setDrillRow] = useState<Record<string, any> | null>(null);

  const runReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke('run-report', {
        body: {
          workspace_id: workspaceId,
          data_source: report.data_source,
          config: report.config,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setRows(data?.rows || []);
      setColumns(data?.columns || []);
    } catch (e: any) {
      console.error('Report run error:', e);
      setError(e.message || t('report_library.run_error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { runReport(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [report.id]);

  // Plain-language summary of the report
  const summary = useMemo(() => {
    const cfg = report.config;
    const groupBy = normalizeGroupBy((cfg as any)?.group_by);
    const parts: string[] = [];
    parts.push(t('report_library.summary_source', { source: DATA_SOURCE_LABELS[report.data_source] || report.data_source }));
    if (groupBy.length) parts.push(t('report_library.summary_group_by', { fields: groupBy.join(', ') }));
    if (cfg.aggregations?.length) parts.push(t('report_library.summary_metrics', { metrics: cfg.aggregations.map(a => a.alias || `${a.fn}(${a.field})`).join(', ') }));
    if (cfg.filters?.length) parts.push(t('report_library.summary_filters', { count: cfg.filters.length }));
    return parts.join(' ');
  }, [report, t]);

  const handleExportCsv = () => {
    if (rows.length === 0) { toast.info(t('report_library.no_export_data')); return; }
    const cols = columns.length > 0 ? columns : Object.keys(rows[0]);
    const escape = (v: any) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [cols.join(','), ...rows.map(r => cols.map(c => escape(r[c])).join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.name.replace(/[^a-z0-9]/gi, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderChart = () => {
    if (rows.length === 0) return <p className="text-sm text-muted-foreground py-8 text-center">{t('report_library.no_chart_data')}</p>;
    const cols = columns.length > 0 ? columns : Object.keys(rows[0]);

    if (report.chart_type === 'kpi') {
      const value = rows.length === 1 ? Object.values(rows[0])[0] : rows.length;
      return (
        <div className="text-center py-10">
          <p className="text-5xl font-bold text-primary">{String(value)}</p>
          <p className="text-sm text-muted-foreground mt-2">{cols[0] || t('report_library.kpi_default_label')}</p>
        </div>
      );
    }

    if (report.chart_type === 'pie') {
      const labelKey = cols[0];
      const valueKey = cols.find(c => typeof rows[0][c] === 'number') || cols[1];
      const data = rows.map(r => ({ name: String(r[labelKey]), value: Number(r[valueKey]) || 0, _row: r }));
      return (
        <ResponsiveContainer width="100%" height={320}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" outerRadius={100} label onClick={(d: any) => d?._row && setDrillRow(d._row)}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} className="cursor-pointer" />)}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    if (report.chart_type === 'leaderboard') {
      const labelKey = cols[0];
      const valueKey = cols.find(c => typeof rows[0][c] === 'number') || cols[1];
      const max = Math.max(...rows.map(r => Number(r[valueKey]) || 0), 1);
      return (
        <div className="space-y-1.5 max-h-96 overflow-y-auto">
          {rows.map((r, i) => {
            const val = Number(r[valueKey]) || 0;
            const pct = (val / max) * 100;
            return (
              <button
                key={i}
                onClick={() => setDrillRow(r)}
                className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent/40"
              >
                <span className="text-xs font-mono text-muted-foreground w-6">{i + 1}.</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm font-medium truncate">{String(r[labelKey] ?? '–')}</span>
                    <span className="text-sm font-semibold text-primary">{val}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      );
    }

    if (report.chart_type === 'heatmap') {
      // Simple heatmap: first col = label, remaining numeric cols = cells
      const labelKey = cols[0];
      const valueCols = cols.slice(1).filter(c => typeof rows[0][c] === 'number' || !isNaN(Number(rows[0][c])));
      const maxVal = Math.max(...rows.flatMap(r => valueCols.map(c => Number(r[c]) || 0)), 1);
      return (
        <div className="overflow-x-auto">
          <table className="text-xs border-separate border-spacing-1">
            <thead>
              <tr>
                <th className="text-left px-2 py-1"></th>
                {valueCols.map(c => <th key={c} className="px-2 py-1 text-muted-foreground font-medium">{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="px-2 py-1 font-medium whitespace-nowrap">{String(r[labelKey] ?? '–')}</td>
                  {valueCols.map(c => {
                    const v = Number(r[c]) || 0;
                    const intensity = v / maxVal;
                    return (
                      <td
                        key={c}
                        className="px-3 py-2 text-center rounded cursor-pointer hover:ring-2 hover:ring-primary"
                        style={{ backgroundColor: `hsl(var(--primary) / ${0.1 + intensity * 0.6})` }}
                        onClick={() => setDrillRow(r)}
                      >
                        {v}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (report.chart_type === 'bar' || report.chart_type === 'stacked_bar' || report.chart_type === 'line') {
      const labelKey = cols[0];
      const valueKeys = cols.slice(1).filter(c => typeof rows[0][c] === 'number' || !isNaN(Number(rows[0][c])));
      const data = rows.map(r => {
        const obj: any = { [labelKey]: r[labelKey], _row: r };
        valueKeys.forEach(k => { obj[k] = Number(r[k]) || 0; });
        return obj;
      });
      const stacked = report.chart_type === 'stacked_bar';
      const isLine = report.chart_type === 'line';
      return (
        <ResponsiveContainer width="100%" height={320}>
          {isLine ? (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey={labelKey} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
              <Legend />
              {valueKeys.map((k, i) => <Line key={k} dataKey={k} stroke={COLORS[i % COLORS.length]} />)}
            </LineChart>
          ) : (
            <BarChart data={data} onClick={(s: any) => s?.activePayload?.[0]?.payload?._row && setDrillRow(s.activePayload[0].payload._row)}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey={labelKey} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
              <Legend />
              {valueKeys.map((k, i) => <Bar key={k} dataKey={k} fill={COLORS[i % COLORS.length]} stackId={stacked ? 'a' : undefined} className="cursor-pointer" />)}
            </BarChart>
          )}
        </ResponsiveContainer>
      );
    }

    // Default: table
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              {cols.map(c => <th key={c} className="text-left px-3 py-2 font-medium">{c}</th>)}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b hover:bg-muted/20">
                {cols.map(c => <td key={c} className="px-3 py-1.5">{r[c] === null || r[c] === undefined ? '–' : String(r[c])}</td>)}
                <td>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setDrillRow(r)}>
                    <Search className="h-3 w-3" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Button size="sm" variant="ghost" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1" /> {t('report_library.btn_back')}
          </Button>
          <div className="min-w-0">
            <h3 className="text-base font-semibold truncate">{report.name}</h3>
            {report.description && <p className="text-xs text-muted-foreground truncate">{report.description}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-[10px]">{DATA_SOURCE_LABELS[report.data_source]}</Badge>
          <Button size="sm" variant="outline" onClick={runReport}><RefreshCw className="h-3.5 w-3.5 mr-1" /> {t('report_library.btn_refresh')}</Button>
          <Button size="sm" variant="outline" onClick={handleExportCsv}><Download className="h-3.5 w-3.5 mr-1" /> CSV</Button>
          {onEdit && <Button size="sm" variant="outline" onClick={onEdit}><Pencil className="h-3.5 w-3.5 mr-1" /> {t('report_library.btn_edit')}</Button>}
        </div>
      </div>

      {/* Plain-language summary chip */}
      <div className="text-xs text-muted-foreground bg-muted/40 rounded-md px-3 py-2 border border-dashed">
        💡 {summary}
      </div>

      <Card>
        <CardHeader className="py-3 pb-2">
          <CardTitle className="text-sm">{t('report_library.result_title', { count: rows.length })}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : error ? (
            <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          ) : (
            renderChart()
          )}
        </CardContent>
      </Card>

      {/* Drill-down drawer */}
      <Sheet open={!!drillRow} onOpenChange={(o) => !o && setDrillRow(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{t('report_library.drill_title')}</SheetTitle>
          </SheetHeader>
          {drillRow && (
            <div className="mt-4 space-y-2">
              {Object.entries(drillRow).filter(([k]) => !k.startsWith('_')).map(([k, v]) => (
                <div key={k} className="flex justify-between items-start gap-3 py-1.5 border-b last:border-0">
                  <span className="text-xs font-medium text-muted-foreground">{k}</span>
                  <span className="text-xs text-right break-all">{v === null || v === undefined ? '–' : String(v)}</span>
                </div>
              ))}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
