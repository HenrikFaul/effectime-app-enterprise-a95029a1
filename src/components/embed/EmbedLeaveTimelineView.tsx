/**
 * EmbedLeaveTimelineView — the embed-safe twin of the native calendar (TimelineView).
 *
 * Mirrors the "Naptár" tab: a virtualized month timeline (one row per member, one
 * column per day) with leave-type colour tints + approved/pending status dots,
 * holidays and weekends, AND the same left-hand CalendarFilterBar (telephely / csapat /
 * pozíció / szabadság típusa / státusz / képesség / helyszín). It reuses the native
 * CalendarFilterBar component and the `timeline_view.*` / `calendar_filter.*` i18n keys,
 * so guest pages match effectime.app.
 *
 * Data comes exclusively through the anonymous token RPC `get_embed_view_data`
 * (view = leave_calendar); the guest has no authenticated table access. Read-only.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, AlertCircle } from 'lucide-react';
import { addMonths, eachDayOfInterval, endOfMonth, format, isWeekend, startOfMonth, subMonths } from 'date-fns';
import { cn } from '@/lib/utils';
import { EffectimeLogo } from '@/components/EffectimeLogo';
import { CalendarFilterBar, EMPTY_FILTERS, type FilterValues, type FilterOption } from '@/components/enterprise/calendar/CalendarFilterBar';
import { type CalendarFilterConfig, type CalendarFilterId } from '@/hooks/useCalendarFilterConfig';
import { useI18n, useDateLocale } from '@/i18n/I18nProvider';

interface EmbedMemberRow {
  user_id: string;
  display_name: string;
  business_role: string | null;
  office_id: string | null;
  team?: string | null;
  city?: string | null;
  skills?: { skill_id: string; level: number }[] | null;
}
interface LeaveCell {
  user_id: string;
  start_date: string;
  end_date: string;
  leave_type: string;
  status: string;
}
interface EmbedData {
  offices: { id: string; name: string }[];
  members: EmbedMemberRow[];
  holidays: string[];
  blocked_dates: string[];
  leave_requests: LeaveCell[];
  leave_types: { id: string; name: string; color: string }[];
  skills: { id: string; name: string }[];
}

const ROW_HEIGHT = 44;
const CELL_W = 32;
const NAME_W = 184;

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

// Static config = the 7 filters enabled by default on the native Naptár page.
// (The embed has no tenant_calendar_settings access, so we use the canonical default.)
const EMBED_FILTER_CONFIG: CalendarFilterConfig[] = [
  { id: 'office', enabled: true, order: 1 },
  { id: 'team', enabled: true, order: 2 },
  { id: 'business_role', enabled: true, order: 3 },
  { id: 'leave_type', enabled: true, order: 4 },
  { id: 'status', enabled: true, order: 5 },
  { id: 'skill', enabled: true, order: 6 },
  { id: 'location', enabled: true, order: 7 },
];

export interface EmbedLeaveTimelineViewProps {
  token: string;
  officeFilter?: string;
  initialFrom?: string;
}

export function EmbedLeaveTimelineView({ token, officeFilter, initialFrom }: EmbedLeaveTimelineViewProps) {
  const { t } = useI18n();
  const dateFnsLocale = useDateLocale();

  const [month, setMonth] = useState(() => {
    if (initialFrom) { const d = new Date(initialFrom); if (!isNaN(d.getTime())) return startOfMonth(d); }
    return startOfMonth(new Date());
  });
  const [data, setData] = useState<EmbedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterValues>(EMPTY_FILTERS);
  const loadId = useRef(0);

  const days = useMemo(() => eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) }), [month]);
  const from = format(days[0], 'yyyy-MM-dd');
  const to = format(days[days.length - 1], 'yyyy-MM-dd');

  useEffect(() => {
    const id = ++loadId.current;
    setLoading(true); setError(null);
    (supabase as any)
      .rpc('get_embed_view_data', { _token: token, _view: 'leave_calendar', _from_date: from, _to_date: to })
      .then(({ data: result, error: err }: { data: EmbedData | null; error: { message: string } | null }) => {
        if (id !== loadId.current) return;
        if (err) { setError(err.message); setLoading(false); return; }
        setData(result); setLoading(false);
      });
  }, [token, from, to]);

  const members = useMemo(() => data?.members ?? [], [data]);
  const offices = useMemo(() => data?.offices ?? [], [data]);
  const skills = useMemo(() => data?.skills ?? [], [data]);
  const holidaySet = useMemo(() => new Set(data?.holidays ?? []), [data]);
  const blockedSet = useMemo(() => new Set(data?.blocked_dates ?? []), [data]);

  // When an office is fixed via the embed param, drop the redundant office filter row.
  const filterConfig = useMemo(
    () => officeFilter ? EMBED_FILTER_CONFIG.filter(c => c.id !== 'office') : EMBED_FILTER_CONFIG,
    [officeFilter],
  );

  const filterOptions = useMemo<Record<CalendarFilterId, FilterOption[]>>(() => {
    const teams = Array.from(new Set(members.map(m => m.team).filter(Boolean))) as string[];
    const roles = Array.from(new Set(members.map(m => m.business_role).filter(Boolean))) as string[];
    const cities = Array.from(new Set(members.map(m => m.city).filter(Boolean))) as string[];
    return {
      office: offices.map(o => ({ value: o.id, label: o.name })),
      team: teams.map(x => ({ value: x, label: x })),
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
      site_priority: [],
      utilization: [],
      assignment_state: [],
      capacity_band: [],
    };
  }, [members, offices, skills, t]);

  const visibleMembers = useMemo(() => {
    return members.filter(m => {
      if (officeFilter && m.office_id !== officeFilter) return false;
      if (filters.office.length > 0 && (!m.office_id || !filters.office.includes(m.office_id))) return false;
      if (filters.team.length > 0 && (!m.team || !filters.team.includes(m.team))) return false;
      if (filters.business_role.length > 0 && (!m.business_role || !filters.business_role.includes(m.business_role))) return false;
      if (filters.skill.length > 0 && !filters.skill.some(s => (m.skills ?? []).some(ms => ms.skill_id === s))) return false;
      if (filters.location.length > 0 && (!m.city || !filters.location.includes(m.city))) return false;
      return true;
    });
  }, [members, filters, officeFilter]);

  const leavesByUser = useMemo(() => {
    const map = new Map<string, LeaveCell[]>();
    (data?.leave_requests ?? []).forEach(l => {
      if (filters.status.length > 0 && !filters.status.includes(l.status)) return;
      // Filter values are the leave_type enum keys, matching l.leave_type directly.
      if (filters.leave_type.length > 0 && !filters.leave_type.includes(l.leave_type)) return;
      if (!map.has(l.user_id)) map.set(l.user_id, []);
      map.get(l.user_id)!.push(l);
    });
    return map;
  }, [data, filters]);

  const cellStatus = (userId: string, day: Date): { kind: 'leave' | 'holiday' | 'weekend' | 'work'; leave?: LeaveCell } => {
    const dStr = format(day, 'yyyy-MM-dd');
    if (holidaySet.has(dStr) || blockedSet.has(dStr)) return { kind: 'holiday' };
    const userLeaves = leavesByUser.get(userId) || [];
    for (const l of userLeaves) {
      if (dStr >= l.start_date && dStr <= l.end_date) return { kind: 'leave', leave: l };
    }
    if (isWeekend(day)) return { kind: 'weekend' };
    return { kind: 'work' };
  };

  const scrollRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: visibleMembers.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  if (error) return (
    <div className="flex flex-col items-center justify-center h-full min-h-48 text-sm text-destructive p-6 text-center gap-2">
      <AlertCircle className="h-8 w-8 opacity-60" />
      <p className="font-semibold">Embed token hiba</p>
      <p className="text-xs text-muted-foreground">{error}</p>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      {/* Toolbar: month nav + count + brand */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-card shrink-0 flex-wrap">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMonth(m => subMonths(m, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="font-semibold capitalize min-w-[130px] text-center text-sm">
          {format(month, 'yyyy. MMMM', { locale: dateFnsLocale })}
        </div>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMonth(m => addMonths(m, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" className="h-8" onClick={() => setMonth(startOfMonth(new Date()))}>
          <CalendarIcon className="h-3.5 w-3.5 mr-1" /> Ma
        </Button>
        <Badge variant="outline" className="text-[10px]">
          {visibleMembers.length} / {members.length}
        </Badge>
        {loading && <span className="text-[10px] text-muted-foreground animate-pulse">…</span>}
        <span className="ml-auto"><EffectimeLogo size={22} variant="full" /></span>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 px-3 py-1.5 border-b bg-card/50 text-[10px] text-muted-foreground shrink-0">
        <LegendItem className="bg-emerald-200/70 dark:bg-emerald-900/40" label={t('timeline_view.legend_vacation')} />
        <LegendItem className="bg-rose-200/70 dark:bg-rose-900/40" label={t('timeline_view.legend_sick')} />
        <LegendItem className="bg-amber-200/70 dark:bg-amber-900/40" label={t('timeline_view.legend_unpaid')} />
        <LegendItem className="bg-blue-100 dark:bg-blue-950/40 ring-1 ring-blue-300" label={t('timeline_view.legend_holiday')} />
        <LegendItem className="bg-zinc-100 dark:bg-zinc-800/60" label={t('timeline_view.legend_weekend')} />
      </div>

      {/* Body: filter sidebar + virtualized grid */}
      <div className="flex-1 min-h-0 grid grid-cols-1 sm:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="overflow-y-auto border-b sm:border-b-0 sm:border-r p-2 max-h-[38%] sm:max-h-none">
          <CalendarFilterBar
            config={filterConfig}
            values={filters}
            options={filterOptions}
            onChange={setFilters}
          />
        </aside>

        <div className="min-w-0 overflow-hidden flex flex-col">
          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
            </div>
          ) : members.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">{t('timeline_view.no_active_members')}</div>
          ) : visibleMembers.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">{t('timeline_view.no_matching_members')}</div>
          ) : (
            <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto">
              <div style={{ minWidth: NAME_W + days.length * CELL_W }}>
                {/* Header row */}
                <div className="flex sticky top-0 z-20 bg-card border-b">
                  <div className="sticky left-0 z-30 bg-card border-r" style={{ width: NAME_W, minWidth: NAME_W }}>
                    <div className="px-3 py-2 text-[11px] font-semibold text-muted-foreground">Tag</div>
                  </div>
                  {days.map(d => {
                    const isHol = holidaySet.has(format(d, 'yyyy-MM-dd')) || blockedSet.has(format(d, 'yyyy-MM-dd'));
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
                <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
                  {rowVirtualizer.getVirtualItems().map(vi => {
                    const m = visibleMembers[vi.index];
                    return (
                      <div
                        key={m.user_id}
                        className="flex absolute left-0 top-0 w-full border-b hover:bg-accent/30"
                        style={{ height: ROW_HEIGHT, transform: `translateY(${vi.start}px)` }}
                      >
                        <div className="sticky left-0 z-10 bg-card border-r flex flex-col justify-center px-3" style={{ width: NAME_W, minWidth: NAME_W }}>
                          <div className="text-xs font-medium truncate">{m.display_name}</div>
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
                                s.kind === 'leave' && (LEAVE_TYPE_TINT[s.leave!.leave_type] || 'bg-violet-200/70 dark:bg-violet-900/40'),
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
      <span className={cn('h-3 w-3 rounded shrink-0', className)} />
      <span>{label}</span>
    </div>
  );
}
