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

- **Bérelőkészítés export (XLSX, csak zárolt)** — the current compatibility contract can return locked and already exported periods. After recording, current locked periods advance to `exported`.
- **Teljes (CSV, minden státusz)** — CSV with every period regardless of status. It currently uses the same mutating record RPC, so it must not be treated as a non-mutating ad-hoc analysis export until the server contracts are separated.

The XLSX path uses the same Excel XML format as the Import/Export Center (no SheetJS dependency, opens natively in Excel/Numbers/LibreOffice).

Every export run is recorded in `enterprise_attendance_payroll_exports` with a JSON snapshot of the exported rows for audit replay.

The current state machine does not expose an `exported → draft` correction
transition. Do not promise re-export correction or duplicate-free retry until a
reason-bound, idempotent server workflow and batch redownload path are released.

The export controls are available only after the `payroll_export` entitlement
has been resolved for the active workspace. The UI fails closed while that
decision is loading or unavailable; the database RPC must still enforce the
authoritative tenant and role boundary.

Export preparation is bounded and fail-closed: the client loads deterministic
500-row pages with an exact count, validates the complete payroll row contract,
generates the complete file, records the immutable batch, and only then asks the
delivery adapter to save it. A record failure cannot release a file. The port
supports synchronous browser initiation and asynchronous native adapters; an
adapter rejection after recording reports the affected period and batch id
instead of showing success. A browser does not provide acknowledgement that a
file was actually saved, so verify the file before handing it to payroll. Review
the stored batch before retrying, because retrying creates a new audit batch.

## What's in the export

23 columns per row — see [`payroll-export.md`](./payroll-export.md) for the full schema.

## Key admin checks before lock

- Is `status` consistent with deadlines? (Anything still in `draft` will not be exported.)
- Is `worked_hours` close to `expected_after_leave`? Big gaps usually mean missing entries.
- Are there `oncall_standby_hours` without `oncall_intervention_hours`? That's allowed — it just means the standby was uneventful.
- Is `weekend_overtime_hours` plausible? Cross-check with the leave calendar to avoid double-counting.

## Anomalies

The Csapat áttekintés currently flags `Hiányzik` (no period at all). For deeper anomaly detection (overtime > X, missing days, suspicious patterns) extend the row component with derived flags from the cached `totals`. The data is already in shape for it.
