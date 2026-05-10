# Time Attendance & Payroll Preparation

A complete workspace-scoped time logging, overtime tracking, on-call management, monthly confirmation, and payroll-export module.

## Documentation index

| File | Audience | Purpose |
|------|----------|---------|
| [`business-overview.md`](./business-overview.md) | All | Why this module exists, scope, key concepts |
| [`employee-guide.md`](./employee-guide.md) | Employees | How to log time, submit monthly sheets |
| [`admin-guide.md`](./admin-guide.md) | Owners / resource assistants | How to review, approve, lock, export |
| [`calculation-rules.md`](./calculation-rules.md) | All technical roles | Formulas for hours, overtime, on-call, night, leave |
| [`payroll-export.md`](./payroll-export.md) | Payroll / accounting | Export columns, semantics, format |
| [`data-model.md`](./data-model.md) | Engineering | Tables, relationships, statuses |
| [`api-contracts.md`](./api-contracts.md) | Engineering | RPC contracts, request/response shapes |
| [`audit-trail.md`](./audit-trail.md) | Compliance / engineering | Auditable events and corrections |
| [`future-hardware-support.md`](./future-hardware-support.md) | Engineering / product | How to add badge / clock device ingestion later without rearchitecting |

## Quick links inside the app

- **Employee**: top nav → **Időnyilvántartás** → "Saját idő"
- **Admin**: top nav → **Időnyilvántartás** → "Csapat áttekintés" → export gombok
- **Audit**: minden szerkesztés és státuszváltás bekerül az `enterprise_attendance_audit` táblába

## State machine (one line each)

```
draft  ──submit──▶  submitted  ──approve──▶  approved  ──lock──▶  locked  ──export──▶  exported
                       │                          │                    │
                       │ ◀──return (admin) ────── │                    │
                       │                                              │
                       └──reopen (admin) ─────────────────────────────┘
```

## Implementation files

```
supabase/migrations/<timestamp>_create_time_attendance_module.sql
supabase/migrations/<timestamp>_create_time_attendance_rpcs.sql
src/components/enterprise/time-attendance/
  ├── TimeAttendancePage.tsx        # entry point (employee/admin tab)
  ├── EmployeeMonthView.tsx         # personal monthly grid
  ├── DayEditorDialog.tsx           # add/edit/delete segments for one day
  ├── OnCallDialog.tsx              # add an on-call window
  ├── AdminOverview.tsx             # workspace-wide period list + export
  ├── TotalsSummary.tsx             # 8-card totals widget
  ├── api.ts                        # RPC client wrappers
  ├── calculations.ts               # client-side preview logic (matches DB)
  └── types.ts                      # shared TS types
src/test/timeAttendanceCalculations.test.ts  # 18 calc unit tests
```
