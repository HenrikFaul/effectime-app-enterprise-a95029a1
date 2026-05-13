# Canonical Supabase inventory — frozen at audit start

Snapshot taken: 2026-05-13 19:45 UTC
Project: `oezlzzmzzvbvinuysxaz`
Scope: `public` schema + edge functions only.

## Counts

| Kind | Count |
|---|---:|
| Tables (public, relkind=r) | 137 |
| Views (public, relkind=v) | 2 |
| Materialized views | 0 |
| Functions (public, all langs) | 54 |
| Enum types (public) | 11 |
| Triggers (public, non-internal) | 82 |
| Edge Functions (status=ACTIVE) | 26 |
| **Total scope** | **312** |

## Tables (137)

account_deletions, addon_features, addons, approval_decisions,
data_retention_policies, email_send_log, email_send_state,
email_unsubscribe_tokens, enterprise_access_decisions,
enterprise_access_requests, enterprise_access_systems,
enterprise_access_template_systems, enterprise_access_templates,
enterprise_agile_capacity_events, enterprise_agile_external_field_mappings,
enterprise_agile_field_metadata, enterprise_agile_issues,
enterprise_agile_sync_log, enterprise_allowances, enterprise_api_keys,
enterprise_api_usage_logs, enterprise_approval_chains,
enterprise_attendance_audit, enterprise_attendance_oncall_windows,
enterprise_attendance_payroll_exports, enterprise_attendance_periods,
enterprise_attendance_schedule_templates, enterprise_attendance_segments,
enterprise_audit_events, enterprise_blocked_dates,
enterprise_calendar_sync_log, enterprise_capacity_snapshots,
enterprise_catalog_categories, enterprise_catalog_role_skills,
enterprise_catalog_roles, enterprise_catalog_skills,
enterprise_company_leave_days, enterprise_contract_types,
enterprise_daily_rules, enterprise_decision_memory,
enterprise_escalation_rules, enterprise_export_jobs,
enterprise_feature_catalog, enterprise_ganttic_dependencies,
enterprise_holidays, enterprise_hr_workflow_instances,
enterprise_hr_workflow_tasks, enterprise_hr_workflow_templates,
enterprise_ical_tokens, enterprise_industries,
enterprise_integration_sync_log, enterprise_invitations,
enterprise_job_families, enterprise_leadership_levels,
enterprise_leave_quotas, enterprise_leave_types, enterprise_member_goals,
enterprise_member_rates, enterprise_member_role_allocations,
enterprise_member_site_priorities, enterprise_member_skills,
enterprise_member_templates, enterprise_memberships,
enterprise_notification_preferences, enterprise_notifications,
enterprise_office_coverage_rules, enterprise_office_equipment,
enterprise_office_min_staffing, enterprise_offices,
enterprise_onboarding_instances, enterprise_onboarding_step_completions,
enterprise_onboarding_template_steps, enterprise_onboarding_templates,
enterprise_org_chart_snapshots, enterprise_org_units,
enterprise_project_assignments, enterprise_project_rates,
enterprise_project_resource_requirements,
enterprise_project_skill_requirements, enterprise_projects,
enterprise_quota_transactions, enterprise_report_schedules,
enterprise_reports, enterprise_role_definitions,
enterprise_role_permissions, enterprise_rule_templates,
enterprise_scenario_assignments, enterprise_scenarios,
enterprise_seed_config, enterprise_shift_assignments,
enterprise_skills, enterprise_team_roles, enterprise_teams,
enterprise_translation_overrides, enterprise_ui_section_states,
enterprise_user_calendar_integrations, enterprise_webhook_subscriptions,
enterprise_work_categories, enterprise_workspace_integrations,
enterprise_workspace_role_categories, enterprise_workspace_role_skills,
enterprise_workspace_roles, enterprise_workspace_skills,
enterprise_workspaces, event_participants, event_share_tokens, events,
favorites, feature_gate_events, features, friendships, gdpr_requests,
help_articles, help_releases, leave_request_attachments,
leave_request_substitutes, leave_requests, payroll_export_configs,
payroll_periods, personal_availability, platform_audit_events,
platform_feature_flags, profiles, suppressed_emails, tenant_addons,
tenant_calendar_settings, tenant_feature_overrides,
tenant_subscriptions, tenant_workspaces, tenants, tier_features,
tiers, user_roles, votes, wellbeing_alerts, wellbeing_scores

## Views (2)

enterprise_leave_quota_balances, enterprise_org_pulse_membership

## Functions (54)

attendance_caller_membership, attendance_can_edit_period,
attendance_delete_oncall_window, attendance_delete_segment,
attendance_expected_hours_for_period, attendance_get_or_create_period,
attendance_list_workspace_periods, attendance_payroll_export,
attendance_recompute_totals, attendance_record_export,
attendance_remove_site_assignment, attendance_transition_period,
attendance_upsert_oncall_window, attendance_upsert_segment,
attendance_upsert_site_assignment, auto_archive_expired_coverage_rules,
calc_leave_days, can_access_event, create_workspace_with_owner,
delete_email, enforce_data_retention, enqueue_email,
enterprise_decision_memory_set_due,
enterprise_memberships_check_manager_cycle, ganttic_has_dependency_cycle,
get_user_ids_by_emails, get_workspace_leave_for_export,
get_workspace_members_for_export, handle_leave_quota_change,
handle_new_user, has_enterprise_role, has_role,
help_articles_search_trigger, hr_workflow_close_instance,
hr_workflow_create_instance, hr_workflow_list_instances,
hr_workflow_update_task, import_enterprise_catalog_to_workspace,
is_enterprise_member, is_tenant_member, move_to_dlq,
read_email_batch, rls_auto_enable, seed_default_access_systems,
seed_default_contract_types, seed_default_leadership_levels,
seed_workspace_roles, set_hr_workflow_updated_at, set_updated_at,
set_webhook_updated_at, tenant_enabled_features, tenant_id_for_workspace,
update_office_equipment_updated_at, update_office_min_staffing_updated_at,
update_updated_at_column

## Enums (11)

app_role, enterprise_attendance_period_status,
enterprise_attendance_segment_type, enterprise_experience_level,
enterprise_membership_status, enterprise_role, integration_provider,
leave_request_status, leave_type, quota_transaction_type,
substitute_status

## Triggers (82) — all enabled (`O` = on by default)

(82 triggers, mostly `update_updated_at_column` and `set_updated_at`
wired to per-table updated_at maintenance. See passes/pass3 for the
per-function classification.)

## Edge Functions (26, all ACTIVE)

admin, auth-email-hook, cleanup-demo-workspace, cleanup-temp-users,
create-instant-enterprise-member, data-migration, delete-account,
handle-email-suppression, handle-email-unsubscribe, help-regenerator,
import-entity-data, jira-devops-proxy, join-event, leave-ical,
ms365-sync, payroll-export, preview-transactional-email,
process-email-queue, run-report, security-admin, seed-demo-workspace,
send-scheduled-reports, send-transactional-email, superadmin-hub,
sync-holidays
