/**
 * Capacity Engine
 * ----------------
 * Computes per-position resource availability across a workspace,
 * factoring in:
 *   - member -> business_role allocations (% per position)
 *   - per-membership base_working_hours (so capacity can be expressed in hours)
 *   - existing project assignments (subtracted from member capacity)
 *   - approved leave requests (per-day deduction)
 *
 * All calculations are DAY-LEVEL. The `available_percentage` over a
 * period is the AVERAGE daily availability across the window.
 *
 * Hours math:
 *   member_hours_per_day_for_role = base_working_hours * (allocation_pct / 100)
 *   used_hours = member_hours_per_day_for_role * (used_pct / base_pct) (approx)
 *   available_hours = base_working_hours * (available_pct / 100)
 */

import { supabase } from '@/integrations/supabase/client';

export interface MemberAllocation {
  membership_id: string;
  user_id: string;
  display_name: string;
  business_role: string;
  base_percentage: number;
  base_working_hours: number;
}

export interface ProjectAssignmentLite {
  membership_id: string;
  business_role: string;
  allocated_percentage: number;
  start_date: string;
  end_date: string | null;
}

export interface LeaveDay {
  user_id: string;
  date: string;
  is_half_day: boolean;
}

export interface CapacityRow {
  membership_id: string;
  user_id: string;
  display_name: string;
  business_role: string;
  base_percentage: number;
  used_percentage: number;
  leave_deduction: number;
  available_percentage: number;
  base_working_hours: number;
  available_hours_per_day: number;
}

export interface PositionSummary {
  business_role: string;
  total_base: number;
  total_used: number;
  total_leave_deduction: number;
  total_available: number;
  total_base_hours: number;
  total_available_hours: number;
  member_count: number;
}

const DAY_MS = 86_400_000;

function parseISO(d: string): Date {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

function fmtISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function eachDay(start: string, end: string): string[] {
  const out: string[] = [];
  const s = parseISO(start).getTime();
  const e = parseISO(end).getTime();
  for (let t = s; t <= e; t += DAY_MS) {
    out.push(fmtISO(new Date(t)));
  }
  return out;
}

function overlap(aStart: string, aEnd: string | null, bStart: string, bEnd: string): { start: string; end: string } | null {
  const s = aStart > bStart ? aStart : bStart;
  const aEndEffective = aEnd ?? '9999-12-31';
  const e = aEndEffective < bEnd ? aEndEffective : bEnd;
  if (s > e) return null;
  return { start: s, end: e };
}

export async function computeWorkspaceCapacity(params: {
  workspaceId: string;
  windowStart: string;
  windowEnd: string;
  includeLeaves: boolean;
  excludeProjectId?: string;
}): Promise<{ rows: CapacityRow[]; positions: PositionSummary[] }> {
  const { workspaceId, windowStart, windowEnd, includeLeaves, excludeProjectId } = params;

  const totalDays = Math.max(1, Math.round((parseISO(windowEnd).getTime() - parseISO(windowStart).getTime()) / DAY_MS) + 1);

  const [allocsResult, membershipsResult] = await Promise.all([
    supabase
      .from('enterprise_member_role_allocations')
      .select('id, membership_id, business_role, percentage')
      .eq('workspace_id', workspaceId),
    (supabase as any)
      .from('enterprise_memberships')
      .select('id, user_id, status, base_working_hours')
      .eq('workspace_id', workspaceId)
      .eq('status', 'active'),
  ]);

  if (allocsResult.error) {
    console.error('[capacityEngine] Failed to load allocations:', allocsResult.error.message);
  }
  if (membershipsResult.error) {
    console.error('[capacityEngine] Failed to load memberships:', membershipsResult.error.message);
  }

  const allocs = allocsResult.data;
  const memberships = membershipsResult.data;

  const activeMembershipIds = new Set((memberships || []).map((m: any) => m.id));
  const membershipToUser = new Map<string, string>((memberships || []).map((m: any) => [m.id, m.user_id]));
  const membershipToHours = new Map<string, number>(
    (memberships || []).map((m: any) => [m.id, Number(m.base_working_hours ?? 8)]),
  );
  const userIds: string[] = Array.from(new Set((memberships || []).map((m: any) => m.user_id as string)));

  const { data: profiles } = userIds.length
    ? await supabase.from('profiles').select('user_id, display_name').in('user_id', userIds)
    : { data: [] as any[] };
  const nameByUser = new Map<string, string>((profiles || []).map((p: any) => [p.user_id, p.display_name || 'Unknown']));

  const { data: rawAssignments, error: assignError } = await supabase
    .from('enterprise_project_assignments')
    .select('membership_id, project_id, business_role, allocated_percentage, start_date, end_date')
    .eq('workspace_id', workspaceId)
    .lte('start_date', windowEnd);
  if (assignError) {
    console.error('[capacityEngine] Failed to load project assignments:', assignError.message);
  }
  const assignments: (ProjectAssignmentLite & { project_id: string })[] = ((rawAssignments as any[]) || []).filter(
    (a) => a.end_date === null || a.end_date >= windowStart,
  );

  let leaveDays: LeaveDay[] = [];
  if (includeLeaves) {
    const { data: leaves, error: leavesError } = await supabase
      .from('leave_requests')
      .select('user_id, start_date, end_date, is_half_day')
      .eq('workspace_id', workspaceId)
      .eq('status', 'approved')
      .lte('start_date', windowEnd)
      .gte('end_date', windowStart);
    if (leavesError) {
      console.error('[capacityEngine] Failed to load approved leaves:', leavesError.message);
    }

    for (const lr of (leaves as any[]) || []) {
      const ov = overlap(lr.start_date, lr.end_date, windowStart, windowEnd);
      if (!ov) continue;
      for (const d of eachDay(ov.start, ov.end)) {
        leaveDays.push({ user_id: lr.user_id, date: d, is_half_day: !!lr.is_half_day });
      }
    }
  }

  const leaveDaysByUser = new Map<string, number>();
  for (const ld of leaveDays) {
    leaveDaysByUser.set(ld.user_id, (leaveDaysByUser.get(ld.user_id) || 0) + (ld.is_half_day ? 0.5 : 1));
  }

  const rows: CapacityRow[] = [];
  for (const a of (allocs as any[]) || []) {
    if (!activeMembershipIds.has(a.membership_id)) continue;
    const userId = membershipToUser.get(a.membership_id) || '';
    const display_name = nameByUser.get(userId) || 'Ismeretlen';
    const baseHours = membershipToHours.get(a.membership_id) ?? 8;

    let used = 0;
    for (const asg of assignments) {
      if (asg.membership_id !== a.membership_id) continue;
      if (asg.business_role !== a.business_role) continue;
      if (excludeProjectId && asg.project_id === excludeProjectId) continue;
      const ov = overlap(asg.start_date, asg.end_date, windowStart, windowEnd);
      if (!ov) continue;
      const days = Math.round((parseISO(ov.end).getTime() - parseISO(ov.start).getTime()) / DAY_MS) + 1;
      used += (asg.allocated_percentage * days) / totalDays;
    }

    const userLeaveDays = leaveDaysByUser.get(userId) || 0;
    const leaveFraction = Math.min(1, userLeaveDays / totalDays);
    const baseAvg = Number(a.percentage);
    const leave_lost = baseAvg * leaveFraction;

    const available = Math.max(0, baseAvg - used - leave_lost);
    const available_hours_per_day = baseHours * (available / 100);

    rows.push({
      membership_id: a.membership_id,
      user_id: userId,
      display_name,
      business_role: a.business_role,
      base_percentage: baseAvg,
      used_percentage: +used.toFixed(2),
      leave_deduction: +leave_lost.toFixed(2),
      available_percentage: +available.toFixed(2),
      base_working_hours: baseHours,
      available_hours_per_day: +available_hours_per_day.toFixed(2),
    });
  }

  const byRole = new Map<string, PositionSummary>();
  for (const r of rows) {
    const cur = byRole.get(r.business_role) || {
      business_role: r.business_role,
      total_base: 0,
      total_used: 0,
      total_leave_deduction: 0,
      total_available: 0,
      total_base_hours: 0,
      total_available_hours: 0,
      member_count: 0,
    };
    cur.total_base += r.base_percentage;
    cur.total_used += r.used_percentage;
    cur.total_leave_deduction += r.leave_deduction;
    cur.total_available += r.available_percentage;
    cur.total_base_hours += r.base_working_hours * (r.base_percentage / 100);
    cur.total_available_hours += r.available_hours_per_day;
    cur.member_count += 1;
    byRole.set(r.business_role, cur);
  }

  const positions = Array.from(byRole.values())
    .map((p) => ({
      ...p,
      total_base: +p.total_base.toFixed(2),
      total_used: +p.total_used.toFixed(2),
      total_leave_deduction: +p.total_leave_deduction.toFixed(2),
      total_available: +p.total_available.toFixed(2),
      total_base_hours: +p.total_base_hours.toFixed(2),
      total_available_hours: +p.total_available_hours.toFixed(2),
    }))
    .sort((a, b) => a.business_role.localeCompare(b.business_role));

  return { rows, positions };
}

export function sortCandidatesForRequirement(
  candidates: CapacityRow[],
  requiredPercentage: number,
): CapacityRow[] {
  const isFullTime = requiredPercentage >= 90;
  const arr = [...candidates];
  if (isFullTime) {
    arr.sort((a, b) => b.available_percentage - a.available_percentage);
    return arr;
  }
  arr.sort((a, b) => {
    const aHas = a.available_percentage >= requiredPercentage ? 0 : 1;
    const bHas = b.available_percentage >= requiredPercentage ? 0 : 1;
    if (aHas !== bHas) return aHas - bHas;
    const da = Math.abs(a.available_percentage - requiredPercentage);
    const db = Math.abs(b.available_percentage - requiredPercentage);
    return da - db;
  });
  return arr;
}

export interface RequirementFulfillment {
  business_role: string;
  required: number;
  assigned: number;
  gap: number;
}

export function summarizeRequirements(
  requirements: { business_role: string; required_percentage: number }[],
  assignments: { business_role: string; allocated_percentage: number }[],
): RequirementFulfillment[] {
  return requirements.map((r) => {
    const assigned = assignments
      .filter((a) => a.business_role === r.business_role)
      .reduce((s, a) => s + Number(a.allocated_percentage || 0), 0);
    const required = Number(r.required_percentage || 0);
    return {
      business_role: r.business_role,
      required,
      assigned: +assigned.toFixed(2),
      gap: +(required - assigned).toFixed(2),
    };
  });
}
