import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  addWeeks, eachDayOfInterval, endOfWeek, format, isWeekend, startOfWeek, subWeeks,
} from 'date-fns';
import { cn } from '@/lib/utils';

interface Office { id: string; name: string; city: string | null }
interface Shift {
  id: string; user_id: string; office_id: string;
  business_role: string | null; shift_date: string;
}
interface Member {
  user_id: string; display_name: string;
  business_role: string | null; office_id: string | null;
}

interface EmbedData {
  offices: Office[];
  shift_assignments: Shift[];
  members: Member[];
  holidays: string[];
  blocked_dates: string[];
}

export interface EmbedShiftRosterViewProps {
  token: string;
  officeFilter?: string;
  initialFrom?: string;
}

export function EmbedShiftRosterView({ token, officeFilter, initialFrom }: EmbedShiftRosterViewProps) {
  const [weekStart, setWeekStart] = useState(() => {
    if (initialFrom) {
      const d = new Date(initialFrom);
      return isNaN(d.getTime()) ? startOfWeek(new Date(), { weekStartsOn: 1 }) : startOfWeek(d, { weekStartsOn: 1 });
    }
    return startOfWeek(new Date(), { weekStartsOn: 1 });
  });

  const [data, setData]     = useState<EmbedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

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
      .rpc('get_embed_view_data', { _token: token, _view: 'shift_roster', _from_date: from, _to_date: to })
      .then(({ data: result, error: err }: { data: EmbedData | null; error: { message: string } | null }) => {
        if (err) { setError(err.message); setLoading(false); return; }
        setData(result);
        setLoading(false);
      });
  }, [token, from, to]);

  const holidaySet = useMemo(() => new Set(data?.holidays ?? []), [data]);

  const offices = useMemo(() => {
    const all = data?.offices ?? [];
    return officeFilter ? all.filter(o => o.id === officeFilter) : all;
  }, [data, officeFilter]);

  // Group members: if office filter, show all members with shifts in that office.
  // Otherwise group by their primary office.
  const membersByOffice = useMemo(() => {
    const map = new Map<string, Member[]>();
    offices.forEach(o => map.set(o.id, []));

    const members = data?.members ?? [];
    const shifts  = data?.shift_assignments ?? [];

    if (officeFilter) {
      // Show members who have at least one shift in the filtered office this week
      const relevantUserIds = new Set(shifts.filter(s => s.office_id === officeFilter).map(s => s.user_id));
      map.set(officeFilter, members.filter(m => relevantUserIds.has(m.user_id)));
    } else {
      // Group by primary office (office_id on membership), fall back to first shift office
      members.forEach(m => {
        const primaryOffice = m.office_id;
        if (primaryOffice && map.has(primaryOffice)) {
          map.get(primaryOffice)!.push(m);
        } else {
          // find first shift this week for a fallback office
          const shift = shifts.find(s => s.user_id === m.user_id);
          const oid = shift?.office_id;
          if (oid && map.has(oid)) {
            map.get(oid)!.push(m);
          }
        }
      });
    }
    return map;
  }, [data, offices, officeFilter]);

  const shiftMap = useMemo(() => {
    const map = new Map<string, Shift>();
    (data?.shift_assignments ?? []).forEach(s => {
      map.set(`${s.user_id}::${s.shift_date}`, s);
    });
    return map;
  }, [data]);

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

  return (
    <div className="flex flex-col h-full bg-background text-foreground text-xs">
      {/* Header */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b shrink-0 flex-wrap">
        <Button size="icon" variant="ghost" className="h-6 w-6"
          onClick={() => setWeekStart(w => subWeeks(w, 1))}>
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="font-medium text-xs min-w-[140px] text-center">
          {format(days[0], 'MMM d')} – {format(days[days.length - 1], 'MMM d, yyyy')}
        </span>
        <Button size="icon" variant="ghost" className="h-6 w-6"
          onClick={() => setWeekStart(w => addWeeks(w, 1))}>
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
        {loading && <span className="ml-1 text-[10px] text-muted-foreground animate-pulse">…</span>}
        <Badge variant="outline" className="ml-auto text-[9px] py-0">Effectime</Badge>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-8 bg-muted animate-pulse rounded" />
            ))}
          </div>
        ) : offices.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-muted-foreground">
            No offices configured
          </div>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-background text-left px-2 py-1.5 font-medium border-b border-r min-w-[110px]">
                  Employee
                </th>
                {days.map(d => {
                  const iso = format(d, 'yyyy-MM-dd');
                  const isHol = holidaySet.has(iso);
                  return (
                    <th key={iso}
                      className={cn(
                        'text-center px-1 py-1.5 font-medium border-b min-w-[46px]',
                        isHol && 'bg-rose-50 dark:bg-rose-950/20',
                        isWeekend(d) && !isHol && 'bg-muted/40',
                      )}>
                      <div>{format(d, 'EEE')}</div>
                      <div className="text-muted-foreground font-normal">{format(d, 'd')}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {offices.map(office => {
                const members = membersByOffice.get(office.id) ?? [];
                return [
                  <tr key={`hdr-${office.id}`}>
                    <td colSpan={days.length + 1}
                      className="sticky left-0 bg-muted/50 px-2 py-1 font-semibold border-b text-[11px] uppercase tracking-wide text-muted-foreground">
                      {office.name}{office.city ? ` · ${office.city}` : ''}
                    </td>
                  </tr>,
                  ...(members.length > 0 ? members.map(member => (
                    <tr key={member.user_id} className="border-b hover:bg-muted/20">
                      <td className="sticky left-0 bg-background px-2 py-1 border-r font-medium truncate max-w-[110px]"
                        title={member.display_name}>
                        {member.display_name}
                        {member.business_role && (
                          <div className="text-[10px] text-muted-foreground opacity-70 font-normal truncate">
                            {member.business_role}
                          </div>
                        )}
                      </td>
                      {days.map(d => {
                        const iso = format(d, 'yyyy-MM-dd');
                        const shift = shiftMap.get(`${member.user_id}::${iso}`);
                        const isHol = holidaySet.has(iso);
                        return (
                          <td key={iso}
                            className={cn(
                              'text-center px-0.5 py-1',
                              isHol && 'bg-rose-50 dark:bg-rose-950/20',
                              isWeekend(d) && !isHol && 'bg-muted/20',
                            )}>
                            {shift ? (
                              <div className="inline-flex items-center justify-center rounded text-[10px] font-medium px-1 py-0.5 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 max-w-[40px] truncate"
                                title={shift.business_role ?? undefined}>
                                {shift.business_role
                                  ? shift.business_role.slice(0, 4)
                                  : '✓'}
                              </div>
                            ) : (
                              <span className="text-muted-foreground/30">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  )) : [
                    <tr key={`empty-${office.id}`} className="border-b">
                      <td className="sticky left-0 bg-background px-2 py-1 border-r text-[11px] text-muted-foreground italic" colSpan={days.length + 1}>
                        No staff assigned this week
                      </td>
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
