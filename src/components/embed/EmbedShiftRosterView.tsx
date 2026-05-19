import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { EffectimeLogo } from '@/components/EffectimeLogo';
import {
  addWeeks, eachDayOfInterval, endOfWeek, format, isWeekend, startOfWeek, subWeeks,
} from 'date-fns';
import { cn } from '@/lib/utils';

const HU_DAYS = ['V', 'H', 'K', 'Sze', 'Cs', 'P', 'Szo'];
const TODAY = format(new Date(), 'yyyy-MM-dd');

// "Senior Frontend Developer" → "SFD", "Backend Developer" → "BD"
const roleAbbrev = (role: string) =>
  role.split(/\s+/).map(w => w[0]?.toUpperCase() ?? '').join('');

interface Office { id: string; name: string; city: string | null }
interface Shift {
  id: string; user_id: string; office_id: string;
  business_role: string | null; shift_date: string;
}
interface Member {
  user_id: string; display_name: string;
  business_role: string | null; office_id: string | null;
  membership_id: string;
}
interface EmbedData {
  can_write: boolean;
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

  const [data, setData]       = useState<EmbedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [saving, setSaving]   = useState(false);

  const days = useMemo(() =>
    eachDayOfInterval({ start: weekStart, end: endOfWeek(weekStart, { weekStartsOn: 1 }) }),
    [weekStart],
  );

  const from = format(days[0], 'yyyy-MM-dd');
  const to   = format(days[days.length - 1], 'yyyy-MM-dd');

  const load = () => {
    setLoading(true);
    setError(null);
    (supabase as any)
      .rpc('get_embed_view_data', { _token: token, _view: 'shift_roster', _from_date: from, _to_date: to })
      .then(({ data: result, error: err }: { data: EmbedData | null; error: { message: string } | null }) => {
        if (err) { setError(err.message); setLoading(false); return; }
        setData(result);
        setLoading(false);
      });
  };

  useEffect(() => { load(); }, [token, from, to]); // eslint-disable-line react-hooks/exhaustive-deps

  const canWrite   = data?.can_write ?? false;
  const holidaySet = useMemo(() => new Set(data?.holidays ?? []), [data]);

  const offices = useMemo(() => {
    const all = data?.offices ?? [];
    return officeFilter ? all.filter(o => o.id === officeFilter) : all;
  }, [data, officeFilter]);

  const membersByOffice = useMemo(() => {
    const map = new Map<string, Member[]>();
    offices.forEach(o => map.set(o.id, []));

    const members = data?.members ?? [];
    const shifts  = data?.shift_assignments ?? [];

    if (officeFilter) {
      const relevantUserIds = new Set(shifts.filter(s => s.office_id === officeFilter).map(s => s.user_id));
      map.set(officeFilter, members.filter(m => relevantUserIds.has(m.user_id)));
    } else {
      members.forEach(m => {
        const primaryOffice = m.office_id;
        if (primaryOffice && map.has(primaryOffice)) {
          map.get(primaryOffice)!.push(m);
        } else {
          const shift = shifts.find(s => s.user_id === m.user_id);
          const oid = shift?.office_id;
          if (oid && map.has(oid)) map.get(oid)!.push(m);
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

  const handleAssign = async (member: Member, officeId: string, isoDate: string) => {
    setSaving(true);
    const { error: err } = await (supabase as any).rpc('embed_assign_shift', {
      _token: token,
      _user_id: member.user_id,
      _office_id: officeId,
      _business_role: member.business_role ?? null,
      _shift_date: isoDate,
      _skill_id: null,
    });
    setSaving(false);
    if (err) { console.error('embed_assign_shift error:', err.message); return; }
    load();
  };

  const handleRemove = async (shiftId: string) => {
    setSaving(true);
    const { error: err } = await (supabase as any).rpc('embed_remove_shift', { _token: token, _assignment_id: shiftId });
    setSaving(false);
    if (err) { console.error('embed_remove_shift error:', err.message); return; }
    load();
  };

  if (error) return (
    <div className="flex flex-col items-center justify-center h-full min-h-48 text-sm text-destructive p-6 text-center gap-2">
      <AlertTriangle className="h-8 w-8 opacity-60" />
      <p className="font-semibold">Embed token hiba</p>
      <p className="text-xs text-muted-foreground">{error}</p>
    </div>
  );

  const weekLabel = `${format(days[0], 'yyyy. MMM d.')} — ${format(days[days.length - 1], 'MMM d.')}`;

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-card shrink-0 flex-wrap shadow-subtle">
        <Button size="icon" variant="ghost" className="h-7 w-7"
          onClick={() => setWeekStart(w => subWeeks(w, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="font-display font-semibold text-sm text-foreground">{weekLabel}</span>
        <Button size="icon" variant="ghost" className="h-7 w-7"
          onClick={() => setWeekStart(w => addWeeks(w, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        {(loading || saving) && <span className="text-[10px] text-muted-foreground animate-pulse ml-1">…</span>}
        {canWrite && (
          <Badge variant="outline" className="text-[9px] py-0 border-primary/40 text-primary font-semibold">
            ✏ szerkesztés
          </Badge>
        )}
        <span className="ml-auto"><EffectimeLogo size={22} variant="full" /></span>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto min-h-0">
        {loading ? (
          <div className="space-y-2 p-4">
            <div className="h-6 w-1/4 bg-muted animate-pulse rounded-lg" />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 bg-muted animate-pulse rounded-lg" style={{ opacity: 1 - i * 0.15 }} />
            ))}
          </div>
        ) : offices.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-32 gap-2 text-muted-foreground">
            <AlertTriangle className="h-6 w-6 opacity-30" />
            <span className="text-xs">Nincs telephelyi beállítás</span>
          </div>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-background/95 backdrop-blur-sm">
                <th className="sticky left-0 z-20 bg-background/95 text-left px-3 py-2.5 border-b border-r min-w-[120px]">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    Munkavállaló
                  </span>
                </th>
                {days.map(d => {
                  const iso     = format(d, 'yyyy-MM-dd');
                  const isHol   = holidaySet.has(iso);
                  const isToday = iso === TODAY;
                  return (
                    <th key={iso}
                      className={cn(
                        'text-center px-1 py-2 border-b min-w-[50px] transition-colors',
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
                      className="sticky left-0 bg-muted/20 px-3 py-1.5 border-b">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-0.5 rounded-full bg-primary/50 shrink-0" />
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {office.name}{office.city ? ` · ${office.city}` : ''}
                        </span>
                      </div>
                    </td>
                  </tr>,
                  ...(members.length > 0 ? members.map(member => (
                    <tr key={member.user_id} className="border-b hover:bg-muted/15 transition-colors">
                      <td className="sticky left-0 bg-background px-3 py-2 border-r truncate max-w-[120px]"
                        title={member.display_name}>
                        <div className="text-xs font-medium text-foreground truncate">{member.display_name}</div>
                        {member.business_role && (
                          <div className="text-[10px] text-muted-foreground/70 truncate mt-0.5">
                            {member.business_role}
                          </div>
                        )}
                      </td>
                      {days.map(d => {
                        const iso     = format(d, 'yyyy-MM-dd');
                        const shift   = shiftMap.get(`${member.user_id}::${iso}`);
                        const isHol   = holidaySet.has(iso);
                        const isToday = iso === TODAY;
                        return (
                          <td key={iso}
                            className={cn(
                              'text-center px-1 py-1.5 transition-colors',
                              isHol   ? 'bg-amber-50/80 dark:bg-amber-950/20' :
                              isToday ? 'bg-primary/5' :
                              isWeekend(d) ? 'bg-muted/15' : '',
                            )}>
                            {shift ? (
                              <div className="inline-flex items-center gap-0.5">
                                <span className={cn(
                                  'inline-flex items-center justify-center rounded-full text-[10px] font-semibold px-1.5 py-0.5 gap-0.5',
                                  'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300',
                                )}
                                  title={shift.business_role ?? undefined}>
                                  {shift.business_role
                                    ? <span title={shift.business_role}>{roleAbbrev(shift.business_role)}</span>
                                    : <Check className="h-2.5 w-2.5" />}
                                </span>
                                {canWrite && (
                                  <button
                                    disabled={saving}
                                    onClick={() => handleRemove(shift.id)}
                                    className="h-4 w-4 flex items-center justify-center rounded-full text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30"
                                  >
                                    <X className="h-2.5 w-2.5" />
                                  </button>
                                )}
                              </div>
                            ) : canWrite ? (
                              <button
                                disabled={saving}
                                onClick={() => handleAssign(member, office.id, iso)}
                                className="h-6 w-6 mx-auto flex items-center justify-center rounded-full text-muted-foreground/30 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors disabled:opacity-30"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            ) : (
                              <span className="text-muted-foreground/25 text-[11px]">·</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  )) : [
                    <tr key={`empty-${office.id}`} className="border-b">
                      <td className="sticky left-0 bg-background px-3 py-2 border-r text-xs text-muted-foreground/60 italic" colSpan={days.length + 1}>
                        Ezen a héten nincs beosztott
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
