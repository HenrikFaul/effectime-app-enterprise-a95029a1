# API contracts

All time-attendance writes go through SECURITY DEFINER RPCs. The Supabase REST URL prefix is `/rest/v1/rpc/<function_name>`. The TypeScript client wrappers are in `src/components/enterprise/time-attendance/api.ts`.

## RPCs

### `attendance_get_or_create_period(p_workspace_id, p_year, p_month, p_membership_id?)` → `uuid`
Returns the period id. Creates a `draft` if it doesn't exist. Non-admin callers are restricted to their own membership.

### `attendance_upsert_segment(p_segment_id?, p_period_id, p_starts_at, p_ends_at, p_segment_type, p_is_weekend, p_is_night, p_oncall_window_id?, p_note?)` → `uuid`
Insert if `p_segment_id` is null, else update. Throws `Period is not editable` if the state machine forbids it. Returns the segment id. Side effects:
- writes one `enterprise_attendance_audit` row (`segment.created` or `segment.updated`),
- recomputes `enterprise_attendance_periods.totals`.

### `attendance_delete_segment(p_segment_id)` → `void`
Same gate as upsert. Audits as `segment.deleted` with the `before` snapshot.

### `attendance_upsert_oncall_window(p_window_id?, p_period_id, p_starts_at, p_ends_at, p_is_weekend, p_is_night, p_multiplier?, p_note?)` → `uuid`
Default multiplier `0.20`. Same audit + recompute behavior.

### `attendance_delete_oncall_window(p_window_id)` → `void`

### `attendance_transition_period(p_period_id, p_target_status, p_reason?)` → `void`
Implements the full state machine. Allowed transitions:

| From | To | Who |
|------|----|-----|
| draft / returned | submitted | period owner OR admin |
| submitted | approved | admin only |
| submitted | returned (requires reason) | admin only |
| approved | locked | admin only |
| approved / locked / returned | draft (reopen) | admin only |

Any other transition raises an exception. Each transition writes one audit row.

### `attendance_list_workspace_periods(p_workspace_id, p_year, p_month)` → SETOF row
Admin-only. One row per active member, with cached `totals`. Used by `AdminOverview`.

### `attendance_payroll_export(p_workspace_id, p_year, p_month, p_only_locked)` → SETOF row
Admin-only. Returns 23-column rows ready for export. When `p_only_locked=true`,
members without `locked`/`exported` periods are skipped. This compatibility
behavior permits re-reading previously exported rows; duplicate-proof official
export needs an explicit server state-machine and idempotency contract.

The current client applies `membership_id, period_label` ordering, exact-count
500-row ranges, a 100,000-row ceiling and runtime validation of the returned
shape. Count drift and duplicate identities fail closed. Because this invokes a
VOLATILE RPC across multiple requests, it does not establish one MVCC snapshot;
concurrency-safe export ultimately requires one server-owned materialization
transaction/job over exact period ids and revisions.

### `attendance_record_export(p_workspace_id, p_year, p_month, p_variant, p_format, p_member_count, p_total_periods, p_payload)` → `uuid`
Admin-only. Inserts into `enterprise_attendance_payroll_exports` and advances
every currently `locked` period in the month to `exported`. Returns the export
batch id. Because this is a separate call from row retrieval and does not accept
exact period ids/revisions, it cannot prove that the persisted/status-updated
set is identical to the generated artifact under concurrent changes.

The client accepts only a UUID receipt and calls this RPC after complete
artifact generation but before browser delivery. A failed or malformed receipt
prevents delivery. The delivery port awaits both synchronous browser initiation
and an asynchronous native adapter. A rejection after a successful receipt
retains the recorded payload/exported statuses and reports the period and
receipt id. The DOM download API still does not attest that the browser actually
saved the file.

### `attendance_recompute_totals(p_period_id)` → `jsonb`
Idempotent. Called automatically by every mutation RPC. Public so admins can trigger a refresh after manually altering the schedule template.

### `attendance_expected_hours_for_period(p_workspace_id, p_membership_id, p_year, p_month, p_template_id)` → `numeric`
Helper used by `attendance_recompute_totals`. Resolves the schedule template via the fallback chain and counts workdays.

## Read access

Reads use plain `from('enterprise_attendance_*').select(...)` queries — RLS policies cover the access checks. The wrappers are:

```ts
fetchPeriod(periodId)           // single period row
fetchSegments(periodId)         // all segments for a period
fetchOnCallWindows(periodId)    // all windows for a period
fetchScheduleTemplates(workspaceId)
```

## Error contract

Errors thrown by RPCs surface to the client as `{ message: string }`. Common messages:

- `Forbidden` — caller lacks the role.
- `Period is not editable` — state machine rejected the write.
- `Period not found` / `Segment not found` / `Window not found`
- `End must be after start`
- `Invalid transition to <status>`
- `No active membership` — caller is not an active enterprise_membership of the workspace.

The UI shows them via `sonner` toasts.

## Concurrency

All mutations are single-row and idempotent on `id`. The state machine prevents skipped-step transitions. Concurrent edits to the same segment by two clients will both succeed in column-level updates; the audit log records the order. A tighter optimistic-concurrency layer (e.g. `If-Match` on `updated_at`) can be added later if needed.

## Future device-event endpoint

When badge/clock devices are added, introduce a new RPC:

```
attendance_ingest_device_event(p_workspace_id, p_user_id, p_event_kind, p_occurred_at, p_metadata)
  → { matched_period_id uuid, segment_id uuid? }
```

…that writes to a new `enterprise_attendance_device_events` table and *optionally* materializes a segment with `source = 'device'`. The current schema's `device_event_id` column on segments is the FK target. See `future-hardware-support.md`.
