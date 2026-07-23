/**
 * Time Attendance — Supabase RPC client wrappers.
 *
 * All writes go through SECURITY DEFINER RPCs that enforce the period state
 * machine and the workspace permission model. The client never writes to the
 * tables directly.
 */

import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import {
  ExportPaginationError,
  fetchCompleteExportRows,
  MAX_EXPORT_SOURCE_ROWS,
} from '@/lib/exportPagination';
import {
  defineExportRowSchema,
  matchesExportRowSchema,
} from '@/lib/exportRowValidation';
import type {
  AttendancePeriod, AttendanceSegment, OnCallWindow, AdminPeriodRow,
  PayrollExportRow, AttendancePeriodStatus, AttendanceSegmentType, ScheduleTemplate,
} from './types';

const sb = supabase;

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
  return data as unknown as AttendancePeriod | null;
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
  return (data || []) as unknown as AdminPeriodRow[];
}

type PayrollExportBusinessFields = Omit<PayrollExportRow, 'membership_id' | 'user_id'>;

const PAYROLL_EXPORT_ROW_SCHEMA = defineExportRowSchema<PayrollExportBusinessFields>({
  email: 'nonEmptyString',
  display_name: 'string',
  team: 'string',
  business_role: 'string',
  office_name: 'string',
  period_label: 'nonEmptyString',
  status: 'nonEmptyString',
  regular_hours: 'numberLike',
  overtime_hours: 'numberLike',
  weekend_overtime_hours: 'numberLike',
  night_hours: 'numberLike',
  oncall_intervention_hours: 'numberLike',
  oncall_standby_hours: 'numberLike',
  oncall_standby_compensated_hours: 'numberLike',
  expected_hours: 'numberLike',
  leave_days: 'numberLike',
  leave_hours: 'numberLike',
  expected_after_leave: 'numberLike',
  worked_hours: 'numberLike',
  payroll_total_hours: 'numberLike',
  submitted_at: 'nullableString',
  approved_at: 'nullableString',
  locked_at: 'nullableString',
});

const ATTENDANCE_PERIOD_STATUSES = new Set<AttendancePeriodStatus>([
  'draft',
  'submitted',
  'returned',
  'approved',
  'locked',
  'exported',
]);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

const PAYROLL_NUMERIC_FIELDS = [
  'regular_hours',
  'overtime_hours',
  'weekend_overtime_hours',
  'night_hours',
  'oncall_intervention_hours',
  'oncall_standby_hours',
  'oncall_standby_compensated_hours',
  'expected_hours',
  'leave_days',
  'leave_hours',
  'expected_after_leave',
  'worked_hours',
  'payroll_total_hours',
] as const satisfies readonly (keyof PayrollExportRow)[];

function isNullableIsoTimestamp(value: unknown): value is string | null {
  if (value === null) return true;
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}[T ]/u.test(value)
    && !Number.isNaN(Date.parse(value));
}

function requestedPeriodLabel(year: number, month: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
}

const PAYROLL_ARITHMETIC_TOLERANCE = 0.05;

function nearlyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= PAYROLL_ARITHMETIC_TOLERANCE;
}

function hasConsistentPayrollTotals(row: Record<string, unknown>): boolean {
  if (!PAYROLL_NUMERIC_FIELDS.every((field) => (
    typeof row[field] === 'number'
    && Number.isFinite(row[field])
    && row[field] >= 0
  ))) return false;

  const value = (field: typeof PAYROLL_NUMERIC_FIELDS[number]) => row[field] as number;
  const workedHours = value('regular_hours')
    + value('overtime_hours')
    + value('weekend_overtime_hours')
    + value('oncall_intervention_hours');
  const expectedAfterLeave = Math.max(
    value('expected_hours') - value('leave_hours'),
    0,
  );
  const payrollTotalHours = value('worked_hours')
    + value('oncall_standby_compensated_hours');

  return nearlyEqual(value('worked_hours'), workedHours)
    && nearlyEqual(value('expected_after_leave'), expectedAfterLeave)
    && nearlyEqual(value('payroll_total_hours'), payrollTotalHours);
}

function isPayrollExportRowForRequest(
  value: unknown,
  expectedPeriod: string,
  onlyLocked: boolean,
): value is PayrollExportRow {
  if (!matchesExportRowSchema(value, PAYROLL_EXPORT_ROW_SCHEMA)) return false;

  const row = value as Record<string, unknown>;
  const status = row.status;
  return typeof row.membership_id === 'string'
    && UUID_PATTERN.test(row.membership_id)
    && typeof row.user_id === 'string'
    && UUID_PATTERN.test(row.user_id)
    && row.period_label === expectedPeriod
    && typeof status === 'string'
    && ATTENDANCE_PERIOD_STATUSES.has(status as AttendancePeriodStatus)
    && (!onlyLocked || status === 'locked' || status === 'exported')
    && hasConsistentPayrollTotals(row)
    && isNullableIsoTimestamp(row.submitted_at)
    && isNullableIsoTimestamp(row.approved_at)
    && isNullableIsoTimestamp(row.locked_at)
    && (
      (status !== 'submitted' && status !== 'returned' && status !== 'approved'
        && status !== 'locked' && status !== 'exported')
      || row.submitted_at !== null
    )
    && (
      (status !== 'approved' && status !== 'locked' && status !== 'exported')
      || row.approved_at !== null
    )
    && ((status !== 'locked' && status !== 'exported') || row.locked_at !== null);
}

/**
 * Persists and exports only the documented contract. Provider responses may
 * grow additively, but an unexpected future field must never be copied into an
 * immutable payroll snapshot (where it could become an accidental PII leak).
 */
function projectPayrollExportRow(row: PayrollExportRow): PayrollExportRow {
  return {
    membership_id: row.membership_id,
    user_id: row.user_id,
    email: row.email,
    display_name: row.display_name,
    team: row.team,
    business_role: row.business_role,
    office_name: row.office_name,
    period_label: row.period_label,
    status: row.status,
    regular_hours: row.regular_hours,
    overtime_hours: row.overtime_hours,
    weekend_overtime_hours: row.weekend_overtime_hours,
    night_hours: row.night_hours,
    oncall_intervention_hours: row.oncall_intervention_hours,
    oncall_standby_hours: row.oncall_standby_hours,
    oncall_standby_compensated_hours: row.oncall_standby_compensated_hours,
    expected_hours: row.expected_hours,
    leave_days: row.leave_days,
    leave_hours: row.leave_hours,
    expected_after_leave: row.expected_after_leave,
    worked_hours: row.worked_hours,
    payroll_total_hours: row.payroll_total_hours,
    submitted_at: row.submitted_at,
    approved_at: row.approved_at,
    locked_at: row.locked_at,
  };
}

export async function fetchPayrollExport(workspaceId: string, year: number, month: number, onlyLocked: boolean): Promise<PayrollExportRow[]> {
  const params = {
    p_workspace_id: workspaceId, p_year: year, p_month: month, p_only_locked: onlyLocked,
  };
  const expectedPeriod = requestedPeriodLabel(year, month);

  const rows = await fetchCompleteExportRows<PayrollExportRow>({
    fetchPage: (from, to, includeExactCount) => sb
      .rpc(
        'attendance_payroll_export',
        params,
        includeExactCount ? { count: 'exact' } : undefined,
      )
      .order('membership_id', { ascending: true })
      .order('period_label', { ascending: true })
      .range(from, to),
    // The linked function is VOLATILE, so this remains a one-row POST count
    // probe instead of relying on a HEAD request that PostgREST cannot serve.
    fetchFinalCount: () => sb
      .rpc('attendance_payroll_export', params, { count: 'exact' })
      .range(0, 0),
    identity: (row) => `${row.membership_id}\u0000${row.period_label}`,
    validateRow: (row): row is PayrollExportRow => (
      isPayrollExportRowForRequest(row, expectedPeriod, onlyLocked)
    ),
    maxRows: MAX_EXPORT_SOURCE_ROWS,
  });

  const seenEmails = new Set<string>();
  for (const row of rows) {
    const normalizedEmail = row.email.trim().toLocaleLowerCase('en-US');
    if (seenEmails.has(normalizedEmail)) {
      throw new ExportPaginationError('DUPLICATE_ROW_ID');
    }
    seenEmails.add(normalizedEmail);
  }

  return rows.map(projectPayrollExportRow);
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
    p_payload: rows as unknown as Json,
  });
  if (error) throw error;
  if (typeof data !== 'string' || !UUID_PATTERN.test(data)) {
    throw new Error('Unable to record payroll export.');
  }
  return data;
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
  _userId: string, // auth.uid() is resolved server-side by the SECURITY DEFINER RPC
  officeId: string,
  shiftDate: string,
): Promise<void> {
  // Route through a SECURITY DEFINER RPC so that:
  //   • Regular employees can write (table RLS blocks non-admin direct writes)
  //   • business_role is populated from the membership (satisfies shift_role_or_skill CHECK)
  //   • The upsert is keyed on uq_shift_user_date (workspace_id, user_id, shift_date)
  const { error } = await sb.rpc('attendance_upsert_site_assignment', {
    p_workspace_id:  workspaceId,
    p_membership_id: membershipId,
    p_office_id:     officeId,
    p_shift_date:    shiftDate,
  });
  if (error) throw error;
}

export async function removeSiteAssignment(
  workspaceId: string,
  membershipId: string,
  shiftDate: string,
): Promise<void> {
  const { error } = await sb.rpc('attendance_remove_site_assignment', {
    p_workspace_id:  workspaceId,
    p_membership_id: membershipId,
    p_shift_date:    shiftDate,
  });
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

export async function fetchScheduleTemplates(workspaceId: string): Promise<ScheduleTemplate[]> {
  const { data, error } = await sb.from('enterprise_attendance_schedule_templates')
    .select('*').eq('workspace_id', workspaceId).is('archived_at', null).order('name');
  if (error) throw error;
  return (data || []) as ScheduleTemplate[];
}
