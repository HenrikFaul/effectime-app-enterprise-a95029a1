import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, KanbanSquare, Trello, GanttChart, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface IntegrationMini {
  id: string;
  provider: 'jira' | 'azure_devops';
  project_key: string | null;
}

interface IssueRow {
  external_key: string;
  summary: string | null;
  description: string | null;
  status: string | null;
  priority: string | null;
  issue_type: string | null;
  assignee_name: string | null;
  assignee_email: string | null;
  reporter_email: string | null;
  parent_key: string | null;
  sprint_name: string | null;
  team_name: string | null;
  start_date: string | null;
  due_date: string | null;
  labels: string[] | null;
  story_points: number | null;
  url: string | null;
}

const ISSUE_TYPE_COLOR: Record<string, string> = {
  Epic: 'bg-purple-500/15 text-purple-600 border-purple-500/30',
  Story: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
  Task: 'bg-sky-500/15 text-sky-600 border-sky-500/30',
  Bug: 'bg-red-500/15 text-red-600 border-red-500/30',
  'Sub-task': 'bg-amber-500/15 text-amber-700 border-amber-500/30',
};

export function AgileBoards({ integration }: { integration: IntegrationMini }) {
  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    const { data } = await (supabase as any)
      .from('enterprise_agile_issues')
      .select('external_key,summary,description,status,priority,issue_type,assignee_name,assignee_email,reporter_email,parent_key,sprint_name,team_name,start_date,due_date,labels,story_points,url')
      .eq('integration_id', integration.id)
      .order('last_synced_at', { ascending: false })
      .limit(500);
    setIssues((data ?? []) as IssueRow[]);
  };

  const sync = async () => {
    setLoading(true);
    try {
      const query = integration.provider === 'jira'
        ? `project = "${integration.project_key}" ORDER BY updated DESC`
        : '';
      const { data, error } = await supabase.functions.invoke('jira-devops-proxy', {
        body: { action: 'search_issues', integration_id: integration.id, params: { query, max: 200 } },
      });
      if (error) throw error;
      if (!(data as any)?.ok) throw new Error((data as any)?.error ?? 'Hibás válasz');
      toast.success(`${(data as any).count} ticket szinkronizálva`);
      await refresh();
    } catch (e: any) {
      toast.error('Szinkron sikertelen: ' + (e?.message ?? String(e)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, [integration.id]);

  return (
    <Card>
      <CardHeader className="pb-3 flex-row items-center justify-between">
        <CardTitle className="text-sm">Boards (Kanban / Scrum / Gantt)</CardTitle>
        <Button size="sm" variant="outline" onClick={sync} disabled={loading} className="gap-1">
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          Szinkron
        </Button>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="kanban">
          <TabsList>
            <TabsTrigger value="kanban" className="gap-1"><KanbanSquare className="h-4 w-4" /> Kanban</TabsTrigger>
            <TabsTrigger value="scrum" className="gap-1"><Trello className="h-4 w-4" /> Scrum</TabsTrigger>
            <TabsTrigger value="gantt" className="gap-1"><GanttChart className="h-4 w-4" /> Gantt</TabsTrigger>
          </TabsList>
          <TabsContent value="kanban"><KanbanView issues={issues} /></TabsContent>
          <TabsContent value="scrum"><ScrumView issues={issues} /></TabsContent>
          <TabsContent value="gantt"><GanttView issues={issues} /></TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// ───── Card primitive ─────
function IssueCard({ i }: { i: IssueRow }) {
  return (
    <div className="rounded-md border bg-card p-2 shadow-sm hover:shadow-md transition-shadow space-y-1.5">
      <div className="text-[11px] leading-tight font-medium line-clamp-2">{i.summary}</div>
      {i.issue_type && (
        <Badge variant="outline" className={cn('text-[9px] px-1 py-0', ISSUE_TYPE_COLOR[i.issue_type] ?? '')}>
          {i.issue_type}
        </Badge>
      )}
      <div className="flex items-center justify-between gap-1">
        <a href={i.url ?? '#'} target="_blank" rel="noreferrer" className="text-[9px] font-mono text-primary hover:underline inline-flex items-center gap-0.5">
          {i.external_key} <ExternalLink className="h-2.5 w-2.5" />
        </a>
        {typeof i.story_points === 'number' && (
          <span className="text-[9px] font-semibold text-muted-foreground">{i.story_points} SP</span>
        )}
      </div>
      <div className="flex items-center justify-between text-[9px] text-muted-foreground">
        <span className="truncate max-w-[60%]">{i.assignee_name ?? '—'}</span>
        {i.priority && <span>{i.priority}</span>}
      </div>
      {i.labels && i.labels.length > 0 && (
        <div className="flex flex-wrap gap-0.5">
          {i.labels.slice(0, 3).map((l) => (
            <span key={l} className="text-[8px] px-1 rounded bg-muted">{l}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// ───── Kanban: group by status ─────
function KanbanView({ issues }: { issues: IssueRow[] }) {
  const groups = useMemo(() => {
    const map = new Map<string, IssueRow[]>();
    for (const i of issues) {
      const k = i.status ?? 'No status';
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(i);
    }
    // Standard ordering preference
    const order = ['To Do', 'Backlog', 'Open', 'In Progress', 'In Review', 'Review', 'Done', 'Closed'];
    return Array.from(map.entries()).sort((a, b) => {
      const ia = order.findIndex((o) => o.toLowerCase() === a[0].toLowerCase());
      const ib = order.findIndex((o) => o.toLowerCase() === b[0].toLowerCase());
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
  }, [issues]);

  if (issues.length === 0) return <Empty />;
  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex gap-3 min-w-max">
        {groups.map(([status, list]) => (
          <div key={status} className="w-64 shrink-0">
            <div className="flex items-center justify-between mb-2 px-1">
              <h4 className="text-xs font-semibold uppercase tracking-wide">{status}</h4>
              <Badge variant="secondary" className="text-[10px]">{list.length}</Badge>
            </div>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {list.map((i) => <IssueCard key={i.external_key} i={i} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ───── Scrum: group by sprint, then status sub-columns ─────
function ScrumView({ issues }: { issues: IssueRow[] }) {
  const sprints = useMemo(() => {
    const map = new Map<string, IssueRow[]>();
    for (const i of issues) {
      const k = i.sprint_name ?? 'Backlog (nincs sprint)';
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(i);
    }
    return Array.from(map.entries());
  }, [issues]);

  if (issues.length === 0) return <Empty />;
  return (
    <div className="space-y-4">
      {sprints.map(([sprint, list]) => {
        const totalSP = list.reduce((s, i) => s + (i.story_points ?? 0), 0);
        const statusGroups = new Map<string, IssueRow[]>();
        for (const i of list) {
          const k = i.status ?? 'No status';
          if (!statusGroups.has(k)) statusGroups.set(k, []);
          statusGroups.get(k)!.push(i);
        }
        return (
          <div key={sprint} className="border rounded-md p-3 bg-muted/20">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold">{sprint}</h4>
              <div className="flex gap-2 text-[10px] text-muted-foreground">
                <span>{list.length} ticket</span>
                <span>•</span>
                <span>{totalSP} SP</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <div className="flex gap-2 min-w-max">
                {Array.from(statusGroups.entries()).map(([status, items]) => (
                  <div key={status} className="w-56 shrink-0">
                    <div className="text-[10px] uppercase mb-1 font-medium">{status} ({items.length})</div>
                    <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                      {items.map((i) => <IssueCard key={i.external_key} i={i} />)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ───── Gantt: simple horizontal timeline ─────
function GanttView({ issues }: { issues: IssueRow[] }) {
  const dated = issues.filter((i) => (i.start_date || i.due_date));
  if (dated.length === 0) return <Empty hint="Nincs start/due date a ticketeken" />;

  const parsed = dated.map((i) => {
    const s = i.start_date ? new Date(i.start_date) : (i.due_date ? new Date(i.due_date) : new Date());
    const e = i.due_date ? new Date(i.due_date) : (i.start_date ? new Date(i.start_date) : new Date());
    return { i, s, e };
  });
  const min = new Date(Math.min(...parsed.map((p) => p.s.getTime())));
  const max = new Date(Math.max(...parsed.map((p) => p.e.getTime())));
  const totalMs = Math.max(1, max.getTime() - min.getTime());

  // Build month tick marks
  const months: Date[] = [];
  const cur = new Date(min.getFullYear(), min.getMonth(), 1);
  while (cur <= max) { months.push(new Date(cur)); cur.setMonth(cur.getMonth() + 1); }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[720px]">
        <div className="flex border-b text-[10px] uppercase text-muted-foreground sticky top-0 bg-background">
          <div className="w-56 shrink-0 p-2 border-r">Ticket</div>
          <div className="flex-1 flex">
            {months.map((m, idx) => (
              <div key={idx} className="flex-1 p-2 border-r text-center">
                {m.toLocaleString('hu-HU', { month: 'short', year: '2-digit' })}
              </div>
            ))}
          </div>
        </div>
        {parsed.map(({ i, s, e }) => {
          const left = ((s.getTime() - min.getTime()) / totalMs) * 100;
          const width = Math.max(2, ((e.getTime() - s.getTime()) / totalMs) * 100);
          const color =
            i.issue_type === 'Bug' ? 'bg-red-500'
              : i.issue_type === 'Epic' ? 'bg-purple-500'
              : i.issue_type === 'Story' ? 'bg-emerald-500'
              : 'bg-sky-500';
          return (
            <div key={i.external_key} className="flex border-b items-center hover:bg-accent/30">
              <div className="w-56 shrink-0 p-2 border-r">
                <div className="text-[11px] font-medium truncate">{i.summary}</div>
                <div className="text-[9px] text-muted-foreground font-mono">{i.external_key} • {i.assignee_name ?? '—'}</div>
              </div>
              <div className="flex-1 relative h-9">
                <div
                  className={cn('absolute top-2 h-5 rounded-sm', color, 'opacity-90')}
                  style={{ left: `${left}%`, width: `${width}%` }}
                  title={`${i.start_date ?? ''} → ${i.due_date ?? ''}`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Empty({ hint }: { hint?: string } = {}) {
  return (
    <div className="py-10 text-center text-xs text-muted-foreground">
      Nincs adat. {hint ?? 'Indíts el egy szinkront a fenti gombbal.'}
    </div>
  );
}
