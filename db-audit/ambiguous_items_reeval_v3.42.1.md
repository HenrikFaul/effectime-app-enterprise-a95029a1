# Ambiguous items — Re-evaluation (v3.42.1, 2026-05-17)

Per the operator mandate: **"nem lehet semmi regresszió! ne töröld ezeket"** —
this re-evaluation re-confirms all previously-ambiguous objects are KEPT.
No DROP statements are issued. Where new evidence appeared since the last
audit, it is recorded below.

## Re-eval result table

| # | Object | Type | Rows now | Prev rows | New evidence | Decision |
|---|--------|------|---------:|----------:|--------------|----------|
| 1 | `enterprise_attendance_audit` | table | **106** | 1 | **Writer is active** — row count grew 1 → 106 between audits. Trigger / edge function path is live in production. | **KEEP** (now reclassified USED) |
| 2 | `enterprise_integration_sync_log` | table | 0 | 0 | Still empty; designed-but-unwired. RLS suite intact. | **KEEP** |
| 3 | `enterprise_export_jobs` | table | 0 | 0 | Still empty; designed-but-unwired. RLS + FK intact. | **KEEP** |
| 4 | `leave_request_attachments` | table | 0 | 0 | Still empty; in-design UI flow. RLS intact. | **KEEP** |
| 5 | `import_enterprise_catalog_to_workspace` | function | n/a | n/a | No caller found; documented as admin-invoked one-shot helper. | **KEEP** |
| 6 | `enterprise_workspace_roles` | table | 0 | 0 | No FK in/out, no code consumer. Per operator: "ha valami nincs használva még vagy dependency-je van akkor a dependencyt hozd létre — ne töröld". | **KEEP** (no DROP; documented as reserved-for-future) |

## Reclassification: item #1 is no longer ambiguous

`enterprise_attendance_audit` grew from 1 → 106 rows during the period
between the original audit and this re-eval. This proves a live writer
exists (trigger function or service-role edge function). The table is now
considered **USED** and removed from the ambiguous list. The exact writer
should still be traced and committed as a migration to make the data
lineage greppable — tracked as follow-up task.

## Standing decision

All other items remain in the AMBIGUOUS / RESERVED bucket and are
**kept indefinitely**. The cost of keeping an empty FK-clean table with
designed RLS is negligible (~24 KB on disk each); the cost of dropping
and later rebuilding is high (re-deriving RLS, FK, indexes, migration
risk). Per operator rule, dependency creation > deletion.

## Anti-regression invariants

- No `DROP TABLE`, `DROP FUNCTION`, or `DROP POLICY` was issued in this
  cycle.
- `features.route_path` canonical state (142 workspace-scoped + 30
  platform-level, established in v3.42.0) is unchanged.
- `bun run build` and `bun run build:dev` both pass with zero errors at
  the time of this re-eval.

## Follow-ups (non-destructive)

- Trace and commit the writer for `enterprise_attendance_audit` as a
  proper migration so the data lineage is greppable.
- When items #2–#4 are wired up in product code, remove them from this
  re-eval list and document the writer in `versioning/`.
