import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { useT } from '@/i18n/I18nProvider';

interface Props {
  workspaceId: string;
  isAdmin: boolean;
}

interface Snapshot {
  id: string;
  snapshot_date: string;
  baseline_fte: number | null;
  effective_fte: number | null;
  committed_fte: number | null;
  available_fte: number | null;
  shortage_score: number | null;
  overload_score: number | null;
  generated_at: string;
}

/**
 * Phase 8 — Predictive forecaster v1 (rule-based, client-side).
 * Computes a single daily snapshot from current memberships + approved leave.
 * - baseline_fte = active membership count
 * - effective_fte = baseline minus members on approved leave overlapping the date
 * - committed_fte = sum of percentage allocations / 100 (best-effort)
 * - available_fte = effective_fte - committed_fte
 * - shortage_score = max(0, committed - effective) / max(1, baseline)
 * - overload_score = max(0, committed - baseline) / max(1, baseline)
 */
export function CapacityDnaPanel({ workspaceId, isAdmin }: Props) {
  const t = useT();
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('enterprise_capacity_snapshots')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('snapshot_date', { ascending: false })
      .limit(30);
    setSnapshots((data as Snapshot[]) || []);
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => {
    load();
  }, [load]);

  const generate = async () => {
    setBusy(true);
    const today = new Date().toISOString().slice(0, 10);

    // Fetch inputs
    const [{ data: members }, { data: allocs }, { data: leaves }] = await Promise.all([
      (supabase as any).from('enterprise_memberships').select('id, user_id').eq('workspace_id', workspaceId).eq('status', 'active'),
      (supabase as any).from('enterprise_member_role_allocations').select('membership_id, percentage').eq('workspace_id', workspaceId),
      (supabase as any)
        .from('leave_requests')
        .select('user_id, start_date, end_date, status')
        .eq('workspace_id', workspaceId)
        .eq('status', 'approved')
        .lte('start_date', today)
        .gte('end_date', today),
    ]);

    const ms = (members as any[]) || [];
    const baseline = ms.length;
    const onLeaveUserIds = new Set(((leaves as any[]) || []).map((l: any) => l.user_id));
    const onLeaveCount = ms.filter((m: any) => onLeaveUserIds.has(m.user_id)).length;
    const effective = Math.max(0, baseline - onLeaveCount);

    const totalPctSum = ((allocs as any[]) || []).reduce(
      (acc: number, a: any) => acc + Number(a.percentage || 0),
      0,
    );
    const committed = Math.round((totalPctSum / 100) * 100) / 100;
    const available = Math.max(0, Math.round((effective - committed) * 100) / 100);

    const shortage = baseline === 0 ? 0 : Math.round(Math.max(0, (committed - effective) / baseline) * 1000) / 1000;
    const overload = baseline === 0 ? 0 : Math.round(Math.max(0, (committed - baseline) / baseline) * 1000) / 1000;

    const payload = {
      generator: 'rule-v1',
      generated_client_at: new Date().toISOString(),
      inputs: {
        active_member_count: baseline,
        on_leave_count: onLeaveCount,
        allocation_pct_sum: totalPctSum,
      },
    };

    const { error } = await (supabase as any)
      .from('enterprise_capacity_snapshots')
      .upsert(
        {
          workspace_id: workspaceId,
          snapshot_date: today,
          baseline_fte: baseline,
          effective_fte: effective,
          committed_fte: committed,
          available_fte: available,
          shortage_score: shortage,
          overload_score: overload,
          payload,
          generated_at: new Date().toISOString(),
        },
        { onConflict: 'workspace_id,snapshot_date' },
      );
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t('capacity.generated'));
    load();
  };

  const fmt = (n: number | null) => (n == null ? '—' : Number(n).toFixed(2));
  const pct = (n: number | null) => (n == null ? '—' : `${(Number(n) * 100).toFixed(1)}%`);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <CardTitle className="text-base">{t('capacity.title')}</CardTitle>
            <CardDescription className="text-xs">{t('capacity.subtitle')}</CardDescription>
          </div>
          {isAdmin ? (
            <Button size="sm" variant="outline" onClick={generate} disabled={busy}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${busy ? 'animate-spin' : ''}`} />
              {t('capacity.generate')}
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="text-sm text-muted-foreground">{t('common.loading')}</div>
        ) : snapshots.length === 0 ? (
          <div className="text-sm text-muted-foreground italic">{t('capacity.no_snapshots')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-1.5 pr-2">{t('capacity.snapshot_date')}</th>
                  <th className="py-1.5 px-2">{t('capacity.baseline_fte')}</th>
                  <th className="py-1.5 px-2">{t('capacity.effective_fte')}</th>
                  <th className="py-1.5 px-2">{t('capacity.available_fte')}</th>
                  <th className="py-1.5 px-2">{t('capacity.shortage_score')}</th>
                  <th className="py-1.5 px-2">{t('capacity.overload_score')}</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((s) => (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="py-1.5 pr-2 font-mono text-[11px]">{s.snapshot_date}</td>
                    <td className="py-1.5 px-2">{fmt(s.baseline_fte)}</td>
                    <td className="py-1.5 px-2">{fmt(s.effective_fte)}</td>
                    <td className="py-1.5 px-2">{fmt(s.available_fte)}</td>
                    <td className="py-1.5 px-2">
                      <span className="inline-flex items-center gap-1">
                        {Number(s.shortage_score ?? 0) > 0 ? <TrendingDown className="h-3 w-3 text-destructive" /> : null}
                        {pct(s.shortage_score)}
                      </span>
                    </td>
                    <td className="py-1.5 px-2">
                      <span className="inline-flex items-center gap-1">
                        {Number(s.overload_score ?? 0) > 0 ? <TrendingUp className="h-3 w-3 text-amber-600" /> : null}
                        {pct(s.overload_score)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Badge variant="outline" className="text-[10px] font-normal">{t('capacity.note')}</Badge>
      </CardContent>
    </Card>
  );
}
