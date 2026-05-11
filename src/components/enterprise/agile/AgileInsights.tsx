import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3 } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

interface Props {
  integrationId: string;
}

interface AgileIssueLite {
  external_key: string;
  status: string | null;
  sprint_name: string | null;
  assignee_name: string | null;
  assignee_email: string | null;
  story_points: number | null;
  original_estimate_hours: number | null;
  remaining_hours: number | null;
  due_date: string | null;
  updated_at: string;
}

const DONE_STATES = ['done', 'closed', 'resolved', 'kész'];

export function AgileInsights({ integrationId }: Props) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [issues, setIssues] = useState<AgileIssueLite[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from('enterprise_agile_issues')
        .select('external_key,status,sprint_name,assignee_name,assignee_email,story_points,original_estimate_hours,remaining_hours,due_date,updated_at')
        .eq('integration_id', integrationId)
        .order('updated_at', { ascending: false })
        .limit(2000);
      setIssues((data ?? []) as AgileIssueLite[]);
      setLoading(false);
    })();
  }, [integrationId]);

  const metrics = useMemo(() => {
    const nowIso = new Date().toISOString().slice(0, 10);
    let open = 0;
    let overdue = 0;
    let totalRemaining = 0;
    const sprintCounts = new Map<string, number>();
    const assigneeHours = new Map<string, number>();

    for (const issue of issues) {
      const st = (issue.status ?? '').toLowerCase();
      const isDone = DONE_STATES.some((s) => st.includes(s));
      if (!isDone) {
        open += 1;
        if (issue.due_date && issue.due_date < nowIso) overdue += 1;
      }

      const sprint = issue.sprint_name?.trim() || t('agile_insights.no_sprint');
      sprintCounts.set(sprint, (sprintCounts.get(sprint) ?? 0) + 1);

      const person = (issue.assignee_name?.trim() || issue.assignee_email?.trim() || t('agile_insights.unassigned'));
      const hours = Number(issue.remaining_hours ?? issue.original_estimate_hours ?? (issue.story_points ?? 0) * 4);
      assigneeHours.set(person, (assigneeHours.get(person) ?? 0) + hours);
      totalRemaining += hours;
    }

    const topSprints = [...sprintCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topLoad = [...assigneeHours.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

    return {
      open,
      overdue,
      totalRemaining: Math.round(totalRemaining),
      topSprints,
      topLoad,
    };
  }, [issues]);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" /> Agile riport</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" /> {t('agile_insights.card_title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        <div className="grid grid-cols-3 gap-2">
          <Metric title="Nyitott ticket" value={metrics.open} />
          <Metric title={t('agile_insights.overdue_label')} value={metrics.overdue} tone="danger" />
          <Metric title={t('agile_insights.remaining_estimate_label')} value={`${metrics.totalRemaining}h`} />
        </div>

        <div className="rounded-md border p-2">
          <div className="font-medium mb-1">{t('agile_insights.sprint_load_title')}</div>
          <div className="flex flex-wrap gap-1.5">
            {metrics.topSprints.length === 0 && <span className="text-muted-foreground">Nincs adat.</span>}
            {metrics.topSprints.map(([name, count]) => (
              <Badge key={name} variant="outline" className="text-[10px]">{name}: {count}</Badge>
            ))}
          </div>
        </div>

        <div className="rounded-md border p-2">
          <div className="font-medium mb-1">{t('agile_insights.resource_alloc_title')}</div>
          <div className="space-y-1.5">
            {metrics.topLoad.length === 0 && <div className="text-muted-foreground">Nincs adat.</div>}
            {metrics.topLoad.map(([name, hours]) => (
              <div key={name} className="flex items-center gap-2">
                <div className="w-40 truncate">{name}</div>
                <div className="h-2 rounded bg-primary/20 flex-1 overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${Math.min(100, (hours / Math.max(1, metrics.topLoad[0]?.[1] ?? 1)) * 100)}%` }} />
                </div>
                <div className="w-12 text-right font-medium">{Math.round(hours)}h</div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ title, value, tone = 'default' }: { title: string; value: string | number; tone?: 'default' | 'danger' }) {
  return (
    <div className={`rounded-md border p-2 text-center ${tone === 'danger' ? 'bg-rose-500/10' : ''}`}>
      <div className="text-[10px] uppercase text-muted-foreground">{title}</div>
      <div className={`text-lg font-semibold ${tone === 'danger' ? 'text-rose-600' : ''}`}>{value}</div>
    </div>
  );
}
