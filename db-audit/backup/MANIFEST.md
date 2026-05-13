# Backup / Export Manifest

**Created:** 2026-05-13
**Supabase project:** `oezlzzmzzvbvinuysxaz`
**Branch:** `claude/review-project-requirements-lR0Wp`

## Objects backed up before deletion

All 5 objects below are CONFIRMED UNUSED by all three independent
analysis passes (Pass 1 code grep, Pass 2 runtime trace, Pass 3
necessity verification via triggers/RLS/FKs/views/cron), AND by 4
ambiguity-iteration follow-ups (pg_depend external check; function-body
text search; data-existence sanity check; event-trigger wiring check).

| # | Object | Type | Rows | Backup file | Rollback step |
|--:|---|---|---:|---|---|
| 1 | `enterprise_ganttic_dependencies` | table | 0 | `tables/enterprise_ganttic_dependencies.sql` | run file |
| 2 | `feature_gate_events` | table | 0 | `tables/feature_gate_events.sql` | run file |
| 3 | `enterprise_agile_capacity_events` | table | 0 | `tables/enterprise_agile_capacity_events.sql` | run file |
| 4 | `enterprise_agile_external_field_mappings` | table | 0 | `tables/enterprise_agile_external_field_mappings.sql` | run file |
| 5 | `ganttic_has_dependency_cycle` | function | n/a | `functions/ganttic_has_dependency_cycle.sql` | run file |

## What is NOT in this backup (intentionally)

These were investigated and either RESCUED by indirect-reference checks
or moved to AMBIGUOUS. Not deleted, not backed up.

- `tenant_subscriptions`, `tenant_addons`, `tenant_feature_overrides`,
  `tenant_workspaces`, `tenants` — RESCUED: `tenant_enabled_features()`
  RPC (used in `src/hooks/useFeature.ts`) reads from all 4 tenant_*
  tables; `create_workspace_with_owner()` inserts into `tenant_workspaces`.
- `enterprise_calendar_sync_log`, `enterprise_user_calendar_integrations`
  — RESCUED: written by `supabase/functions/ms365-sync/index.ts` (which
  is invoked by pg_cron every 15 minutes).
- `email_send_state` — RESCUED: used by
  `supabase/functions/process-email-queue/index.ts`.
- `enterprise_workspace_skills`, `enterprise_catalog_skills` — RESCUED:
  `import_enterprise_catalog_to_workspace()` reads
  `enterprise_catalog_skills` and writes `enterprise_workspace_skills`;
  the PositionPickerDialog UI also reads both.
- `rls_auto_enable()` (function) — RESCUED: wired to DDL event trigger
  `ensure_rls` on `ddl_command_end` (auto-enables RLS on new tables).
- `enforce_data_retention()`, `auto_archive_expired_coverage_rules()` —
  RESCUED: explicitly designed as manually-scheduled pg_cron targets
  (per migration comments).
- `enterprise_attendance_audit` — AMBIGUOUS (NOT deleted): table has 1
  real-looking row from 2026-05-10 with `action: 'segment.created'`, but
  no DB function body references it. The row's existence proves
  something writes to it (possibly an edge function I missed or an
  in-flight feature). Keep until we resolve the writer.
- `enterprise_integration_sync_log`, `enterprise_export_jobs`,
  `leave_request_attachments` — AMBIGUOUS (NOT deleted): RLS designed
  and present but no current write path. Likely inflight features.
- All 12 trigger-wired functions (`update_updated_at_column`,
  `set_updated_at`, `handle_new_user`, etc.) and 5 RLS-predicate
  functions (`has_enterprise_role`, `has_role`, `is_enterprise_member`,
  `is_tenant_member`, `can_access_event`) — RESCUED by Pass 3.

## Rollback procedure

If any feature regression appears after the drops, restore in this order:

1. Restore the function first (it depends on the table):
   ```sql
   \i db-audit/backup/functions/ganttic_has_dependency_cycle.sql
   ```
   But note: the function will fail to compile until its dependent table exists. Skip this step until step 2 is done.

2. Restore the tables (in any order — they have no inter-dependencies among themselves):
   ```sql
   \i db-audit/backup/tables/enterprise_ganttic_dependencies.sql
   \i db-audit/backup/tables/feature_gate_events.sql
   \i db-audit/backup/tables/enterprise_agile_capacity_events.sql
   \i db-audit/backup/tables/enterprise_agile_external_field_mappings.sql
   ```

3. Now restore the function:
   ```sql
   \i db-audit/backup/functions/ganttic_has_dependency_cycle.sql
   ```

4. Each table backup file recreates its policies, indexes, and triggers
   inline. No additional steps needed.

5. Since `enterprise_ganttic_dependencies` has FK to `profiles`,
   `enterprise_workspace_integrations`, and `enterprise_workspaces`,
   the restore will succeed only if those parents still exist (they
   are core tables and were never touched).

## Verification after rollback

```sql
-- Each table should exist with 0 rows and its RLS enabled.
SELECT relname, relrowsecurity, (SELECT count(*) FROM public.enterprise_ganttic_dependencies) AS rc
FROM pg_class WHERE relname IN (
  'enterprise_ganttic_dependencies','feature_gate_events',
  'enterprise_agile_capacity_events','enterprise_agile_external_field_mappings'
) AND relnamespace='public'::regnamespace;

-- The function should exist:
SELECT proname FROM pg_proc WHERE proname='ganttic_has_dependency_cycle'
  AND pronamespace='public'::regnamespace;
```
