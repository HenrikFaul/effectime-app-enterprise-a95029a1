import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  addMonths, addWeeks, eachDayOfInterval, endOfMonth, endOfWeek,
  format, isWeekend, startOfMonth, startOfWeek, subMonths, subWeeks,
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

interface EmbedData {
  workspace_id: string;
  offices: Office[];
  coverage_rules: CoverageRule[];
  shift_assignments: Shift[];
  holidays: string[];
  blocked_dates: string[];
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

export interface EmbedCapacityViewProps {
  token: string;
  mode?: 'weekly' | 'monthly';
  officeFilter?: string;
  initialFrom?: string;
}

export function EmbedCapacityView({ token, mode = 'weekly', officeFilter, initialFrom }: EmbedCapacityViewProps) {
  const [viewMode, setViewMode] = useState<'weekly' | 'monthly'>(mode);

  const [weekStart, setWeekStart] = useState(() => {
    if (initialFrom) {
      const d = new Date(initialFrom);
      return isNaN(d.getTime()) ? startOfWeek(new Date(), { weekStartsOn: 1 }) : startOfWeek(d, { weekStartsOn: 1 });
    }
    return startOfWeek(new Date(), { weekStartsOn: 1 });
  });
  const [monthStart, setMonthStart] = useState(() => {
    if (initialFrom) {
      const d = new Date(initialFrom);
      return isNaN(d.getTime()) ? startOfMonth(new Date()) : startOfMonth(d);
    }
    return startOfMonth(new Date());
  });

  const [data, setData] = useState<EmbedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const days = useMemo(() => {
    if (viewMode === 'monthly') {
      return eachDayOfInterval({ start: monthStart, end: endOfMonth(monthStart) });
    }
    return eachDayOfInterval({ start: weekStart, end: endOfWeek(weekStart, { weekStartsOn: 1 }) });
  }, [viewMode, weekStart, monthStart]);

  const from = format(days[0], 'yyyy-MM-dd');
  const to   = format(days[days.length - 1], 'yyyy-MM-dd');

  useEffect(() => {
    setLoading(true);
    setError(null);
    (supabase as any)
      .rpc('get_embed_view_data', { _token: token, _view: 'capacity_planner', _from_date: from, _to_date: to })
      .then(({ data: result, error: err }: { data: EmbedData | null; error: { message: string } | null }) => {
        if (err) { setError(err.message); setLoading(false); return; }
        setData(result);
        setLoading(false);
      });
  }, [token, from, to]);

  const holidaySet = useMemo(() => new Set(data?.holidays ?? []), [data]);
  const blockedSet = useMemo(() => new Set(data?.blocked_dates ?? []), [data]);

  const offices = useMemo(() => {
    const all = data?.offices ?? [];
    return officeFilter ? all.filter(o => o.id === officeFilter) : all;
  }, [data, officeFilter]);

  const rulesByOffice = useMemo(() => {
    const map = new Map<string, CoverageRule[]>();
    offices.forEach(o => map.set(o.id, []));
    (data?.coverage_rules ?? []).forEach(r => {
      if (!map.has(r.office_id)) return;
      const arr = map.get(r.office_id)!;
      arr.push(r);
      map.set(r.office_id, arr);
    });
    return map;
  }, [data, offices]);

  const shifts = data?.shift_assignments ?? [];

  // For monthly: get worst coverage tone for a day across all offices
  const dayTone = (isoDate: string, dow: number): 'gap' | 'ok' | 'over' | 'none' => {
    let hasGap = false, hasOk = false, hasOver = false, hasAny = false;
    for (const office of offices) {
      const rules = rulesByOffice.get(office.id) ?? [];
      for (const rule of rules) {
        if (!ruleAppliesOn(rule, isoDate, dow)) continue;
        hasAny = true;
        const have = supplyFor(rule, isoDate, shifts);
        const need = rule.min_headcount;
        if (have < need) hasGap = true;
        else if (have === need) hasOk = true;
        else hasOver = true;
      }
    }
    if (!hasAny) return 'none';
    if (hasGap) return 'gap';
    if (hasOk) return 'ok';
    return 'over';
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-full min-h-48 text-sm text-destructive p-6 text-center">
        <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-60" />
        <div className="mt-1">
          <p className="font-medium">Embed token error</p>
          <p className="text-xs text-muted-foreground mt-1">{error}</p>
        </div>
      </div>
    );
  }

  const ruleLabel = (r: CoverageRule) => {
    if (r.name) return r.name;
    const roles = ruleRoles(r);
    return roles.length > 0 ? roles.join(', ') : `≥${r.min_headcount}`;
  };

  // ── Monthly calendar view ────────────────────────────────────────────────
  if (viewMode === 'monthly') {
    const weeks: Date[][] = [];
    let week: Date[] = [];
    for (const d of days) {
      if (week.length === 7) { weeks.push(week); week = []; }
      week.push(d);
    }
    if (week.length > 0) weeks.push(week);

    return (
      <div className="flex flex-col h-full bg-background text-foreground text-xs">
        <Header
          label={format(monthStart, 'MMMM yyyy')}
          onPrev={() => setMonthStart(m => subMonths(m, 1))}
          onNext={() => setMonthStart(m => addMonths(m, 1))}
          viewMode={viewMode}
          onViewMode={setViewMode}
          loading={loading}
        />
        <div className="flex-1 overflow-auto">
          {loading ? <LoadingSkeleton /> : (
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => (
                    <th key={d} className="text-center font-medium px-1 py-1 border-b text-muted-foreground">{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weeks.map((week, wi) => (
                  <tr key={wi}>
                    {Array.from({ length: 7 }).map((_, di) => {
                      const d = week[di];
                      if (!d) return <td key={di} className="border bg-muted/20" />;
                      const iso = format(d, 'yyyy-MM-dd');
                      const dow = d.getDay();
                      const isHol = holidaySet.has(iso);
                      const isBlk = blockedSet.has(iso);
                      const tone = dayTone(iso, dow);
                      const toneCls = isHol || isBlk
                        ? 'bg-rose-50 dark:bg-rose-950/20'
                        : tone === 'gap' ? 'bg-rose-100 dark:bg-rose-950/40'
                        : tone === 'ok'  ? 'bg-emerald-50 dark:bg-emerald-950/20'
                        : tone === 'over' ? 'bg-amber-50 dark:bg-amber-950/20'
                        : 'bg-background';
                      return (
                        <td key={iso}
                          className={cn('border text-center align-top p-1 h-10 w-[calc(100%/7)] min-w-[28px]', toneCls)}>
                          <span className={cn('font-medium text-[11px]',
                            tone === 'gap' && !isHol && !isBlk ? 'text-rose-700 dark:text-rose-400' : '')}>
                            {format(d, 'd')}
                          </span>
                          {(isHol || isBlk) && <div className="text-[9px]">{isHol ? '🎉' : '🔒'}</div>}
                          {!isHol && !isBlk && tone === 'gap' && (
                            <AlertTriangle className="h-2.5 w-2.5 mx-auto text-rose-500 mt-0.5" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  }

  // ── Weekly detailed view ─────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-background text-foreground text-sm">
      <Header
        label={`${format(days[0], 'MMM d')} – ${format(days[days.length - 1], 'MMM d, yyyy')}`}
        onPrev={() => setWeekStart(w => subWeeks(w, 1))}
        onNext={() => setWeekStart(w => addWeeks(w, 1))}
        viewMode={viewMode}
        onViewMode={setViewMode}
        loading={loading}
      />
      <div className="flex-1 overflow-auto">
        {loading ? <LoadingSkeleton /> : offices.length === 0 ? (
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
                  return (
                    <th key={iso}
                      className={cn(
                        'text-center px-1 py-1.5 font-medium border-b min-w-[52px]',
                        (isHol || isBlk) && 'bg-rose-50 dark:bg-rose-950/20',
                        isWeekend(d) && !isHol && !isBlk && 'bg-muted/40',
                      )}>
                      <div>{format(d, 'EEE')}</div>
                      <div className="text-muted-foreground font-normal">{format(d, 'd')}</div>
                      {(isHol || isBlk) && <div className="text-[9px] text-rose-500">{isHol ? '🎉' : '🔒'}</div>}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {offices.map(office => {
                const officeRules = rulesByOffice.get(office.id) ?? [];
                return [
                  <tr key={`hdr-${office.id}`}>
                    <td colSpan={days.length + 1}
                      className="sticky left-0 bg-muted/50 px-2 py-1 font-semibold border-b text-[11px] uppercase tracking-wide text-muted-foreground">
                      {office.name}{office.city ? ` · ${office.city}` : ''}
                    </td>
                  </tr>,
                  ...(officeRules.length > 0 ? officeRules.map(rule => (
                    <tr key={rule.id} className="border-b hover:bg-muted/20">
                      <td className="sticky left-0 bg-background px-2 py-1 border-r text-[11px] text-muted-foreground leading-snug max-w-[9rem] truncate"
                        title={ruleLabel(rule)}>
                        {ruleLabel(rule)}
                        <div className="text-[10px] opacity-60">≥{rule.min_headcount}</div>
                      </td>
                      {days.map(d => {
                        const iso = format(d, 'yyyy-MM-dd');
                        const dow = d.getDay();
                        if (!ruleAppliesOn(rule, iso, dow)) {
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
                          <td key={iso} className={cn('text-center px-1 py-1', tone)}>
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
                      <td className="sticky left-0 bg-background px-2 py-1 border-r text-[11px] text-muted-foreground italic">No rules</td>
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

// ── Shared sub-components ────────────────────────────────────────────────────

function Header({
  label, onPrev, onNext, viewMode, onViewMode, loading,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  viewMode: 'weekly' | 'monthly';
  onViewMode: (v: 'weekly' | 'monthly') => void;
  loading: boolean;
}) {
  return (
    <div className="flex items-center gap-1 px-2 py-1.5 border-b shrink-0 flex-wrap">
      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onPrev}>
        <ChevronLeft className="h-3.5 w-3.5" />
      </Button>
      <span className="font-medium text-xs min-w-[130px] text-center">{label}</span>
      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onNext}>
        <ChevronRight className="h-3.5 w-3.5" />
      </Button>
      <div className="ml-1 flex rounded-md border overflow-hidden text-[10px]">
        <button
          className={cn('px-2 py-0.5 transition-colors',
            viewMode === 'weekly' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
          onClick={() => onViewMode('weekly')}>W</button>
        <button
          className={cn('px-2 py-0.5 transition-colors',
            viewMode === 'monthly' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
          onClick={() => onViewMode('monthly')}>M</button>
      </div>
      {loading && <span className="ml-1 text-[10px] text-muted-foreground animate-pulse">…</span>}
      <Badge variant="outline" className="ml-auto text-[9px] py-0">Effectime</Badge>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-2 p-3">
      {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-9 bg-muted animate-pulse rounded" />)}
    </div>
  );
}
