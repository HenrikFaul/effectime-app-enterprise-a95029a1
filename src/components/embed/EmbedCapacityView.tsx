import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Plus, X, Loader2 } from 'lucide-react';
import { EffectimeLogo } from '@/components/EffectimeLogo';
import {
  addMonths, addWeeks, eachDayOfInterval, endOfMonth, endOfWeek,
  format, isWeekend, startOfMonth, startOfWeek, subMonths, subWeeks,
} from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Office { id: string; name: string; city: string | null }
interface CoverageRule {
  id: string; office_id: string;
  business_role: string | null; business_roles: string[] | null;
  skill_id: string | null; skill_ids: string[] | null;
  min_headcount: number;
  days_of_week: number[] | null; rule_date: string | null;
  valid_from: string | null; valid_until: string | null;
  name: string | null;
}
interface Shift {
  id: string; user_id: string; membership_id: string; office_id: string;
  business_role: string | null; skill_id: string | null; shift_date: string;
}
interface Member {
  user_id: string; display_name: string;
  business_role: string | null; office_id: string | null; membership_id: string;
}
interface EmbedData {
  workspace_id: string; can_write: boolean;
  offices: Office[]; coverage_rules: CoverageRule[];
  shift_assignments: Shift[]; members: Member[];
  holidays: string[]; blocked_dates: string[];
}

function ruleRoles(r: CoverageRule): string[] {
  if (r.business_roles?.length) return r.business_roles;
  if (r.business_role) return [r.business_role];
  return [];
}
function ruleSkillIds(r: CoverageRule): string[] {
  if (r.skill_ids?.length) return r.skill_ids;
  if (r.skill_id) return [r.skill_id];
  return [];
}
function shiftsFor(rule: CoverageRule, isoDate: string, shifts: Shift[]): Shift[] {
  const roles = ruleRoles(rule);
  const skillIds = ruleSkillIds(rule);
  return shifts.filter(s => {
    if (s.office_id !== rule.office_id || s.shift_date !== isoDate) return false;
    const roleMatch = roles.length === 0 || (s.business_role != null && roles.includes(s.business_role));
    const skillMatch = skillIds.length === 0 || (s.skill_id != null && skillIds.includes(s.skill_id));
    if (roles.length > 0 && skillIds.length > 0) return roleMatch || skillMatch;
    if (roles.length > 0) return roleMatch;
    if (skillIds.length > 0) return skillMatch;
    return true;
  });
}
function ruleAppliesOn(r: CoverageRule, isoDate: string, dow: number): boolean {
  if (r.rule_date) return r.rule_date === isoDate;
  if (r.valid_from && isoDate < r.valid_from) return false;
  if (r.valid_until && isoDate > r.valid_until) return false;
  if (r.days_of_week?.length && !r.days_of_week.includes(dow)) return false;
  return true;
}

export interface EmbedCapacityViewProps {
  token: string;
  mode?: 'weekly' | 'monthly';
  officeFilter?: string;
  initialFrom?: string;
}

export function EmbedCapacityView({ token, mode = 'weekly', officeFilter, initialFrom }: EmbedCapacityViewProps) {
  const [viewMode, setViewMode] = useState<'weekly' | 'monthly'>(mode);
  const [weekStart, setWeekStart] = useState(() => {
    if (initialFrom) { const d = new Date(initialFrom); if (!isNaN(d.getTime())) return startOfWeek(d, { weekStartsOn: 1 }); }
    return startOfWeek(new Date(), { weekStartsOn: 1 });
  });
  const [monthStart, setMonthStart] = useState(() => {
    if (initialFrom) { const d = new Date(initialFrom); if (!isNaN(d.getTime())) return startOfMonth(d); }
    return startOfMonth(new Date());
  });
  const [data, setData]         = useState<EmbedData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [saving, setSaving]     = useState(false);
  // selected cell for write panel: { ruleId, date }
  const [selected, setSelected] = useState<{ ruleId: string; date: string } | null>(null);
  const loadId = useRef(0);

  const days = useMemo(() => {
    if (viewMode === 'monthly') return eachDayOfInterval({ start: monthStart, end: endOfMonth(monthStart) });
    return eachDayOfInterval({ start: weekStart, end: endOfWeek(weekStart, { weekStartsOn: 1 }) });
  }, [viewMode, weekStart, monthStart]);

  const from = format(days[0], 'yyyy-MM-dd');
  const to   = format(days[days.length - 1], 'yyyy-MM-dd');

  const load = useCallback(() => {
    const id = ++loadId.current;
    setLoading(true); setError(null);
    (supabase as any)
      .rpc('get_embed_view_data', { _token: token, _view: 'capacity_planner', _from_date: from, _to_date: to })
      .then(({ data: result, error: err }: { data: EmbedData | null; error: { message: string } | null }) => {
        if (id !== loadId.current) return;
        if (err) { setError(err.message); setLoading(false); return; }
        setData(result); setLoading(false);
      });
  }, [token, from, to]);

  useEffect(() => { load(); }, [load]);

  const holidaySet = useMemo(() => new Set(data?.holidays ?? []), [data]);
  const blockedSet = useMemo(() => new Set(data?.blocked_dates ?? []), [data]);
  const canWrite   = data?.can_write ?? false;

  const offices = useMemo(() => {
    const all = data?.offices ?? [];
    return officeFilter ? all.filter(o => o.id === officeFilter) : all;
  }, [data, officeFilter]);

  const rulesByOffice = useMemo(() => {
    const map = new Map<string, CoverageRule[]>();
    offices.forEach(o => map.set(o.id, []));
    (data?.coverage_rules ?? []).forEach(r => {
      if (!map.has(r.office_id)) return;
      map.get(r.office_id)!.push(r);
    });
    return map;
  }, [data, offices]);

  const memberByUserId = useMemo(() => {
    const map = new Map<string, Member>();
    (data?.members ?? []).forEach(m => map.set(m.user_id, m));
    return map;
  }, [data]);

  const shifts = data?.shift_assignments ?? [];

  // ── Write actions ──────────────────────────────────────────────────────────
  const handleAssign = async (rule: CoverageRule, isoDate: string, member: Member) => {
    setSaving(true);
    const roles = ruleRoles(rule);
    const skillIds = ruleSkillIds(rule);
    const { error: err } = await (supabase as any).rpc('embed_assign_shift', {
      _token:         token,
      _user_id:       member.user_id,
      _office_id:     rule.office_id,
      _business_role: roles[0] ?? member.business_role ?? null,
      _shift_date:    isoDate,
      _skill_id:      skillIds[0] ?? null,
    });
    setSaving(false);
    if (err) { toast.error('Hiba a beosztásnál: ' + err.message); return; }
    toast.success(`${member.display_name} beosztva (${isoDate})`);
    setSelected(null);
    load();
  };

  const handleRemove = async (shiftId: string) => {
    setSaving(true);
    const { error: err } = await (supabase as any).rpc('embed_remove_shift', {
      _token:         token,
      _assignment_id: shiftId,
    });
    setSaving(false);
    if (err) { toast.error('Hiba a törlésénél: ' + err.message); return; }
    toast.success('Beosztás törölve');
    load();
  };

  // ── Write panel (shown below table when cell selected) ────────────────────
  const WritePanel = () => {
    if (!selected || !canWrite) return null;
    const rule = (data?.coverage_rules ?? []).find(r => r.id === selected.ruleId);
    if (!rule) return null;

    const assigned  = shiftsFor(rule, selected.date, shifts);
    const assignedUserIds = new Set(assigned.map(s => s.user_id));
    const available = (data?.members ?? []).filter(m => !assignedUserIds.has(m.user_id));
    const roles     = ruleRoles(rule);

    return (
      <div className="border-t-2 border-primary bg-card px-3 py-2.5 text-xs">
        <div className="flex items-center justify-between mb-2">
          <span className="font-semibold text-[13px] text-foreground">
            ✏️ {rule.name ?? roles.join(', ')} — {format(new Date(selected.date), 'MMM d')}
          </span>
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setSelected(null)}>
            <X className="h-3 w-3" />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Assigned */}
          <div>
            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
              BEOSZTOTT ({assigned.length}/{rule.min_headcount})
            </div>
            {assigned.length === 0 ? (
              <div className="text-muted-foreground italic">Senki</div>
            ) : assigned.map(s => {
              const m = memberByUserId.get(s.user_id);
              return (
                <div key={s.id} className="flex items-center gap-1.5 mb-1">
                  <span className="flex-1 truncate">{m?.display_name ?? s.user_id}</span>
                  <Button size="sm" variant="ghost"
                    className="h-5 w-5 p-0 text-destructive hover:text-destructive"
                    disabled={saving}
                    onClick={() => handleRemove(s.id)}>
                    {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                  </Button>
                </div>
              );
            })}
          </div>

          {/* Available */}
          <div>
            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
              ELÉRHETŐ ({available.length})
            </div>
            <div className="max-h-28 overflow-y-auto">
              {available.length === 0 ? (
                <div className="text-muted-foreground italic">Mindenki beosztva</div>
              ) : available.map(m => (
                <div key={m.user_id} className="flex items-center gap-1.5 mb-1">
                  <span className="flex-1 truncate">{m.display_name}</span>
                  <Button size="sm" variant="ghost"
                    className="h-5 w-5 p-0 text-primary hover:text-primary"
                    disabled={saving}
                    onClick={() => handleAssign(rule, selected.date, m)}>
                    {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (error) return (
    <div className="flex items-center justify-center h-full min-h-48 text-sm text-destructive p-6 text-center">
      <div><AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-60" />
        <p className="font-medium">Embed token error</p>
        <p className="text-xs text-muted-foreground mt-1">{error}</p>
      </div>
    </div>
  );

  const ruleLabel = (r: CoverageRule) => r.name ?? (ruleRoles(r).join(', ') || `≥${r.min_headcount}`);

  // Monthly view
  if (viewMode === 'monthly') {
    const weeks: Date[][] = [];
    let week: Date[] = [];
    for (const d of days) {
      if (week.length === 7) { weeks.push(week); week = []; }
      week.push(d);
    }
    if (week.length > 0) weeks.push(week);

    const dayTone = (iso: string, dow: number) => {
      let hasGap = false, hasOk = false, hasAny = false;
      for (const office of offices) {
        for (const rule of (rulesByOffice.get(office.id) ?? [])) {
          if (!ruleAppliesOn(rule, iso, dow)) continue;
          hasAny = true;
          const have = shiftsFor(rule, iso, shifts).length;
          if (have < rule.min_headcount) hasGap = true;
          else hasOk = true;
        }
      }
      if (!hasAny) return 'none';
      return hasGap ? 'gap' : hasOk ? 'ok' : 'over';
    };

    return (
      <div className="flex flex-col h-full bg-background text-foreground text-xs">
        <Header label={format(monthStart, 'MMMM yyyy')}
          onPrev={() => setMonthStart(m => subMonths(m, 1))}
          onNext={() => setMonthStart(m => addMonths(m, 1))}
          viewMode={viewMode} onViewMode={setViewMode} loading={loading} canWrite={canWrite} />
        <div className="flex-1 overflow-auto">
          {loading ? <LoadingSkeleton /> : (
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>{['Mo','Tu','We','Th','Fr','Sa','Su'].map(d =>
                  <th key={d} className="text-center font-medium px-1 py-1 border-b text-muted-foreground">{d}</th>
                )}</tr>
              </thead>
              <tbody>
                {weeks.map((week, wi) => (
                  <tr key={wi}>
                    {Array.from({ length: 7 }).map((_, di) => {
                      const d = week[di];
                      if (!d) return <td key={di} className="border bg-muted/20" />;
                      const iso = format(d, 'yyyy-MM-dd');
                      const tone = dayTone(iso, d.getDay());
                      const isHol = holidaySet.has(iso) || blockedSet.has(iso);
                      const cls = isHol ? 'bg-rose-50 dark:bg-rose-950/20'
                        : tone === 'gap'  ? 'bg-rose-100 dark:bg-rose-950/40'
                        : tone === 'ok'   ? 'bg-emerald-50 dark:bg-emerald-950/20'
                        : tone === 'over' ? 'bg-amber-50 dark:bg-amber-950/20' : 'bg-background';
                      return (
                        <td key={iso} className={cn('border text-center align-top p-1 h-10 w-[calc(100%/7)] min-w-[28px]', cls)}>
                          <span className={cn('font-medium text-[11px]', tone === 'gap' && !isHol ? 'text-rose-700' : '')}>
                            {format(d, 'd')}
                          </span>
                          {!isHol && tone === 'gap' && <AlertTriangle className="h-2.5 w-2.5 mx-auto text-rose-500 mt-0.5" />}
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

  // Weekly detailed view
  return (
    <div className="flex flex-col h-full bg-background text-foreground text-sm">
      <Header
        label={`${format(days[0], 'MMM d')} – ${format(days[days.length-1], 'MMM d, yyyy')}`}
        onPrev={() => setWeekStart(w => subWeeks(w, 1))}
        onNext={() => setWeekStart(w => addWeeks(w, 1))}
        viewMode={viewMode} onViewMode={setViewMode} loading={loading} canWrite={canWrite} />
      <div className="flex-1 overflow-auto">
        {loading ? <LoadingSkeleton /> : offices.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-xs text-muted-foreground">No offices configured</div>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-background text-left px-2 py-1.5 font-medium border-b border-r w-36">
                  Office / Rule
                </th>
                {days.map(d => {
                  const iso = format(d, 'yyyy-MM-dd');
                  const isHol = holidaySet.has(iso) || blockedSet.has(iso);
                  return (
                    <th key={iso} className={cn('text-center px-1 py-1.5 font-medium border-b min-w-[64px]',
                      isHol && 'bg-rose-50 dark:bg-rose-950/20',
                      isWeekend(d) && !isHol && 'bg-muted/40')}>
                      <div>{format(d, 'EEE')}</div>
                      <div className="text-muted-foreground font-normal">{format(d, 'd')}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {offices.map(office => {
                const officeRules = rulesByOffice.get(office.id) ?? [];
                return [
                  <tr key={`hdr-${office.id}`}>
                    <td colSpan={days.length + 1}
                      className="sticky left-0 bg-muted/50 px-2 py-1 font-semibold border-b text-[11px] uppercase tracking-wide text-muted-foreground">
                      {office.name}{office.city ? ` · ${office.city}` : ''}
                    </td>
                  </tr>,
                  ...(officeRules.length > 0 ? officeRules.map(rule => (
                    <tr key={rule.id} className="border-b">
                      <td className="sticky left-0 bg-background px-2 py-1 border-r text-[11px] text-muted-foreground max-w-[9rem] truncate"
                        title={ruleLabel(rule)}>
                        {ruleLabel(rule)}
                        <div className="text-[10px] opacity-60">≥{rule.min_headcount}</div>
                      </td>
                      {days.map(d => {
                        const iso = format(d, 'yyyy-MM-dd');
                        const dow = d.getDay();
                        if (!ruleAppliesOn(rule, iso, dow)) return <td key={iso} className="bg-muted/20" />;
                        const cellShifts = shiftsFor(rule, iso, shifts);
                        const have = cellShifts.length;
                        const need = rule.min_headcount;
                        const tone = have < need
                          ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-700'
                          : have === need
                            ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700'
                            : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700';
                        const isSelected = selected?.ruleId === rule.id && selected?.date === iso;
                        return (
                          <td key={iso} className={cn('px-1 py-1', tone, isSelected && 'ring-2 ring-inset ring-primary')}>
                            {/* Count row */}
                            <div className="flex items-center justify-center gap-0.5 font-medium mb-0.5">
                              {have < need ? <AlertTriangle className="h-3 w-3 shrink-0" /> : <CheckCircle2 className="h-3 w-3 shrink-0" />}
                              <span>{need}/{have}</span>
                            </div>
                            {/* Assigned names (write mode) */}
                            {canWrite && cellShifts.map(s => {
                              const m = memberByUserId.get(s.user_id);
                              return (
                                <div key={s.id} className="text-[10px] truncate leading-tight max-w-[56px]"
                                  title={m?.display_name ?? s.user_id}>
                                  {(m?.display_name ?? s.user_id).split(' ')[0]}
                                </div>
                              );
                            })}
                            {/* Edit button (write mode) */}
                            {canWrite && (
                              <button
                                onClick={() => setSelected(isSelected ? null : { ruleId: rule.id, date: iso })}
                                className={cn(
                                  'mt-0.5 w-full text-[10px] rounded px-1 py-0.5 leading-tight transition-colors',
                                  isSelected
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-black/10 hover:bg-black/20 dark:bg-white/10'
                                )}>
                                {isSelected ? '✕ bezár' : '✏ szerkeszt'}
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  )) : [
                    <tr key={`empty-${office.id}`} className="border-b">
                      <td className="sticky left-0 bg-background px-2 py-1 border-r text-[11px] text-muted-foreground italic">No rules</td>
                      {days.map(d => <td key={format(d, 'yyyy-MM-dd')} />)}
                    </tr>,
                  ]),
                ];
              })}
            </tbody>
          </table>
        )}
      </div>
      <WritePanel />
    </div>
  );
}

function Header({ label, onPrev, onNext, viewMode, onViewMode, loading, canWrite }: {
  label: string; onPrev: () => void; onNext: () => void;
  viewMode: 'weekly' | 'monthly'; onViewMode: (v: 'weekly' | 'monthly') => void;
  loading: boolean; canWrite: boolean;
}) {
  return (
    <div className="flex items-center gap-1 px-2 py-1.5 border-b bg-card shrink-0 flex-wrap shadow-subtle">
      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onPrev}><ChevronLeft className="h-3.5 w-3.5" /></Button>
      <span className="font-display font-medium text-xs min-w-[130px] text-center">{label}</span>
      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onNext}><ChevronRight className="h-3.5 w-3.5" /></Button>
      <div className="ml-1 flex rounded-md border overflow-hidden text-[10px]">
        <button className={cn('px-2 py-0.5 transition-colors', viewMode === 'weekly' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')} onClick={() => onViewMode('weekly')}>W</button>
        <button className={cn('px-2 py-0.5 transition-colors', viewMode === 'monthly' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')} onClick={() => onViewMode('monthly')}>M</button>
      </div>
      {canWrite && <Badge variant="outline" className="text-[9px] py-0 text-primary border-primary/40">✏ szerkesztés</Badge>}
      {loading && <span className="ml-1 text-[10px] text-muted-foreground animate-pulse">…</span>}
      <span className="ml-auto"><EffectimeLogo size={20} variant="full" /></span>
    </div>
  );
}

function LoadingSkeleton() {
  return <div className="space-y-2 p-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-9 bg-muted animate-pulse rounded" />)}</div>;
}
