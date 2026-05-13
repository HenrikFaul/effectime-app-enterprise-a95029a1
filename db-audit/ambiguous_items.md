# Ambiguous items — kept, not deleted

These objects survived the 3 analysis passes but resolved to AMBIGUOUS
during the iteration loop. Per the audit rule **"never let uncertainty
become deletion"**, none of these are dropped in this pass.

## 1. `enterprise_attendance_audit` (table)

**Why ambiguous:** Has **1 real-looking row** from 2026-05-10 with
`action: 'segment.created'`, `target_kind: 'segment'`, full
`before`/`after` payload. The row strongly suggests deliberate audit
logging is happening, BUT no `pg_proc` body or migration SQL file
references the table name as a write target.

**Possible explanations (in order of likelihood):**
1. A trigger function body that was rebuilt in-place via Supabase
   dashboard SQL editor (not committed to migrations) writes here.
2. An edge function with dynamic table-name interpolation that grep
   misses.
3. Direct write from `supabase/functions/admin/index.ts` or
   `superadmin-hub` via `service_role` key — these were not fully traced
   for raw SQL.
4. A previous attendance audit feature was removed but the audit table
   was left behind, with the 1 row being a test/orphan.

**Next verification steps before deciding:**
- Search `supabase/functions/*/index.ts` for `'enterprise_attendance_audit'` as a string literal.
- Check Supabase Database → Logs → API for any INSERT activity on the table.
- Ask: who wrote the row dated 2026-05-10 19:23:16+00 with actor_id `e66accca-7d19-4090-a61c-2db6ec2af85d`?

**Recommendation:** Keep until the writer is identified. Re-evaluate next audit cycle.

## 2. `enterprise_integration_sync_log` (table)

**Why ambiguous:** Has policy `"Admins view sync log"`, FK to
`enterprise_workspace_integrations` and `leave_requests`, listed in
`supabase/functions/data-migration/index.ts` table inventory. But 0 rows
and no committed code path inserts here. The peer table
`enterprise_calendar_sync_log` IS written by `ms365-sync` — and they
were created in the same migration era — but the integration sync log
remains empty.

**Recommendation:** Keep. Either the integration sync flow is
implemented but logging is disabled, OR the logging is planned for a
future cycle. Either way, the cost of keeping an empty FK-clean table
with policies is negligible.

## 3. `enterprise_export_jobs` (table)

**Why ambiguous:** Full RLS suite ("Members can view export jobs",
"Admins can create/update export jobs"), FK to `enterprise_workspaces`,
listed in data-migration table inventory. 0 rows; no committed
write-path code.

**Recommendation:** Keep — clearly designed as the async export job
tracker. The `payroll-export` edge function exists and probably will
write here once async jobs are wired.

## 4. `leave_request_attachments` (table)

**Why ambiguous:** Full RLS suite (View / Insert / Delete policies based
on owner / admin / approver). FK to `leave_requests` and
`enterprise_workspaces`. 0 rows. Listed in data-migration set. Pass 2
mentions "attachments for leave requests; UI form ..." — i.e. the UI
flow exists in design but not in code.

**Recommendation:** Keep — actively in-design feature. The RLS rules are
non-trivial and would be expensive to rebuild.

## 5. `import_enterprise_catalog_to_workspace` (function)

**Why ambiguous:** Defined with a thoughtful body that imports catalog
categories/roles/skills/role_skills into the workspace tables, but no
caller in `src/`, `supabase/functions/`, or any other function. Probably
intended as an admin-invoked one-shot setup helper.

**Recommendation:** Keep — explicit admin tool by design.

## Common pattern: "designed RLS, no current writer"

Items 2-4 share a pattern: a table with a complete RLS-policy suite, an
FK to its expected parent, and zero rows. This is the signature of a
**designed-but-not-yet-wired** feature. Deleting them would require
re-implementing the policies later. They cost ~24KB on disk each. Keep.
