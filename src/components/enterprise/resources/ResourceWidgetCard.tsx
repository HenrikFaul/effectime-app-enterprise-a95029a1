/**
 * ResourceWidgetCard
 * ------------------
 * Compact, dashboard-pinnable widget that surfaces live capacity data
 * (or capacity-gap data) computed from the capacityEngine. Re-uses the
 * existing `enterprise_reports` row format by storing widget settings
 * inside the `config` JSON column and using a sentinel `data_source`
 * value (`resource_capacity` | `capacity_gap`).
 *
 * NOTE: This widget is rendered ONLY by PinnedReportsWidget when it
 * detects one of the resource sentinel data sources. It does NOT touch
 * the existing report-runner flow.
 */
import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/i18n/I18nProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Users, AlertTriangle, TrendingDown, RefreshCw, Maximize2 } from 'lucide-react';
import { computeWorkspaceCapacity, type PositionSummary, type CapacityRow } from '@/lib/capacityEngine';
import { supabase } from '@/integrations/supabase/client';

export type ResourceWidgetKind = 'resource_capacity' | 'capacity_gap';

export interface ResourceWidgetConfig {
  // Either explicit dates...
  from?: string;
  to?: string;
  // ...or relative day window ending today + N days
  relative_days?: number; // e.g. 30 / 90
  include_leaves?: boolean;
  top_n?: number;
}

interface Props {
  workspaceId: string;
  kind: ResourceWidgetKind;
  config: ResourceWidgetConfig;
  title: string;
  onOpenFull?: () => void;
}

function todayISO() { return new Date().toISOString().slice(0, 10); }
function plusDays(iso: string, n: number) { const d = new Date(iso); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }

function resolveWindow(config: ResourceWidgetConfig) {
  if (config.from && config.to) return { from: config.from, to: config.to };
  const days = config.relative_days ?? 30;
  return { from: todayISO(), to: plusDays(todayISO(), days) };
}

export function ResourceWidgetCard({ workspaceId, kind, config, title, onOpenFull }: Props) {
  const { t } = useI18n();
  const { from, to } = useMemo(() => resolveWindow(config), [config]);
  const includeLeaves = config.include_leaves ?? true;
  const topN = config.top_n ?? 5;

  const [loading, setLoading] = useState(true);
  const [positions, setPositions] = useState<PositionSummary[]>([]);
  const [rows, setRows] = useState<CapacityRow[]>([]);
  const [requirements, setRequirements] = useState<{ project_id: string; business_role: string; required_percentage: number; project_name?: string }[]>([]);

  const load = async () => {
    setLoading(true);
    const cap = await computeWorkspaceCapacity({ workspaceId, windowStart: from, windowEnd: to, includeLeaves });
    setPositions(cap.positions);
    setRows(cap.rows);

    if (kind === 'capacity_gap') {
      const [{ data: projData }, { data: reqData }] = await Promise.all([
        supabase.from('enterprise_projects' as any).select('id, name, start_date, end_date, is_open_ended, status').eq('workspace_id', workspaceId).neq('status', 'completed'),
        supabase.from('enterprise_project_resource_requirements' as any).select('project_id, business_role, required_percentage').eq('workspace_id', workspaceId),
      ]);
      const overlapping = new Set(((projData as any[]) || []).filter((p) => {
        const pe = p.is_open_ended || !p.end_date ? '9999-12-31' : p.end_date;
        return p.start_date <= to && pe >= from;
      }).map((p) => p.id));
      const projNameById = new Map(((projData as any[]) || []).map((p) => [p.id, p.name]));
      setRequirements(((reqData as any[]) || []).filter((r) => overlapping.has(r.project_id)).map((r) => ({
        project_id: r.project_id,
        business_role: r.business_role,
        required_percentage: Number(r.required_percentage),
        project_name: projNameById.get(r.project_id),
      })));
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [workspaceId, from, to, includeLeaves, kind]);

  const renderCapacity = () => {
    const sorted = [...positions].sort((a, b) => b.total_used - a.total_used).slice(0, topN);
    if (sorted.length === 0) return <p className="text-xs text-muted-foreground py-2">{t('resources.no_allocated_position')}</p>;
    return (
      <div className="space-y-1.5">
        {sorted.map((p) => {
          const usedPct = p.total_base > 0 ? (p.total_used / p.total_base) * 100 : 0;
          const fully = p.total_available <= 0.5;
          return (
            <div key={p.business_role} className="space-y-0.5">
              <div className="flex items-center justify-between text-xs gap-2">
                <span className="truncate font-medium">{p.business_role}</span>
                <span className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-muted-foreground">{p.total_used.toFixed(0)}/{p.total_base.toFixed(0)}%</span>
                  {fully && <AlertTriangle className="h-3 w-3 text-destructive" />}
                </span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className={`h-full ${fully ? 'bg-destructive' : 'bg-primary'}`} style={{ width: `${Math.min(100, usedPct)}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderGap = () => {
    const reqsByRole = new Map<string, number>();
    requirements.forEach((r) => reqsByRole.set(r.business_role, (reqsByRole.get(r.business_role) || 0) + r.required_percentage));
    const baseByRole = new Map<string, number>();
    rows.forEach((r) => baseByRole.set(r.business_role, (baseByRole.get(r.business_role) || 0) + r.base_percentage));
    const allRoles = new Set([...reqsByRole.keys(), ...baseByRole.keys()]);
    const gaps = [...allRoles].map((role) => {
      const required = reqsByRole.get(role) || 0;
      const available = baseByRole.get(role) || 0;
      return { role, required, available, gap: required - available };
    }).filter((g) => g.gap > 0.5).sort((a, b) => b.gap - a.gap).slice(0, topN);

    if (gaps.length === 0) return <p className="text-xs text-emerald-600 py-2">{t('resources.no_gap')}</p>;
    return (
      <div className="space-y-1.5">
        {gaps.map((g) => (
          <div key={g.role} className="flex items-center justify-between gap-2 text-xs px-2 py-1 rounded bg-destructive/5 border border-destructive/20">
            <div className="flex items-center gap-1.5 min-w-0">
              <Users className="h-3 w-3 flex-shrink-0" />
              <span className="truncate font-medium">{g.role}</span>
            </div>
            <Badge variant="destructive" className="text-[10px] flex-shrink-0">−{g.gap.toFixed(0)}% (~{(g.gap / 100).toFixed(1)} {t('resources.persons_unit')})</Badge>
          </div>
        ))}
      </div>
    );
  };

  const Icon = kind === 'capacity_gap' ? TrendingDown : Users;

  return (
    <Card className="border-primary/20 bg-card">
      <CardHeader className="py-2 px-3 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-xs font-medium flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-primary" />
          {title}
        </CardTitle>
        <div className="flex items-center gap-1">
          <Badge variant="outline" className="text-[9px] font-normal">{from} → {to}</Badge>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={load} disabled={loading} title={t('resources.btn_refresh_title')}>
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          {onOpenFull && (
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onOpenFull} title={t('resources.btn_detail_view')}>
              <Maximize2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-0">
        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
        ) : kind === 'capacity_gap' ? renderGap() : renderCapacity()}
      </CardContent>
    </Card>
  );
}

/**
 * Helper: pin a resource widget as a pseudo-report row.
 * Stored in `enterprise_reports` so it slots into the existing pinned grid + sorting.
 */
export async function pinResourceWidget(opts: {
  workspaceId: string;
  userId: string;
  kind: ResourceWidgetKind;
  name: string;
  config: ResourceWidgetConfig;
  description?: string;
}): Promise<{ error?: string }> {
  const { error } = await (supabase as any).from('enterprise_reports').insert({
    workspace_id: opts.workspaceId,
    created_by: opts.userId,
    name: opts.name,
    description: opts.description ?? (opts.kind === 'capacity_gap' ? 'Capacity gap widget' : 'Live capacity widget'),
    data_source: opts.kind, // sentinel value
    chart_type: 'kpi',
    config: opts.config as any,
    is_pinned: true,
    is_shared: false,
    is_template: false,
    widget_size: 'medium',
  });
  return { error: error?.message };
}
