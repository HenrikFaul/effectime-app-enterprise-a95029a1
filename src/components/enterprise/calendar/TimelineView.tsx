import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, AlertCircle } from 'lucide-react';
import { addMonths, eachDayOfInterval, endOfMonth, format, isWeekend, startOfMonth, subMonths, isSameDay, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { CalendarFilterBar, EMPTY_FILTERS, FilterValues } from './CalendarFilterBar';
import { useCalendarFilterConfig } from '@/hooks/useCalendarFilterConfig';
import type { FilterOption } from './CalendarFilterBar';
import type { CalendarFilterId } from '@/hooks/useCalendarFilterConfig';
import { useI18n, useDateLocale } from '@/i18n/I18nProvider';

interface Props {
  workspaceId: string;
  onFilteredUsersChange?: (userIds: string[], range: { from: Date; to: Date }) => void;
}

interface MemberRow {
  id: string;
  user_id: string;
  display_name: string;
  team: string | null;
  business_role: string | null;
  office_id: string | null;
  city: string | null;
  skill_ids: string[];
}

interface LeaveCell {
  user_id: string;
  start_date: string;
  end_date: string;
  leave_type: string;
  status: string;
}

interface Holiday { holiday_date: string; name: string; }

const ROW_HEIGHT = 44;
const CELL_W = 32;
const NAME_W = 200;

const STATUS_COLOR: Record<string, string> = {
  approved: 'bg-emerald-500',
  pending: 'bg-amber-500',
  rejected: 'bg-rose-500',
  cancelled: 'bg-zinc-400',
};

const LEAVE_TYPE_TINT: Record<string, string> = {
  vacation: 'bg-emerald-200/70 dark:bg-emerald-900/40',
  sick_leave: 'bg-rose-200/70 dark:bg-rose-900/40',
  unpaid_leave: 'bg-amber-200/70 dark:bg-amber-900/40',
  other: 'bg-violet-200/70 dark:bg-violet-900/40',
};

export function TimelineView({ workspaceId, onFilteredUsersChange }: Props) {
  const { t } = useI18n();
  const dateFnsLocale = useDateLocale();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [leaves, setLeaves] = useState<LeaveCell[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [offices, setOffices] = useState<{ id: string; name: string }[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<{ id: string; name: string; color: string }[]>([]);
  const [skills, setSkills] = useState<{ id: string; name: string }[]>([]);
  const [filters, setFilters] = useState<FilterValues>(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Race condition prevention: each load call gets an ID; stale responses are dropped
  const loadIdRef = useRef(0);
  // Debounce timer: prevents overlapping requests when navigating months rapidly
  const loadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { config } = useCalendarFilterConfig(workspaceId);

  const days = useMemo(() => eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) }), [month]);

  const load = useCallback(async () => {
    const loadId = ++loadIdRef.current;
    setLoading(true);
    setLoadError(null);
    const from = format(startOfMonth(month), 'yyyy-MM-dd');
    const to = format(endOfMonth(month), 'yyyy-MM-dd');

    try {
      // Promise.allSettled keeps going even if one query throws (e.g. transient network hiccup).
      // Only the membership query is critical; the rest degrade gracefully to empty arrays.
      const toRes = (r: PromiseSettledResult<any>) =>
        r.status === 'fulfilled' ? r.value : { data: null, error: { message: String((r as PromiseRejectedResult).reason) } };

      const settled = await Promise.allSettled([
        (supabase as any).from('enterprise_memberships')
          .select('id,user_id,team,business_role,office_id,city')
          .eq('workspace_id', workspaceId)
          .eq('status', 'active'),
        (supabase as any).from('leave_requests')
          .select('user_id,start_date,end_date,leave_type,status')
          .eq('workspace_id', workspaceId)
          .lte('start_date', to)
          .gte('end_date', from),
        (supabase as any).from('enterprise_holidays')
          .select('holiday_date,name')
          .eq('workspace_id', workspaceId)
          .gte('holiday_date', from)
          .lte('holiday_date', to),
        (supabase as any).from('enterprise_offices').select('id,name').eq('workspace_id', workspaceId),
        (supabase as any).from('enterprise_leave_types').select('id,name,color').eq('workspace_id', workspaceId).eq('is_active', true),
        (supabase as any).from('enterprise_skills').select('id,name').eq('workspace_id', workspaceId).order('name'),
        (supabase as any).from('enterprise_member_skills').select('membership_id,skill_id').eq('workspace_id', workspaceId),
      ]);
      const [memRes, leaveRes, holRes, officeRes, ltRes, skillRes, memberSkillRes] = settled.map(toRes);

      // Drop stale response if a newer load has been initiated
      if (loadId !== loadIdRef.current) return;

      if (memRes.error) throw new Error(memRes.error.message);

      const memRows = (memRes.data || []) as any[];
      const userIds = memRows.map(m => m.user_id);
      let nameMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profs } = await (supabase as any)
          .from('profiles').select('user_id,display_name').in('user_id', userIds);
        if (loadId !== loadIdRef.current) return;
        (profs || []).forEach((p: any) => { nameMap[p.user_id] = p.display_name || t('timeline_view.user_fallback'); });
      }

      // Build skill map: membership_id -> skill_ids[]
      const skillsByMembership = new Map<string, string[]>();
      ((memberSkillRes.data || []) as any[]).forEach((s: any) => {
        const arr = skillsByMembership.get(s.membership_id) || [];
        arr.push(s.skill_id);
        skillsByMembership.set(s.membership_id, arr);
      });

      setMembers(memRows.map(m => ({
        id: m.id,
        user_id: m.user_id,
        team: m.team,
        business_role: m.business_role,
        office_id: m.office_id,
        city: m.city || null,
        skill_ids: skillsByMembership.get(m.id) || [],
        display_name: nameMap[m.user_id] || t('timeline_view.user_fallback'),
      })));
      setLeaves((leaveRes.data || []) as LeaveCell[]);
      setHolidays((holRes.data || []) as Holiday[]);
      setOffices((officeRes.data || []) as any[]);
      setLeaveTypes((ltRes.data || []) as any[]);
      setSkills((skillRes.data || []) as any[]);
    } catch (err: any) {
      if (loadId !== loadIdRef.current) return;
      setLoadError(err?.message || t('timeline_view.load_error'));
    } finally {
      if (loadId === loadIdRef.current) setLoading(false);
    }
  }, [workspaceId, month]);

  // Debounce the load: rapid month-navigation clicks only trigger one fetch
  // after the user stops clicking (prevents parallel Promise.allSettled storms).
  useEffect(() => {
    if (loadTimerRef.current) clearTimeout(loadTimerRef.current);
    loadTimerRef.current = setTimeout(load, 250);
    return () => { if (loadTimerRef.current) clearTimeout(loadTimerRef.current); };
  }, [load]);

  // Filter options
  const filterOptions = useMemo<Record<CalendarFilterId, FilterOption[]>>(() => {
    const teams = Array.from(new Set(members.map(m => m.team).filter(Boolean))) as string[];
    const roles = Array.from(new Set(members.map(m => m.business_role).filter(Boolean))) as string[];
    const cities = Array.from(new Set(members.map(m => m.city).filter(Boolean))) as string[];
    return {
      office: offices.map(o => ({ value: o.id, label: o.name })),
      team: teams.map(t => ({ value: t, label: t })),
      business_role: roles.map(r => ({ value: r, label: r })),
      // leave_requests.leave_type is the public.leave_type ENUM — the filter options MUST be
      // those enum keys (not enterprise_leave_types UUIDs), or no leave ever matches the filter.
      leave_type: [
        { value: 'vacation', label: t('timeline_view.legend_vacation') },
        { value: 'sick_leave', label: t('timeline_view.legend_sick') },
        { value: 'unpaid_leave', label: t('timeline_view.legend_unpaid') },
        { value: 'other', label: t('timeline_view.legend_other') },
      ],
      status: [
        { value: 'approved', label: t('timeline_view.status_approved') },
        { value: 'pending', label: t('timeline_view.status_pending') },
        { value: 'rejected', label: t('timeline_view.status_rejected') },
        { value: 'cancelled', label: t('timeline_view.status_cancelled') },
      ],
      skill: skills.map(s => ({ value: s.id, label: s.name })),
      location: cities.map(c => ({ value: c, label: c })),
      site_priority: [
        { value: '1', label: t('timeline_view.priority_primary') },
        { value: '2', label: t('timeline_view.priority_secondary') },
        { value: '3', label: t('timeline_view.priority_reserve') },
      ],
      utilization: [
        { value: 'under', label: t('timeline_view.util_under') },
        { value: 'optimal', label: t('timeline_view.util_optimal') },
        { value: 'over', label: t('timeline_view.util_over') },
      ],
      assignment_state: [
        { value: 'unassigned', label: t('timeline_view.assign_unassigned') },
        { value: 'assigned', label: t('timeline_view.assign_assigned') },
        { value: 'on_leave', label: t('timeline_view.worktime_on_leave') },
      ],
      capacity_band: [
        { value: 'full', label: t('timeline_view.worktime_full') },
        { value: 'part', label: t('timeline_view.worktime_part') },
        { value: 'extra', label: t('timeline_view.worktime_extra') },
      ],
    };
  }, [members, offices, leaveTypes, skills, t]);

  // Apply filters
  const visibleMembers = useMemo(() => {
    return members.filter(m => {
      if (filters.office.length > 0 && (!m.office_id || !filters.office.includes(m.office_id))) return false;
      if (filters.team.length > 0 && (!m.team || !filters.team.includes(m.team))) return false;
      if (filters.business_role.length > 0 && (!m.business_role || !filters.business_role.includes(m.business_role))) return false;
      if (filters.skill.length > 0 && !filters.skill.some(s => m.skill_ids.includes(s))) return false;
      if (filters.location.length > 0 && (!m.city || !filters.location.includes(m.city))) return false;
      return true;
    });
  }, [members, filters]);

  // Keep a stable ref to the callback so the notify-parent effect never needs to
  // list it as a dependency — listing an unstable inline function would create an
  // infinite re-render loop (parent re-renders → new fn ref → effect re-fires → …).
  const onFilteredUsersChangeRef = useRef(onFilteredUsersChange);
  useEffect(() => { onFilteredUsersChangeRef.current = onFilteredUsersChange; });

  // Notify parent whenever the visible set or month changes, but only after data loaded.
  useEffect(() => {
    if (loading || members.length === 0) return;
    onFilteredUsersChangeRef.current?.(
      visibleMembers.map(m => m.user_id),
      { from: startOfMonth(month), to: endOfMonth(month) },
    );
  }, [visibleMembers, month, loading, members.length]);

  // Build per-user day status map
  const leavesByUser = useMemo(() => {
    const map = new Map<string, LeaveCell[]>();
    leaves.forEach(l => {
      if (filters.status.length > 0 && !filters.status.includes(l.status)) return;
      // Filter values are the leave_type enum keys, matching l.leave_type directly.
      if (filters.leave_type.length > 0 && !filters.leave_type.includes(l.leave_type)) return;
      if (!map.has(l.user_id)) map.set(l.user_id, []);
      map.get(l.user_id)!.push(l);
    });
    return map;
  }, [leaves, filters, leaveTypes]);

  const holidaySet = useMemo(() => new Set(holidays.map(h => h.holiday_date)), [holidays]);

  const cellStatus = (userId: string, day: Date): { kind: 'leave' | 'holiday' | 'weekend' | 'work'; leave?: LeaveCell } => {
    const dStr = format(day, 'yyyy-MM-dd');
    if (holidaySet.has(dStr)) return { kind: 'holiday' };
    const userLeaves = leavesByUser.get(userId) || [];
    for (const l of userLeaves) {
      if (dStr >= l.start_date && dStr <= l.end_date) return { kind: 'leave', leave: l };
    }
    if (isWeekend(day)) return { kind: 'weekend' };
    return { kind: 'work' };
  };

  // Virtualizer
  const scrollRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: visibleMembers.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[290px_minmax(0,1fr)] gap-3 items-start">
      {/* Left filter sidebar */}
      <aside className="min-w-0 lg:sticky lg:top-24">
        <CalendarFilterBar
          config={config}
          values={filters}
          options={filterOptions}
          onChange={setFilters}
        />
      </aside>

      <div className="min-w-0 space-y-3">
        {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMonth(m => subMonths(m, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="font-semibold capitalize min-w-[140px] text-center">
            {format(month, 'yyyy. MMMM', { locale: dateFnsLocale })}
          </div>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMonth(m => addMonths(m, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8" onClick={() => setMonth(startOfMonth(new Date()))}>
            <CalendarIcon className="h-3.5 w-3.5 mr-1" /> Ma
          </Button>
        </div>
        <Badge variant="outline" className="text-xs">
          {visibleMembers.length} / {members.length} tag
        </Badge>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <LegendItem className="bg-emerald-200/70 dark:bg-emerald-900/40" label={t('timeline_view.legend_vacation')} />
        <LegendItem className="bg-rose-200/70 dark:bg-rose-900/40" label={t('timeline_view.legend_sick')} />
        <LegendItem className="bg-amber-200/70 dark:bg-amber-900/40" label={t('timeline_view.legend_unpaid')} />
        <LegendItem className="bg-blue-100 dark:bg-blue-950/40 ring-1 ring-blue-300" label={t('timeline_view.legend_holiday')} />
        <LegendItem className="bg-zinc-100 dark:bg-zinc-800/60" label={t('timeline_view.legend_weekend')} />
      </div>

      {/* Grid */}
      <div className="border rounded-lg overflow-hidden bg-card">
        {loading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : loadError ? (
          <div className="p-8 text-center text-sm text-destructive flex flex-col items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            <span>{t('timeline_view.load_error_msg', { msg: loadError })}</span>
            <Button size="sm" variant="outline" onClick={load}>{t('timeline_view.retry_btn')}</Button>
          </div>
        ) : members.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            {t('timeline_view.no_active_members')}
          </div>
        ) : visibleMembers.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            {t('timeline_view.no_matching_members')}
          </div>
        ) : (
          <div className="overflow-auto" style={{ maxHeight: 600 }}>
            {/* Header row */}
            <div className="flex sticky top-0 z-20 bg-card border-b" style={{ minWidth: NAME_W + days.length * CELL_W }}>
              <div className="sticky left-0 z-30 bg-card border-r" style={{ width: NAME_W, minWidth: NAME_W }}>
                <div className="px-3 py-2 text-xs font-semibold text-muted-foreground">Tag</div>
              </div>
              {days.map(d => {
                const isHol = holidaySet.has(format(d, 'yyyy-MM-dd'));
                const isWk = isWeekend(d);
                return (
                  <div
                    key={d.toISOString()}
                    className={cn(
                      'flex flex-col items-center justify-center text-[10px] border-r',
                      isHol && 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 font-semibold',
                      !isHol && isWk && 'bg-zinc-50 dark:bg-zinc-900/40 text-muted-foreground',
                    )}
                    style={{ width: CELL_W, minWidth: CELL_W }}
                  >
                    <div className="leading-none">{format(d, 'EEEEE', { locale: dateFnsLocale })}</div>
                    <div className="font-semibold">{format(d, 'd')}</div>
                  </div>
                );
              })}
            </div>

            {/* Virtualized body */}
            <div ref={scrollRef} style={{ minWidth: NAME_W + days.length * CELL_W }}>
              <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
                {rowVirtualizer.getVirtualItems().map(vi => {
                  const m = visibleMembers[vi.index];
                  return (
                    <div
                      key={m.id}
                      className="flex absolute left-0 top-0 w-full border-b hover:bg-accent/30"
                      style={{ height: ROW_HEIGHT, transform: `translateY(${vi.start}px)` }}
                    >
                      <div
                        className="sticky left-0 z-10 bg-card border-r flex flex-col justify-center px-3"
                        style={{ width: NAME_W, minWidth: NAME_W }}
                      >
                        <div className="text-sm font-medium truncate">{m.display_name}</div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {[m.business_role, m.team].filter(Boolean).join(' · ') || '—'}
                        </div>
                      </div>
                      {days.map(d => {
                        const s = cellStatus(m.user_id, d);
                        return (
                          <div
                            key={d.toISOString()}
                            className={cn(
                              'border-r flex items-center justify-center relative',
                              s.kind === 'holiday' && 'bg-blue-50 dark:bg-blue-950/30',
                              s.kind === 'weekend' && 'bg-zinc-50 dark:bg-zinc-900/40',
                              s.kind === 'leave' && (LEAVE_TYPE_TINT[s.leave!.leave_type] || 'bg-violet-200/70'),
                            )}
                            style={{ width: CELL_W, minWidth: CELL_W }}
                            title={s.kind === 'leave' ? `${s.leave!.leave_type} · ${s.leave!.status}` : ''}
                          >
                            {s.kind === 'leave' && (
                              <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_COLOR[s.leave!.status] || 'bg-zinc-400')} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

function LegendItem({ className, label }: { className: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn('h-3 w-3 rounded', className)} />
      <span>{label}</span>
    </div>
  );
}
