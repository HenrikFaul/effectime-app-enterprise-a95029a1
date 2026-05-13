# DB-audit final summary — 2026-05-13

**Scope:** Supabase project `oezlzzmzzvbvinuysxaz`, public schema + edge
functions. 312 objects examined.

## 1. Inventory summary

| Kind | Count |
|---|---:|
| Tables (public) | 137 |
| Views | 2 |
| Functions (public) | 54 |
| Enums (public) | 11 |
| Triggers (public, non-internal) | 82 |
| Edge functions (ACTIVE) | 26 |
| **Total scope** | **312** |

## 2. Method summary

Three independent passes plus a 4-iteration ambiguity loop:

- **Pass 1 — code grep.** Bulk-grep every object name across `src/`,
  `scripts/`, `supabase/functions/` (excluding auto-generated
  `types.ts`). Result: 13 objects with 0 hits anywhere, 21 with hits
  only in `types.ts`, 184 with real code references.
- **Pass 2 — runtime reachability** (subagent). Traced from
  `src/main.tsx` → routes → pages → hooks → leaf data calls →
  recursive edge-function follow-ups. Result: 117/137 tables, 2/2
  views, 24/54 functions, 13/26 edge fns reached.
- **Pass 3 — necessity verification** (subagent). DB-internal
  introspection: triggers, RLS policy bodies (97KB), FK fan-out, view
  defs, pg_cron, function-to-function calls. Result: 12 functions
  trigger-wired, 5 functions are RLS predicates (360+ refs total), 44
  tables are FK parents.
- **Iteration loop** (4 rounds). For each Pass-3 suspect: queried
  `pg_proc` bodies for table references, ran `pg_event_trigger` check
  for event-trigger wiring, ran `pg_depend` for external dependents,
  and inspected suspect tables' row counts and 1 sample row.

## 3. Disposition counts

| Disposition | Count | Example objects |
|---|---:|---|
| USED (code references found) | 184 | Most application tables/RPCs |
| INDIRECT-USED (trigger/RLS/view/cron) | 52 | `update_updated_at_column`, `has_enterprise_role`, `rls_auto_enable`, `tenant_subscriptions`, `enterprise_calendar_sync_log` |
| Triggers/enums (always kept) | 82+11 | All wire to live tables/columns |
| AMBIGUOUS (kept) | 5 | `enterprise_attendance_audit`, `enterprise_integration_sync_log`, `enterprise_export_jobs`, `leave_request_attachments`, `import_enterprise_catalog_to_workspace` |
| **CONFIRMED-UNUSED → dropped** | **5** | See §5 |

## 4. Backup manifest

All 5 objects below were exported BEFORE deletion. Files in
`db-audit/backup/`:

| Object | Backup file |
|---|---|
| `enterprise_ganttic_dependencies` | `backup/tables/enterprise_ganttic_dependencies.sql` |
| `feature_gate_events` | `backup/tables/feature_gate_events.sql` |
| `enterprise_agile_capacity_events` | `backup/tables/enterprise_agile_capacity_events.sql` |
| `enterprise_agile_external_field_mappings` | `backup/tables/enterprise_agile_external_field_mappings.sql` |
| `ganttic_has_dependency_cycle` | `backup/functions/ganttic_has_dependency_cycle.sql` |

Each file contains the full CREATE statement + RLS policies + indexes +
trigger wiring. Rollback procedure: see `backup/MANIFEST.md`.

## 5. Deleted objects and why

All 5 unanimously flagged unused by every pass; no rows lost; no
external object depends on them.

### `enterprise_ganttic_dependencies`
- 0 rows; FK leaf node (only parents are `enterprise_workspaces`,
  `enterprise_workspace_integrations`, `profiles`).
- No INSERT/SELECT/UPDATE/DELETE in src/ or supabase/functions/.
- The only function that reads it (`ganttic_has_dependency_cycle`) is
  itself unused.
- Defined in migration `20260511162954_giganttIc_scheduling_fields.sql`
  for "future CPM" — the future never arrived.

### `ganttic_has_dependency_cycle` (function)
- Companion to the above; reads only from
  `enterprise_ganttic_dependencies`.
- 0 callers anywhere — no RPC invocation, no trigger, no other function
  body references it.

### `feature_gate_events`
- 0 rows; FK leaf (parents: `tenants`, `enterprise_workspaces`).
- 2 RLS policies exist (`feature_gate_events_insert_auth`,
  `feature_gate_events_workspace_read`) but no application code
  inserts to or reads from the table.
- Designed as a feature-gate analytics sink that was never wired.

### `enterprise_agile_capacity_events`
- 0 rows; FK leaf.
- 2 RLS policies exist but no writer; the `jira-devops-proxy` edge
  function writes to other agile tables (`enterprise_agile_issues`,
  `enterprise_agile_field_metadata`, `enterprise_agile_sync_log`), not
  this one.
- Part of the "agile capacity sync extension" migration
  (`20260430160000_agile_capacity_sync_extension.sql`) that was never
  fully wired.

### `enterprise_agile_external_field_mappings`
- 0 rows; FK leaf. Sibling of `enterprise_agile_capacity_events`, same
  unwired migration.
- 2 RLS policies present but no writer.

## 6. Ambiguous objects — kept (5)

See `db-audit/ambiguous_items.md` for full reasoning per item.

| Object | Why ambiguous |
|---|---|
| `enterprise_attendance_audit` | 1 row from 2026-05-10 (`action: 'segment.created'`) proves something writes here, but no function body references the table |
| `enterprise_integration_sync_log` | Designed RLS, FK to leave_requests + integrations, 0 rows, no current writer (inflight) |
| `enterprise_export_jobs` | Designed RLS, FK to enterprise_workspaces, 0 rows, no current writer (inflight) |
| `leave_request_attachments` | Designed RLS (View/Insert/Delete by owner/admin/approver), 0 rows, UI form not yet wired (inflight) |
| `import_enterprise_catalog_to_workspace` | Defined function with thoughtful body, no caller — admin-invoked one-shot setup helper |

## 7. Not-touched objects and why

237 of 312 in-scope objects are confirmed USED or INDIRECT-USED. They
were never deletion candidates. See `db-audit/master_inventory.md` for
the per-channel breakdown.

## 8. Rollback / restore guide

Restoration of any dropped object is a single-file `psql \i` operation:

```bash
psql ... < db-audit/backup/functions/ganttic_has_dependency_cycle.sql
psql ... < db-audit/backup/tables/enterprise_ganttic_dependencies.sql
psql ... < db-audit/backup/tables/feature_gate_events.sql
psql ... < db-audit/backup/tables/enterprise_agile_capacity_events.sql
psql ... < db-audit/backup/tables/enterprise_agile_external_field_mappings.sql
```

Recommended order: tables first, then the function (function references
its companion table by name). Each file recreates indexes, RLS, and
triggers inline. Parent tables (`enterprise_workspaces`,
`enterprise_workspace_integrations`, `profiles`, `tenants`) are
untouched and FK rebuild will succeed.

## 9. Risks and safeguards

- **All 4 deleted tables had 0 rows** → no data lost.
- **The deleted function has 0 callers** → no broken RPCs.
- **`pg_depend` external-object check** ran for all 5 → no other object
  depends on them.
- **RLS policies** of the deleted tables were owned by those tables and
  are automatically dropped with them.
- **The trigger `set_gg_deps_updated_at`** that fired
  `set_updated_at()` on `enterprise_ganttic_dependencies` was
  auto-dropped with the table. `set_updated_at()` itself remains
  (wired to 9 other tables).
- **Migrations history** is preserved — the migration files that
  created these objects (`20260430160000_agile_capacity_sync_extension.sql`,
  `20260511162954_giganttIc_scheduling_fields.sql`,
  `20260512214223_*.sql`) are unmodified in `supabase/migrations/`.
  This is intentional: re-running them would recreate the dropped
  objects. To prevent re-creation on a fresh-db rebuild, a follow-up
  migration with `DROP TABLE IF EXISTS` may be added.

## 10. Recommended follow-ups (not done here)

- **Idempotent drop migration**: add a new migration file that drops
  the 5 objects with `DROP … IF EXISTS` so a fresh database build also
  ends in the cleaned state. Decision deferred — this audit's mandate
  was to act on the running DB, not modify the migration history.
- **Resolve `enterprise_attendance_audit` writer**: trace who wrote the
  2026-05-10 row (search Supabase API logs by `actor_id`).
- **Re-run audit in 3 months**: the 4 AMBIGUOUS tables either become
  wired (rescued) or remain empty (move to confirmed-unused).
