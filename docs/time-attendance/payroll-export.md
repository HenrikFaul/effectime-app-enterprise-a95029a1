# Payroll export — column reference

Stable schema for accountant / payroll handoff. **Never reorder columns**. Add new columns at the end.

| # | Column (Hungarian) | Source field | Type | Notes |
|---|---------------------|--------------|------|-------|
| 1 | Email | `auth.users.email` | text | Unique identifier per employee |
| 2 | Név | `profiles.display_name` | text | May be empty if user never set it |
| 3 | Csapat | `enterprise_memberships.team` | text | |
| 4 | Munkakör | `enterprise_memberships.business_role` | text | |
| 5 | Telephely | `enterprise_offices.name` | text | |
| 6 | Időszak | derived | `YYYY-MM` | E.g. `2026-05` |
| 7 | Státusz | `enterprise_attendance_periods.status` | enum | Always `locked` or `exported` for the XLSX path |
| 8 | Normál óra | `totals.regular_hours` | number | Mon-Fri non-night non-weekend regular |
| 9 | Túlóra | `totals.overtime_hours` | number | Weekday overtime |
| 10 | Hétvégi túlóra | `totals.weekend_overtime_hours` | number | Weekend regular + overtime |
| 11 | Éjszakai óra | `totals.night_hours` | number | Any segment with `is_night=true` |
| 12 | Készenléti behívás óra | `totals.oncall_intervention_hours` | number | Active work during standby |
| 13 | Készenlét nyers óra | `totals.oncall_standby_hours` | number | Window minus intervention |
| 14 | Készenlét bér-óra (×0.20) | `totals.oncall_standby_compensated_hours` | number | The figure to pay for standby |
| 15 | Elvárt óra | `totals.expected_hours` | number | From schedule template |
| 16 | Szabadság nap | `totals.leave_days` | number | Approved leave days overlapping the month |
| 17 | Szabadság óra | `totals.leave_hours` | number | leave_days × 8 |
| 18 | Elvárt szab. után | `totals.expected_after_leave` | number | expected − leave_hours |
| 19 | Ledolgozott óra | `totals.worked_hours` | number | regular + overtime + weekend_ot + intervention |
| 20 | Bér-össz óra | `totals.payroll_total_hours` | number | worked + standby_compensated |
| 21 | Benyújtva | `submitted_at` | timestamptz | ISO; nullable |
| 22 | Jóváhagyva | `approved_at` | timestamptz | ISO; nullable |
| 23 | Zárolva | `locked_at` | timestamptz | ISO; nullable |

## Two variants

### `summary` (default)

One row per `(employee, period)`. Wide format. Suitable for direct payroll input.

- File name: `attendance_payroll_<YYYY>_<MM>.xls` or `.csv`
- Sheet name: **Bérelőkészítés**
- One row per employee per month

### `detailed` (planned, not in v1)

The data model already supports a "detailed" variant that exports one row per segment (date, start, end, type, flags, note). To enable, extend `attendance_payroll_export(...)` with a variant parameter and add a UI toggle. Stable column order is required for accountant compatibility.

## Lock-and-export discipline

The XLSX button uses `p_only_locked = true`. This guarantees:

- Only locked periods leave the system.
- The lock timestamp is captured in the audit trail.
- Once exported, the period status advances to `exported` (visible to admins) — preventing a second accidental export from being treated as a fresh source of truth.

To re-export a period (e.g. after a correction), an admin must reopen → re-approve → re-lock → export. Every step is audited.

## Audit replay

Every export run writes a row to `enterprise_attendance_payroll_exports` with the **full payload** as JSONB. To reproduce the export from N days ago:

```sql
SELECT payload FROM enterprise_attendance_payroll_exports
WHERE workspace_id = $1 AND year = $2 AND month = $3
ORDER BY exported_at DESC LIMIT 1;
```

This is the canonical record handed to payroll.

## CSV vs XLSX

- **CSV** — UTF-8 with BOM, RFC 4180. Best for raw import into other systems.
- **XLSX** — Excel XML Spreadsheet 2003 format (file extension `.xls`). Opens natively in Excel/Numbers/LibreOffice without macros. Same generator as the Import/Export Center, no SheetJS dependency.
