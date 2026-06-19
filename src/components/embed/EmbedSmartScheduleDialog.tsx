/**
 * EmbedSmartScheduleDialog — the embed-safe twin of the native SmartBatchScheduleDialog.
 *
 * Renders the SAME centered modal + full settings set as the native "Intelligens
 * beosztás varázsló" (date range · strategy · keep-existing / include-unmatched ·
 * rule checklist · generate → preview → finalize) and reuses the SAME `smart_batch.*`
 * i18n keys, so guest pages get pixel-parity with effectime.app.
 *
 * The ONLY differences from the native dialog are at the data boundary:
 *   • Data is read through the anonymous token RPC `get_embed_view_data`
 *     (the guest has no authenticated table access).
 *   • Persistence loops the token RPC `embed_assign_shift` instead of a direct
 *     INSERT into enterprise_shift_assignments.
 * The ranking/eligibility engine (lib/coverageEligibility) is reused verbatim, so the
 * suggestions are identical to what the native planner would produce.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n, useDateLocale } from '@/i18n/I18nProvider';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, Loader2, AlertTriangle, CheckCircle2, Users } from 'lucide-react';
import { format, eachDayOfInterval, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { evaluateEligibility, type MemberInput, type EligibilityContext } from '@/lib/coverageEligibility';

interface Office { id: string; name: string; city: string | null }

interface CoverageRule {
  id: string;
  office_id: string;
  name: string | null;
  business_role: string | null;
  business_roles: string[] | null;
  skill_id: string | null;
  skill_ids: string[] | null;
  min_skill_level: number | null;
  min_headcount: number;
  days_of_week: number[] | null;
  rule_date: string | null;
  valid_from: string | null;
  valid_until: string | null;
}

interface EmbedMemberRow {
  user_id: string;
  display_name: string;
  business_role: string | null;
  office_id: string | null;
  membership_id: string;
  weekly_capacity_hours?: number | null;
  base_working_hours?: number | null;
  skills?: { skill_id: string; level: number }[] | null;
  site_priorities?: { office_id: string; priority: number }[] | null;
}

interface EmbedData {
  coverage_rules: CoverageRule[];
  members: EmbedMemberRow[];
  shift_assignments: { user_id: string; office_id: string; shift_date: string }[];
  holidays: string[];
  blocked_dates: string[];
  leave_requests: { user_id: string; start_date: string; end_date: string; status?: string }[];
}

interface PlannedAssignment {
  date: string;
  rule: CoverageRule;
  membership_id: string;
  user_id: string;
  display_name: string;
  business_role: string | null;
  skill_id: string | null;
  matched: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  token: string;
  office: Office;
  defaultStart: Date;
  defaultEnd: Date;
  onCompleted: () => void;
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
function ruleAppliesOn(r: CoverageRule, d: Date): boolean {
  const iso = format(d, 'yyyy-MM-dd');
  if (r.rule_date) return r.rule_date === iso;
  if (r.valid_from && iso < r.valid_from) return false;
  if (r.valid_until && iso > r.valid_until) return false;
  if (r.days_of_week && r.days_of_week.length > 0 && !r.days_of_week.includes(d.getDay())) return false;
  return true;
}

export function EmbedSmartScheduleDialog({ open, onOpenChange, token, office, defaultStart, defaultEnd, onCompleted }: Props) {
  const { t } = useI18n();
  const dateFnsLocale = useDateLocale();

  const [startDate, setStartDate] = useState(format(defaultStart, 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(defaultEnd, 'yyyy-MM-dd'));
  const [selectedRuleIds, setSelectedRuleIds] = useState<Set<string>>(new Set());
  const [strategy, setStrategy] = useState<'role_match_first' | 'load_balanced' | 'priority_first'>('role_match_first');
  const [respectExistingShifts, setRespectExistingShifts] = useState(true);
  const [overwriteUnmatched, setOverwriteUnmatched] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [plan, setPlan] = useState<PlannedAssignment[]>([]);

  const [rawData, setRawData] = useState<EmbedData | null>(null);
  const [fetching, setFetching] = useState(false);
  const didInit = useRef(false);
  const fetchId = useRef(0);

  // Reset transient state each time the dialog opens, and re-seed the date range.
  useEffect(() => {
    if (!open) { didInit.current = false; return; }
    setStartDate(format(defaultStart, 'yyyy-MM-dd'));
    setEndDate(format(defaultEnd, 'yyyy-MM-dd'));
    setPlan([]);
    setStrategy('role_match_first');
    setRespectExistingShifts(true);
    setOverwriteUnmatched(false);
  }, [open, defaultStart, defaultEnd]);

  // (Re)load coverage data for the chosen range via the token RPC. Self-fetching keeps
  // the wizard correct even when the user picks a range wider than the visible grid.
  useEffect(() => {
    if (!open) return;
    const id = ++fetchId.current;
    setFetching(true);
    (supabase as any)
      .rpc('get_embed_view_data', { _token: token, _view: 'capacity_planner', _from_date: startDate, _to_date: endDate })
      .then(({ data, error }: { data: EmbedData | null; error: { message: string } | null }) => {
        if (id !== fetchId.current) return;
        if (error) { toast.error(error.message); setFetching(false); return; }
        setRawData(data);
        setFetching(false);
      });
  }, [open, token, startDate, endDate]);

  const officeRules = useMemo(
    () => (rawData?.coverage_rules ?? []).filter(r => r.office_id === office.id),
    [rawData, office.id],
  );

  // MemberInput[] for the eligibility engine, derived from the enriched RPC payload.
  const members = useMemo<MemberInput[]>(
    () => (rawData?.members ?? []).map(m => ({
      membership_id: m.membership_id,
      user_id: m.user_id,
      display_name: m.display_name,
      business_role: m.business_role,
      weekly_capacity_hours: Number(m.weekly_capacity_hours) || 40,
      base_working_hours: Number(m.base_working_hours) || 8,
      skills: (m.skills ?? []).map(s => ({ skill_id: s.skill_id, level: Number(s.level) || 1 })),
    })),
    [rawData],
  );

  const sitePriorityMap = useMemo(() => {
    const map = new Map<string, number>();
    (rawData?.members ?? []).forEach(m => {
      (m.site_priorities ?? []).forEach(sp => map.set(`${m.membership_id}:${sp.office_id}`, sp.priority));
    });
    return map;
  }, [rawData]);

  const ctx = useMemo<EligibilityContext>(() => ({
    holidaysISO: new Set(rawData?.holidays ?? []),
    blockedDatesISO: new Set(rawData?.blocked_dates ?? []),
    leaves: (rawData?.leave_requests ?? []).map(l => ({
      user_id: l.user_id, start_date: l.start_date, end_date: l.end_date, status: l.status ?? 'approved',
    })),
    shifts: (rawData?.shift_assignments ?? []).map(s => ({
      user_id: s.user_id, office_id: s.office_id, shift_date: s.shift_date,
    })),
  }), [rawData]);

  // Members eligible for THIS office: must have a site-priority entry, unless no
  // priorities are configured anywhere in the workspace (then everyone is eligible).
  const eligibleMembers = useMemo(() => {
    if (sitePriorityMap.size === 0) return members;
    return members.filter(m => sitePriorityMap.has(`${m.membership_id}:${office.id}`));
  }, [members, sitePriorityMap, office.id]);

  // Pre-select all of this office's rules once per open (after first load).
  useEffect(() => {
    if (open && rawData && !didInit.current) {
      setSelectedRuleIds(new Set(officeRules.map(r => r.id)));
      didInit.current = true;
    }
  }, [open, rawData, officeRules]);

  const toggleRule = (id: string) => {
    setSelectedRuleIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const generatePlan = async () => {
    setPlanning(true);
    try {
      let s: Date, e: Date;
      try { s = parseISO(startDate); e = parseISO(endDate); } catch { toast.error(t('smart_batch.invalid_dates')); return; }
      if (s > e) { toast.error(t('smart_batch.start_after_end')); return; }
      if (selectedRuleIds.size === 0) { toast.error(t('smart_batch.no_rule_selected')); return; }

      const days = eachDayOfInterval({ start: s, end: e });
      const usedPerDay = new Map<string, Set<string>>();
      const monthlyLoad = new Map<string, number>();
      ctx.shifts.forEach(sh => {
        const set = usedPerDay.get(sh.shift_date) || new Set<string>();
        set.add(sh.user_id);
        usedPerDay.set(sh.shift_date, set);
        monthlyLoad.set(sh.user_id, (monthlyLoad.get(sh.user_id) || 0) + 1);
      });

      const out: PlannedAssignment[] = [];
      const selRules = officeRules.filter(r => selectedRuleIds.has(r.id));

      for (const day of days) {
        const iso = format(day, 'yyyy-MM-dd');
        for (const rule of selRules) {
          if (!ruleAppliesOn(rule, day)) continue;

          const existingForRuleOffice = ctx.shifts.filter(sh => sh.office_id === office.id && sh.shift_date === iso);
          const alreadyFilled = respectExistingShifts ? existingForRuleOffice.length : 0;
          const need = Math.max(0, rule.min_headcount - alreadyFilled);
          if (need === 0) continue;

          const orderedRoles = ruleRoles(rule);
          const skillIds = ruleSkillIds(rule);
          const slotRoles: (string | null)[] = [];
          for (let i = 0; i < need; i++) slotRoles.push(orderedRoles[alreadyFilled + i] ?? null);

          for (const slotRole of slotRoles) {
            const used = usedPerDay.get(iso) || new Set<string>();
            const ranked = eligibleMembers
              .filter(m => !used.has(m.user_id))
              .map(m => {
                const ev = evaluateEligibility(m, {
                  office_id: office.id,
                  shift_date: iso,
                  business_roles: slotRole ? [slotRole] : ruleRoles(rule),
                  skill_ids: skillIds,
                  min_skill_level: rule.min_skill_level,
                }, ctx);
                return { m, ev };
              })
              .filter(x => x.ev.isEligible)
              .sort((a, b) => {
                const aRoleMatch = slotRole && a.m.business_role === slotRole ? 0 : 1;
                const bRoleMatch = slotRole && b.m.business_role === slotRole ? 0 : 1;
                const aPrio = sitePriorityMap.get(`${a.m.membership_id}:${office.id}`) ?? 99;
                const bPrio = sitePriorityMap.get(`${b.m.membership_id}:${office.id}`) ?? 99;
                const aLoad = monthlyLoad.get(a.m.user_id) || 0;
                const bLoad = monthlyLoad.get(b.m.user_id) || 0;

                if (strategy === 'role_match_first') {
                  if (aRoleMatch !== bRoleMatch) return aRoleMatch - bRoleMatch;
                  if (aPrio !== bPrio) return aPrio - bPrio;
                  if (aLoad !== bLoad) return aLoad - bLoad;
                } else if (strategy === 'priority_first') {
                  if (aPrio !== bPrio) return aPrio - bPrio;
                  if (aRoleMatch !== bRoleMatch) return aRoleMatch - bRoleMatch;
                  if (aLoad !== bLoad) return aLoad - bLoad;
                } else {
                  if (aLoad !== bLoad) return aLoad - bLoad;
                  if (aRoleMatch !== bRoleMatch) return aRoleMatch - bRoleMatch;
                  if (aPrio !== bPrio) return aPrio - bPrio;
                }
                return b.ev.matchScore - a.ev.matchScore;
              });

            let pick = ranked[0];
            const matched = pick ? (slotRole ? pick.m.business_role === slotRole : true) : false;
            if (!pick && overwriteUnmatched) {
              const fallbackRanked = members
                .filter(m => !used.has(m.user_id))
                .map(m => ({ m, ev: evaluateEligibility(m, { office_id: office.id, shift_date: iso }, ctx) }))
                .filter(x => x.ev.isEligible)
                .sort((a, b) => (monthlyLoad.get(a.m.user_id) || 0) - (monthlyLoad.get(b.m.user_id) || 0));
              pick = fallbackRanked[0];
            }
            if (!pick) continue;

            const usedSet = usedPerDay.get(iso) || new Set<string>();
            usedSet.add(pick.m.user_id);
            usedPerDay.set(iso, usedSet);
            monthlyLoad.set(pick.m.user_id, (monthlyLoad.get(pick.m.user_id) || 0) + 1);

            out.push({
              date: iso,
              rule,
              membership_id: pick.m.membership_id,
              user_id: pick.m.user_id,
              display_name: pick.m.display_name,
              business_role: slotRole ?? pick.m.business_role ?? null,
              skill_id: skillIds[0] ?? null,
              matched,
            });
          }
        }
      }

      setPlan(out);
      if (out.length === 0) toast.message(t('smart_batch.no_suggestion'));
      else toast.success(t('smart_batch.suggestions_generated', { count: out.length }));
    } finally {
      setPlanning(false);
    }
  };

  // Persist through the token RPC (one call per planned slot). The RPC upserts on
  // (workspace_id, user_id, shift_date), so re-running is idempotent per day.
  const persist = async () => {
    if (plan.length === 0) return;
    setSaving(true);
    setSaveProgress(0);
    try {
      let done = 0;
      let failed = 0;
      let firstError: string | null = null;
      for (const p of plan) {
        const { error } = await (supabase as any).rpc('embed_assign_shift', {
          _token:         token,
          _user_id:       p.user_id,
          _office_id:     office.id,
          _business_role: p.business_role,
          _shift_date:    p.date,
          _skill_id:      p.skill_id,
        });
        if (error) { failed++; if (!firstError) firstError = error.message; }
        done++;
        setSaveProgress(done);
      }
      if (failed > 0) {
        toast.error(t('smart_batch.save_error_chunk', { from: plan.length - failed, to: plan.length, msg: firstError ?? '' }));
      }
      if (failed < plan.length) {
        toast.success(t('smart_batch.schedules_finalized', { count: plan.length - failed }));
      }
      onCompleted();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const planByDay = useMemo(() => {
    const map = new Map<string, PlannedAssignment[]>();
    plan.forEach(p => {
      const arr = map.get(p.date) || [];
      arr.push(p);
      map.set(p.date, arr);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [plan]);

  const matchedCount = plan.filter(p => p.matched).length;
  const mismatchCount = plan.length - matchedCount;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !saving) onOpenChange(false); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {t('smart_batch.wizard_title')}
          </DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{office.name}</span>
            {office.city && <span className="text-muted-foreground"> ({office.city})</span>}
            <span className="block text-xs mt-0.5">{t('smart_batch.wizard_desc')}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">{t('smart_batch.period_start_label')}</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-8" />
            </div>
            <div>
              <Label className="text-xs">{t('smart_batch.period_end_label')}</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-8" />
            </div>
          </div>

          {/* Strategy */}
          <div>
            <Label className="text-xs">{t('smart_batch.strategy_label')}</Label>
            <Select value={strategy} onValueChange={v => setStrategy(v as any)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="role_match_first">{t('smart_batch.strategy_role_first')}</SelectItem>
                <SelectItem value="priority_first">{t('smart_batch.strategy_priority_first')}</SelectItem>
                <SelectItem value="load_balanced">{t('smart_batch.strategy_load_balanced')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Options */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <Checkbox checked={respectExistingShifts} onCheckedChange={v => setRespectExistingShifts(!!v)} />
              <span>{t('smart_batch.opt_keep_existing')}</span>
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <Checkbox checked={overwriteUnmatched} onCheckedChange={v => setOverwriteUnmatched(!!v)} />
              <span>{t('smart_batch.opt_include_unmatched')}</span>
            </label>
          </div>

          {/* Rules */}
          <div>
            <Label className="text-xs flex items-center justify-between mb-1">
              <span>{t('smart_batch.rules_label', { selected: selectedRuleIds.size, total: officeRules.length })}</span>
              <button
                type="button"
                className="text-[10px] text-primary hover:underline"
                onClick={() => setSelectedRuleIds(prev => prev.size === officeRules.length ? new Set() : new Set(officeRules.map(r => r.id)))}
              >
                {selectedRuleIds.size === officeRules.length ? t('smart_batch.none_selected_label') : t('smart_batch.all_selected_label')}
              </button>
            </Label>
            <div className="border rounded-md max-h-32 overflow-y-auto divide-y">
              {fetching && officeRules.length === 0 ? (
                <div className="p-3 text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> …</div>
              ) : officeRules.length === 0 ? (
                <div className="p-3 text-xs text-muted-foreground italic">{t('smart_batch.no_rules')}</div>
              ) : officeRules.map(r => (
                <label key={r.id} className="flex items-center gap-2 p-2 text-xs cursor-pointer hover:bg-accent/50">
                  <Checkbox checked={selectedRuleIds.has(r.id)} onCheckedChange={() => toggleRule(r.id)} />
                  <span className="flex-1">
                    <span className="font-medium">{r.name || t('smart_batch.unnamed_rule')}</span>
                    <span className="ml-2 text-muted-foreground">
                      {t('smart_batch.min_headcount', { count: r.min_headcount })}{ruleRoles(r).length > 0 ? ` · ${ruleRoles(r).join(', ')}` : ''}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <Button onClick={generatePlan} disabled={planning || fetching} className="w-full">
            {(planning || fetching) ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            {t('smart_batch.generate_btn')}
          </Button>

          {/* Preview */}
          {plan.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs flex-wrap">
                <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> {t('smart_batch.matched_badge', { count: matchedCount })}
                </Badge>
                {mismatchCount > 0 && (
                  <Badge variant="outline" className="bg-amber-500/15 text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="h-3 w-3 mr-1" /> {t('smart_batch.mismatched_badge', { count: mismatchCount })}
                  </Badge>
                )}
                <Badge variant="outline">
                  <Users className="h-3 w-3 mr-1" /> {t('smart_batch.members_badge', { count: new Set(plan.map(p => p.user_id)).size })}
                </Badge>
              </div>
              <ScrollArea className="border rounded-md max-h-64">
                <div className="divide-y">
                  {planByDay.map(([day, items]) => (
                    <div key={day} className="p-2">
                      <div className="text-[11px] font-semibold text-muted-foreground mb-1">
                        {format(parseISO(day), 'yyyy. MMM d. (EEEE)', { locale: dateFnsLocale })}
                      </div>
                      <div className="space-y-1">
                        {items.map((p, i) => (
                          <div
                            key={`${day}-${i}`}
                            className={cn(
                              'flex items-center gap-2 text-xs p-1.5 rounded border',
                              p.matched
                                ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40'
                                : 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40',
                            )}
                          >
                            <span className="flex-1 font-medium">{p.display_name}</span>
                            <Badge variant="outline" className="text-[9px]">{p.business_role || t('smart_batch.any_role')}</Badge>
                            <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{p.rule.name || t('smart_batch.rule_fallback')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-3 mt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>{t('common.cancel')}</Button>
          <Button onClick={persist} disabled={plan.length === 0 || saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
            {saving
              ? t('smart_batch.finalize_btn', { count: `${saveProgress}/${plan.length}` })
              : t('smart_batch.finalize_btn', { count: plan.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
