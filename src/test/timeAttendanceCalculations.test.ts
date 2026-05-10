/**
 * Time Attendance — calculation engine unit tests.
 *
 * These tests pin the *client-side preview* logic in
 * `src/components/enterprise/time-attendance/calculations.ts`.
 * The authoritative server-side function (`attendance_recompute_totals` in
 * Postgres) is intentionally implemented with the same rules.
 */

import { describe, it, expect } from 'vitest';
import {
  durationHours, isWeekendDate, nightHoursInRange, findOverlaps,
  previewTotals, validateSegment, STANDBY_MULTIPLIER,
} from '../components/enterprise/time-attendance/calculations';
import type { AttendanceSegment, OnCallWindow } from '../components/enterprise/time-attendance/types';

const seg = (overrides: Partial<AttendanceSegment>): AttendanceSegment => ({
  id: overrides.id || 'seg-' + Math.random(),
  period_id: 'p',
  workspace_id: 'w',
  work_date: '2026-05-01',
  starts_at: '2026-05-01T09:00:00Z',
  ends_at: '2026-05-01T17:00:00Z',
  segment_type: 'regular',
  is_weekend: false,
  is_night: false,
  oncall_window_id: null,
  source: 'manual',
  note: null,
  ...overrides,
});

describe('durationHours', () => {
  it('returns hours between two ISO timestamps', () => {
    expect(durationHours('2026-05-01T09:00:00Z', '2026-05-01T17:00:00Z')).toBe(8);
  });
  it('returns 0 for invalid range', () => {
    expect(durationHours('2026-05-01T17:00:00Z', '2026-05-01T09:00:00Z')).toBe(0);
  });
});

describe('isWeekendDate', () => {
  it('detects Saturday', () => { expect(isWeekendDate(new Date('2026-05-02'))).toBe(true); });
  it('detects Sunday', () => { expect(isWeekendDate(new Date('2026-05-03'))).toBe(true); });
  it('rejects weekday', () => { expect(isWeekendDate(new Date('2026-05-01'))).toBe(false); });
});

describe('nightHoursInRange', () => {
  it('counts post-22:00 hours as night', () => {
    // 21:00 - 23:00 local — covers 1h of night (22:00-23:00)
    const start = new Date(2026, 4, 1, 21, 0).toISOString();
    const end = new Date(2026, 4, 1, 23, 0).toISOString();
    expect(nightHoursInRange(start, end)).toBeCloseTo(1, 1);
  });
  it('counts pre-06:00 hours as night', () => {
    const start = new Date(2026, 4, 2, 4, 0).toISOString();
    const end = new Date(2026, 4, 2, 7, 0).toISOString();
    expect(nightHoursInRange(start, end)).toBeCloseTo(2, 1);
  });
});

describe('findOverlaps', () => {
  it('detects two overlapping segments', () => {
    const segs = [
      seg({ starts_at: '2026-05-01T09:00:00Z', ends_at: '2026-05-01T13:00:00Z' }),
      seg({ starts_at: '2026-05-01T12:00:00Z', ends_at: '2026-05-01T17:00:00Z' }),
    ];
    expect(findOverlaps(segs)).toHaveLength(1);
  });
  it('returns empty for non-overlapping', () => {
    const segs = [
      seg({ starts_at: '2026-05-01T09:00:00Z', ends_at: '2026-05-01T12:00:00Z' }),
      seg({ starts_at: '2026-05-01T14:00:00Z', ends_at: '2026-05-01T17:00:00Z' }),
    ];
    expect(findOverlaps(segs)).toHaveLength(0);
  });
});

describe('validateSegment', () => {
  const existing = [seg({ id: 's1', starts_at: '2026-05-01T09:00:00Z', ends_at: '2026-05-01T13:00:00Z' })];
  it('rejects end before start', () => {
    expect(validateSegment({ starts_at: '2026-05-01T17:00:00Z', ends_at: '2026-05-01T09:00:00Z' }, [])).not.toEqual([]);
  });
  it('rejects overlap with existing segment', () => {
    const errs = validateSegment({ starts_at: '2026-05-01T11:00:00Z', ends_at: '2026-05-01T15:00:00Z' }, existing);
    expect(errs.length).toBeGreaterThan(0);
  });
  it('allows non-overlapping segment', () => {
    const errs = validateSegment({ starts_at: '2026-05-01T14:00:00Z', ends_at: '2026-05-01T18:00:00Z' }, existing);
    expect(errs).toEqual([]);
  });
  it('skips overlap check for the segment being edited (ignoreId)', () => {
    const errs = validateSegment({ starts_at: '2026-05-01T10:00:00Z', ends_at: '2026-05-01T12:00:00Z' }, existing, 's1');
    expect(errs).toEqual([]);
  });
});

describe('previewTotals', () => {
  it('sums regular weekday hours', () => {
    const t = previewTotals({
      segments: [seg({ starts_at: '2026-05-01T09:00:00Z', ends_at: '2026-05-01T17:00:00Z' })],
      oncallWindows: [],
      expectedHours: 168,
      leaveDays: 0,
    });
    expect(t.regular_hours).toBe(8);
    expect(t.worked_hours).toBe(8);
    expect(t.payroll_total_hours).toBe(8);
  });

  it('classifies weekend overtime separately', () => {
    const t = previewTotals({
      segments: [seg({ segment_type: 'overtime', is_weekend: true,
        starts_at: '2026-05-02T09:00:00Z', ends_at: '2026-05-02T13:00:00Z',
        work_date: '2026-05-02' })],
      oncallWindows: [], expectedHours: 0, leaveDays: 0,
    });
    expect(t.weekend_overtime_hours).toBe(4);
    expect(t.overtime_hours).toBe(0); // weekend bucket, not plain overtime
  });

  it('applies 0.20 standby multiplier and subtracts intervention hours', () => {
    const window: OnCallWindow = {
      id: 'w1', period_id: 'p', workspace_id: 'w',
      starts_at: '2026-05-02T08:00:00Z', ends_at: '2026-05-02T20:00:00Z', // 12h window
      is_weekend: true, is_night: false, standby_multiplier: 0.20, note: null,
    };
    const intervention = seg({
      id: 's-int', segment_type: 'oncall_intervention',
      starts_at: '2026-05-02T10:00:00Z', ends_at: '2026-05-02T12:00:00Z', // 2h
      work_date: '2026-05-02', is_weekend: true, oncall_window_id: 'w1',
    });
    const t = previewTotals({ segments: [intervention], oncallWindows: [window], expectedHours: 0, leaveDays: 0 });
    // Standby = 12h - 2h intervention = 10h. Compensated = 10h × 0.20 = 2h.
    expect(t.oncall_standby_hours).toBe(10);
    expect(t.oncall_standby_compensated_hours).toBe(round2(10 * STANDBY_MULTIPLIER));
    expect(t.oncall_intervention_hours).toBe(2);
    // Payroll total = worked (intervention 2h) + standby compensated (2h) = 4h
    expect(t.payroll_total_hours).toBe(4);
  });

  it('reduces expected hours by leave days × 8', () => {
    const t = previewTotals({ segments: [], oncallWindows: [], expectedHours: 160, leaveDays: 5 });
    expect(t.leave_hours).toBe(40);
    expect(t.expected_after_leave).toBe(120);
  });

  it('does not let standby go negative when intervention exceeds raw window', () => {
    const window: OnCallWindow = {
      id: 'w', period_id: 'p', workspace_id: 'w',
      starts_at: '2026-05-02T10:00:00Z', ends_at: '2026-05-02T11:00:00Z', // 1h
      is_weekend: false, is_night: false, standby_multiplier: 0.20, note: null,
    };
    const intervention = seg({
      segment_type: 'oncall_intervention',
      starts_at: '2026-05-02T10:00:00Z', ends_at: '2026-05-02T13:00:00Z', // 3h
      oncall_window_id: 'w', work_date: '2026-05-02',
    });
    const t = previewTotals({ segments: [intervention], oncallWindows: [window], expectedHours: 0, leaveDays: 0 });
    expect(t.oncall_standby_hours).toBe(0);
    expect(t.oncall_standby_compensated_hours).toBe(0);
    expect(t.oncall_intervention_hours).toBe(3);
  });
});

function round2(n: number): number { return Math.round(n * 100) / 100; }
