# Calculation rules

The authoritative implementation lives in PostgreSQL (`attendance_recompute_totals`). The client-side preview in `calculations.ts` mirrors it 1:1 and is unit-tested by `src/test/timeAttendanceCalculations.test.ts`.

## Inputs

For one period (one employee, one month):

- `segments` — array of `enterprise_attendance_segments` with `starts_at`, `ends_at`, `segment_type` ∈ {`regular`, `overtime`, `break`, `oncall_intervention`}, plus `is_weekend` and `is_night` flags.
- `oncall_windows` — array of `enterprise_attendance_oncall_windows` with `starts_at`, `ends_at`, `standby_multiplier` (default 0.20).
- `schedule_template` — resolved via fallback chain: explicit → member-default → workspace-default → 8h × Mon-Fri.
- `leave_requests` (existing table) — approved leave overlapping the month is summed via `calc_leave_days(...)`.

## Categories and formulas

Let `H(s)` = duration of a segment in hours (`(ends_at - starts_at) / 3600`).

```
regular_hours          = Σ H(s) where s.segment_type = 'regular'
                                AND NOT s.is_weekend
                                AND NOT s.is_night

overtime_hours         = Σ H(s) where s.segment_type = 'overtime'
                                AND NOT s.is_weekend

weekend_overtime_hours = Σ H(s) where s.is_weekend
                                AND s.segment_type IN ('overtime','regular')

night_hours            = Σ H(s) where s.is_night

oncall_intervention_hours = Σ H(s) where s.segment_type = 'oncall_intervention'

break_hours            = Σ H(s) where s.segment_type = 'break'

standby_raw            = Σ (window_end - window_start) for w in oncall_windows
standby_raw           := MAX(standby_raw - oncall_intervention_hours, 0)
standby_compensated    = standby_raw * 0.20

worked_hours           = regular_hours + overtime_hours + weekend_overtime_hours
                       + oncall_intervention_hours

leave_days             = Σ calc_leave_days(start, end, half_day)
                         for approved leave_requests overlapping the month
leave_hours            = leave_days × 8

expected_hours         = workdays_in_month × expected_daily_hours_from_template
expected_after_leave   = MAX(expected_hours - leave_hours, 0)

payroll_total_hours    = worked_hours + standby_compensated
```

## Worked example — May 2026

A salaried developer with the workspace default schedule (Mon-Fri × 8h):

- **Regular work**: 21 weekdays × 8h = **168h**
- **One Wednesday extra evening**: 18:00–21:00 marked as `overtime` → +3h overtime
- **Saturday on-call**: 08:00–20:00 (12h standby), called in 10:00–12:00 → 2h intervention
- **Approved leave**: 1 day vacation
- **Sunday night fix**: 23:00–02:00 marked `regular` + `is_night=true` → +3h, all of it night

Computed totals:

| Category | Hours |
|----------|-------|
| `regular_hours` | 168 |
| `overtime_hours` | 3 |
| `weekend_overtime_hours` | 0 (no `is_weekend` regular/overtime — Sunday was night, not weekend-overtime in this example unless flagged) |
| `night_hours` | 3 |
| `oncall_intervention_hours` | 2 |
| `oncall_standby_hours` | 12 − 2 = **10** |
| `oncall_standby_compensated_hours` | 10 × 0.20 = **2.00** |
| `worked_hours` | 168 + 3 + 0 + 2 = **173** |
| `leave_hours` | 8 |
| `expected_hours` | 21 × 8 = **168** |
| `expected_after_leave` | 168 − 8 = **160** |
| `payroll_total_hours` | 173 + 2 = **175** |

## Edge cases

| Case | Behavior |
|------|----------|
| Cross-midnight segment | A single segment may span two dates; `work_date` is the start date. Hours are summed correctly because we use `EXTRACT(EPOCH ...)`. |
| Intervention longer than standby window | `standby_raw` is clamped to ≥0, never negative. |
| Multiple interventions in one window | Sum of all intervention hours is subtracted from window length. |
| Leave on same day as partial work | Both are counted: leave reduces expected, segments add to worked. They never double-count, but worked + leave_hours can legitimately exceed expected (signals user error). |
| Approved leave that is half-day | `calc_leave_days(...)` already returns 0.5 — leave_hours = 0.5 × 8 = 4. |
| No template configured | Falls back to 8h × Mon-Fri (ISO weekdays 1-5). |
| Period with no segments | Worked hours = 0; payroll total = 0; expected_after_leave still computed. |
| Recompute on every edit | Each `attendance_upsert_segment` / `attendance_delete_segment` / `attendance_upsert_oncall_window` call ends with `attendance_recompute_totals(period_id)`. The cached `totals` jsonb on the period is always fresh. |

## Round-trip guarantee

Whenever the UI reads `period.totals`, it reads the **server-side** computed values. The client-side `previewTotals(...)` is for instant UX feedback only; the server is the source of truth, so an export will never disagree with what was visible during entry.

## Multiplier policy

Currently the standby multiplier is hardcoded to **0.20** in `attendance_recompute_totals`, even though `enterprise_attendance_oncall_windows.standby_multiplier` allows per-window override. This is intentional in v1 to keep payroll handoff predictable. To make it per-window, change line:

```sql
v_standby_compensated := v_standby_raw * 0.20;
```

to:

```sql
SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (w.ends_at - w.starts_at))/3600.0 * w.standby_multiplier), 0)
INTO v_standby_compensated
FROM enterprise_attendance_oncall_windows w WHERE w.period_id = p_period_id;
v_standby_compensated := GREATEST(v_standby_compensated - v_oncall_intervention * 0.20, 0);
```

…and update the docs and tests accordingly.
