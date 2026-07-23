# Payroll export — column reference

Stable field order for accountant / payroll handoff. **Never reorder columns**.
The current artifact uses the English runtime labels listed in
`PAYROLL_COLUMNS`; the Hungarian labels below describe their business meaning.
SpreadsheetML currently serializes every cell as text even where the source
contract is numeric. Any label or cell-type migration requires an
accountant-approved golden artifact and real office-suite round-trip.

| # | Column (Hungarian) | Source field | Type | Notes |
|---|---------------------|--------------|------|-------|
| 1 | Email | `auth.users.email` | text | Required and unique within one client export; not an immutable payroll employee id |
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
- Sheet name: **Payroll** (stable runtime compatibility contract)
- One row per employee per month

### `detailed` (planned, not in v1)

The data model already supports a "detailed" variant that exports one row per segment (date, start, end, type, flags, note). To enable, extend `attendance_payroll_export(...)` with a variant parameter and add a UI toggle. Stable column order is required for accountant compatibility.

## Current lock-and-export compatibility behavior

The XLSX button uses `p_only_locked = true`. The current RPC contract may return
both `locked` and previously `exported` rows. The client preserves that behavior
for compatibility and validates both states; therefore it does **not** yet
guarantee duplicate-proof official export.

- Rows outside `locked` / `exported` fail closed on the XLSX path.
- The lock timestamp is captured in the audit trail.
- The record RPC reports that current `locked` periods advance to `exported`.

The documented transition contract and current UI do not reopen an `exported`
period. A correction/re-export policy (including reason, prior-batch reference
and idempotency) is therefore an explicit release blocker, not an implemented
workflow.

The client reads the RPC through deterministic 500-row pages with an exact
count, validates all 23 business fields plus the two internal identities, and
rejects duplicate `(membership_id, period_label)` rows. A source above 100,000
rows is refused. SpreadsheetML additionally allows at most 65,535 data rows so
the header remains inside Excel 97-2003's 65,536-row worksheet limit. These are
client integrity controls; multiple HTTP requests are not an atomic database
snapshot. A server-owned, transactionally materialized export job remains the
required boundary for concurrent payroll mutations. The client also rejects
negative values, duplicate normalized email identifiers and totals that violate
the documented payroll arithmetic within a 0.05-hour rounding tolerance. This
is defense in depth; the server must remain the source of truth.

The delivery order is **fetch → generate complete artifact → record immutable
snapshot / advance status → request delivery**. A fetch, validation, artifact
or record failure therefore cannot release an unaudited file. The delivery port
accepts synchronous browser initiation and asynchronous native adapters; an
adapter rejection after recording reports the batch id instead of claiming
success. The DOM anchor API still does not acknowledge that the browser actually
saved the file, so real web, iOS and Android delivery remains an acceptance
requirement. The recorded JSONB payload remains the canonical recovery source;
an operator should inspect the reported batch id before initiating another
export, because a second run creates another audit batch.

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

The UI label uses “XLSX” as the established payroll action name, while the
actual and audited artifact is XML Spreadsheet 2003 with a `.xls` extension.
This compatibility behavior is intentional; consumers must not infer an OOXML
ZIP container from the action label.
