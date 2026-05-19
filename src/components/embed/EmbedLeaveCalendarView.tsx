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

  const holidaySet  = useMemo(() => new Set(data?.holidays ?? []), [data]);
  const blockedSet  = useMemo(() => new Set(data?.blocked_dates ?? []), [data]);
  const members     = useMemo(() => data?.members ?? [], [data]);

  // Build a set of "user_id::YYYY-MM-DD" for on-leave days
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

  // Count absences per day (for header summary)
  const absentCountByDay = useMemo(() => {
    return days.map(d => {
      const iso = format(d, 'yyyy-MM-dd');
      return members.filter(m => leaveSet.has(`${m.user_id}::${iso}`)).length;
    });
  }, [days, members, leaveSet]);

  if (error) return (
    <div className="flex flex-col items-center justify-center h-full min-h-48 text-sm text-destructive p-6 text-center gap-2">
      <AlertTriangle className="h-8 w-8 opacity-60" />
      <p className="font-medium">Embed token hiba</p>
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
        <span className="font-display font-medium text-sm text-foreground">{weekLabel}</span>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setWeekStart(w => addWeeks(w, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        {loading && <span className="text-[10px] text-muted-foreground animate-pulse">…</span>}
        <span className="ml-auto"><EffectimeLogo size={22} variant="full" /></span>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-b bg-background text-[10px] text-muted-foreground shrink-0">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-rose-200 dark:bg-rose-900/60" /> Szabadság / távollét
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-amber-100 dark:bg-amber-900/40" /> Ünnepnap
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-muted" /> Hétvége
        </span>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto min-h-0">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-9 bg-muted animate-pulse rounded-lg" />)}
          </div>
        ) : members.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-xs text-muted-foreground">
            Nincsenek aktív csapattagok
          </div>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-background text-left px-3 py-2 font-medium border-b border-r min-w-[130px] text-muted-foreground">
                  Munkavállaló
                </th>
                {days.map((d, i) => {
                  const iso = format(d, 'yyyy-MM-dd');
                  const isHol = holidaySet.has(iso) || blockedSet.has(iso);
                  const absentCount = absentCountByDay[i];
                  return (
                    <th key={iso} className={cn(
                      'text-center px-1 py-2 font-medium border-b min-w-[52px]',
                      isHol && 'bg-amber-50 dark:bg-amber-950/20',
                      isWeekend(d) && !isHol && 'bg-muted/40',
                    )}>
                      <div className="text-xs">{HU_DAYS[d.getDay()]}</div>
                      <div className="text-muted-foreground font-normal text-[11px]">{format(d, 'd')}</div>
                      {absentCount > 0 && !isHol && (
                        <div className="text-[9px] text-rose-500 font-semibold mt-0.5">−{absentCount}</div>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {members.map(member => (
                <tr key={member.user_id} className="border-b hover:bg-muted/10 transition-colors">
                  <td className="sticky left-0 bg-background px-3 py-1.5 border-r max-w-[130px]">
                    <div className="text-xs font-medium text-foreground truncate">{member.display_name}</div>
                    {member.business_role && (
                      <div className="text-[10px] text-muted-foreground truncate mt-0.5">{member.business_role}</div>
                    )}
                  </td>
                  {days.map(d => {
                    const iso     = format(d, 'yyyy-MM-dd');
                    const isHol   = holidaySet.has(iso) || blockedSet.has(iso);
                    const onLeave = leaveSet.has(`${member.user_id}::${iso}`);
                    return (
                      <td key={iso} className={cn(
                        'text-center px-1 py-1.5',
                        isHol    && 'bg-amber-50 dark:bg-amber-950/20',
                        onLeave  && !isHol && 'bg-rose-50 dark:bg-rose-950/30',
                        isWeekend(d) && !isHol && !onLeave && 'bg-muted/20',
                      )}>
                        {isHol ? (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">Ünn.</span>
                        ) : onLeave ? (
                          <span className="inline-flex items-center justify-center rounded-md bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 text-[10px] font-medium px-1.5 py-0.5">
                            TÁV
                          </span>
                        ) : (
                          <span className="text-muted-foreground/30 text-[10px]">—</span>
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
