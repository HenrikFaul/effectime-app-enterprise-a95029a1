# Business overview

## Why this module exists

The product previously tracked **leaves and absences** but had no way to capture **actual work time** from employees, which made it impossible to prepare accurate payroll input. This module closes that gap with a manual time-logging system that:

- Lets each employee log daily worked hours, overtime, weekend work, on-call duty, and night work.
- Lets admins review and approve monthly timesheets before payroll runs.
- Produces an export tailored for the payroll/accounting handoff.
- Keeps a full audit trail of edits and approvals.

The architecture is deliberately decoupled from the UI so a future automatic ingestion path (badge readers, NFC clocks, mobile check-in) can write the same domain entities without UI rework.

## Scope (v1)

In scope:
- Manual time entry (segments per day, multiple per day, split shifts).
- Overtime with separate weekend overtime classification.
- Night work classification (employee-flagged; future automatic detection by 22:00–06:00 window is supported by the helper).
- On-call standby with a 0.20 compensation multiplier and **separate** intervention work tracking.
- Monthly confirmation by employee, approval and lock by admin.
- Leave-aware expected-hours computation (leave reduces expected, never collides with work).
- Payroll export (XLSX + CSV), per-period locking, exported-status advancement.
- Audit trail for every edit / status change.

Out of scope (v1) — but architected for:
- Hardware-event ingestion (see `future-hardware-support.md`).
- Per-role overtime caps and shift-pattern enforcement (data model already supports it via templates).
- Per-employee custom multipliers (currently a workspace-wide 0.20 for standby).

## Key concepts

| Concept | What it is | Where in DB |
|---------|------------|-------------|
| **Period** | One employee's monthly timesheet | `enterprise_attendance_periods` |
| **Segment** | One block of worked time on one day | `enterprise_attendance_segments` |
| **On-call window** | A standby block; may contain 0..N intervention segments | `enterprise_attendance_oncall_windows` |
| **Schedule template** | Recurring expected schedule (workspace-default or member-specific) | `enterprise_attendance_schedule_templates` |
| **Audit event** | Immutable log of every edit / transition | `enterprise_attendance_audit` |
| **Payroll export batch** | Snapshot of an export run | `enterprise_attendance_payroll_exports` |

## Compensation philosophy

Standby and intervention are **operationally and financially distinct**, so they are kept distinct in:

- the data model (window vs segment),
- the calculation engine (`oncall_standby_hours` vs `oncall_intervention_hours`),
- and the payroll export (separate columns).

The default standby multiplier is **0.20**: a 12-hour standby with no intervention is paid as 2.4 hours. If a 2-hour intervention happens within a 12-hour window, standby drops to 10h compensated (10 × 0.20 = 2h) and the 2h are paid at the regular intervention rate.

## Roles & permissions

| Role | Can do |
|------|--------|
| Employee (any active member) | View / edit own draft+returned period; submit; view own audit |
| `resourceAssistant`, `owner` | Approve / lock / export any period; reopen periods; view all audit |
| Anyone else | No access |

All permission checks run **server-side in SECURITY DEFINER RPCs** — the UI's `isAdmin` flag is only for hiding controls.
