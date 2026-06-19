import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { AlertTriangle, Building2, CheckCircle2, ChevronLeft, ChevronRight, Loader2, Plus, Sparkles, Trash2 } from 'lucide-react';
import { EffectimeLogo } from '@/components/EffectimeLogo';
import {
  addMonths, addWeeks, eachDayOfInterval, endOfMonth, endOfWeek,
  format, isWeekend, startOfMonth, startOfWeek, subMonths, subWeeks,
} from 'date-fns';
import { hu } from 'date-fns/locale';
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

const HU_DAYS = ['V', 'H', 'K', 'Sze', 'Cs', 'P', 'Szo'];
const TODAY = format(new Date(), 'yyyy-MM-dd');

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
  const [selected, setSelected] = useState<{ ruleId: string; date: string } | null>(null);
  const [wizardOffice, setWizardOffice] = useState<Office | null>(null);
  const [wizardRunning, setWizardRunning] = useState(false);
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
    toast.success(`${member.display_name} beosztva`);
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

  // Smart suggestion: assign role-matched candidates first, then any available, up to min_headcount.
  const handleSmartSuggest = async (rule: CoverageRule, isoDate: string) => {
    const assigned = shiftsFor(rule, isoDate, shifts);
    const need = rule.min_headcount - assigned.length;
    if (need <= 0) { toast.info('Már teljes a beosztás'); return; }
    const assignedIds = new Set(assigned.map(s => s.user_id));
    const roles = ruleRoles(rule);
    const pool = (data?.members ?? []).filter(m => !assignedIds.has(m.user_id));
    const ranked = [...pool].sort((a, b) => {
      const am = roles.length === 0 || (a.business_role != null && roles.includes(a.business_role)) ? 0 : 1;
      const bm = roles.length === 0 || (b.business_role != null && roles.includes(b.business_role)) ? 0 : 1;
      if (am !== bm) return am - bm;
      const ao = a.office_id === rule.office_id ? 0 : 1;
      const bo = b.office_id === rule.office_id ? 0 : 1;
      return ao - bo;
    });
    const pick = ranked.slice(0, need);
    if (pick.length === 0) { toast.error('Nincs elérhető tag'); return; }
    setSaving(true);
    for (const m of pick) {
      await (supabase as any).rpc('embed_assign_shift', {
        _token: token,
        _user_id: m.user_id,
        _office_id: rule.office_id,
        _business_role: roles[0] ?? m.business_role ?? null,
        _shift_date: isoDate,
        _skill_id: ruleSkillIds(rule)[0] ?? null,
      });
    }
    setSaving(false);
    toast.success(`${pick.length} tag intelligensen beosztva`);
    load();
  };

  // "Intelligens beosztás varázsló" — fills every gap day for every rule of the office across visible range.
  const runOfficeWizard = async (office: Office) => {
    setWizardRunning(true);
    let totalAssigned = 0;
    const officeRules = (data?.coverage_rules ?? []).filter(r => r.office_id === office.id);
    for (const rule of officeRules) {
      for (const d of days) {
        const iso = format(d, 'yyyy-MM-dd');
        const dow = d.getDay();
        if (!ruleAppliesOn(rule, iso, dow)) continue;
        const assigned = shiftsFor(rule, iso, shifts);
        const need = rule.min_headcount - assigned.length;
        if (need <= 0) continue;
        const assignedIds = new Set(assigned.map(s => s.user_id));
        const roles = ruleRoles(rule);
        const pool = (data?.members ?? []).filter(m => !assignedIds.has(m.user_id));
        const ranked = [...pool].sort((a, b) => {
          const am = roles.length === 0 || (a.business_role != null && roles.includes(a.business_role)) ? 0 : 1;
          const bm = roles.length === 0 || (b.business_role != null && roles.includes(b.business_role)) ? 0 : 1;
          if (am !== bm) return am - bm;
          const ao = a.office_id === rule.office_id ? 0 : 1;
          const bo = b.office_id === rule.office_id ? 0 : 1;
          return ao - bo;
        });
        const pick = ranked.slice(0, need);
        for (const m of pick) {
          await (supabase as any).rpc('embed_assign_shift', {
            _token: token, _user_id: m.user_id, _office_id: rule.office_id,
            _business_role: roles[0] ?? m.business_role ?? null,
            _shift_date: iso, _skill_id: ruleSkillIds(rule)[0] ?? null,
          });
          totalAssigned++;
        }
      }
    }
    setWizardRunning(false);
    setWizardOffice(null);
    toast.success(`Varázsló: ${totalAssigned} beosztás generálva (${office.name})`);
    load();
  };



  const WriteSheet = () => {
    const open = !!selected && canWrite;
    const rule = open ? (data?.coverage_rules ?? []).find(r => r.id === selected!.ruleId) : null;
    const office = rule ? offices.find(o => o.id === rule.office_id) : null;
    const assigned = rule && selected ? shiftsFor(rule, selected.date, shifts) : [];
    const assignedIds = new Set(assigned.map(s => s.user_id));
    const available = rule ? (data?.members ?? []).filter(m => !assignedIds.has(m.user_id)) : [];
    const roles = rule ? ruleRoles(rule) : [];
    const ruleName = rule ? (rule.name ?? (roles.join(', ') || `≥${rule.min_headcount} fő`)) : '';
    const dateLabel = selected ? format(new Date(selected.date + 'T00:00:00'), 'yyyy. MMMM d. (EEEE)') : '';
    const isFull = rule ? assigned.length >= rule.min_headcount : false;

    // Slot rows mirror native CoveragePlannerView: one row per required headcount unit.
    const slots: { idx: number; role: string | null }[] = [];
    if (rule) {
      if (roles.length > 0) {
        roles.forEach((r, i) => slots.push({ idx: i, role: r }));
        for (let i = roles.length; i < rule.min_headcount; i++) slots.push({ idx: i, role: null });
      } else {
        for (let i = 0; i < Math.max(1, rule.min_headcount); i++) slots.push({ idx: i, role: null });
      }
    }
    const slotFill = new Map<number, Shift>();
    const remaining = [...assigned];
    slots.forEach(slot => {
      if (slot.role) {
        const idx = remaining.findIndex(s => {
          const m = memberByUserId.get(s.user_id);
          return m?.business_role === slot.role;
        });
        if (idx >= 0) { slotFill.set(slot.idx, remaining[idx]); remaining.splice(idx, 1); }
      }
    });
    slots.forEach(slot => {
      if (slotFill.has(slot.idx)) return;
      if (remaining.length > 0) slotFill.set(slot.idx, remaining.shift()!);
    });
    const overflow = remaining;

    return (
      <Sheet open={open} onOpenChange={(o) => { if (!o) setSelected(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-5">
          {rule && selected && (
            <>
              <SheetHeader className="text-left">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <SheetTitle className="text-xl font-bold truncate">{office?.name ?? ''}</SheetTitle>
                    <SheetDescription className="text-sm font-medium">
                      {ruleName}
                      <span className="block text-xs mt-1 text-muted-foreground">
                        {dateLabel} · min. {rule.min_headcount} fő
                      </span>
                    </SheetDescription>
                  </div>
                  <Badge variant="outline" className={cn(
                    'shrink-0 text-[11px] font-semibold',
                    isFull ? 'border-emerald-300 text-emerald-700 dark:text-emerald-300' : 'border-rose-300 text-rose-700 dark:text-rose-300',
                  )}>
                    {assigned.length}/{rule.min_headcount}
                  </Badge>
                </div>
              </SheetHeader>

              {/* Slot rows */}
              <div className="mt-4 space-y-2">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Beosztva</div>
                <div className="space-y-1.5">
                  {slots.map(slot => {
                    const filled = slotFill.get(slot.idx);
                    const slotLabel = slot.role ?? 'bárki';
                    if (!filled) {
                      return (
                        <div key={slot.idx} className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-dashed bg-muted/30">
                          <span className="text-xs text-muted-foreground">Üres slot</span>
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">{slotLabel}</span>
                        </div>
                      );
                    }
                    const m = memberByUserId.get(filled.user_id);
                    const memberRole = m?.business_role ?? null;
                    const isMatch = slot.role ? memberRole === slot.role : true;
                    return (
                      <div key={slot.idx} className={cn(
                        'flex items-center gap-2 p-2.5 rounded-lg border text-sm',
                        isMatch
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
                          : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800',
                      )}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-sm truncate">{m?.display_name ?? filled.user_id}</span>
                            <span className="text-[10px] uppercase tracking-wider opacity-70 shrink-0">{slotLabel}</span>
                          </div>
                          {!isMatch && memberRole && (
                            <div className="text-[10px] opacity-80 mt-0.5">Tényleges: {memberRole}</div>
                          )}
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" disabled={saving} onClick={() => handleRemove(filled.id)}>
                          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 text-destructive" />}
                        </Button>
                      </div>
                    );
                  })}

                  {overflow.length > 0 && (
                    <div className="pt-2 mt-2 border-t border-dashed">
                      <div className="text-[10px] uppercase text-muted-foreground mb-1">Túl sok beosztva</div>
                      {overflow.map(s => {
                        const m = memberByUserId.get(s.user_id);
                        return (
                          <div key={s.id} className="flex items-center gap-2 p-2 rounded-lg border text-sm bg-amber-50 dark:bg-amber-950/30 border-amber-200">
                            <div className="flex-1 font-medium truncate">{m?.display_name ?? s.user_id}</div>
                            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={saving} onClick={() => handleRemove(s.id)}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="pt-1">
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" disabled={saving || isFull}
                    onClick={() => handleSmartSuggest(rule, selected.date)}>
                    <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                    Intelligens javaslat
                  </Button>
                </div>
              </div>

              {/* Available candidates */}
              <div className="mt-5 space-y-2">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Elérhető tagok ({available.length})
                </div>
                {available.length === 0 ? (
                  <div className="text-xs text-muted-foreground italic">Nincs elérhető tag</div>
                ) : (
                  <div className="space-y-1.5">
                    {available.map(m => {
                      const roleMatch = roles.length === 0 || (m.business_role != null && roles.includes(m.business_role));
                      const sameOffice = m.office_id === rule.office_id;
                      return (
                        <div key={m.user_id} className={cn(
                          'p-2.5 rounded-lg border text-sm',
                          roleMatch ? 'bg-card' : 'bg-muted/30 opacity-90',
                        )}>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{m.display_name}</div>
                              {m.business_role && (
                                <div className="text-[10px] text-muted-foreground truncate">{m.business_role}{sameOffice ? '' : ' · más telephely'}</div>
                              )}
                            </div>
                            {roleMatch && <Badge variant="outline" className="text-[9px] border-emerald-300 text-emerald-700">match</Badge>}
                            <Button size="sm" variant={roleMatch ? 'default' : 'outline'}
                              className="h-7 shrink-0 text-xs px-2.5"
                              disabled={saving} onClick={() => handleAssign(rule, selected.date, m)}>
                              {saving ? <Loader2 className="h-3 w-3" /> : <><Plus className="h-3 w-3 mr-1" />Beoszt</>}
                            </Button>
                          </div>
                          {!roleMatch && roles.length > 0 && (
                            <div className="flex items-center gap-1 mt-1 text-[10px] text-amber-600 dark:text-amber-400">
                              <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
                              <span>Pozíció nem egyezik</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    );
  };

  if (error) return (
    <div className="flex flex-col items-center justify-center h-full min-h-48 text-sm text-destructive p-6 text-center gap-2">
      <AlertTriangle className="h-8 w-8 opacity-60" />
      <p className="font-semibold">Embed token hiba</p>
      <p className="text-xs text-muted-foreground">{error}</p>
    </div>
  );

  const ruleLabel = (r: CoverageRule) => r.name ?? (ruleRoles(r).join(', ') || `≥${r.min_headcount}`);

  // Shared per-office detailed grid (used by BOTH weekly and monthly view).
  // Monthly view scrolls horizontally to expose all 28–31 days per office/rule row,
  // so guest viewers see the same office breakdown + edit affordance as in weekly mode.

  const monthLabel = format(monthStart, 'yyyy. MMMM', { locale: hu });
  const weekLabelForHeader = `${format(days[0], 'yyyy. MMM d.', { locale: hu })} — ${format(days[days.length - 1], 'MMM d.', { locale: hu })}`;

  const isMonthly = viewMode === 'monthly';
  const headerLabel = isMonthly ? monthLabel : weekLabelForHeader;
  const onPrev = isMonthly ? () => setMonthStart(m => subMonths(m, 1)) : () => setWeekStart(w => subWeeks(w, 1));
  const onNext = isMonthly ? () => setMonthStart(m => addMonths(m, 1)) : () => setWeekStart(w => addWeeks(w, 1));

  const goToday = () => { setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 })); setMonthStart(startOfMonth(new Date())); };

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      <Header
        label={headerLabel}
        onPrev={onPrev}
        onNext={onNext}
        onToday={goToday}
        viewMode={viewMode} onViewMode={setViewMode} loading={loading} canWrite={canWrite} />

      {/* Legend — same chips as native CoveragePlannerView */}
      <div className="flex flex-wrap gap-1.5 px-3 py-1.5 border-b bg-card/50 text-[10px] shrink-0">
        <LegendChip className="bg-rose-100 text-rose-700 border-rose-300" label="Hiányos" />
        <LegendChip className="bg-emerald-100 text-emerald-700 border-emerald-300" label="Megfelelő" />
        <LegendChip className="bg-amber-100 text-amber-700 border-amber-300" label="Túl sok" />
        <LegendChip className="bg-zinc-100 text-zinc-500 border-zinc-300" label="N/A" />
      </div>

      <div className="flex-1 overflow-auto min-h-0">
        {loading ? <LoadingSkeleton /> : offices.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-32 gap-2 text-muted-foreground">
            <AlertTriangle className="h-6 w-6 opacity-30" />
            <span className="text-xs">Nincs telephelyi beállítás</span>
          </div>
        ) : (
          <table className={cn('border-collapse text-xs', isMonthly ? 'min-w-max' : 'w-full')}>
            <thead className="sticky top-0 z-10">
              <tr className="bg-muted/30 backdrop-blur-sm">
                <th className="sticky left-0 z-20 bg-muted/30 text-left px-3 py-2 border-b border-r w-[240px] min-w-[240px]">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Telephely / Igény
                  </span>
                </th>
                {days.map(d => {
                  const iso   = format(d, 'yyyy-MM-dd');
                  const isHol = holidaySet.has(iso) || blockedSet.has(iso);
                  const wknd  = isWeekend(d);
                  return (
                    <th key={iso} className={cn(
                      'text-center px-1 py-2 border-b border-r last:border-r-0',
                      isMonthly ? 'min-w-[44px]' : 'min-w-[80px]',
                      isHol  ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300' :
                      wknd   ? 'bg-zinc-50 text-muted-foreground dark:bg-zinc-900/30' : '',
                    )}>
                      <div className="font-semibold capitalize text-xs leading-none">
                        {isMonthly ? format(d, 'd') : format(d, 'EEE', { locale: hu })}
                      </div>
                      <div className="text-[9px] leading-none mt-1 opacity-80">
                        {isMonthly
                          ? format(d, 'EEEEE', { locale: hu })
                          : format(d, 'MMM d.', { locale: hu })}
                      </div>
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
                      className="sticky left-0 bg-card px-3 py-2 border-b border-border/70">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="text-sm font-semibold text-foreground truncate">
                          {office.name}
                        </span>
                        {office.city && (
                          <span className="text-[10px] text-muted-foreground">({office.city})</span>
                        )}
                      </div>
                    </td>
                  </tr>,
                  ...(officeRules.length > 0 ? officeRules.map(rule => (
                    <tr key={rule.id} className="border-b border-border/70">
                      <td className="sticky left-0 bg-background px-3 py-2 border-r border-border/70 w-[240px] min-w-[240px] max-w-[240px]"
                        title={ruleLabel(rule)}>
                        <div className="text-xs font-medium text-foreground truncate">{ruleLabel(rule)}</div>
                        <div className="text-[10px] text-muted-foreground/70 mt-0.5">min. {rule.min_headcount} fő</div>
                      </td>
                      {days.map(d => {
                        const iso = format(d, 'yyyy-MM-dd');
                        const dow = d.getDay();
                        const wknd = isWeekend(d);
                        if (!ruleAppliesOn(rule, iso, dow)) return (
                          <td key={iso} className={cn('border-r border-border/70 last:border-r-0',
                            wknd ? 'bg-zinc-100/45 dark:bg-zinc-900/35' : 'bg-zinc-50/45 dark:bg-zinc-900/25')} />
                        );
                        const cellShifts = shiftsFor(rule, iso, shifts);
                        const have = cellShifts.length;
                        const need = rule.min_headcount;
                        const isGap  = have < need;
                        const isOver = have > need;
                        const tone = isGap
                          ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300'
                          : isOver
                          ? 'bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300'
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300';
                        const isSelected = selected?.ruleId === rule.id && selected?.date === iso;
                        return (
                          <td key={iso} className={cn(
                            'border-r border-border/70 last:border-r-0 px-1 py-1.5 align-middle text-xs font-semibold transition-colors',
                            tone,
                            isSelected && 'ring-2 ring-inset ring-primary',
                            canWrite && 'cursor-pointer')}
                            onClick={canWrite ? () => setSelected({ ruleId: rule.id, date: iso }) : undefined}
                            role={canWrite ? 'button' : undefined}
                            tabIndex={canWrite ? 0 : undefined}
                            onKeyDown={canWrite ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected({ ruleId: rule.id, date: iso }); } } : undefined}
                          >
                            <div className="flex flex-col items-center justify-center gap-0.5">
                              <span className="text-sm">{need} / {have}</span>
                              {isGap
                                ? <AlertTriangle className="h-3 w-3" />
                                : !isOver ? <CheckCircle2 className="h-3 w-3" /> : null}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  )) : [
                    <tr key={`empty-${office.id}`} className="border-b">
                      <td className="sticky left-0 bg-background px-3 py-2 border-r text-xs text-muted-foreground/60 italic"
                        colSpan={days.length + 1}>
                        Nincs kapacitásszabály
                      </td>
                    </tr>,
                  ]),
                ];
              })}
            </tbody>
          </table>
        )}
      </div>
      <WriteSheet />
    </div>
  );
}

function LegendChip({ className, label }: { className: string; label: string }) {
  return (
    <div className={cn('flex items-center gap-1 px-2 py-0.5 rounded border text-[10px]', className)}>
      <span>{label}</span>
    </div>
  );
}


function Header({ label, onPrev, onNext, onToday, viewMode, onViewMode, loading, canWrite }: {
  label: string; onPrev: () => void; onNext: () => void; onToday: () => void;
  viewMode: 'weekly' | 'monthly'; onViewMode: (v: 'weekly' | 'monthly') => void;
  loading: boolean; canWrite: boolean;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b bg-card shrink-0 flex-wrap">
      <div className="flex rounded-md border overflow-hidden text-xs">
        <button type="button"
          className={cn('px-3 py-1.5 transition-colors',
            viewMode === 'weekly' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent')}
          onClick={() => onViewMode('weekly')}>Heti</button>
        <button type="button"
          className={cn('px-3 py-1.5 border-l transition-colors',
            viewMode === 'monthly' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent')}
          onClick={() => onViewMode('monthly')}>Havi</button>
      </div>

      <Button variant="outline" size="icon" className="h-8 w-8" onClick={onPrev}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="font-semibold text-sm min-w-[160px] text-center capitalize">{label}</div>
      <Button variant="outline" size="icon" className="h-8 w-8" onClick={onNext}>
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="sm" className="h-8" onClick={onToday}>
        {viewMode === 'weekly' ? 'Ez a hét' : 'Ez a hónap'}
      </Button>

      {canWrite && (
        <Badge variant="outline" className="text-[9px] py-0 text-primary border-primary/40 ml-1 font-semibold">
          ✏ szerkesztés
        </Badge>
      )}
      {loading && <span className="text-[10px] text-muted-foreground animate-pulse ml-1">…</span>}
      <span className="ml-auto"><EffectimeLogo size={22} variant="full" /></span>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-2 p-4">
      <div className="h-8 w-1/3 bg-muted animate-pulse rounded-lg" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-10 bg-muted animate-pulse rounded-lg" style={{ opacity: 1 - i * 0.15 }} />
      ))}
    </div>
  );
}
