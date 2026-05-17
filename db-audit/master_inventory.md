# Master inventory — final classifications

**Scope:** public schema + edge functions. 137 tables + 2 views + 54
functions + 11 enums + 82 triggers + 26 edge functions = **312 objects**.

**Classifications used:**

- **USED** — at least one of the three methods places the object on a
  live execution path. Final disposition: keep.
- **INDIRECT-USED** — code grep finds 0 hits in src/ (other than the
  auto-generated `types.ts`) but Pass 3 establishes use via trigger,
  RLS, view, FK, function-to-function, or pg_cron. Final disposition:
  keep (deletion would break runtime).
- **AMBIGUOUS** — all 3 passes flag as unused, but the iteration loop
  surfaces credible doubt. Final disposition: keep, re-evaluate later.
- **CONFIRMED-UNUSED** — all 3 passes + the iteration check unanimously
  agree no execution path exists. Final disposition: backup + drop.

## Summary counts

| Kind | Total | USED | INDIRECT-USED | AMBIGUOUS | CONFIRMED-UNUSED |
|---|---:|---:|---:|---:|---:|
| Tables | 137 | 117 | 11 | 4 | **5** |
| Views | 2 | 2 | 0 | 0 | 0 |
| Functions | 54 | 24 | 28 | 1 | **1** |
| Edge functions | 26 | 13 | 13 (cron/webhook) | 0 | 0 |
| Triggers | 82 | 82 (all reference live tables) | 0 | 0 | 0 |
| Enums | 11 | 11 (all referenced by typed columns) | 0 | 0 | 0 |
| **Total** | **312** | **249** | **52** | **5** | **6** |

## Confirmed-unused — 5 objects — **ALL DROPPED 2026-05-13**

Status verified against live `information_schema` snapshot on 2026-05-17:
none of these objects exist in the database anymore. See
`db-audit/DELETION_CHANGELOG.md` for the drop migration and backups.

| Name | Type | Status |
|---|---|---|
| `enterprise_ganttic_dependencies` | table | DROPPED |
| `feature_gate_events` | table | DROPPED |
| `enterprise_agile_capacity_events` | table | DROPPED |
| `enterprise_agile_external_field_mappings` | table | DROPPED |
| `ganttic_has_dependency_cycle(uuid,uuid,text,text)` | function | DROPPED |

(❌ = "object NOT used" verdict from that pass; ✅ = object used; 🟡 =
ambiguous.)

## Ambiguous (kept) — 5 objects

See `ambiguous_items.md` for full reasoning.

- `enterprise_attendance_audit` (table, 1 row — writer unknown)
- `enterprise_integration_sync_log` (table, 0 rows — designed RLS, no current writer)
- `enterprise_export_jobs` (table, 0 rows — designed RLS, no current writer)
- `leave_request_attachments` (table, 0 rows — designed RLS, designed UI, not yet wired)
- `import_enterprise_catalog_to_workspace()` (function — latent admin tool)

## Indirect-used examples (top 25 most-instructive cases) — kept

These show why simple code grep is insufficient.

| Object | Indirect channel that saves it |
|---|---|
| `update_updated_at_column()` | Wired to 60+ table triggers |
| `set_updated_at()` | Wired to 10 table triggers |
| `set_hr_workflow_updated_at()` | 3 HR-workflow triggers |
| `set_webhook_updated_at()` | webhook table trigger |
| `update_office_equipment_updated_at()` | office equipment trigger |
| `update_office_min_staffing_updated_at()` | office min-staffing trigger |
| `handle_new_user()` | Trigger on `auth.users` (creates profile row) |
| `handle_leave_quota_change()` | Trigger on `enterprise_quota_transactions` |
| `help_articles_search_trigger()` | FTS index trigger on `help_articles` |
| `seed_workspace_roles()` | Trigger on workspace creation |
| `enterprise_decision_memory_set_due()` | Trigger sets `due_at` column |
| `enterprise_memberships_check_manager_cycle()` | Trigger prevents reporting cycles |
| `has_enterprise_role()` | RLS predicate — 231 occurrences |
| `is_enterprise_member()` | RLS predicate — 93 occurrences |
| `has_role()` | RLS predicate — 29 occurrences |
| `is_tenant_member()` | RLS predicate — 5 occurrences |
| `can_access_event()` | RLS predicate — 2 occurrences |
| `rls_auto_enable()` | DDL event trigger `ensure_rls` |
| `enforce_data_retention()` | Manually-scheduled pg_cron target |
| `auto_archive_expired_coverage_rules()` | Manually-scheduled pg_cron target |
| `calc_leave_days()` | Called by `handle_leave_quota_change` trigger body |
| `tenant_enabled_features()` | Called from `src/hooks/useFeature.ts` |
| `tenant_id_for_workspace()` | Called from `src/hooks/useFeature.ts` |
| `tenant_subscriptions/addons/feature_overrides` | Read by `tenant_enabled_features()` |
| `tenant_workspaces` | Read+inserted by `create_workspace_with_owner()` |
| `email_send_state` | Written by `process-email-queue` edge fn |
| `enterprise_calendar_sync_log`, `enterprise_user_calendar_integrations` | Written by `ms365-sync` edge fn (cron-driven) |
| `enterprise_workspace_skills`, `enterprise_catalog_skills` | Read+written by `import_enterprise_catalog_to_workspace()` |
| `enterprise_attendance_payroll_exports` | Written by `attendance_record_export()` RPC |

## USED — application-code referenced (≥1 non-types.ts hit)

The 184 objects in this bucket are not enumerated row-by-row — they
have grep evidence in `db-audit/passes/pass1_raw_grep.json` (raw) and
the "C. Referenced in real app code" table in
`db-audit/passes/pass1_code_grep.md`. Pass 2 confirms ~117 tables are
reached from at least one UI route.

The full evidence trail per object is preserved in:

- `db-audit/passes/pass1_code_grep.md` — code grep classifications
- `db-audit/passes/pass1_raw_grep.json` — raw grep hits per object
- `db-audit/passes/pass2_runtime_reachable.md` — UI-down trace
- `db-audit/passes/pass3_necessity.md` — DB-internal references
- `db-audit/00_fk_map.md` — FK dependency graph
- `db-audit/00_rls_policies_raw.json` — RLS bodies

## Edge functions — final disposition

| Edge function | Method that finds it | Disposition |
|---|---|---|
| `admin` | invoked from `src/components/superadmin/...` | USED |
| `auth-email-hook` | Supabase Auth webhook | INDIRECT-USED |
| `cleanup-demo-workspace` | invoked from admin UI + cron-candidate | USED |
| `cleanup-temp-users` | listed in `superadmin-hub` allowlist | INDIRECT-USED (admin trigger) |
| `create-instant-enterprise-member` | `MemberList.tsx` | USED |
| `data-migration` | one-shot ops tool, invoked from `superadmin-hub` | INDIRECT-USED |
| `delete-account` | `DeleteAccountCard.tsx` | USED |
| `handle-email-suppression` | external bounce webhook (Resend/SES) | INDIRECT-USED |
| `handle-email-unsubscribe` | `src/pages/Unsubscribe.tsx` | USED |
| `help-regenerator` | `HelpSystemSettings.tsx` | USED |
| `import-entity-data` | bulk-import UI flow | USED |
| `jira-devops-proxy` | jira/devops integration UI | USED |
| `join-event` | event UI | USED |
| `leave-ical` | external calendar clients (RFC 5545 ICS feed) | INDIRECT-USED |
| `ms365-sync` | pg_cron `ms365-sync-every-15min` | INDIRECT-USED |
| `payroll-export` | async payroll export worker | INDIRECT-USED |
| `preview-transactional-email` | superadmin email template preview | INDIRECT-USED |
| `process-email-queue` | drains email queue; cron or trigger-driven | INDIRECT-USED |
| `run-report` | report scheduling UI | USED |
| `security-admin` | security ops endpoint | INDIRECT-USED |
| `seed-demo-workspace` | superadmin onboarding | USED |
| `send-scheduled-reports` | cron-driven report dispatcher | INDIRECT-USED |
| `send-transactional-email` | invoked by other edge fns | INDIRECT-USED |
| `superadmin-hub` | `SuperadminControlPlane.tsx` | USED |
| `sync-holidays` | superadmin allowlist | INDIRECT-USED |

All 26 edge functions kept — none confirmed unused.

## Views — final disposition

| View | Channel | Disposition |
|---|---|---|
| `enterprise_leave_quota_balances` | Read by leave UI; joins `enterprise_leave_quotas` + `enterprise_quota_transactions` | USED |
| `enterprise_org_pulse_membership` | Read by org-pulse dashboard; SELECTs from `enterprise_memberships` | USED |

## Enums — final disposition

All 11 enums (`app_role`, `enterprise_*_status`, `enterprise_role`,
`integration_provider`, `leave_*`, `quota_transaction_type`,
`substitute_status`) are referenced by typed columns of live tables.
USED, kept.

## Triggers — final disposition

All 82 triggers fire on live tables and reference live functions
(either trigger-body helpers like `update_updated_at_column` or
domain-specific bodies like `enterprise_memberships_check_manager_cycle`).
USED, kept.
