# Audit trail

Every state-changing action lands in `enterprise_attendance_audit` (append-only).

## Schema recap

```
id, workspace_id, period_id, actor_id (auth.uid),
action, target_kind, target_id,
before, after,    -- jsonb snapshots
reason,           -- free text; required for period.returned
created_at
```

## Action vocabulary

| `action` | `target_kind` | When written |
|----------|---------------|--------------|
| `segment.created` | `segment` | New segment via `attendance_upsert_segment` |
| `segment.updated` | `segment` | Edit via `attendance_upsert_segment` |
| `segment.deleted` | `segment` | `attendance_delete_segment` |
| `oncall.created` | `oncall` | `attendance_upsert_oncall_window` (insert) |
| `oncall.updated` | `oncall` | `attendance_upsert_oncall_window` (update) |
| `oncall.deleted` | `oncall` | `attendance_delete_oncall_window` |
| `period.submitted` | `period` | Employee or admin submits |
| `period.returned` | `period` | Admin returns; `reason` required |
| `period.approved` | `period` | Admin approves |
| `period.locked` | `period` | Admin locks for payroll |
| `period.reopened` | `period` | Admin reopens an approved/locked period |

## Snapshot payloads

For segment edits the audit row contains the full row in `before` and `after`:

```json
{
  "before": {
    "id": "...", "starts_at": "2026-05-12T09:00:00Z", "ends_at": "2026-05-12T17:00:00Z",
    "segment_type": "regular", "is_weekend": false, "is_night": false, ...
  },
  "after": {
    "id": "...", "starts_at": "2026-05-12T08:30:00Z", "ends_at": "2026-05-12T17:30:00Z",
    "segment_type": "regular", "is_weekend": false, "is_night": false, ...
  }
}
```

You can replay edits by walking `created_at ASC` and applying the `after` snapshot.

## Retrieval

A future Audit panel inside the admin period detail view should query:

```sql
SELECT a.*, COALESCE(p.display_name, u.email) AS actor_label
FROM enterprise_attendance_audit a
LEFT JOIN auth.users u ON u.id = a.actor_id
LEFT JOIN profiles p ON p.user_id = a.actor_id
WHERE a.period_id = $1
ORDER BY a.created_at DESC
LIMIT 200;
```

This is allowed by the existing `attendance_audit_select` RLS policy for admins.

## Compliance posture

- The audit table has no UPDATE / DELETE policy. Even admins cannot edit history through the API.
- Every mutation captures `actor_id = auth.uid()`. Service-role inserts bypass RLS and should be avoided outside of the official RPCs.
- Payroll-relevant timestamps (`submitted_at`, `approved_at`, `locked_at`, `exported_at`) live on the period row itself, so a payroll-defensibility query can report them without joining the audit table.

## Correction flow

1. Admin reopens a `locked` period → `period.reopened` audit row.
2. Employee or admin edits segments → multiple `segment.updated` rows.
3. Employee resubmits → `period.submitted`.
4. Admin re-approves → `period.approved`.
5. Admin re-locks → `period.locked`.
6. Admin re-exports → `period.exported` (the export batch row in `enterprise_attendance_payroll_exports` carries the snapshot).

Every step is provable from the audit trail.

## Retention

The audit and export tables grow append-only. For a multi-year workspace, plan a partitioning strategy if row count exceeds ~10M (likely after years 5+). The current model does **not** require partitioning before that.
