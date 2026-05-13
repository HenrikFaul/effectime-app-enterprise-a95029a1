# Pass 2: Runtime reachability audit

## Method summary

Traced from `src/main.tsx` → `src/App.tsx` (HashRouter, 8 routes: `/`, `/app`,
`/enterprise` → `/app`, `/profile`, `/auth`, `/reset-password`, `/admin`,
`/superadmin`, `/unsubscribe`), then walked into each page's component tree and
into `src/hooks/`, `src/lib/`, `src/integrations/supabase/`. For every
component I collected `supabase.from('TABLE')`, `supabase.rpc('FN')`, and
`supabase.functions.invoke('EDGE_FN')`. For every edge function reachable from
the app, I read `supabase/functions/<fn>/index.ts` and recursively collected
the tables/RPCs/other edge functions IT touches. Tables and RPCs reached via
those edge functions are also counted as runtime-reachable.

## Reachable objects (used by the running app)

### Tables reached (117)

App-direct (`supabase.from(...)` in `src/`):

- `addon_features`, `addons`, `features`, `tier_features`, `tiers`,
  `platform_audit_events`, `platform_feature_flags` — via
  `src/components/superadmin/FeatureTiersTab.tsx` and `SuperadminControlPlane.tsx`
- `approval_decisions`, `enterprise_approval_chains`, `enterprise_escalation_rules`
  — via `src/components/enterprise/ApprovalInbox.tsx`,
  `EscalationRuleManager.tsx`, `ApprovalChainEditor.tsx`
- `enterprise_access_decisions`, `enterprise_access_requests`,
  `enterprise_access_systems`, `enterprise_access_templates`,
  `enterprise_access_template_systems` — via
  `src/components/enterprise/access/AccessRequestManager.tsx`,
  `AccessSystemAdmin.tsx`
- `enterprise_agile_field_metadata`, `enterprise_agile_issues`,
  `enterprise_agile_sync_log` — via `src/components/enterprise/agile/*.tsx`
- `enterprise_allowances`, `enterprise_leave_types`, `enterprise_leave_quotas`,
  `enterprise_company_leave_days`, `enterprise_quota_transactions`,
  `enterprise_blocked_dates`, `enterprise_daily_rules`,
  `enterprise_rule_templates`, `enterprise_holidays` — via
  `src/components/enterprise/LeaveTypeManager.tsx`, `QuotaManager.tsx`,
  `BlockedDateManager.tsx`, `DailyRuleManager.tsx`, `HolidayManager.tsx`,
  `AnnualLeaveGrid.tsx`
- `enterprise_api_keys`, `enterprise_api_usage_logs`,
  `enterprise_webhook_subscriptions` — via
  `src/components/enterprise/developer/DeveloperPortal.tsx`
- `enterprise_attendance_oncall_windows`, `enterprise_attendance_periods`,
  `enterprise_attendance_schedule_templates`, `enterprise_attendance_segments`
  — via `src/components/enterprise/time-attendance/*` and
  `self-service/EmployeeDashboard.tsx`
- `enterprise_audit_events`, `enterprise_decision_memory` — via
  `SecurityCenter.tsx`, `DecisionMemoryEditor.tsx`, plus edge functions
- `enterprise_capacity_snapshots` — `CapacityDnaPanel.tsx`
- `enterprise_catalog_categories`, `enterprise_catalog_roles`,
  `enterprise_catalog_role_skills`, `enterprise_industries`,
  `enterprise_job_families`, `enterprise_leadership_levels`,
  `enterprise_contract_types`, `enterprise_feature_catalog` — via
  `positions/PositionPickerDialog.tsx`, `InviteMemberDialog.tsx`,
  `useEnterprisePermissions.ts`
- `enterprise_hr_workflow_instances`, `enterprise_hr_workflow_tasks`,
  `enterprise_hr_workflow_templates` — via `workflows/HRWorkflowInbox.tsx`
- `enterprise_ical_tokens` — `ICalSubscription.tsx`
- `enterprise_invitations`, `enterprise_memberships`,
  `enterprise_member_role_allocations`, `enterprise_member_templates`,
  `enterprise_member_goals`, `enterprise_member_rates`,
  `enterprise_member_site_priorities`, `enterprise_member_skills`,
  `enterprise_role_definitions`, `enterprise_role_permissions`,
  `enterprise_skills`, `enterprise_team_roles`, `enterprise_teams` — via
  `MemberList.tsx`, `MemberProfileSheet.tsx`, `MemberExtendedDetails.tsx`,
  `RolePermissionManager.tsx`, `InviteMemberDialog.tsx`
- `enterprise_notifications`, `enterprise_notification_preferences` — via
  `NotificationCenter.tsx`, `NotificationPreferences.tsx`
- `enterprise_office_coverage_rules`, `enterprise_office_equipment`,
  `enterprise_office_min_staffing`, `enterprise_offices` — via
  `OfficeManager.tsx`, `OfficeCoverageRuleManager.tsx`
- `enterprise_onboarding_instances`, `enterprise_onboarding_step_completions`,
  `enterprise_onboarding_template_steps`, `enterprise_onboarding_templates`
  — via `workflows/OnboardingInbox.tsx`, `MemberExtendedDetails.tsx`,
  `CommandCenterButton.tsx`
- `enterprise_org_chart_snapshots`, `enterprise_org_units` — via
  `organization/OrgChart.tsx`
- `enterprise_project_assignments`, `enterprise_project_rates`,
  `enterprise_project_resource_requirements`,
  `enterprise_project_skill_requirements`, `enterprise_projects`,
  `enterprise_scenario_assignments`, `enterprise_scenarios`,
  `enterprise_shift_assignments`, `enterprise_work_categories` — via
  `resources/*.tsx` (ScenarioPlanner, FinancialsPanel, ResourceWidgetCard,
  UtilizationHeatmap)
- `enterprise_reports`, `enterprise_report_schedules` — via `reports/*`
- `enterprise_seed_config`, `enterprise_translation_overrides`,
  `enterprise_ui_section_states`, `enterprise_workspace_integrations`,
  `enterprise_workspace_role_categories`, `enterprise_workspace_role_skills`,
  `enterprise_workspace_roles`, `enterprise_workspaces` — via
  `DemoSeedConfigDialog.tsx`, `LocalizationSettings.tsx`,
  `UiSectionStateManager.tsx`, `IntegrationManager.tsx`,
  `import-export/utils/data-fetcher.ts`, `CreateWorkspaceDialog.tsx`
- `gdpr_requests`, `data_retention_policies` — `security/SecurityCenter.tsx`
- `help_articles`, `help_releases` — `lib/help/useHelpArticles.ts`,
  `settings/HelpSystemSettings.tsx`
- `leave_request_substitutes`, `leave_requests` — `SubstituteInbox.tsx`,
  `LeaveRequestForm.tsx`, `LeaveRequestList.tsx`
- `payroll_export_configs`, `payroll_periods` — `payroll/PayrollPanel.tsx`
- `profiles`, `tenant_calendar_settings`, `user_roles` — `ProfileMenu.tsx`,
  `useCalendarFilterConfig.ts`, `Profile.tsx`, `Superadmin.tsx`
- `wellbeing_alerts`, `wellbeing_scores` — `wellbeing/WellbeingDashboard.tsx`,
  `WellbeingScoreCard.tsx`

Reached via edge functions invoked from the app:

- `account_deletions`, `event_participants`, `event_share_tokens`, `events`,
  `favorites`, `friendships`, `personal_availability`, `votes` — via
  `admin`, `delete-account`, `join-event` edge functions (invoked from
  `AdminUsers.tsx`, `DeleteAccountCard.tsx`, `ProfileMenu.tsx`, `Auth.tsx`,
  `Enterprise.tsx`)
- `email_send_log`, `email_unsubscribe_tokens`, `suppressed_emails` — via
  `send-transactional-email` and `handle-email-unsubscribe`
  (`ApprovalInbox.tsx`, `InviteMemberDialog.tsx`, `Unsubscribe.tsx`)

### Views reached (2)

- `enterprise_leave_quota_balances` — via
  `src/components/enterprise/QuotaManager.tsx`, `QuotaBalanceCard.tsx`,
  `self-service/EmployeeDashboard.tsx`
- `enterprise_org_pulse_membership` — via
  `src/components/enterprise/OrgPulseButton.tsx`, `OrgPulseWidget.tsx`,
  `wellbeing/WellbeingScoreCard.tsx`

### Functions reached (24)

App-direct via `supabase.rpc(...)`:

- `attendance_delete_oncall_window`, `attendance_delete_segment`,
  `attendance_get_or_create_period`, `attendance_list_workspace_periods`,
  `attendance_payroll_export`, `attendance_record_export`,
  `attendance_remove_site_assignment`, `attendance_transition_period`,
  `attendance_upsert_oncall_window`, `attendance_upsert_segment`,
  `attendance_upsert_site_assignment` — via
  `src/components/enterprise/time-attendance/api.ts`
- `create_workspace_with_owner` — via `CreateWorkspaceDialog.tsx`
- `get_workspace_leave_for_export`, `get_workspace_members_for_export` — via
  `payroll/PayrollPanel.tsx`, `import-export/utils/data-fetcher.ts`
- `hr_workflow_close_instance`, `hr_workflow_create_instance`,
  `hr_workflow_list_instances`, `hr_workflow_update_task` — via
  `workflows/HRWorkflowInbox.tsx`
- `seed_default_access_systems` — via
  `access/AccessSystemAdmin.tsx`
- `tenant_enabled_features`, `tenant_id_for_workspace` — via
  `useEnterprisePermissions.ts`, `useFeature.ts`

Reached via edge functions:

- `get_user_ids_by_emails`, `has_enterprise_role` — via `import-entity-data`
  and `sync-holidays`
- `enqueue_email` — via `send-transactional-email`

### Edge functions reached (13)

`admin`, `create-instant-enterprise-member`, `delete-account`,
`handle-email-unsubscribe`, `help-regenerator`, `import-entity-data`,
`jira-devops-proxy`, `join-event`, `run-report`, `seed-demo-workspace`,
`send-transactional-email`, `superadmin-hub`, `sync-holidays`.

(No edge function in this 13 invokes any other edge function — chain stops.)

## NOT reached from any UI entry point

### Tables (19)

- `email_send_state` — likely state machine row for the queue worker (paired
  with `process-email-queue` edge fn)
- `enterprise_agile_capacity_events` — capacity events from Jira/agile sync;
  written by background sync, no UI yet
- `enterprise_agile_external_field_mappings` — external field name mapping
  for agile/Jira sync; admin-level config, no UI surfaced
- `enterprise_attendance_audit` — append-only audit log; populated by
  triggers, not read by UI
- `enterprise_attendance_payroll_exports` — payroll export history; likely
  written by `attendance_payroll_export` RPC and `payroll-export` edge fn,
  not shown directly
- `enterprise_calendar_sync_log` — MS365/Google sync log; written by
  `ms365-sync` edge fn (which the app does not invoke)
- `enterprise_catalog_skills` — looks like seed catalog of canonical skills;
  app uses `enterprise_skills` (workspace-scoped copy) instead
- `enterprise_export_jobs` — async export job tracker; tied to background
  worker, no UI
- `enterprise_ganttic_dependencies` — project dependency graph;
  `ganttic_has_dependency_cycle` function exists but no UI consumes it
- `enterprise_integration_sync_log` — integration sync history; populated by
  `ms365-sync`/`jira-devops-proxy` triggers, not read by app
- `enterprise_user_calendar_integrations` — user calendar OAuth tokens;
  manipulated by `ms365-sync` (not invoked by UI)
- `enterprise_workspace_skills` — workspace-level skill catalog; app appears
  to use `enterprise_skills` and `enterprise_workspace_role_skills` instead
- `feature_gate_events` — feature gate analytics; likely written by triggers
  or a server cron
- `leave_request_attachments` — attachments for leave requests; UI form
  shows none — likely planned/feature-flagged
- `tenant_addons`, `tenant_feature_overrides`, `tenant_subscriptions`,
  `tenant_workspaces`, `tenants` — entire multi-tenant billing/subscription
  layer; UI uses `enterprise_workspaces` directly. May be read by
  `superadmin-hub` server-side via SQL (not `.from()`); needs Pass 3
  confirmation

### Functions (31)

Trigger-only / lifecycle utilities (almost certainly attached as triggers,
not callable from app):
- `set_updated_at`, `update_updated_at_column`, `set_hr_workflow_updated_at`,
  `set_webhook_updated_at`, `update_office_equipment_updated_at`,
  `update_office_min_staffing_updated_at`,
  `help_articles_search_trigger`, `handle_new_user`, `handle_leave_quota_change`,
  `enterprise_decision_memory_set_due`,
  `enterprise_memberships_check_manager_cycle`,
  `auto_archive_expired_coverage_rules`, `rls_auto_enable`

RLS helpers / SECURITY DEFINER predicates (used by policies, not by app):
- `has_role`, `is_enterprise_member`, `is_tenant_member`,
  `can_access_event`, `attendance_caller_membership`,
  `attendance_can_edit_period`

Server-side workers / cron callees:
- `delete_email`, `read_email_batch`, `move_to_dlq` — email queue worker
  helpers, called by `process-email-queue` (unreached edge fn)
- `enforce_data_retention` — likely cron-driven retention sweep
- `attendance_expected_hours_for_period`, `attendance_recompute_totals` —
  likely called by triggers on segment changes
- `calc_leave_days`, `ganttic_has_dependency_cycle` — likely trigger-side
  validations / helpers

Seed/setup utilities (probably invoked only by `seed-demo-workspace` edge
fn or migrations, not by app):
- `seed_default_contract_types`, `seed_default_leadership_levels`,
  `seed_workspace_roles`, `import_enterprise_catalog_to_workspace`

### Edge functions (12)

- `auth-email-hook` — Supabase Auth webhook for transactional email; called
  by Supabase platform, not by app code
- `cleanup-demo-workspace` — scheduled cleanup of demo workspaces
- `cleanup-temp-users` — scheduled cleanup of unverified accounts
- `data-migration` — one-shot migration tool, invoked manually by ops
- `handle-email-suppression` — webhook for Resend/SES bounce handling
- `leave-ical` — public iCal feed endpoint hit by external calendar clients
  (via `enterprise_ical_tokens`), not via `functions.invoke`
- `ms365-sync` — Microsoft 365 / Outlook calendar sync; likely cron or webhook
- `payroll-export` — async payroll export worker
- `preview-transactional-email` — design-time email preview tool
- `process-email-queue` — cron worker that drains `email_queue` /
  `email_send_log`
- `security-admin` — security ops endpoint; not referenced from `src/`
- `send-scheduled-reports` — cron that runs scheduled `enterprise_reports`

## Reachable-but-uncertain

- `enterprise_offices` is used by `seed-demo-workspace` and
  `create-instant-enterprise-member`; UI also lists offices via
  `OfficeManager.tsx`. Confirmed reachable, but heavy lifting is server-side.
- `enterprise_decision_memory`, `enterprise_org_chart_snapshots`,
  `enterprise_capacity_snapshots` — surfaced in UI panels
  (`DecisionMemoryEditor`, `OrgChart`, `CapacityDnaPanel`) but those panels
  are inside tabs that may only render for certain roles; reachability
  confirmed at code level, but real users may never open them.
- `platform_audit_events`, `platform_feature_flags`, `addon_features`,
  `addons`, `features`, `tier_features`, `tiers` — only reachable under
  `/superadmin`, which is gated by `user_roles.role = 'admin'`. Reachable
  for superadmins only, dead code for normal users.
- `gdpr_requests`, `data_retention_policies` — only used inside
  `enterprise/security/SecurityCenter.tsx`, which is admin-tab in the
  Enterprise page. Reachable, but UI is admin-only.
- `enterprise_seed_config` — only used in `DemoSeedConfigDialog.tsx`, opened
  from a "Create demo workspace" path; likely dev/superadmin-only.
- `enterprise_developer_portal` tables (`enterprise_api_keys`,
  `enterprise_api_usage_logs`, `enterprise_webhook_subscriptions`) — only
  rendered inside developer portal tab, may be feature-flagged.
- `tenants` / `tenant_*` family: superadmin-hub edge fn does multi-tenant
  admin operations but uses RPC-style payloads, not direct `.from()`. These
  tables MAY still be touched server-side via raw SQL inside `superadmin-hub`
  (not visible to grep on `.from(`). Pass 3 should confirm.
