/**
 * MemberExtendedDetails — "Bővebb adatok" view inside MemberProfileSheet.
 *
 * Renders six sections for one member, each with a deep-link button that
 * navigates to the corresponding workspace tab via onNavigateTab:
 *   1. Skills        → resources tab
 *   2. Onboarding    → workflows tab
 *   3. Access        → workflows tab
 *   4. Goals         → no link (managed inline; admin can add new goals)
 *   5. Jira tickets  → resources tab (agile sub-tab)
 *   6. Performance   → resources tab (story-points per month chart)
 *
 * All queries are null-safe and degrade gracefully when an optional table is
 * missing (e.g. enterprise_member_goals before its migration is applied) —
 * see [LESSON-SUPABASE-SDK-017] in codingLessonsLearnt.md.
 */

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Award,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  ExternalLink,
  GitMerge,
  KeyRound,
  Plus,
  Star,
  Target,
  TrendingUp,
  XCircle,
  Briefcase,
  BarChart3,
  LineChart as LineChartIcon,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area } from 'recharts';
import { format, startOfMonth, subMonths } from 'date-fns';
import { toast } from 'sonner';

interface ExtendedMember {
  id: string;
  user_id: string;
  display_name?: string;
}

interface Props {
  workspaceId: string;
  member: ExtendedMember;
  isAdmin: boolean;
  onNavigateTab?: (tab: string) => void;
}

interface SkillRow {
  id: string;
  level: number;
  skill_name: string;
}

interface OnboardingInstance {
  id: string;
  status: string;
  started_at: string;
  due_at: string | null;
  completed_at: string | null;
  template_name: string | null;
  total_steps: number;
  done_steps: number;
}

interface AccessRow {
  id: string;
  status: string;
  requested_at: string;
  decided_at: string | null;
  system_name: string;
}

interface GoalRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  target_date: string | null;
  achieved_at: string | null;
  created_at: string;
}

interface JiraIssue {
  id: string;
  external_key: string;
  summary: string | null;
  status: string | null;
  priority: string | null;
  issue_type: string | null;
  story_points: number | null;
  due_date: string | null;
  url: string | null;
  external_updated_at: string | null;
}

const GOAL_STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  open: { label: 'Nyitott', variant: 'outline' },
  in_progress: { label: 'Folyamatban', variant: 'secondary' },
  achieved: { label: 'Elérve', variant: 'default' },
  dropped: { label: 'Elejtve', variant: 'destructive' },
};

const ACCESS_STATUS_LABELS: Record<string, string> = {
  pending: 'Függő',
  approved: 'Jóváhagyva',
  provisioning: 'Provisioning',
  granted: 'Megadva',
  rejected: 'Elutasítva',
  revoked: 'Visszavonva',
  cancelled: 'Visszavont',
};

export function MemberExtendedDetails({ workspaceId, member, isAdmin, onNavigateTab }: Props) {
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [onboarding, setOnboarding] = useState<OnboardingInstance[]>([]);
  const [access, setAccess] = useState<AccessRow[]>([]);
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [goalsTableMissing, setGoalsTableMissing] = useState(false);
  const [issues, setIssues] = useState<JiraIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartType, setChartType] = useState<'bar' | 'area'>(() => {
    if (typeof window === 'undefined') return 'bar';
    const saved = window.localStorage.getItem('effectime.member.performanceChart');
    return saved === 'area' ? 'area' : 'bar';
  });

  const memberName = member.display_name || '';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      // Skills — left join skill names via two separate queries to stay null-safe.
      const skillRowsRes = await (supabase as any)
        .from('enterprise_member_skills')
        .select('id, level, skill_id')
        .eq('workspace_id', workspaceId)
        .eq('membership_id', member.id);

      let skillNameById = new Map<string, string>();
      const skillIds = ((skillRowsRes.data as any[]) || []).map((r: any) => r.skill_id).filter(Boolean);
      if (skillIds.length > 0) {
        const namesRes = await (supabase as any)
          .from('enterprise_skills')
          .select('id, name')
          .in('id', skillIds);
        skillNameById = new Map(((namesRes.data as any[]) || []).map((s: any) => [s.id, s.name]));
      }

      const enrichedSkills: SkillRow[] = ((skillRowsRes.data as any[]) || []).map((r: any) => ({
        id: r.id,
        level: Number(r.level ?? 3),
        skill_name: skillNameById.get(r.skill_id) || '—',
      })).filter((s: SkillRow) => s.skill_name !== '—');

      // Onboarding instances + step completion counts.
      const instancesRes = await (supabase as any)
        .from('enterprise_onboarding_instances')
        .select('id, status, started_at, due_at, completed_at, template_id')
        .eq('workspace_id', workspaceId)
        .eq('member_id', member.id)
        .order('started_at', { ascending: false });

      const instances = (instancesRes.data as any[]) || [];
      const tplIds = Array.from(new Set(instances.map((i: any) => i.template_id).filter(Boolean)));
      let tplName = new Map<string, string>();
      if (tplIds.length > 0) {
        const tplRes = await (supabase as any)
          .from('enterprise_onboarding_templates')
          .select('id, name')
          .in('id', tplIds);
        tplName = new Map(((tplRes.data as any[]) || []).map((t: any) => [t.id, t.name]));
      }

      const instanceIds = instances.map((i: any) => i.id);
      let stepCounts = new Map<string, { total: number; done: number }>();
      if (instanceIds.length > 0) {
        const compRes = await (supabase as any)
          .from('enterprise_onboarding_step_completions')
          .select('instance_id, status')
          .in('instance_id', instanceIds);
        ((compRes.data as any[]) || []).forEach((c: any) => {
          const cur = stepCounts.get(c.instance_id) ?? { total: 0, done: 0 };
          cur.total += 1;
          if (c.status === 'completed' || c.status === 'skipped') cur.done += 1;
          stepCounts.set(c.instance_id, cur);
        });
      }

      const enrichedOnboarding: OnboardingInstance[] = instances.map((i: any) => {
        const counts = stepCounts.get(i.id) ?? { total: 0, done: 0 };
        return {
          id: i.id,
          status: i.status,
          started_at: i.started_at,
          due_at: i.due_at,
          completed_at: i.completed_at,
          template_name: i.template_id ? tplName.get(i.template_id) ?? null : null,
          total_steps: counts.total,
          done_steps: counts.done,
        };
      });

      // Access requests (with system name).
      const accessReqRes = await (supabase as any)
        .from('enterprise_access_requests')
        .select('id, status, requested_at, decided_at, system_id')
        .eq('workspace_id', workspaceId)
        .eq('member_id', member.id)
        .order('requested_at', { ascending: false });

      const accessReqs = (accessReqRes.data as any[]) || [];
      const sysIds = Array.from(new Set(accessReqs.map((a: any) => a.system_id).filter(Boolean)));
      let sysName = new Map<string, string>();
      if (sysIds.length > 0) {
        const sysRes = await (supabase as any)
          .from('enterprise_access_systems')
          .select('id, name')
          .in('id', sysIds);
        sysName = new Map(((sysRes.data as any[]) || []).map((s: any) => [s.id, s.name]));
      }
      const enrichedAccess: AccessRow[] = accessReqs.map((a: any) => ({
        id: a.id,
        status: a.status,
        requested_at: a.requested_at,
        decided_at: a.decided_at,
        system_name: a.system_id ? sysName.get(a.system_id) ?? '—' : '—',
      }));

      // Goals — null-safe for missing table (migration may not be applied yet).
      let goalRows: GoalRow[] = [];
      let goalsMissing = false;
      try {
        const goalsRes = await (supabase as any)
          .from('enterprise_member_goals')
          .select('id, title, description, status, target_date, achieved_at, created_at')
          .eq('workspace_id', workspaceId)
          .eq('member_id', member.id)
          .order('created_at', { ascending: false });

        if (goalsRes.error) {
          // Postgres "relation does not exist" → 42P01
          if (String(goalsRes.error.code) === '42P01' || /does not exist/i.test(goalsRes.error.message ?? '')) {
            goalsMissing = true;
          } else {
            console.warn('[MemberExtendedDetails] goals load error:', goalsRes.error.message);
          }
        } else {
          goalRows = (goalsRes.data as GoalRow[]) || [];
        }
      } catch (e) {
        console.warn('[MemberExtendedDetails] goals load exception:', e);
        goalsMissing = true;
      }

      // Jira issues assigned to this member by display name (assignee_name match).
      // The seed populates assignee_name with the persona display name; live syncs
      // also set this field, so name-matching works for both demo and real data.
      let jiraRows: JiraIssue[] = [];
      if (memberName) {
        const issuesRes = await (supabase as any)
          .from('enterprise_agile_issues')
          .select('id, external_key, summary, status, priority, issue_type, story_points, due_date, url, external_updated_at')
          .eq('workspace_id', workspaceId)
          .eq('assignee_name', memberName)
          .order('due_date', { ascending: false, nullsFirst: false })
          .limit(60);
        jiraRows = (issuesRes.data as JiraIssue[]) || [];
      }

      if (cancelled) return;
      setSkills(enrichedSkills);
      setOnboarding(enrichedOnboarding);
      setAccess(enrichedAccess);
      setGoals(goalRows);
      setGoalsTableMissing(goalsMissing);
      setIssues(jiraRows);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [workspaceId, member.id, memberName]);

  // Performance chart: completed story points per month over last 12 months.
  // Uses external_updated_at (when available) for Done issues, falling back to due_date.
  const performanceData = useMemo(() => {
    const now = new Date();
    const months: { key: string; label: string; date: Date; points: number; count: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = startOfMonth(subMonths(now, i));
      months.push({
        key: format(d, 'yyyy-MM'),
        label: format(d, 'yyyy MMM'),
        date: d,
        points: 0,
        count: 0,
      });
    }
    const monthByKey = new Map(months.map((m) => [m.key, m]));

    const isDone = (status: string | null) => {
      if (!status) return false;
      const s = status.toLowerCase();
      return s === 'done' || s === 'closed' || s === 'resolved' || s === 'completed';
    };

    issues.forEach((i) => {
      if (!isDone(i.status)) return;
      const refDate = i.external_updated_at || i.due_date;
      if (!refDate) return;
      const d = new Date(refDate);
      if (isNaN(d.getTime())) return;
      const key = format(startOfMonth(d), 'yyyy-MM');
      const bucket = monthByKey.get(key);
      if (!bucket) return;
      bucket.points += Number(i.story_points ?? 0);
      bucket.count += 1;
    });

    return months.map((m) => ({ month: m.label.slice(5), points: m.points, count: m.count }));
  }, [issues]);

  const totalCompletedPoints = useMemo(
    () => performanceData.reduce((s, m) => s + m.points, 0),
    [performanceData],
  );
  const totalCompletedIssues = useMemo(
    () => performanceData.reduce((s, m) => s + m.count, 0),
    [performanceData],
  );

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ─── Skills ─────────────────────────────────────────────────────── */}
      <SectionCard
        icon={<Star className="h-4 w-4 text-primary" />}
        title="Készségek"
        action={onNavigateTab && (
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => onNavigateTab('resources')}>
            Készségek menü <ArrowRight className="h-3 w-3" />
          </Button>
        )}
      >
        {skills.length === 0 ? (
          <p className="text-xs text-muted-foreground">Még nincs rögzített készség ehhez a taghoz.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {skills.map((s) => (
              <Badge key={s.id} variant="secondary" className="text-xs gap-1.5 py-1 px-2">
                <span className="font-medium">{s.skill_name}</span>
                <span className="text-[10px] text-muted-foreground">{'★'.repeat(s.level)}{'☆'.repeat(Math.max(0, 5 - s.level))}</span>
              </Badge>
            ))}
          </div>
        )}
      </SectionCard>

      {/* ─── Onboarding ─────────────────────────────────────────────────── */}
      <SectionCard
        icon={<BookOpen className="h-4 w-4 text-primary" />}
        title="Onboarding"
        action={onNavigateTab && (
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => onNavigateTab('workflows')}>
            Folyamatok menü <ArrowRight className="h-3 w-3" />
          </Button>
        )}
      >
        {onboarding.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nincs hozzárendelt onboarding folyamat.</p>
        ) : (
          <div className="space-y-2">
            {onboarding.map((o) => {
              const pct = o.total_steps > 0 ? Math.round((o.done_steps / o.total_steps) * 100) : 0;
              return (
                <div key={o.id} className="rounded-md border p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium truncate">{o.template_name || 'Onboarding'}</div>
                    <Badge variant={o.status === 'completed' ? 'default' : o.status === 'cancelled' ? 'outline' : 'secondary'} className="text-[10px]">
                      {o.status === 'completed' ? 'Kész' : o.status === 'cancelled' ? 'Megszakítva' : 'Folyamatban'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{o.done_steps} / {o.total_steps} lépés</span>
                    <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="tabular-nums">{pct}%</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Indítás: {format(new Date(o.started_at), 'yyyy.MM.dd.')}
                    {o.due_at ? ` · Határidő: ${format(new Date(o.due_at), 'yyyy.MM.dd.')}` : ''}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* ─── Access requests ────────────────────────────────────────────── */}
      <SectionCard
        icon={<KeyRound className="h-4 w-4 text-primary" />}
        title="Hozzáférések"
        action={onNavigateTab && (
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => onNavigateTab('workflows')}>
            Hozzáférések menü <ArrowRight className="h-3 w-3" />
          </Button>
        )}
      >
        {access.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nincs benyújtott hozzáférés-kérelem.</p>
        ) : (
          <div className="space-y-1.5">
            {access.slice(0, 12).map((a) => {
              const closed = a.status === 'granted' || a.status === 'rejected' || a.status === 'revoked' || a.status === 'cancelled';
              return (
                <div key={a.id} className="flex items-center gap-2 text-sm">
                  {a.status === 'granted' ? <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> :
                    a.status === 'rejected' || a.status === 'revoked' || a.status === 'cancelled' ? <XCircle className="h-3.5 w-3.5 text-destructive" /> :
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />}
                  <span className="truncate flex-1">{a.system_name}</span>
                  <Badge variant={closed ? 'outline' : 'secondary'} className="text-[10px]">
                    {ACCESS_STATUS_LABELS[a.status] ?? a.status}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {format(new Date(a.requested_at), 'yyyy.MM.dd.')}
                  </span>
                </div>
              );
            })}
            {access.length > 12 && (
              <p className="text-[10px] text-muted-foreground">+ {access.length - 12} további kérelem</p>
            )}
          </div>
        )}
      </SectionCard>

      {/* ─── Goals / achievements ──────────────────────────────────────── */}
      <GoalsSection
        workspaceId={workspaceId}
        memberId={member.id}
        goals={goals}
        tableMissing={goalsTableMissing}
        isAdmin={isAdmin}
        onChange={setGoals}
      />

      {/* ─── Jira tickets ───────────────────────────────────────────────── */}
      <SectionCard
        icon={<GitMerge className="h-4 w-4 text-primary" />}
        title="Hozzá rendelt Jira jegyek"
        action={onNavigateTab && (
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => onNavigateTab('resources')}>
            Agile menü <ArrowRight className="h-3 w-3" />
          </Button>
        )}
      >
        {issues.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nincs hozzá rendelt jegy.</p>
        ) : (
          <div className="space-y-1.5">
            {issues.slice(0, 15).map((i) => (
              <div key={i.id} className="flex items-center gap-1.5 text-sm min-w-0">
                <Badge variant="outline" className="text-[10px] font-mono shrink-0 px-1.5">
                  {i.external_key}
                </Badge>
                <span className="truncate flex-1 min-w-0" title={i.summary || ''}>{i.summary || '—'}</span>
                {typeof i.story_points === 'number' && (
                  <Badge variant="secondary" className="text-[10px] gap-1 shrink-0 px-1.5">
                    <Briefcase className="h-2.5 w-2.5" /> {i.story_points} SP
                  </Badge>
                )}
                <Badge
                  variant={i.status?.toLowerCase() === 'done' ? 'default' : 'outline'}
                  className="text-[10px] shrink-0 px-1.5"
                >
                  {i.status || '—'}
                </Badge>
                {i.url && (
                  <a
                    href={i.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground hover:text-primary shrink-0 inline-flex h-5 w-5 items-center justify-center rounded hover:bg-accent"
                    title="Megnyitás külső rendszerben"
                    aria-label="Megnyitás külső rendszerben"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            ))}
            {issues.length > 15 && (
              <p className="text-[10px] text-muted-foreground">+ {issues.length - 15} további jegy</p>
            )}
          </div>
        )}
      </SectionCard>

      {/* ─── Performance chart ──────────────────────────────────────────── */}
      <SectionCard
        icon={<TrendingUp className="h-4 w-4 text-primary" />}
        title="Teljesítmény (utolsó 12 hónap)"
        action={
          <div className="flex items-center gap-2">
            <ChartTypeToggle
              value={chartType}
              onChange={(v) => {
                setChartType(v);
                try { window.localStorage.setItem('effectime.member.performanceChart', v); } catch {}
              }}
            />
            <Badge variant="outline" className="text-[10px] tabular-nums">
              {totalCompletedPoints} SP · {totalCompletedIssues} jegy
            </Badge>
          </div>
        }
      >
        {totalCompletedIssues === 0 ? (
          <p className="text-xs text-muted-foreground">Még nincs lezárt jegy story-pointtal.</p>
        ) : (
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'bar' ? (
                <BarChart data={performanceData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.4)" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 8,
                      fontSize: 11,
                    }}
                    formatter={(v: any, name: string) => [
                      String(v),
                      name === 'points' ? 'Story points' : 'Lezárt jegyek',
                    ]}
                  />
                  <Bar dataKey="points" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : (
                <AreaChart data={performanceData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="perfPoints" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.55} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="perfCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(160 84% 45%)" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="hsl(160 84% 45%)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.4)" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 8,
                      fontSize: 11,
                    }}
                    formatter={(v: any, name: string) => [
                      String(v),
                      name === 'points' ? 'Story points' : 'Lezárt jegyek',
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="points"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#perfPoints)"
                    dot={{ r: 3, strokeWidth: 1.5, fill: 'hsl(var(--background))', stroke: 'hsl(var(--primary))' }}
                    activeDot={{ r: 4 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="hsl(160 84% 45%)"
                    strokeWidth={2}
                    fill="url(#perfCount)"
                    dot={{ r: 3, strokeWidth: 1.5, fill: 'hsl(var(--background))', stroke: 'hsl(160 84% 45%)' }}
                    activeDot={{ r: 4 }}
                  />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ───── helpers ───────────────────────────────────────────────────────────────

function ChartTypeToggle({ value, onChange }: { value: 'bar' | 'area'; onChange: (v: 'bar' | 'area') => void }) {
  return (
    <div className="inline-flex items-center rounded-md border bg-muted/40 p-0.5" role="group" aria-label="Diagram típusa">
      <button
        type="button"
        onClick={() => onChange('bar')}
        className={`inline-flex h-6 w-6 items-center justify-center rounded-sm transition-colors ${
          value === 'bar' ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
        }`}
        title="Oszlopdiagram"
        aria-label="Oszlopdiagram"
        aria-pressed={value === 'bar'}
      >
        <BarChart3 className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onChange('area')}
        className={`inline-flex h-6 w-6 items-center justify-center rounded-sm transition-colors ${
          value === 'area' ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
        }`}
        title="Vonal-/területdiagram"
        aria-label="Vonal-/területdiagram"
        aria-pressed={value === 'area'}
      >
        <LineChartIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function SectionCard({
  icon,
  title,
  action,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">{icon}{title}</span>
          {action}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3">{children}</CardContent>
    </Card>
  );
}

function GoalsSection({
  workspaceId,
  memberId,
  goals,
  tableMissing,
  isAdmin,
  onChange,
}: {
  workspaceId: string;
  memberId: string;
  goals: GoalRow[];
  tableMissing: boolean;
  isAdmin: boolean;
  onChange: (next: GoalRow[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const t = title.trim();
    if (!t) {
      toast.error('Adj meg egy címet.');
      return;
    }
    setSaving(true);
    const { data, error } = await (supabase as any)
      .from('enterprise_member_goals')
      .insert({
        workspace_id: workspaceId,
        member_id: memberId,
        title: t,
        description: description.trim() || null,
        target_date: targetDate || null,
        status: 'open',
      })
      .select('id, title, description, status, target_date, achieved_at, created_at')
      .single();
    setSaving(false);
    if (error || !data) {
      toast.error(error?.message ?? 'Nem sikerült menteni a célt.');
      return;
    }
    onChange([data as GoalRow, ...goals]);
    setTitle('');
    setDescription('');
    setTargetDate('');
    setAdding(false);
    toast.success('Cél hozzáadva.');
  };

  const updateStatus = async (goal: GoalRow, status: string) => {
    const patch: any = { status };
    if (status === 'achieved') patch.achieved_at = new Date().toISOString();
    if (status !== 'achieved' && goal.achieved_at) patch.achieved_at = null;
    const { error } = await (supabase as any)
      .from('enterprise_member_goals')
      .update(patch)
      .eq('id', goal.id);
    if (error) {
      toast.error('Státusz frissítés sikertelen.');
      return;
    }
    onChange(goals.map((g) => (g.id === goal.id ? { ...g, ...patch } : g)));
  };

  return (
    <SectionCard
      icon={<Target className="h-4 w-4 text-primary" />}
      title="Meghatározott célok"
      action={
        isAdmin && !tableMissing ? (
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setAdding((v) => !v)}>
            <Plus className="h-3 w-3" /> {adding ? 'Mégse' : 'Új cél'}
          </Button>
        ) : null
      }
    >
      {tableMissing ? (
        <p className="text-xs text-muted-foreground">
          A célok modul még nincs telepítve. Futtasd le a legújabb adatbázis-migrációt
          (<code className="font-mono">enterprise_member_goals</code>) az engedélyezéséhez.
        </p>
      ) : (
        <>
          {adding && (
            <div className="rounded-md border p-3 space-y-2 mb-3">
              <div>
                <Label className="text-xs">Cím *</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Pl. Q3 review – mentor szerep"
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Leírás</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="One-to-one beszélgetésen rögzített cél / megállapodás…"
                  className="text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Határidő</Label>
                <Input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button size="sm" variant="ghost" onClick={() => setAdding(false)} disabled={saving}>Mégse</Button>
                <Button size="sm" onClick={submit} disabled={saving}>
                  {saving ? 'Mentés…' : 'Mentés'}
                </Button>
              </div>
            </div>
          )}

          {goals.length === 0 ? (
            <p className="text-xs text-muted-foreground">Még nincsenek meghatározott célok ennél a tagnál.</p>
          ) : (
            <div className="space-y-2">
              {goals.map((g) => {
                const meta = GOAL_STATUS_LABELS[g.status] ?? { label: g.status, variant: 'outline' as const };
                return (
                  <div key={g.id} className="rounded-md border p-2.5 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium flex items-center gap-1.5">
                          {g.status === 'achieved' && <Award className="h-3.5 w-3.5 text-primary" />}
                          <span className="truncate">{g.title}</span>
                        </div>
                        {g.description && (
                          <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line">{g.description}</p>
                        )}
                      </div>
                      <Badge variant={meta.variant} className="text-[10px] shrink-0">{meta.label}</Badge>
                    </div>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                      <span>{format(new Date(g.created_at), 'yyyy.MM.dd.')}</span>
                      {g.target_date && <span>· Határidő: {format(new Date(g.target_date), 'yyyy.MM.dd.')}</span>}
                      {g.achieved_at && <span>· Elérve: {format(new Date(g.achieved_at), 'yyyy.MM.dd.')}</span>}
                    </div>
                    {isAdmin && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {g.status !== 'in_progress' && (
                          <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => updateStatus(g, 'in_progress')}>Folyamatban</Button>
                        )}
                        {g.status !== 'achieved' && (
                          <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => updateStatus(g, 'achieved')}>Elért</Button>
                        )}
                        {g.status !== 'open' && (
                          <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => updateStatus(g, 'open')}>Visszanyit</Button>
                        )}
                        {g.status !== 'dropped' && (
                          <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 text-destructive" onClick={() => updateStatus(g, 'dropped')}>Elejt</Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </SectionCard>
  );
}
