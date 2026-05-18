import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  addDays, addWeeks, eachDayOfInterval, endOfWeek, format, isWeekend, startOfWeek, subWeeks,
} from 'date-fns';
import { cn } from '@/lib/utils';

interface Office { id: string; name: string; city: string | null }
interface CoverageRule {
  id: string; office_id: string;
  business_role: string | null; business_roles: string[] | null;
  skill_id: string | null; skill_ids: string[] | null;
  min_headcount: number;
  days_of_week: number[] | null; rule_date: string | null;
  valid_from: string | null; valid_until: string | null;
  name: string | null;
}
interface Shift {
  id: string; user_id: string; office_id: string;
  business_role: string | null; skill_id: string | null; shift_date: string;
}
interface LeaveRequest { user_id: string; start_date: string; end_date: string; status: string }

interface EmbedData {
  workspace_id: string;
  offices: Office[];
  coverage_rules: CoverageRule[];
  shift_assignments: Shift[];
  holidays: string[];
  blocked_dates: string[];
  leave_requests: LeaveRequest[];
}

function ruleRoles(r: CoverageRule): string[] {
  if (r.business_roles && r.business_roles.length > 0) return r.business_roles;
  if (r.business_role) return [r.business_role];
  return [];
}
function ruleSkillIds(r: CoverageRule): string[] {
  if (r.skill_ids && r.skill_ids.length > 0) return r.skill_ids;
  if (r.skill_id) return [r.skill_id];
  return [];
}

function supplyFor(rule: CoverageRule, isoDate: string, shifts: Shift[]): number {
  const roles = ruleRoles(rule);
  const skillIds = ruleSkillIds(rule);
  return shifts.filter(s => {
    if (s.office_id !== rule.office_id || s.shift_date !== isoDate) return false;
    const roleMatch = roles.length === 0 || (s.business_role != null && roles.includes(s.business_role));
    const skillMatch = skillIds.length === 0 || (s.skill_id != null && skillIds.includes(s.skill_id));
    if (roles.length > 0 && skillIds.length > 0) return roleMatch || skillMatch;
    if (roles.length > 0) return roleMatch;
    if (skillIds.length > 0) return skillMatch;
    return true;
  }).length;
}

function ruleAppliesOn(r: CoverageRule, isoDate: string, dow: number): boolean {
  if (r.rule_date) return r.rule_date === isoDate;
  if (r.valid_from && isoDate < r.valid_from) return false;
  if (r.valid_until && isoDate > r.valid_until) return false;
  if (r.days_of_week && r.days_of_week.length > 0 && !r.days_of_week.includes(dow)) return false;
  return true;
}

interface Props {
  token: string;
}

export function EmbedCapacityView({ token }: Props) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [data, setData] = useState<EmbedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const days = useMemo(() =>
    eachDayOfInterval({ start: weekStart, end: endOfWeek(weekStart, { weekStartsOn: 1 }) }),
    [weekStart],
  );

  const from = format(days[0], 'yyyy-MM-dd');
  const to   = format(days[days.length - 1], 'yyyy-MM-dd');

  useEffect(() => {
    setLoading(true);
    setError(null);
    (supabase as any)
      .rpc('get_embed_capacity_planner_data', { _token: token, _from_date: from, _to_date: to })
      .then(({ data: result, error: err }: { data: EmbedData | null; error: { message: string } | null }) => {
        if (err) { setError(err.message); setLoading(false); return; }
        setData(result);
        setLoading(false);
      });
  }, [token, from, to]);

  const holidaySet = useMemo(() => new Set(data?.holidays ?? []), [data]);
  const blockedSet = useMemo(() => new Set(data?.blocked_dates ?? []), [data]);

  const rulesByOffice = useMemo(() => {
    const map = new Map<string, CoverageRule[]>();
    (data?.offices ?? []).forEach(o => map.set(o.id, []));
    (data?.coverage_rules ?? []).forEach(r => {
      const arr = map.get(r.office_id) ?? [];
      arr.push(r);
      map.set(r.office_id, arr);
    });
    return map;
  }, [data]);

  const ruleLabel = (r: CoverageRule) => {
    if (r.name) return r.name;
    const roles = ruleRoles(r);
    return roles.length > 0 ? roles.join(', ') : `≥${r.min_headcount}`;
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-full min-h-48 text-sm text-destructive p-6 text-center">
        <div>
          <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-60" />
          <p className="font-medium">Embed token error</p>
          <p className="text-xs text-muted-foreground mt-1">{error}</p>
        </div>
      </div>
    );
  }

  const offices = data?.offices ?? [];
  const shifts  = data?.shift_assignments ?? [];

  return (
    <div className="flex flex-col h-full bg-background text-foreground text-sm">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b shrink-0">
        <Button size="icon" variant="ghost" className="h-7 w-7"
          onClick={() => setWeekStart(w => subWeeks(w, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="font-medium text-xs">
          {format(days[0], 'MMM d')} – {format(days[days.length - 1], 'MMM d, yyyy')}
        </span>
        <Button size="icon" variant="ghost" className="h-7 w-7"
          onClick={() => setWeekStart(w => addWeeks(w, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Badge variant="outline" className="ml-auto text-[10px]">
          Effectime Embed
        </Badge>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : offices.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-xs text-muted-foreground">
            No offices configured
          </div>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-background text-left px-2 py-1.5 font-medium border-b border-r w-36">
                  Office / Rule
                </th>
                {days.map(d => {
                  const iso = format(d, 'yyyy-MM-dd');
                  const isHol = holidaySet.has(iso);
                  const isBlk = blockedSet.has(iso);
                  const isWknd = isWeekend(d);
                  return (
                    <th key={iso}
                      className={cn(
                        'text-center px-1 py-1.5 font-medium border-b min-w-[52px]',
                        (isHol || isBlk) && 'bg-rose-50 dark:bg-rose-950/20',
                        isWknd && !isHol && !isBlk && 'bg-muted/40',
                      )}>
                      <div>{format(d, 'EEE')}</div>
                      <div className="text-muted-foreground font-normal">{format(d, 'd')}</div>
                      {(isHol || isBlk) && (
                        <div className="text-[9px] text-rose-500">{isHol ? '🎉' : '🔒'}</div>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {offices.map(office => {
                const officeRules = (rulesByOffice.get(office.id) ?? []);
                const hasRules = officeRules.length > 0;

                return [
                  // Office row header
                  <tr key={`hdr-${office.id}`}>
                    <td colSpan={days.length + 1}
                      className="sticky left-0 bg-muted/50 px-2 py-1 font-semibold border-b text-[11px] uppercase tracking-wide text-muted-foreground">
                      {office.name}{office.city ? ` · ${office.city}` : ''}
                    </td>
                  </tr>,

                  // Rule rows
                  ...(hasRules ? officeRules.map(rule => (
                    <tr key={rule.id} className="border-b hover:bg-muted/20">
                      <td className="sticky left-0 bg-background px-2 py-1 border-r text-[11px] text-muted-foreground leading-snug max-w-[9rem] truncate"
                        title={ruleLabel(rule)}>
                        {ruleLabel(rule)}
                        <div className="text-[10px] opacity-60">≥{rule.min_headcount}</div>
                      </td>
                      {days.map(d => {
                        const iso = format(d, 'yyyy-MM-dd');
                        const dow = d.getDay();
                        const applies = ruleAppliesOn(rule, iso, dow);
                        if (!applies) {
                          return <td key={iso} className="bg-muted/20" />;
                        }
                        const have = supplyFor(rule, iso, shifts);
                        const need = rule.min_headcount;
                        const tone = have < need
                          ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400'
                          : have === need
                            ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400'
                            : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400';
                        return (
                          <td key={iso}
                            className={cn('text-center px-1 py-1', tone)}>
                            <div className="flex items-center justify-center gap-0.5 font-medium">
                              {have < need
                                ? <AlertTriangle className="h-3 w-3 shrink-0" />
                                : <CheckCircle2 className="h-3 w-3 shrink-0" />}
                              <span>{need}/{have}</span>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  )) : [
                    <tr key={`empty-${office.id}`} className="border-b">
                      <td className="sticky left-0 bg-background px-2 py-1 border-r text-[11px] text-muted-foreground italic">
                        No rules
                      </td>
                      {days.map(d => <td key={format(d, 'yyyy-MM-dd')} />)}
                    </tr>,
                  ]),
                ];
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
