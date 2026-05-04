/**
 * Coverage Engine — Eligibility & Validation
 *
 * Adott (office, role/skill, date) követelményhez kiértékeli a workspace tagjait:
 *  - Leave constraint: jóváhagyott vagy függő szabadság / ünnep / blokkolt nap
 *  - Skill / Position constraint: van-e az adott pozíciója / képessége (legalább a kért szinttel)
 *  - Double-booking constraint: már be van osztva másik telephelyre ezen a napon?
 *  - Capacity constraint: weekly_capacity_hours / base_working_hours figyelembevétele (heti túlóra warning)
 *
 * Tisztán pure — nem érinti a DB-t, könnyen tesztelhető.
 */

export type EligibilityReasonCode =
  | 'ON_LEAVE'
  | 'PENDING_LEAVE'
  | 'HOLIDAY'
  | 'BLOCKED'
  | 'WRONG_ROLE'
  | 'MISSING_SKILL'
  | 'SKILL_LEVEL_LOW'
  | 'DOUBLE_BOOKED'
  | 'OVER_CAPACITY';

export interface EligibilityIssue {
  code: EligibilityReasonCode;
  severity: 'blocking' | 'warning';
  message: string;
}

export interface MemberInput {
  membership_id: string;
  user_id: string;
  display_name: string;
  business_role: string | null;
  weekly_capacity_hours: number;
  base_working_hours: number;
  skills: { skill_id: string; level: number }[]; // from enterprise_member_skills
}

export interface LeaveLite {
  user_id: string;
  start_date: string; // yyyy-mm-dd
  end_date: string;
  status: string; // approved | pending | ...
}

export interface ShiftLite {
  user_id: string;
  office_id: string;
  shift_date: string;
}

export interface RequirementInput {
  business_role?: string | null;
  business_roles?: string[] | null;   // multi-position support
  skill_id?: string | null;
  skill_ids?: string[] | null;        // multi-skill support
  min_skill_level?: number | null;
  shift_date: string; // yyyy-mm-dd
  office_id: string;
}

export interface EligibilityContext {
  holidaysISO: Set<string>;        // workspace holidays
  blockedDatesISO: Set<string>;    // blocked_dates
  leaves: LeaveLite[];
  shifts: ShiftLite[];             // already-existing shift assignments (this date pool)
}

export interface EligibilityResult {
  member: MemberInput;
  isEligible: boolean;             // no blocking issues
  matchScore: number;              // higher = better match (sort desc)
  issues: EligibilityIssue[];
}

const dateInRange = (d: string, start: string, end: string) => d >= start && d <= end;

export function evaluateEligibility(
  member: MemberInput,
  req: RequirementInput,
  ctx: EligibilityContext
): EligibilityResult {
  const issues: EligibilityIssue[] = [];
  let score = 100;

  // 1) Holiday / Blocked
  if (ctx.holidaysISO.has(req.shift_date)) {
    issues.push({ code: 'HOLIDAY', severity: 'warning', message: 'Munkaszüneti nap — beosztás csak tájékoztató jelleggel.' });
    score -= 5;
  }
  if (ctx.blockedDatesISO.has(req.shift_date)) {
    issues.push({ code: 'BLOCKED', severity: 'blocking', message: 'Tiltott nap a workspace szabályok szerint.' });
  }

  // 2) Leave constraint
  for (const l of ctx.leaves) {
    if (l.user_id !== member.user_id) continue;
    if (!dateInRange(req.shift_date, l.start_date, l.end_date)) continue;
    if (l.status === 'approved') {
      issues.push({ code: 'ON_LEAVE', severity: 'blocking', message: 'Jóváhagyott szabadságon van.' });
    } else if (l.status === 'pending') {
      issues.push({ code: 'PENDING_LEAVE', severity: 'warning', message: 'Függő szabadságkérelme van erre a napra.' });
      score -= 30;
    }
  }

  // 3) Role / Skill match — supports both single and multi-value requirements
  const effectiveRoles = req.business_roles?.length ? req.business_roles : (req.business_role ? [req.business_role] : null);
  const effectiveSkillIds = req.skill_ids?.length ? req.skill_ids : (req.skill_id ? [req.skill_id] : null);

  if (effectiveRoles && effectiveRoles.length > 0) {
    if (member.business_role && effectiveRoles.includes(member.business_role)) {
      score += 50;
    } else {
      issues.push({ code: 'WRONG_ROLE', severity: 'warning', message: `Pozíciója (${member.business_role || '—'}) nem egyezik az elvárt pozíciók egyikével sem.` });
      score -= 40;
    }
  }
  if (effectiveSkillIds && effectiveSkillIds.length > 0) {
    const matchedSkill = member.skills.find(s => effectiveSkillIds.includes(s.skill_id));
    if (!matchedSkill) {
      // If member's role already matches the requirement, downgrade skill mismatch to warning —
      // a role-matched person is still a valid candidate even without the exact skill tag.
      const hasRoleMatch = !!(effectiveRoles && effectiveRoles.length > 0 && member.business_role && effectiveRoles.includes(member.business_role));
      issues.push({ code: 'MISSING_SKILL', severity: hasRoleMatch ? 'warning' : 'blocking', message: 'Hiányzó szükséges képesség (egyik sem teljesül).' });
    } else {
      const need = req.min_skill_level ?? 1;
      if (matchedSkill.level < need) {
        issues.push({ code: 'SKILL_LEVEL_LOW', severity: 'warning', message: `Képesség szintje (${matchedSkill.level}) alacsonyabb, mint az elvárt (${need}).` });
        score -= 20;
      } else {
        score += 30 + (matchedSkill.level - need) * 5;
      }
    }
  }

  // 4) Double-booking
  for (const s of ctx.shifts) {
    if (s.user_id !== member.user_id) continue;
    if (s.shift_date !== req.shift_date) continue;
    if (s.office_id !== req.office_id) {
      issues.push({ code: 'DOUBLE_BOOKED', severity: 'blocking', message: 'Már be van osztva másik telephelyre ezen a napon.' });
    }
  }

  // 5) Capacity (heti — információs warning)
  // Egy nap = base_working_hours; heti összóra > weekly_capacity_hours warning.
  const isoWeekKey = isoWeekKeyOf(req.shift_date);
  const sameWeekShifts = ctx.shifts.filter(
    s => s.user_id === member.user_id && isoWeekKeyOf(s.shift_date) === isoWeekKey
  );
  const projectedHours = (sameWeekShifts.length + 1) * (member.base_working_hours || 8);
  if (projectedHours > member.weekly_capacity_hours) {
    issues.push({
      code: 'OVER_CAPACITY',
      severity: 'warning',
      message: `Heti kapacitás túllépés: ~${projectedHours}h / ${member.weekly_capacity_hours}h.`,
    });
    score -= 10;
  }

  const blocking = issues.some(i => i.severity === 'blocking');
  return { member, isEligible: !blocking, matchScore: score, issues };
}

export function rankCandidates(
  members: MemberInput[],
  req: RequirementInput,
  ctx: EligibilityContext
): EligibilityResult[] {
  return members
    .map(m => evaluateEligibility(m, req, ctx))
    .sort((a, b) => {
      // eligible-ek előre, majd score desc
      if (a.isEligible !== b.isEligible) return a.isEligible ? -1 : 1;
      return b.matchScore - a.matchScore;
    });
}

// --- helpers ---
function isoWeekKeyOf(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  // ISO week (Mon=1)
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const firstThursday = d.getTime();
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((firstThursday - yearStart.getTime()) / 86400000 - 3 + ((yearStart.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
