# Data model

## Tables

### `enterprise_attendance_schedule_templates`
Recurring expected schedule. Two scopes: workspace-default (`membership_id IS NULL` + `is_default=true`) and member-specific.

| column | type | notes |
|--------|------|-------|
| id | uuid PK | |
| workspace_id | uuid → enterprise_workspaces | required |
| membership_id | uuid → enterprise_memberships | nullable; if null = workspace template |
| name | text | |
| is_default | boolean | only one default per scope is enforced by app logic |
| weekday_mask | smallint | 7-bit mask, bit 0 = Mon; default `31` = Mon-Fri |
| start_time | time | UI default 09:00 |
| end_time | time | UI default 17:00 |
| break_minutes | integer | unpaid break, default 60 |
| expected_daily_hours | numeric(5,2) | default 8.0 |
| effective_from / effective_to | date | optional validity window |
| archived_at | timestamptz | soft delete |

### `enterprise_attendance_periods`
One per `(workspace, member, year, month)` — the timesheet shell.

| column | type | notes |
|--------|------|-------|
| id | uuid PK | |
| workspace_id | uuid | |
| membership_id | uuid | |
| year, month | smallint | UNIQUE(workspace, membership, year, month) |
| status | enum | `draft` → `submitted` → `returned`/`approved` → `locked` → `exported` |
| schedule_template_id | uuid nullable | If null, system resolves via fallback chain |
| submitted_at, submitted_by | | |
| approved_at, approved_by | | |
| locked_at | | |
| exported_at | | |
| return_reason | text | only set when admin returns for correction |
| **totals** | **jsonb** | **cached output of `attendance_recompute_totals`** |
| totals_recomputed_at | timestamptz | |

The cached totals shape:

```json
{
  "regular_hours": 168, "overtime_hours": 3,
  "weekend_overtime_hours": 0, "night_hours": 3,
  "oncall_intervention_hours": 2,
  "oncall_standby_hours": 10, "oncall_standby_compensated_hours": 2.0,
  "break_hours": 0,
  "expected_hours": 168, "leave_days": 1, "leave_hours": 8,
  "expected_after_leave": 160,
  "worked_hours": 173, "payroll_total_hours": 175
}
```

### `enterprise_attendance_segments`
Atomic unit of logged time. **One day may have many segments** (split shifts).

| column | type | notes |
|--------|------|-------|
| id | uuid PK | |
| period_id | uuid → periods | |
| workspace_id | uuid | for RLS |
| work_date | date | derived from `starts_at::date` on insert |
| starts_at, ends_at | timestamptz | CHECK ends_at > starts_at |
| segment_type | enum | `regular` \| `overtime` \| `break` \| `oncall_intervention` |
| is_weekend | boolean | UI auto-checks for Sat/Sun |
| is_night | boolean | manual flag in v1; helper available |
| oncall_window_id | uuid nullable | Links interventions to the standby window they happened during |
| **source** | text | `'manual'` (v1) or `'device'` (future hardware ingestion) |
| **device_event_id** | uuid nullable | reserved — future raw clock event correlation |
| note | text | |

### `enterprise_attendance_oncall_windows`
On-call standby blocks. Standalone — they don't need any segment.

| column | type | notes |
|--------|------|-------|
| id | uuid PK | |
| period_id | uuid → periods | |
| starts_at, ends_at | timestamptz | the standby window |
| is_weekend, is_night | boolean | for reporting |
| standby_multiplier | numeric(4,2) | default 0.20 |
| note | text | |

### `enterprise_attendance_audit`
Append-only audit trail.

| column | type | notes |
|--------|------|-------|
| id | uuid PK | |
| workspace_id, period_id | uuid | |
| actor_id | uuid | `auth.uid()` at time of write |
| action | text | e.g. `segment.created`, `period.approved`, `period.exported` |
| target_kind | text | `segment` \| `period` \| `oncall` |
| target_id | uuid | |
| before, after | jsonb | snapshots; NULL on create / delete respectively |
| reason | text | required for `period.returned` |

### `enterprise_attendance_payroll_exports`
One row per export run.

| column | type | notes |
|--------|------|-------|
| id | uuid PK | |
| workspace_id | uuid | |
| year, month | smallint | |
| exported_by | uuid | `auth.uid()` |
| exported_at | timestamptz | |
| variant | text | `summary` \| `detailed` |
| format | text | `xlsx` \| `csv` |
| member_count | integer | |
| total_periods | integer | |
| payload | jsonb | full row dump for replay |

## Relationships

```
workspace ──┬─ schedule_templates
            ├─ memberships ──┐
            │                 │
            ├─ periods ──┬─ segments ─── (oncall_window_id) ─┐
            │            ├─ oncall_windows ───────────────────┘
            │            ├─ audit (per period)
            │            └─ payroll_exports (per workspace+month)
            └─ leave_requests (existing — joined for leave_hours)
```

## RLS posture

- **SELECT** — direct policies on every table, gated by `is_enterprise_member` + role check.
- **INSERT / UPDATE / DELETE** — **no direct policies**. All writes must go through `SECURITY DEFINER` RPCs that:
  - re-check the role,
  - enforce the state machine,
  - recompute `totals`,
  - emit an audit event.

This ensures the UI cannot bypass the workflow and that the totals are always the server-computed values.

## Why the cached `totals` jsonb?

- Reading: list views and exports just read the jsonb — no per-row recomputation.
- Writing: every mutation triggers `attendance_recompute_totals(period_id)` so the cache cannot drift.
- Admin lists 200 employees in 1 query (no N+1 calculation walks).

## Indexes

```sql
idx_attendance_periods_ws_month   (workspace_id, year, month)   -- admin list
idx_attendance_periods_member     (membership_id)               -- own period lookup
idx_attendance_periods_status     (workspace_id, status)        -- "submitted" filter
idx_segments_period               (period_id)                   -- recompute walk
idx_segments_ws_date              (workspace_id, work_date)     -- future device ingest range scan
idx_oncall_period                 (period_id)                   -- recompute walk
idx_attendance_audit_period       (period_id, created_at DESC)  -- timeline view
```
