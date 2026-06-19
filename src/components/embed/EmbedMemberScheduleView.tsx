import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2, Plus, User, X } from 'lucide-react';
import { EffectimeLogo } from '@/components/EffectimeLogo';
import {
  addWeeks, eachDayOfInterval, endOfWeek, format, isWeekend, startOfWeek, subWeeks,
} from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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
  user_id: string; start_date: string; end_date: string; status?: string;
}
interface EmbedData {
  can_write: boolean;
  offices: Office[];
  members: Member[];
  shift_assignments: Shift[];
  holidays: string[];
  blocked_dates: string[];
  leave_requests: LeaveRequest[];
}

const HU_DAYS = ['V', 'H', 'K', 'Sze', 'Cs', 'P', 'Szo'];
const TODAY = format(new Date(), 'yyyy-MM-dd');

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

  const [data, setData]         = useState<EmbedData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [saving, setSaving]     = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

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
  }, [token, from, to, refreshKey]);

  const member    = useMemo(() => (data?.members ?? []).find(m => m.user_id === memberId), [data, memberId]);
  const offices   = useMemo(() => data?.offices ?? [], [data]);
  const officeMap = useMemo(() => {
    const m = new Map<string, Office>();
    offices.forEach(o => m.set(o.id, o));
    return m;
  }, [offices]);

  const canWrite    = data?.can_write ?? false;
  const holidaySet  = useMemo(() => new Set(data?.holidays ?? []), [data]);
  const blockedSet  = useMemo(() => new Set(data?.blocked_dates ?? []), [data]);

  const leaveSet = useMemo(() => {
    const s = new Set<string>();
    (data?.leave_requests ?? [])
      // RPC now also returns pending leaves; the member schedule shows confirmed absences only.
      .filter(lr => lr.user_id === memberId && (lr.status == null || lr.status === 'approved'))
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

  // Primary office to use when assigning: member's own, or first available
  const assignOfficeId = useMemo(() => {
    if (member?.office_id && officeMap.has(member.office_id)) return member.office_id;
    return offices[0]?.id ?? null;
  }, [member, offices, officeMap]);

  const handleAssign = async (isoDate: string) => {
    if (!assignOfficeId) return;
    setSaving(isoDate);
    const { error: err } = await (supabase as any).rpc('embed_assign_shift', {
      _token:         token,
      _user_id:       memberId,
      _office_id:     assignOfficeId,
      _business_role: member?.business_role ?? null,
      _shift_date:    isoDate,
      _skill_id:      null,
    });
    setSaving(null);
    if (err) { toast.error('Hiba a beosztásnál: ' + err.message); return; }
    setRefreshKey(k => k + 1);
  };

  const handleRemove = async (shiftId: string) => {
    setSaving(shiftId);
    const { error: err } = await (supabase as any).rpc('embed_remove_shift', {
      _token:         token,
      _assignment_id: shiftId,
    });
    setSaving(null);
    if (err) { toast.error('Hiba a törlésnél: ' + err.message); return; }
    setRefreshKey(k => k + 1);
  };

  const weekLabel = `${format(days[0], 'yyyy. MMM d.')} — ${format(days[days.length - 1], 'MMM d.')}`;

  if (error) return (
    <div className="flex flex-col items-center justify-center h-full min-h-48 text-sm text-destructive p-6 text-center gap-2">
      <AlertTriangle className="h-8 w-8 opacity-60" />
      <p className="font-semibold">Embed token hiba</p>
      <p className="text-xs text-muted-foreground">{error}</p>
    </div>
  );

  if (!loading && !member) return (
    <div className="flex flex-col items-center justify-center h-full min-h-48 text-sm text-muted-foreground p-6 text-center gap-2">
      <User className="h-8 w-8 opacity-30" />
      <p className="font-semibold text-foreground">Ismeretlen csapattag</p>
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
        <span className="font-display font-semibold text-sm text-foreground">{weekLabel}</span>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setWeekStart(w => addWeeks(w, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        {(loading || saving) && <span className="text-[10px] text-muted-foreground animate-pulse ml-1">…</span>}
        {canWrite && (
          <span className="inline-flex items-center gap-1 text-[9px] font-semibold px-2 py-0.5 rounded-full border border-primary/40 text-primary ml-1">
            ✏ szerkesztés
          </span>
        )}
        <span className="ml-auto"><EffectimeLogo size={22} variant="full" /></span>
      </div>

      {/* Member identity bar */}
      {(member || loading) && (
        <div className="px-4 py-2.5 border-b bg-card shrink-0 flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <User className="h-4 w-4 text-primary" />
          </div>
          {loading ? (
            <div className="space-y-1.5 flex-1">
              <div className="h-3.5 w-32 bg-muted animate-pulse rounded" />
              <div className="h-2.5 w-20 bg-muted animate-pulse rounded" />
            </div>
          ) : member && (
            <div>
              <div className="text-sm font-semibold text-foreground">{member.display_name}</div>
              {member.business_role && (
                <div className="text-[11px] text-muted-foreground mt-0.5">{member.business_role}</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Day cards */}
      <div className="flex-1 overflow-auto min-h-0 p-3">
        {loading ? (
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-28 bg-muted animate-pulse rounded-xl" style={{ opacity: 1 - i * 0.1 }} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-2 h-full">
            {days.map(d => {
              const iso     = format(d, 'yyyy-MM-dd');
              const isHol   = holidaySet.has(iso) || blockedSet.has(iso);
              const onLeave = leaveSet.has(iso);
              const shift   = shiftByDate.get(iso);
              const office  = shift ? officeMap.get(shift.office_id) : null;
              const isToday = iso === TODAY;
              const isWknd  = isWeekend(d);
              const isSaving = saving === iso || saving === shift?.id;
              const canAssign = canWrite && !isHol && !onLeave && !isWknd && !shift && !!assignOfficeId;
              const canRemove = canWrite && !!shift;

              const bgClass = isHol
                ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200/80 dark:border-amber-800/30'
                : onLeave
                ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-200/80 dark:border-rose-800/30'
                : shift
                ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-800/30'
                : isWknd
                ? 'bg-muted/20 border-border/30'
                : 'bg-card border-border/60';

              return (
                <div key={iso} className={cn(
                  'rounded-xl border flex flex-col items-center p-2 gap-1 min-h-[88px] transition-colors',
                  bgClass,
                  isToday && 'ring-2 ring-primary ring-offset-1',
                )}>
                  {/* Day number + abbreviation */}
                  <div className="text-center">
                    <div className={cn(
                      'text-base font-bold leading-none',
                      isToday ? 'text-primary' : 'text-foreground',
                    )}>{format(d, 'd')}</div>
                    <div className={cn(
                      'text-[9px] font-semibold uppercase tracking-widest mt-0.5',
                      isToday ? 'text-primary/70' : 'text-muted-foreground/50',
                    )}>{HU_DAYS[d.getDay()]}</div>
                  </div>

                  {/* Status badge */}
                  <div className="flex-1 flex items-center justify-center w-full">
                    {isHol ? (
                      <span className="inline-flex items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[9px] font-bold px-1.5 py-0.5 tracking-wide">
                        ÜNN
                      </span>
                    ) : onLeave ? (
                      <span className="inline-flex items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 text-[9px] font-bold px-1.5 py-0.5 tracking-wide">
                        TÁV
                      </span>
                    ) : office ? (
                      <span
                        className="inline-flex items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-[9px] font-semibold px-1.5 py-0.5 w-full text-center truncate"
                        title={office.name}>
                        {office.name.length > 9 ? office.name.slice(0, 8) + '…' : office.name}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/25 text-[11px]">·</span>
                    )}
                  </div>

                  {/* Write controls */}
                  {isSaving ? (
                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground/60" />
                  ) : canAssign ? (
                    <button
                      onClick={() => handleAssign(iso)}
                      className="w-full flex items-center justify-center gap-0.5 rounded-full bg-primary/10 hover:bg-primary/20 text-primary text-[9px] font-bold py-0.5 transition-colors"
                    >
                      <Plus className="h-2.5 w-2.5" />
                      Beoszt
                    </button>
                  ) : canRemove ? (
                    <button
                      onClick={() => handleRemove(shift!.id)}
                      className="w-full flex items-center justify-center gap-0.5 rounded-full bg-destructive/10 hover:bg-destructive/20 text-destructive text-[9px] font-bold py-0.5 transition-colors"
                    >
                      <X className="h-2.5 w-2.5" />
                      Töröl
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-t bg-background shrink-0 flex-wrap">
        <span className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-100 dark:bg-emerald-900/40 shrink-0" />
          Irodai jelenlét
        </span>
        <span className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-rose-100 dark:bg-rose-900/40 shrink-0" />
          Távollét
        </span>
        <span className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-100 dark:bg-amber-900/40 shrink-0" />
          Ünnepnap
        </span>
      </div>
    </div>
  );
}
