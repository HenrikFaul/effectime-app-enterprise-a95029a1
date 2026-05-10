/**
 * Time Attendance — shared types
 *
 * The domain mirrors the DB schema in supabase/migrations:
 * - `enterprise_attendance_periods` (one timesheet per member/month)
 * - `enterprise_attendance_segments` (atomic worked-time blocks)
 * - `enterprise_attendance_oncall_windows` (standby blocks; intervention = segment.segment_type='oncall_intervention')
 * - `enterprise_attendance_schedule_templates` (recurring schedule defaults)
 *
 * The architecture deliberately separates raw inputs (segments/windows) from
 * derived totals so that future device-based attendance ingestion can write
 * raw events without colliding with manual entries.
 */

export type AttendancePeriodStatus =
  | 'draft'
  | 'submitted'
  | 'returned'
  | 'approved'
  | 'locked'
  | 'exported';

export type AttendanceSegmentType =
  | 'regular'
  | 'overtime'
  | 'break'
  | 'oncall_intervention';

export interface AttendancePeriodTotals {
  regular_hours: number;
  overtime_hours: number;
  weekend_overtime_hours: number;
  night_hours: number;
  oncall_intervention_hours: number;
  oncall_standby_hours: number;
  oncall_standby_compensated_hours: number;
  break_hours: number;
  expected_hours: number;
  leave_days: number;
  leave_hours: number;
  expected_after_leave: number;
  worked_hours: number;
  payroll_total_hours: number;
}

export interface AttendancePeriod {
  id: string;
  workspace_id: string;
  membership_id: string;
  year: number;
  month: number;
  status: AttendancePeriodStatus;
  schedule_template_id: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  locked_at: string | null;
  exported_at: string | null;
  return_reason: string | null;
  totals: AttendancePeriodTotals;
}

export interface AttendanceSegment {
  id: string;
  period_id: string;
  workspace_id: string;
  work_date: string;
  starts_at: string;
  ends_at: string;
  segment_type: AttendanceSegmentType;
  is_weekend: boolean;
  is_night: boolean;
  oncall_window_id: string | null;
  source: 'manual' | 'device';
  note: string | null;
}

export interface OnCallWindow {
  id: string;
  period_id: string;
  workspace_id: string;
  starts_at: string;
  ends_at: string;
  is_weekend: boolean;
  is_night: boolean;
  standby_multiplier: number;
  note: string | null;
}

export interface ScheduleTemplate {
  id: string;
  workspace_id: string;
  membership_id: string | null;
  name: string;
  is_default: boolean;
  weekday_mask: number;
  start_time: string;
  end_time: string;
  break_minutes: number;
  expected_daily_hours: number;
  effective_from: string | null;
  effective_to: string | null;
}

export interface AdminPeriodRow {
  period_id: string | null;
  membership_id: string;
  user_id: string;
  display_name: string;
  email: string;
  status: AttendancePeriodStatus | null;
  totals: AttendancePeriodTotals | null;
  submitted_at: string | null;
  approved_at: string | null;
  locked_at: string | null;
  exported_at: string | null;
}

export interface PayrollExportRow {
  membership_id: string;
  user_id: string;
  email: string;
  display_name: string;
  team: string;
  business_role: string;
  office_name: string;
  period_label: string;
  status: string;
  regular_hours: number;
  overtime_hours: number;
  weekend_overtime_hours: number;
  night_hours: number;
  oncall_intervention_hours: number;
  oncall_standby_hours: number;
  oncall_standby_compensated_hours: number;
  expected_hours: number;
  leave_days: number;
  leave_hours: number;
  expected_after_leave: number;
  worked_hours: number;
  payroll_total_hours: number;
  submitted_at: string | null;
  approved_at: string | null;
  locked_at: string | null;
}

export const STATUS_LABELS: Record<AttendancePeriodStatus, string> = {
  draft: 'Vázlat',
  submitted: 'Benyújtva',
  returned: 'Javításra visszaküldve',
  approved: 'Jóváhagyva',
  locked: 'Bérszámfejtésre zárva',
  exported: 'Exportálva',
};

export const STATUS_BADGE_VARIANT: Record<AttendancePeriodStatus, 'outline' | 'default' | 'secondary' | 'destructive'> = {
  draft: 'outline',
  submitted: 'secondary',
  returned: 'destructive',
  approved: 'default',
  locked: 'default',
  exported: 'default',
};
