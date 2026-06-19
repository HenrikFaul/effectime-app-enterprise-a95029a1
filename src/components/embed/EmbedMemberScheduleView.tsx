/**
 * EmbedMemberScheduleView — "Munkatárs" (per-person schedule) view.
 *
 * Redesign of the old member-schedule (which gated behind a separate full-screen
 * picker and only showed a single flat week). The aim — "see & manage ONE person's
 * schedule + workload" — is now reached more directly:
 *   • Inline member switcher in the header (no separate picker step).
 *   • Month calendar (with a Week toggle) so the whole period is visible at a glance.
 *   • Workload summary: scheduled days, leave days, and hours-vs-capacity (week) using
 *     the v3.50.0 enriched member data — instantly shows under/over-booking.
 *   • Office-aware assignment ("Beosztás ide: <office>") so it's clear WHERE a day is
 *     scheduled, with the same optimistic / no-flicker writes as the capacity panel.
 *
 * Anonymous: all reads via the token RPC `get_embed_view_data` (view member_schedule);
 * writes via `embed_assign_shift` / `embed_remove_shift`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, Loader2, Plus, User, X } from 'lucide-react';
import { EffectimeLogo } from '@/components/EffectimeLogo';
import {
  addMonths, addWeeks, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth,
  isWeekend, startOfMonth, startOfWeek, subMonths, subWeeks,
} from 'date-fns';
import { hu } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Office { id: string; name: string; city: string | null }
interface Shift {
  id: string; user_id: string; office_id: string;
  business_role: string | null; shift_date: string;
}
interface Member {
  user_id: string; display_name: string;
  business_role: string | null; office_id: string | null; membership_id: string;
  weekly_capacity_hours?: number | null; base_working_hours?: number | null;
}
interface LeaveRequest { user_id: string; start_date: string; end_date: string; status?: string }
interface EmbedData {
  can_write: boolean;
  offices: Office[];
  shift_assignments: Shift[];
  members: Member[];
  holidays: string[];
  blocked_dates: string[];
  leave_requests: LeaveRequest[];
}

const HU_DAYS_MON = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'];
const TODAY = format(new Date(), 'yyyy-MM-dd');

export interface EmbedMemberScheduleViewProps {
  token: string;
  memberId?: string;
  initialFrom?: string;
}

export function EmbedMemberScheduleView({ token, memberId, initialFrom }: EmbedMemberScheduleViewProps) {
  const [viewMode, setViewMode] = useState<'week' | 'month'>('month');
  const [anchor, setAnchor] = useState<Date>(() => {
    if (initialFrom) { const d = new Date(initialFrom); if (!isNaN(d.getTime())) return d; }
    return new Date();
  });
  const [selectedId, setSelectedId] = useState<string>(memberId ?? '');
  const [activeOffice, setActiveOffice] = useState<string>('');
  const [data, setData] = useState<EmbedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());
  const loadId = useRef(0);

  // Visible day range. Week = the ISO week; Month = the full calendar weeks covering the month.
  const { days, from, to } = useMemo(() => {
    if (viewMode === 'week') {
      const ws = startOfWeek(anchor, { weekStartsOn: 1 });
      const we = endOfWeek(anchor, { weekStartsOn: 1 });
      return { days: eachDayOfInterval({ start: ws, end: we }), from: format(ws, 'yyyy-MM-dd'), to: format(we, 'yyyy-MM-dd') };
    }
    const gs = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 });
    const ge = endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 });
    return { days: eachDayOfInterval({ start: gs, end: ge }), from: format(gs, 'yyyy-MM-dd'), to: format(ge, 'yyyy-MM-dd') };
  }, [viewMode, anchor]);

  const load = useCallback((opts?: { silent?: boolean }) => {
    const id = ++loadId.current;
    if (!opts?.silent) setLoading(true);
    setError(null);
    (supabase as any)
      .rpc('get_embed_view_data', { _token: token, _view: 'member_schedule', _from_date: from, _to_date: to })
      .then(({ data: result, error: err }: { data: EmbedData | null; error: { message: string } | null }) => {
        if (id !== loadId.current) return;
        if (err) { setError(err.message); if (!opts?.silent) setLoading(false); return; }
        setData(result); if (!opts?.silent) setLoading(false);
      });
  }, [token, from, to]);

  useEffect(() => { load(); }, [load]);

  const members = useMemo(
    () => (data?.members ?? []).slice().sort((a, b) => a.display_name.localeCompare(b.display_name)),
    [data],
  );
  const offices = useMemo(() => data?.offices ?? [], [data]);
  const canWrite = data?.can_write ?? false;

  // Resolved member: explicit selection, else the first teammate.
  const member = useMemo(
    () => members.find(m => m.user_id === selectedId) ?? members[0] ?? null,
    [members, selectedId],
  );

  // Default the assignment office to the member's primary, else the first office.
  useEffect(() => {
    if (!offices.length) return;
    setActiveOffice(prev => {
      if (prev && offices.some(o => o.id === prev)) return prev;
      return member?.office_id && offices.some(o => o.id === member.office_id) ? member.office_id : offices[0].id;
    });
  }, [offices, member]);

  const holidaySet = useMemo(() => {
    const s = new Set(data?.holidays ?? []);
    (data?.blocked_dates ?? []).forEach(d => s.add(d));
    return s;
  }, [data]);

  const leaveSet = useMemo(() => {
    const s = new Set<string>();
    if (!member) return s;
    (data?.leave_requests ?? [])
      .filter(lr => lr.user_id === member.user_id && (lr.status == null || lr.status === 'approved'))
      .forEach(lr => {
        let d = new Date(lr.start_date + 'T00:00:00');
        const end = new Date(lr.end_date + 'T00:00:00');
        while (d <= end) { s.add(format(d, 'yyyy-MM-dd')); d = new Date(d.getTime() + 86400000); }
      });
    return s;
  }, [data, member]);

  const shiftByDate = useMemo(() => {
    const m = new Map<string, Shift>();
    if (!member) return m;
    (data?.shift_assignments ?? []).filter(s => s.user_id === member.user_id).forEach(s => m.set(s.shift_date, s));
    return m;
  }, [data, member]);

  const officeName = (id: string) => offices.find(o => o.id === id)?.name ?? id;

  // Period summary (month mode counts only in-month days).
  const summary = useMemo(() => {
    let workDays = 0, leaveDays = 0;
    for (const d of days) {
      if (viewMode === 'month' && !isSameMonth(d, anchor)) continue;
      const iso = format(d, 'yyyy-MM-dd');
      if (shiftByDate.has(iso)) workDays++;
      else if (leaveSet.has(iso)) leaveDays++;
    }
    return { workDays, leaveDays };
  }, [days, viewMode, anchor, shiftByDate, leaveSet]);

  const periodLabel = viewMode === 'week'
    ? `${format(days[0], 'yyyy. MMM d.', { locale: hu })} — ${format(days[days.length - 1], 'MMM d.', { locale: hu })}`
    : format(anchor, 'yyyy. MMMM', { locale: hu });

  const assignDay = async (iso: string) => {
    if (!member || !activeOffice) return;
    const role = member.business_role ?? null;
    setData(prev => prev ? {
      ...prev,
      shift_assignments: [
        ...prev.shift_assignments.filter(s => !(s.user_id === member.user_id && s.shift_date === iso)),
        { id: `tmp:${member.user_id}:${iso}`, user_id: member.user_id, office_id: activeOffice, business_role: role, shift_date: iso },
      ],
    } : prev);
    setSavingKeys(p => new Set(p).add(iso));
    const { error: err } = await (supabase as any).rpc('embed_assign_shift', {
      _token: token, _user_id: member.user_id, _office_id: activeOffice,
      _business_role: role, _shift_date: iso, _skill_id: null,
    });
    setSavingKeys(p => { const n = new Set(p); n.delete(iso); return n; });
    if (err) { toast.error('Hiba a beosztásnál: ' + err.message); load({ silent: true }); return; }
    load({ silent: true });
  };

  const removeShift = async (shift: Shift) => {
    setData(prev => prev ? { ...prev, shift_assignments: prev.shift_assignments.filter(s => s.id !== shift.id) } : prev);
    setSavingKeys(p => new Set(p).add(shift.id));
    const { error: err } = await (supabase as any).rpc('embed_remove_shift', { _token: token, _assignment_id: shift.id });
    setSavingKeys(p => { const n = new Set(p); n.delete(shift.id); return n; });
    if (err) { toast.error('Hiba a törlésnél: ' + err.message); load({ silent: true }); return; }
    load({ silent: true });
  };

  const goPrev = () => setAnchor(a => viewMode === 'week' ? subWeeks(a, 1) : subMonths(a, 1));
  const goNext = () => setAnchor(a => viewMode === 'week' ? addWeeks(a, 1) : addMonths(a, 1));
  const goToday = () => setAnchor(new Date());

  if (error) return (
    <div className="flex flex-col items-center justify-center h-full min-h-48 text-sm text-destructive p-6 text-center gap-2">
      <AlertTriangle className="h-8 w-8 opacity-60" />
      <p className="font-semibold">Embed token hiba</p>
      <p className="text-xs text-muted-foreground">{error}</p>
    </div>
  );

  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      {/* Header — inline member switcher */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-card shrink-0">
        <User className="h-4 w-4 text-primary shrink-0" />
        <Select value={member?.user_id ?? ''} onValueChange={setSelectedId}>
          <SelectTrigger className="h-8 text-xs max-w-[260px]">
            <SelectValue placeholder="Válassz munkatársat" />
          </SelectTrigger>
          <SelectContent>
            {members.map(m => (
              <SelectItem key={m.user_id} value={m.user_id} className="text-xs">
                {m.display_name}{m.business_role ? ` · ${m.business_role}` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {canWrite && (
          <Badge variant="outline" className="text-[9px] py-0 border-primary/40 text-primary font-semibold shrink-0">
            ✏ szerkesztés
          </Badge>
        )}
        {loading && <span className="text-[10px] text-muted-foreground animate-pulse">…</span>}
        <span className="ml-auto"><EffectimeLogo size={22} variant="full" /></span>
      </div>

      {/* Toolbar — period nav + week/month toggle + assignment office */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-card/60 shrink-0 flex-wrap">
        <div className="flex rounded-md border overflow-hidden text-xs">
          <button type="button" className={cn('px-2.5 py-1 transition-colors', viewMode === 'week' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent')} onClick={() => setViewMode('week')}>Heti</button>
          <button type="button" className={cn('px-2.5 py-1 border-l transition-colors', viewMode === 'month' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent')} onClick={() => setViewMode('month')}>Havi</button>
        </div>
        <Button size="icon" variant="outline" className="h-7 w-7" onClick={goPrev}><ChevronLeft className="h-4 w-4" /></Button>
        <span className="font-semibold text-sm capitalize min-w-[130px] text-center">{periodLabel}</span>
        <Button size="icon" variant="outline" className="h-7 w-7" onClick={goNext}><ChevronRight className="h-4 w-4" /></Button>
        <Button size="sm" variant="ghost" className="h-7" onClick={goToday}><CalendarDays className="h-3.5 w-3.5 mr-1" />Ma</Button>
        {canWrite && offices.length > 1 && (
          <div className="flex items-center gap-1 ml-auto">
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">Beosztás ide:</span>
            <Select value={activeOffice} onValueChange={setActiveOffice}>
              <SelectTrigger className="h-7 text-xs max-w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {offices.map(o => <SelectItem key={o.id} value={o.id} className="text-xs">{o.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Workload summary */}
      {member && !loading && (
        <div className="flex items-center gap-2 px-3 py-2 border-b bg-background shrink-0 flex-wrap text-[11px]">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 font-semibold">
            {summary.workDays} beosztott nap
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 px-2 py-0.5 font-semibold">
            {summary.leaveDays} távollét
          </span>
          {viewMode === 'week' && member.weekly_capacity_hours ? (() => {
            const base = Number(member.base_working_hours) || 8;
            const cap = Number(member.weekly_capacity_hours) || 40;
            const hrs = summary.workDays * base;
            const over = hrs > cap;
            return (
              <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold',
                over ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300' : 'bg-muted text-muted-foreground')}>
                {hrs}h / {cap}h{over ? ' · túlóra' : ''}
              </span>
            );
          })() : null}
        </div>
      )}

      {/* Calendar */}
      <div className="flex-1 overflow-auto min-h-0 p-2">
        {loading ? (
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" style={{ opacity: 1 - (i % 7) * 0.08 }} />
            ))}
          </div>
        ) : !member ? (
          <div className="flex flex-col items-center justify-center h-full min-h-32 gap-2 text-muted-foreground">
            <User className="h-6 w-6 opacity-30" />
            <span className="text-xs">Nincsenek munkatársak</span>
          </div>
        ) : (
          <div className="min-w-[420px]">
            <div className="grid grid-cols-7 gap-1.5 mb-1.5">
              {HU_DAYS_MON.map(d => (
                <div key={d} className="text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">{d}</div>
              ))}
            </div>
            <div className="space-y-1.5">
              {weeks.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 gap-1.5">
                  {week.map(d => {
                    const iso = format(d, 'yyyy-MM-dd');
                    const outMonth = viewMode === 'month' && !isSameMonth(d, anchor);
                    const isHol = holidaySet.has(iso);
                    const onLeave = leaveSet.has(iso);
                    const shift = shiftByDate.get(iso);
                    const isToday = iso === TODAY;
                    const wknd = isWeekend(d);
                    const saving = savingKeys.has(iso) || (!!shift && savingKeys.has(shift.id));
                    const canAssign = canWrite && !!activeOffice && !isHol && !onLeave && !wknd && !shift && !outMonth;
                    const tone = isHol ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200/70 dark:border-amber-800/40'
                      : onLeave ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-200/70 dark:border-rose-800/40'
                      : shift ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200/70 dark:border-emerald-800/40'
                      : wknd ? 'bg-muted/20 border-border/40'
                      : 'bg-card border-border/60';
                    return (
                      <div key={iso} className={cn(
                        'relative rounded-lg border p-1 min-h-[52px] flex flex-col',
                        tone, outMonth && 'opacity-40', isToday && 'ring-2 ring-primary ring-offset-1',
                      )}>
                        <div className="flex items-center justify-between">
                          <span className={cn('text-[11px] font-bold leading-none', isToday ? 'text-primary' : 'text-foreground')}>
                            {format(d, 'd')}
                          </span>
                          {saving ? (
                            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground/60" />
                          ) : canWrite && shift ? (
                            <button onClick={() => removeShift(shift)}
                              className="h-4 w-4 flex items-center justify-center rounded-full text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors">
                              <X className="h-2.5 w-2.5" />
                            </button>
                          ) : null}
                        </div>
                        <div className="flex-1 flex items-center justify-center">
                          {isHol ? (
                            <Badge variant="outline" className="text-[8px] px-1 py-0 border-amber-300 text-amber-700 dark:text-amber-300">ÜNN</Badge>
                          ) : onLeave ? (
                            <Badge variant="outline" className="text-[8px] px-1 py-0 border-rose-300 text-rose-700 dark:text-rose-300">TÁV</Badge>
                          ) : shift ? (
                            <span className="text-[9px] font-semibold text-emerald-700 dark:text-emerald-300 text-center leading-tight truncate w-full px-0.5" title={officeName(shift.office_id)}>
                              {officeName(shift.office_id)}
                            </span>
                          ) : canAssign ? (
                            <button onClick={() => assignDay(iso)}
                              className="h-5 w-5 flex items-center justify-center rounded-full text-muted-foreground/30 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors">
                              <Plus className="h-3 w-3" />
                            </button>
                          ) : (
                            <span className="text-muted-foreground/20 text-[11px]">·</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-t bg-card/50 shrink-0 flex-wrap text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-200/70 dark:bg-emerald-900/40 shrink-0" />Beosztva (telephely)</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-rose-200/70 dark:bg-rose-900/40 shrink-0" />Távollét</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-200/70 dark:bg-amber-900/40 shrink-0" />Ünnepnap</span>
      </div>
    </div>
  );
}
