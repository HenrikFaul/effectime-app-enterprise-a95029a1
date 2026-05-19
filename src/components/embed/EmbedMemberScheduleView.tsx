import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ChevronLeft, ChevronRight, User } from 'lucide-react';
import { EffectimeLogo } from '@/components/EffectimeLogo';
import {
  addWeeks, eachDayOfInterval, endOfWeek, format, isWeekend, startOfWeek, subWeeks,
} from 'date-fns';
import { cn } from '@/lib/utils';

interface Member {
  user_id: string; display_name: string;
  business_role: string | null; office_id: string | null; membership_id: string;
}
interface Office { id: string; name: string; city: string | null }
interface Shift {
  id: string; user_id: string; office_id: string;
  business_role: string | null; shift_date: string;
}
interface LeaveRequest {
  user_id: string; start_date: string; end_date: string;
}
interface EmbedData {
  offices: Office[];
  members: Member[];
  shift_assignments: Shift[];
  holidays: string[];
  blocked_dates: string[];
  leave_requests: LeaveRequest[];
}

const HU_DAYS = ['V', 'H', 'K', 'Sze', 'Cs', 'P', 'Szo'];

export interface EmbedMemberScheduleViewProps {
  token: string;
  memberId: string;
  initialFrom?: string;
}

export function EmbedMemberScheduleView({ token, memberId, initialFrom }: EmbedMemberScheduleViewProps) {
  const [weekStart, setWeekStart] = useState(() => {
    if (initialFrom) {
      const d = new Date(initialFrom);
      if (!isNaN(d.getTime())) return startOfWeek(d, { weekStartsOn: 1 });
    }
    return startOfWeek(new Date(), { weekStartsOn: 1 });
  });

  const [data, setData]       = useState<EmbedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const days = useMemo(() =>
    eachDayOfInterval({ start: weekStart, end: endOfWeek(weekStart, { weekStartsOn: 1 }) }),
    [weekStart],
  );

  const from = format(days[0], 'yyyy-MM-dd');
  const to   = format(days[days.length - 1], 'yyyy-MM-dd');

  useEffect(() => {
    setLoading(true); setError(null);
    (supabase as any)
      .rpc('get_embed_view_data', { _token: token, _view: 'member_schedule', _from_date: from, _to_date: to })
      .then(({ data: result, error: err }: { data: EmbedData | null; error: { message: string } | null }) => {
        if (err) { setError(err.message); setLoading(false); return; }
        setData(result); setLoading(false);
      });
  }, [token, from, to]);

  const member   = useMemo(() => (data?.members ?? []).find(m => m.user_id === memberId), [data, memberId]);
  const officeMap = useMemo(() => {
    const m = new Map<string, Office>();
    (data?.offices ?? []).forEach(o => m.set(o.id, o));
    return m;
  }, [data]);

  const holidaySet = useMemo(() => new Set(data?.holidays ?? []), [data]);
  const blockedSet = useMemo(() => new Set(data?.blocked_dates ?? []), [data]);

  const leaveSet = useMemo(() => {
    const s = new Set<string>();
    (data?.leave_requests ?? [])
      .filter(lr => lr.user_id === memberId)
      .forEach(lr => {
        let d = new Date(lr.start_date + 'T00:00:00');
        const end = new Date(lr.end_date + 'T00:00:00');
        while (d <= end) {
          s.add(format(d, 'yyyy-MM-dd'));
          d = new Date(d.getTime() + 86400000);
        }
      });
    return s;
  }, [data, memberId]);

  const shiftByDate = useMemo(() => {
    const m = new Map<string, Shift>();
    (data?.shift_assignments ?? [])
      .filter(s => s.user_id === memberId)
      .forEach(s => m.set(s.shift_date, s));
    return m;
  }, [data, memberId]);

  const weekLabel = `${format(days[0], 'yyyy. MMM d.')} — ${format(days[days.length - 1], 'MMM d.')}`;

  if (error) return (
    <div className="flex flex-col items-center justify-center h-full min-h-48 text-sm text-destructive p-6 text-center gap-2">
      <AlertTriangle className="h-8 w-8 opacity-60" />
      <p className="font-medium">Embed token hiba</p>
      <p className="text-xs text-muted-foreground">{error}</p>
    </div>
  );

  if (!loading && !member) return (
    <div className="flex flex-col items-center justify-center h-full min-h-48 text-sm text-muted-foreground p-6 text-center gap-2">
      <User className="h-8 w-8 opacity-40" />
      <p className="font-medium">Ismeretlen csapattag</p>
      <p className="text-xs">A megadott felhasználó nem található a munkaterületen.</p>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-card shrink-0 flex-wrap shadow-subtle">
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setWeekStart(w => subWeeks(w, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="font-display font-medium text-sm text-foreground">{weekLabel}</span>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setWeekStart(w => addWeeks(w, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        {loading && <span className="text-[10px] text-muted-foreground animate-pulse">…</span>}
        <span className="ml-auto"><EffectimeLogo size={22} variant="full" /></span>
      </div>

      {/* Member identity bar */}
      {member && !loading && (
        <div className="px-4 py-2.5 border-b bg-card shrink-0 flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <User className="h-4 w-4 text-primary" />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">{member.display_name}</div>
            {member.business_role && (
              <div className="text-xs text-muted-foreground">{member.business_role}</div>
            )}
          </div>
        </div>
      )}

      {/* Day cards */}
      <div className="flex-1 overflow-auto min-h-0 p-3">
        {loading ? (
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-2 h-full">
            {days.map(d => {
              const iso    = format(d, 'yyyy-MM-dd');
              const isHol  = holidaySet.has(iso) || blockedSet.has(iso);
              const onLeave = leaveSet.has(iso);
              const shift   = shiftByDate.get(iso);
              const office  = shift ? officeMap.get(shift.office_id) : null;
              const isToday = iso === format(new Date(), 'yyyy-MM-dd');

              const bgClass = isHol ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40'
                : onLeave ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/40'
                : shift ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/40'
                : isWeekend(d) ? 'bg-muted/30 border-border/50'
                : 'bg-card border-border';

              return (
                <div key={iso} className={cn(
                  'rounded-xl border flex flex-col items-center p-2 gap-1 min-h-[80px] transition-colors',
                  bgClass,
                  isToday && 'ring-2 ring-primary ring-offset-1',
                )}>
                  {/* Day label */}
                  <div className="text-center">
                    <div className={cn(
                      'text-[10px] font-semibold uppercase tracking-wide',
                      isToday ? 'text-primary' : 'text-muted-foreground',
                    )}>{HU_DAYS[d.getDay()]}</div>
                    <div className={cn(
                      'text-base font-bold leading-tight',
                      isToday && 'text-primary',
                    )}>{format(d, 'd')}</div>
                  </div>

                  {/* Status badge */}
                  <div className="flex-1 flex items-center justify-center">
                    {isHol ? (
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold text-center leading-tight">
                        Ünnep
                      </span>
                    ) : onLeave ? (
                      <span className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold text-center leading-tight">
                        Táv.
                      </span>
                    ) : office ? (
                      <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold text-center leading-tight truncate w-full text-center px-0.5"
                        title={office.name}>
                        {office.name.length > 10 ? office.name.slice(0, 9) + '…' : office.name}
                      </span>
                    ) : isWeekend(d) ? (
                      <span className="text-[10px] text-muted-foreground/50">–</span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/50">–</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-t bg-background text-[10px] text-muted-foreground shrink-0 flex-wrap">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-emerald-100 dark:bg-emerald-900/40" /> Irodai jelenlét
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-rose-100 dark:bg-rose-900/40" /> Távollét
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-amber-100 dark:bg-amber-900/40" /> Ünnepnap
        </span>
      </div>
    </div>
  );
}
