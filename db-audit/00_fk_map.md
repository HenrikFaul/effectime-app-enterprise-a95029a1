# Foreign-key dependency map (frozen at audit start)

This is the canonical FK graph for the public schema. If a table T appears
as a `parent_table` anywhere below, dropping T would require either
CASCADE or removing the child rows first — i.e. T cannot be unilaterally
declared "unused" without considering child tables.

Reverse index: tables referenced by FK from other tables (= "parents" / "depended-on").

- addons ← addon_features, tenant_addons
- enterprise_access_requests ← enterprise_access_decisions
- enterprise_access_systems ← enterprise_access_requests, enterprise_access_template_systems, enterprise_onboarding_template_steps
- enterprise_access_templates ← enterprise_access_requests, enterprise_access_template_systems
- enterprise_allowances ← enterprise_leave_types
- enterprise_api_keys ← enterprise_api_usage_logs
- enterprise_attendance_oncall_windows ← enterprise_attendance_segments
- enterprise_attendance_periods ← enterprise_attendance_audit, enterprise_attendance_oncall_windows, enterprise_attendance_segments
- enterprise_attendance_schedule_templates ← enterprise_attendance_periods
- enterprise_catalog_categories ← enterprise_catalog_roles, enterprise_workspace_role_categories
- enterprise_catalog_roles ← enterprise_catalog_role_skills, enterprise_workspace_roles
- enterprise_catalog_skills ← enterprise_catalog_role_skills, enterprise_workspace_skills
- enterprise_contract_types ← enterprise_memberships
- enterprise_feature_catalog ← enterprise_feature_catalog (self-ref)
- enterprise_hr_workflow_instances ← enterprise_hr_workflow_tasks
- enterprise_hr_workflow_templates ← enterprise_hr_workflow_instances
- enterprise_leadership_levels ← enterprise_memberships
- enterprise_leave_quotas ← enterprise_quota_transactions
- enterprise_memberships ← (very many child tables: access_requests, attendance_periods/schedule_templates, hr_workflow_*, leave_quotas, member_*, onboarding_instances, project_assignments, quota_transactions, scenario_assignments, wellbeing_*, self-ref via manager_id)
- enterprise_offices ← enterprise_member_site_priorities, enterprise_member_templates, enterprise_memberships, enterprise_office_coverage_rules, enterprise_office_equipment, enterprise_office_min_staffing
- enterprise_onboarding_instances ← enterprise_onboarding_step_completions
- enterprise_onboarding_template_steps ← enterprise_onboarding_step_completions
- enterprise_onboarding_templates ← enterprise_onboarding_instances, enterprise_onboarding_template_steps
- enterprise_org_units ← enterprise_access_templates, enterprise_memberships, enterprise_onboarding_templates, enterprise_org_units (self-ref)
- enterprise_projects ← enterprise_project_assignments, enterprise_project_rates, enterprise_project_resource_requirements, enterprise_project_skill_requirements, enterprise_scenario_assignments
- enterprise_reports ← enterprise_report_schedules
- enterprise_scenarios ← enterprise_scenario_assignments
- enterprise_skills ← enterprise_member_skills, enterprise_office_equipment, enterprise_office_min_staffing, enterprise_project_skill_requirements, enterprise_workspace_skills
- enterprise_teams ← enterprise_team_roles
- enterprise_user_calendar_integrations ← enterprise_calendar_sync_log
- enterprise_work_categories ← enterprise_work_categories (self-ref)
- enterprise_workspace_integrations ← enterprise_agile_capacity_events, enterprise_agile_external_field_mappings, enterprise_agile_field_metadata, enterprise_agile_issues, enterprise_agile_sync_log, enterprise_ganttic_dependencies, enterprise_integration_sync_log
- enterprise_workspace_role_categories ← enterprise_workspace_roles
- enterprise_workspace_roles ← enterprise_access_templates, enterprise_memberships (business_role_id, position_catalog_id), enterprise_onboarding_templates, enterprise_workspace_role_skills
- enterprise_workspace_skills ← enterprise_workspace_role_skills
- **enterprise_workspaces ← ~60 child tables (workspace_id FK pattern)** — bedrock of multi-tenancy.
- events ← event_participants, event_share_tokens, votes, profiles.linked_event_id
- features ← addon_features, tenant_feature_overrides, tier_features
- help_releases ← help_articles
- leave_requests ← approval_decisions, enterprise_integration_sync_log, enterprise_quota_transactions, leave_request_attachments, leave_request_substitutes, leave_requests (self-ref via parent_request_id)
- tenants ← feature_gate_events, tenant_addons, tenant_feature_overrides, tenant_subscriptions, tenant_workspaces
- tiers ← tenant_subscriptions, tier_features
- users (auth.users) ← (very many: created_by/user_id/owner_id columns across the schema)

**Tables that are NOT referenced by any FK as a parent** (leaf nodes —
safer-to-drop candidates *if* code references also absent):

addon_features, approval_decisions, data_retention_policies,
email_send_log, email_send_state, email_unsubscribe_tokens,
enterprise_access_decisions, enterprise_access_template_systems,
enterprise_agile_capacity_events, enterprise_agile_external_field_mappings,
enterprise_agile_field_metadata, enterprise_agile_issues,
enterprise_agile_sync_log, enterprise_api_usage_logs,
enterprise_approval_chains, enterprise_attendance_audit,
enterprise_attendance_payroll_exports, enterprise_attendance_segments,
enterprise_audit_events, enterprise_blocked_dates,
enterprise_calendar_sync_log, enterprise_capacity_snapshots,
enterprise_catalog_role_skills, enterprise_company_leave_days,
enterprise_daily_rules, enterprise_decision_memory,
enterprise_escalation_rules, enterprise_export_jobs,
enterprise_ganttic_dependencies, enterprise_holidays,
enterprise_hr_workflow_tasks, enterprise_ical_tokens,
enterprise_industries, enterprise_integration_sync_log,
enterprise_invitations, enterprise_job_families,
enterprise_member_goals, enterprise_member_rates,
enterprise_member_role_allocations, enterprise_member_site_priorities,
enterprise_member_skills, enterprise_member_templates,
enterprise_notification_preferences, enterprise_notifications,
enterprise_office_coverage_rules, enterprise_office_equipment,
enterprise_office_min_staffing, enterprise_onboarding_step_completions,
enterprise_org_chart_snapshots, enterprise_project_assignments,
enterprise_project_rates, enterprise_project_resource_requirements,
enterprise_project_skill_requirements, enterprise_quota_transactions,
enterprise_report_schedules, enterprise_role_definitions,
enterprise_role_permissions, enterprise_rule_templates,
enterprise_scenario_assignments, enterprise_seed_config,
enterprise_shift_assignments, enterprise_team_roles,
enterprise_translation_overrides, enterprise_ui_section_states,
enterprise_webhook_subscriptions, event_participants,
event_share_tokens, favorites, feature_gate_events, friendships,
gdpr_requests, help_articles, leave_request_attachments,
leave_request_substitutes, payroll_export_configs, payroll_periods,
personal_availability, platform_audit_events, platform_feature_flags,
suppressed_emails, tenant_addons, tenant_calendar_settings,
tenant_feature_overrides, tenant_subscriptions, tenant_workspaces,
tier_features, user_roles, votes, wellbeing_alerts, wellbeing_scores

NOTE: "leaf" here = "no other table FKs into it as parent". It is still
referenced indirectly via code, RLS policies, triggers, and FKs to
other parent tables.
