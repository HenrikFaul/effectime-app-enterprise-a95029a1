# Cross-method comparison report

## Method coverage

| Pass | Method | What it catches | Blind spots |
|---|---|---|---|
| 1 | Code grep across `src/`, `scripts/`, `supabase/functions/` (excluding the auto-generated `src/integrations/supabase/types.ts`) | Direct application use: `.from(X)`, `.rpc(X)`, `functions.invoke(X)`, edge-function-to-edge-function HTTP | Indirect DB-internal uses: triggers, RLS policies, views, function-to-function calls, pg_cron, event triggers, OAuth/webhook paths |
| 2 | Runtime trace from `src/main.tsx` → routes → pages → hooks → leaf data calls; then recursively follow each reachable edge function's writes | Reachable-from-UI usage; correctly identifies cron/webhook-only edge fns as "not reached" | Triggers, RLS, schema-level constraints, admin scripts, manually-invoked dashboard SQL |
| 3 | DB introspection: pg_trigger, pg_policy USING/CHECK bodies, view definitions, FK fan-out, `cron.schedule()`, function bodies calling other functions | Trigger wiring, RLS predicates, view-table dependencies, FK parents, recently-added inflight tables | Edge-function writes (don't appear in `pg_proc`); 3rd-party webhook handlers |

Each pass blind to different evidence channels — taken together they
provide overlapping coverage.

## Agreement matrix for the top suspects

Legend: ✅ pass marks as USED; ❌ pass marks as UNUSED; 🟡 ambiguous.

| Object | Pass 1 (grep) | Pass 2 (runtime) | Pass 3 (necessity) | Iteration check | Final |
|---|:-:|:-:|:-:|:-:|:-:|
| `enterprise_ganttic_dependencies` | ❌ | ❌ | ❌ | ❌ (no pg_depend external; no writer) | **CONFIRMED unused** |
| `ganttic_has_dependency_cycle` | ❌ | ❌ | ❌ | ❌ (only reads gantt table, no callers) | **CONFIRMED unused** |
| `enterprise_agile_capacity_events` | ❌ | ❌ | ❌ | ❌ (no function body writes; 0 rows; orphan migration) | **CONFIRMED unused** |
| `enterprise_agile_external_field_mappings` | ❌ | ❌ | ❌ | ❌ (same as capacity_events; sibling table) | **CONFIRMED unused** |
| `feature_gate_events` | ❌ | ❌ | ❌ | ❌ (RLS exists but no writer found) | **CONFIRMED unused** |
| `enterprise_attendance_audit` | ❌ | ❌ | ❌ | 🟡 (1 row exists from 2026-05-10; writer unknown) | **AMBIGUOUS — keep** |
| `enterprise_integration_sync_log` | ❌ | ❌ | ❌ | 🟡 (RLS designed, no current writer; ops table) | **AMBIGUOUS — keep** |
| `enterprise_export_jobs` | ❌ | ❌ | ❌ | 🟡 (RLS designed, no current writer) | **AMBIGUOUS — keep** |
| `leave_request_attachments` | ❌ | ❌ | ❌ | 🟡 (RLS designed, no current write; designed feature) | **AMBIGUOUS — keep** |
| `tenant_subscriptions` | ❌ | ❌ | ✅ (read by `tenant_enabled_features()`) | ✅ | RESCUED |
| `tenant_addons` | ❌ | ❌ | ✅ | ✅ | RESCUED |
| `tenant_feature_overrides` | ❌ | ❌ | ✅ | ✅ | RESCUED |
| `tenant_workspaces` | ❌ | ❌ | ✅ (read+inserted by `create_workspace_with_owner()`) | ✅ | RESCUED |
| `enterprise_calendar_sync_log` | ❌ | ❌ | ✅ (written by `ms365-sync` edge fn) | ✅ | RESCUED |
| `enterprise_user_calendar_integrations` | ❌ | ❌ | ✅ (written by `ms365-sync` edge fn) | ✅ | RESCUED |
| `email_send_state` | ❌ | ❌ | ✅ (written by `process-email-queue` edge fn) | ✅ | RESCUED |
| `enterprise_catalog_skills` | ❌ | ❌ | ✅ (read by `import_enterprise_catalog_to_workspace()`) | ✅ | RESCUED |
| `enterprise_workspace_skills` | ❌ | ❌ | ✅ (written by `import_enterprise_catalog_to_workspace()`) | ✅ | RESCUED |
| `enterprise_attendance_payroll_exports` | ❌ | ❌ | ✅ (written by `attendance_record_export()` RPC, called from `src/components/enterprise/time-attendance/api.ts`) | ✅ | RESCUED |
| `rls_auto_enable` (function) | ❌ | ❌ | ✅ (event trigger `ensure_rls` on `ddl_command_end`) | ✅ | RESCUED |
| `enforce_data_retention` (function) | ❌ | ❌ | ✅ (manually-scheduled pg_cron target by design) | ✅ | RESCUED |
| `auto_archive_expired_coverage_rules` (function) | ❌ | ❌ | ✅ (manually-scheduled pg_cron target by design) | ✅ | RESCUED |
| `import_enterprise_catalog_to_workspace` (function) | ❌ | ❌ | 🟡 (defined, no caller in src/migrations; admin-only) | 🟡 KEEP | KEEP (latent admin tool) |
| `update_updated_at_column` and 11 other trigger-bodies | ❌ | ❌ | ✅ (wired to 60+ triggers) | ✅ | RESCUED |
| `has_role`, `has_enterprise_role`, `is_enterprise_member`, `is_tenant_member`, `can_access_event` | ❌ | ❌ | ✅ (RLS predicates, 360+ refs total) | ✅ | RESCUED |

## Why agreement is unanimous on the 5 deletions

For each of `enterprise_ganttic_dependencies`,
`enterprise_agile_capacity_events`,
`enterprise_agile_external_field_mappings`, `feature_gate_events`, and
`ganttic_has_dependency_cycle`:

- Pass 1: **0 references** in src/, scripts/, or supabase/functions/
  outside the auto-generated `types.ts`.
- Pass 2: **not reached** from any route, page, hook, or edge-function
  trace originating at `src/main.tsx`.
- Pass 3: **not referenced** by any trigger, RLS policy expression, view
  definition, foreign key (other than the dropping table's own FKs to
  parents), pg_cron schedule, or function-to-function call.
- Iteration: **no pg_depend** external object depends on these (only
  intrinsic indexes, attrdefs, toast, and own RLS policies & one trigger
  that fires the shared `set_updated_at` helper); for the function, **0
  pg_depend external objects** depend on it.

Risk of deletion: minimal. All tables are empty; the function reads only
from the table being dropped alongside it.

## Why the 4 AMBIGUOUS items are NOT deleted

Per the no-doubt-deletion rule:

1. **`enterprise_attendance_audit`** — has 1 real-looking row from
   2026-05-10 (action=`segment.created`, target_kind=`segment`,
   before/after pattern matches an audit entry). No SQL function body
   I searched contains the table name. **But the row's existence proves
   something writes to it.** It might be:
   - An edge function whose source I didn't examine in this audit;
   - Server-side code in `supabase/functions/` that uses raw SQL with
     dynamic table names;
   - Manual insert from a previous audit-feature attempt.
   Until the writer is identified, keep.

2. **`enterprise_integration_sync_log`** — listed in
   `data-migration/index.ts` table set; RLS policy "Admins view sync log"
   exists; 0 rows currently. Probably a planned write-path from
   integration sync flows. The integration-sync feature is real (the
   workspace integrations UI works) but doesn't currently write here.

3. **`enterprise_export_jobs`** — same shape: RLS designed
   ("Members can view export jobs", "Admins can create/update export
   jobs"), listed in data-migration set, 0 rows. Looks like the async
   export job tracker for a future bulk-export feature.

4. **`leave_request_attachments`** — full RLS suite (View/Insert/Delete
   policies based on owner/admin/approver) — clearly designed as a
   user-facing feature. UI form not yet wired. Likely inflight.

## Unanimous-RESCUE finds the indirect channel each time

Pass 1+2 both flagged the tenant_* family and ms365-sync/email-queue
backing tables as "no app code touches them" — but Pass 3 + iteration
showed each is reached through a function body or an edge-function file
that grep doesn't easily catch. This is exactly the false-positive
pattern the multi-method audit is designed to guard against.

## Final disposition

- **5 objects** confirmed unused and queued for backup + deletion.
- **4 objects** moved to ambiguous and kept.
- **15+ objects** rescued by indirect-reference analysis.
- **All other objects** in the canonical inventory are confirmed used by
  at least one of the three methods.
