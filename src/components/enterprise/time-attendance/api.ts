/**
 * Time Attendance — Supabase RPC client wrappers.
 *
 * All writes go through SECURITY DEFINER RPCs that enforce the period state
 * machine and the workspace permission model. The client never writes to the
 * tables directly.
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  AttendancePeriod, AttendanceSegment, OnCallWindow, AdminPeriodRow,
  PayrollExportRow, AttendancePeriodStatus, AttendanceSegmentType,
} from './types';

const sb = supabase as any;

export async function getOrCreatePeriod(workspaceId: string, year: number, month: number, membershipId?: string): Promise<string> {
  const { data, error } = await sb.rpc('attendance_get_or_create_period', {
    p_workspace_id: workspaceId, p_year: year, p_month: month, p_membership_id: membershipId ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function fetchPeriod(periodId: string): Promise<AttendancePeriod | null> {
  const { data, error } = await sb.from('enterprise_attendance_periods').select('*').eq('id', periodId).maybeSingle();
  if (error) throw error;
  return data as AttendancePeriod | null;
}

export async function fetchSegments(periodId: string): Promise<AttendanceSegment[]> {
  const { data, error } = await sb.from('enterprise_attendance_segments')
    .select('*').eq('period_id', periodId).order('starts_at');
  if (error) throw error;
  return (data || []) as AttendanceSegment[];
}

export async function fetchOnCallWindows(periodId: string): Promise<OnCallWindow[]> {
  const { data, error } = await sb.from('enterprise_attendance_oncall_windows')
    .select('*').eq('period_id', periodId).order('starts_at');
  if (error) throw error;
  return (data || []) as OnCallWindow[];
}

export interface UpsertSegmentInput {
  id?: string | null;
  period_id: string;
  starts_at: string;
  ends_at: string;
  segment_type: AttendanceSegmentType;
  is_weekend: boolean;
  is_night: boolean;
  oncall_window_id?: string | null;
  note?: string | null;
}

export async function upsertSegment(input: UpsertSegmentInput): Promise<string> {
  const { data, error } = await sb.rpc('attendance_upsert_segment', {
    p_segment_id: input.id ?? null,
    p_period_id: input.period_id,
    p_starts_at: input.starts_at,
    p_ends_at: input.ends_at,
    p_segment_type: input.segment_type,
    p_is_weekend: input.is_weekend,
    p_is_night: input.is_night,
    p_oncall_window_id: input.oncall_window_id ?? null,
    p_note: input.note ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function deleteSegment(segmentId: string): Promise<void> {
  const { error } = await sb.rpc('attendance_delete_segment', { p_segment_id: segmentId });
  if (error) throw error;
}

export interface UpsertOnCallInput {
  id?: string | null;
  period_id: string;
  starts_at: string;
  ends_at: string;
  is_weekend: boolean;
  is_night: boolean;
  multiplier?: number;
  note?: string | null;
}

export async function upsertOnCallWindow(input: UpsertOnCallInput): Promise<string> {
  const { data, error } = await sb.rpc('attendance_upsert_oncall_window', {
    p_window_id: input.id ?? null,
    p_period_id: input.period_id,
    p_starts_at: input.starts_at,
    p_ends_at: input.ends_at,
    p_is_weekend: input.is_weekend,
    p_is_night: input.is_night,
    p_multiplier: input.multiplier ?? 0.20,
    p_note: input.note ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function deleteOnCallWindow(windowId: string): Promise<void> {
  const { error } = await sb.rpc('attendance_delete_oncall_window', { p_window_id: windowId });
  if (error) throw error;
}

export async function transitionPeriod(periodId: string, target: AttendancePeriodStatus, reason?: string): Promise<void> {
  const { error } = await sb.rpc('attendance_transition_period', {
    p_period_id: periodId, p_target_status: target, p_reason: reason ?? null,
  });
  if (error) throw error;
}

export async function listWorkspacePeriods(workspaceId: string, year: number, month: number): Promise<AdminPeriodRow[]> {
  const { data, error } = await sb.rpc('attendance_list_workspace_periods', {
    p_workspace_id: workspaceId, p_year: year, p_month: month,
  });
  if (error) throw error;
  return (data || []) as AdminPeriodRow[];
}

export async function fetchPayrollExport(workspaceId: string, year: number, month: number, onlyLocked: boolean): Promise<PayrollExportRow[]> {
  const { data, error } = await sb.rpc('attendance_payroll_export', {
    p_workspace_id: workspaceId, p_year: year, p_month: month, p_only_locked: onlyLocked,
  });
  if (error) throw error;
  return (data || []) as PayrollExportRow[];
}

export async function recordPayrollExport(
  workspaceId: string, year: number, month: number,
  variant: 'summary' | 'detailed', format: 'xlsx' | 'csv',
  rows: PayrollExportRow[],
): Promise<string> {
  const { data, error } = await sb.rpc('attendance_record_export', {
    p_workspace_id: workspaceId, p_year: year, p_month: month,
    p_variant: variant, p_format: format,
    p_member_count: new Set(rows.map(r => r.membership_id)).size,
    p_total_periods: rows.length,
    p_payload: rows,
  });
  if (error) throw error;
  return data as string;
}

// ─── Site-assignment API (enterprise_shift_assignments) ────────────────────

export interface SiteAssignment {
  id: string;
  workspace_id: string;
  membership_id: string;
  user_id: string;
  office_id: string;
  shift_date: string;
}

export async function fetchShiftAssignmentsForMember(
  workspaceId: string,
  membershipId: string,
  from: string,
  to: string,
): Promise<SiteAssignment[]> {
  const { data, error } = await sb
    .from('enterprise_shift_assignments')
    .select('id, workspace_id, membership_id, user_id, office_id, shift_date')
    .eq('workspace_id', workspaceId)
    .eq('membership_id', membershipId)
    .gte('shift_date', from)
    .lte('shift_date', to);
  if (error) throw error;
  return (data || []) as SiteAssignment[];
}

export async function upsertSiteAssignment(
  workspaceId: string,
  membershipId: string,
  userId: string,
  officeId: string,
  shiftDate: string,
): Promise<void> {
  // Single atomic upsert keyed on (workspace_id, user_id, shift_date) — the
  // existing UNIQUE constraint `uq_shift_user_date` on the table.
  // Avoids the previous delete-then-insert pattern, which could leave no
  // assignment if a network error occurred between the two operations.
  const { error } = await sb
    .from('enterprise_shift_assignments')
    .upsert(
      {
        workspace_id: workspaceId,
        membership_id: membershipId,
        user_id: userId,
        office_id: officeId,
        shift_date: shiftDate,
        created_by: userId,
      },
      { onConflict: 'workspace_id,user_id,shift_date' },
    );
  if (error) throw error;
}

export async function removeSiteAssignment(
  workspaceId: string,
  membershipId: string,
  shiftDate: string,
): Promise<void> {
  const { error } = await sb
    .from('enterprise_shift_assignments')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('membership_id', membershipId)
    .eq('shift_date', shiftDate);
  if (error) throw error;
}

export interface OfficeOption {
  id: string;
  name: string;
  city: string | null;
}

export async function fetchOfficesForWorkspace(workspaceId: string): Promise<OfficeOption[]> {
  const { data, error } = await sb
    .from('enterprise_offices')
    .select('id, name, city')
    .eq('workspace_id', workspaceId)
    .order('name');
  if (error) throw error;
  return (data || []) as OfficeOption[];
}

export async function fetchScheduleTemplates(workspaceId: string): Promise<any[]> {
  const { data, error } = await sb.from('enterprise_attendance_schedule_templates')
    .select('*').eq('workspace_id', workspaceId).is('archived_at', null).order('name');
  if (error) throw error;
  return data || [];
}
