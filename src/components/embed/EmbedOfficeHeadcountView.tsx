import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { EffectimeLogo } from '@/components/EffectimeLogo';
import {
  addWeeks, eachDayOfInterval, endOfWeek, format, isWeekend, startOfWeek, subWeeks,
} from 'date-fns';
import { cn } from '@/lib/utils';

interface Office { id: string; name: string; city: string | null }
interface CoverageRule {
  id: string; office_id: string; min_headcount: number;
  days_of_week: number[] | null; rule_date: string | null;
  valid_from: string | null; valid_until: string | null;
}
interface ShiftEntry { office_id: string; shift_date: string }
interface EmbedData {
  offices: Office[];
  coverage_rules: CoverageRule[];
  shift_assignments: ShiftEntry[];
  holidays: string[];
  blocked_dates: string[];
}

const HU_DAYS = ['V', 'H', 'K', 'Sze', 'Cs', 'P', 'Szo'];
const TODAY = format(new Date(), 'yyyy-MM-dd');

function ruleAppliesOn(r: CoverageRule, iso: string, dow: number): boolean {
  if (r.rule_date) return r.rule_date === iso;
  if (r.valid_from && iso < r.valid_from) return false;
  if (r.valid_until && iso > r.valid_until) return false;
  if (r.days_of_week?.length && !r.days_of_week.includes(dow)) return false;
  return true;
}

export interface EmbedOfficeHeadcountViewProps {
  token: string;
  officeFilter?: string;
  initialFrom?: string;
}

export function EmbedOfficeHeadcountView({ token, officeFilter, initialFrom }: EmbedOfficeHeadcountViewProps) {
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
      .rpc('get_embed_view_data', { _token: token, _view: 'office_headcount', _from_date: from, _to_date: to })
      .then(({ data: result, error: err }: { data: EmbedData | null; error: { message: string } | null }) => {
        if (err) { setError(err.message); setLoading(false); return; }
        setData(result); setLoading(false);
      });
  }, [token, from, to]);

  const offices = useMemo(() => {
    const all = data?.offices ?? [];
    return officeFilter ? all.filter(o => o.id === officeFilter) : all;
  }, [data, officeFilter]);

  const holidaySet = useMemo(() => new Set(data?.holidays ?? []), [data]);
  const blockedSet = useMemo(() => new Set(data?.blocked_dates ?? []), [data]);

  const cellData = useMemo(() => {
    const shifts = data?.shift_assignments ?? [];
    const rules  = data?.coverage_rules ?? [];
    const result = new Map<string, { have: number; need: number }>();
    for (const office of offices) {
      for (const d of days) {
        const iso  = format(d, 'yyyy-MM-dd');
        const dow  = d.getDay();
        const key  = `${office.id}::${iso}`;
        const have = shifts.filter(s => s.office_id === office.id && s.shift_date === iso).length;
        const need = rules
          .filter(r => r.office_id === office.id && ruleAppliesOn(r, iso, dow))
          .reduce((sum, r) => sum + r.min_headcount, 0);
        result.set(key, { have, need });
      }
    }
    return result;
  }, [data, offices, days]);

  const weekLabel = `${format(days[0], 'yyyy. MMM d.')} — ${format(days[days.length - 1], 'MMM d.')}`;

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

      {/* Grid */}
      <div className="flex-1 overflow-auto min-h-0">
        {loading ? (
          <div className="space-y-2 p-4">
            <div className="h-6 w-1/4 bg-muted animate-pulse rounded-lg" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" style={{ opacity: 1 - i * 0.15 }} />
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
                <th className="sticky left-0 z-20 bg-background/95 text-left px-3 py-2.5 border-b border-r min-w-[140px]">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    Telephely
                  </span>
                </th>
                {days.map(d => {
                  const iso     = format(d, 'yyyy-MM-dd');
                  const isHol   = holidaySet.has(iso) || blockedSet.has(iso);
                  const isToday = iso === TODAY;
                  return (
                    <th key={iso} className={cn(
                      'text-center px-1 py-2 border-b min-w-[56px] transition-colors',
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
              {offices.map(office => (
                <tr key={office.id} className="border-b hover:bg-muted/10 transition-colors">
                  <td className="sticky left-0 bg-background px-3 py-2.5 border-r max-w-[140px]">
                    <div className="text-xs font-semibold text-foreground truncate">{office.name}</div>
                    {office.city && (
                      <div className="text-[10px] text-muted-foreground/70 mt-0.5">{office.city}</div>
                    )}
                  </td>
                  {days.map(d => {
                    const iso     = format(d, 'yyyy-MM-dd');
                    const isHol   = holidaySet.has(iso) || blockedSet.has(iso);
                    const isToday = iso === TODAY;
                    const cell    = cellData.get(`${office.id}::${iso}`) ?? { have: 0, need: 0 };

                    if (isWeekend(d) && !isHol && cell.need === 0) {
                      return (
                        <td key={iso} className={cn('text-center', isToday ? 'bg-primary/5' : 'bg-muted/15')}>
                          <span className="text-muted-foreground/25 text-[11px]">·</span>
                        </td>
                      );
                    }

                    if (isHol) {
                      return (
                        <td key={iso} className="bg-amber-50/80 dark:bg-amber-950/20 text-center py-2">
                          <span className="inline-flex items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[9px] font-bold px-1.5 py-0.5">
                            ÜNN
                          </span>
                        </td>
                      );
                    }

                    if (cell.need === 0) {
                      return (
                        <td key={iso} className={cn('text-center', isToday ? 'bg-primary/5' : isWeekend(d) ? 'bg-muted/15' : '')}>
                          <span className="text-muted-foreground/25 text-[11px]">·</span>
                        </td>
                      );
                    }

                    const pct   = Math.min(100, Math.round((cell.have / cell.need) * 100));
                    const isOk  = cell.have >= cell.need;
                    const isGap = cell.have < cell.need;

                    return (
                      <td key={iso} className={cn(
                        'px-2 py-2 text-center',
                        isGap && 'bg-rose-50 dark:bg-rose-950/20',
                        isOk  && 'bg-emerald-50 dark:bg-emerald-950/20',
                        isToday && 'ring-1 ring-inset ring-primary/30',
                      )}>
                        <div className={cn(
                          'flex items-center justify-center gap-0.5 font-bold text-xs mb-1.5',
                          isGap && 'text-rose-700 dark:text-rose-400',
                          isOk  && 'text-emerald-700 dark:text-emerald-400',
                        )}>
                          {isOk
                            ? <CheckCircle2 className="h-3 w-3 shrink-0" />
                            : <AlertTriangle className="h-3 w-3 shrink-0" />}
                          <span>{cell.have}</span>
                          <span className="font-normal text-[10px] opacity-50">/</span>
                          <span className="font-normal text-[10px] opacity-70">{cell.need}</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-black/8 dark:bg-white/10 overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all', isOk ? 'bg-emerald-500' : 'bg-rose-500')}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
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
