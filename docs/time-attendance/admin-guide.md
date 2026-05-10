# Admin guide — Időnyilvántartás (Csapat áttekintés)

For owner / resourceAssistant. Other admins do not see the team tab.

## Layout

Top navigation → **Időnyilvántartás** → **Csapat áttekintés**.

Header shows:

- Month picker (← / →)
- 6 summary cards: Tagok, Benyújtva, Jóváhagyva, Zárolva, Hiányzó, Bér-össz
- Two export buttons (XLSX of locked-only, CSV of all)
- Filters: free-text search (name/email), status filter

Table shows one row per active member with:

- Name + email
- Status badge (or "Hiányzik" if the member never opened the period)
- Worked, overtime, weekend overtime, night, standby (raw + compensated), intervention, payroll total
- Action buttons depending on the status

## Workflow

```
[employee submits] ──▶ status = submitted
                          │
   ┌──────────────────────┴──────────────────────┐
   │                                              │
[admin clicks "Vissza"]                  [admin clicks "Jóváhagy"]
   │                                              │
   ▼                                              ▼
returned (employee fixes, resubmits)        approved
                                                  │
                                       [admin clicks "Zárol"]
                                                  │
                                                  ▼
                                                locked
                                                  │
                                       [admin clicks export — XLSX/CSV]
                                                  │
                                                  ▼
                                               exported  (status auto-advances)
```

You can **Reopen** (`↻`) any approved/locked/returned period back to draft if a correction is needed; the audit trail records every reopen.

## Returning a period for correction

Click **Vissza** on a `submitted` row → enter a reason in the prompt → the row turns into `returned` and the employee sees the reason banner.

## Approve

Click **Jóváhagy** on a `submitted` row. The period becomes `approved` and is read-only for the employee. Approved periods are not yet exportable — you must lock first.

## Lock

Click **Zárol** on an `approved` row. The period becomes `locked`. This is the canonical "payroll-ready" state.

## Export

Two buttons:

- **Bérelőkészítés export (XLSX, csak zárolt)** — XLSX with all locked periods of the month. After export, all locked periods auto-advance to `exported` status.
- **Teljes (CSV, minden státusz)** — CSV with every period regardless of status (useful for ad-hoc analysis or before-lock review).

The XLSX path uses the same Excel XML format as the Import/Export Center (no SheetJS dependency, opens natively in Excel/Numbers/LibreOffice).

Every export run is recorded in `enterprise_attendance_payroll_exports` with a JSON snapshot of the exported rows for audit replay.

## What's in the export

23 columns per row — see [`payroll-export.md`](./payroll-export.md) for the full schema.

## Key admin checks before lock

- Is `status` consistent with deadlines? (Anything still in `draft` will not be exported.)
- Is `worked_hours` close to `expected_after_leave`? Big gaps usually mean missing entries.
- Are there `oncall_standby_hours` without `oncall_intervention_hours`? That's allowed — it just means the standby was uneventful.
- Is `weekend_overtime_hours` plausible? Cross-check with the leave calendar to avoid double-counting.

## Anomalies

The Csapat áttekintés currently flags `Hiányzik` (no period at all). For deeper anomaly detection (overtime > X, missing days, suspicious patterns) extend the row component with derived flags from the cached `totals`. The data is already in shape for it.
