import { useEffect, useMemo, useState } from 'react';
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

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  workspaceId: string;
  userId: string;
  office: Office;
  rules: CoverageRule[];
  members: MemberInput[];
  ctx: EligibilityContext;
  sitePriorityMap: Map<string, number>; // key: `${membership_id}:${office_id}`
  defaultStart: Date;
  defaultEnd: Date;
  onCompleted: () => void;
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
  warning?: string;
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

export function SmartBatchScheduleDialog(props: Props) {
  const { t } = useI18n();
  const dateFnsLocale = useDateLocale();
  const { open, onOpenChange, workspaceId, userId, office, rules, members, ctx, sitePriorityMap, defaultStart, defaultEnd, onCompleted } = props;

  const [startDate, setStartDate] = useState(format(defaultStart, 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(defaultEnd, 'yyyy-MM-dd'));
  const [selectedRuleIds, setSelectedRuleIds] = useState<Set<string>>(new Set());
  const [strategy, setStrategy] = useState<'role_match_first' | 'load_balanced' | 'priority_first'>('role_match_first');
  const [respectExistingShifts, setRespectExistingShifts] = useState(true);
  const [overwriteUnmatched, setOverwriteUnmatched] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [plan, setPlan] = useState<PlannedAssignment[]>([]);

  const officeRules = useMemo(() => rules.filter(r => r.office_id === office.id), [rules, office.id]);

  // Eligible members for THIS office: must have a site priority entry (if any priorities are configured at all in workspace)
  const eligibleMembers = useMemo(() => {
    if (sitePriorityMap.size === 0) return members; // no priorities configured anywhere → everyone eligible
    return members.filter(m => sitePriorityMap.has(`${m.membership_id}:${office.id}`));
  }, [members, sitePriorityMap, office.id]);

  useEffect(() => {
    if (open) {
      // pre-select all rules for this office by default
      setSelectedRuleIds(new Set(officeRules.map(r => r.id)));
      setPlan([]);
    }
  }, [open, officeRules]);

  useEffect(() => {
    if (!open) return;
    setStartDate(format(defaultStart, 'yyyy-MM-dd'));
    setEndDate(format(defaultEnd, 'yyyy-MM-dd'));
  }, [open, defaultStart, defaultEnd]);

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
      const usedPerDay = new Map<string, Set<string>>(); // iso -> set of user_ids already planned/assigned that day anywhere
      const monthlyLoad = new Map<string, number>();
      // Seed with already-existing shifts so we don't double-book
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

          // existing supply for this rule on this day
          const existingForRuleOffice = ctx.shifts.filter(sh => sh.office_id === office.id && sh.shift_date === iso);
          const alreadyFilled = respectExistingShifts ? existingForRuleOffice.length : 0;
          const need = Math.max(0, rule.min_headcount - alreadyFilled);
          if (need === 0) continue;

          const orderedRoles = ruleRoles(rule);
          const skillIds = ruleSkillIds(rule);
          const slotRoles: (string | null)[] = [];
          for (let i = 0; i < need; i++) {
            slotRoles.push(orderedRoles[alreadyFilled + i] ?? null);
          }

          for (const slotRole of slotRoles) {
            // Build candidate pool
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
                  // load_balanced
                  if (aLoad !== bLoad) return aLoad - bLoad;
                  if (aRoleMatch !== bRoleMatch) return aRoleMatch - bRoleMatch;
                  if (aPrio !== bPrio) return aPrio - bPrio;
                }
                return b.ev.matchScore - a.ev.matchScore;
              });

            let pick = ranked[0];
            const matched = pick ? (slotRole ? pick.m.business_role === slotRole : true) : false;
            if (!pick && overwriteUnmatched) {
              // fallback: any eligible without site priority restriction (still respecting leave/double-book)
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
              warning: matched ? undefined : (slotRole ? t('smart_batch.pos_mismatch_warning', { current: pick.m.business_role || '—', expected: slotRole }) : undefined),
            });
          }
        }
      }

      setPlan(out);
      if (out.length === 0) {
        toast.message(t('smart_batch.no_suggestion'));
      } else {
        toast.success(t('smart_batch.suggestions_generated', { count: out.length }));
      }
    } finally {
      setPlanning(false);
    }
  };

  const persist = async () => {
    if (plan.length === 0) return;
    setSaving(true);
    try {
      const rows = plan.map(p => ({
        workspace_id: workspaceId,
        membership_id: p.membership_id,
        user_id: p.user_id,
        office_id: office.id,
        business_role: p.business_role,
        skill_id: p.skill_id,
        shift_date: p.date,
        created_by: userId,
      }));
      // chunk by 200 rows to be safe
      for (let i = 0; i < rows.length; i += 200) {
        const chunk = rows.slice(i, i + 200);
        const { error } = await (supabase as any).from('enterprise_shift_assignments').insert(chunk);
        if (error) {
          toast.error(t('smart_batch.save_error_chunk', { from: i, to: i + chunk.length, msg: error.message }));
          return;
        }
      }
      toast.success(t('smart_batch.schedules_finalized', { count: rows.length }));
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {t('smart_batch.wizard_title')}
          </DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{office.name}</span>
            {office.city && <span className="text-muted-foreground"> ({office.city})</span>}
            <span className="block text-xs mt-0.5">
              {t('smart_batch.wizard_desc')}
            </span>
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
              {officeRules.length === 0 ? (
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

          <Button onClick={generatePlan} disabled={planning} className="w-full">
            {planning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            {t('smart_batch.generate_btn')}
          </Button>

          {/* Preview */}
          {plan.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs">
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
            {t('smart_batch.finalize_btn', { count: plan.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
