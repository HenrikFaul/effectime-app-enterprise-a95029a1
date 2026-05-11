import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/i18n/I18nProvider';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Activity, AlertTriangle } from 'lucide-react';

interface Props {
  workspaceId: string;
}

interface Membership {
  id: string;
  user_id: string;
  base_working_hours: number;
  weekly_capacity_hours: number;
  display_name: string;
}

interface Bucket {
  start: string; // ISO Monday
  label: string;
}

function isoMonday(d: Date): string {
  const x = new Date(d);
  const day = x.getUTCDay();
  const diff = (day === 0 ? -6 : 1 - day);
  x.setUTCDate(x.getUTCDate() + diff);
  return x.toISOString().slice(0, 10);
}
function addDays(iso: string, n: number): string {
  const d = new Date(iso); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}
function buildWeekBuckets(weeks: number): Bucket[] {
  const start = isoMonday(new Date());
  const out: Bucket[] = [];
  for (let i = 0; i < weeks; i++) {
    const s = addDays(start, i * 7);
    const m = new Date(s);
    out.push({ start: s, label: `${m.getUTCMonth() + 1}/${m.getUTCDate()}` });
  }
  return out;
}
function overlapDays(aStart: string, aEnd: string | null, bStart: string, bEnd: string): number {
  const s = aStart > bStart ? aStart : bStart;
  const e = (aEnd ?? '9999-12-31') < bEnd ? (aEnd ?? '9999-12-31') : bEnd;
  if (s > e) return 0;
  const ms = new Date(e).getTime() - new Date(s).getTime();
  return Math.round(ms / 86_400_000) + 1;
}
function workdaysBetween(startISO: string, endISO: string): number {
  let n = 0;
  const e = new Date(endISO).getTime();
  for (let t = new Date(startISO).getTime(); t <= e; t += 86_400_000) {
    const d = new Date(t).getUTCDay();
    if (d !== 0 && d !== 6) n++;
  }
  return n;
}

export function UtilizationHeatmap({ workspaceId }: Props) {
  const { t } = useI18n();
  const [weeks, setWeeks] = useState(12);
  const [includeTentative, setIncludeTentative] = useState(false);
  const [includeLeaves, setIncludeLeaves] = useState(true);
  const [groupBy, setGroupBy] = useState<'member' | 'role' | 'team'>('member');
  const [loading, setLoading] = useState(true);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [allocs, setAllocs] = useState<any[]>([]);
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [teamRoles, setTeamRoles] = useState<{ team_id: string; business_role: string }[]>([]);

  const buckets = useMemo(() => buildWeekBuckets(weeks), [weeks]);
  const windowEnd = useMemo(() => addDays(buckets[buckets.length - 1].start, 6), [buckets]);
  const windowStart = useMemo(() => buckets[0].start, [buckets]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [memRes, asgRes, lvRes, alRes, tmRes, trRes] = await Promise.all([
        (supabase as any).from('enterprise_memberships').select('id, user_id, base_working_hours, weekly_capacity_hours').eq('workspace_id', workspaceId).eq('status', 'active'),
        supabase.from('enterprise_project_assignments').select('membership_id, business_role, allocated_percentage, start_date, end_date, is_tentative, billable').eq('workspace_id', workspaceId).lte('start_date', windowEnd).or(`end_date.is.null,end_date.gte.${windowStart}`),
        supabase.from('leave_requests').select('user_id, start_date, end_date, is_half_day, status').eq('workspace_id', workspaceId).eq('status', 'approved').lte('start_date', windowEnd).gte('end_date', windowStart),
        (supabase as any).from('enterprise_member_role_allocations').select('membership_id, business_role, percentage').eq('workspace_id', workspaceId),
        (supabase as any).from('enterprise_teams').select('id, name').eq('workspace_id', workspaceId),
        (supabase as any).from('enterprise_team_roles').select('team_id, business_role').eq('workspace_id', workspaceId),
      ]);
      if (cancelled) return;
      const mems = (memRes.data as any[]) || [];
      const userIds = mems.map(m => m.user_id);
      const { data: profs } = userIds.length ? await supabase.from('profiles').select('user_id, display_name').in('user_id', userIds) : { data: [] };
      const nameByUser = new Map((profs as any[] || []).map(p => [p.user_id, p.display_name || 'Ismeretlen']));
      setMemberships(mems.map(m => ({
        id: m.id,
        user_id: m.user_id,
        base_working_hours: Number(m.base_working_hours ?? 8),
        weekly_capacity_hours: Number(m.weekly_capacity_hours ?? 40),
        display_name: nameByUser.get(m.user_id) || 'Ismeretlen',
      })));
      setAssignments((asgRes.data as any[]) || []);
      setLeaves((lvRes.data as any[]) || []);
      setAllocs((alRes.data as any[]) || []);
      setTeams((tmRes.data as any[]) || []);
      setTeamRoles((trRes.data as any[]) || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [workspaceId, windowStart, windowEnd]);

  // Compute utilization (%) per row × per week
  type Row = { key: string; label: string; capacityWeek: number; cells: { used: number; pct: number; tentative: number }[] };

  const rows = useMemo<Row[]>(() => {
    if (groupBy === 'member') {
      return memberships.map(m => {
        const cap = m.weekly_capacity_hours; // weekly cap in hours
        const cells = buckets.map(b => {
          const wkEnd = addDays(b.start, 6);
          const workDays = workdaysBetween(b.start, wkEnd) || 5;
          let usedHours = 0;
          let tentativeHours = 0;
          for (const a of assignments) {
            if (a.membership_id !== m.id) continue;
            if (!includeTentative && a.is_tentative) continue;
            const days = overlapDays(a.start_date, a.end_date, b.start, wkEnd);
            if (days <= 0) continue;
            const dailyHours = m.base_working_hours * (Number(a.allocated_percentage) / 100);
            const hrs = dailyHours * Math.min(days, workDays);
            if (a.is_tentative) tentativeHours += hrs;
            else usedHours += hrs;
          }
          if (includeLeaves) {
            for (const lr of leaves) {
              if (lr.user_id !== m.user_id) continue;
              const days = overlapDays(lr.start_date, lr.end_date, b.start, wkEnd);
              if (days <= 0) continue;
              // Approved leave consumes the member's available capacity equally
              const lostDays = lr.is_half_day ? days * 0.5 : days;
              usedHours += m.base_working_hours * Math.min(lostDays, workDays);
            }
          }
          const totalHrs = usedHours + (includeTentative ? tentativeHours : 0);
          const pct = cap > 0 ? (totalHrs / cap) * 100 : 0;
          return { used: +totalHrs.toFixed(1), pct: +pct.toFixed(0), tentative: +tentativeHours.toFixed(1) };
        });
        return { key: m.id, label: m.display_name, capacityWeek: cap, cells };
      });
    }

    if (groupBy === 'role') {
      const roleSet = new Set<string>();
      allocs.forEach(a => roleSet.add(a.business_role));
      const result: Row[] = [];
      for (const role of Array.from(roleSet).sort()) {
        const memberIds = allocs.filter(a => a.business_role === role).map(a => a.membership_id);
        const memList = memberships.filter(m => memberIds.includes(m.id));
        const capWeek = memList.reduce((s, m) => {
          const a = allocs.find(x => x.membership_id === m.id && x.business_role === role);
          return s + (a ? m.weekly_capacity_hours * (Number(a.percentage) / 100) : 0);
        }, 0);
        const cells = buckets.map(b => {
          const wkEnd = addDays(b.start, 6);
          const workDays = workdaysBetween(b.start, wkEnd) || 5;
          let used = 0;
          let tentative = 0;
          for (const m of memList) {
            for (const a of assignments) {
              if (a.membership_id !== m.id) continue;
              if (a.business_role !== role) continue;
              if (!includeTentative && a.is_tentative) continue;
              const days = overlapDays(a.start_date, a.end_date, b.start, wkEnd);
              if (days <= 0) continue;
              const dailyHours = m.base_working_hours * (Number(a.allocated_percentage) / 100);
              const hrs = dailyHours * Math.min(days, workDays);
              if (a.is_tentative) tentative += hrs;
              else used += hrs;
            }
          }
          const total = used + (includeTentative ? tentative : 0);
          const pct = capWeek > 0 ? (total / capWeek) * 100 : 0;
          return { used: +total.toFixed(1), pct: +pct.toFixed(0), tentative: +tentative.toFixed(1) };
        });
        result.push({ key: role, label: role, capacityWeek: capWeek, cells });
      }
      return result;
    }

    // team
    const rolesByTeam = new Map<string, string[]>();
    teamRoles.forEach(tr => {
      const arr = rolesByTeam.get(tr.team_id) || [];
      arr.push(tr.business_role);
      rolesByTeam.set(tr.team_id, arr);
    });
    return teams.map(t => {
      const teamRoleList = rolesByTeam.get(t.id) || [];
      const memberIds = allocs.filter(a => teamRoleList.includes(a.business_role)).map(a => a.membership_id);
      const uniqMems = Array.from(new Set(memberIds));
      const memList = memberships.filter(m => uniqMems.includes(m.id));
      const capWeek = memList.reduce((s, m) => s + m.weekly_capacity_hours, 0);
      const cells = buckets.map(b => {
        const wkEnd = addDays(b.start, 6);
        const workDays = workdaysBetween(b.start, wkEnd) || 5;
        let used = 0;
        let tentative = 0;
        for (const m of memList) {
          for (const a of assignments) {
            if (a.membership_id !== m.id) continue;
            if (!teamRoleList.includes(a.business_role)) continue;
            if (!includeTentative && a.is_tentative) continue;
            const days = overlapDays(a.start_date, a.end_date, b.start, wkEnd);
            if (days <= 0) continue;
            const dailyHours = m.base_working_hours * (Number(a.allocated_percentage) / 100);
            const hrs = dailyHours * Math.min(days, workDays);
            if (a.is_tentative) tentative += hrs;
            else used += hrs;
          }
        }
        const total = used + (includeTentative ? tentative : 0);
        const pct = capWeek > 0 ? (total / capWeek) * 100 : 0;
        return { used: +total.toFixed(1), pct: +pct.toFixed(0), tentative: +tentative.toFixed(1) };
      });
      return { key: t.id, label: t.name, capacityWeek: capWeek, cells };
    });
  }, [groupBy, memberships, assignments, leaves, allocs, teams, teamRoles, buckets, includeTentative, includeLeaves]);

  const overloadedCount = useMemo(() => rows.reduce((n, r) => n + r.cells.filter(c => c.pct > 100).length, 0), [rows]);

  return (
    <Card>
      <CardHeader className="py-3 px-4 flex-row items-center justify-between space-y-0 flex-wrap gap-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" /> {t('util_heatmap.card_title')}
          {overloadedCount > 0 && (
            <Badge variant="destructive" className="text-[10px] gap-1 ml-2">
              <AlertTriangle className="h-3 w-3" /> {t('util_heatmap.overloaded_count', { count: overloadedCount })}
            </Badge>
          )}
        </CardTitle>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <Label className="text-[11px]">Hetek</Label>
            <Input type="number" min={4} max={26} value={weeks} onChange={e => setWeeks(Math.max(4, Math.min(26, parseInt(e.target.value) || 12)))} className="h-7 w-16 text-xs" />
          </div>
          <Select value={groupBy} onValueChange={v => setGroupBy(v as any)}>
            <SelectTrigger className="h-7 w-[120px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="member">{t('util_heatmap.by_member')}</SelectItem>
              <SelectItem value="role">{t('util_heatmap.by_role')}</SelectItem>
              <SelectItem value="team">{t('util_heatmap.by_team')}</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1">
            <Switch id="ht-tent" checked={includeTentative} onCheckedChange={setIncludeTentative} />
            <Label htmlFor="ht-tent" className="text-[11px] cursor-pointer">Tentative</Label>
          </div>
          <div className="flex items-center gap-1">
            <Switch id="ht-lv" checked={includeLeaves} onCheckedChange={setIncludeLeaves} />
            <Label htmlFor="ht-lv" className="text-[11px] cursor-pointer">{t('util_heatmap.leave_label')}</Label>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {loading ? (
          <div className="flex justify-center py-6"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
        ) : rows.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">{t('util_heatmap.no_data')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="text-left font-medium px-2 py-1 bg-muted/30 sticky left-0 z-10 min-w-[160px]">{groupBy === 'member' ? t('util_heatmap.col_member') : groupBy === 'role' ? t('util_heatmap.col_role') : t('util_heatmap.col_team')}</th>
                  {buckets.map(b => (
                    <th key={b.start} className="text-center font-medium px-1 py-1 bg-muted/30 min-w-[44px]">{b.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.key}>
                    <td className="px-2 py-1 sticky left-0 bg-background z-10 border-t">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate">{row.label}</span>
                        <span className="text-[10px] text-muted-foreground">{row.capacityWeek.toFixed(0)}h/h</span>
                      </div>
                    </td>
                    {row.cells.map((c, i) => (
                      <td key={i} className="px-1 py-1 border-t text-center" title={`${c.used}h / ${row.capacityWeek}h (${c.pct}%)${c.tentative ? ` · tentative: ${c.tentative}h` : ''}`}>
                        <div
                          className="h-7 rounded flex items-center justify-center font-medium"
                          style={{ background: heatColor(c.pct), color: c.pct > 60 ? '#fff' : 'hsl(var(--foreground))' }}
                        >
                          {c.pct}%
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center gap-3 mt-3 text-[10px] text-muted-foreground flex-wrap">
              <LegendSwatch color={heatColor(0)} label={t('util_heatmap.legend_empty')} />
              <LegendSwatch color={heatColor(40)} label="40%" />
              <LegendSwatch color={heatColor(75)} label={t('util_heatmap.legend_healthy')} />
              <LegendSwatch color={heatColor(95)} label={t('util_heatmap.legend_saturated')} />
              <LegendSwatch color={heatColor(120)} label={t('util_heatmap.legend_overloaded')} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function heatColor(pct: number): string {
  // 0% = neutral, 75% = green, 95% = amber, >100% = red
  if (pct <= 1) return 'hsl(var(--muted))';
  if (pct < 50) return `hsl(160 60% ${88 - pct * 0.3}%)`;
  if (pct < 85) return `hsl(150 65% ${70 - (pct - 50) * 0.4}%)`;
  if (pct <= 100) return `hsl(38 90% ${65 - (pct - 85) * 0.5}%)`;
  return `hsl(0 75% ${Math.max(40, 60 - (pct - 100) * 0.3)}%)`;
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-block h-3 w-4 rounded" style={{ background: color }} />
      {label}
    </span>
  );
}
