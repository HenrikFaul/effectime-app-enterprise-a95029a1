import { supabase } from '@/integrations/supabase/client';
import { format, eachDayOfInterval, getDay } from 'date-fns';

export interface ConflictResult {
  code: string;
  severity: 'warning' | 'blocking';
  message: string;
  date?: string;
}

/**
 * Validate a leave request against workspace rules.
 * Returns an array of conflicts (empty = no conflicts).
 *
 * Throws if any required data cannot be fetched — callers must treat a thrown
 * error as "validation could not complete" and block submission accordingly.
 */
export async function validateLeaveRequest(
  workspaceId: string,
  userId: string,
  startDate: Date,
  endDate: Date,
): Promise<ConflictResult[]> {
  const conflicts: ConflictResult[] = [];
  const requestDays = eachDayOfInterval({ start: startDate, end: endDate });
  const requestDateStrings = requestDays.map(d => format(d, 'yyyy-MM-dd'));

  const rangeStart = requestDateStrings[0];
  const rangeEnd = requestDateStrings[requestDateStrings.length - 1];

  // Fetch all relevant data in parallel, scoped to the requested date range where possible.
  const [holidaysRes, blockedRes, rulesRes, existingRequestsRes, officeRulesRes, membershipsRes] = await Promise.all([
    supabase
      .from('enterprise_holidays')
      .select('holiday_date, name')
      .eq('workspace_id', workspaceId)
      .gte('holiday_date', rangeStart)
      .lte('holiday_date', rangeEnd),
    supabase
      .from('enterprise_blocked_dates')
      .select('blocked_date, reason')
      .eq('workspace_id', workspaceId)
      .in('blocked_date', requestDateStrings),
    supabase
      .from('enterprise_daily_rules')
      .select('*')
      .eq('workspace_id', workspaceId),
    supabase
      .from('leave_requests')
      .select('start_date, end_date, user_id, status')
      .eq('workspace_id', workspaceId)
      .in('status', ['pending', 'approved'])
      .lte('start_date', rangeEnd)
      .gte('end_date', rangeStart),
    (supabase as any)
      .from('enterprise_office_coverage_rules')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('status', 'active'),
    (supabase as any)
      .from('enterprise_memberships')
      .select('user_id, office_id, business_role, status')
      .eq('workspace_id', workspaceId)
      .eq('status', 'active'),
  ]);

  // Surface fetch errors — never silently return "no conflicts" when data is missing.
  // A network or auth failure here must block submission so bad requests aren't let through.
  const fetchErrors = [
    holidaysRes.error && `holidays: ${holidaysRes.error.message}`,
    blockedRes.error && `blocked_dates: ${blockedRes.error.message}`,
    rulesRes.error && `daily_rules: ${rulesRes.error.message}`,
    existingRequestsRes.error && `leave_requests: ${existingRequestsRes.error.message}`,
    officeRulesRes.error && `office_coverage_rules: ${officeRulesRes.error.message}`,
    membershipsRes.error && `memberships: ${membershipsRes.error.message}`,
  ].filter(Boolean);

  if (fetchErrors.length > 0) {
    throw new Error(`Validáció sikertelen — adatbetöltési hiba: ${fetchErrors.join('; ')}`);
  }

  const holidays = (holidaysRes.data as any[]) || [];
  const blockedDates = (blockedRes.data as any[]) || [];
  const dailyRules = (rulesRes.data as any[]) || [];
  const existingRequests = (existingRequestsRes.data as any[]) || [];
  const officeRules = (officeRulesRes.data as any[]) || [];
  const memberships = (membershipsRes.data as any[]) || [];

  // Build a user_id → business_role map for fast role-scoped counting.
  const memberRoleByUserId = new Map<string, string>(
    memberships.map((m: any) => [m.user_id as string, (m.business_role ?? '') as string]),
  );

  // 1. Check blocked dates (BLOCKING)
  for (const bd of blockedDates) {
    conflicts.push({
      code: 'BLOCKED_DATE',
      severity: 'blocking',
      message: `${bd.blocked_date} tiltott nap${bd.reason ? `: ${bd.reason}` : ''}`,
      date: bd.blocked_date,
    });
  }

  // 2. Check holidays (WARNING - might be intentional)
  const holidayDateSet = new Set(holidays.map((h: any) => h.holiday_date));
  for (const dateStr of requestDateStrings) {
    if (holidayDateSet.has(dateStr)) {
      const h = holidays.find((h: any) => h.holiday_date === dateStr);
      conflicts.push({
        code: 'HOLIDAY_OVERLAP',
        severity: 'warning',
        message: `${dateStr} ünnepnap (${h?.name || 'ismeretlen'}) — szabadságot igényelni felesleges lehet`,
        date: dateStr,
      });
    }
  }

  // 3. Check daily max-off rules.
  //
  // ruleApplies: returns true when a daily_rule governs a given date+dow.
  // Empty days_of_week (and no legacy day_of_week) means "all days" — consistent
  // with officeRuleApplies below.
  const ruleApplies = (rule: any, dateStr: string, dow: number): boolean => {
    if (rule.rule_date) return rule.rule_date === dateStr;
    const days: number[] = (rule.days_of_week && rule.days_of_week.length > 0)
      ? rule.days_of_week
      : (rule.day_of_week !== null && rule.day_of_week !== undefined ? [rule.day_of_week] : []);
    // Empty days array → rule applies every day of the week.
    if (days.length > 0 && !days.includes(dow)) return false;
    if (rule.valid_from && dateStr < rule.valid_from) return false;
    if (rule.valid_until && dateStr > rule.valid_until) return false;
    return true;
  };

  const ruleRoleLabel = (rule: any): string => {
    const roles: string[] = (rule.role_filters && rule.role_filters.length > 0)
      ? rule.role_filters
      : (rule.role_filter ? [rule.role_filter] : (rule.team_filter ? [rule.team_filter] : []));
    return roles.length > 0 ? ` (${roles.join(', ')})` : '';
  };

  for (const day of requestDays) {
    const dateStr = format(day, 'yyyy-MM-dd');
    const dow = getDay(day);

    const applicable = dailyRules.filter((r: any) => ruleApplies(r, dateStr, dow));
    for (const rule of applicable) {
      if (rule.max_off === null || rule.max_off === undefined) continue;

      // Resolve which roles this rule constrains (prefer multi-value array over legacy scalars).
      const constrainedRoles: string[] = (rule.role_filters && rule.role_filters.length > 0)
        ? rule.role_filters
        : (rule.role_filter ? [rule.role_filter] : (rule.team_filter ? [rule.team_filter] : []));

      // Count how many OTHER members (respecting role scope) already have leave on this day.
      const offCount = existingRequests.filter((req: any) => {
        if (req.user_id === userId) return false;
        if (!(req.start_date <= dateStr && req.end_date >= dateStr)) return false;
        // When the rule has a role filter, only count members whose business_role is in scope.
        if (constrainedRoles.length > 0) {
          const theirRole = memberRoleByUserId.get(req.user_id) ?? '';
          if (!constrainedRoles.includes(theirRole)) return false;
        }
        return true;
      }).length;

      if (offCount >= rule.max_off) {
        conflicts.push({
          code: 'MAX_OFF_EXCEEDED',
          severity: 'blocking',
          message: `${dateStr}: max ${rule.max_off} fő lehet távol, jelenleg ${offCount} fő már távol van${ruleRoleLabel(rule)}`,
          date: dateStr,
        });
      } else if (offCount >= rule.max_off - 1) {
        conflicts.push({
          code: 'MAX_OFF_WARNING',
          severity: 'warning',
          message: `${dateStr}: majdnem eléri a max távollévők számát (${offCount + 1}/${rule.max_off})${ruleRoleLabel(rule)}`,
          date: dateStr,
        });
      }
    }
  }

  // 3b. Check office coverage rules (BLOCKING)
  // For each requested day, find applicable office rules. For each (office, role) pair,
  // count how many active members of that office+role would be away (excluding self).
  // If headcount drops below min_headcount, raise a blocking conflict.
  const myMembership = memberships.find((m: any) => m.user_id === userId);
  const officeRuleApplies = (rule: any, dateStr: string, dow: number): boolean => {
    if (rule.rule_date) return rule.rule_date === dateStr;
    const days: number[] = (rule.days_of_week && rule.days_of_week.length > 0)
      ? rule.days_of_week
      : (rule.day_of_week !== null && rule.day_of_week !== undefined ? [rule.day_of_week] : []);
    if (days.length > 0 && !days.includes(dow)) return false;
    if (rule.valid_from && dateStr < rule.valid_from) return false;
    if (rule.valid_until && dateStr > rule.valid_until) return false;
    return true;
  };

  for (const day of requestDays) {
    const dateStr = format(day, 'yyyy-MM-dd');
    const dow = getDay(day);
    const applicable = officeRules.filter((r: any) => officeRuleApplies(r, dateStr, dow));
    for (const rule of applicable) {
      const effectiveRoles: string[] = (rule.business_roles && rule.business_roles.length > 0)
        ? rule.business_roles
        : (rule.business_role ? [rule.business_role] : []);
      const roleLabel = effectiveRoles.length > 0 ? effectiveRoles.join(' / ') : '—';

      const officeMembers = memberships.filter((m: any) =>
        m.office_id === rule.office_id &&
        (effectiveRoles.length === 0 || (m.business_role && effectiveRoles.includes(m.business_role)))
      );
      const totalHeadcount = officeMembers.length;
      const awayUserIds = new Set(
        existingRequests
          .filter((req: any) => req.user_id !== userId && req.start_date <= dateStr && req.end_date >= dateStr)
          .map((req: any) => req.user_id)
      );
      const awayCount = officeMembers.filter((m: any) => awayUserIds.has(m.user_id)).length;
      const selfCounts = myMembership
        && myMembership.office_id === rule.office_id
        && (effectiveRoles.length === 0 || (myMembership.business_role && effectiveRoles.includes(myMembership.business_role))) ? 1 : 0;
      const presentIfApproved = totalHeadcount - awayCount - selfCounts;

      if (presentIfApproved < rule.min_headcount) {
        conflicts.push({
          code: 'OFFICE_COVERAGE_BREACH',
          severity: 'blocking',
          message: `${dateStr}: telephely lefedettség sérülne (${roleLabel}) — min ${rule.min_headcount} fő szükséges, csak ${presentIfApproved} maradna`,
          date: dateStr,
        });
      } else if (presentIfApproved === rule.min_headcount) {
        conflicts.push({
          code: 'OFFICE_COVERAGE_WARNING',
          severity: 'warning',
          message: `${dateStr}: telephely lefedettség éppen a minimumon (${roleLabel}: ${presentIfApproved}/${rule.min_headcount})`,
          date: dateStr,
        });
      }
    }
  }

  // 4. Self-overlap check (WARNING)
  const ownOverlapping = existingRequests.filter((req: any) => {
    if (req.user_id !== userId) return false;
    const myStart = requestDateStrings[0];
    const myEnd = requestDateStrings[requestDateStrings.length - 1];
    return req.start_date <= myEnd && req.end_date >= myStart;
  });

  if (ownOverlapping.length > 0) {
    conflicts.push({
      code: 'SELF_OVERLAP',
      severity: 'warning',
      message: `Már van függőben lévő vagy jóváhagyott kérelmed ebben az időszakban`,
    });
  }

  return conflicts;
}
