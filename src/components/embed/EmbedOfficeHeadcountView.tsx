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

  // For each office+day: count actual shifts and required headcount
  const cellData = useMemo(() => {
    const shifts  = data?.shift_assignments ?? [];
    const rules   = data?.coverage_rules ?? [];
    const result = new Map<string, { have: number; need: number }>();
    for (const office of offices) {
      for (const d of days) {
        const iso = format(d, 'yyyy-MM-dd');
        const dow = d.getDay();
        const key = `${office.id}::${iso}`;
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

      {/* Grid */}
      <div className="flex-1 overflow-auto min-h-0">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />)}
          </div>
        ) : offices.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-xs text-muted-foreground">
            Nincs telephelyi beállítás
          </div>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-background text-left px-3 py-2 font-medium border-b border-r min-w-[140px] text-muted-foreground">
                  Telephely
                </th>
                {days.map(d => {
                  const iso   = format(d, 'yyyy-MM-dd');
                  const isHol = holidaySet.has(iso) || blockedSet.has(iso);
                  return (
                    <th key={iso} className={cn(
                      'text-center px-1 py-2 font-medium border-b min-w-[56px]',
                      isHol        && 'bg-amber-50 dark:bg-amber-950/20',
                      isWeekend(d) && !isHol && 'bg-muted/40',
                    )}>
                      <div className="text-xs">{HU_DAYS[d.getDay()]}</div>
                      <div className="text-muted-foreground font-normal text-[11px]">{format(d, 'd')}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {offices.map(office => (
                <tr key={office.id} className="border-b hover:bg-muted/10 transition-colors">
                  <td className="sticky left-0 bg-background px-3 py-2 border-r max-w-[140px]">
                    <div className="text-xs font-semibold text-foreground truncate">{office.name}</div>
                    {office.city && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">{office.city}</div>
                    )}
                  </td>
                  {days.map(d => {
                    const iso   = format(d, 'yyyy-MM-dd');
                    const isHol = holidaySet.has(iso) || blockedSet.has(iso);
                    const cell  = cellData.get(`${office.id}::${iso}`) ?? { have: 0, need: 0 };

                    if (isWeekend(d) && !isHol && cell.need === 0) {
                      return <td key={iso} className="bg-muted/20 text-center text-muted-foreground/30 text-[10px]">—</td>;
                    }

                    if (isHol) {
                      return (
                        <td key={iso} className="bg-amber-50 dark:bg-amber-950/20 text-center">
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">Ünn.</span>
                        </td>
                      );
                    }

                    if (cell.need === 0) {
                      return (
                        <td key={iso} className={cn('text-center', isWeekend(d) && 'bg-muted/20')}>
                          <span className="text-muted-foreground/30 text-[10px]">—</span>
                        </td>
                      );
                    }

                    const pct   = Math.min(100, Math.round((cell.have / cell.need) * 100));
                    const isOk  = cell.have >= cell.need;
                    const isGap = cell.have < cell.need;

                    return (
                      <td key={iso} className={cn(
                        'px-2 py-1.5 text-center',
                        isGap && 'bg-rose-50 dark:bg-rose-950/30',
                        isOk  && 'bg-emerald-50 dark:bg-emerald-950/30',
                      )}>
                        {/* Count */}
                        <div className={cn(
                          'flex items-center justify-center gap-0.5 font-semibold text-xs mb-1',
                          isGap && 'text-rose-700 dark:text-rose-400',
                          isOk  && 'text-emerald-700 dark:text-emerald-400',
                        )}>
                          {isOk
                            ? <CheckCircle2 className="h-3 w-3 shrink-0" />
                            : <AlertTriangle className="h-3 w-3 shrink-0" />}
                          {cell.need}/{cell.have}
                        </div>
                        {/* Progress bar */}
                        <div className="w-full h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all',
                              isOk  ? 'bg-emerald-500' : 'bg-rose-500',
                            )}
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
