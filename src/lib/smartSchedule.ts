import { eachDayOfInterval, format, startOfMonth, endOfMonth } from 'date-fns';
import { evaluateEligibility, type EligibilityContext, type MemberInput, type RequirementInput, type ShiftLite } from '@/lib/coverageEligibility';

export interface SiteRuleLite {
  office_id: string;
  min_headcount: number;
  business_roles?: string[] | null;
}

export interface EmployeeWithSites extends MemberInput {
  allowedSites?: { siteId: string; priority: number }[];
}

export function generateSmartSchedule(
  startDate: Date,
  endDate: Date,
  siteId: string,
  employees: EmployeeWithSites[],
  rules: SiteRuleLite[],
  ctx: EligibilityContext,
): Array<{ user_id: string; membership_id: string; office_id: string; shift_date: string; business_role: string | null }> {
  const out: Array<{ user_id: string; membership_id: string; office_id: string; shift_date: string; business_role: string | null }> = [];
  const virtualShifts: ShiftLite[] = [...ctx.shifts];

  for (const day of eachDayOfInterval({ start: startDate, end: endDate })) {
    const iso = format(day, 'yyyy-MM-dd');
    const dayRules = rules.filter((r) => r.office_id === siteId);

    for (const rule of dayRules) {
      const slots = Math.max(1, rule.min_headcount);
      const roleSlots = (rule.business_roles && rule.business_roles.length > 0)
        ? [...rule.business_roles, ...Array.from({ length: Math.max(0, slots - rule.business_roles.length) }, () => null)]
        : Array.from({ length: slots }, () => null as string | null);

      for (const slotRole of roleSlots) {
        const req: RequirementInput = { office_id: siteId, shift_date: iso, business_roles: slotRole ? [slotRole] : undefined };

        const candidates = employees
          // Hard constraint #1 + #2: explicit site-allow list
          .filter((e) => (e.allowedSites ?? []).some((s) => s.siteId === siteId))
          .map((e) => ({ e, ev: evaluateEligibility(e, req, { ...ctx, shifts: virtualShifts }) }))
          // Hard constraint #3: leave / double-booking / blocked (eligible only)
          .filter((x) => x.ev.isEligible)
          .sort((a, b) => {
            // Soft #1: role match first
            const aRole = slotRole && a.e.business_role === slotRole ? 0 : 1;
            const bRole = slotRole && b.e.business_role === slotRole ? 0 : 1;
            if (aRole !== bRole) return aRole - bRole;

            // Soft #2: site priority (1 is best)
            const aP = a.e.allowedSites?.find((s) => s.siteId === siteId)?.priority ?? 99;
            const bP = b.e.allowedSites?.find((s) => s.siteId === siteId)?.priority ?? 99;
            if (aP !== bP) return aP - bP;

            // Soft #3: load balancing in month (fewer already-assigned days wins)
            const mStart = startOfMonth(day);
            const mEnd = endOfMonth(day);
            const aLoad = virtualShifts.filter((s) => s.user_id === a.e.user_id && s.shift_date >= format(mStart, 'yyyy-MM-dd') && s.shift_date <= format(mEnd, 'yyyy-MM-dd')).length;
            const bLoad = virtualShifts.filter((s) => s.user_id === b.e.user_id && s.shift_date >= format(mStart, 'yyyy-MM-dd') && s.shift_date <= format(mEnd, 'yyyy-MM-dd')).length;
            if (aLoad !== bLoad) return aLoad - bLoad;

            return b.ev.matchScore - a.ev.matchScore;
          });

        const chosen = candidates[0];
        if (!chosen) continue;
        const assignment = {
          user_id: chosen.e.user_id,
          membership_id: chosen.e.membership_id,
          office_id: siteId,
          shift_date: iso,
          business_role: slotRole ?? chosen.e.business_role ?? null,
        };
        out.push(assignment);
        virtualShifts.push({ user_id: chosen.e.user_id, office_id: siteId, shift_date: iso });
      }
    }
  }

  return out;
}
