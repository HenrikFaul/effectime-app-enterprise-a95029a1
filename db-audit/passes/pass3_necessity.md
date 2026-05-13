# Pass 3: Necessity verification (DB-internal)

## Method summary

I examined five DB-internal reference channels that source-code grep cannot
see: (1) trigger wiring (`EXECUTE FUNCTION` lines in `supabase/migrations/`,
matched against the 82-trigger inventory); (2) RLS policy expressions in
`db-audit/00_rls_policies_raw.json` — counting both function calls
(`has_role`, `has_enterprise_role`, `is_enterprise_member`,
`is_tenant_member`, `can_access_event`) and cross-table subselects in
USING/WITH CHECK clauses; (3) the two view definitions
(`enterprise_leave_quota_balances`, `enterprise_org_pulse_membership`)
extracted from migrations; (4) FK fan-out from `00_fk_map.md`; (5)
`cron.schedule()` calls in migrations; and (6) function-to-function calls
via `PERFORM`/`SELECT public.fn(...)` inside migration function bodies.

## Functions referenced by triggers (cannot drop)

Distinct trigger-backing functions discovered via `EXECUTE FUNCTION`:

- `update_updated_at_column` → wired to 60+ tables incl. `enterprise_workspaces`, `enterprise_memberships`, `events`, `votes`, `profiles`, `enterprise_projects`, `enterprise_skills`, `enterprise_catalog_*`, `enterprise_workspace_role_*`, `enterprise_translation_overrides`, etc. (63 EXECUTE refs)
- `set_updated_at` → wired to 10 tables (e.g. `tenants`, `features`, `tiers`, `addons`, `tenant_subscriptions`, `enterprise_workspace_integrations`, `enterprise_leave_quotas`, `enterprise_allowances`)
- `set_hr_workflow_updated_at` → triggers `trg_hr_wf_templates_updated_at`, `trg_hr_wf_instances_updated_at`, `trg_hr_wf_tasks_updated_at`
- `set_webhook_updated_at` → trigger `trg_webhook_updated_at` on `enterprise_webhook_subscriptions`
- `update_office_equipment_updated_at` → trigger `office_equipment_updated_at` on `enterprise_office_equipment`
- `update_office_min_staffing_updated_at` → trigger `office_min_staffing_updated_at` on `enterprise_office_min_staffing`
- `handle_new_user` → trigger `on_auth_user_created` on `auth.users` (creates `profiles` row)
- `handle_leave_quota_change` → trigger `trg_leave_quota_change` on `enterprise_quota_transactions`
- `help_articles_search_trigger` → trigger `help_articles_search_trg` on `help_articles` (FTS index)
- `seed_workspace_roles` → trigger `seed_roles_on_workspace_create` on `enterprise_workspaces`
- `enterprise_decision_memory_set_due` → trigger `trg_decision_memory_set_due` on `enterprise_decision_memory`
- `enterprise_memberships_check_manager_cycle` → trigger `trg_memberships_manager_cycle` on `enterprise_memberships`

All 12 functions above appear "absent from src/" in Pass 1, but every one
is INDIRECTLY USED via a trigger. Dropping any would break inserts/updates.

## Functions referenced by RLS policies (cannot drop)

Counted by exact-call occurrences in policy `using_expr`/`check_expr`:

- `has_enterprise_role(...)` — **231 occurrences** across nearly every `enterprise_*` table policy. Core authorization predicate.
- `is_enterprise_member(...)` — **93 occurrences** in SELECT policies for workspace-scoped tables.
- `has_role(...)` — **29 occurrences**, used in platform-admin write policies (`addons`, `tiers`, `features`, `addon_features`, `account_deletions`, `platform_*`).
- `is_tenant_member(...)` — **5 occurrences**, tenant-scoped reads (`tenant_*`).
- `can_access_event(...)` — **2 occurrences**, used by `event_participants` / `event_share_tokens` policies.

These five functions are load-bearing security gates. Pass 1 flagged them
as "only types.ts" — that's expected because they are DB-internal
predicates never called from the app.

## Functions referenced by views (cannot drop)

Neither view calls a function directly; both just project columns:

- `enterprise_leave_quota_balances` AS SELECT … FROM `enterprise_leave_quotas` q LEFT JOIN `enterprise_quota_transactions` t → both tables NECESSARY for the view; `security_invoker = on` so RLS still applies.
- `enterprise_org_pulse_membership` AS SELECT … FROM `enterprise_memberships` GROUP BY workspace_id → `enterprise_memberships` necessary (and the earlier variant joined `enterprise_workspaces`, so that too).

## Functions called by other functions (cannot drop)

- `calc_leave_days(...)` is called from inside the leave-request trigger logic (`_days := calc_leave_days(NEW.start_date, NEW.end_date, ...)`).
- `attendance_caller_membership`, `attendance_can_edit_period`, `attendance_expected_hours_for_period`, `attendance_recompute_totals` — defined in DB (not in committed migrations); signatures in `types.ts` (`Returns: boolean | uuid | numeric | Json`) plus their naming convention indicate they are internal helpers called by the public `attendance_*_period`, `attendance_upsert_segment`, `attendance_payroll_export` RPCs. They cannot be dropped without breaking those RPCs.
- `seed_default_access_systems` / `seed_default_contract_types` / `seed_default_leadership_levels` are public-callable (used by AccessSystems / ContractTypes / LeadershipLevels UIs via `.rpc(seedRpc, ...)`).
- `import_enterprise_catalog_to_workspace` — defined but no caller found in src OR in migrations. Likely a one-shot DB-side admin utility (similar pattern to `enforce_data_retention`).

## Functions invoked by cron / pg_cron (cannot drop)

Only one `cron.schedule()` found: `ms365-sync-every-15min` — calls the
`ms365-sync` **edge function** via HTTP, not a DB function. So no DB
function is on a pg_cron schedule today.

However, two DB functions are *advertised* as cron-targets in their
defining migration comments and admin-doc:

- `enforce_data_retention()` — `20260512220000_payroll_security_platform.sql` header says "function for pg_cron (activated by admin)". Keep.
- `auto_archive_expired_coverage_rules()` — same pattern. Keep.

## Tables referenced by RLS policy expressions (used indirectly)

Tables that appear as `FROM`/`JOIN` targets inside other tables' policy
expressions — dropping them would break RLS evaluation on the referring
tables:

- `events` — 10 refs (subselect from `event_participants`/`votes` policies)
- `enterprise_memberships` — 8 refs (joined in workspace-membership checks across multiple tables; also 2 explicit JOINs)
- `leave_requests` — 5 refs (subselect from `approval_decisions`, `leave_request_attachments`, `leave_request_substitutes` policies)
- `event_participants` — 3 refs
- `enterprise_onboarding_templates` — 3 refs
- `enterprise_onboarding_instances` — 3 refs
- `enterprise_access_templates` — 3 refs
- `enterprise_access_requests` — 2 refs

These are NECESSARY beyond their own row data — they gate access on
sibling tables.

## Tables that are FK parents (cannot drop without cascade)

From `00_fk_map.md` — tables with one or more children:

`addons`, `enterprise_access_requests`, `enterprise_access_systems`,
`enterprise_access_templates`, `enterprise_allowances`,
`enterprise_api_keys`, `enterprise_attendance_oncall_windows`,
`enterprise_attendance_periods`,
`enterprise_attendance_schedule_templates`,
`enterprise_catalog_categories`, `enterprise_catalog_roles`,
`enterprise_catalog_skills`, `enterprise_contract_types`,
`enterprise_feature_catalog` (self-ref),
`enterprise_hr_workflow_instances`, `enterprise_hr_workflow_templates`,
`enterprise_leadership_levels`, `enterprise_leave_quotas`,
`enterprise_leave_types`, `enterprise_memberships`,
`enterprise_offices`, `enterprise_onboarding_instances`,
`enterprise_onboarding_template_steps`, `enterprise_onboarding_templates`,
`enterprise_org_units` (self-ref), `enterprise_projects`,
`enterprise_reports`, `enterprise_scenarios`, `enterprise_skills`,
`enterprise_teams`, `enterprise_user_calendar_integrations`,
`enterprise_work_categories` (self-ref),
`enterprise_workspace_integrations`,
`enterprise_workspace_role_categories`, `enterprise_workspace_roles`,
`enterprise_workspace_skills`, `enterprise_workspaces`, `events`,
`features`, `help_releases`, `leave_requests`, `tenants`, `tiers`.

(44 parent tables.)

## Heavily-referenced infrastructure tables (definitely keep)

Top FK fan-out — these are bedrock multi-tenancy / authz scaffolding:

- **`enterprise_workspaces`** — ~60 children; `workspace_id` is the
  ubiquitous tenancy column. 89 occurrences of `REFERENCES …
  enterprise_workspaces` across migrations.
- **`enterprise_memberships`** — 16 FK references; parent of access,
  attendance, hr_workflow, leave_quotas, member_*, onboarding_instances,
  project_assignments, scenario_assignments, wellbeing tables; self-ref
  via `manager_id`.
- **`tenants`** — parent of `tenant_addons`, `tenant_subscriptions`,
  `tenant_workspaces`, `tenant_feature_overrides`, `feature_gate_events`.
- **`tiers` / `features` / `addons`** — pricing/feature catalog core.
- **`leave_requests`** — parent of attachments, substitutes,
  quota_transactions, approval_decisions, integration_sync_log.
- **`events`** — parent of `event_participants`, `event_share_tokens`,
  `votes`; referenced by `profiles.linked_event_id`.

## Suspected truly-unused (after considering indirect references)

Even after accounting for triggers, RLS, views, FKs, cron, and
function-to-function calls, these objects have no indirect references
from any channel I examined AND were already flagged by Pass 1 as
absent / types.ts-only AND are FK leaf nodes:

1. **`enterprise_attendance_audit`** — FK leaf, no policy ref, no
   trigger, no view ref. Pass 1: types.ts-only. Likely a write-target of
   server-side attendance RPCs that *the audit pass cannot see in code*
   — but no committed migration writes to it. Candidate.
2. **`enterprise_attendance_payroll_exports`** — same profile. Pass 1
   confirms zero real refs. FK leaf. Only the RPC
   `attendance_record_export` would insert here; the table itself is
   never read from app code.
3. **`enterprise_ganttic_dependencies`** — FK leaf, types.ts-only,
   matched only by orphan function `ganttic_has_dependency_cycle`
   which also has zero real refs.
4. **`feature_gate_events`** — FK leaf, types.ts-only. RLS policies
   exist but no app code writes/reads it.
5. **`tenant_addons`**, **`tenant_feature_overrides`**,
   **`tenant_subscriptions`**, **`tenant_workspaces`** — types.ts-only;
   tenant tables exist but appear unused by current UI/edge code.
   Migrations show they were defined but app flow uses
   `tenant_enabled_features(...)` to read tenant features, bypassing
   direct reads of these tables. Worth Pass-2 cross-check before
   declaring unused — they are likely future-feature scaffolding.

Function candidates:

- **`rls_auto_enable`** — 0 migrations, 0 src refs. Likely a one-off
  helper executed manually in dashboard and never wired anywhere.
  STRONG candidate for unused.
- **`ganttic_has_dependency_cycle`** — Pass 1: types.ts only, 0
  migration refs, paired with the unused
  `enterprise_ganttic_dependencies` table. STRONG candidate.
- **`import_enterprise_catalog_to_workspace`** — defined but no caller
  in src or migrations. Possibly only invoked from Supabase SQL editor
  by admins; treat as latent/admin-only, not dead.
- **`enforce_data_retention`** — types.ts-only but explicitly designed
  for pg_cron activation. NOT dead — it is an *intentional* manually
  scheduled job.
- **`auto_archive_expired_coverage_rules`** — same as above.

## Recent additions (caution)

Objects introduced in migrations dated 2026-05-* (last 13 days) — too
new to flag confidently:

- 2026-05-05 — `enterprise_role_skill_catalog` migration (catalog_*,
  workspace_role_*, workspace_skill_* tables and triggers).
- 2026-05-05 — `onboarding_access_strategic` (access_*, onboarding_*).
- 2026-05-05 — `phase8_overrides_pulse` (`enterprise_translation_overrides`,
  `enterprise_org_pulse_membership` view).
- 2026-05-07 — `help_system_v2_versioning`, `help_articles_seed*`,
  `help_system_settings` (help_articles + FTS trigger).
- 2026-05-09 — `enterprise_seed_config`, `org_pulse_view_and_translation_overrides`.
- 2026-05-10 — `member_goals` (`enterprise_member_goals` table).
- 2026-05-11 — `create_hr_workflows`, `attendance_site_assignment_rpcs`.
- 2026-05-12 — `office_extended_params`, `analytics_wellbeing_api_platform`,
  `payroll_security_platform`, `platform_superadmin`.
- 2026-05-13 — `platform_audit_events`, `seed_feature_routes_menus`,
  `fix_feature_dependencies`.

Anything that touches these — `enterprise_member_goals`,
`enterprise_translation_overrides`, `enterprise_org_pulse_membership`,
`help_articles`, `help_releases`, `enterprise_seed_config`,
`platform_audit_events`, `platform_feature_flags`, the agile/wellbeing
analytics tables, `payroll_export_configs`, `payroll_periods`,
`data_retention_policies`, the new HR workflow & attendance RPCs —
should NOT be flagged unused. They are inflight features.
