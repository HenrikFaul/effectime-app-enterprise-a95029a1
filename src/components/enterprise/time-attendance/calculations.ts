/**
 * Time Attendance — client-side calculation helpers.
 *
 * These mirror the authoritative server-side logic in the DB function
 * `attendance_recompute_totals`. They are used for:
 *  - live UI preview while the user edits a segment,
 *  - validation hints before submitting to the server.
 *
 * The server is the source of truth: after every mutation we re-fetch the
 * server-recomputed totals (the RPC writes them into `periods.totals`).
 */

import type { AttendanceSegment, OnCallWindow, AttendancePeriodTotals } from './types';

const HOURS_MS = 3_600_000;

export const NIGHT_START_HOUR = 22; // 22:00
export const NIGHT_END_HOUR = 6;   // 06:00 next day
export const STANDBY_MULTIPLIER = 0.20;
export const DEFAULT_DAILY_HOURS = 8;

export function durationHours(startsAt: string, endsAt: string): number {
  const a = new Date(startsAt).getTime();
  const b = new Date(endsAt).getTime();
  if (!isFinite(a) || !isFinite(b) || b <= a) return 0;
  return (b - a) / HOURS_MS;
}

export function isWeekendDate(d: Date): boolean {
  const dow = d.getDay();
  return dow === 0 || dow === 6;
}

/**
 * Detect if a segment overlaps the night window [22:00, 06:00).
 * Returns the night portion in hours (handles cross-midnight ranges).
 */
export function nightHoursInRange(startsAt: string, endsAt: string): number {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (end <= start) return 0;

  let nightMs = 0;
  // Walk hour-by-hour; cheap enough for typical single-day segments.
  for (let t = start.getTime(); t < end.getTime(); t += HOURS_MS) {
    const probe = new Date(Math.min(t + HOURS_MS, end.getTime()));
    const slice = new Date(t);
    const sliceHour = slice.getHours();
    const isNightSlice = sliceHour >= NIGHT_START_HOUR || sliceHour < NIGHT_END_HOUR;
    if (isNightSlice) nightMs += probe.getTime() - t;
  }
  return nightMs / HOURS_MS;
}

/**
 * Detect overlapping segments — returns array of `[a, b]` index pairs that overlap.
 */
export function findOverlaps<T extends { starts_at: string; ends_at: string }>(segments: T[]): [number, number][] {
  const sorted = segments
    .map((s, i) => ({ i, start: new Date(s.starts_at).getTime(), end: new Date(s.ends_at).getTime() }))
    .sort((a, b) => a.start - b.start);
  const out: [number, number][] = [];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].start < sorted[i - 1].end) {
      out.push([sorted[i - 1].i, sorted[i].i]);
    }
  }
  return out;
}

export interface PreviewInput {
  segments: AttendanceSegment[];
  oncallWindows: OnCallWindow[];
  expectedHours: number;
  leaveDays: number;
}

/**
 * Preview totals client-side. Mirrors `attendance_recompute_totals`.
 */
export function previewTotals(input: PreviewInput): AttendancePeriodTotals {
  let regular = 0;
  let overtime = 0;
  let weekendOvertime = 0;
  let night = 0;
  let intervention = 0;
  let breakHours = 0;

  for (const s of input.segments) {
    const h = durationHours(s.starts_at, s.ends_at);
    if (h <= 0) continue;
    if (s.segment_type === 'break') { breakHours += h; continue; }
    if (s.segment_type === 'oncall_intervention') { intervention += h; continue; }
    if (s.is_night) { night += h; }
    if (s.is_weekend && (s.segment_type === 'overtime' || s.segment_type === 'regular')) {
      weekendOvertime += h;
    } else if (s.segment_type === 'overtime') {
      overtime += h;
    } else if (s.segment_type === 'regular' && !s.is_night) {
      regular += h;
    } else if (s.segment_type === 'regular' && s.is_night) {
      // night-flagged regular still counts toward worked hours
      regular += h;
    }
  }

  let standbyRaw = 0;
  for (const w of input.oncallWindows) {
    standbyRaw += durationHours(w.starts_at, w.ends_at);
  }
  // Active intervention time during a window is NOT standby
  standbyRaw = Math.max(standbyRaw - intervention, 0);
  const standbyCompensated = standbyRaw * STANDBY_MULTIPLIER;

  const leaveHours = input.leaveDays * DEFAULT_DAILY_HOURS;
  const expectedAfterLeave = Math.max(input.expectedHours - leaveHours, 0);
  const workedHours = regular + overtime + weekendOvertime + intervention;
  const payrollTotal = workedHours + standbyCompensated;

  return {
    regular_hours: round2(regular),
    overtime_hours: round2(overtime),
    weekend_overtime_hours: round2(weekendOvertime),
    night_hours: round2(night),
    oncall_intervention_hours: round2(intervention),
    oncall_standby_hours: round2(standbyRaw),
    oncall_standby_compensated_hours: round2(standbyCompensated),
    break_hours: round2(breakHours),
    expected_hours: round2(input.expectedHours),
    leave_days: round2(input.leaveDays),
    leave_hours: round2(leaveHours),
    expected_after_leave: round2(expectedAfterLeave),
    worked_hours: round2(workedHours),
    payroll_total_hours: round2(payrollTotal),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Validate a candidate segment against existing segments and basic invariants.
 * Returns an array of human-readable error messages (empty if OK).
 */
export function validateSegment(
  candidate: { starts_at: string; ends_at: string },
  existing: AttendanceSegment[],
  ignoreId?: string,
): string[] {
  const errors: string[] = [];
  const a = new Date(candidate.starts_at).getTime();
  const b = new Date(candidate.ends_at).getTime();
  if (!isFinite(a) || !isFinite(b)) errors.push('Érvénytelen dátum/időpont.');
  if (b <= a) errors.push('A vége nem lehet korábbi vagy egyenlő a kezdéssel.');
  if ((b - a) / HOURS_MS > 24) errors.push('Egy szegmens nem lehet hosszabb 24 óránál.');

  for (const s of existing) {
    if (s.id === ignoreId) continue;
    const sa = new Date(s.starts_at).getTime();
    const sb = new Date(s.ends_at).getTime();
    if (a < sb && b > sa) {
      errors.push(`Átfedés egy másik szegmenssel (${s.starts_at} – ${s.ends_at}).`);
      break;
    }
  }
  return errors;
}
