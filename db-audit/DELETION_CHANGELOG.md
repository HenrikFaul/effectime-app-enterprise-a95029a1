# Deletion changelog — DB-audit cycle

## 2026-05-13 — audit cycle 1

**DBA / executor:** automated audit (this commit's author)
**Supabase project:** `oezlzzmzzvbvinuysxaz`
**Method:** 3-pass cross-method audit + 4-iteration ambiguity loop.

### Dropped (5 objects, all 0-row tables + 1 helper function)

| Object | Type | Rows | Migration applied |
|---|---|---:|---|
| `public.ganttic_has_dependency_cycle(uuid,uuid,text,text)` | function | n/a | `audit_drop_confirmed_unused_2026_05_13` |
| `public.enterprise_ganttic_dependencies` | table | 0 | same |
| `public.feature_gate_events` | table | 0 | same |
| `public.enterprise_agile_capacity_events` | table | 0 | same |
| `public.enterprise_agile_external_field_mappings` | table | 0 | same |

Drop SQL (verbatim):
```sql
DROP FUNCTION IF EXISTS public.ganttic_has_dependency_cycle(uuid, uuid, text, text);
DROP TABLE IF EXISTS public.enterprise_ganttic_dependencies;
DROP TABLE IF EXISTS public.feature_gate_events;
DROP TABLE IF EXISTS public.enterprise_agile_capacity_events;
DROP TABLE IF EXISTS public.enterprise_agile_external_field_mappings;
```

Backups: `db-audit/backup/tables/*.sql`,
`db-audit/backup/functions/*.sql`. See `db-audit/backup/MANIFEST.md`
for rollback procedure.

### Side effects

- Trigger `set_gg_deps_updated_at` (on
  `enterprise_ganttic_dependencies`) was auto-dropped with the table.
  The shared helper function `set_updated_at()` remains wired to 9
  other tables.
- 9 indexes were auto-dropped with their tables (per-table indexes are
  inherently dependent).
- 8 RLS policies were auto-dropped with their tables (policies are
  inherently dependent).
- No external object (other table, view, function, trigger, FK) was
  affected. Verified via `pg_depend` before the drop.

### Items kept despite low signal (AMBIGUOUS)

See `db-audit/ambiguous_items.md`. Not touched:
- `enterprise_attendance_audit` (1 row of unknown provenance)
- `enterprise_integration_sync_log` (designed RLS, no current writer)
- `enterprise_export_jobs` (designed RLS, no current writer)
- `leave_request_attachments` (designed RLS, designed UI, not yet wired)
- `import_enterprise_catalog_to_workspace()` (latent admin function)
