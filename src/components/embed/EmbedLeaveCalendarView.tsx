import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { EffectimeLogo } from '@/components/EffectimeLogo';
import {
  addWeeks, eachDayOfInterval, endOfWeek, format, isWeekend, startOfWeek, subWeeks,
} from 'date-fns';
import { cn } from '@/lib/utils';

interface Member {
  user_id: string; display_name: string;
  business_role: string | null; office_id: string | null; membership_id: string;
}
interface LeaveRequest {
  user_id: string; start_date: string; end_date: string;
}
interface EmbedData {
  can_write: boolean;
  members: Member[];
  holidays: string[];
  blocked_dates: string[];
  leave_requests: LeaveRequest[];
}

const HU_DAYS = ['V', 'H', 'K', 'Sze', 'Cs', 'P', 'Szo'];
const TODAY = format(new Date(), 'yyyy-MM-dd');

export interface EmbedLeaveCalendarViewProps {
  token: string;
  officeFilter?: string;
  initialFrom?: string;
}

export function EmbedLeaveCalendarView({ token, officeFilter: _officeFilter, initialFrom }: EmbedLeaveCalendarViewProps) {
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
      .rpc('get_embed_view_data', { _token: token, _view: 'leave_calendar', _from_date: from, _to_date: to })
      .then(({ data: result, error: err }: { data: EmbedData | null; error: { message: string } | null }) => {
        if (err) { setError(err.message); setLoading(false); return; }
        setData(result); setLoading(false);
      });
  }, [token, from, to]);

  const holidaySet = useMemo(() => new Set(data?.holidays ?? []), [data]);
  const blockedSet = useMemo(() => new Set(data?.blocked_dates ?? []), [data]);
  const members    = useMemo(() => data?.members ?? [], [data]);

  const leaveSet = useMemo(() => {
    const s = new Set<string>();
    (data?.leave_requests ?? []).forEach(lr => {
      let d = new Date(lr.start_date + 'T00:00:00');
      const end = new Date(lr.end_date + 'T00:00:00');
      while (d <= end) {
        s.add(`${lr.user_id}::${format(d, 'yyyy-MM-dd')}`);
        d = new Date(d.getTime() + 86400000);
      }
    });
    return s;
  }, [data]);

  const weekLabel = `${format(days[0], 'yyyy. MMM d.')} — ${format(days[days.length - 1], 'MMM d.')}`;

  const absentCountByDay = useMemo(() => {
    return days.map(d => {
      const iso = format(d, 'yyyy-MM-dd');
      return members.filter(m => leaveSet.has(`${m.user_id}::${iso}`)).length;
    });
  }, [days, members, leaveSet]);

  if (error) return (
    <div className="flex flex-col items-center justify-center h-full min-h-48 text-sm text-destructive p-6 text-center gap-2">
      <AlertTriangle className="h-8 w-8 opacity-60" />
      <p className="font-semibold">Embed token hiba</p>
      <p className="text-xs text-muted-foreground">{error}</p>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-card shrink-0 flex-wrap shadow-subtle">
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setWeekStart(w => subWeeks(w, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="font-display font-semibold text-sm text-foreground">{weekLabel}</span>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setWeekStart(w => addWeeks(w, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        {loading && <span className="text-[10px] text-muted-foreground animate-pulse ml-1">…</span>}
        <span className="ml-auto"><EffectimeLogo size={22} variant="full" /></span>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-3 py-1.5 border-b bg-background shrink-0">
        <span className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-rose-200 dark:bg-rose-900/60 shrink-0" />
          Szabadság / távollét
        </span>
        <span className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-200 dark:bg-amber-900/40 shrink-0" />
          Ünnepnap
        </span>
        <span className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-muted shrink-0" />
          Hétvége
        </span>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto min-h-0">
        {loading ? (
          <div className="space-y-2 p-4">
            <div className="h-6 w-1/4 bg-muted animate-pulse rounded-lg" />
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 bg-muted animate-pulse rounded-lg" style={{ opacity: 1 - i * 0.12 }} />
            ))}
          </div>
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-32 gap-2 text-muted-foreground">
            <AlertTriangle className="h-6 w-6 opacity-30" />
            <span className="text-xs">Nincsenek aktív csapattagok</span>
          </div>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-background/95 backdrop-blur-sm">
                <th className="sticky left-0 z-20 bg-background/95 text-left px-3 py-2.5 border-b border-r min-w-[130px]">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    Munkavállaló
                  </span>
                </th>
                {days.map((d, i) => {
                  const iso          = format(d, 'yyyy-MM-dd');
                  const isHol        = holidaySet.has(iso) || blockedSet.has(iso);
                  const isToday      = iso === TODAY;
                  const absentCount  = absentCountByDay[i];
                  return (
                    <th key={iso} className={cn(
                      'text-center px-1 py-2 border-b min-w-[52px] transition-colors',
                      isHol   ? 'bg-amber-50/80 dark:bg-amber-950/20' :
                      isToday ? 'bg-primary/5' :
                      isWeekend(d) ? 'bg-muted/30' : '',
                    )}>
                      <div className={cn(
                        'text-sm font-bold leading-none',
                        isToday ? 'text-primary' : 'text-foreground',
                      )}>{format(d, 'd')}</div>
                      <div className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/50 mt-0.5">
                        {HU_DAYS[d.getDay()]}
                      </div>
                      {absentCount > 0 && !isHol && (
                        <span className="inline-flex items-center justify-center mt-0.5 min-w-[16px] h-4 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 text-[9px] font-bold px-1">
                          −{absentCount}
                        </span>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {members.map(member => (
                <tr key={member.user_id} className="border-b hover:bg-muted/10 transition-colors">
                  <td className="sticky left-0 bg-background px-3 py-2 border-r max-w-[130px]">
                    <div className="text-xs font-medium text-foreground truncate">{member.display_name}</div>
                    {member.business_role && (
                      <div className="text-[10px] text-muted-foreground/70 truncate mt-0.5">{member.business_role}</div>
                    )}
                  </td>
                  {days.map(d => {
                    const iso     = format(d, 'yyyy-MM-dd');
                    const isHol   = holidaySet.has(iso) || blockedSet.has(iso);
                    const onLeave = leaveSet.has(`${member.user_id}::${iso}`);
                    const isToday = iso === TODAY;
                    return (
                      <td key={iso} className={cn(
                        'text-center px-1 py-1.5 transition-colors',
                        isHol    ? 'bg-amber-50/80 dark:bg-amber-950/20' :
                        onLeave  ? 'bg-rose-50 dark:bg-rose-950/20' :
                        isToday  ? 'bg-primary/5' :
                        isWeekend(d) ? 'bg-muted/15' : '',
                      )}>
                        {isHol ? (
                          <span className="inline-flex items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[9px] font-bold px-1.5 py-0.5 tracking-wide">
                            ÜNN
                          </span>
                        ) : onLeave ? (
                          <span className="inline-flex items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 text-[9px] font-bold px-1.5 py-0.5 tracking-wide">
                            TÁV
                          </span>
                        ) : (
                          <span className="text-muted-foreground/25 text-[11px]">·</span>
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
