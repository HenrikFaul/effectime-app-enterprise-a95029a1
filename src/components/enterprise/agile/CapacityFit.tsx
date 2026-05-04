import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Gauge, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface IntegrationMini {
  id: string;
  provider: 'jira' | 'azure_devops';
  project_key: string | null;
}

interface IssueRow {
  assignee_email: string | null;
  assignee_name: string | null;
  story_points: number | null;
  original_estimate_hours: number | null;
  remaining_hours: number | null;
  sprint_name: string | null;
  iteration_path: string | null;
  status: string | null;
}

interface CapacityRow {
  risk_level: 'Low' | 'Medium' | 'High';
  fit_score: number;
  display_name: string;
  email: string | null;
  capacity_hours: number;
  planned_hours: number;
  variance: number;
}

export function CapacityFit({ integration, workspaceId }: { integration: IntegrationMini; workspaceId: string }) {
  const [sprintName, setSprintName] = useState('');
  const [sprintHours, setSprintHours] = useState(80); // default 2-week sprint
  const [vacationImpactDays, setVacationImpactDays] = useState(0);
  const [loading, setLoading] = useState(false);
  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [members, setMembers] = useState<{ email: string | null; display_name: string }[]>([]);

  useEffect(() => {
    (async () => {
      // Two-step load: memberships first, then profiles by user_id
      // (no FK between enterprise_memberships and profiles → joined select fails with PGRST200)
      const { data: memData } = await (supabase as any)
        .from('enterprise_memberships')
        .select('id, user_id')
        .eq('workspace_id', workspaceId)
        .eq('status', 'active');
      const memRows = (memData ?? []) as { id: string; user_id: string }[];
      if (memRows.length === 0) { setMembers([]); return; }
      const userIds = memRows.map(r => r.user_id);
      const { data: profs } = await (supabase as any)
        .from('profiles')
        .select('user_id, display_name, email')
        .in('user_id', userIds);
      const profMap: Record<string, { display_name: string; email: string | null }> = {};
      ((profs ?? []) as any[]).forEach((p: any) => {
        profMap[p.user_id] = { display_name: p.display_name || '—', email: p.email ?? null };
      });
      setMembers(memRows.map(r => ({
        email: profMap[r.user_id]?.email ?? null,
        display_name: profMap[r.user_id]?.display_name ?? '—',
      })));
    })();
  }, [workspaceId]);

  const loadIssues = async () => {
    setLoading(true);
    try {
      const query =
        integration.provider === 'jira'
          ? sprintName
            ? `sprint = "${sprintName}" AND statusCategory != Done`
            : `project = "${integration.project_key}" AND sprint in openSprints() AND statusCategory != Done`
          : sprintName
            ? `SELECT [System.Id] FROM WorkItems WHERE [System.IterationPath] UNDER '${sprintName}' AND [System.State] <> 'Closed'`
            : `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${integration.project_key}' AND [System.State] <> 'Closed'`;

      const { data, error } = await supabase.functions.invoke('jira-devops-proxy', {
        body: { action: 'search_issues', integration_id: integration.id, params: { query, max: 200 } },
      });
      if (error) throw error;
      if (!(data as any)?.ok) throw new Error((data as any)?.error ?? 'Hibás válasz');
      setIssues((data as any).issues ?? []);
      toast.success(`${(data as any).count} aktív ticket`);
    } catch (e: any) {
      toast.error('Hiba: ' + (e?.message ?? String(e)));
    } finally {
      setLoading(false);
    }
  };

  // Aggregate planned hours per assignee. SP = 4 hours fallback (configurable later).
  const SP_TO_HOURS = 4;
  const rows: CapacityRow[] = useMemo(() => {
    const planned = new Map<string, number>();
    for (const i of issues) {
      const key = (i.assignee_email ?? i.assignee_name ?? '—').toLowerCase();
      const hours =
        (i.original_estimate_hours ?? null) !== null
          ? Number(i.original_estimate_hours)
          : (i.story_points ?? null) !== null
            ? Number(i.story_points) * SP_TO_HOURS
            : 0;
      planned.set(key, (planned.get(key) ?? 0) + hours);
    }
    // Build per-member rows
    const out: CapacityRow[] = members.map((m) => {
      const k = (m.email ?? m.display_name).toLowerCase();
      const ph = planned.get(k) ?? 0;
      const adjustedCapacity = Math.max(0, sprintHours - vacationImpactDays * 8);
      const variance = adjustedCapacity - ph;
      const loadRatio = adjustedCapacity > 0 ? ph / adjustedCapacity : (ph > 0 ? 2 : 1);
      const risk_level = loadRatio > 1.15 ? 'High' : loadRatio > 0.9 ? 'Medium' : 'Low';
      const fit_score = Math.max(0, Math.min(100, Math.round((1 - Math.abs(loadRatio - 0.85)) * 100)));
      return {
        display_name: m.display_name,
        email: m.email,
        capacity_hours: adjustedCapacity,
        planned_hours: ph,
        variance,
        risk_level,
        fit_score,
      };
    });
    // Add "Nincs hozzárendelve" bucket
    let unassigned = 0;
    for (const [k, v] of planned.entries()) {
      const matched = members.some((m) => (m.email ?? m.display_name).toLowerCase() === k);
      if (!matched) unassigned += v;
    }
    if (unassigned > 0) {
      out.push({ display_name: 'Nincs egyezés / külső', email: null, capacity_hours: 0, planned_hours: unassigned, variance: -unassigned, risk_level: 'High', fit_score: 0 });
    }
    return out.sort((a, b) => a.variance - b.variance);
  }, [issues, members, sprintHours, vacationImpactDays]);

  const totals = useMemo(() => {
    const cap = rows.reduce((s, r) => s + r.capacity_hours, 0);
    const plan = rows.reduce((s, r) => s + r.planned_hours, 0);
    return { cap, plan, variance: cap - plan };
  }, [rows]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Gauge className="h-4 w-4 text-primary" /> Backlog Capacity Fit
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <div>
            <Label className="text-xs">Sprint név (opcionális)</Label>
            <Input className="h-8 text-xs" value={sprintName} onChange={(e) => setSprintName(e.target.value)} placeholder="pl. Sprint 24" />
          </div>
          <div>
            <Label className="text-xs">Sprint kapacitás / fő (óra)</Label>
            <Input className="h-8 text-xs" type="number" value={sprintHours} onChange={(e) => setSprintHours(Number(e.target.value) || 0)} />
          </div>
          <div>
            <Label className="text-xs">What-if: szabadság nap/fő</Label>
            <Input className="h-8 text-xs" type="number" value={vacationImpactDays} onChange={(e) => setVacationImpactDays(Number(e.target.value) || 0)} />
          </div>
          <div className="flex items-end">
            <Button size="sm" onClick={loadIssues} disabled={loading} className="gap-1 w-full">
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Sprint adatok lekérése
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-md border p-2 text-center">
            <p className="text-[10px] uppercase text-muted-foreground">Összes kapacitás</p>
            <p className="text-lg font-semibold">{totals.cap}h</p>
          </div>
          <div className="rounded-md border p-2 text-center">
            <p className="text-[10px] uppercase text-muted-foreground">Tervezett</p>
            <p className="text-lg font-semibold">{totals.plan}h</p>
          </div>
          <div className={cn(
            'rounded-md border p-2 text-center',
            totals.variance < 0 ? 'bg-destructive/10' : 'bg-emerald-500/10',
          )}>
            <p className="text-[10px] uppercase text-muted-foreground">Eltérés</p>
            <p className={cn('text-lg font-semibold', totals.variance < 0 ? 'text-destructive' : 'text-emerald-600')}>
              {totals.variance > 0 ? '+' : ''}{totals.variance}h
            </p>
          </div>
        </div>

        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-2">Tag</th>
                <th className="text-left p-2">Kapacitás</th>
                <th className="text-left p-2">Tervezett</th>
                <th className="text-left p-2">Eltérés</th>
                <th className="text-left p-2">Státusz</th>
                <th className="text-left p-2">Fit</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => {
                const overload = r.variance < 0;
                const underload = r.variance > r.capacity_hours * 0.4 && r.capacity_hours > 0;
                return (
                  <tr key={idx} className="border-t">
                    <td className="p-2">{r.display_name}</td>
                    <td className="p-2">{r.capacity_hours}h</td>
                    <td className="p-2">{r.planned_hours}h</td>
                    <td className={cn('p-2 font-semibold', overload && 'text-destructive', !overload && r.capacity_hours > 0 && 'text-emerald-600')}>
                      {r.variance > 0 ? '+' : ''}{r.variance}h
                    </td>
                    <td className="p-2">
                      {r.risk_level === 'High' && <Badge variant="destructive" className="text-[10px]">Risk: High</Badge>}
                      {r.risk_level === 'Medium' && <Badge variant="outline" className="text-[10px]">Risk: Medium</Badge>}
                      {r.risk_level === 'Low' && <Badge variant="secondary" className="text-[10px]">Risk: Low</Badge>}
                      {overload && <Badge variant="destructive" className="text-[10px] ml-1">Overload</Badge>}
                      {!overload && underload && <Badge variant="outline" className="text-[10px] ml-1">Underload</Badge>}
                    </td>
                    <td className="p-2 font-medium">{r.fit_score}%</td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">
                  Nyomd meg a „Sprint adatok lekérése" gombot.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
