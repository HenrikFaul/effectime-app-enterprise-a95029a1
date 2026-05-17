import { useEffect, useMemo, useState, useCallback, useRef, type DragEvent } from 'react';
import { useI18n } from '@/i18n/I18nProvider';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import {
  ChevronLeft, ChevronRight, ChevronDown, AlertTriangle, CheckCircle2, X, Plus, Trash2, Building2, Wand2, Megaphone, Settings2,
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  addDays, addMonths, addWeeks, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay,
  isWeekend, startOfMonth, startOfWeek, subMonths, subWeeks,
} from 'date-fns';
import { hu } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { rankCandidates, type MemberInput, type EligibilityContext, type RequirementInput } from '@/lib/coverageEligibility';
import { SmartBatchScheduleDialog } from './SmartBatchScheduleDialog';
import { OpenShiftManager } from './OpenShiftManager';
import { OfficeCoverageRuleManager } from '../OfficeCoverageRuleManager';
import { useOpenShiftRequests } from '@/hooks/useOpenShifts';

interface Props {
  workspaceId: string;
  userId: string;
}

interface Office { id: string; name: string; city: string | null }
interface CoverageRule {
  id: string;
  office_id: string;
  name: string | null;
  // Legacy single-value (backward compat)
  business_role: string | null;
  skill_id: string | null;
  min_skill_level: number | null;
  // Multi-value (new)
  business_roles: string[] | null;
  skill_ids: string[] | null;
  min_headcount: number;
  days_of_week: number[] | null;
  rule_date: string | null;
  valid_from: string | null;
  valid_until: string | null;
}
interface Shift {
  id: string;
  user_id: string;
  membership_id: string;
  office_id: string;
  business_role: string | null;
  skill_id: string | null;
  shift_date: string;
}
interface Skill { id: string; name: string }

interface DraftAssignment {
  id: string;
  member: MemberInput;
  targetRole: string | null;
  targetSkillId: string | null;
  matched: boolean;
}

interface MemberSitePriority {
  membership_id: string;
  office_id: string;
  priority: number;
}

// Canonical getters: prefer new array fields, fall back to legacy single fields
function ruleRoles(r: CoverageRule): string[] {
  if (r.business_roles && r.business_roles.length > 0) return r.business_roles;
  if (r.business_role) return [r.business_role];
  return [];
}
function ruleSkillIds(r: CoverageRule): string[] {
  if (r.skill_ids && r.skill_ids.length > 0) return r.skill_ids;
  if (r.skill_id) return [r.skill_id];
  return [];
}

type ViewMode = 'weekly' | 'monthly';

export function CoveragePlannerView({ workspaceId, userId }: Props) {
  const { t } = useI18n();
  const [viewMode, setViewMode] = useState<ViewMode>('weekly');
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [offices, setOffices] = useState<Office[]>([]);
  const [rules, setRules] = useState<CoverageRule[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [members, setMembers] = useState<MemberInput[]>([]);
  const [memberOfficeMap, setMemberOfficeMap] = useState<Map<string, string | null>>(new Map());
  const [memberSitePriorityMap, setMemberSitePriorityMap] = useState<Map<string, number>>(new Map());
  const [skills, setSkills] = useState<Skill[]>([]);
  const [holidays, setHolidays] = useState<string[]>([]);
  const [blocked, setBlocked] = useState<string[]>([]);
  const [leaves, setLeaves] = useState<{ user_id: string; start_date: string; end_date: string; status: string }[]>([]);
  const [availabilityByDate, setAvailabilityByDate] = useState<Map<string, Set<string>>>(new Map());
  const [loading, setLoading] = useState(true);
  const loadIdRef = useRef(0);

  const [rulesOpen, setRulesOpen] = useState(false);
  const { data: openShiftRequests = [] } = useOpenShiftRequests(workspaceId);

  const [drawerCell, setDrawerCell] = useState<null | { office: Office; rule: CoverageRule; date: Date }>(null);
  const [openShiftCell, setOpenShiftCell] = useState<null | { office: Office; date: Date }>(null);
  const [draftAssignments, setDraftAssignments] = useState<DraftAssignment[]>([]);
  const [pendingSuggestion, setPendingSuggestion] = useState(false);
  const [batchDialogOffice, setBatchDialogOffice] = useState<Office | null>(null);

  useEffect(() => {
    setDraftAssignments([]);
    setPendingSuggestion(false);
  }, [drawerCell?.office.id, drawerCell?.rule.id, drawerCell?.date?.toISOString()]);

  const days = useMemo(() => {
    if (viewMode === 'weekly') {
      return eachDayOfInterval({ start: weekStart, end: endOfWeek(weekStart, { weekStartsOn: 1 }) });
    }
    return eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  }, [viewMode, weekStart, month]);

  const load = useCallback(async () => {
    const loadId = ++loadIdRef.current;
    setLoading(true);
    const from = format(days[0], 'yyyy-MM-dd');
    const to = format(days[days.length - 1], 'yyyy-MM-dd');

    try {
      const [oRes, rRes, sRes, mRes, mskRes, spRes, sklRes, hRes, bRes, lRes, avRes] = await Promise.all([
        (supabase as any).from('enterprise_offices').select('id,name,city').eq('workspace_id', workspaceId).order('name'),
        (supabase as any).from('enterprise_office_coverage_rules').select('*').eq('workspace_id', workspaceId).eq('status', 'active'),
        (supabase as any).from('enterprise_shift_assignments').select('*').eq('workspace_id', workspaceId).gte('shift_date', from).lte('shift_date', to),
        (supabase as any).from('enterprise_memberships').select('id,user_id,business_role,office_id,weekly_capacity_hours,base_working_hours').eq('workspace_id', workspaceId).eq('status', 'active'),
        (supabase as any).from('enterprise_member_skills').select('membership_id,skill_id,level').eq('workspace_id', workspaceId),
        (supabase as any).from('enterprise_member_site_priorities').select('membership_id,office_id,priority').eq('workspace_id', workspaceId),
        (supabase as any).from('enterprise_skills').select('id,name').eq('workspace_id', workspaceId),
        (supabase as any).from('enterprise_holidays').select('holiday_date').eq('workspace_id', workspaceId).gte('holiday_date', from).lte('holiday_date', to),
        (supabase as any).from('enterprise_blocked_dates').select('blocked_date').eq('workspace_id', workspaceId).gte('blocked_date', from).lte('blocked_date', to),
        (supabase as any).from('leave_requests').select('user_id,start_date,end_date,status').eq('workspace_id', workspaceId).in('status', ['approved', 'pending']).lte('start_date', to).gte('end_date', from),
        (supabase as any).from('enterprise_staff_availability').select('user_id,availability_date,status').eq('workspace_id', workspaceId).gte('availability_date', from).lte('availability_date', to).in('status', ['available', 'preferred']),
      ]);

      if (loadId !== loadIdRef.current) return;

      setOffices((oRes.data || []) as Office[]);
      setRules((rRes.data || []) as CoverageRule[]);
      setShifts((sRes.data || []) as Shift[]);
      setSkills((sklRes.data || []) as Skill[]);
      setHolidays(((hRes.data || []) as any[]).map(h => h.holiday_date));
      setBlocked(((bRes.data || []) as any[]).map(b => b.blocked_date));
      setLeaves((lRes.data || []) as any[]);

      // Build availabilityByDate: date → Set<user_id>
      const avMap = new Map<string, Set<string>>();
      ((avRes.data || []) as any[]).forEach((row: any) => {
        const s = avMap.get(row.availability_date) ?? new Set<string>();
        s.add(row.user_id);
        avMap.set(row.availability_date, s);
      });
      setAvailabilityByDate(avMap);

      const memRows = (mRes.data || []) as any[];
      const userIds = memRows.map(m => m.user_id);
      let nameMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profs } = await (supabase as any).from('profiles').select('user_id,display_name').in('user_id', userIds);
        if (loadId !== loadIdRef.current) return;
        (profs || []).forEach((p: any) => { nameMap[p.user_id] = p.display_name || t('coverage_planner.user_fallback'); });
      }
      const skillsByMembership = new Map<string, { skill_id: string; level: number }[]>();
      ((mskRes.data || []) as any[]).forEach((s: any) => {
        const arr = skillsByMembership.get(s.membership_id) || [];
        arr.push({ skill_id: s.skill_id, level: s.level });
        skillsByMembership.set(s.membership_id, arr);
      });

      const memInputs: MemberInput[] = memRows.map(m => ({
        membership_id: m.id,
        user_id: m.user_id,
        display_name: nameMap[m.user_id] || t('coverage_planner.user_fallback'),
        business_role: m.business_role,
        weekly_capacity_hours: Number(m.weekly_capacity_hours) || 40,
        base_working_hours: Number(m.base_working_hours) || 8,
        skills: skillsByMembership.get(m.id) || [],
      }));
      setMembers(memInputs);
      const mom = new Map<string, string | null>();
      memRows.forEach(m => mom.set(m.user_id, m.office_id || null));
      setMemberOfficeMap(mom);

      const priorityMap = new Map<string, number>();
      ((spRes.data || []) as MemberSitePriority[]).forEach((sp) => {
        priorityMap.set(`${sp.membership_id}:${sp.office_id}`, sp.priority);
      });
      setMemberSitePriorityMap(priorityMap);
    } finally {
      if (loadId === loadIdRef.current) setLoading(false);
    }
  }, [workspaceId, days]);

  useEffect(() => { load(); }, [load]);

  const isoDow = (d: Date) => d.getDay();

  const ruleAppliesOn = (r: CoverageRule, d: Date): boolean => {
    const iso = format(d, 'yyyy-MM-dd');
    if (r.rule_date) return r.rule_date === iso;
    if (r.valid_from && iso < r.valid_from) return false;
    if (r.valid_until && iso > r.valid_until) return false;
    if (r.days_of_week && r.days_of_week.length > 0 && !r.days_of_week.includes(isoDow(d))) return false;
    return true;
  };

  const rulesByOffice = useMemo(() => {
    const map = new Map<string, CoverageRule[]>();
    offices.forEach(o => map.set(o.id, []));
    rules.forEach(r => {
      const arr = map.get(r.office_id) || [];
      arr.push(r);
      map.set(r.office_id, arr);
    });
    return map;
  }, [rules, offices]);

  // Count shifts matching any of the rule's positions/skills on a given date
  const supplyFor = useCallback((rule: CoverageRule, d: Date): Shift[] => {
    const iso = format(d, 'yyyy-MM-dd');
    const roles = ruleRoles(rule);
    const skillIds = ruleSkillIds(rule);
    return shifts.filter(s => {
      if (s.office_id !== rule.office_id) return false;
      if (s.shift_date !== iso) return false;
      // Match if shift's role is in rule's roles OR shift's skill is in rule's skills
      const roleMatch = roles.length === 0 || (s.business_role != null && roles.includes(s.business_role));
      const skillMatch = skillIds.length === 0 || (s.skill_id != null && skillIds.includes(s.skill_id));
      // If rule has both roles and skills, shift must match at least one dimension
      if (roles.length > 0 && skillIds.length > 0) return roleMatch || skillMatch;
      if (roles.length > 0) return roleMatch;
      if (skillIds.length > 0) return skillMatch;
      return true;
    });
  }, [shifts]);

  const ctxFor = useCallback((): EligibilityContext => ({
    holidaysISO: new Set(holidays),
    blockedDatesISO: new Set(blocked),
    leaves,
    shifts,
    availabilityByDate,
  }), [holidays, blocked, leaves, shifts, availabilityByDate]);

  const assignMember = async (member: MemberInput, rule: CoverageRule, date: Date) => {
    const iso = format(date, 'yyyy-MM-dd');
    const roles = ruleRoles(rule);
    const skillIds = ruleSkillIds(rule);
    const payload = {
      workspace_id: workspaceId,
      membership_id: member.membership_id,
      user_id: member.user_id,
      office_id: rule.office_id,
      business_role: roles.length > 0 ? (member.business_role && roles.includes(member.business_role) ? member.business_role : roles[0]) : null,
      skill_id: skillIds.length > 0 ? skillIds[0] : null,
      shift_date: iso,
      created_by: userId,
    };
    const { error } = await (supabase as any).from('enterprise_shift_assignments').insert(payload);
    if (error) { toast.error(t('coverage_planner.assign_error', { msg: error.message })); return; }
    toast.success(t('coverage_planner.member_assigned_toast', { name: member.display_name, date: iso }));
    load();
  };

  const createDraftFromMember = useCallback((member: MemberInput, rule: CoverageRule): DraftAssignment => {
    const roles = ruleRoles(rule);
    const skillIds = ruleSkillIds(rule);
    const targetRole = roles.length === 0 ? member.business_role ?? null : (member.business_role && roles.includes(member.business_role) ? member.business_role : roles[0]);
    const targetSkillId = skillIds.find((sid) => member.skills.some((s) => s.skill_id === sid)) ?? skillIds[0] ?? null;
    const roleMatch = roles.length === 0 || !!(member.business_role && roles.includes(member.business_role));
    const skillMatch = skillIds.length === 0 || member.skills.some((s) => skillIds.includes(s.skill_id));
    return {
      id: `${member.membership_id}-${Date.now()}`,
      member,
      targetRole,
      targetSkillId,
      matched: roleMatch || skillMatch,
    };
  }, []);

  const persistDraftAssignments = useCallback(async () => {
    if (!drawerCell || draftAssignments.length === 0) return;
    const iso = format(drawerCell.date, 'yyyy-MM-dd');
    const payload = draftAssignments.map((draft) => ({
      workspace_id: workspaceId,
      membership_id: draft.member.membership_id,
      user_id: draft.member.user_id,
      office_id: drawerCell.rule.office_id,
      business_role: draft.targetRole,
      skill_id: draft.targetSkillId,
      shift_date: iso,
      created_by: userId,
    }));
    const { error } = await (supabase as any).from('enterprise_shift_assignments').insert(payload);
    if (error) {
      toast.error(t('coverage_planner.save_error', { msg: error.message }));
      return;
    }
    setDraftAssignments([]);
    setPendingSuggestion(false);
    toast.success(t('coverage_planner.confirm_success'));
    load();
  }, [drawerCell, draftAssignments, workspaceId, userId, load]);

  const unassign = async (shiftId: string) => {
    const { error } = await (supabase as any).from('enterprise_shift_assignments').delete().eq('id', shiftId);
    if (error) { toast.error(t('coverage_planner.delete_failed')); return; }
    toast.success(t('coverage_planner.schedule_deleted'));
    load();
  };

  const candidates = useMemo(() => {
    if (!drawerCell) return [];
    const rule = drawerCell.rule;
    const req: RequirementInput = {
      business_roles: ruleRoles(rule),
      skill_ids: ruleSkillIds(rule),
      min_skill_level: rule.min_skill_level,
      shift_date: format(drawerCell.date, 'yyyy-MM-dd'),
      office_id: drawerCell.office.id,
    };
    return rankCandidates(members, req, ctxFor());
  }, [drawerCell, members, ctxFor]);

  const activeAssignedForDrawer = useMemo(() => {
    if (!drawerCell) return [] as Shift[];
    return supplyFor(drawerCell.rule, drawerCell.date);
  }, [drawerCell, supplyFor]);

  const unavailableUserIds = useMemo(() => {
    const ids = new Set<string>();
    activeAssignedForDrawer.forEach((s) => ids.add(s.user_id));
    draftAssignments.forEach((d) => ids.add(d.member.user_id));
    return ids;
  }, [activeAssignedForDrawer, draftAssignments]);

  const availableCandidates = useMemo(() => {
    const officeId = drawerCell?.office.id ?? null;
    return candidates.filter((c) => {
      if (unavailableUserIds.has(c.member.user_id)) return false;
      // Phase II: explicit allowed-site priority list has precedence.
      if (officeId && memberSitePriorityMap.size > 0) {
        return memberSitePriorityMap.has(`${c.member.membership_id}:${officeId}`);
      }
      // Legacy fallback: Only show members whose primary office matches OR who have no office set (global pool)
      const memberOffice = memberOfficeMap.get(c.member.user_id) ?? null;
      if (officeId && memberOffice && memberOffice !== officeId) return false;
      return true;
    });
  }, [candidates, unavailableUserIds, drawerCell, memberOfficeMap, memberSitePriorityMap]);

  const monthlyShiftCountByUser = useMemo(() => {
    if (!drawerCell) return new Map<string, number>();
    const y = drawerCell.date.getFullYear();
    const m = drawerCell.date.getMonth();
    const map = new Map<string, number>();
    shifts.forEach((s) => {
      const sd = new Date(`${s.shift_date}T00:00:00`);
      if (sd.getFullYear() === y && sd.getMonth() === m) {
        map.set(s.user_id, (map.get(s.user_id) || 0) + 1);
      }
    });
    return map;
  }, [drawerCell, shifts]);

  const suggestOptimal = useCallback(() => {
    if (!drawerCell) return;
    const filledCount = activeAssignedForDrawer.length;
    const totalNeeded = drawerCell.rule.min_headcount;
    if (filledCount >= totalNeeded) {
      toast.message(t('coverage_planner.min_met'));
      return;
    }

    // Build ordered slot roles for the UNFILLED slots only
    const orderedRoles = ruleRoles(drawerCell.rule);
    // Skip already-filled slots, then take however many remain
    const remainingSlotRoles = orderedRoles.length > 0
      ? orderedRoles.slice(filledCount, totalNeeded)
      : Array.from({ length: totalNeeded - filledCount }, () => null as string | null);
    // Pad with null if min_headcount exceeds defined role entries
    while (remainingSlotRoles.length < totalNeeded - filledCount) remainingSlotRoles.push(null);

    const usedIds = new Set<string>();
    const picks: DraftAssignment[] = [];

    for (const slotRole of remainingSlotRoles) {
      // 1st priority: eligible + exact role match for this slot
      const sortedPool = availableCandidates
        .filter((c) => c.isEligible && !usedIds.has(c.member.user_id))
        .sort((a, b) => {
          const aRole = slotRole && a.member.business_role === slotRole ? 0 : 1;
          const bRole = slotRole && b.member.business_role === slotRole ? 0 : 1;
          if (aRole !== bRole) return aRole - bRole;
          const officeId = drawerCell.office.id;
          const aPriority = memberSitePriorityMap.get(`${a.member.membership_id}:${officeId}`) ?? 99;
          const bPriority = memberSitePriorityMap.get(`${b.member.membership_id}:${officeId}`) ?? 99;
          if (aPriority !== bPriority) return aPriority - bPriority;
          const aLoad = monthlyShiftCountByUser.get(a.member.user_id) ?? 0;
          const bLoad = monthlyShiftCountByUser.get(b.member.user_id) ?? 0;
          if (aLoad !== bLoad) return aLoad - bLoad;
          return b.matchScore - a.matchScore;
        });
      const pick = sortedPool[0];
      if (pick) {
        usedIds.add(pick.member.user_id);
        picks.push(createDraftFromMember(pick.member, drawerCell.rule));
      }
    }

    if (picks.length === 0) {
      toast.error(t('coverage_planner.no_available_member'));
      return;
    }
    setDraftAssignments(picks);
    setPendingSuggestion(true);
  }, [drawerCell, activeAssignedForDrawer.length, availableCandidates, createDraftFromMember, memberSitePriorityMap, monthlyShiftCountByUser]);

  const onDragStartCandidate = (memberId: string) => (e: DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData('text/member-id', memberId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDropToAssigned = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!drawerCell) return;
    const memberId = e.dataTransfer.getData('text/member-id');
    if (!memberId) return;
    const picked = availableCandidates.find((c) => c.member.membership_id === memberId);
    if (!picked) return;
    await assignMember(picked.member, drawerCell.rule, drawerCell.date);
  };

  const skillName = (id: string | null) => id ? (skills.find(s => s.id === id)?.name || '—') : null;

  const ruleLabel = (rule: CoverageRule) => {
    const roles = ruleRoles(rule);
    const skillIds = ruleSkillIds(rule);
    const parts = [
      ...roles,
      ...skillIds.map(sid => skillName(sid)).filter(Boolean),
    ];
    return parts.length > 0 ? parts.join(', ') : '—';
  };

  const headerLabel = () => {
    if (viewMode === 'weekly') {
      return `${format(days[0], 'yyyy. MMM d.', { locale: hu })} — ${format(days[6], 'MMM d.', { locale: hu })}`;
    }
    return format(month, 'yyyy. MMMM', { locale: hu });
  };

  const prev = () => {
    if (viewMode === 'weekly') setWeekStart(w => subWeeks(w, 1));
    else setMonth(m => subMonths(m, 1));
  };
  const next = () => {
    if (viewMode === 'weekly') setWeekStart(w => addWeeks(w, 1));
    else setMonth(m => addMonths(m, 1));
  };
  const today = () => {
    if (viewMode === 'weekly') setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
    else setMonth(startOfMonth(new Date()));
  };

  const colCount = days.length;
  const gridCols = `260px repeat(${colCount}, minmax(${viewMode === 'monthly' ? 44 : 80}px, 1fr))`;

  return (
    <div className="space-y-3 pb-16">
      {/* Kapacitásszabályok — capacity rule manager (moved from Kérelmek) */}
      <Collapsible open={rulesOpen} onOpenChange={setRulesOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg border bg-card hover:bg-accent/40 transition-colors text-sm font-medium"
          >
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-primary" />
              <span>{t('coverage_planner.capacity_rules_title')}</span>
            </div>
            <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', rulesOpen && 'rotate-180')} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <OfficeCoverageRuleManager workspaceId={workspaceId} userId={userId} />
        </CollapsibleContent>
      </Collapsible>

      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {/* View mode toggle */}
          <div className="flex rounded-md border overflow-hidden text-xs">
            <button
              type="button"
              className={cn('px-3 py-1.5 transition-colors', viewMode === 'weekly' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent')}
              onClick={() => setViewMode('weekly')}
            >
              {t('coverage_planner.weekly')}
            </button>
            <button
              type="button"
              className={cn('px-3 py-1.5 border-l transition-colors', viewMode === 'monthly' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent')}
              onClick={() => setViewMode('monthly')}
            >
              {t('coverage_planner.monthly')}
            </button>
          </div>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={prev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="font-semibold text-sm min-w-[160px] text-center capitalize">{headerLabel()}</div>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={next}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8" onClick={today}>
            {t(viewMode === 'weekly' ? 'coverage_planner.this_week' : 'coverage_planner.this_month')}
          </Button>
        </div>

      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <LegendChip className="bg-rose-100 text-rose-700 border-rose-300" label={t('coverage_planner.legend_understaffed')} />
        <LegendChip className="bg-emerald-100 text-emerald-700 border-emerald-300" label={t('coverage_planner.legend_sufficient')} />
        <LegendChip className="bg-amber-100 text-amber-700 border-amber-300" label={t('coverage_planner.legend_overstaffed')} />
        <LegendChip className="bg-zinc-100 text-zinc-500 border-zinc-300" label={t('coverage_planner.legend_na')} />
        <div className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
          <span>{t('coverage_planner.legend_available')}</span>
        </div>
      </div>

      {/* Matrix */}
      <div className="border rounded-lg overflow-hidden bg-card">
        {loading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : offices.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            {t('coverage_planner.no_office_hint')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div style={{ minWidth: 260 + colCount * (viewMode === 'monthly' ? 44 : 80) }}>
              {/* Header */}
              <div className="grid border-b bg-muted/30" style={{ gridTemplateColumns: gridCols }}>
                <div className="px-3 py-2 text-xs font-semibold text-muted-foreground border-r">
                  {t('coverage_planner.office_demand_col')}
                </div>
                {days.map(d => (
                  <div key={d.toISOString()} className={cn(
                    'px-1 py-2 text-center text-xs border-r last:border-r-0',
                    isWeekend(d) && 'bg-zinc-50 dark:bg-zinc-900/30 text-muted-foreground',
                    holidays.includes(format(d, 'yyyy-MM-dd')) && 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300'
                  )}>
                    <div className="font-semibold capitalize">
                      {viewMode === 'monthly' ? format(d, 'd') : format(d, 'EEE', { locale: hu })}
                    </div>
                    {viewMode === 'weekly' && <div className="text-[10px]">{format(d, 'MMM d.', { locale: hu })}</div>}
                    {viewMode === 'monthly' && <div className="text-[9px] leading-none">{format(d, 'EEEEE', { locale: hu })}</div>}
                  </div>
                ))}
              </div>

              {/* Body */}
              {offices.map(office => {
                const officeRules = rulesByOffice.get(office.id) || [];
                return (
                  <div key={office.id} className="grid border-b" style={{ gridTemplateColumns: gridCols }}>
                    <div className="px-3 py-2.5 min-h-[48px] border-r border-border/70 flex items-center gap-2">
                      <Building2 className="h-3.5 w-3.5 text-primary" />
                      <span className="text-sm font-semibold flex-1 truncate">{office.name}</span>
                      {office.city && <span className="text-[10px] text-muted-foreground">({office.city})</span>}
                      {officeRules.length > 0 && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setBatchDialogOffice(office); }}
                          className="ml-1 h-7 w-7 rounded-md flex items-center justify-center bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 hover:from-violet-500/40 hover:to-fuchsia-500/40 border border-violet-400/40 text-violet-600 dark:text-violet-300 transition-all hover:scale-110 hover:shadow-lg hover:shadow-violet-500/20 group"
                          title={t('coverage_planner.smart_schedule_title')}
                          aria-label={t('coverage_planner.smart_schedule_title')}
                        >
                          <Wand2 className="h-3.5 w-3.5 group-hover:rotate-12 transition-transform" />
                        </button>
                      )}
                    </div>
                    {days.map(d => {
                      const rule = officeRules.find(r => ruleAppliesOn(r, d));
                      if (!rule) {
                        const iso = format(d, 'yyyy-MM-dd');
                        const hasOpenShift = openShiftRequests.some(
                          r => r.office_id === office.id && r.shift_date === iso && r.status === 'open'
                        );
                        const assignedHere = shifts.filter(
                          s => s.office_id === office.id && s.shift_date === iso
                        );
                        const hasFilled = !hasOpenShift && assignedHere.length > 0;
                        return (
                          <button
                            key={d.toISOString()}
                            type="button"
                            onClick={() => setOpenShiftCell({ office, date: d })}
                            className={cn(
                              'min-h-[48px] border-r border-border/70 last:border-r-0 transition-colors cursor-pointer flex flex-col items-center justify-center gap-0.5',
                              viewMode === 'monthly' && 'min-h-[42px]',
                              hasFilled
                                ? 'bg-emerald-50/70 hover:bg-emerald-100/70 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/40'
                                : hasOpenShift
                                  ? 'bg-amber-50/70 hover:bg-amber-100/70 dark:bg-amber-950/30 dark:hover:bg-amber-900/40'
                                  : cn('bg-zinc-50/45 dark:bg-zinc-900/25 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/40', isWeekend(d) && 'bg-zinc-100/45 dark:bg-zinc-900/35')
                            )}
                            title={hasFilled ? t('open_shifts.filled_label') : hasOpenShift ? t('open_shifts.already_posted') : t('open_shifts.post_open_shift')}
                          >
                            {hasFilled && (
                              <>
                                <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                                <span className="text-[9px] text-emerald-700 dark:text-emerald-300 font-semibold leading-none">{assignedHere.length}</span>
                              </>
                            )}
                            {!hasFilled && hasOpenShift && (
                              <>
                                <Megaphone className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                                <span className="text-[9px] text-amber-700 dark:text-amber-300 font-semibold leading-none">{t('open_shifts.broadcast_label')}</span>
                              </>
                            )}
                          </button>
                        );
                      }
                      const supply = supplyFor(rule, d);
                      const need = rule.min_headcount;
                      const have = supply.length;
                      const tone =
                        have < need ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300'
                        : have === need ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300'
                        : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300';
                      return (
                        <button
                          key={d.toISOString()}
                          type="button"
                          onClick={() => setDrawerCell({ office, rule, date: d })}
                          className={cn(
                            'min-h-[48px] border-r border-border/70 last:border-r-0 border-l-0 border-t-0 border-b-0 px-1 py-1.5 text-xs font-semibold flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer',
                            tone
                          )}
                        >
                          <span className="text-sm">{need} / {have}</span>
                          {have < need
                            ? <AlertTriangle className="h-3 w-3" />
                            : have === need ? <CheckCircle2 className="h-3 w-3" /> : null}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Assignment drawer */}
      <Sheet open={!!drawerCell} onOpenChange={(o) => {
        if (!o) {
          setDrawerCell(null);
          setDraftAssignments([]);
          setPendingSuggestion(false);
        }
      }}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          {drawerCell && (() => {
            const ruleRolesForSlots = ruleRoles(drawerCell.rule);
            const ruleSkillsForSlots = ruleSkillIds(drawerCell.rule);
            // Slots: one row per required headcount unit.
            // If business_roles array has expanded entries (e.g. ['BA','BA','HR']), use it directly.
            // Otherwise fall back to N untyped slots based on min_headcount.
            const slots: { idx: number; role: string | null; skillId: string | null }[] = [];
            if (ruleRolesForSlots.length > 0) {
              ruleRolesForSlots.forEach((role, i) =>
                slots.push({ idx: i, role, skillId: ruleSkillsForSlots[0] ?? null })
              );
              // pad with untyped slots if min_headcount > roles count
              for (let i = ruleRolesForSlots.length; i < drawerCell.rule.min_headcount; i++) {
                slots.push({ idx: i, role: null, skillId: ruleSkillsForSlots[0] ?? null });
              }
            } else {
              for (let i = 0; i < Math.max(1, drawerCell.rule.min_headcount); i++) {
                slots.push({ idx: i, role: null, skillId: ruleSkillsForSlots[i] ?? ruleSkillsForSlots[0] ?? null });
              }
            }

            // Determine which slot each existing/draft assignment occupies (greedy by role match)
            const assignments: Array<
              | { kind: 'shift'; shift: Shift; member: MemberInput | undefined }
              | { kind: 'draft'; draft: DraftAssignment }
            > = [
              ...activeAssignedForDrawer.map((s) => ({
                kind: 'shift' as const,
                shift: s,
                member: members.find((mm) => mm.user_id === s.user_id),
              })),
              ...draftAssignments.map((d) => ({ kind: 'draft' as const, draft: d })),
            ];

            // Greedy slot allocation: try to fill matching role slot first
            const slotFill = new Map<number, typeof assignments[number]>();
            const remaining = [...assignments];
            slots.forEach((slot) => {
              if (slot.role) {
                const matchIdx = remaining.findIndex((a) => {
                  const r = a.kind === 'shift' ? a.member?.business_role : a.draft.member.business_role;
                  return r === slot.role;
                });
                if (matchIdx >= 0) {
                  slotFill.set(slot.idx, remaining[matchIdx]);
                  remaining.splice(matchIdx, 1);
                }
              }
            });
            // Fill rest in order
            slots.forEach((slot) => {
              if (slotFill.has(slot.idx)) return;
              if (remaining.length > 0) {
                slotFill.set(slot.idx, remaining.shift()!);
              }
            });
            // Overflow assignments (more people than slots) — show after slot list
            const overflow = remaining;

            const officeName = drawerCell.office.name;
            const ruleDisplay = (drawerCell.rule.name && drawerCell.rule.name.trim())
              ? drawerCell.rule.name
              : t('coverage_planner.rule_label');

            return (
            <>
              <SheetHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <SheetTitle className="text-2xl font-bold">{officeName}</SheetTitle>
                    <SheetDescription className="text-base font-medium text-muted-foreground">
                      {ruleDisplay}
                      <span className="block text-xs mt-0.5">
                        {t('coverage_planner.drawer_date_header', { date: format(drawerCell.date, 'yyyy. MMMM d. (EEEE)', { locale: hu }), count: drawerCell.rule.min_headcount })}
                      </span>
                    </SheetDescription>
                  </div>
                  <div className="shrink-0 pt-1">
                    <OpenShiftManager
                      workspaceId={workspaceId}
                      officeId={drawerCell.office.id}
                      shiftDate={format(drawerCell.date, 'yyyy-MM-dd')}
                      businessRole={ruleRoles(drawerCell.rule)[0]}
                      skillId={ruleSkillIds(drawerCell.rule)[0]}
                      compact
                    />
                  </div>
                </div>
              </SheetHeader>

              {/* Slot rows (Phase I) */}
              <div className="mt-4 space-y-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase">{t('coverage_planner.assigned_label')}</div>
                <div className="space-y-1.5">
                  {slots.map((slot) => {
                    const filled = slotFill.get(slot.idx);
                    const slotRoleLabel = slot.role || (slot.skillId ? skillName(slot.skillId) : t('coverage_planner.any_role'));
                    if (!filled) {
                      return (
                        <SlotDropZone
                          key={slot.idx}
                          slotRoleLabel={slotRoleLabel || '—'}
                          onDrop={async (memberId) => {
                            const picked = availableCandidates.find((c) => c.member.membership_id === memberId);
                            if (!picked) return;
                            await assignMember(picked.member, drawerCell.rule, drawerCell.date);
                          }}
                        />
                      );
                    }
                    const member = filled.kind === 'shift' ? filled.member : filled.draft.member;
                    const memberRole = member?.business_role || null;
                    const isMatch = slot.role ? memberRole === slot.role : true;
                    return (
                      <div
                        key={slot.idx}
                        className={cn(
                          'flex items-center gap-2 p-2 rounded border text-sm transition-colors',
                          isMatch
                            ? 'bg-emerald-100/80 dark:bg-emerald-900/30 border-emerald-300/70 text-emerald-900 dark:text-emerald-200'
                            : 'bg-rose-100/80 dark:bg-rose-900/30 border-rose-300/70 text-rose-900 dark:text-rose-200',
                        )}
                      >
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{member?.display_name || t('coverage_planner.user_fallback')}</span>
                            <span className="text-[10px] uppercase tracking-wider opacity-70">{slotRoleLabel}</span>
                          </div>
                          {!isMatch && memberRole && (
                            <div className="text-[10px] opacity-80 mt-0.5">
                              {t('coverage_planner.actual_position_label', { role: memberRole })}
                            </div>
                          )}
                        </div>
                        {filled.kind === 'shift' && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => unassign(filled.shift.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        )}
                      </div>
                    );
                  })}

                  {/* Overflow */}
                  {overflow.length > 0 && (
                    <div className="pt-2 mt-2 border-t border-dashed">
                      <div className="text-[10px] uppercase text-muted-foreground mb-1">{t('coverage_planner.overflow_label')}</div>
                      {overflow.map((a, i) => {
                        const member = a.kind === 'shift' ? a.member : a.draft.member;
                        return (
                          <div key={i} className="flex items-center gap-2 p-2 rounded border text-sm bg-amber-100/60 dark:bg-amber-900/30 border-amber-300/70">
                            <div className="flex-1 font-medium">{member?.display_name || t('coverage_planner.user_fallback')}</div>
                            {a.kind === 'shift' && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => unassign(a.shift.id)}>
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  {pendingSuggestion && (
                    <div className="flex items-center gap-1 mr-1 opacity-80">
                      <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full border border-rose-400/70 text-rose-500" onClick={() => { setDraftAssignments([]); setPendingSuggestion(false); }}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full border border-emerald-400/70 text-emerald-500" onClick={persistDraftAssignments}>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={suggestOptimal}>
                    Intelligens javaslat
                  </Button>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase">{t('coverage_planner.available_candidates_title')}</div>
                {availableCandidates.length === 0 ? (
                  <div className="text-xs text-muted-foreground italic">{t('coverage_planner.no_available_candidates')}</div>
                ) : (
                  availableCandidates.map(c => {
                    const dateISO = format(drawerCell.date, 'yyyy-MM-dd');
                    const isAvailable = availabilityByDate.get(dateISO)?.has(c.member.user_id) ?? false;
                    return (
                      <div
                        key={c.member.membership_id}
                        className={cn(
                          'p-2 rounded-md border text-sm',
                          c.isEligible ? 'bg-card' : 'bg-muted/40 opacity-70'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <div className="flex-1 font-medium cursor-grab active:cursor-grabbing" draggable onDragStart={onDragStartCandidate(c.member.membership_id)}>
                            {c.member.display_name}
                            {isAvailable && (
                              <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-green-500 align-middle" title={t('coverage_planner.availability_indicator')} />
                            )}
                          </div>
                          <Badge variant="outline" className="text-[10px]">score {c.matchScore}</Badge>
                          <Button
                            size="sm"
                            variant={c.isEligible ? 'default' : 'outline'}
                            onClick={() => assignMember(c.member, drawerCell.rule, drawerCell.date)}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Beoszt
                          </Button>
                        </div>
                        {c.member.business_role && (
                          <div className="text-[10px] text-muted-foreground mt-0.5">{c.member.business_role}</div>
                        )}
                        {c.issues.length > 0 && (
                          <div className="mt-1.5 space-y-0.5">
                            {c.issues.map((i, idx) => (
                              <div key={idx} className={cn(
                                'text-[10px] flex items-start gap-1',
                                i.severity === 'blocking' ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'
                              )}>
                                {i.severity === 'blocking' ? <X className="h-2.5 w-2.5 mt-0.5" /> : <AlertTriangle className="h-2.5 w-2.5 mt-0.5" />}
                                <span>{i.message}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

            </>
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* Open-shift-only sheet — for cells without a coverage rule (weekends, empty days) */}
      <Sheet open={!!openShiftCell} onOpenChange={(o) => { if (!o) setOpenShiftCell(null); }}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          {openShiftCell && (() => {
            const isoDate = format(openShiftCell.date, 'yyyy-MM-dd');
            const assignedHere = shifts.filter(
              s => s.office_id === openShiftCell.office.id && s.shift_date === isoDate
            );
            return (
              <>
                <SheetHeader>
                  <SheetTitle className="text-2xl font-bold">{openShiftCell.office.name}</SheetTitle>
                  <SheetDescription className="text-base font-medium text-muted-foreground">
                    {t('coverage_planner.open_shift_section')}
                    <span className="block text-xs mt-0.5">
                      {format(openShiftCell.date, 'yyyy. MMMM d. (EEEE)', { locale: hu })}
                    </span>
                  </SheetDescription>
                </SheetHeader>

                {assignedHere.length > 0 && (
                  <div className="mt-4 space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {t('coverage_planner.assigned_label')} ({assignedHere.length})
                    </p>
                    {assignedHere.map(s => {
                      const mem = members.find(m => m.user_id === s.user_id);
                      return (
                        <div key={s.id} className="flex items-center gap-2 rounded border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 text-sm">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          <span className="font-medium">{mem?.display_name ?? s.user_id}</span>
                          {(s.business_role || mem?.business_role) && (
                            <span className="ml-auto text-xs text-muted-foreground truncate">
                              {s.business_role ?? mem?.business_role}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="mt-4">
                  <OpenShiftManager
                    workspaceId={workspaceId}
                    officeId={openShiftCell.office.id}
                    shiftDate={isoDate}
                    availableSkills={skills}
                  />
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>

      {batchDialogOffice && (
        <SmartBatchScheduleDialog
          open={!!batchDialogOffice}
          onOpenChange={(o) => { if (!o) setBatchDialogOffice(null); }}
          workspaceId={workspaceId}
          userId={userId}
          office={batchDialogOffice}
          rules={rules}
          members={members}
          ctx={ctxFor()}
          sitePriorityMap={memberSitePriorityMap}
          defaultStart={days[0]}
          defaultEnd={days[days.length - 1]}
          onCompleted={load}
        />
      )}
    </div>
  );
}

function SlotDropZone({ slotRoleLabel, onDrop }: { slotRoleLabel: string; onDrop: (memberId: string) => void }) {
  const { t } = useI18n();
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const memberId = e.dataTransfer.getData('text/member-id');
        if (memberId) onDrop(memberId);
      }}
      className={cn(
        'flex items-center justify-between gap-2 p-2 rounded border border-dashed text-xs transition-colors',
        over ? 'border-primary bg-primary/10' : 'border-muted-foreground/30 bg-muted/20 text-muted-foreground',
      )}
    >
      <span className="font-medium">{slotRoleLabel}</span>
      <span className="text-[10px] uppercase tracking-wider opacity-60">{t('coverage_planner.empty_slot_hint')}</span>
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
