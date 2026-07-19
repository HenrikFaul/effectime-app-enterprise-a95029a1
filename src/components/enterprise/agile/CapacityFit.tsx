import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useI18n } from '@/i18n/I18nProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Gauge, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  createUniqueCapacityFitAssigneeMatcher,
  parseCapacityFitIssueSearchResponse,
  type CapacityFitIssueRow,
} from '@/lib/capacityFitAssignee';

interface IntegrationMini {
  id: string;
  provider: 'jira' | 'azure_devops';
  project_key: string | null;
}

interface CapacityRow {
  risk_level: 'Low' | 'Medium' | 'High';
  fit_score: number;
  display_name: string;
  capacity_hours: number;
  planned_hours: number;
  variance: number;
}

export function CapacityFit({ integration, workspaceId }: { integration: IntegrationMini; workspaceId: string }) {
  const { t } = useI18n();
  const [sprintName, setSprintName] = useState('');
  const [sprintHours, setSprintHours] = useState(80); // default 2-week sprint
  const [vacationImpactDays, setVacationImpactDays] = useState(0);
  const [loading, setLoading] = useState(false);
  const [issues, setIssues] = useState<CapacityFitIssueRow[]>([]);
  const [members, setMembers] = useState<{ display_name: string | null }[]>([]);
  const [memberDirectoryStatus, setMemberDirectoryStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [memberDirectoryRetry, setMemberDirectoryRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setMemberDirectoryStatus('loading');
    setMembers([]);
    void (async () => {
      try {
        // Two-step load: memberships first, then safe profile directory fields.
        const { data: memData, error: membershipError } = await supabase
          .from('enterprise_memberships')
          .select('id, user_id')
          .eq('workspace_id', workspaceId)
          .eq('status', 'active');
        if (cancelled) return;
        if (membershipError) {
          console.warn('[CapacityFit] member directory load failed');
          setMembers([]);
          setMemberDirectoryStatus('error');
          return;
        }
        const memRows = memData ?? [];
        if (memRows.length === 0) {
          setMembers([]);
          setMemberDirectoryStatus('ready');
          return;
        }
        const userIds = memRows.map(r => r.user_id);
        const { data: profs, error: profileError } = await supabase
          .from('profiles')
          .select('user_id, display_name')
          .in('user_id', userIds);
        if (cancelled) return;
        if (profileError) {
          console.warn('[CapacityFit] member directory load failed');
          setMembers([]);
          setMemberDirectoryStatus('error');
          return;
        }
        const profMap = new Map<string, string | null>(
          (profs ?? []).map((profile) => [profile.user_id, profile.display_name?.trim() || null]),
        );
        setMembers(memRows.map(r => ({ display_name: profMap.get(r.user_id) ?? null })));
        setMemberDirectoryStatus('ready');
      } catch {
        if (cancelled) return;
        console.warn('[CapacityFit] member directory load failed');
        setMembers([]);
        setMemberDirectoryStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, [workspaceId, memberDirectoryRetry]);

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
      const response = parseCapacityFitIssueSearchResponse(data);
      if (!response) throw new Error('capacity_fit_response_rejected');
      setIssues(response.issues);
      toast.success(t('capacity_fit.active_tickets', { count: response.count }));
    } catch {
      console.warn('[CapacityFit] provider issue load failed');
      toast.error(t('capacity_fit.load_error'));
    } finally {
      setLoading(false);
    }
  };

  // Aggregate planned hours per assignee. SP = 4 hours fallback (configurable later).
  const SP_TO_HOURS = 4;
  const rows: CapacityRow[] = useMemo(() => {
    const matchAssignee = createUniqueCapacityFitAssigneeMatcher(members);
    const plannedByMemberIndex = new Map<number, number>();
    let unmatchedHours = 0;

    for (const i of issues) {
      const hours =
        (i.original_estimate_hours ?? null) !== null
          ? Number(i.original_estimate_hours)
          : (i.story_points ?? null) !== null
            ? Number(i.story_points) * SP_TO_HOURS
            : 0;

      const memberIndex = matchAssignee(i);
      if (memberIndex === null) {
        unmatchedHours += hours;
      } else {
        plannedByMemberIndex.set(
          memberIndex,
          (plannedByMemberIndex.get(memberIndex) ?? 0) + hours,
        );
      }
    }

    // Build per-member rows
    const out: CapacityRow[] = members.map((m, memberIndex) => {
      const ph = plannedByMemberIndex.get(memberIndex) ?? 0;
      const adjustedCapacity = Math.max(0, sprintHours - vacationImpactDays * 8);
      const variance = adjustedCapacity - ph;
      const loadRatio = adjustedCapacity > 0 ? ph / adjustedCapacity : (ph > 0 ? 2 : 1);
      const risk_level = loadRatio > 1.15 ? 'High' : loadRatio > 0.9 ? 'Medium' : 'Low';
      const fit_score = Math.max(0, Math.min(100, Math.round((1 - Math.abs(loadRatio - 0.85)) * 100)));
      return {
        display_name: m.display_name ?? '—',
        capacity_hours: adjustedCapacity,
        planned_hours: ph,
        variance,
        risk_level,
        fit_score,
      };
    });

    if (unmatchedHours > 0) {
      out.push({ display_name: t('capacity_fit.no_match_label'), capacity_hours: 0, planned_hours: unmatchedHours, variance: -unmatchedHours, risk_level: 'High', fit_score: 0 });
    }
    return out.sort((a, b) => a.variance - b.variance);
  }, [issues, members, sprintHours, vacationImpactDays, t]);

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
        {memberDirectoryStatus === 'loading' && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            {t('common.loading')}
          </div>
        )}
        {memberDirectoryStatus === 'error' && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-2" role="alert">
            <span className="text-xs text-destructive">{t('capacity_fit.member_directory_error')}</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 shrink-0"
              onClick={() => setMemberDirectoryRetry((generation) => generation + 1)}
            >
              {t('capacity_fit.retry_member_directory')}
            </Button>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <div>
            <Label className="text-xs">{t('capacity_fit.sprint_name_label')}</Label>
            <Input className="h-8 text-xs" value={sprintName} onChange={(e) => setSprintName(e.target.value)} placeholder="pl. Sprint 24" />
          </div>
          <div>
            <Label className="text-xs">{t('capacity_fit.sprint_hours_label')}</Label>
            <Input className="h-8 text-xs" type="number" value={sprintHours} onChange={(e) => setSprintHours(Number(e.target.value) || 0)} />
          </div>
          <div>
            <Label className="text-xs">{t('capacity_fit.what_if_label')}</Label>
            <Input className="h-8 text-xs" type="number" value={vacationImpactDays} onChange={(e) => setVacationImpactDays(Number(e.target.value) || 0)} />
          </div>
          <div className="flex items-end">
            <Button
              size="sm"
              onClick={loadIssues}
              disabled={loading || memberDirectoryStatus !== 'ready'}
              className="gap-1 w-full"
            >
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              {t('capacity_fit.fetch_btn')}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-md border p-2 text-center">
            <p className="text-[10px] uppercase text-muted-foreground">{t('capacity_fit.total_capacity_label')}</p>
            <p className="text-lg font-semibold">{totals.cap}h</p>
          </div>
          <div className="rounded-md border p-2 text-center">
            <p className="text-[10px] uppercase text-muted-foreground">{t('capacity_fit.planned_label')}</p>
            <p className="text-lg font-semibold">{totals.plan}h</p>
          </div>
          <div className={cn(
            'rounded-md border p-2 text-center',
            totals.variance < 0 ? 'bg-destructive/10' : 'bg-emerald-500/10',
          )}>
            <p className="text-[10px] uppercase text-muted-foreground">{t('capacity_fit.variance_label')}</p>
            <p className={cn('text-lg font-semibold', totals.variance < 0 ? 'text-destructive' : 'text-emerald-600')}>
              {totals.variance > 0 ? '+' : ''}{totals.variance}h
            </p>
          </div>
        </div>

        <div className="border rounded-md overflow-hidden overflow-x-auto">
          <table className="w-full text-xs min-w-[400px]">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-2">{t('capacity_fit.col_member')}</th>
                <th className="text-left p-2">{t('capacity_fit.col_capacity')}</th>
                <th className="text-left p-2">{t('capacity_fit.col_planned')}</th>
                <th className="text-left p-2">{t('capacity_fit.variance_label')}</th>
                <th className="text-left p-2">{t('capacity_fit.col_status')}</th>
                <th className="text-left p-2">{t('capacity_fit.col_fit')}</th>
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
                      {r.risk_level === 'High' && <Badge variant="destructive" className="text-[10px]">{t('capacity_fit.risk_high')}</Badge>}
                      {r.risk_level === 'Medium' && <Badge variant="outline" className="text-[10px]">{t('capacity_fit.risk_medium')}</Badge>}
                      {r.risk_level === 'Low' && <Badge variant="secondary" className="text-[10px]">{t('capacity_fit.risk_low')}</Badge>}
                      {overload && <Badge variant="destructive" className="text-[10px] ml-1">{t('capacity_fit.overload_badge')}</Badge>}
                      {!overload && underload && <Badge variant="outline" className="text-[10px] ml-1">{t('capacity_fit.underload_badge')}</Badge>}
                    </td>
                    <td className="p-2 font-medium">{r.fit_score}%</td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">
                  {t('capacity_fit.no_sprint_hint')}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
