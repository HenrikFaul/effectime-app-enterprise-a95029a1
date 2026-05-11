import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/i18n/I18nProvider';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CalendarRange, Users, AlertTriangle, RefreshCw, Pin } from 'lucide-react';
import { computeWorkspaceCapacity, type PositionSummary, type CapacityRow } from '@/lib/capacityEngine';
import { pinResourceWidget } from './ResourceWidgetCard';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface Props {
  workspaceId: string;
}

function todayISO() { return new Date().toISOString().slice(0, 10); }
function plusDays(iso: string, days: number) {
  const d = new Date(iso); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10);
}

export function ResourceDashboard({ workspaceId }: Props) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [from, setFrom] = useState<string>(todayISO());
  const [to, setTo] = useState<string>(plusDays(todayISO(), 30));
  const [includeLeaves, setIncludeLeaves] = useState(true);
  const [loading, setLoading] = useState(true);
  const [pinning, setPinning] = useState(false);
  const [positions, setPositions] = useState<PositionSummary[]>([]);
  const [rows, setRows] = useState<CapacityRow[]>([]);

  const handlePin = async () => {
    if (!user) return;
    setPinning(true);
    const { error } = await pinResourceWidget({
      workspaceId,
      userId: user.id,
      kind: 'resource_capacity',
      name: t('resource_dashboard.widget_name', { from, to }),
      config: { from, to, include_leaves: includeLeaves, top_n: 5 },
    });
    setPinning(false);
    if (error) toast.error(t('resource_dashboard.pin_error', { msg: error }));
    else toast.success(t('resource_dashboard.pin_success'));
  };

  const load = async () => {
    if (!from || !to || from > to) return;
    setLoading(true);
    const result = await computeWorkspaceCapacity({
      workspaceId,
      windowStart: from,
      windowEnd: to,
      includeLeaves,
    });
    setPositions(result.positions);
    setRows(result.rows);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [workspaceId, from, to, includeLeaves]);

  const grandTotals = useMemo(() => {
    const base = positions.reduce((s, p) => s + p.total_base, 0);
    const used = positions.reduce((s, p) => s + p.total_used, 0);
    const leave = positions.reduce((s, p) => s + p.total_leave_deduction, 0);
    const avail = positions.reduce((s, p) => s + p.total_available, 0);
    return { base, used, leave, avail };
  }, [positions]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="py-3 px-4 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm flex items-center gap-2">
            <CalendarRange className="h-4 w-4" /> {t('resource_dashboard.card_title')}
          </CardTitle>
          <Button size="sm" variant="outline" onClick={handlePin} disabled={pinning || !user} className="gap-1">
            <Pin className="h-3.5 w-3.5" /> {t('resource_dashboard.btn_pin')}
          </Button>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto_auto] items-end">
            <div>
              <Label className="text-xs">{t('resource_dashboard.label_period_from')}</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9" />
            </div>
            <div>
              <Label className="text-xs">{t('resource_dashboard.label_period_to')}</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9" />
            </div>
            <div className="flex items-center gap-2 h-9">
              <Switch id="incl-leaves" checked={includeLeaves} onCheckedChange={setIncludeLeaves} />
              <Label htmlFor="incl-leaves" className="text-xs cursor-pointer">{t('resource_dashboard.label_incl_leaves')}</Label>
            </div>
            <Button size="sm" variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} /> {t('resource_dashboard.btn_refresh')}
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
            <SummaryTile label={t('resource_dashboard.tile_base_capacity')} value={`${grandTotals.base.toFixed(0)}%`} tone="default" />
            <SummaryTile label={t('resource_dashboard.tile_used')} value={`${grandTotals.used.toFixed(0)}%`} tone="primary" />
            <SummaryTile label={t('resource_dashboard.tile_leave_loss')} value={`${grandTotals.leave.toFixed(0)}%`} tone="warn" />
            <SummaryTile label={t('resource_dashboard.tile_available')} value={`${grandTotals.avail.toFixed(0)}%`} tone="success" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4" /> {t('resource_dashboard.by_role_title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {loading ? (
            <div className="flex justify-center py-6"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
          ) : positions.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              {t('resource_dashboard.no_allocations')}
            </p>
          ) : (
            <div className="space-y-3">
              {positions.map((p) => {
                const usedPct = p.total_base > 0 ? (p.total_used / p.total_base) * 100 : 0;
                const leavePct = p.total_base > 0 ? (p.total_leave_deduction / p.total_base) * 100 : 0;
                const fullyAllocated = p.total_available <= 0.5;
                return (
                  <div key={p.business_role} className="border rounded-md p-3 space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{p.business_role}</span>
                        <Badge variant="secondary" className="text-[10px]">{t('resource_dashboard.members_unit', { count: p.member_count })}</Badge>
                        {fullyAllocated && (
                          <Badge variant="destructive" className="text-[10px] gap-1">
                            <AlertTriangle className="h-3 w-3" /> {t('resource_dashboard.overloaded_badge')}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>Alap: <strong className="text-foreground">{p.total_base.toFixed(0)}%</strong></span>
                        <span>{t('resource_dashboard.allocated_label')} <strong className="text-primary">{p.total_used.toFixed(0)}%</strong></span>
                        {includeLeaves && (
                          <span>{t('resource_dashboard.leave_label')} <strong className="text-orange-500">−{p.total_leave_deduction.toFixed(0)}%</strong></span>
                        )}
                        <span>Szabad: <strong className="text-emerald-600">{p.total_available.toFixed(0)}%</strong></span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Progress value={Math.min(100, usedPct)} className="h-2" />
                      {includeLeaves && leavePct > 0 && (
                        <div className="text-[10px] text-orange-500">{t('resource_dashboard.leave_impact', { pct: leavePct.toFixed(0) })}</div>
                      )}
                    </div>
                    {/* Members in this role */}
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">{t('resource_dashboard.members_breakdown')}</summary>
                      <div className="mt-2 space-y-1">
                        {rows.filter(r => r.business_role === p.business_role).map(r => (
                          <div key={r.membership_id + r.business_role} className="flex items-center justify-between border-t pt-1">
                            <span>{r.display_name}</span>
                            <div className="flex gap-3 text-[11px]">
                              <span className="text-muted-foreground">alap {r.base_percentage.toFixed(0)}%</span>
                              <span className="text-primary">{t('resource_dashboard.allocated_pct', { pct: r.used_percentage.toFixed(0) })}</span>
                              {includeLeaves && r.leave_deduction > 0 && (
                                <span className="text-orange-500">−{r.leave_deduction.toFixed(0)}% szabi</span>
                              )}
                              <span className="text-emerald-600 font-medium">szabad {r.available_percentage.toFixed(0)}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryTile({ label, value, tone }: { label: string; value: string; tone: 'default' | 'primary' | 'warn' | 'success' }) {
  const cls =
    tone === 'primary' ? 'border-primary/30 bg-primary/5' :
    tone === 'warn' ? 'border-orange-500/30 bg-orange-500/5' :
    tone === 'success' ? 'border-emerald-500/30 bg-emerald-500/5' :
    'border-border bg-muted/30';
  const valueCls =
    tone === 'primary' ? 'text-primary' :
    tone === 'warn' ? 'text-orange-500' :
    tone === 'success' ? 'text-emerald-600' :
    'text-foreground';
  return (
    <div className={`border rounded-md p-2 ${cls}`}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold ${valueCls}`}>{value}</div>
    </div>
  );
}
